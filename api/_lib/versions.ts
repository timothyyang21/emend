// Version-stack mechanics. PURE — no I/O, no imports beyond types, so it is
// covered by __tests__/server-logic.test.ts (api/ is excluded from tsconfig, so
// jest is the only safety net these handlers get).

import type { DocumentVersion } from '../../src/types/contracts';

/**
 * How many past versions we keep. The stack exists to make undo cheap, not to be
 * an archive — an unbounded array in a serverless function is a memory leak with
 * a nice name.
 */
export const MAX_VERSIONS = 50;

/**
 * Push the PREVIOUS state onto the stack and return the new stack, newest first,
 * capped. Pure: never mutates the input.
 *
 * Every accepted write calls this with the state it is replacing — that honesty
 * is the whole value of the stack. If a write skips it, undo silently lies.
 */
export function pushVersion(
  stack: readonly DocumentVersion[],
  entry: DocumentVersion,
  cap: number = MAX_VERSIONS
): DocumentVersion[] {
  const next = [entry, ...stack];
  return cap > 0 ? next.slice(0, cap) : [];
}

/**
 * Defensive read ordering. The stack is *written* newest-first, but a file left
 * over from an older shape (or hand-edited during dev) must not be trusted to be
 * sorted — the client renders this list directly.
 */
export function newestFirst(stack: readonly DocumentVersion[]): DocumentVersion[] {
  return [...stack].sort((a, b) => b.version - a.version);
}

/** Drop anything that is not a well-formed entry, so one bad record can't 500 a read. */
export function sanitizeStack(raw: unknown): DocumentVersion[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is DocumentVersion => {
    if (!v || typeof v !== 'object') return false;
    const e = v as Partial<DocumentVersion>;
    return (
      typeof e.version === 'number' &&
      Number.isFinite(e.version) &&
      typeof e.markdown === 'string' &&
      typeof e.createdAt === 'number' &&
      (e.label === undefined || typeof e.label === 'string')
    );
  });
}
