import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { jobsDir } from './paths.mjs';
import { summarize } from './summary.mjs';
import { formatMessage } from './format.mjs';
import { dispatch } from './dispatch.mjs';
import { logError } from './errorlog.mjs';

const SEND_SCRIPT = fileURLToPath(new URL('../bin/send.mjs', import.meta.url));

export async function runJob(job) {
  const summary = await summarize(job.summaryInput);
  const msg = formatMessage({
    kind: job.kind,
    waitingReason: job.waitingReason,
    sessionName: job.sessionName,
    durationSec: job.durationSec,
    summary,
    cwd: job.cwd,
    now: new Date(),
  });
  return dispatch(msg, job.cfg);
}

export async function launchJob(job) {
  if (process.env.CLAUDE_NOTIFY_SYNC === '1') {
    await runJob(job);
    return;
  }
  fs.mkdirSync(jobsDir(), { recursive: true });
  const file = path.join(jobsDir(), `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.json`);
  fs.writeFileSync(file, JSON.stringify(job), { mode: 0o600 });
  const child = spawn(process.execPath, [SEND_SCRIPT, file], { detached: true, stdio: 'ignore', env: process.env });
  child.on('error', (err) => {
    logError(`spawn: ${err.message}`);
    try { fs.unlinkSync(file); } catch {}
  });
  child.unref();
}
