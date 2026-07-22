import { requestEdit } from '@/lib/api';
import { computeHunks } from '@/lib/diff';
import type { EditProposal } from '@/types/contracts';

/**
 * The spine of the product, in one function.
 *
 *   spoken instruction + current manuscript
 *     → the model returns the WHOLE revised document
 *     → we diff it ourselves, client-side
 *     → the writer gets a reviewable proposal
 *
 * Diffing client-side rather than asking the model for structured edit
 * operations is the central architectural bet: it makes a mechanical edit
 * ("replace Susan with Janet") and a semantic one ("make the opening more
 * ominous") the same code path, and it lets the model resolve ambiguity in prose
 * instead of us trying to encode it as offsets.
 */

export class EditFailed extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EditFailed';
  }
}

/**
 * Make the revision's trailing newline match the base's.
 *
 * Found by running a real model edit rather than a hand-written one: asked to
 * rename a character, the model returned the document correctly changed but with
 * the final newline dropped. That diffs into a third hunk — "delete a line
 * break" — sitting underneath the two real ones.
 *
 * It is not a change the writer asked for, they cannot evaluate it, and it
 * teaches them that the review list contains junk. Trailing whitespace is not
 * prose, so it is normalised away before the diff ever sees it.
 */
export function matchTrailingNewline(base: string, revised: string): string {
  const baseTail = /\n*$/.exec(base)?.[0] ?? '';
  return revised.replace(/\n*$/, baseTail);
}

let counter = 0;

export async function runEdit(
  markdown: string,
  instruction: string,
  options: { dictionary?: string[]; signal?: AbortSignal } = {}
): Promise<EditProposal> {
  const trimmed = instruction.trim();
  if (!trimmed) throw new EditFailed("I didn't catch an instruction.");

  let raw: string;
  try {
    raw = await requestEdit(
      { markdown, instruction: trimmed, dictionary: options.dictionary },
      options.signal
    );
  } catch (e) {
    throw new EditFailed(e instanceof Error ? e.message : 'The edit could not be made.');
  }

  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new EditFailed('The model returned an empty document, so nothing was changed.');
  }

  const revisedMarkdown = matchTrailingNewline(markdown, raw);
  const hunks = computeHunks(markdown, revisedMarkdown);

  // A no-op is a legitimate outcome, not an error — "make it more ominous" can
  // reasonably leave a document alone. The caller reports it in words rather
  // than opening an empty review with nothing to decide.
  return {
    id: `proposal-${++counter}`,
    instruction: trimmed,
    baseMarkdown: markdown,
    revisedMarkdown,
    hunks,
    createdAt: Date.now(),
  };
}
