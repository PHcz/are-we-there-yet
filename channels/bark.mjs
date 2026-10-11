import { postJson, requireKeys } from './http.mjs';

export async function send(msg, cfg, { signal } = {}) {
  requireKeys(cfg, ['key'], 'bark');
  const server = (cfg.server ?? 'https://api.day.app').replace(/\/$/, '');
  const level = msg.kind === 'waiting' ? (cfg.waitingLevel ?? 'timeSensitive') : (cfg.level ?? 'active');
  await postJson(`${server}/push`,
    { device_key: cfg.key, title: msg.title, body: msg.body, level, group: 'awty' },
    { signal, name: 'bark' });
}
