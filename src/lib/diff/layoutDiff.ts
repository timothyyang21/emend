import type { DiffSegment, Hunk, LayoutDiff } from '@/types/contracts';

/** Defensive: the contract says sorted and non-overlapping, but don't trust it. */
function inOrder(hunks: Hunk[]): Hunk[] {
  return [...hunks].sort((a, b) => a.start - b.start || a.end - b.end);
}

/**
 * Slice `base` into untouched runs and reviewable hunks, in document order.
 *
 * Invariant the renderer relies on: concatenating every `equal` segment's text
 * and every hunk's `before` reproduces `base` exactly. That is what makes the
 * diff view a view OF the manuscript rather than a separate document that has to
 * be kept in sync with it.
 *
 * Empty equal runs are dropped — a zero-length text node is a rendering artefact,
 * not a segment of prose.
 */
export const layoutDiff: LayoutDiff = (base, hunks) => {
  const segments: DiffSegment[] = [];
  let cursor = 0;

  for (const hunk of inOrder(hunks)) {
    // An overlapping hunk would double-count base text and break the invariant
    // above. Drop it rather than emit a layout that doesn't reassemble.
    if (hunk.start < cursor || hunk.end < hunk.start || hunk.end > base.length) continue;
    if (hunk.start > cursor) segments.push({ kind: 'equal', text: base.slice(cursor, hunk.start) });
    segments.push({ kind: 'hunk', hunk });
    cursor = hunk.end;
  }

  if (cursor < base.length) segments.push({ kind: 'equal', text: base.slice(cursor) });
  return segments;
};
