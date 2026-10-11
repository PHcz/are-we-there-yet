import { execFileSync } from 'node:child_process';

export const WAITING_DEDUPE_MS = 120000;

export function shouldNotify({ kind, source, cfg, state, now, idleSec }) {
  if (!cfg.enabled) return { ok: false, reason: 'notifications off' };
  if (!cfg.events?.[kind]) return { ok: false, reason: `${kind} messages off` };
  const f = cfg.filters ?? {};
  const doneLike = kind === 'done' || kind === 'paused';
  const bypass = doneLike && f.always;

  if (kind === 'waiting' && source === 'notification' && state.lastQuestionSentAt &&
      now - state.lastQuestionSentAt < WAITING_DEDUPE_MS) {
    return { ok: false, reason: 'duplicate of a question alert' };
  }
  if (doneLike && !bypass) {
    // If we already pinged that this turn was waiting for the user, they likely stepped away: always report Done.
    const pingedThisTurn = state.lastWaitingSentAt && state.turnStartedAt && state.lastWaitingSentAt >= state.turnStartedAt;
    if (!pingedThisTurn && f.minDurationSec > 0 && state.turnStartedAt && (now - state.turnStartedAt) / 1000 < f.minDurationSec) {
      return { ok: false, reason: `too short (${Math.floor((now - state.turnStartedAt) / 1000)}s < ${f.minDurationSec}s)` };
    }
    if (kind === 'done' && f.debounceSec > 0 && state.lastDoneSentAt && now - state.lastDoneSentAt < f.debounceSec * 1000) {
      return { ok: false, reason: `debounced (last Done ${Math.floor((now - state.lastDoneSentAt) / 1000)}s ago, limit ${f.debounceSec}s)` };
    }
  }
  if (!bypass && f.onlyWhenAwaySec > 0 && idleSec != null && idleSec < f.onlyWhenAwaySec) {
    return { ok: false, reason: `you were active (idle ${Math.floor(idleSec)}s < ${f.onlyWhenAwaySec}s)` };
  }
  return { ok: true };
}

const ioregRunner = () =>
  execFileSync('/usr/sbin/ioreg', ['-c', 'IOHIDSystem', '-d', '4'], { encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] });

export function getIdleSeconds({ platform = process.platform, run = ioregRunner } = {}) {
  if (platform !== 'darwin') return null;
  try {
    const m = /"HIDIdleTime"\s*=\s*(\d+)/.exec(run());
    return m ? Math.floor(Number(m[1]) / 1e9) : null;
  } catch {
    return null;
  }
}
