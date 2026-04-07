#!/usr/bin/env bash
# Ensures child processes (PostCSS, Turbopack subprocesses, etc.) pick up the
# nvm-installed Node 22 instead of the ancient Homebrew system Node on $PATH.
set -e
export PATH="/Users/julianperez/.nvm/versions/node/v22.22.2/bin:$PATH"
cd "$(dirname "$0")/.."
exec node ./node_modules/next/dist/bin/next dev "$@"
