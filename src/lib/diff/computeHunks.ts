import DiffMatchPatch from 'diff-match-patch';

import type { ComputeHunks, Hunk, HunkKind } from '@/types/contracts';

import { hunkId } from './id';
import { splitsSurrogatePair, splitsWord } from './text';

const DIFF_DELETE = -1;
const DIFF_INSERT = 1;
const DIFF_EQUAL = 0;

type RawDiff = [number, string];

/**
 * Two changes separated by this little untouched text are one edit, not two.
 * ", " between two rewritten clauses is punctuation, not a reviewable gap.
 */
const TRIVIAL_GAP = 2;

/**
 * Two changes separated by untouched text that contains no whitespace at all
 * are inside the same word ("rec[i]ev[e]" → "rec[e]iv[e]"). Splitting those into
 * two decisions produces a hunk nobody can read and a half-accept that produces
 * a misspelling. Capped so a long unbroken token (a URL) can't swallow the
 * document.
 */
const WITHIN_WORD_GAP = 12;

/**
 * A run of changed text, tracked in BOTH documents at once. Keeping the revised
 * offsets alongside the base offsets is what lets us widen a hunk to a word
 * boundary: the text either side of a change is identical in both, so moving the
 * base boundary N characters left means moving the revised boundary N left too.
 */
interface Group {
  /** Base offsets. */
  bs: number;
  be: number;
  /** Revised offsets. */
  rs: number;
  re: number;
  /** Length of the untouched run immediately before / after this group. */
  leftRoom: number;
  rightRoom: number;
}

function rawDiffs(base: string, revised: string): RawDiff[] {
  const dmp = new DiffMatchPatch();
  // Determinism beats speed here. The default 1s deadline makes diff_main bail
  // out to a cheaper, WORSE diff on a slow machine — which would mean the same
  // (base, revised) producing different hunks, and therefore different ids, on
  // different devices. Manuscripts are kilobytes; take the exact answer.
  dmp.Diff_Timeout = 0;

  const diffs = dmp.diff_main(base, revised) as RawDiff[];
  // The whole reason this engine is usable: without it, prose diffs come back as
  // a hail of single-character inserts and deletes.
  dmp.diff_cleanupSemantic(diffs);
  return diffs;
}

/** Walk the diff list, collapsing each run of non-equal ops into one group. */
function toGroups(diffs: RawDiff[]): Group[] {
  const groups: Group[] = [];
  let b = 0;
  let r = 0;
  let previousEqual = 0;
  let current: Group | null = null;

  for (const [op, text] of diffs) {
    if (op === DIFF_EQUAL) {
      if (current) {
        current.rightRoom = text.length;
        groups.push(current);
        current = null;
      }
      previousEqual = text.length;
      b += text.length;
      r += text.length;
      continue;
    }

    // A replacement arrives as adjacent DELETE + INSERT. Both land in the same
    // group, which is what makes accepting a rename ONE tap instead of two —
    // and what stops "reject half of it" from producing garbled prose.
    current ??= { bs: b, be: b, rs: r, re: r, leftRoom: previousEqual, rightRoom: 0 };
    if (op === DIFF_DELETE) {
      b += text.length;
      current.be = b;
    } else if (op === DIFF_INSERT) {
      r += text.length;
      current.re = r;
    }
  }

  if (current) groups.push(current);
  return groups;
}

/** Merge groups whose separating run is too small to be worth a second decision. */
function coalesce(base: string, groups: Group[]): Group[] {
  const out: Group[] = [];
  for (const group of groups) {
    const previous = out[out.length - 1];
    if (previous && shouldCoalesce(base.slice(previous.be, group.bs))) {
      previous.be = group.be;
      previous.re = group.re;
      previous.rightRoom = group.rightRoom;
      continue;
    }
    out.push({ ...group });
  }
  return out;
}

function shouldCoalesce(gap: string): boolean {
  if (gap.length === 0) return true;
  if (gap.length <= TRIVIAL_GAP && !gap.includes('\n')) return true;
  return gap.length <= WITHIN_WORD_GAP && !/\s/.test(gap);
}

/**
 * Push a group's boundaries outwards until neither one lands mid-word — in the
 * base OR in the revised text. Checking both sides matters: "the at" → "the cat"
 * is a clean boundary in the base and a mid-word one in the revision, and
 * without the second check it reviews as "insert the letter c".
 */
function widen(base: string, revised: string, group: Group): Group {
  let { bs, be, rs, re, leftRoom, rightRoom } = group;

  while (leftRoom > 0 && (splitsWord(base, bs) || splitsWord(revised, rs))) {
    bs -= 1;
    rs -= 1;
    leftRoom -= 1;
  }
  while (rightRoom > 0 && (splitsWord(base, be) || splitsWord(revised, re))) {
    be += 1;
    re += 1;
    rightRoom -= 1;
  }

  // Never leave a boundary inside a surrogate pair, even if that costs us the
  // last character of room; an overlap here is repaired by the merge pass.
  while (splitsSurrogatePair(base, bs) || splitsSurrogatePair(revised, rs)) {
    bs -= 1;
    rs -= 1;
  }
  while (splitsSurrogatePair(base, be) || splitsSurrogatePair(revised, re)) {
    be += 1;
    re += 1;
  }

  return { bs, be, rs, re, leftRoom, rightRoom };
}

/** Widening can make neighbours touch. Hunks must never overlap. */
function mergeTouching(groups: Group[]): Group[] {
  const out: Group[] = [];
  for (const group of groups) {
    const previous = out[out.length - 1];
    if (previous && group.bs <= previous.be) {
      previous.be = Math.max(previous.be, group.be);
      previous.re = Math.max(previous.re, group.re);
      previous.rightRoom = group.rightRoom;
      continue;
    }
    out.push({ ...group });
  }
  return out;
}

function kindOf(before: string, after: string): HunkKind {
  if (before.length === 0) return 'insert';
  if (after.length === 0) return 'delete';
  return 'replace';
}

/**
 * Diff two markdown documents into reviewable hunks.
 *
 * Guarantees, all of which `applyDecisions` and the renderer depend on:
 *  - sorted by `start`, and never overlapping
 *  - `before === base.slice(start, end)` for every hunk
 *  - a substitution is ONE hunk (`kind: 'replace'`), never a delete beside an insert
 *  - ids are a pure function of offset + content, so a writer's decision stays
 *    attached to the change they made it about
 */
export const computeHunks: ComputeHunks = (base, revised) => {
  if (base === revised) return [];

  const groups = mergeTouching(
    coalesce(base, toGroups(rawDiffs(base, revised))).map((group) => widen(base, revised, group))
  );

  const taken = new Set<string>();
  const hunks: Hunk[] = [];

  for (const { bs, be, rs, re } of groups) {
    const before = base.slice(bs, be);
    const after = revised.slice(rs, re);
    // Widening can, in principle, absorb a change into identical context.
    if (before === after) continue;
    hunks.push({
      id: hunkId(bs, be, before, after, taken),
      kind: kindOf(before, after),
      start: bs,
      end: be,
      before,
      after,
    });
  }

  return hunks;
};
