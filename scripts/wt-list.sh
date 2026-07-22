#!/usr/bin/env bash
# Show all feature worktrees with branch, Metro port, and divergence from main.
set -euo pipefail
printf "%-18s %-18s %-6s %s\n" NAME BRANCH PORT "AHEAD/BEHIND"
git worktree list | awk '{print $1}' | while read -r path; do
  case "$path" in
    *cactus-trees/*)
      name=$(basename "$path")
      br=$(git -C "$path" branch --show-current 2>/dev/null || echo "?")
      port=$(cat "$path/.rig-port" 2>/dev/null || echo "-")
      ahead=$(git -C "$path" rev-list --count "main..$br" 2>/dev/null || echo 0)
      behind=$(git -C "$path" rev-list --count "$br..main" 2>/dev/null || echo 0)
      printf "%-18s %-18s %-6s +%s/-%s\n" "$name" "$br" "$port" "$ahead" "$behind"
      ;;
  esac
done
