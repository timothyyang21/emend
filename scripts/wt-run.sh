#!/usr/bin/env bash
# Start Metro for a worktree on its assigned port (preview on sim / Expo Go). No port collisions.
set -euo pipefail
name="${1:?usage: wt-run <feature-name>}"
wt="$(dirname "$(git rev-parse --show-toplevel)")/cactus-trees/$name"
[ -d "$wt" ] || { echo "✗ no worktree '$name' (create it: scripts/wt-create.sh $name)"; exit 1; }
port=$(cat "$wt/.rig-port" 2>/dev/null || echo 8082)
echo "▸ Metro for '$name' on port $port  (press i for sim, or scan QR in Expo Go)"
cd "$wt" && exec npx expo start --port "$port"
