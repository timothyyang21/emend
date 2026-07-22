import type { ApplyDecisions, Hunk } from '@/types/contracts';

function inOrder(hunks: Hunk[]): Hunk[] {
  return [...hunks].sort((a, b) => a.start - b.start || a.end - b.end);
}

/**
 * Rebuild the document with ONLY the accepted hunks applied.
 *
 * `pending` counts as not applied. Silence is not consent: a writer who has not
 * looked at a change has not agreed to it, so an untouched hunk keeps `before`
 * exactly as a rejected one does. The two states differ in the UI, never here.
 *
 * Exactness is the whole product:
 *  - accept every hunk → byte-for-byte `revised`
 *  - reject (or ignore) every hunk → byte-for-byte `base`
 */
export const applyDecisions: ApplyDecisions = (base, hunks, decisions) => {
  const out: string[] = [];
  let cursor = 0;

  for (const hunk of inOrder(hunks)) {
    if (hunk.start < cursor || hunk.end < hunk.start || hunk.end > base.length) continue;
    out.push(base.slice(cursor, hunk.start));
    out.push(decisions[hunk.id] === 'accepted' ? hunk.after : hunk.before);
    cursor = hunk.end;
  }

  out.push(base.slice(cursor));
  return out.join('');
};
