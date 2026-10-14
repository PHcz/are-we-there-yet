import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import { cleanText, truncate, summarize, cleanSummary } from '../lib/summary.mjs';
import { formatDuration, formatMessage } from '../lib/format.mjs';

test('cleanText strips markdown and code blocks', () => {
  const s = cleanText('## Done\n\n**Fixed** the `auth` bug.\n```js\nconst x=1\n```\nSee [docs](http://x).');
  assert.equal(s, 'Done Fixed the auth bug. [code] See docs.');
});

test('truncate on word boundary with ellipsis', () => {
  assert.equal(truncate('short', 10), 'short');
  assert.equal(truncate('one two three four five', 12), 'one two…');
});

test('summarize last-message mode cleans and truncates', async () => {
  const s = await summarize({ text: '**All** tests pass', mode: 'last-message', maxChars: 300 });
  assert.equal(s, 'All tests pass');
});

test('summarize llm mode uses runner and falls back on failure', async () => {
  const ok = await summarize({ text: 'raw', mode: 'llm', maxChars: 300 }, { runLlm: () => 'Short digest.' });
  assert.equal(ok, 'Short digest.');
  const fb = await summarize({ text: 'raw text', mode: 'llm', maxChars: 300 }, { runLlm: () => null });
  assert.equal(fb, 'raw text');
});

test('formatDuration', () => {
  assert.equal(formatDuration(42), '42s');
  assert.equal(formatDuration(252), '4m 12s');
  assert.equal(formatDuration(3720), '1h 02m');
});

test('formatMessage done returns structured fields and plain renderings', () => {
  const now = new Date(2026, 9, 4, 14, 32);
  const m = formatMessage({
    kind: 'done', sessionName: 'auth refactor', tool: 'Codex', durationSec: 252,
    summary: 'All good\n• tests pass', cwd: `${os.homedir()}/code/api`, now,
  });
  assert.deepEqual(
    { kind: m.kind, emoji: m.emoji, status: m.status, duration: m.duration, session: m.session, tool: m.tool, summary: m.summary, project: m.project, time: m.time },
    { kind: 'done', emoji: '✅', status: 'Done', duration: '4m 12s', session: 'auth refactor', tool: 'Codex', summary: 'All good\n• tests pass', project: 'api', time: '14:32' },
  );
  assert.equal(m.title, '✅ Done · 4m 12s · auth refactor (Codex)');
  assert.equal(m.body, 'All good\n• tests pass\n\napi · 14:32');
  assert.equal(m.text, `${m.title}\n${m.body}`);
});

test('formatMessage waiting and test variants', () => {
  const now = new Date(2026, 9, 4, 9, 5);
  assert.equal(formatMessage({ kind: 'waiting', waitingReason: 'question', sessionName: 's', summary: 'q?', cwd: '/x', now }).title, '❓ Waiting for you · s');
  const m = formatMessage({ kind: 'waiting', waitingReason: 'mod', sessionName: 's', summary: 'Blast Radius: Holding rm -rf build', cwd: '/x', now });
  assert.equal(m.title, '📣 Needs attention · s');
  assert.equal(m.status, 'Needs attention');
  const p = formatMessage({ kind: 'waiting', waitingReason: 'permission', sessionName: 's', summary: '', cwd: '/x', now });
  assert.equal(p.title, '⏳ Waiting for you · s');
  assert.equal(p.body, 'x · 09:05');
  assert.equal(p.duration, '');
  assert.equal(formatMessage({ kind: 'test', sessionName: 's', summary: 'hi', cwd: '/x', now }).title, '🔔 Test notification · s');
  assert.equal(formatMessage({ kind: 'done', sessionName: 's', durationSec: null, summary: 'x', cwd: '/x', now }).title, '✅ Done · s');
});

test('cleanSummary keeps paragraphs and bullets', () => {
  const s = cleanSummary('## Summary\n\n**Fixed** the `auth` bug.\n\n- added tests\n* updated README\n1. shipped', { maxChars: 300 });
  assert.equal(s, 'Summary\n\nFixed the auth bug.\n\n• added tests\n• updated README\n• shipped');
});

test('cleanSummary turns code fences into [code], unwraps links and quotes', () => {
  assert.equal(cleanSummary('Done.\n```js\nconst x=1\n```\nSee [docs](http://x).\n> quoted', { maxChars: 300 }), 'Done.\n[code]\nSee docs.\nquoted');
});

test('cleanSummary collapses blank lines and trims', () => {
  assert.equal(cleanSummary('\n\na  \n\n\n\n  b\n\n', { maxChars: 300 }), 'a\n\nb');
  assert.equal(cleanSummary('', { maxChars: 300 }), '');
  assert.equal(cleanSummary(null, { maxChars: 300 }), '');
});

test('cleanSummary caps lines with an ellipsis', () => {
  const ten = Array.from({ length: 10 }, (_, i) => `l${i + 1}`).join('\n');
  assert.equal(cleanSummary(ten, { maxChars: 300 }), 'l1\nl2\nl3\nl4\nl5\nl6\nl7\nl8…');
  assert.equal(cleanSummary(ten, { maxChars: 300, maxLines: 2 }), 'l1\nl2…');
});

test('cleanSummary keeps underscores in identifiers', () => {
  assert.equal(cleanSummary('Updated __init__.py and my_var', { maxChars: 300 }), 'Updated __init__.py and my_var');
});

test('cleanSummary caps characters at a word boundary', () => {
  assert.equal(cleanSummary('one two three four five', { maxChars: 12 }), 'one two…');
});

test('cleanSummary never exceeds maxChars when the line cap also fires', () => {
  const s = cleanSummary('aaaa\nbbbb\ncccc', { maxChars: 9, maxLines: 2 });
  assert.ok(s.length <= 9, `${JSON.stringify(s)} is ${s.length} chars`);
  assert.ok(s.endsWith('…'));
});

test('cleanSummary drops markdown table separator lines', () => {
  assert.equal(cleanSummary('| a | b |\n|---|:--:|\n| 1 | 2 |', { maxChars: 300 }), '| a | b |\n| 1 | 2 |');
});

test('formatMessage paused', () => {
  const m = formatMessage({ kind: 'paused', sessionName: 's', durationSec: 252, summary: 'Waiting on 1 background task:\n• npm test', cwd: '/x/api', now: new Date(2026, 9, 6, 9, 5) });
  assert.equal(m.title, '⏸ Paused · 4m 12s · s');
  assert.equal(m.emoji, '⏸');
  assert.equal(m.status, 'Paused');
});
