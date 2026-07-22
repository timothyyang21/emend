#!/usr/bin/env bash
# Wipe the local document store so the next GET re-seeds James's passage.
# Exists because a stray curl during testing wrote a scratch document into the
# store, the client correctly preferred the server's copy, and the demo opened
# on "# Survives..." instead of the manuscript.
set -euo pipefail
dir="${EMEND_STORE_DIR:-$(node -e "process.stdout.write(require('os').tmpdir())")/emend-store}"
rm -rf "$dir"
echo "✓ cleared $dir — next GET /api/document re-seeds the sample"
