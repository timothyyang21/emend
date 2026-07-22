@AGENTS.md

# Cactus Rig — operating manual for agents

You are one of several agents building a React Native POC in parallel. **Read `PLAN.md`
first.** Follow these rules exactly so we stay decoupled and never step on each other.

## Stack (decided — do not re-litigate)

- **Expo Router** — file-based nav; a screen is a file in `src/app/`. No central nav config.
- **Zustand** for state — one slice file per feature in `src/store/`, persisted via
- **AsyncStorage** — use `persistOptions(name)` from `@/lib/storage`.
- **UI** — plain `StyleSheet` + tokens in `@/theme/tokens`. Import primitives from
  `@/components/ui`: `Button`, `Card`, `Input`, `Screen`, `AppText`. No NativeWind/Tamagui.
- **TypeScript** strict. Path alias `@/*` → `src/*`. **Expo SDK 54** (pinned for public Expo Go compatibility) — see the versioned docs (AGENTS.md).

## The ownership rule (why we don't collide)

Work **only** inside the namespace `PLAN.md` assigns you:
`src/app/<feature>`, `src/components/<feature>/`, `src/store/<feature>.ts`, `src/lib/<feature>/`.

**FROZEN — integrator-only, never edit:**
`src/app/_layout.tsx`, `src/store/index.ts`, `src/components/ui/*`, `src/types/contracts.ts`.
Import shared types from `@/types/contracts`.

## Conventions

- **New screen:** add a file under `src/app/` — Expo Router picks it up automatically.
- **New store slice:** `src/store/<feature>.ts` using `persist(fn, persistOptions('<feature>'))`;
  the integrator wires it into `src/store/index.ts`.
- **New feature component:** `src/components/<feature>/<Name>.tsx`, composed from `@/components/ui`.
- **Tests** import jest globals explicitly: `import { test, expect } from '@jest/globals'`.
- **Icons:** use `Icon` from `@/components/ui` (Ionicons via `@expo/vector-icons`) — **never emoji**.
- **Writing kit:** bulk-select lists (`SelectableList`), dictation, photo attach, autosave,
  word count, export, and a pluggable `assist()` stub live in `@/components/ui` + `@/lib/writing/`.
  Compose them; don't rebuild. Dictation is web-only (native reports `supported:false`).
- **AI calls:** go through `getAIService()` from `@/lib/ai` (mock by default, real via the
  Vercel `api/ai` proxy). **Never** put an API key in an `EXPO_PUBLIC_*` var — it ships in
  the public bundle.
- **`import.meta` kills the web build.** Expo's web export emits a classic
  `<script defer>`, not `type="module"`, so ANY dependency whose ESM build uses
  `import.meta` makes the whole bundle fail to parse — silently, behind a perfect-looking
  pre-rendered page. zustand is already pinned to CJS on web in `metro.config.js`; the next
  offender is caught by `scripts/check-web.sh`, not by typecheck, lint, or a green export.

## Interaction contract (every one of these cost a round trip)

Four ideas, not a checklist. Each was learned by shipping the opposite.

1. **One field, one meaning.** A note state of `'approved'` meant both "the edit was
   applied" and "this card is open"; collapsing only handled `'expanded'`, so an applied
   note could never be closed — the only exits destroyed it or reverted the edit. If a
   field answers two questions, split it.
2. **Every action is reversible, and separate.** A save button that sets `saved: true`
   unconditionally has no way back. `save-and-close` and `applied-and-open` merged two
   controls into one and produced states you couldn't escape. Destroy, flag, and dismiss
   are three meanings — keep them three controls.
3. **Every state is visible, in words.** A 16px glyph gets misread. Anything that changes
   state gets a label or a visible background. And nothing is discoverable by guessing —
   twelve authored notes behind an invisible gesture is a feature that doesn't exist yet.
4. **Every tap goes somewhere, and somewhere named.** No dead taps: non-functional items
   render visibly inert (dimmed, no chevron, honest label), never tappable-and-empty.
   Navigate to a *destination* — `dismissTo`/`navigate` with an explicit target, never
   `router.back()`, which after two hops returns to the wrong screen. Back controls name
   where they go.

Two layout corollaries: content that grows must be kept on screen *as* it grows (not just
when it opens), and a variable-size element needs a fixed footprint or it shoves its
neighbours out of alignment.

## When your checks disagree with the user, your checks are wrong

The worst hour lost so far: the user said the dots weren't appearing; typecheck, lint, and
the deploy were all green, so three rounds went into theorising instead of opening the
browser console. The web bundle had failed to parse and React had never hydrated — the
page was pre-rendered HTML that looked perfect and did nothing.

**A green gate is evidence about the gate, not about the app.** When the user reports
something doesn't work and your checks say it does, the checks are measuring the wrong
thing. Go look at the actual surface — console, screenshot, device — before theorising.
`scripts/check-web.sh` exists because of this specific failure.

## Persisted state lies to you

Anything persisted survives your fixes. Twice, behaviour that looked like a live bug was
stale `AsyncStorage`/`localStorage`. So: any store persisting seeded or demo content
carries a `version`, bumped whenever the seed changes, with a `migrate` that resets. And
never match seeded content by exact string equality — a text field hands back curly quotes
and collapsed whitespace and silently unhooks it.

## Definition of Done (run before you say "done")

- `npm run verify` → typecheck + lint (`npm run verify -- --full` also bundles).
- Logic / data / API / types pieces: also `npm test` with a quick test of the core logic.
- UI pieces: `npm run verify` + it renders (the integrator judges feel on the sim/phone).
- After each merge to main: `scripts/wt-sync.sh <your-name>` to pull latest.

## Delivery (integrator only)

The whole day is three commands: `scripts/new-project.sh <name>` → build → **`npm run deliver`**.
`deliver.sh` does GitHub + EAS/Expo Go + Vercel with no manual steps, force-resets
`runtimeVersion` to `{"policy":"sdkVersion"}` after `eas update:configure` clobbers it, and
**asserts the published update's runtime is `exposdk:<major>.0.0`** before claiming success —
a fixed runtime publishes fine and then silently never opens in public Expo Go.
Agents never run it and never handle the accounts.

## Hard boundaries

- Never edit a frozen surface. Never touch another agent's namespace.
- **Never handle device or account credentials.** Packaging / delivery is the integrator's job only.
