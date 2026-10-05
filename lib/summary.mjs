import { spawnSync } from 'node:child_process';
import { readTailLines, conversationTail } from './transcript.mjs';

export function cleanText(s) {
  return String(s ?? '')
    .replace(/```[\s\S]*?```/g, ' [code] ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*`>#]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncate(s, max) {
  if (s.length <= max) return s;
  let cut = s.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  if (space > max * 0.5) cut = cut.slice(0, space);
  return `${cut.replace(/[\s,.;:]+$/, '')}…`;
}

const BULLET = /^(?:[-*+]|\d+[.)])\s+/;

// Like cleanText, but keeps line structure so paragraphs and lists stay readable.
export function cleanSummary(text, { maxChars = 300, maxLines = 8 } = {}) {
  const src = String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/```[\s\S]*?```/g, '[code]')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  const lines = [];
  for (const raw of src.split('\n')) {
    const line = raw
      .trim()
      .replace(/^>\s?/, '')
      .replace(/^#{1,6}\s+/, '')
      .replace(BULLET, '• ')
      .replace(/\*\*|[*`]/g, '') // underscores kept: they appear in identifiers
      .replace(/[ \t]+/g, ' ')
      .trim();
    if (/^\|?[\s:|-]*-{3,}[\s:|-]*\|?$/.test(line)) continue; // table separator row
    if (line) lines.push(line);
    else if (lines.length && lines.at(-1) !== '') lines.push('');
  }
  while (lines.at(-1) === '') lines.pop();

  const kept = [];
  let count = 0;
  let cut = false;
  for (const line of lines) {
    if (line && count === maxLines) {
      cut = true;
      break;
    }
    kept.push(line);
    if (line) count++;
  }
  while (kept.at(-1) === '') kept.pop();

  const out = kept.join('\n');
  const finished = cut ? `${out.replace(/[\s,.;:]+$/, '')}…` : out;
  if (finished.length <= maxChars) return finished;
  return out.length > maxChars ? truncate(out, maxChars) : `${out.slice(0, maxChars - 1).replace(/[\s,.;:]+$/, '')}…`;
}

const PROMPT =
  'Summarize what the assistant just did or is asking, in one plain sentence under 200 characters. No preamble, no markdown.';

export function runClaudeHaiku(context) {
  const res = spawnSync('claude', ['-p', '--model', 'haiku', PROMPT], {
    input: context,
    encoding: 'utf8',
    timeout: 15000,
    env: { ...process.env, AWTY_DISABLE: '1' },
  });
  const out = res.status === 0 ? res.stdout.trim() : '';
  return out || null;
}

export async function summarize({ text, mode, maxChars, transcriptPath }, { runLlm = runClaudeHaiku } = {}) {
  if (mode === 'llm') {
    const context = transcriptPath ? conversationTail(readTailLines(transcriptPath), 4000) : '';
    const out = runLlm(context || String(text ?? ''));
    if (out) return cleanSummary(out, { maxChars });
  }
  return cleanSummary(text, { maxChars });
}
