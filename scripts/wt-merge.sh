#!/usr/bin/env bash
# Sequentially merge a feature into main, verify, and record status. Run from the main tree.
set -euo pipefail
name="${1:?usage: wt-merge <feature-name>}"
root="$(git rev-parse --show-toplevel)"
cd "$root"
branch="feat/$name"
[ "$(git branch --show-current)" = "main" ] || { echo "✗ switch to main first: git switch main"; exit 1; }
git merge --no-ff --no-edit "$branch"   # stops here on conflict → you resolve, then re-run verify
bash scripts/verify.sh || { echo "✗ verify failed after merge — fix on main before the next merge"; exit 1; }
ts=$(date "+%Y-%m-%d %H:%M")
echo "- [$ts] merged **$name** ($branch)" >> STATUS.md
git add STATUS.md && git commit -q -m "chore(status): merged $name"
echo "✓ merged $name → main, verified, STATUS updated"
