import os from 'node:os';
import path from 'node:path';
import { readTailLines } from '../lib/transcript.mjs';

export const name = 'codex';
export const label = 'Codex';
export const commandWord = 'awty';

export function codexHome() {
  return process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
}

// Codex auto-titles threads in session_index.jsonl; later lines supersede earlier ones.
export function threadTitle(sessionId) {
  const entries = readTailLines(path.join(codexHome(), 'session_index.jsonl'), 262144);
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e.id === sessionId && typeof e.thread_name === 'string' && e.thread_name.trim()) return e.thread_name.trim();
  }
  return undefined;
}

export function normalize(raw) {
  if (!raw?.session_id) return null;
  const base = { tool: name, sessionId: raw.session_id, cwd: raw.cwd, projectDir: raw.cwd };
  switch (raw.hook_event_name) {
    case 'UserPromptSubmit': {
      // Codex rejects unknown "/" commands before hooks run, so users type "awty …".
      const prompt = String(raw.prompt ?? '').trim();
      return { ...base, type: 'prompt', prompt: /^awty(\s|$)/.test(prompt) ? `/${prompt}` : prompt };
    }
    case 'PermissionRequest':
      return {
        ...base,
        type: 'waiting',
        title: threadTitle(raw.session_id),
        text: raw.tool_input?.description || raw.tool_input?.command || raw.tool_name || '',
      };
    case 'Stop':
      return raw.stop_hook_active
        ? null
        : { ...base, type: 'done', title: threadTitle(raw.session_id), text: raw.last_assistant_message || '' };
    default:
      return null;
  }
}

export function respond(result) {
  return result?.block ? JSON.stringify({ decision: 'block', reason: result.block.reason }) : '';
}
