import { postJson, requireKeys } from './http.mjs';
import { renderTelegramHtml } from '../lib/render.mjs';

export async function send(msg, cfg, { signal } = {}) {
  requireKeys(cfg, ['botToken', 'chatId'], 'telegram');
  const url = `${cfg.apiBase ?? 'https://api.telegram.org'}/bot${cfg.botToken}/sendMessage`;
  try {
    await postJson(url, { chat_id: cfg.chatId, text: renderTelegramHtml(msg), parse_mode: 'HTML', disable_web_page_preview: true }, { signal, name: 'telegram' });
  } catch (err) {
    // A formatting problem must never cost a notification: resend once as plain text.
    if (!/HTTP 400/.test(err.message) || !/can't parse entities/i.test(err.message)) throw err;
    await postJson(url, { chat_id: cfg.chatId, text: msg.text, disable_web_page_preview: true }, { signal, name: 'telegram' });
  }
}
