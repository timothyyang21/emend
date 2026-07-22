#!/usr/bin/env bash
# ONE command: a freshly-spawned project → fully delivered. No manual EAS/Vercel steps.
#
#   scripts/deliver.sh [name]        or   npm run deliver -- [name]
#
# `name` is the GitHub repo + Vercel project name; defaults to app.json's expo.slug.
#
# Idempotent — re-running skips what already exists and republishes the update.
# Fail-loud  — every prerequisite is checked up front with the exact fix command.
#
# THE FOOTGUN THIS EXISTS TO KILL: `eas update:configure` rewrites runtimeVersion to a
# fixed string. Public Expo Go only loads updates whose runtime is `exposdk:<major>.0.0`,
# so a fixed version publishes fine and then silently never opens on the founder's phone.
# Step 2 force-rewrites the policy back AFTER configure, then asserts the published
# update's runtime before declaring success.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

die()  { printf '\n✗ %s\n' "$*" >&2; exit 1; }
step() { printf '\n▸ %s\n' "$*"; }

name="${1:-$(node -e "process.stdout.write(require('./app.json').expo.slug||'')")}"
[ -n "$name" ] || die "no name given and app.json has no expo.slug"

sdk_major="$(node -e "process.stdout.write(String((require('./package.json').dependencies.expo||'').replace(/[^0-9.]/g,'').split('.')[0]))")"
[ -n "$sdk_major" ] || die "could not read the expo version from package.json"
want_runtime="exposdk:${sdk_major}.0.0"

# ── 0. pre-flight ─────────────────────────────────────────────────────────────
step "pre-flight"

# Guard: this is meant to run inside a SPAWNED project, not the rig. Running it here
# would publish an EAS update to the rig's own preview channel — noise, not damage,
# but never what you meant.
if [ "$name" = "cactus-rig" ] && [ "${DELIVER_THE_RIG:-}" != "1" ]; then
  die "refusing to deliver the rig itself (slug='cactus-rig').
     You almost certainly want to run this inside a project made by scripts/new-project.sh.
     If you really mean it: DELIVER_THE_RIG=1 npm run deliver"
fi
command -v gh >/dev/null 2>&1 || die "gh not installed → brew install gh"
gh auth status >/dev/null 2>&1 || die "GitHub not authenticated → gh auth login"
npx --yes eas-cli whoami >/dev/null 2>&1 || die "EAS not authenticated → npx eas-cli login"
npx --yes vercel whoami >/dev/null 2>&1 || die "Vercel not authenticated → npx vercel login"

# The brand gate: shipping the stock/placeholder icon is exactly what this rig exists to
# prevent, and delivery is the last moment to catch it.
if [ "${ALLOW_DEFAULT_SHELL:-}" != "1" ]; then
  bash scripts/check-shell.sh \
    || die "brand gate failed (above). Make the real icon, or re-run with ALLOW_DEFAULT_SHELL=1 to override."
fi

# The web gate: the web URL is the PRIMARY link you send. A bundle that fails to
# parse still exports cleanly and still serves a perfect-looking page, so this is
# the last chance to catch a deploy that is green and completely non-functional.
if [ "${SKIP_WEB_CHECK:-}" != "1" ]; then
  bash scripts/check-web.sh \
    || die "web smoke gate failed (above) — the site would deploy DEAD. Fix it, or re-run with SKIP_WEB_CHECK=1 to override."
fi

gh_user="$(gh api user -q .login)"
echo "  gh=$gh_user  eas=$(npx --yes eas-cli whoami 2>/dev/null | head -1)  vercel=$(npx --yes vercel whoami 2>/dev/null | tail -1)"
echo "  project=$name  sdk=$sdk_major  target runtime=$want_runtime"

# ── 1. GitHub ─────────────────────────────────────────────────────────────────
step "GitHub"
if gh repo view "$gh_user/$name" >/dev/null 2>&1; then
  echo "  repo exists — pushing"
  git remote get-url origin >/dev/null 2>&1 \
    || git remote add origin "https://github.com/$gh_user/$name.git"
  git push -u origin main
else
  # Default private. A take-home reviewer can't open a private repo, so either ship
  # public (DELIVER_PUBLIC=1) or add them: gh repo add-collaborator <user> --permission read
  vis="--private"; [ "${DELIVER_PUBLIC:-}" = "1" ] && vis="--public"
  gh repo create "$name" $vis --source=. --remote=origin --push
fi
gh_url="https://github.com/$gh_user/$name"
repo_vis="$(gh repo view "$gh_user/$name" --json visibility -q .visibility 2>/dev/null || echo UNKNOWN)"
[ "$repo_vis" = "PRIVATE" ] && echo "  (private — you'll get a decision about this at the end)"

# ── 2. EAS → Expo Go ──────────────────────────────────────────────────────────
step "EAS (Expo Go channel)"
pid="$(node -e "process.stdout.write(require('./app.json').expo.extra?.eas?.projectId||'')")"
if [ -z "$pid" ]; then
  npx --yes eas-cli init --force --non-interactive
else
  echo "  already linked ($pid)"
fi

npx --yes eas-cli update:configure --non-interactive

# Force the policy back — unconditionally, every run. This is the whole point.
node -e '
const fs = require("fs");
const a = JSON.parse(fs.readFileSync("app.json"));
a.expo.runtimeVersion = { policy: "sdkVersion" };
fs.writeFileSync("app.json", JSON.stringify(a, null, 2) + "\n");
'
echo "  runtimeVersion forced → {\"policy\":\"sdkVersion\"}"

npx --yes eas-cli channel:create preview --non-interactive >/dev/null 2>&1 \
  && echo "  channel 'preview' created" \
  || echo "  channel 'preview' already exists"

git add -A app.json && git commit -q -m "chore(eas): link project + force sdkVersion runtime policy" 2>/dev/null \
  && git push -q origin main || true

npx --yes eas-cli update --branch preview --message "deliver: $(date +%H:%M)" --non-interactive

# Assert the published update will actually open in public Expo Go.
got_runtime="$(npx --yes eas-cli update:list --branch preview --limit 1 --json --non-interactive 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);const u=(j.currentPage||j)[0]||{};process.stdout.write(u.runtimeVersion||"")}catch{process.stdout.write("")}})')"
if [ "$got_runtime" != "$want_runtime" ]; then
  die "published update runtime is '${got_runtime:-unknown}' but public Expo Go needs '$want_runtime' — it would NOT load on the founder's phone"
fi
echo "  ✓ published update runtime = $got_runtime (loads in public Expo Go)"

pid="$(node -e "process.stdout.write(require('./app.json').expo.extra?.eas?.projectId||'')")"
expo_link="exp://u.expo.dev/${pid}?channel-name=preview&runtime-version=${want_runtime}"

# ── 3. Vercel (primary "run it live" link) ────────────────────────────────────
step "Vercel (web)"
if [ ! -d .vercel ]; then
  # Vercel refuses to pick a scope non-interactively, but its own error names the
  # candidates. Harvest the scope from that JSON instead of hard-coding a team slug
  # (which would break the moment this rig is used from another account).
  scope="${VERCEL_SCOPE:-}"
  if [ -z "$scope" ]; then
    # NOTE: this probe is EXPECTED to exit non-zero — that failure is how Vercel
    # reports the scope choices. Capture it with `|| true` first; piping it directly
    # would trip `set -euo pipefail` and kill the script with no output.
    probe="$(npx --yes vercel link --yes 2>&1 || true)"
    scope="$(printf '%s' "$probe" | sed -n '/^{/,$p' \
      | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write(j?.choices?.[0]?.name||"")}catch{process.stdout.write("")}})' || true)"
  fi
  if [ -n "$scope" ]; then
    echo "  scope: $scope"
    npx --yes vercel link --yes --project "$name" --scope "$scope" >/dev/null \
      || die "vercel link failed for scope '$scope' — try: npx vercel link --yes --project $name --scope <team>"
  else
    # Already linkable without a scope (single-scope account), or genuinely broken.
    npx --yes vercel link --yes --project "$name" >/dev/null \
      || die "vercel link failed — run 'npx vercel teams ls', then re-run with VERCEL_SCOPE=<team> npm run deliver"
  fi
fi
deploy_log="$(mktemp)"
npx --yes vercel deploy --prod --yes 2>&1 | tee "$deploy_log"
web_url="$(grep -oE 'https://[A-Za-z0-9.-]+\.vercel\.app' "$deploy_log" | tail -1)"
alias_url="$(grep -i 'Aliased:' "$deploy_log" | grep -oE 'https://[A-Za-z0-9.-]+\.vercel\.app' | tail -1)"
[ -n "$alias_url" ] && web_url="$alias_url"
rm -f "$deploy_log"
[ -n "$web_url" ] || die "could not parse the Vercel URL from the deploy output"

# ── 4. QR for the Expo Go link ────────────────────────────────────────────────
step "QR"
npx --yes qrcode "$expo_link" -o qr.png >/dev/null 2>&1 \
  && echo "  wrote qr.png — text/AirDrop it; they scan in Expo Go" \
  || echo "  (qr.png generation skipped)"

# ── done ──────────────────────────────────────────────────────────────────────
# The reviewer 404s on a private repo, and a warning 100 lines above the links is a
# warning nobody reads. Make it a numbered decision inside the final block instead.
if [ "$repo_vis" = "PRIVATE" ]; then
  vis_decision="    • DECIDE — the repo is PRIVATE, so that Code link 404s for the reviewer:
        1) make it public:  gh repo edit $gh_user/$name --visibility public --accept-visibility-change-consequences
        2) invite them:     gh api -X PUT repos/$gh_user/$name/collaborators/<their-github> -f permission=pull
        3) skip — you're sending code some other way"
else
  vis_decision="    • repo is $repo_vis — the Code link is reachable"
fi

cat <<EOF

════════════════════════════════════════════════════════════════════
  DELIVERED — $name
════════════════════════════════════════════════════════════════════

  Web (share this first — any device, no install)
    $web_url

  Expo Go (native feel — scan qr.png, or open the link on the phone)
    $expo_link

  Source
    $gh_url

  Still on you:
    • record the 60s demo video →  npm run record   (start … stop)
${vis_decision}
    • AI live? set the key:        npx vercel env add ANTHROPIC_API_KEY production
                                   npx vercel env add EXPO_PUBLIC_AI_ENDPOINT production
                                   ($web_url/api/ai) then re-run deliver
════════════════════════════════════════════════════════════════════
EOF
