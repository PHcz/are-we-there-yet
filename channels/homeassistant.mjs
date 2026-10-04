import { postJson, requireKeys } from './http.mjs';

export async function send(msg, cfg, { signal } = {}) {
  requireKeys(cfg, ['url', 'token', 'service'], 'homeassistant');
  const base = cfg.url.replace(/\/$/, '');
  await postJson(`${base}/api/services/notify/${cfg.service}`, { title: msg.title, message: msg.body },
    { headers: { authorization: `Bearer ${cfg.token}` }, signal, name: 'homeassistant' });
}
