import { postForm, requireKeys } from './http.mjs';

export async function send(msg, cfg, { signal } = {}) {
  requireKeys(cfg, ['token', 'user'], 'pushover');
  const base = cfg.apiBase ?? 'https://api.pushover.net';
  const priority = msg.kind === 'waiting' ? (cfg.waitingPriority ?? 0) : (cfg.priority ?? 0);
  const fields = { token: cfg.token, user: cfg.user, title: msg.title, message: msg.body, priority: String(priority) };
  if (priority === 2) Object.assign(fields, { retry: '60', expire: '3600' });
  await postForm(`${base}/1/messages.json`, fields, { signal, name: 'pushover' });
}
