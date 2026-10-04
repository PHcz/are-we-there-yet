import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpHome } from './helpers.mjs';
import { writeJson } from '../lib/jsonfile.mjs';
import { globalConfigPath } from '../lib/paths.mjs';
import { saveState } from '../lib/state.mjs';

const RUN = fileURLToPath(new URL('../bin/run.sh', import.meta.url));
const FIX = fileURLToPath(new URL('./fixtures/transcript.jsonl', import.meta.url));

function runHook(input, extraEnv = {}) {
  return spawnSync(RUN, [], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_NOTIFY_SYNC: '1', CLAUDE_NOTIFY_DRY_RUN: '1', ...extraEnv },
  });
}

test('Stop hook end-to-end prints dry-run message', () => {
  tmpHome();
  writeJson(globalConfigPath(), { channels: ['telegram', 'ntfy'] });
  saveState('e1', { turnStartedAt: Date.now() - 90_000 });
  const res = runHook({ session_id: 'e1', cwd: '/x/api', transcript_path: FIX, hook_event_name: 'Stop', last_assistant_message: '**Shipped** it' });
  assert.equal(res.status, 0);
  const lines = res.stdout.trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(lines.map((l) => l.channel).sort(), ['ntfy', 'telegram']);
  assert.match(lines[0].title, /^✅ \[auth refactor\] Done · 1m3\ds$/);
  assert.match(lines[0].body, /^Shipped it\n📁 \/x\/api · \d\d:\d\d$/);
});

test('/notify prompt prints block JSON', () => {
  tmpHome();
  const res = runHook({ session_id: 'e2', cwd: '/x', hook_event_name: 'UserPromptSubmit', prompt: '/notify min=5' });
  assert.equal(res.status, 0);
  const out = JSON.parse(res.stdout);
  assert.equal(out.decision, 'block');
  assert.match(out.reason, /min=5s/);
});

test('garbage stdin still exits 0 and logs', () => {
  tmpHome();
  const res = spawnSync(RUN, [], { input: 'not json', encoding: 'utf8', env: { ...process.env } });
  assert.equal(res.status, 0);
  assert.equal(res.stdout, '');
});
