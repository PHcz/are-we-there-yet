import { postJson, requireKeys } from './http.mjs';
import { renderDiscord } from '../lib/render.mjs';

export async function send(msg, cfg, { signal } = {}) {
  requireKeys(cfg, ['webhookUrl'], 'discord');
  await postJson(cfg.webhookUrl, { content: renderDiscord(msg) }, { signal, name: 'discord' });
}
