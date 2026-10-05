import path from 'node:path';

export function formatDuration(sec) {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
}

const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const STATUS = { done: 'Done', waiting: 'Waiting for you', test: 'Test notification' };

function emojiFor(kind, waitingReason) {
  if (kind === 'done') return '✅';
  if (kind === 'waiting') return waitingReason === 'question' ? '❓' : '⏳';
  return '🔔';
}

// Structured message: channels render the fields natively; title/body/text are the plain fallback.
export function formatMessage({ kind, waitingReason, sessionName, tool = '', durationSec, summary = '', cwd, now = new Date() }) {
  const emoji = emojiFor(kind, waitingReason);
  const status = STATUS[kind] ?? STATUS.test;
  const duration = kind === 'done' && durationSec != null ? formatDuration(durationSec) : '';
  const project = path.basename(cwd || '') || cwd || '';
  const time = hhmm(now);
  const title = `${emoji} ${status}${duration ? ` · ${duration}` : ''} · ${sessionName}${tool ? ` (${tool})` : ''}`;
  const footer = `${project} · ${time}`;
  const body = summary ? `${summary}\n\n${footer}` : footer;
  return { kind, emoji, status, duration, session: sessionName, tool, summary, project, time, title, body, text: `${title}\n${body}` };
}
