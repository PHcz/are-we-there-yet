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

const seed = (tool, obj, opts) => {
  const file = targetFile(tool, opts);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof obj === 'string' ? obj : JSON.stringify(obj));
  return file;
};

test('non-object "hooks" is refused and the file is untouched', () => {
  const file = seed('codex', '{"hooks":[1,2]}');
  assert.throws(() => install('codex'), /"hooks" is not an object/);
  assert.throws(() => uninstall('codex'), /"hooks" is not an object/);
  assert.equal(fs.readFileSync(file, 'utf8'), '{"hooks":[1,2]}');
  assert.ok(!fs.existsSync(`${file}.awty-backup`));
});

test('non-array event is refused on install and uninstall', () => {
  const text = '{"hooks":{"Stop":{"a":1}}}';
  const file = seed('codex', text);
  assert.throws(() => install('codex'), /"hooks.Stop" is not an array/);
  assert.throws(() => uninstall('codex'), /not an array/);
  assert.equal(fs.readFileSync(file, 'utf8'), text);
});

test('a group that mixes a foreign hook with ours keeps the foreign hook', () => {
  const file = seed('codex', { hooks: { Stop: [{ matcher: 'x', hooks: [{ type: 'command', command: 'other.sh' }, { type: 'command', command: `"${RUN_PATH}" --tool codex` }] }] } });
  install('codex');
  let doc = read(file);
  assert.deepEqual(doc.hooks.Stop[0], { matcher: 'x', hooks: [{ type: 'command', command: 'other.sh' }] });
  assert.equal(doc.hooks.Stop.length, 2);
  assert.equal(uninstall('codex').removed, true);
  doc = read(file);
  assert.deepEqual(doc.hooks, { Stop: [{ matcher: 'x', hooks: [{ type: 'command', command: 'other.sh' }] }] });
});

test('uninstall keeps a user\'s pre-existing empty event array', () => {
  const file = seed('codex', { hooks: { PostToolUse: [] } });
  install('codex');
  assert.equal(uninstall('codex').removed, true);
  assert.deepEqual(read(file), { hooks: { PostToolUse: [] } });
});

test('backup equals the original bytes and is not overwritten by a later change', () => {
  const original = '{ "hooks": {}, "keep":   1 }\n';
  const file = seed('codex', original);
  install('codex');
  assert.equal(fs.readFileSync(`${file}.awty-backup`, 'utf8'), original);
  uninstall('codex');
  install('codex');
  assert.equal(fs.readFileSync(`${file}.awty-backup`, 'utf8'), original);
});

test('uninstall refuses a malformed file and leaves it alone', () => {
  const file = seed('agy', '{oops');
  assert.throws(() => uninstall('agy'), /not valid JSON/);
  assert.equal(fs.readFileSync(file, 'utf8'), '{oops');
});

test('uninstall with nothing to remove leaves the file bytes unchanged', () => {
  const text = '{"hooks":{"Stop":[{"hooks":[{"command":"other.sh"}]}]},   "x":1}';
  const file = seed('codex', text);
  assert.equal(uninstall('codex').removed, false);
  assert.equal(fs.readFileSync(file, 'utf8'), text);
  const agyText = '{"my-linter":{}}';
  const agyFile = seed('agy', agyText);
  assert.equal(uninstall('agy').removed, false);
  assert.equal(fs.readFileSync(agyFile, 'utf8'), agyText);
});

test('codex --project installs and uninstalls in <cwd>/.codex/hooks.json', () => {
  install('codex', { project: true, cwd });
  const file = path.join(cwd, '.codex', 'hooks.json');
  assert.equal(read(file).hooks.Stop.length, 1);
  assert.ok(!fs.existsSync(targetFile('codex')));
  assert.equal(uninstall('codex', { project: true, cwd }).removed, true);
  assert.deepEqual(read(file), { hooks: {} });
});

test('a symlinked config file stays a symlink and its target is updated', () => {
  const target = path.join(cwd, 'dotfiles-hooks.json');
  fs.writeFileSync(target, '{"hooks":{}}');
  const file = targetFile('codex');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.symlinkSync(target, file);
  install('codex');
  assert.ok(fs.lstatSync(file).isSymbolicLink());
  assert.equal(read(target).hooks.Stop.length, 1);
  assert.equal(fs.readdirSync(path.dirname(target)).filter((f) => f.includes('awty-tmp')).length, 0);
});

test('claude install on an already-installed plugin also updates it', () => {
  const calls = [];
  const run = (cmd, args) => {
    calls.push(args.join(' '));
    return { status: 0, stdout: args[1] === 'install' ? 'Plugin is already installed' : '' };
  };
  const r = install('claude', { run });
  assert.deepEqual(calls.slice(2), [
    'plugin marketplace update are-we-there-yet-local',
    'plugin update are-we-there-yet@are-we-there-yet-local',
  ]);
  assert.ok(r.notes.includes('Updated the Claude Code plugin to this version.'));
  const failing = (cmd, args) => (args[1] === 'update' ? { status: 1, stderr: 'boom' } : { status: 0, stdout: 'is already installed' });
  assert.throws(() => install('claude', { run: failing }), /boom/);
});

test('claude uninstall reports ENOENT and failures, and succeeds otherwise', () => {
  const missing = () => ({ error: Object.assign(new Error('x'), { code: 'ENOENT' }) });
  assert.throws(() => uninstall('claude', { run: missing }), /claude not found on PATH\. Run yourself:\n  claude plugin uninstall are-we-there-yet@are-we-there-yet-local/);
  assert.throws(() => uninstall('claude', { run: () => ({ status: 1, stderr: ' not installed ' }) }), /uninstall failed: not installed/);
  assert.deepEqual(uninstall('claude', { run: () => ({ status: 0 }) }), { removed: true });
});

test('missing tool name is a clear error', () => {
  assert.throws(() => install(undefined), /which tool\? use: awty install <claude\|codex\|agy>/);
  assert.throws(() => uninstall(undefined), /which tool\?/);
});

test('installStatus flags stale paths for codex and agy', () => {
  const stale = (c) => c.replace(RUN_PATH, '/gone/bin/run.sh');
  const codexFile = seed('codex', { hooks: { Stop: [{ hooks: [{ type: 'command', command: stale(`"${RUN_PATH}" --tool codex`) }] }] } });
  install('agy');
  const agyFile = targetFile('agy');
  fs.writeFileSync(agyFile, fs.readFileSync(agyFile, 'utf8').split(RUN_PATH).join('/gone/bin/run.sh'));
  const run = () => ({ status: 0, stdout: '' });
  const get = (s, tool, scope) => s.find((x) => x.tool === tool && x.scope === scope).installed;
  let s = installStatus({ cwd, run });
  assert.equal(get(s, 'codex', 'global'), 'stale');
  assert.equal(get(s, 'agy', 'global'), 'stale');
  install('codex');
  install('agy');
  s = installStatus({ cwd, run });
  assert.equal(get(s, 'codex', 'global'), true);
  assert.equal(get(s, 'agy', 'global'), true);
  assert.ok(codexFile);
});

test('claude uninstall also removes the local marketplace, ignoring its failure', () => {
  const calls = [];
  const run = (cmd, args) => { calls.push(args.join(' ')); return { status: args[1] === 'marketplace' ? 1 : 0, stdout: '' }; };
  assert.equal(uninstall('claude', { run }).removed, true);
  assert.deepEqual(calls, ['plugin uninstall are-we-there-yet@are-we-there-yet-local', 'plugin marketplace remove are-we-there-yet-local']);
});
