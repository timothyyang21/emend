#!/usr/bin/env bash
# Remove ALL feature worktrees and feat/* branches, and the cactus-trees dir. End-of-sprint reset.
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
trees="$(dirname "$root")/cactus-trees"
for p in $(git worktree list | awk '/cactus-trees\//{print $1}'); do
  git worktree remove "$p" --force 2>/dev/null || true
done
git worktree prune
for b in $(git branch --list 'feat/*' | sed 's/^[* +] *//'); do
  [ -n "$b" ] && git branch -D "$b" 2>/dev/null || true
done
rm -rf "$trees"
echo "✓ all feature worktrees + feat/* branches removed"
