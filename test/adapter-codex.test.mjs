import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpHome } from './helpers.mjs';
import { writeJson } from '../lib/jsonfile.mjs';
import { globalConfigPath } from '../lib/paths.mjs';
import { handle } from '../lib/hook.mjs';
import * as codex from '../adapters/codex.mjs';

const dir = fileURLToPath(new URL('./fixtures/codex/', import.meta.url));
const fx = (n) => JSON.parse(fs.readFileSync(`${dir}${n}.json`, 'utf8'));
const NOW = 2_000_000_000_000;

beforeEach(() => {
  tmpHome();
  process.env.CODEX_HOME = dir;
  writeJson(globalConfigPath(), { channels: ['telegram'] });
});

test('UserPromptSubmit becomes a prompt event', () => {
  const e = codex.normalize(fx('user-prompt-submit'));
  assert.equal(e.type, 'prompt');
  assert.equal(e.tool, 'codex');
  assert.equal(e.prompt, 'create a file hello2.txt containing hi');
  assert.equal(e.cwd, '/Users/jane/code/demo');
});

test('"awty status" without slash is rewritten and blocked', () => {
  const e = codex.normalize(fx('user-prompt-submit-awty'));
  assert.equal(e.prompt, '/awty status');
  const out = codex.respond(handle(e, { now: NOW }).result);
  assert.equal(JSON.parse(out).decision, 'block');
});

test('PermissionRequest becomes waiting with the description and thread title', () => {
  const e = codex.normalize(fx('permission-request'));
  assert.equal(e.type, 'waiting');
  assert.equal(e.text, 'May I write hello3.txt in the workspace with the requested contents?');
  assert.equal(e.title, 'Create hello3.txt');
});

test('Stop becomes done; stop_hook_active is ignored', () => {
  const e = codex.normalize(fx('stop'));
  assert.equal(e.type, 'done');
  assert.match(e.text, /^Created \[hello3\.txt\]/);
  assert.equal(codex.normalize({ ...fx('stop'), stop_hook_active: true }), null);
});

test('other events and payloads without session id are ignored', () => {
  assert.equal(codex.normalize({ ...fx('stop'), hook_event_name: 'PreToolUse' }), null);
  assert.equal(codex.normalize({}), null);
});

test('threadTitle takes the last matching index entry and tolerates a missing index', () => {
  assert.equal(codex.threadTitle('01a1078b-8029-72f1-bb43-cefa7013dda8'), 'Create hello3.txt');
  process.env.CODEX_HOME = '/nonexistent';
  assert.equal(codex.threadTitle('x'), undefined);
});

test('done job is named "Codex · <thread title>"', () => {
  const r = handle(codex.normalize(fx('stop')), { now: NOW, idle: () => null, label: codex.label });
  assert.equal(r.job.sessionName, 'Codex · Create hello3.txt');
});

test('respond prints nothing when there is no block', () => {
  assert.equal(codex.respond(undefined), '');
});
