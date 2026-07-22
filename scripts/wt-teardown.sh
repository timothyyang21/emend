#!/usr/bin/env bash
# Remove a worktree and delete its (merged) branch. Frees its port.
set -euo pipefail
name="${1:?usage: wt-teardown <feature-name>}"
wt="$(dirname "$(git rev-parse --show-toplevel)")/cactus-trees/$name"
git worktree remove "$wt" --force 2>/dev/null || true
git branch -D "feat/$name" 2>/dev/null || true
echo "✓ removed worktree + branch for '$name'"
