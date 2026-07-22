# PLAN — Emend

> Frozen contracts + ownership so agents never step on each other.
> Every agent reads this + `CLAUDE.md` at the start of its task.

## The product (do not relitigate)

Emend is a **trust surface for editing prose by voice**. The loop:

```
speak an instruction → LLM returns the FULL revised markdown → diff it against
what the writer had → they accept or reject each change → autosave
```

**Nothing the AI writes reaches the manuscript unreviewed.** The reviewable diff
IS the product; the editor and sync are scaffolding around it.

## Vertical slice (build this end-to-end FIRST)

**The one flow that must work:** open with the sample manuscript → tap the mic and say
"change Susan's name to Janet everywhere" → see the proposed change highlighted inline →
accept it → the document updates and autosaves.

**Cut list (explicitly NOT doing):** auth, multiple documents, collaboration, hands-free
("always listening"), offline queueing, streaming the edit response.

**Extra credit, in this order, ONLY after the slice is clean:** undo/history off the
version stack → dictionary (proper-noun list injected into the edit prompt).

## Contracts (FROZEN)

**`src/types/contracts.ts`** — integrator-owned, **frozen as of fan-out**. Every agent
imports from `@/types/contracts` and never edits it. If you believe a contract is wrong,
STOP and tell the integrator; do not work around it.

Key decisions already encoded there:

- **Markdown is the source of truth**, not HTML. The diff must be legible to a human
  deciding what happens to their prose; an HTML diff is tag noise.
- **`Hunk` and `HunkDecision` are separate.** A hunk is what the AI proposed; a decision
  is what the writer said about it. One field must not answer two questions.
- **`pending` counts as NOT applied.** Silence is not consent.

## Ownership map (one namespace per agent — never overlap)

| Agent | Owns (folders/files) | Piece / deliverable |
|-------|----------------------|---------------------|
| **A** | `src/lib/diff/`, `__tests__/diff*.test.ts` | Diff engine: `computeHunks`, `layoutDiff`, `applyDecisions` + tests. Pure functions, zero UI. |
| **B** | `api/document.ts`, `api/versions.ts`, `api/edit.ts`, `api/_lib/` | Server endpoints + version stack. Pure backend. |
| **C** | `src/store/doc.ts`, `src/lib/doc/`, `src/components/editor/` | Doc store + debounced autosave + webview rich-text editor. |
| **—** | `src/types/contracts.ts`, `src/app/*`, `src/store/index.ts`, `src/components/ui/*`, `src/lib/voice/`, `src/lib/api/`, `src/components/diff/`, `scripts/*`, `api/transcribe.ts` | **INTEGRATOR ONLY — frozen to agents.** |
| **—** | `app.json`, `assets/`, `docs/icons/`, `README.md` | **App-shell brand — INTEGRATOR ONLY.** Icon + name shipped; gated by `npm run verify:shell`. |

**`src/lib/api/` is written and merged already** — Agent C imports it directly and is NOT
blocked on Agent B. B owns only the server side of those endpoints.

## Definition of Done (per piece)

- **A and B** (logic / server): `npm run verify` **+ jest tests for the core logic**. A's
  engine is the highest-value thing in the build — test the traps, not the happy path.
- **C** (UI + store): `npm run verify` **+ it renders on the sim/phone** for the integrator
  to judge feel.
- Nobody edits a frozen surface. Nobody touches another agent's namespace.
- Nobody handles device or account credentials.

## Integration order (sequential merges — keep main green)

1. **Integrator:** contracts frozen, `@/lib/api` client, voice proven on device. ✅ done
2. **A** (diff engine) → `wt-merge` → others `wt-sync`. First, because the screen needs it.
3. **B** (server) → `wt-merge` → others `wt-sync`.
4. **C** (editor + store) → `wt-merge`.
5. **Integrator:** wire the slice end to end, then the polish pass (`src/theme/emend.ts`
   is recorded and waiting — see the recipe at the bottom of that file).

## Agent rules (every agent, every task)

1. Read this `PLAN.md` + `CLAUDE.md` first.
2. Import shared types from `@/types/contracts`. Do **not** edit contracts or any frozen surface.
3. Work **only** inside your owned namespace.
4. Run `npm run verify` before saying "done"; A and B add jest tests.
5. If a contract blocks you, STOP and report — do not invent a workaround.
