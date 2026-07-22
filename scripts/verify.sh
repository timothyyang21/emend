#!/usr/bin/env bash
# Agent self-check. Proves a piece compiles, lints, and (optionally) bundles —
# WITHOUT keeping a simulator running. Run before calling any piece "done".
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "▸ typecheck"; npx tsc --noEmit
echo "▸ lint";      npx expo lint
if [ "${1:-}" = "--full" ]; then
  echo "▸ bundle";  npx expo export --platform ios --output-dir /tmp/cactus-verify >/dev/null && echo "  bundle OK"
  # Supersedes a plain web export: "it built" proved nothing — a bundle that fails
  # to parse still exports cleanly and still serves a perfect-looking page.
  echo "▸ web";     bash scripts/check-web.sh
  echo "▸ shell";   bash scripts/check-shell.sh   # icon + name must be branded (delivery gate)
fi
echo "✓ verify passed"
