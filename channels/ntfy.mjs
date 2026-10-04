import { postJson, requireKeys } from './http.mjs';

export async function send(msg, cfg, { signal } = {}) {
  requireKeys(cfg, ['topic'], 'ntfy');
  const server = (cfg.server ?? 'https://ntfy.sh').replace(/\/$/, '');
  const priority = msg.kind === 'waiting' ? (cfg.waitingPriority ?? 4) : (cfg.priority ?? 3);
  const headers = cfg.token ? { authorization: `Bearer ${cfg.token}` } : {};
  await postJson(`${server}/`, { topic: cfg.topic, title: msg.title, message: msg.body, priority },
    { headers, signal, name: 'ntfy' });
}
