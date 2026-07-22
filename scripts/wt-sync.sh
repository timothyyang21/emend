#!/usr/bin/env bash
# Pull the latest main into a feature branch (run after each sequential merge).
set -euo pipefail
name="${1:?usage: wt-sync <feature-name>}"
wt="$(dirname "$(git rev-parse --show-toplevel)")/cactus-trees/$name"
[ -d "$wt" ] || { echo "✗ no worktree '$name'"; exit 1; }
git -C "$wt" merge --no-edit main
echo "✓ '$name' synced with main"
