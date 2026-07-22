# PLAN — <app name>  (fill in when the spec lands)

> Written by the integrator BEFORE fan-out. Frozen contracts + ownership so agents
> never step on each other. Every agent reads this + `CLAUDE.md` at the start of its task.
> The example rows use a "mood logger" — replace them with your app.

## Vertical slice (build this end-to-end FIRST)

**The one flow that must work:** _e.g. "Log a mood → see it in the history list → persists across reloads."_

**Ship the structure, not just the screen.** The slice includes the screens above the
working surface (item → collection → library → settings) even when only one item is real,
each with a back control that names where it goes. Building only the interesting screen
reads as a prototype; the frame is what makes it read as software.

**Cut list (explicitly NOT doing in 2h):** _e.g. auth, editing entries, charts, settings._

## Contracts (frozen)

The real contract is code: **`src/types/contracts.ts`** — integrator-owned, **frozen after fan-out**.
Every agent imports from `@/types/contracts` and never edits it.

## Ownership map (one namespace per agent — never overlap)

| Agent | Owns (folders/files)                                          | Piece / deliverable              | Port |
|-------|--------------------------------------------------------------|----------------------------------|------|
| A     | `src/app/index.tsx`, `src/components/log/`                    | Mood entry screen + components   | 8082 |
| B     | `src/store/mood.ts`, `src/lib/mood/`                          | Mood store + logic (persisted)   | 8083 |
| C     | `src/app/history.tsx`, `src/components/history/`              | History list + empty state       | 8084 |
| **—** | `src/app/_layout.tsx`, `src/store/index.ts`, `src/components/ui/*`, `src/types/contracts.ts` | **INTEGRATOR ONLY — frozen** | 8081 |
| **—** | `app.json`, `assets/` (icon, splash, accent color) | **App-shell brand — INTEGRATOR ONLY.** Real icon + app name + splash. Not a feature; owned here so it can't fall through the cracks. Gated by `npm run verify:shell`. | — |
| **—** | `src/app/` route skeleton | **Structure above the working surface — INTEGRATOR ONLY.** The screens *around* the one interesting screen: item → collection → library → settings, even when only one item is real. Every screen gets a back control that NAMES its destination. Costs little; it's the difference between software and a demo. | — |
| **—** | `src/lib/writing/`, `src/lib/selection/`, `src/components/writing/`, `src/components/ui/Icon.tsx`, `src/components/ui/SelectableList.tsx` | **Writing kit — INTEGRATOR-owned, reusable.** Bulk-select/delete, dictation (web), photo attach, autosave, word count, export, AI-assist stub. Agents CONSUME via `@/components/ui` + `@/lib/writing/*`; don't rebuild. | — |

> **Decisions become owned rows — not chat conclusions.** A name, art direction, or
> any cross-cutting deliverable decided in conversation must land as a row in this map
> with an owner, or it silently defaults (this is why the app icon stayed the Expo stock
> art on the first dress run). If it isn't feature code, ask "who owns it?" before fan-out.

## Definition of Done (per piece)

- **Testable pieces** (store / logic / data / API / types — e.g. Agent B): `npm run verify` passes **+ a quick jest test** for the core logic. Looser leash.
- **UI pieces** (e.g. Agents A, C): `npm run verify` passes (typecheck + lint + bundle) **+ renders on the ONE sim/phone** for the integrator to judge feel. Under close eye.
- Nobody edits a frozen surface. Nobody puts device/account credentials in an agent.

## Integration order (sequential merges — keep main green)

1. **Integrator:** skeleton vertical slice (nav + one screen + store wired + persistence) **+ brand the shell** — real icon (`assets/images/icon.png`), app name (`app.json`), splash color. Do it here, not in the final polish, so it's never the thing cut at minute 115. Confirm with `npm run verify:shell`. Get the core flow green FIRST. Boot the sim with `npm run go` so you follow along live from the first render.
2. **B** (store/logic) → `wt-merge` → others `wt-sync`.
3. **A** (entry screen) → `wt-merge` → others `wt-sync`.
4. **C** (history) → `wt-merge`.
5. **Integrator:** polish pass — make ONE thing feel genuinely good.

## Agent rules (every agent, every task)

1. Read this `PLAN.md` + `CLAUDE.md` first.
2. Import shared types from `@/types/contracts`. Do **not** edit contracts or any frozen surface.
3. Work **only** inside your owned namespace.
4. Run `npm run verify` before saying "done"; logic pieces add a jest test.
5. After each merge to main, run `scripts/wt-sync.sh <you>` to pull latest.
6. Never handle device/account credentials — packaging is the integrator's job.
