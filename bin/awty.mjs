#!/usr/bin/env node
import { handle } from '../lib/hook.mjs';
import { launchJob } from '../lib/job.mjs';
import { logError } from '../lib/errorlog.mjs';

async function readStdin() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

async function main() {
  const input = JSON.parse((await readStdin()) || '{}');
  const { stdout, job } = handle(input);
  if (stdout) process.stdout.write(JSON.stringify(stdout));
  if (job) await launchJob(job);
}

main()
  .catch((err) => logError(`hook: ${err?.stack ?? err}`))
  .finally(() => { process.exitCode = 0; });
