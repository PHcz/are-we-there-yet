#!/usr/bin/env node
import fs from 'node:fs';
import { runJob } from '../lib/job.mjs';
import { logError } from '../lib/errorlog.mjs';

const file = process.argv[2];
try {
  const job = JSON.parse(fs.readFileSync(file, 'utf8'));
  fs.unlinkSync(file);
  await runJob(job);
} catch (err) {
  logError(`send: ${err?.stack ?? err}`);
  try { fs.unlinkSync(file); } catch {}
}
