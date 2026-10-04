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
    if (out) return truncate(cleanText(out), maxChars);
  }
  return truncate(cleanText(text), maxChars);
}
