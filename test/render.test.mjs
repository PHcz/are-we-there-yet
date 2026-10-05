import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderTelegramHtml, renderSlack, renderDiscord } from '../lib/render.mjs';

const msg = {
  kind: 'done', emoji: '✅', status: 'Done', duration: '4m 12s', session: 'auth refactor', tool: 'Codex',
  summary: 'JWT rotation is in place.\n• all 42 tests pass', project: 'api', time: '14:32',
  title: 'T', body: 'B', text: 'PLAIN',
};
const bare = { ...msg, kind: 'waiting', emoji: '⏳', status: 'Waiting for you', duration: '', session: 's', tool: '', summary: '', project: 'x', time: '09:05' };

test('telegram card', () => {
  assert.equal(renderTelegramHtml(msg),
    '✅ <b>Done</b> · 4m 12s\n<b>auth refactor</b> · Codex\n\n<blockquote>JWT rotation is in place.\n• all 42 tests pass</blockquote>\n\n<i>api · 14:32</i>');
  assert.equal(renderTelegramHtml(bare), '⏳ <b>Waiting for you</b>\n<b>s</b>\n\n<i>x · 09:05</i>');
});

test('telegram escapes HTML in every field', () => {
  const out = renderTelegramHtml({ ...msg, session: 'a<b>&', summary: 'if x < 3 && y > 2' });
  assert.match(out, /<b>a&lt;b&gt;&amp;<\/b>/);
  assert.match(out, /<blockquote>if x &lt; 3 &amp;&amp; y &gt; 2<\/blockquote>/);
});

test('slack card', () => {
  assert.equal(renderSlack(msg),
    '✅ *Done* · 4m 12s\n*auth refactor* · Codex\n\n> JWT rotation is in place.\n> • all 42 tests pass\n\n_api · 14:32_');
  assert.equal(renderSlack(bare), '⏳ *Waiting for you*\n*s*\n\n_x · 09:05_');
  assert.match(renderSlack({ ...msg, summary: 'a < b & c' }), /> a &lt; b &amp; c/);
});

test('discord card and markdown escaping', () => {
  assert.equal(renderDiscord(msg),
    '✅ **Done** · 4m 12s\n**auth refactor** · Codex\n\n> JWT rotation is in place.\n> • all 42 tests pass\n\n*api · 14:32*');
  assert.match(renderDiscord({ ...msg, session: 'my_var *x*' }), /\*\*my\\_var \\\*x\\\*\*\*/);
});
