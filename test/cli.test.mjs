import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpHome } from './helpers.mjs';
import { readJson, writeJson } from '../lib/jsonfile.mjs';
import { globalConfigPath, projectConfigPath } from '../lib/paths.mjs';
import { runCli } from '../lib/cli.mjs';

const AWTY = fileURLToPath(new URL('../bin/awty.mjs', import.meta.url));
let savedHome, cwd, outBuf, errBuf;
const io = () => ({ out: (s) => { outBuf += s; }, err: (s) => { errBuf += s; }, cwd, run: () => ({ status: 0, stdout: '' }) });

beforeEach(() => {
  tmpHome();
  savedHome = process.env.HOME;
  process.env.HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'awty-clihome-'));
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'awty-cliproj-'));
  outBuf = '';
  errBuf = '';
});
afterEach(() => { process.env.HOME = savedHome; });

test('help and unknown commands', async () => {
  assert.equal(await runCli(['help'], io()), 0);
  assert.match(outBuf, /awty install <claude\|codex\|agy>/);
  assert.equal(await runCli(['frobnicate'], io()), 2);
  assert.match(errBuf, /Unknown command "frobnicate"/);
});

test('install and uninstall codex', async () => {
  assert.equal(await runCli(['install', 'codex'], io()), 0);
  assert.match(outBuf, /Installed are-we-there-yet for codex/);
  assert.match(outBuf, /approve new hooks/);
  assert.ok(fs.existsSync(path.join(process.env.HOME, '.codex', 'hooks.json')));
  outBuf = '';
  assert.equal(await runCli(['uninstall', 'codex'], io()), 0);
  assert.match(outBuf, /Removed are-we-there-yet from codex/);
});

test('install errors are reported with exit code 1', async () => {
  assert.equal(await runCli(['install', 'vim'], io()), 1);
  assert.match(errBuf, /unknown tool "vim"/);
});

test('status prints settings and a hooks table', async () => {
  await runCli(['install', 'agy'], io());
  outBuf = '';
  assert.equal(await runCli(['status'], io()), 0);
  assert.match(outBuf, /Notifications: ON/);
  assert.match(outBuf, /agy\s+global\s+installed/);
  assert.match(outBuf, /codex\s+global\s+—/);
});

test('set writes global and project config and requires a scope', async () => {
  assert.equal(await runCli(['set', 'global', 'channel=telegram', 'min=300'], io()), 0);
  assert.deepEqual(readJson(globalConfigPath()).channels, ['telegram']);
  assert.equal(readJson(globalConfigPath()).filters.minDurationSec, 300);
  assert.equal(await runCli(['set', 'project', 'done=off'], io()), 0);
  assert.equal(readJson(projectConfigPath(cwd)).events.done, false);
  assert.equal(await runCli(['set', 'min=5'], io()), 2);
  assert.match(errBuf, /needs a scope/);
  assert.equal(await runCli(['set', 'global'], io()), 2);
  assert.equal(await runCli(['set', 'global', 'min=abc'], io()), 2);
});

test('set keeps values with spaces together', async () => {
  assert.equal(await runCli(['set', 'global', 'name=auth refactor'], io()), 0);
  assert.equal(readJson(globalConfigPath()).name, 'auth refactor');
});

test('awty test sends through the dispatcher (dry run)', () => {
  writeJson(globalConfigPath(), { channels: ['telegram'] });
  const res = spawnSync(AWTY, ['test'], { encoding: 'utf8', env: { ...process.env, AWTY_DRY_RUN: '1' } });
  assert.equal(res.status, 0);
  assert.match(res.stdout, /"title":"🔔 \[awty test\] Test notification"/);
  assert.match(res.stdout, /Sent: telegram/);
});

test('bin/awty.mjs with no args on a TTY-less stdin still behaves as the Claude hook', () => {
  const res = spawnSync(AWTY, [], { input: JSON.stringify({ session_id: 'z', cwd: '/x', hook_event_name: 'UserPromptSubmit', prompt: '/awty' }), encoding: 'utf8', env: { ...process.env } });
  assert.equal(JSON.parse(res.stdout).decision, 'block');
});
