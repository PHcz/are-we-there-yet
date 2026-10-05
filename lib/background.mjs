// Background jobs Claude Code started (run_in_background) that have not reported back yet.
const NOTIFICATION_ID = /<tool-use-id>([^<]+)<\/tool-use-id>/g;

function label(call) {
  const raw = String(call.input?.description || call.input?.command || call.name || 'task').replace(/\s+/g, ' ').trim();
  return raw.length > 60 ? `${raw.slice(0, 59)}…` : raw;
}

export function pendingBackgroundTasks(entries) {
  const started = new Map();
  const finished = new Set();
  for (const entry of entries ?? []) {
    if (!entry || typeof entry !== 'object') continue;
    const content = entry.message?.content;
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block?.type === 'tool_use' && block.id && block.input?.run_in_background === true) started.set(block.id, label(block));
      }
    }
    const text = JSON.stringify(entry);
    if (text.includes('<task-notification>')) {
      for (const m of text.matchAll(NOTIFICATION_ID)) finished.add(m[1]);
    }
  }
  return [...started].filter(([id]) => !finished.has(id)).map(([, name]) => name);
}
