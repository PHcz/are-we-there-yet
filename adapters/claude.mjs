import { readTailLines } from '../lib/transcript.mjs';
import { pendingBackgroundTasks } from '../lib/background.mjs';

export const name = 'claude';
export const label = '';
export const commandWord = '/awty';

const WAITING_TYPES = new Set(['permission_prompt', 'elicitation_dialog', 'agent_needs_input', 'worker_permission_prompt']);

function questionText(toolInput) {
  return (toolInput?.questions ?? [])
    .map((q) => [q.question, ...(q.options ?? []).map((o) => o.label).filter(Boolean).map((l) => `• ${l}`)].join('\n'))
    .join('\n\n');
}

export function normalize(raw) {
  if (!raw?.session_id) return null;
  const base = {
    tool: name,
    sessionId: raw.session_id,
    cwd: raw.cwd,
    projectDir: process.env.CLAUDE_PROJECT_DIR || raw.cwd,
    transcriptPath: raw.transcript_path,
  };
  switch (raw.hook_event_name) {
    case 'UserPromptSubmit':
      return { ...base, type: 'prompt', prompt: raw.prompt ?? raw.prompt_text ?? '' };
    case 'PreToolUse':
      return raw.tool_name === 'AskUserQuestion' ? { ...base, type: 'question', text: questionText(raw.tool_input) } : null;
    case 'Notification':
      // Sent by a mod through $.ui.notify(text, { title }).
      if (raw.notification_type === 'plugin_notification') {
        return { ...base, type: 'waiting', text: [raw.title, raw.message].filter(Boolean).join(': ') };
      }
      // A background session ended ("<label> finished|failed"): not this session's turn.
      if (raw.notification_type === 'agent_completed') return { ...base, type: 'agent_done', text: raw.message ?? '' };
      if (raw.notification_type && !WAITING_TYPES.has(raw.notification_type)) return null;
      return { ...base, type: 'waiting', text: raw.message ?? '' };
    case 'Stop':
      return raw.stop_hook_active
        ? null
        : { ...base, type: 'done', text: raw.last_assistant_message || '', background: pendingBackgroundTasks(readTailLines(raw.transcript_path)) };
    default:
      return null;
  }
}

export function respond(result) {
  return result?.block ? JSON.stringify({ decision: 'block', reason: result.block.reason }) : '';
}
