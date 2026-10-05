import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => JSON.parse(fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));

test('plugin manifest', () => {
  const m = read('.claude-plugin/plugin.json');
  assert.equal(m.name, 'are-we-there-yet');
  assert.match(m.version, /^\d+\.\d+\.\d+$/);
});

test('marketplace lists the plugin at repo root', () => {
  const m = read('.claude-plugin/marketplace.json');
  assert.equal(m.plugins[0].name, 'are-we-there-yet');
  assert.equal(m.plugins[0].source, './');
});

test('hooks.json registers four events through run.sh', () => {
  const h = read('hooks/hooks.json').hooks;
  assert.deepEqual(Object.keys(h).sort(), ['Notification', 'PreToolUse', 'Stop', 'UserPromptSubmit']);
  assert.equal(h.PreToolUse[0].matcher, 'AskUserQuestion');
  for (const groups of Object.values(h)) {
    const cmd = groups[0].hooks[0];
    assert.equal(cmd.type, 'command');
    assert.equal(cmd.command, '"${CLAUDE_PLUGIN_ROOT}/bin/run.sh"');
    assert.equal(cmd.timeout, 10);
  }
});

test('awty command exists', () => {
  assert.ok(fs.existsSync(new URL('../commands/awty.md', import.meta.url)));
});

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('package.json declares the awty bin and publishable files', () => {
  const p = read('package.json');
  assert.equal(p.name, '@phcz/are-we-there-yet');
  assert.equal(p.private, true, 'kept private until we decide to publish');
  assert.equal(p.publishConfig, undefined);
  assert.equal(p.bin.awty, 'bin/awty.mjs');
  for (const f of ['bin', 'lib', 'channels', 'adapters', 'hooks', 'commands', '.claude-plugin']) assert.ok(p.files.includes(f), f);
  assert.equal(read('.claude-plugin/plugin.json').version, p.version);
});

test('npm pack ships runtime files and no tests', () => {
  const res = spawnSync('npm', ['pack', '--dry-run', '--json'], { encoding: 'utf8', cwd: fileURLToPath(new URL('..', import.meta.url)) });
  const files = JSON.parse(res.stdout)[0].files.map((f) => f.path);
  for (const f of ['bin/run.sh', 'bin/awty.mjs', 'adapters/agy.mjs', 'lib/install.mjs', 'hooks/hooks.json', 'docs/tools.md', 'LICENSE']) assert.ok(files.includes(f), f);
  assert.ok(!files.some((f) => f.startsWith('test/')));

});

test('bin scripts are executable', () => {
  for (const f of ['bin/run.sh', 'bin/awty.mjs', 'bin/send.mjs']) {
    fs.accessSync(new URL(`../${f}`, import.meta.url), fs.constants.X_OK);
  }
});
