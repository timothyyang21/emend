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
    if (hunk.start < cursor || hunk.end < hunk.start || hunk.end > base.length) {
      // Skipping keeps a malformed hunk list from corrupting a manuscript, but a
      // silent skip would mean a change the writer accepted just not happening,
      // with nothing on screen to say so. Defensive AND loud.
      if (__DEV__) {
        console.warn(
          `[diff] skipped malformed hunk ${hunk.id} (${hunk.start}–${hunk.end}, base length ${base.length})`
        );
      }
      continue;
    }
    out.push(base.slice(cursor, hunk.start));
    // For anything not accepted, take the text from `base` rather than from
    // `hunk.before`. They are equal whenever the contract holds — and if they
    // ever disagree, `base` is the writer's actual manuscript and `before` is a
    // stale copy of it.
    out.push(decisions[hunk.id] === 'accepted' ? hunk.after : base.slice(hunk.start, hunk.end));
    cursor = hunk.end;
  }

  out.push(base.slice(cursor));
  return out.join('');
};
