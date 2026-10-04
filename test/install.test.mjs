import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { install, uninstall, installStatus, targetFile, RUN_PATH, InstallError } from '../lib/install.mjs';

let home, cwd, savedHome, savedCodexHome;
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

beforeEach(() => {
  savedHome = process.env.HOME;
  savedCodexHome = process.env.CODEX_HOME;
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'awty-home-'));
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'awty-proj-'));
  process.env.HOME = home;
  delete process.env.CODEX_HOME;
});
afterEach(() => {
  process.env.HOME = savedHome;
  if (savedCodexHome === undefined) delete process.env.CODEX_HOME; else process.env.CODEX_HOME = savedCodexHome;
});

test('target files', () => {
  assert.equal(targetFile('codex'), path.join(home, '.codex', 'hooks.json'));
  assert.equal(targetFile('codex', { project: true, cwd }), path.join(cwd, '.codex', 'hooks.json'));
  assert.equal(targetFile('agy'), path.join(home, '.gemini', 'config', 'hooks.json'));
  assert.equal(targetFile('agy', { project: true, cwd }), path.join(cwd, '.agents', 'hooks.json'));
  process.env.CODEX_HOME = '/custom/codex';
  assert.equal(targetFile('codex'), '/custom/codex/hooks.json');
  assert.throws(() => targetFile('vim'), InstallError);
});

test('codex install writes three events, is idempotent, and keeps foreign hooks', () => {
  const file = targetFile('codex');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'command', command: 'other.sh' }] }] } }));
  const r = install('codex');
  install('codex');
  const doc = read(file);
  assert.deepEqual(Object.keys(doc.hooks).sort(), ['PermissionRequest', 'Stop', 'UserPromptSubmit']);
  assert.equal(doc.hooks.Stop.length, 2);
  assert.equal(doc.hooks.Stop[0].hooks[0].command, 'other.sh');
  assert.equal(doc.hooks.Stop[1].hooks[0].command, `"${RUN_PATH}" --tool codex`);
  assert.equal(doc.hooks.UserPromptSubmit.length, 1);
  assert.ok(fs.existsSync(`${file}.awty-backup`));
  assert.ok(r.notes.some((n) => /approve/.test(n)));
});

test('codex uninstall removes only our groups', () => {
  const file = targetFile('codex');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'command', command: 'other.sh' }] }] } }));
  install('codex');
  assert.equal(uninstall('codex').removed, true);
  assert.deepEqual(read(file), { hooks: { Stop: [{ hooks: [{ type: 'command', command: 'other.sh' }] }] } });
  assert.equal(uninstall('codex').removed, false);
});

test('agy install owns a single named key with matcher and Stop handler', () => {
  const file = targetFile('agy');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ 'my-linter': { PostToolUse: [] } }));
  install('agy');
  install('agy');
  const doc = read(file);
  assert.deepEqual(Object.keys(doc).sort(), ['are-we-there-yet', 'my-linter']);
  const ours = doc['are-we-there-yet'];
  assert.equal(ours.PreToolUse[0].matcher, 'ask_question|ask_permission');
  assert.equal(ours.PreToolUse[0].hooks[0].command, `"${RUN_PATH}" --tool agy --event PreToolUse`);
  assert.equal(ours.Stop[0].command, `"${RUN_PATH}" --tool agy --event Stop`);
  assert.equal(uninstall('agy').removed, true);
  assert.deepEqual(read(file), { 'my-linter': { PostToolUse: [] } });
});

test('agy --project install warns about workspace hooks', () => {
  const r = install('agy', { project: true, cwd });
  assert.ok(fs.existsSync(path.join(cwd, '.agents', 'hooks.json')));
  assert.ok(r.notes.some((n) => /workspace hooks/.test(n)));
});

test('malformed config is refused and left untouched', () => {
  const file = targetFile('codex');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '{oops');
  assert.throws(() => install('codex'), /not valid JSON/);
  assert.equal(fs.readFileSync(file, 'utf8'), '{oops');
});

test('claude install runs the plugin commands and tolerates an existing marketplace', () => {
  const calls = [];
  const run = (cmd, args) => {
    calls.push([cmd, ...args].join(' '));
    return args[1] === 'marketplace' ? { status: 1, stderr: 'Marketplace already exists' } : { status: 0, stdout: '' };
  };
  install('claude', { run });
  assert.match(calls[0], /^claude plugin marketplace add /);
  assert.equal(calls[1], 'claude plugin install are-we-there-yet@are-we-there-yet-local');
});

test('claude install explains what to run when claude is missing', () => {
  const run = () => ({ error: Object.assign(new Error('nope'), { code: 'ENOENT' }) });
  assert.throws(() => install('claude', { run }), /claude not found/);
  assert.throws(() => install('claude', { project: true, run }), /per user/);
});

test('installStatus reports each tool and scope', () => {
  install('codex');
  const run = (cmd, args) => ({ status: 0, stdout: args[1] === 'list' ? 'are-we-there-yet@are-we-there-yet-local' : '' });
  const s = installStatus({ cwd, run });
  const get = (tool, scope) => s.find((x) => x.tool === tool && x.scope === scope).installed;
  assert.equal(get('claude', 'user'), true);
  assert.equal(get('codex', 'global'), true);
  assert.equal(get('codex', 'project'), false);
  assert.equal(get('agy', 'global'), false);
});
