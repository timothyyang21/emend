# Emend

> Speech-to-edit for prose: speak an instruction, review the change as a diff, accept or reject.
> Nothing the AI writes reaches your manuscript without your say-so.

<!-- TODO(readme): this file is still the rig manual below. Rewrite as the Emend
     README (build steps, architecture, AI-use notes from DEVLOG) in the final pass. -->

## Product

### Design

Emend's look is **spring-clear Regency** — light, literary, elegant. That's deliberate: this is a
writer-facing tool for an AI writing company, so the craft should signal respect for prose. Most
POCs ship cold and utilitarian; here the taste is part of the product argument.

It's one design language, not a skin. The icon's palette — ivory, champagne gold, blush rose,
sage — is the palette used across the app, including the diff itself, where **deletions sit on
rose and additions on sage**. The icon is the design system in miniature, not decoration.

I art-directed three versions:

| <img src="docs/icons/v1.png" width="110"> | <img src="docs/icons/v2.png" width="110"> | <img src="docs/icons/v3.png" width="110"> |
|:--:|:--:|:--:|
| v1 — subtle single sprig | **v2 — chosen** | v3 — florals framed in the corners |

**v2** wins: a single bold bloom resting against the serif E reads like a writer's pen laid across
the letterform — tool and craft in one mark.

**AI candor:** the icons were generated and iterated with AI as vector art. The taste calls — vibe,
palette, scale, placement, the pen read — were mine.

## What's next

**A story bible, at book level.** The obvious next feature is a list of proper nouns —
characters, places, invented spellings — injected into every edit prompt so the model
preserves them exactly: *"Preserve the exact spelling of these proper nouns unless
explicitly instructed to change them."* The plumbing is already there: `EditRequest`
carries an optional `dictionary: string[]`, `/api/edit` injects it, and it was verified
working against the live model (given `["Aeryn Kestrelle", "Wyckhampe"]` it fixed
"trane"→"train" and left the invented names and British "travelled" alone).

What's missing is only the UI and persistence, and it should not be a per-chapter list.
A character's name is a fact about the *book*, so the story bible belongs beside the
chapter index, not inside Chapter 4 — which is also why it wasn't stubbed into the
editor under the clock. A dead button promising a feature is worse than an honest gap.

## Rig manual (inherited)

A reusable Expo + TypeScript rig for a **2-hour, from-scratch React Native POC**. Scaffold a
clean app, freeze shared contracts, fan out 4–6 parallel agents in git worktrees, integrate
sequentially, and ship — with **zero day-of setup**.

On the day: copy/clone this repo, rename, and go.

## Quickstart

```bash
npm run go        # start Metro → press i for the iOS sim, or scan the QR in Expo Go
```

Edit `src/app/index.tsx` and save to hot-reload. Other commands: `npm run ios`, `npm run web`,
`npm run verify`, `npm test`.

## Reuse — spin up the real project on the day

**Don't `cp -R` the folder** — that leaks the git remote (you'd push into the rig's repo), the EAS
project link, and the cactus identity. Instead:

```bash
scripts/new-project.sh avocado-repo      # or: npm run new -- avocado-repo
```

Clonefile-copies the rig (instant, keeps `node_modules` → runnable now), starts **fresh git history**,
renames the app, **detaches the rig's EAS project** (keeps `runtimeVersion: sdkVersion`), and blanks
STATUS/DEVLOG. Then `cd ../avocado-repo && npm run go`. Create the GitHub repo + EAS project **fresh on
the day** (you'll know the app name then):

```bash
gh repo create avocado --private --source=. --push
eas init --force && eas update:configure     # then set app.json runtimeVersion.policy = "sdkVersion"
eas channel:create preview && npm run update -- "first preview"
```

## Stack (decided, installed, never re-litigate under the clock)

| Concern | Choice | Why |
|---|---|---|
| Navigation | **Expo Router** | File-based — a screen is a file in `src/app/`; agents add screens with zero central-config merge conflicts. |
| State | **Zustand** | No provider boilerplate; one slice file per agent; trivial persistence. |
| Persistence | **AsyncStorage** | Wrapped by `persistOptions()` in `src/lib/storage.ts`. |
| UI | **StyleSheet + tokens** | Zero-config; primitives in `src/components/ui` driven by `src/theme/tokens.ts`. |
| Tests | **jest-expo** | Pre-wired; quick logic tests for looser-leash pieces. |
| Delivery | **GitHub + EAS Update** | QR/link opens in Expo Go — no native build, no Apple credentials. |

## Project layout

```
src/app/            Expo Router routes (_layout.tsx FROZEN)     src/theme/tokens.ts   design tokens
src/components/ui/  shared primitives (FROZEN)                  src/types/contracts.ts FROZEN contracts
src/components/<f>/ per-agent feature components                scripts/              worktree + ops CLI
src/store/          zustand slices (index.ts FROZEN)            PLAN.md               contracts + ownership
src/lib/            storage helper + per-agent logic            STATUS.md / DEVLOG.md coordination logs
```

Worktrees live as **siblings** in `../cactus-trees/<name>`, each on `feat/<name>` with its own Metro port.

## Worktree workflow

| Command | Does |
|---|---|
| `scripts/wt-create.sh <name>` | Branch `feat/<name>` + worktree + `node_modules` (APFS clonefile) + Metro port |
| `scripts/wt-list.sh` | All worktrees: branch, port, ahead/behind main |
| `scripts/wt-run.sh <name>` | Start Metro for that worktree on its port (preview) |
| `scripts/wt-sync.sh <name>` | Pull latest main into a feature branch (after each merge) |
| `scripts/wt-merge.sh <name>` | Merge → verify main → append STATUS (run from main) |
| `scripts/wt-teardown.sh <name>` | Remove worktree + delete merged branch |
| `scripts/wt-teardown-all.sh` | End-of-sprint reset: all worktrees + `feat/*` branches |

**Example session:**
```bash
scripts/wt-create.sh mood-store        # agent B's piece
scripts/wt-create.sh entry-screen      # agent A's piece
# ... agents work in ../cactus-trees/<name>, each runs `npm run verify` before "done" ...
git switch main && scripts/wt-merge.sh mood-store   # sequential merge, keeps main green
scripts/wt-sync.sh entry-screen                     # A pulls the just-merged main
```

## Verification + sim-review loop

- **Agents self-verify (no persistent sim):** `npm run verify` = typecheck + lint (`-- --full` bundles).
  Logic pieces add `npm test`. One-shot UI smoke without keeping a sim: `scripts/sim-smoke.sh <exp-url>`.
- **Split by verifiability:** backend/data/API/types/logic → looser leash (verify + a quick test).
  UI/feel/polish → under your close eye.
- **You review feel:** spin up **one** sim (`npm run ios`) or Expo Go via QR, judge, approve/note,
  then `wt-merge`. Merges are **sequential**; agents `wt-sync` after each. **Agents verify it RUNS; you
  verify it FEELS right.** Never give an agent device/account credentials.

## Delivery: one command

```bash
npm run deliver            # or: npm run deliver -- <name>   (defaults to app.json's slug)
```

Takes a freshly-spawned project from zero to delivered with **no manual steps**: checks
auth, creates + pushes the GitHub repo, runs `eas init` + `update:configure`, **force-resets
`runtimeVersion` to `{"policy":"sdkVersion"}`**, creates the `preview` channel, publishes the
update, **asserts the published runtime is `exposdk:<major>.0.0`** (else it fails loudly),
deploys the web build to Vercel, writes `qr.png`, and prints every link.

It is idempotent — re-run it after any change and it republishes rather than duplicating.

> **Why the force-reset matters.** `eas update:configure` rewrites `runtimeVersion` to a fixed
> string. Public Expo Go only loads updates whose runtime is `exposdk:<major>.0.0`, so a fixed
> version publishes *successfully* and then silently never opens on the founder's phone. That
> manual re-fix used to be the day-of footgun; `deliver.sh` now does it and then proves it.

Prerequisites (once per machine): `gh auth login`, `npx eas-cli login`, `npx vercel login`.
`deliver.sh` fails immediately with the exact command if any is missing.

## Delivery pipeline — the pieces `deliver` automates (no Apple credentials, no native build)

**1. GitHub (source of truth)**
```bash
gh repo create <name> --private --source=. --remote=origin --push
```

**2. EAS Update → opens in Expo Go (QR/link, no machine running).** ✅ verified end-to-end.
The catch, proven during setup: the public App Store/Play Store Expo Go is pinned to **SDK 54** (55–57 are
stuck in Apple's review queue; newer needs `eas go` → TestFlight + paid Apple account), and it only loads an
update whose **runtime = `exposdk:54.0.0`**, served through a **channel**. So this rig targets **SDK 54** and
ships `runtimeVersion.policy = "sdkVersion"` + a linked `preview` channel — the founder scans a QR in their own
Expo Go, zero credentials.
```bash
npm run update -- "your message"     # publishes preview branch @ runtime exposdk:54.0.0
```
Open on a phone with Expo Go (SDK 54) via the branch-page QR
(`https://expo.dev/accounts/<acct>/projects/<slug>/branches/preview`) or the deep link
`exp://u.expo.dev/<projectId>?channel-name=preview&runtime-version=exposdk:54.0.0`.

**Share it:** `npm run qr` writes `qr.png` (the update's public link as a scannable QR) — text/AirDrop that to
the founder; the EAS *dashboard* QR is behind your login, so don't send the dashboard URL. Live-demo alt:
`npx expo start --tunnel`. Browser alt (no app): the web URL.

_First-time setup on a fresh app (~90s):_ `eas init --force` → `eas update:configure` →
set `expo.runtimeVersion.policy` to `"sdkVersion"` in app.json → `eas channel:create preview` →
`npm run update -- "first preview"`.

**3. Web export → one-click browser URL (works everywhere, no Expo Go).** ✅ re-verified end-to-end
2026-07-21 on the repo-root deploy: all 5 routes serve and `api/ai` executes (live at
`https://cactus-repo.vercel.app`).
```bash
npm run deploy:web                   # builds web export via vercel.json + deploys repo root (ships api/)
# manual: npm run export:web && npx vercel deploy dist --prod   (or netlify deploy --dir dist --prod)
```
**One-time per project — do this before the clock starts.** `vercel deploy` refuses to run
non-interactively in an unlinked directory (`missing_scope`), which is exactly what a fresh
`new-project.sh` project is. Link once:
```bash
vercel link --yes --scope <your-team-slug>     # `vercel teams ls` to find it; creates .vercel/ (gitignored)
```
**`vercel.json` sets `cleanUrls: true` — do not remove it.** Expo Router exports `kit.html` /
`writing.html` but links to `/kit` / `/writing`; without `cleanUrls` every sub-route 404s on a
direct link or refresh while the homepage still works, so it looks fine until someone clicks through.
One-time: `vercel login`. **Share the short alias** Vercel prints (`Aliased: https://<name>.vercel.app`) —
that one is public. The long `…-<hash>-<scope>.vercel.app` *deployment* URL sits behind Vercel's login wall,
so don't send that. Any browser, any device, no app install.

**4. Screen recording (60-sec backstop).** Boot a sim, run the app:
```bash
scripts/record.sh start   #  …demo…   scripts/record.sh stop   → demo.mov
```

**Live demo during the founder call:** `npx expo start --tunnel` → QR opens in Expo Go from anywhere
(needs your machine running).

No TestFlight. Reserve ~10–15 min to package.

## AI (writing assist)

The rig ships a provider-neutral `AIService` (`src/lib/ai/`). With no setup it uses a
**mock** that requires no key and works fully offline — the AI button always has something
to return. The service also exposes a streaming path (`AIService.stream`), but nothing in
the UI consumes it yet; the Composer's AI button calls the non-streaming `complete()`.

To make it real:

1. `vercel env add ANTHROPIC_API_KEY production` — the key lives **server-side only**.
2. `npm run deploy:web` — deploys the web export *and* the `api/ai` function. The web
   build itself now runs **on Vercel** (via `vercel.json`'s `buildCommand`), not locally.
3. The endpoint must be set as a **Vercel env var** for the web build to pick it up —
   a local shell var is never seen by Vercel's build:
   ```bash
   vercel env add EXPO_PUBLIC_AI_ENDPOINT production
   ```
   **Chicken-and-egg:** the deployment URL only exists after the first deploy. So: deploy
   once (step 2) to get the URL, set `EXPO_PUBLIC_AI_ENDPOINT` to `https://<that-url>/api/ai`
   (step 3), then deploy again so the web bundle is built with the endpoint inlined.
4. Separately, for the **Expo Go / `eas update`** path, `EXPO_PUBLIC_AI_ENDPOINT` must be
   set in your shell **before** building (`expo export` / `eas update`) — Expo inlines
   `EXPO_PUBLIC_*` vars at build time, not at runtime, and a Vercel env var has no effect
   on that build.

**Never** put the API key in an `EXPO_PUBLIC_*` var — those are inlined into the public
bundle. The endpoint URL is public by design; the key is not.

**Caveat:** the deployed endpoint is unauthenticated, so anyone with the URL can spend
against your key. Request caps mitigate this: `max_tokens` is capped at 4096, requests are
capped at 50 messages, and total message content is capped at 100,000 characters. Rotate or
delete the key after a demo.

## Day-of playbook (2 hours, tuned to 4–6 pieces)

| Time | Move |
|---|---|
| **0:00–0:05** | Paste the founder's spec into Claude Code. **AI-parse it:** ambiguities, edge cases, unstated assumptions, the clarifying questions worth asking, and a proposed 2-hour scope = **one working vertical slice + an explicit cut list.** |
| **0:05–0:10** | **Clarifying call/text** with the founder. Open with a **read-back:** _"Here's what I understand the goal is; given 2 hours I'll scope to X and cut Y; two questions: A, B — does that match?"_ |
| **0:10–0:20** | Write `PLAN.md` (vertical slice, ownership map, ports, DoD) + **freeze `src/types/contracts.ts`**. Build the **thin end-to-end skeleton** (nav + one screen + store wired + persistence) — get the core flow green FIRST. |
| **0:20–1:30** | **Fan out:** `wt-create` one worktree per piece; each agent gets one clear piece + reads PLAN.md/CLAUDE.md. **Integrate early and often** — review each piece on the sim/phone when ready, `wt-merge` sequentially, agents `wt-sync`. |
| **1:30–1:55** | **Make one thing feel genuinely good** (polish/animation/empty states). Confirm it runs clean (`npm run verify -- --full`). **Package: `npm run deliver`** — one command does GitHub + Expo Go + Vercel and prints every link. Then record the 60-sec backstop (`npm run record`). |
| **1:55–2:00** | **Distill `DEVLOG.md` → a short README summary** (approach, key decisions, what's built, what's next) for the founder. |

**Comms cadence:** AI-parse + read-back up front → 1–2 short progress pings → done. Never go silent, never over-ask.

## Docs

- **`PLAN.md`** — contracts + ownership map (fill in when the spec lands).
- **`CLAUDE.md`** — the agent operating manual (every agent reads it).
- **`STATUS.md`** — what has landed (auto-appended by `wt-merge`).
- **`DEVLOG.md`** — timestamped decisions (`scripts/log.sh "…"`), distilled at the end.
- **`docs/superpowers/`** — the design spec and implementation plan this rig was built from.
