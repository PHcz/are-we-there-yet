export const name = 'claude';
export const label = '';
export const commandWord = '/awty';

const WAITING_TYPES = new Set(['permission_prompt', 'elicitation_dialog', 'agent_needs_input']);

function questionText(toolInput) {
  return (toolInput?.questions ?? [])
    .map((q) => {
      const labels = (q.options ?? []).map((o) => o.label).filter(Boolean);
      return labels.length ? `${q.question} (${labels.join(' / ')})` : q.question;
    })
    .join(' · ');
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
      if (raw.notification_type && !WAITING_TYPES.has(raw.notification_type)) return null;
      return { ...base, type: 'waiting', text: raw.message ?? '' };
    case 'Stop':
      return raw.stop_hook_active ? null : { ...base, type: 'done', text: raw.last_assistant_message || '' };
    default:
      return null;
  }
}

export function respond(result) {
  return result?.block ? JSON.stringify({ decision: 'block', reason: result.block.reason }) : '';
}
