#!/usr/bin/env bash
# Spin up a fresh project FROM this rig — instant, pristine, runnable.
#   scripts/new-project.sh <folder-name>        e.g. new-project.sh avocado-repo
#
# Clonefile-copies the rig (keeps node_modules → runnable immediately), then resets the
# three tie-backs a plain `cp -R` would leak: git history/remote, the EAS project link,
# and the cactus identity. GitHub repo + EAS project are created on the day (see README).
set -euo pipefail
name="${1:?usage: new-project.sh <folder-name>   (e.g. avocado-repo)}"
src="$(git rev-parse --show-toplevel)"
dest="$(dirname "$src")/$name"
slug="$(printf '%s' "$name" | sed -E 's/-repo$//' | tr '[:upper:]' '[:lower:]')"
scheme="$(printf '%s' "$slug" | tr -cd 'a-z0-9')"
[ -e "$dest" ] && { echo "✗ $dest already exists"; exit 1; }

echo "▸ cloning rig → $dest (APFS clonefile; keeps node_modules)"
cp -c -R "$src" "$dest" 2>/dev/null || cp -R "$src" "$dest"

cd "$dest"
# Fresh history + drop every rig-specific tie-back and build artifact.
#   .vercel     → the RIG's Vercel project link; without this a spawn deploys into the rig
#   qr.png      → a QR pointing at the RIG's EAS update
#   .superpowers→ scratch ledgers from the rig's own build sessions
rm -rf .git .expo dist docs/superpowers .vercel .superpowers qr.png
git init -q -b main

# rename the app + detach the rig's EAS project
node -e '
const fs=require("fs"), [slug,scheme]=process.argv.slice(1);
const p=JSON.parse(fs.readFileSync("package.json")); p.name=slug;
fs.writeFileSync("package.json", JSON.stringify(p,null,2)+"\n");
const a=JSON.parse(fs.readFileSync("app.json"));
a.expo.name=slug; a.expo.slug=slug; a.expo.scheme=scheme;
delete a.expo.owner; if(a.expo.extra) delete a.expo.extra.eas; delete a.expo.updates;
fs.writeFileSync("app.json", JSON.stringify(a,null,2)+"\n");
' "$slug" "$scheme"

# stamp a LOUD placeholder over the stock Expo art so an unbranded app looks
# unfinished on the home screen — `verify --full` / `npm run verify:shell` fails
# until the real icon lands (scripts/check-shell.sh).
for f in icon splash-icon android-icon-foreground favicon; do
  node scripts/make-placeholder-icon.js "assets/images/$f.png" 1024
done
printf 'REPLACE the placeholder magenta icon before delivery.\nName + art direction were decided — turn that into the real assets/images/icon.png.\nGate: npm run verify:shell (also runs in `npm run verify -- --full`).\n' > assets/BRAND-TODO.md

# blank the coordination logs for a fresh run (keep PLAN.md template + CLAUDE.md manual)
printf '# STATUS — what has landed on `main`\n\nAppend-only, one line per piece, written by `scripts/wt-merge.sh` at each merge.\n\n<!-- entries appear below -->\n' > STATUS.md
printf '# DEVLOG — decisions & milestones\n\nDecision-focused, timestamped. Appended via `scripts/log.sh "<decision>"`.\nDistilled into the README summary in the final ~10 minutes.\n\n<!-- entries appear below -->\n' > DEVLOG.md

git add -A && git commit -q -m "chore: bootstrap $slug from cactus rig"
echo "✓ '$slug' ready at $dest"
echo "  ⚠ brand:  placeholder icon stamped — make the real icon (see assets/BRAND-TODO.md)"
echo
echo "  The whole day is three commands:"
echo "    1. cd $dest && npm run go        # sim boots and follows you"
echo "    2. …build…"
echo "    3. npm run deliver               # GitHub + EAS/Expo Go + Vercel, no manual steps"
