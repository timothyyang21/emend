#!/usr/bin/env bash
# Wipe the local document store so the next GET re-seeds James's passage.
#
# Removes the FILE, not the directory: dev-api resolves and creates its store
# directory once at startup, so deleting the directory out from under a running
# server makes every request 500 until it is restarted.
set -euo pipefail
dir="${EMEND_STORE_DIR:-$(node -e "process.stdout.write(require('os').tmpdir())")/emend-store}"
mkdir -p "$dir"
rm -f "$dir"/document.json "$dir"/document.json.*.tmp
echo "✓ cleared $dir/document.json — next GET /api/document re-seeds the sample"
