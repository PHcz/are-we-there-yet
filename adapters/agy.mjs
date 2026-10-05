import { readHeadLines, readTailLines } from '../lib/transcript.mjs';

export const name = 'agy';
export const label = 'Antigravity';
export const commandWord = 'awty';

const USER_REQUEST = /<USER_REQUEST>\s*([\s\S]*?)\s*<\/USER_REQUEST>/;

function userText(entry) {
  const content = typeof entry?.content === 'string' ? entry.content : '';
  const match = USER_REQUEST.exec(content);
  return (match ? match[1] : content).trim();
}

export function firstPrompt(transcriptPath) {
  const entry = readHeadLines(transcriptPath, 65536).find((e) => e.type === 'USER_INPUT');
  return (entry && userText(entry)) || undefined;
}

export function lastReply(entries) {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e.type === 'PLANNER_RESPONSE' && typeof e.content === 'string' && e.content.trim()) return e.content.trim();
  }
  return '';
}

export function lastUserInputAt(entries) {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].type === 'USER_INPUT') {
      const t = Date.parse(entries[i].created_at);
      return Number.isNaN(t) ? undefined : t;
    }
  }
  return undefined;
}

function questionText(args) {
  return (Array.isArray(args?.questions) ? args.questions : [])
    .filter((q) => typeof q?.question === 'string' && q.question.trim())
    .map((q) => {
      const options = (q.options ?? []).map((o) => (typeof o === 'string' ? o : o?.label)).filter(Boolean);
      return options.length ? `${q.question} (${options.join(' / ')})` : q.question;
    })
    .join(' · ');
}

function permissionText(args) {
  const what = [args?.Action, args?.Target].filter(Boolean).join(' ');
  return [args?.Reason, what].filter(Boolean).join(' — ');
}

// Antigravity payloads carry no event name; the installer passes it as --event.
export function normalize(raw, { event } = {}) {
  if (!raw?.conversationId) return null;
  const cwd = raw.workspacePaths?.[0] || process.cwd();
  const transcript = raw.transcriptPath;
  const base = { tool: name, sessionId: raw.conversationId, cwd, projectDir: cwd };
  if (event === 'PreToolUse') {
    const call = raw.toolCall ?? {};
    const text = call.name === 'ask_question' ? questionText(call.args) : call.name === 'ask_permission' ? permissionText(call.args) : '';
    return text ? { ...base, type: 'question', firstPrompt: firstPrompt(transcript), text } : null;
  }
  if (event === 'Stop') {
    if (raw.fullyIdle === false) return null;
    const entries = readTailLines(transcript);
    return {
      ...base,
      type: 'done',
      firstPrompt: firstPrompt(transcript),
      text: lastReply(entries),
      turnStartedAt: lastUserInputAt(entries),
    };
  }
  return null;
}

// Never print a decision: Antigravity treats "allow" as auto-approval.
export function respond() {
  return '';
}
