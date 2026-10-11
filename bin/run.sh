#!/bin/sh
# Locate node even when the hook environment has a minimal PATH (e.g. desktop app).
# This script never writes to stdout or stderr itself.

# Remember the node the caller's own PATH resolves to, before we touch PATH.
NODE_ON_PATH="$(command -v node 2>/dev/null)"
# Basic tools (dirname, date, mkdir, wc) even on a stripped or empty PATH, never adding an empty element
# (an empty PATH element would mean "the current directory").
PATH="${PATH:+$PATH:}/usr/bin:/bin"
DIR="$(cd "$(dirname "$0")" && pwd)"

# Only absolute paths are ever executed, so the current directory is never searched.
if [ -n "$AWTY_NODE_CANDIDATES" ]; then
  # Test hook: colon-separated list replacing the built-in search (split on ':' only, no globbing).
  OLDIFS="$IFS"; IFS=:; set -f
  for n in $AWTY_NODE_CANDIDATES; do
    case "$n" in /*) [ -x "$n" ] && exec "$n" "$DIR/awty.mjs" hook "$@" ;; esac
  done
  IFS="$OLDIFS"; set +f
else
  for n in "$NODE_ON_PATH" /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node \
    "$HOME/.volta/bin/node" "$HOME/.asdf/shims/node" "$HOME/.local/share/fnm/aliases/default/bin/node"; do
    case "$n" in /*) [ -x "$n" ] && exec "$n" "$DIR/awty.mjs" hook "$@" ;; esac
  done
  # nvm last, computed lazily: the highest major version installed (`sort -V` is not POSIX).
  NVM_NODE=""; NVM_BEST=-1
  for n in "$HOME"/.nvm/versions/node/v*/bin/node; do
    [ -x "$n" ] || continue
    v="${n%/bin/node}"; v="${v##*/v}"; major="${v%%.*}"
    case "$major" in ''|*[!0-9]*) continue ;; esac
    if [ "$major" -ge "$NVM_BEST" ]; then NVM_BEST="$major"; NVM_NODE="$n"; fi
  done
  [ -n "$NVM_NODE" ] && exec "$NVM_NODE" "$DIR/awty.mjs" hook "$@"
fi

cat >/dev/null 2>&1
{
  LOGDIR="${AWTY_HOME:-$HOME/.config/are-we-there-yet}"
  LOG="$LOGDIR/error.log"
  # Append only while the log is small (< 64 KB), and create it private (0600).
  (
    umask 077
    mkdir -p "$LOGDIR" || exit 0
    SIZE="$(wc -c < "$LOG" 2>/dev/null || echo 0)"
    SIZE=$((SIZE + 0))
    [ "$SIZE" -lt 65536 ] &&
      printf '%s hook: node not found (looked on PATH and in common locations)\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$LOG"
  )
} 2>/dev/null
exit 0
