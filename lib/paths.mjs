import os from 'node:os';
import path from 'node:path';

export function baseDir() {
  return process.env.AWTY_HOME || path.join(os.homedir(), '.config', 'are-we-there-yet');
}
export const globalConfigPath = () => path.join(baseDir(), 'config.json');
export const sessionsDir = () => path.join(baseDir(), 'sessions');
export const sessionPath = (id) =>
  path.join(sessionsDir(), `${String(id).replace(/[^A-Za-z0-9_-]/g, '_')}.json`);
export const errorLogPath = () => path.join(baseDir(), 'error.log');
export const jobsDir = () => path.join(baseDir(), 'jobs');
export const projectConfigPath = (cwd) => path.join(cwd, '.claude', 'awty.json');
