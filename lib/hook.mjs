import { loadConfig } from './config.mjs';
import { loadState, updateState, pruneOldSessions } from './state.mjs';
import { parseNotifyCommand, applyCommand, describeConfig } from './command.mjs';
import { resolveSessionName } from './session.mjs';
import { readTailLines, lastAssistantText } from './transcript.mjs';
import { shouldNotify, getIdleSeconds } from './filters.mjs';

export const WAITING_TYPES = new Set(['permission_prompt', 'idle_prompt', 'elicitation_dialog', 'agent_needs_input']);

function buildJob({ kind, waitingReason, cfg, input, state, text, durationSec }) {
  return {
    kind,
    waitingReason,
    sessionName: resolveSessionName({ cfg, cwd: input.cwd, transcriptPath: input.transcript_path, state }),
    durationSec,
    cwd: input.cwd,
    summaryInput: {
      text: text ?? '',
      mode: kind === 'done' ? cfg.summary.mode : 'last-message',
      maxChars: cfg.summary.maxChars,
      transcriptPath: input.transcript_path,
    },
    cfg,
  };
}

function onPrompt(input, now) {
  const sessionId = input.session_id;
  const prompt = input.prompt ?? input.prompt_text ?? '';
  const cmd = parseNotifyCommand(prompt);
  if (!cmd) {
    const isNew = !loadState(sessionId).turnStartedAt;
    updateState(sessionId, (s) => ({ ...s, turnStartedAt: now, firstPrompt: s.firstPrompt || prompt.slice(0, 200) || undefined }));
    if (isNew) pruneOldSessions();
    return {};
  }
  const message = applyCommand(cmd, { cwd: input.cwd, sessionId });
  const cfg = loadConfig({ cwd: input.cwd, sessionId });
  const parts = [message, describeConfig(cfg)].filter(Boolean);
  let job;
  if (cmd.action === 'test' && !cmd.errors.length) {
    parts.unshift(`Sending test to: ${cfg.channels.join(', ') || '(no channels configured)'}. Run /notify again in a few seconds to see any error.`);
    job = buildJob({ kind: 'test', cfg, input, state: loadState(sessionId), text: 'are-we-there-yet is configured correctly.' });
  }
  return { stdout: { decision: 'block', reason: parts.join('\n\n') }, job };
}

function maybeNotify({ input, kind, source, waitingReason, text, now, idle }) {
  const sessionId = input.session_id;
  const cfg = loadConfig({ cwd: input.cwd, sessionId });
  const state = loadState(sessionId);
  const needIdle = (cfg.filters?.onlyWhenAwaySec ?? 0) > 0;
  const decision = shouldNotify({ kind, source, cfg, state, now, idleSec: needIdle ? idle() : null });
  if (!decision.ok) return {};
  const durationSec = kind === 'done' && state.turnStartedAt ? Math.round((now - state.turnStartedAt) / 1000) : null;
  const resolvedText = typeof text === 'function' ? text() : text;
  const job = buildJob({ kind, waitingReason, cfg, input, state, text: resolvedText, durationSec });
  updateState(sessionId, (s) => ({ ...s, lastSentAt: now, ...(kind === 'waiting' ? { lastWaitingSentAt: now } : {}) }));
  return { job };
}

function questionText(toolInput) {
  return (toolInput?.questions ?? [])
    .map((q) => {
      const labels = (q.options ?? []).map((o) => o.label).filter(Boolean);
      return labels.length ? `${q.question} (${labels.join(' / ')})` : q.question;
    })
    .join(' · ');
}

export function handle(input, { now = Date.now(), idle = getIdleSeconds } = {}) {
  if (process.env.CLAUDE_NOTIFY_DISABLE === '1' || !input?.session_id) return {};
  switch (input.hook_event_name) {
    case 'UserPromptSubmit':
      return onPrompt(input, now);
    case 'PreToolUse':
      if (input.tool_name !== 'AskUserQuestion') return {};
      return maybeNotify({ input, kind: 'waiting', source: 'question', waitingReason: 'question', text: questionText(input.tool_input), now, idle });
    case 'Notification':
      if (input.notification_type && !WAITING_TYPES.has(input.notification_type)) return {};
      return maybeNotify({ input, kind: 'waiting', source: 'notification', waitingReason: 'permission', text: input.message ?? '', now, idle });
    case 'Stop':
      if (input.stop_hook_active) return {};
      return maybeNotify({
        input, kind: 'done', source: 'stop', now, idle,
        text: () => input.last_assistant_message ?? lastAssistantText(readTailLines(input.transcript_path)) ?? '',
      });
    default:
      return {};
  }
}
