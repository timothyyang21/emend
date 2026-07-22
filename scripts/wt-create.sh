#!/usr/bin/env bash
# Create an isolated worktree for a feature: branch + node_modules (APFS clonefile) + Metro port.
set -euo pipefail
name="${1:?usage: wt-create <feature-name>}"
root="$(git rev-parse --show-toplevel)"
trees="$(dirname "$root")/cactus-trees"
wt="$trees/$name"
branch="feat/$name"
mkdir -p "$trees"
count=$(git worktree list | grep -c "cactus-trees/" || true)
port=$((8082 + count))
git worktree add -b "$branch" "$wt" main
if cp -c -R "$root/node_modules" "$wt/node_modules" 2>/dev/null; then
  echo "  node_modules cloned (APFS clonefile — instant)"
else
  echo "  clonefile unavailable → npm install"; ( cd "$wt" && npm install )
fi
echo "$port" > "$wt/.rig-port"
echo "✓ '$name' → $wt"
echo "  branch $branch · Metro port $port"
echo "  next: scripts/wt-run.sh $name"
