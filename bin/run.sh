#!/bin/sh
# Locate node even when the hook environment has a minimal PATH (e.g. desktop app).
DIR="$(cd "$(dirname "$0")" && pwd)"
for n in "$(command -v node 2>/dev/null)" /opt/homebrew/bin/node /usr/local/bin/node "$HOME/.volta/bin/node"; do
  if [ -n "$n" ] && [ -x "$n" ]; then exec "$n" "$DIR/awty.mjs" hook "$@"; fi
done
cat >/dev/null
exit 0
