#!/usr/bin/env bash
# Append a timestamped decision to DEVLOG.md. Decision-focused, serialized (you run it).
set -euo pipefail
msg="${*:?usage: log.sh <decision text>}"
ts=$(date "+%Y-%m-%d %H:%M")
echo "- **[$ts]** $msg" >> "$(git rev-parse --show-toplevel)/DEVLOG.md"
echo "✓ logged to DEVLOG.md"
