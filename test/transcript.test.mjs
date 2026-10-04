import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { tmpHome } from './helpers.mjs';
import {
  readTailLines, readHeadLines, lastAssistantText, customTitle, firstUserPrompt, conversationTail,
} from '../lib/transcript.mjs';
import { firstWords, resolveSessionName } from '../lib/session.mjs';

const FIX = fileURLToPath(new URL('./fixtures/transcript.jsonl', import.meta.url));

test('readers parse entries and skip bad lines', () => {
  assert.equal(readTailLines(FIX).length, 8);
  assert.equal(readHeadLines(FIX).length, 8);
  assert.deepEqual(readTailLines('/no/such/file'), []);
});

test('tail reader drops partial first line when truncated', () => {
  const entries = readTailLines(FIX, 200);
  assert.ok(entries.length >= 1);
  assert.ok(entries.every((e) => typeof e === 'object'));
});

test('extractors', () => {
  const e = readTailLines(FIX);
  assert.equal(lastAssistantText(e), 'Done. JWT rotation is in place and **all 42 tests** pass.');
  assert.equal(customTitle(e), 'auth refactor');
  assert.equal(firstUserPrompt(e), 'Refactor the auth middleware to use JWT rotation please');
  const tail = conversationTail(e, 4000);
  assert.match(tail, /^User: Refactor/m);
  assert.match(tail, /^Claude: Done\./m);
});

test('firstWords', () => {
  assert.equal(firstWords('one two three four five six seven', 6), 'one two three four five six…');
  assert.equal(firstWords('short one', 6), 'short one');
});

test('resolveSessionName precedence', () => {
  tmpHome();
  assert.equal(resolveSessionName({ cfg: { name: 'mine' }, cwd: '/x/api', transcriptPath: FIX, state: {} }), 'mine');
  assert.equal(resolveSessionName({ cfg: {}, cwd: '/x/api', transcriptPath: FIX, state: {} }), 'auth refactor');
  assert.equal(
    resolveSessionName({ cfg: {}, cwd: '/x/api', transcriptPath: '/none', state: { firstPrompt: 'fix login page bug on mobile safari now' } }),
    'api · fix login page bug on mobile…',
  );
  assert.equal(resolveSessionName({ cfg: {}, cwd: '/x/api', transcriptPath: '/none', state: {} }), 'api');
});
