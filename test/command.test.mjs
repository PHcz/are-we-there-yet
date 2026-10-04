import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpHome } from './helpers.mjs';
import { readJson } from '../lib/jsonfile.mjs';
import { globalConfigPath, projectConfigPath } from '../lib/paths.mjs';
import { loadState, saveState } from '../lib/state.mjs';
import { parseNotifyCommand, applyCommand, describeConfig } from '../lib/command.mjs';
import { loadConfig } from '../lib/config.mjs';

test('non-notify prompts return null', () => {
  assert.equal(parseNotifyCommand('please fix the bug'), null);
  assert.equal(parseNotifyCommand('/notifyx'), null);
});

test('bare /notify is status', () => {
  assert.deepEqual(parseNotifyCommand('/notify'), { scope: 'session', action: 'status', patch: {}, errors: [] });
  assert.equal(parseNotifyCommand('/are-we-there-yet:notify  ').action, 'status');
});

test('parses on/off, events, channels, filters, summary, name', () => {
  const c = parseNotifyCommand('/notify off done=off waiting=on channel=pushover,macos min=300 away=120 debounce=60 always=on summary=llm max=200 name="auth refactor"');
  assert.deepEqual(c.errors, []);
  assert.equal(c.action, 'set');
  assert.deepEqual(c.patch, {
    enabled: false,
    events: { done: false, waiting: true },
    channels: ['pushover', 'macos'],
    filters: { minDurationSec: 300, onlyWhenAwaySec: 120, debounceSec: 60, always: true },
    summary: { mode: 'llm', maxChars: 200 },
    name: 'auth refactor',
  });
});

test('scope keywords and actions', () => {
  assert.equal(parseNotifyCommand('/notify global channel=telegram').scope, 'global');
  assert.equal(parseNotifyCommand('/notify project min=10').scope, 'project');
  assert.equal(parseNotifyCommand('/notify reset').action, 'reset');
  assert.equal(parseNotifyCommand('/notify test').action, 'test');
});

test('invalid values produce errors', () => {
  const c = parseNotifyCommand('/notify min=abc done=maybe summary=poem bogus=1 wat');
  assert.equal(c.errors.length, 5);
});

test('prototype keys are unknown settings, not crashes', () => {
  assert.equal(parseNotifyCommand('/notify constructor=1 __proto__=1 toString=x').errors.length, 3);
});

test('test/reset combined with settings is an error regardless of order', () => {
  assert.equal(parseNotifyCommand('/notify test min=5').errors.length, 1);
  assert.equal(parseNotifyCommand('/notify min=5 test').errors.length, 1);
  assert.equal(parseNotifyCommand('/notify reset on').errors.length, 1);
});

test('empty channel list is rejected', () => {
  assert.equal(parseNotifyCommand('/notify channel=,').errors.length, 1);
});

test('applyCommand writes session override', () => {
  tmpHome();
  const msg = applyCommand(parseNotifyCommand('/notify off'), { cwd: '/tmp', sessionId: 's1' });
  assert.deepEqual(loadState('s1').override, { enabled: false });
  assert.match(msg, /this session/);
});

test('applyCommand writes global and project files', () => {
  const home = tmpHome();
  const cwd = fs.mkdtempSync(path.join(home, 'p-'));
  applyCommand(parseNotifyCommand('/notify global channel=telegram'), { cwd, sessionId: 's' });
  applyCommand(parseNotifyCommand('/notify project min=5'), { cwd, sessionId: 's' });
  assert.deepEqual(readJson(globalConfigPath()).channels, ['telegram']);
  assert.equal(readJson(projectConfigPath(cwd)).filters.minDurationSec, 5);
});

test('reset clears only session override', () => {
  tmpHome();
  saveState('s1', { override: { enabled: false }, turnStartedAt: 1 });
  applyCommand(parseNotifyCommand('/notify reset'), { cwd: '/tmp', sessionId: 's1' });
  assert.deepEqual(loadState('s1'), { turnStartedAt: 1 });
  const msg = applyCommand(parseNotifyCommand('/notify global reset'), { cwd: '/tmp', sessionId: 's1' });
  assert.match(msg, /only applies to the session/);
});

test('errors are reported and nothing is written', () => {
  tmpHome();
  const msg = applyCommand(parseNotifyCommand('/notify min=abc'), { cwd: '/tmp', sessionId: 's1' });
  assert.match(msg, /min/);
  assert.equal(loadState('s1').override, undefined);
});

test('describeConfig lists channels but never secrets', () => {
  tmpHome();
  const cfg = { ...loadConfig({ cwd: '/tmp', sessionId: 'x' }), channels: ['telegram'], telegram: { botToken: 'SECRET' } };
  const text = describeConfig(cfg);
  assert.match(text, /telegram/);
  assert.doesNotMatch(text, /SECRET/);
});
