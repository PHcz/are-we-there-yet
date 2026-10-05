import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { tmpHome } from './helpers.mjs';
import { writeJson } from '../lib/jsonfile.mjs';
import fs from 'node:fs';
import { globalConfigPath, sessionPath } from '../lib/paths.mjs';
import { loadState, saveState } from '../lib/state.mjs';
import { handle, stateKey } from '../lib/hook.mjs';
import { parseHookArgs, prepareHook } from '../lib/entry.mjs';

const NOW = 2_000_000_000_000;
const noIdle = () => null;
const ev = (over = {}) => ({ tool: 'codex', sessionId: 'abc', cwd: '/x/api', projectDir: '/x/api', ...over });

beforeEach(() => {
  tmpHome();
  delete process.env.AWTY_DISABLE;
  writeJson(globalConfigPath(), { channels: ['telegram'] });
});

test('stateKey keeps bare ids for claude and namespaces other tools', () => {
  assert.equal(stateKey({ tool: 'claude', sessionId: 's1' }), 's1');
  assert.equal(stateKey({ tool: 'codex', sessionId: 's1' }), 'codex:s1');
});

test('prompt events record turn start under the namespaced key', () => {
  assert.deepEqual(handle(ev({ type: 'prompt', prompt: 'fix login bug' }), { now: NOW }), {});
  assert.equal(loadState('codex:abc').turnStartedAt, NOW);
  assert.equal(loadState('codex:abc').firstPrompt, 'fix login bug');
});

test('done without transcript uses event text and title, with the tool label kept separate', () => {
  saveState('codex:abc', { turnStartedAt: NOW - 90_000 });
  const r = handle(ev({ type: 'done', text: 'All green', title: 'Fix login' }), { now: NOW, idle: noIdle, label: 'Codex' });
  assert.equal(r.job.kind, 'done');
  assert.equal(r.job.sessionName, 'Fix login');
  assert.equal(r.job.tool, 'Codex');
  assert.equal(r.job.summaryInput.text, 'All green');
  assert.equal(r.job.summaryInput.transcriptPath, undefined);
  assert.equal(r.job.durationSec, 90);
});

test('falls back to project · first prompt from the event when there is no title', () => {
  const r = handle(ev({ type: 'done', text: 'ok', firstPrompt: 'create a file hello4.txt containing hi please', turnStartedAt: NOW - 120_000 }), { now: NOW, idle: noIdle, label: 'Antigravity' });
  assert.equal(r.job.sessionName, 'api · create a file hello4.txt containing hi…');
  assert.equal(r.job.tool, 'Antigravity');
  assert.equal(r.job.durationSec, 120);
  assert.equal(loadState('codex:abc').firstPrompt, 'create a file hello4.txt containing hi please');
});

test('event turnStartedAt drives the min-duration filter', () => {
  assert.deepEqual(handle(ev({ type: 'done', text: 'ok', turnStartedAt: NOW - 5_000 }), { now: NOW, idle: noIdle }), {});
});

test('/awty override name is used as the session name without a label prefix', () => {
  saveState('codex:abc', { override: { name: 'auth' }, turnStartedAt: NOW - 90_000 });
  const r = handle(ev({ type: 'done', text: 'ok', title: 'ignored' }), { now: NOW, idle: noIdle, label: 'Codex' });
  assert.equal(r.job.sessionName, 'auth');
});

test('question and waiting events produce waiting jobs', () => {
  const q = handle(ev({ type: 'question', text: 'Which DB?' }), { now: NOW, idle: noIdle, label: 'Codex' });
  assert.equal(q.job.waitingReason, 'question');
  const w = handle(ev({ type: 'waiting', text: 'May I write?', sessionId: 'other' }), { now: NOW, idle: noIdle, label: 'Codex' });
  assert.equal(w.job.waitingReason, 'permission');
  assert.equal(w.job.summaryInput.text, 'May I write?');
});

test('/awty prompt returns a block result', () => {
  const r = handle(ev({ type: 'prompt', prompt: '/awty off' }), { now: NOW });
  assert.match(r.result.block.reason, /Notifications: OFF/);
  assert.equal(loadState('codex:abc').override.enabled, false);
});

test('parseHookArgs defaults to claude and reads --tool/--event', () => {
  assert.deepEqual(parseHookArgs([]), { tool: 'claude', event: undefined });
  assert.deepEqual(parseHookArgs(['--tool', 'agy', '--event', 'Stop']), { tool: 'agy', event: 'Stop' });
});

test('prepareHook ignores unknown tools and bad JSON without throwing', () => {
  assert.deepEqual(prepareHook({ tool: 'nope', stdin: '{}' }), {});
  assert.deepEqual(prepareHook({ tool: 'claude', stdin: 'not json' }), {});
});

test('prepareHook runs a claude /awty prompt to block JSON', () => {
  const r = prepareHook({ tool: 'claude', stdin: JSON.stringify({ session_id: 's9', cwd: '/x', hook_event_name: 'UserPromptSubmit', prompt: '/awty' }) });
  assert.equal(JSON.parse(r.out).decision, 'block');
});

test('codex /awty errors show the command word without a slash', () => {
  const stdin = JSON.stringify({ session_id: 'c1', cwd: '/x', hook_event_name: 'UserPromptSubmit', prompt: 'awty min=abc' });
  const codex = JSON.parse(prepareHook({ tool: 'codex', stdin }).out);
  assert.match(codex.reason, /Usage: awty \[global/);
  const claude = JSON.parse(prepareHook({ tool: 'claude', stdin: stdin.replace('awty min', '/awty min') }).out);
  assert.match(claude.reason, /Usage: \/awty \[global/);
});

test('test command tells Codex users to run awty (no slash) again', () => {
  const stdin = JSON.stringify({ session_id: 'c2', cwd: '/x', hook_event_name: 'UserPromptSubmit', prompt: 'awty test' });
  assert.match(JSON.parse(prepareHook({ tool: 'codex', stdin }).out).reason, /Run awty again in a few seconds/);
});

test('a new session on a tool without prompt events prunes old session files', () => {
  saveState('codex:old', { turnStartedAt: 1 });
  const p = sessionPath('codex:old');
  const longAgo = new Date(Date.now() - 30 * 86400_000);
  fs.utimesSync(p, longAgo, longAgo);
  handle(ev({ type: 'done', text: 'ok', sessionId: 'fresh', turnStartedAt: Date.now() - 600_000 }), { idle: noIdle });
  assert.equal(fs.existsSync(p), false);
});
