import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function tmpHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'awty-'));
  process.env.AWTY_HOME = dir;
  return dir;
}
