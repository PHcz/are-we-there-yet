import { loadConfig } from './config.mjs';
import { loadState, updateState, pruneOldSessions } from './state.mjs';
import { parseNotifyCommand, applyCommand, describeConfig } from './command.mjs';
import { resolveSessionName } from './session.mjs';
import { readTailLines, lastAssistantText } from './transcript.mjs';
import { shouldNotify, getIdleSeconds } from './filters.mjs';

export const stateKey = (event) => (event.tool === 'claude' ? event.sessionId : `${event.tool}:${event.sessionId}`);

// Only Claude Code transcripts are in the JSONL format lib/transcript.mjs understands.
const claudeTranscript = (event) => (event.tool === 'claude' ? event.transcriptPath : undefined);

function sessionName({ event, cfg, state, label }) {
  const name = cfg.name || event.title || resolveSessionName({
    cfg: {},
    cwd: event.cwd,
    transcriptPath: claudeTranscript(event),
    state: { ...state, firstPrompt: state.firstPrompt || event.firstPrompt },
  });
  return label ? `${label} · ${name}` : name;
}

function buildJob({ kind, waitingReason, cfg, event, state, text, durationSec, label }) {
  return {
    kind,
    waitingReason,
    sessionName: sessionName({ event, cfg, state, label }),
    durationSec,
    cwd: event.cwd,
    summaryInput: {
      text: text ?? '',
      mode: kind === 'done' ? cfg.summary.mode : 'last-message',
      maxChars: cfg.summary.maxChars,
      transcriptPath: claudeTranscript(event),
    },
    cfg,
  };
}

function onPrompt(event, now, label) {
  const key = stateKey(event);
  const prompt = event.prompt ?? '';
  const cmd = parseNotifyCommand(prompt);
  if (!cmd) {
    const isNew = !loadState(key).turnStartedAt;
    updateState(key, (s) => ({ ...s, turnStartedAt: now, firstPrompt: s.firstPrompt || prompt.slice(0, 200) || undefined }));
    if (isNew) pruneOldSessions();
    return {};
  }
  const message = applyCommand(cmd, { cwd: event.projectDir, sessionId: key });
  const cfg = loadConfig({ cwd: event.projectDir, sessionId: key });
  const parts = [message, describeConfig(cfg)].filter(Boolean);
  let job;
  if (cmd.action === 'test' && !cmd.errors.length) {
    parts.unshift(`Sending test to: ${cfg.channels.join(', ') || '(no channels configured)'}. Run /awty again in a few seconds to see any error.`);
    job = buildJob({ kind: 'test', cfg, event, state: loadState(key), text: 'are-we-there-yet is configured correctly.', label });
  }
  return { result: { block: { reason: parts.join('\n\n') } }, job };
}

function maybeNotify({ event, kind, source, waitingReason, text, now, idle, label }) {
  const key = stateKey(event);
  const cfg = loadConfig({ cwd: event.projectDir, sessionId: key });
  const stored = loadState(key);
  const state = { ...stored, turnStartedAt: event.turnStartedAt ?? stored.turnStartedAt };
  const needIdle = (cfg.filters?.onlyWhenAwaySec ?? 0) > 0;
  const decision = shouldNotify({ kind, source, cfg, state, now, idleSec: needIdle ? idle() : null });
  if (!decision.ok) return {};
  const durationSec = kind === 'done' && state.turnStartedAt ? Math.round((now - state.turnStartedAt) / 1000) : null;
  const resolvedText = typeof text === 'function' ? text() : text;
  const job = buildJob({ kind, waitingReason, cfg, event, state, text: resolvedText, durationSec, label });
  updateState(key, (s) => ({
    ...s,
    firstPrompt: s.firstPrompt || event.firstPrompt || undefined,
    lastSentAt: now,
    ...(kind === 'waiting' ? { lastWaitingSentAt: now } : {}),
    ...(kind === 'done' ? { lastDoneSentAt: now } : {}),
  }));
  return { job };
}

export function handle(event, { now = Date.now(), idle = getIdleSeconds, label = '' } = {}) {
  if (process.env.AWTY_DISABLE === '1' || !event?.sessionId) return {};
  const common = { event, now, idle, label };
  switch (event.type) {
    case 'prompt':
      return onPrompt(event, now, label);
    case 'question':
      return maybeNotify({ ...common, kind: 'waiting', source: 'question', waitingReason: 'question', text: event.text ?? '' });
    case 'waiting':
      return maybeNotify({ ...common, kind: 'waiting', source: 'notification', waitingReason: 'permission', text: event.text ?? '' });
    case 'done':
      return maybeNotify({
        ...common, kind: 'done', source: 'stop',
        text: () => event.text || (claudeTranscript(event) ? lastAssistantText(readTailLines(event.transcriptPath)) : '') || '',
      });
    default:
      return {};
  }
}
