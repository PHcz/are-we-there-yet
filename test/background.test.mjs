import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readTailLines } from '../lib/transcript.mjs';
import { pendingBackgroundTasks } from '../lib/background.mjs';
import * as claude from '../adapters/claude.mjs';

const FIX = fileURLToPath(new URL('./fixtures/background-transcript.jsonl', import.meta.url));

test('pending = launched background tool calls without a task-notification', () => {
  assert.deepEqual(pendingBackgroundTasks(readTailLines(FIX)), ['npm test -- --reporter=dot']);
});

test('labels prefer description, collapse whitespace and cut to 60 chars', () => {
  const long = 'x'.repeat(80);
  const entries = [{ type: 'assistant', message: { content: [
    { type: 'tool_use', id: 't1', name: 'Agent', input: { description: 'Review   the\nbranch', command: 'ignored', run_in_background: true } },
    { type: 'tool_use', id: 't2', name: 'Bash', input: { command: long, run_in_background: true } },
    { type: 'tool_use', id: 't3', name: 'Monitor', input: { run_in_background: true } },
  ] } }];
  assert.deepEqual(pendingBackgroundTasks(entries), ['Review the branch', `${'x'.repeat(59)}…`, 'Monitor']);
});

test('no entries, odd shapes and foreground calls yield nothing', () => {
  assert.deepEqual(pendingBackgroundTasks([]), []);
  assert.deepEqual(pendingBackgroundTasks([{}, { message: { content: 'text' } }, null]), []);
});

test('Claude Stop event carries pending background labels', () => {
  const e = claude.normalize({ session_id: 's', cwd: '/x/api', hook_event_name: 'Stop', transcript_path: FIX, last_assistant_message: 'still running' });
  assert.equal(e.type, 'done');
  assert.deepEqual(e.background, ['npm test -- --reporter=dot']);
});

test('Claude Stop without a readable transcript has no background tasks', () => {
  const e = claude.normalize({ session_id: 's', cwd: '/x', hook_event_name: 'Stop', transcript_path: '/nonexistent.jsonl' });
  assert.deepEqual(e.background, []);
});
