import { postJson, requireKeys } from './http.mjs';
import { renderSlack } from '../lib/render.mjs';

export async function send(msg, cfg, { signal } = {}) {
  requireKeys(cfg, ['webhookUrl'], 'slack');
  await postJson(cfg.webhookUrl, { text: renderSlack(msg) }, { signal, name: 'slack' });
}
