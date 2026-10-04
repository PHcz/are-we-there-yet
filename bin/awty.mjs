#!/usr/bin/env node
import { parseHookArgs, prepareHook } from '../lib/entry.mjs';
import { launchJob } from '../lib/job.mjs';
import { logError } from '../lib/errorlog.mjs';

async function readStdin() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

async function hookMain(args) {
  const { out, job } = prepareHook({ ...parseHookArgs(args), stdin: await readStdin() });
  if (out) process.stdout.write(out);
  if (job) await launchJob(job);
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'hook' || (cmd === undefined && !process.stdin.isTTY)) {
  hookMain(cmd === 'hook' ? rest : [])
    .catch((err) => logError(`hook: ${err?.stack ?? err}`))
    .finally(() => { process.exitCode = 0; });
} else {
  process.stderr.write('usage: awty hook [--tool claude|codex|agy] [--event <name>]\n');
  process.exitCode = 2;
}
