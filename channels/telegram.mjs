import { postJson, requireKeys } from './http.mjs';

export async function send(msg, cfg, { signal } = {}) {
  requireKeys(cfg, ['botToken', 'chatId'], 'telegram');
  const base = cfg.apiBase ?? 'https://api.telegram.org';
  await postJson(`${base}/bot${cfg.botToken}/sendMessage`,
    { chat_id: cfg.chatId, text: msg.text, disable_web_page_preview: true },
    { signal, name: 'telegram' });
}
