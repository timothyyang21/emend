// Hardening for the model's output. PURE — no I/O, no imports, so it is covered
// by __tests__/server-logic.test.ts.
//
// WHY THIS FILE EXISTS: whatever comes back from /api/edit is fed straight into
// the diff engine and presented to the writer as a proposed rewrite of their
// manuscript. Junk here does not look like a bug — it looks like the product
// confidently suggesting you delete your book. Everything below is a guard
// against that.

/**
 * Language tags we accept on a wrapper fence. Deliberately narrow: a response
 * that opens with ```js is a real code block, not a wrapper, and must survive
 * untouched. Models that ignore "no code fences" reach for ``` or ```markdown.
 */
const WRAPPER_TAGS = new Set(['', 'markdown', 'md', 'mkd', 'text', 'plaintext', 'plain']);

const FENCE_OPEN = /^\s{0,3}(?:```|~~~)([A-Za-z0-9_+-]*)\s*$/;
const FENCE_CLOSE = /^\s{0,3}(?:```|~~~)\s*$/;

/**
 * Strip a code fence that wraps the WHOLE response, with or without a language
 * tag. Leaves a document that legitimately contains fenced code blocks alone.
 *
 * The unwrap needs the first non-blank line to open a fence with an allowed
 * wrapper tag and the last non-blank line to close one. What we demand of the
 * lines in between depends on how much evidence the tag gave us:
 *
 *  - ```markdown (an explicit "this is the wrapper" tag): inner fences are fine
 *    as long as they are balanced, so a document containing code blocks unwraps.
 *  - ``` with no tag: we require NO fence lines inside at all. A bare fence that
 *    also has code blocks under it is genuinely ambiguous — it reads equally well
 *    as a document whose first and last blocks happen to be code — and eating the
 *    writer's real fences is worse than leaving one stray wrapper in the diff,
 *    which they can see and reject.
 */
export function stripCodeFence(raw: string): string {
  const text = raw.replace(/^﻿/, '');
  const lines = text.split('\n');

  let first = 0;
  while (first < lines.length && lines[first].trim() === '') first += 1;
  let last = lines.length - 1;
  while (last >= 0 && lines[last].trim() === '') last -= 1;
  if (last - first < 1) return text.trim();

  const open = FENCE_OPEN.exec(lines[first]);
  if (!open) return text.trim();
  const tag = open[1].toLowerCase();
  if (!WRAPPER_TAGS.has(tag)) return text.trim();
  if (!FENCE_CLOSE.test(lines[last])) return text.trim();

  const inner = lines.slice(first + 1, last);
  const innerFences = inner.filter((l) => FENCE_OPEN.test(l) || FENCE_CLOSE.test(l)).length;
  if (tag === '' ? innerFences > 0 : innerFences % 2 !== 0) return text.trim();

  return inner.join('\n').trim();
}

/**
 * Instructions that legitimately make the document much shorter. If the writer
 * asked for a cut, a 60% shrink is the feature working, not a bad generation.
 */
const SHRINKING_INSTRUCTION =
  /\b(delet|remov|cut|drop|strip|trim|shorten|shorter|condens|compress|summari[sz]|truncat|tighten|abridg|excis|omit|erase|brief)\w*\b/i;

/** Below this fraction of the original length we assume the model lost the document. */
export const MIN_LENGTH_RATIO = 0.4;

export type RevisionCheck =
  | { ok: true; markdown: string }
  | { ok: false; reason: string };

/**
 * The junk guard. Returns the cleaned markdown, or a reason to reject with 502.
 *
 * Rejecting is strictly better than passing junk through: a 502 says "that didn't
 * work, try again" while a truncated response says "here is your manuscript, now
 * three sentences long — accept?".
 */
export function checkRevision(args: {
  original: string;
  revised: string;
  instruction: string;
}): RevisionCheck {
  // Fence-stripping trims the whole reply, which would eat the document's final
  // newline and surface as a phantom hunk — an invisible change the writer is
  // asked to approve. Restore the original's trailing-newline convention.
  let markdown = stripCodeFence(args.revised ?? '');
  if (markdown.length > 0 && args.original.endsWith('\n') && !markdown.endsWith('\n')) {
    markdown += '\n';
  }

  if (markdown.trim().length === 0) {
    return { ok: false, reason: 'model returned an empty document' };
  }

  const originalLen = args.original.trim().length;
  if (originalLen === 0) return { ok: true, markdown };

  const ratio = markdown.trim().length / originalLen;
  if (ratio < MIN_LENGTH_RATIO && !SHRINKING_INSTRUCTION.test(args.instruction ?? '')) {
    return {
      ok: false,
      reason:
        `model returned ${markdown.trim().length} chars for a ${originalLen}-char document ` +
        `(${Math.round(ratio * 100)}%, floor ${Math.round(MIN_LENGTH_RATIO * 100)}%) ` +
        `and the instruction was not a deletion`,
    };
  }

  return { ok: true, markdown };
}
