#!/usr/bin/env bash
# Web smoke gate — does the exported web app ACTUALLY RUN in a browser?
#
# WHY THIS EXISTS. A web build shipped once that was completely non-functional
# while every gate was green:
#     Uncaught SyntaxError: Cannot use 'import.meta' outside a module
# The whole bundle failed to parse, so React never hydrated. But Expo pre-renders
# static HTML, so the page still served HTTP 200 with correct text and correct
# layout — it just did nothing. typecheck passed. lint passed. `expo export`
# reported success. The deploy was green. Only the browser console knew.
#
# So this gate does the only thing that can catch that class of bug: it loads the
# built site in a real headless browser and asserts (1) no uncaught console errors
# and (2) that a React effect actually ran. Checking the HTML is NOT enough —
# prerendered HTML is indistinguishable from a working app.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

CHROME="${CHROME_BIN:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
OUT="${WEB_CHECK_DIR:-/tmp/cactus-webcheck}"
PORT="${WEB_CHECK_PORT:-4319}"

if [ ! -x "$CHROME" ]; then
  echo "⚠ web smoke gate SKIPPED — Chrome not found at:"
  echo "    $CHROME"
  echo "  Install Google Chrome, or set CHROME_BIN. A broken web bundle will NOT be caught."
  exit 0
fi

cleanup() { [ -n "${srv_pid:-}" ] && kill "$srv_pid" 2>/dev/null; }
trap cleanup EXIT

echo "  building web export…"
rm -rf "$OUT"
if ! npx expo export --platform web --output-dir "$OUT" >/tmp/cactus-webexport.log 2>&1; then
  echo "✗ web export failed:"; tail -20 /tmp/cactus-webexport.log; exit 1
fi

# Serve it. A file:// load can't exercise the real script-tag semantics.
while lsof -ti:"$PORT" >/dev/null 2>&1; do PORT=$((PORT+1)); done
python3 -m http.server "$PORT" --directory "$OUT" >/dev/null 2>&1 &
srv_pid=$!
for _ in $(seq 1 40); do
  curl -sf "http://127.0.0.1:$PORT" >/dev/null 2>&1 && break
  sleep 0.25
done

err=/tmp/cactus-web-console.log
dom=/tmp/cactus-web-dom.html
"$CHROME" --headless=new --disable-gpu --no-sandbox \
  --enable-logging=stderr --log-level=0 --virtual-time-budget=10000 \
  --dump-dom "http://127.0.0.1:$PORT" >"$dom" 2>"$err"

fail=0

# 1. Any uncaught error means the bundle is broken, however good the page looks.
if grep -qiE "Uncaught|SyntaxError" "$err"; then
  echo "✗ browser console reported an uncaught error:"
  grep -iE "Uncaught|SyntaxError" "$err" | sed 's/^/    /' | head -5
  fail=1
fi

# 2. Prerendered HTML looks identical to a working app — so require proof that a
#    React effect ran (the beacon set in src/app/_layout.tsx).
if ! grep -q 'data-app-mounted' "$dom"; then
  echo "✗ React never mounted — the page is prerendered HTML with a dead bundle."
  echo "    (no data-app-mounted beacon; see src/app/_layout.tsx)"
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  echo "  full console output: $err"
  exit 1
fi

echo "  ✓ web app runs in a real browser (no console errors, React mounted)"
