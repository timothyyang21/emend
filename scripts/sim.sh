#!/usr/bin/env bash
# Boot an iOS simulator and start Expo so the app opens on it with Fast Refresh —
# and print the QR so a real phone can join too.
#
# DEGRADES ON PURPOSE. A simulator problem must never stop Metro: the sim is a
# convenience, the QR is the deliverable. We resolve and boot a REAL device up front
# rather than trusting CoreSimulator's default, because that default can point at a
# device Xcode has since deleted — which fails with the useless
# "Invalid device or device pair: <uuid>" and took the whole command down with it.
# If anything about the sim looks wrong, we fall back to plain `expo start`.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

plain() { echo "▸ starting Expo — press i for a sim, w for web, or scan the QR"; exec npx expo start; }

[ "$(uname)" = "Darwin" ]         || plain
command -v xcrun >/dev/null 2>&1  || plain
xcrun simctl help >/dev/null 2>&1 || plain

UUID_RE='[0-9A-F]{8}-([0-9A-F]{4}-){3}[0-9A-F]{12}'

# Prefer a device that's already booted; else the first available iPhone.
udid="$(xcrun simctl list devices booted 2>/dev/null | grep -oE "$UUID_RE" | head -1)"
[ -z "$udid" ] && udid="$(xcrun simctl list devices available 2>/dev/null \
  | grep -i iphone | grep -oE "$UUID_RE" | head -1)"

if [ -z "$udid" ]; then
  echo "▸ no usable iPhone simulator found — starting Expo anyway"
  plain
fi

# `boot` on an already-booted device exits non-zero; that's expected, hence the guard.
xcrun simctl boot "$udid" >/dev/null 2>&1 || true
if ! xcrun simctl list devices booted 2>/dev/null | grep -q "$udid"; then
  echo "▸ simulator wouldn't boot ($udid) — starting Expo anyway, scan the QR"
  plain
fi

open -a Simulator >/dev/null 2>&1 || true
echo "▸ simulator ready — Fast Refresh follows your edits (scan the QR for your phone)"
exec npx expo start --ios
