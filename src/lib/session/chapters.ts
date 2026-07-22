/**
 * The manuscript around the one chapter that is real.
 *
 * Emend edits a single document, but a writer does not experience their book as
 * a single document — so the app shows the frame it sits in. Only Chapter 4 is
 * backed by anything; the rest exist to say "this is chapter four OF something",
 * and they render visibly inert rather than tappable-and-empty.
 *
 * If chapters ever become real, this list is the seam: it becomes the index and
 * `CURRENT_CHAPTER_ID` becomes the routing parameter.
 */
export interface Chapter {
  id: string;
  number: number;
  title: string;
  /** False chapters are dimmed, unlabelled with a chevron, and not pressable. */
  available: boolean;
}

export const CURRENT_CHAPTER_ID = 'ch-4';

export const CHAPTERS: Chapter[] = [
  { id: 'ch-1', number: 1, title: 'The House on Vine', available: false },
  { id: 'ch-2', number: 2, title: 'What the Neighbours Saw', available: false },
  { id: 'ch-3', number: 3, title: 'Maple and Vine', available: false },
  { id: 'ch-4', number: 4, title: 'The Forest Behind the House', available: true },
  { id: 'ch-5', number: 5, title: 'A Net and a Mason Jar', available: false },
];

export const currentChapter: Chapter =
  CHAPTERS.find((c) => c.id === CURRENT_CHAPTER_ID) ?? CHAPTERS[0];

/** "Chapter 4" — the short form for chrome. */
export function chapterLabel(chapter: Chapter): string {
  return `Chapter ${chapter.number}`;
}
