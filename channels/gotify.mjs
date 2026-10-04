import { postJson, requireKeys } from './http.mjs';

export async function send(msg, cfg, { signal } = {}) {
  requireKeys(cfg, ['server', 'token'], 'gotify');
  const server = cfg.server.replace(/\/$/, '');
  const priority = msg.kind === 'waiting' ? (cfg.waitingPriority ?? 8) : (cfg.priority ?? 5);
  await postJson(`${server}/message`, { title: msg.title, message: msg.body, priority },
    { headers: { 'x-gotify-key': cfg.token }, signal, name: 'gotify' });
}
