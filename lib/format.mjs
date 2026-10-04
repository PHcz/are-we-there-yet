import os from 'node:os';

export function formatDuration(sec) {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
}

function tildify(p) {
  const home = os.homedir();
  return p && p.startsWith(home) ? `~${p.slice(home.length)}` : p || '';
}

const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export function formatMessage({ kind, waitingReason, sessionName, durationSec, summary, cwd, now = new Date() }) {
  let title;
  if (kind === 'done') {
    title = `✅ [${sessionName}] Done${durationSec != null ? ` · ${formatDuration(durationSec)}` : ''}`;
  } else if (kind === 'waiting') {
    title = `${waitingReason === 'question' ? '❓' : '⏳'} [${sessionName}] Waiting for you`;
  } else {
    title = `🔔 [${sessionName}] Test notification`;
  }
  const footer = `📁 ${tildify(cwd)} · ${hhmm(now)}`;
  const body = summary ? `${summary}\n${footer}` : footer;
  return { title, body, text: `${title}\n${body}`, kind };
}
