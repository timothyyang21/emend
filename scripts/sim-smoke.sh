#!/usr/bin/env bash
# ONE-SHOT UI smoke for a looser-leash piece: boot a sim, load a URL, screenshot, shut down.
# Does NOT keep a sim running. Needs Expo Go installed on the sim (or a dev build).
#   sim-smoke.sh <exp-url> [device]
set -euo pipefail
url="${1:?usage: sim-smoke <exp-url> [device]}"; dev="${2:-iPhone 17 Pro}"
udid=$(xcrun simctl list devices available | grep "$dev (" | head -1 | grep -oE '[0-9A-F-]{36}' | head -1 || true)
[ -n "$udid" ] || { echo "✗ device '$dev' not found (xcrun simctl list devices)"; exit 1; }
xcrun simctl boot "$udid" 2>/dev/null || true
open -a Simulator
xcrun simctl openurl "$udid" "$url"
sleep 8
shot="/tmp/cactus-smoke-$(date +%s).png"
xcrun simctl io "$udid" screenshot "$shot"
xcrun simctl shutdown "$udid" 2>/dev/null || true
echo "✓ smoke screenshot: $shot"
