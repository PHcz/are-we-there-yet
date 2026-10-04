import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import { cleanText, truncate, summarize } from '../lib/summary.mjs';
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
  assert.equal(formatDuration(252), '4m12s');
  assert.equal(formatDuration(3720), '1h02m');
});

test('formatMessage done', () => {
  const now = new Date(2026, 9, 4, 14, 32);
  const m = formatMessage({
    kind: 'done', sessionName: 'auth refactor', durationSec: 252, summary: 'All good',
    cwd: `${os.homedir()}/code/api`, now,
  });
  assert.equal(m.title, '✅ [auth refactor] Done · 4m12s');
  assert.equal(m.body, 'All good\n📁 ~/code/api · 14:32');
  assert.equal(m.text, `${m.title}\n${m.body}`);
  assert.equal(m.kind, 'done');
});

test('formatMessage waiting and test variants', () => {
  const now = new Date(2026, 9, 4, 9, 5);
  assert.equal(formatMessage({ kind: 'waiting', waitingReason: 'question', sessionName: 's', summary: 'q?', cwd: '/x', now }).title, '❓ [s] Waiting for you');
  assert.equal(formatMessage({ kind: 'waiting', waitingReason: 'permission', sessionName: 's', summary: '', cwd: '/x', now }).body, '📁 /x · 09:05');
  assert.equal(formatMessage({ kind: 'test', sessionName: 's', summary: 'hi', cwd: '/x', now }).title, '🔔 [s] Test notification');
  assert.equal(formatMessage({ kind: 'done', sessionName: 's', durationSec: null, summary: 'x', cwd: '/x', now }).title, '✅ [s] Done');
});
