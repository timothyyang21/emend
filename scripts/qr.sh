#!/usr/bin/env bash
# Make a shareable QR + link for the latest EAS Update on the 'preview' channel (opens in Expo Go).
#   scripts/qr.sh        → prints the link, a terminal QR, and writes qr.png to text/AirDrop.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
pid=$(node -e "process.stdout.write(require('./app.json').expo.extra?.eas?.projectId||'')")
[ -n "$pid" ] || { echo "✗ no EAS projectId in app.json — run 'eas init --force' + 'npm run update' first"; exit 1; }
major=$(node -e "process.stdout.write(String((require('./package.json').dependencies.expo||'').replace(/[^0-9.]/g,'').split('.')[0]))")
link="exp://u.expo.dev/${pid}?channel-name=preview&runtime-version=exposdk:${major}.0.0"
echo "Expo Go link (latest 'preview' update — no machine needed):"
echo "  $link"
echo
npx --yes qrcode-terminal "$link" || true
npx --yes qrcode "$link" -o qr.png 2>/dev/null && echo "✓ wrote qr.png — text/AirDrop it to the founder; they scan it in Expo Go."
