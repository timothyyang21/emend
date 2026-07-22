/**
 * Small text predicates the hunk builder leans on. Kept separate so the widening
 * rules are readable in one place — they are the difference between a diff a
 * writer can review and a wall of single-character noise.
 */

/**
 * What counts as "inside a word" for the purpose of widening a hunk.
 *
 * Deliberately NOT including apostrophes or hyphens: "Susan" inside "Susan's"
 * should stay a five-character hunk, not drag the possessive in with it. The
 * only thing this class has to catch is a boundary that lands mid-word, which
 * is what makes raw diff output unreadable ("rec|i|eve" → "rec|e|ive").
 */
const WORD_CHAR = /[\p{L}\p{N}_]/u;

export function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && WORD_CHAR.test(ch);
}

/** True when offset `i` in `text` sits in the middle of a word. */
export function splitsWord(text: string, i: number): boolean {
  return i > 0 && i < text.length && isWordChar(text[i - 1]) && isWordChar(text[i]);
}

function isHighSurrogate(ch: string | undefined): boolean {
  if (ch === undefined) return false;
  const code = ch.charCodeAt(0);
  return code >= 0xd800 && code <= 0xdbff;
}

function isLowSurrogate(ch: string | undefined): boolean {
  if (ch === undefined) return false;
  const code = ch.charCodeAt(0);
  return code >= 0xdc00 && code <= 0xdfff;
}

/**
 * True when offset `i` would cut an astral character (emoji, rare CJK) in half.
 *
 * Offsets in `Hunk` are JS string indices — UTF-16 code units — and
 * diff-match-patch is happy to hand back a boundary between a surrogate pair,
 * which slices into two lone surrogates and renders as replacement glyphs.
 */
export function splitsSurrogatePair(text: string, i: number): boolean {
  return i > 0 && i < text.length && isHighSurrogate(text[i - 1]) && isLowSurrogate(text[i]);
}
