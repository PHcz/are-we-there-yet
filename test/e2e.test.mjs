import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
    env: { ...process.env, AWTY_SYNC: '1', AWTY_DRY_RUN: '1', ...extraEnv },
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
  assert.match(lines[0].title, /^✅ Done · 1m 3\ds · auth refactor$/);
  assert.match(lines[0].body, /^Shipped it\n\napi · \d\d:\d\d$/);
});

test('/awty prompt prints block JSON', () => {
  tmpHome();
  const res = runHook({ session_id: 'e2', cwd: '/x', hook_event_name: 'UserPromptSubmit', prompt: '/awty min=5' });
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

test('Codex Stop through run.sh --tool codex prints a labelled dry-run message', () => {
  tmpHome();
  writeJson(globalConfigPath(), { channels: ['telegram'] });
  const codexDir = fileURLToPath(new URL('./fixtures/codex/', import.meta.url));
  const raw = fs.readFileSync(`${codexDir}stop.json`, 'utf8');
  const res = spawnSync(RUN, ['--tool', 'codex'], {
    input: raw,
    encoding: 'utf8',
    env: { ...process.env, AWTY_SYNC: '1', AWTY_DRY_RUN: '1', CODEX_HOME: codexDir },
  });
  assert.equal(res.status, 0);
  const line = JSON.parse(res.stdout.trim().split('\n')[0]);
  assert.equal(line.title, '✅ Done · Create hello3.txt (Codex)');
  assert.match(line.body, /^Created hello3\.txt containing hi\./);
});

test('Antigravity Stop through run.sh --tool agy --event Stop prints a dry-run message and no decision', () => {
  tmpHome();
  writeJson(globalConfigPath(), { channels: ['telegram'] });
  const agyDir = fileURLToPath(new URL('./fixtures/agy/', import.meta.url));
  const raw = { ...JSON.parse(fs.readFileSync(`${agyDir}stop.json`, 'utf8')), transcriptPath: `${agyDir}transcript.jsonl` };
  const res = spawnSync(RUN, ['--tool', 'agy', '--event', 'Stop'], {
    input: JSON.stringify(raw),
    encoding: 'utf8',
    env: { ...process.env, AWTY_SYNC: '1', AWTY_DRY_RUN: '1' },
  });
  assert.equal(res.status, 0);
  const lines = res.stdout.trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(lines.length, 1);
  assert.match(lines[0].title, /^✅ Done · .+ · demo · create a file hello4\.txt containing hi \(Antigravity\)$/);
  assert.equal(lines[0].decision, undefined);
});

test('Antigravity ask_question through run.sh (detached send, no channels) prints nothing and exits 0', () => {
  tmpHome();
  writeJson(globalConfigPath(), { channels: [] });
  const agyDir = fileURLToPath(new URL('./fixtures/agy/', import.meta.url));
  const raw = { ...JSON.parse(fs.readFileSync(`${agyDir}pre-tool-use-ask-question.json`, 'utf8')), transcriptPath: `${agyDir}transcript.jsonl` };
  const env = { ...process.env };
  delete env.AWTY_SYNC;
  delete env.AWTY_DRY_RUN;
  const res = spawnSync(RUN, ['--tool', 'agy', '--event', 'PreToolUse'], { input: JSON.stringify(raw), encoding: 'utf8', env });
  assert.equal(res.status, 0);
  assert.equal(res.stdout, '');
});
