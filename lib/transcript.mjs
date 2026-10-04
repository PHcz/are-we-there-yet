import fs from 'node:fs';

function parseLines(text) {
  const out = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const v = JSON.parse(line);
      if (v && typeof v === 'object') out.push(v);
    } catch {}
  }
  return out;
}

function readSlice(file, maxBytes, fromEnd) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const size = fs.fstatSync(fd).size;
    const len = Math.min(size, maxBytes);
    const start = fromEnd ? size - len : 0;
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, start);
    let text = buf.toString('utf8');
    if (fromEnd && start > 0) text = text.slice(text.indexOf('\n') + 1);
    if (!fromEnd && len < size) text = text.slice(0, text.lastIndexOf('\n'));
    return text;
  } catch {
    return '';
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

export const readTailLines = (file, maxBytes = 524288) => parseLines(readSlice(file, maxBytes, true));
export const readHeadLines = (file, maxBytes = 262144) => parseLines(readSlice(file, maxBytes, false));

function textOf(entry) {
  const c = entry?.message?.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) {
    return c.filter((b) => b?.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n');
  }
  return '';
}

function isRealUserPrompt(e) {
  if (e.type !== 'user' || e.isMeta) return false;
  const c = e.message?.content;
  if (Array.isArray(c) && c.some((b) => b?.type === 'tool_result')) return false;
  const t = textOf(e).trim();
  return t.length > 0 && !t.startsWith('<');
}

export function lastAssistantText(entries) {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].type !== 'assistant') continue;
    const t = textOf(entries[i]).trim();
    if (t) return t;
  }
  return null;
}

export function customTitle(entries) {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e.type === 'custom-title' && typeof e.customTitle === 'string' && e.customTitle.trim()) {
      return e.customTitle.trim();
    }
  }
  return null;
}

export function firstUserPrompt(entries) {
  const e = entries.find(isRealUserPrompt);
  return e ? textOf(e).trim() : null;
}

export function conversationTail(entries, maxChars = 4000) {
  const parts = [];
  for (const e of entries) {
    if (isRealUserPrompt(e)) parts.push(`User: ${textOf(e).trim()}`);
    else if (e.type === 'assistant') {
      const t = textOf(e).trim();
      if (t) parts.push(`Claude: ${t}`);
    }
  }
  const joined = parts.join('\n');
  return joined.length > maxChars ? joined.slice(-maxChars) : joined;
}
