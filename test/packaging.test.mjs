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

test('notify command exists', () => {
  assert.ok(fs.existsSync(new URL('../commands/notify.md', import.meta.url)));
});
