#!/usr/bin/env bash
# App-shell brand gate. Fails while the app is still wearing default/placeholder
# identity — the class of miss where a name + art direction were decided but the
# actual icon never got made (see DEVLOG). Runs in `verify --full` (delivery grade)
# and standalone via `npm run verify:shell`. NOT in the bare `verify` feature agents
# run — branding is the integrator's deliverable, not theirs.
#
# Escape hatch for working ON the rig template itself: ALLOW_DEFAULT_SHELL=1
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# Icons that mean "nobody branded this yet": the Expo template default + our
# new-project placeholder. Add a hash here if the template art ever changes.
REJECT_HASHES="
7a667804bb80a6a424a5daf18a2599c4f32237cf06fe78fc0de45dbb09e0eccf
bc782459c85860573a95e679e32f156d93be84697c9369416f2576bd10aeabc6
"
# app names that mean "nobody named this yet" (one per line — some contain spaces)
REJECT_NAMES="cactus-rig
<app name>
app"

if [ "${ALLOW_DEFAULT_SHELL:-}" = "1" ]; then
  echo "▸ shell gate skipped (ALLOW_DEFAULT_SHELL=1)"; exit 0
fi

fail() { echo "✗ $*" >&2; exit 1; }

icon="$(node -e 'const a=require("./app.json");process.stdout.write(a.expo.icon||"")')"
name="$(node -e 'const a=require("./app.json");process.stdout.write(a.expo.name||"")')"

[ -n "$icon" ] || fail "app.json has no expo.icon"
[ -f "$icon" ] || fail "icon file missing: $icon"

hash="$(shasum -a 256 "$icon" | awk '{print $1}')"
if grep -qx "$hash" <<<"$REJECT_HASHES"; then
  fail "app icon is still a default/placeholder ($icon) — make the real icon before delivery."
fi

lname="$(printf '%s' "$name" | tr '[:upper:]' '[:lower:]')"
while IFS= read -r bad; do
  [ -n "$bad" ] || continue
  if [ "$lname" = "$bad" ]; then
    fail "app.json expo.name is still the placeholder \"$name\" — set the real app name."
  fi
done <<<"$REJECT_NAMES"

echo "✓ shell gate passed (icon + name are branded)"
