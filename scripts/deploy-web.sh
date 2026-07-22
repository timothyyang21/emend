#!/usr/bin/env bash
# Export the web build and deploy it to Vercel as a public URL (browser share — no Expo Go, any device).
# Deploys the REPO ROOT (not dist/) so the serverless function in api/ ships alongside the
# static export — see vercel.json for buildCommand/outputDirectory.
# One-time: run `vercel login`, then `vercel env add ANTHROPIC_API_KEY production`.
# ALSO one-time per project: `vercel link --yes --scope <team-slug>` — an unlinked directory
# fails non-interactively with `missing_scope` (a fresh new-project.sh project is unlinked).
# Rollback (static only, no API): npx expo export --platform web && vercel deploy dist --prod --yes
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
echo "▸ deploying repo root to Vercel (production) — builds web export + api/"
vercel deploy --prod --yes
