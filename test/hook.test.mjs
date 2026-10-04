import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { tmpHome } from './helpers.mjs';
import { writeJson } from '../lib/jsonfile.mjs';
import { globalConfigPath } from '../lib/paths.mjs';
import { loadState, saveState } from '../lib/state.mjs';
import { handle } from '../lib/hook.mjs';

const FIX = fileURLToPath(new URL('./fixtures/transcript.jsonl', import.meta.url));
const NOW = 2_000_000_000_000;
const base = { session_id: 's1', cwd: '/x/api', transcript_path: FIX };
const noIdle = () => null;

beforeEach(() => {
  tmpHome();
  delete process.env.CLAUDE_NOTIFY_DISABLE;
  writeJson(globalConfigPath(), { channels: ['telegram'] });
});

test('UserPromptSubmit records turn start and first prompt', () => {
  const r = handle({ ...base, hook_event_name: 'UserPromptSubmit', prompt: 'fix it' }, { now: NOW });
  assert.deepEqual(r, {});
  assert.equal(loadState('s1').turnStartedAt, NOW);
  assert.equal(loadState('s1').firstPrompt, 'fix it');
  handle({ ...base, hook_event_name: 'UserPromptSubmit', prompt_text: 'second' }, { now: NOW + 5 });
  assert.equal(loadState('s1').firstPrompt, 'fix it');
  assert.equal(loadState('s1').turnStartedAt, NOW + 5);
});

test('/notify is blocked with status reason and applies overrides', () => {
  const r = handle({ ...base, hook_event_name: 'UserPromptSubmit', prompt: '/notify off' }, { now: NOW });
  assert.equal(r.stdout.decision, 'block');
  assert.match(r.stdout.reason, /updated this session/);
  assert.match(r.stdout.reason, /Notifications: OFF/);
  assert.equal(loadState('s1').override.enabled, false);
  assert.equal(r.job, undefined);
});

test('/notify test returns a test job bypassing filters', () => {
  saveState('s1', { override: { enabled: false } });
  const r = handle({ ...base, hook_event_name: 'UserPromptSubmit', prompt: '/notify test' }, { now: NOW });
  assert.equal(r.stdout.decision, 'block');
  assert.match(r.stdout.reason, /Sending test to: telegram/);
  assert.equal(r.job.kind, 'test');
});

test('Stop sends done job with duration and last_assistant_message', () => {
  saveState('s1', { turnStartedAt: NOW - 125_000, firstPrompt: 'x' });
  const r = handle({ ...base, hook_event_name: 'Stop', last_assistant_message: 'All tests pass' }, { now: NOW, idle: noIdle });
  assert.equal(r.job.kind, 'done');
  assert.equal(r.job.durationSec, 125);
  assert.equal(r.job.sessionName, 'auth refactor');
  assert.equal(r.job.summaryInput.text, 'All tests pass');
  assert.equal(loadState('s1').lastSentAt, NOW);
});

test('Stop falls back to transcript text; skips short turns and stop_hook_active', () => {
  saveState('s1', { turnStartedAt: NOW - 125_000 });
  const r = handle({ ...base, hook_event_name: 'Stop' }, { now: NOW, idle: noIdle });
  assert.match(r.job.summaryInput.text, /JWT rotation/);
  saveState('s1', { turnStartedAt: NOW - 5_000 });
  assert.deepEqual(handle({ ...base, hook_event_name: 'Stop' }, { now: NOW, idle: noIdle }), {});
  saveState('s1', { turnStartedAt: NOW - 125_000 });
  assert.deepEqual(handle({ ...base, hook_event_name: 'Stop', stop_hook_active: true }, { now: NOW, idle: noIdle }), {});
});

test('PreToolUse AskUserQuestion sends waiting job with question and options', () => {
  const r = handle({
    ...base, hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion',
    tool_input: { questions: [{ question: 'Which DB?', header: 'DB', multiSelect: false, options: [{ label: 'Postgres', description: '' }, { label: 'SQLite', description: '' }] }] },
  }, { now: NOW, idle: noIdle });
  assert.equal(r.job.kind, 'waiting');
  assert.equal(r.job.waitingReason, 'question');
  assert.equal(r.job.summaryInput.text, 'Which DB? (Postgres / SQLite)');
  assert.equal(r.job.summaryInput.mode, 'last-message');
  assert.equal(loadState('s1').lastWaitingSentAt, NOW);
  assert.equal(r.stdout, undefined);
});

test('PreToolUse for other tools is ignored', () => {
  assert.deepEqual(handle({ ...base, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: {} }, { now: NOW }), {});
});

test('Notification permission prompt sends; deduped after a question; other types ignored', () => {
  const r = handle({ ...base, hook_event_name: 'Notification', notification_type: 'permission_prompt', message: 'Claude needs permission to use Bash' }, { now: NOW, idle: noIdle });
  assert.equal(r.job.waitingReason, 'permission');
  assert.equal(r.job.summaryInput.text, 'Claude needs permission to use Bash');
  assert.deepEqual(handle({ ...base, hook_event_name: 'Notification', notification_type: 'idle_prompt', message: 'x' }, { now: NOW + 1000, idle: noIdle }), {});
  assert.deepEqual(handle({ ...base, hook_event_name: 'Notification', notification_type: 'auth_success', message: 'x' }, { now: NOW + 999_999, idle: noIdle }), {});
});

test('CLAUDE_NOTIFY_DISABLE makes handler a no-op', () => {
  process.env.CLAUDE_NOTIFY_DISABLE = '1';
  saveState('s1', { turnStartedAt: NOW - 125_000 });
  assert.deepEqual(handle({ ...base, hook_event_name: 'Stop' }, { now: NOW }), {});
});
