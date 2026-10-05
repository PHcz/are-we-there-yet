// Native "Card" renderings of a structured message (see lib/format.mjs).
const html = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const discordEsc = (s) => String(s ?? '').replace(/([\\*_~`|>])/g, '\\$1');

function card(m, { esc, bold, italic, quote }) {
  const head = `${m.emoji} ${bold(esc(m.status))}${m.duration ? ` · ${esc(m.duration)}` : ''}\n${bold(esc(m.session))}${m.tool ? ` · ${esc(m.tool)}` : ''}`;
  const parts = [head];
  if (m.summary) parts.push(quote(m.summary, esc));
  parts.push(italic(`${esc(m.project)} · ${esc(m.time)}`));
  return parts.join('\n\n');
}

const quoteLines = (text, esc) => text.split('\n').map((l) => `> ${esc(l)}`).join('\n');

export function renderTelegramHtml(m) {
  return card(m, {
    esc: html,
    bold: (s) => `<b>${s}</b>`,
    italic: (s) => `<i>${s}</i>`,
    quote: (text, esc) => `<blockquote>${esc(text)}</blockquote>`,
  });
}

export function renderSlack(m) {
  return card(m, { esc: html, bold: (s) => `*${s}*`, italic: (s) => `_${s}_`, quote: quoteLines });
}

export function renderDiscord(m) {
  return card(m, { esc: discordEsc, bold: (s) => `**${s}**`, italic: (s) => `*${s}*`, quote: quoteLines });
}
