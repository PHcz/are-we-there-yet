#!/bin/sh
# Locate node even when the hook environment has a minimal PATH (e.g. desktop app).
DIR="$(cd "$(dirname "$0")" && pwd)"
PATH="$PATH:/usr/bin:/bin"  # basic tools (date, mkdir, ls) even on a stripped PATH

if [ -n "$AWTY_NODE_CANDIDATES" ]; then
  # Test hook: colon-separated list replacing the built-in search.
  CANDIDATES="$AWTY_NODE_CANDIDATES"
else
  NVM_NODE="$(ls -d "$HOME"/.nvm/versions/node/*/bin/node 2>/dev/null | sort -V | tail -n 1)"
  CANDIDATES="$(command -v node 2>/dev/null):/opt/homebrew/bin/node:/usr/local/bin/node:/usr/bin/node:$HOME/.volta/bin/node:$HOME/.asdf/shims/node:$HOME/.local/share/fnm/aliases/default/bin/node:$NVM_NODE"
fi

OLDIFS="$IFS"
IFS=:
for n in $CANDIDATES; do
  if [ -n "$n" ] && [ -x "$n" ]; then IFS="$OLDIFS"; exec "$n" "$DIR/awty.mjs" hook "$@"; fi
done
IFS="$OLDIFS"

cat >/dev/null
{
  LOGDIR="${AWTY_HOME:-$HOME/.config/are-we-there-yet}"
  mkdir -p "$LOGDIR" &&
    printf '%s hook: node not found (looked on PATH and in common locations)\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$LOGDIR/error.log"
} 2>/dev/null
exit 0
