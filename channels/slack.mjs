import { postJson, requireKeys } from './http.mjs';

export async function send(msg, cfg, { signal } = {}) {
  requireKeys(cfg, ['webhookUrl'], 'slack');
  await postJson(cfg.webhookUrl, { text: msg.text }, { signal, name: 'slack' });
}
