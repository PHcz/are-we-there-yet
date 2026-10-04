import { postJson, requireKeys } from './http.mjs';

export async function send(msg, cfg, { signal } = {}) {
  requireKeys(cfg, ['webhookUrl'], 'discord');
  await postJson(cfg.webhookUrl, { content: msg.text }, { signal, name: 'discord' });
}
