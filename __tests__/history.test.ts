import { expect, test } from '@jest/globals';

import { describeEdit, lastEdit, relativeTime, restorable, restoreLabel } from '@/lib/session/history';
import type { DocumentVersion } from '@/types/contracts';

const NOW = 1_700_000_000_000;

function v(version: number, label: string | undefined, ageMs = 0): DocumentVersion {
  return { version, markdown: `text at v${version}`, createdAt: NOW - ageMs, label };
}

test('entries are newest first regardless of what the server sent', () => {
  expect(restorable([v(1, 'a'), v(3, 'c'), v(2, 'b')]).map((x) => x.version)).toEqual([3, 2, 1]);
});

test('undo targets the most recent edit, and names the edit it reverses', () => {
  // Each stack entry holds the text as it was BEFORE the labelled edit, so the
  // control has to read "Undo <that instruction>" — not "restore version 2",
  // which tells the writer nothing about their manuscript.
  const target = lastEdit([v(1, 'change Susan to Janet'), v(2, 'make the opening more ominous')]);
  expect(target?.version).toBe(2);
  expect(describeEdit(target!, NOW)).toBe('make the opening more ominous');
});

test('nothing to undo is null, not a fake entry', () => {
  expect(lastEdit([])).toBeNull();
});

test('an unlabelled edit still says what tapping it does', () => {
  // Typed edits carry no instruction. "Undo the edit from 5 minutes ago" beats a
  // blank control the writer has to guess at.
  expect(describeEdit(v(2, undefined, 5 * 60_000), NOW)).toBe('the edit from 5 minutes ago');
  expect(describeEdit(v(2, '   ', 5 * 60_000), NOW)).toBe('the edit from 5 minutes ago');
});

test('restoring is saved under a label that reads correctly when undone again', () => {
  expect(restoreLabel(v(2, 'make it ominous'), NOW)).toBe('Undo make it ominous');
});

test('relative time is coarse and human', () => {
  expect(relativeTime(NOW, NOW)).toBe('just now');
  expect(relativeTime(NOW - 30_000, NOW)).toBe('just now');
  expect(relativeTime(NOW - 5 * 60_000, NOW)).toBe('5 minutes ago');
  expect(relativeTime(NOW - 60 * 60_000, NOW)).toBe('1 hour ago');
  expect(relativeTime(NOW - 26 * 3_600_000, NOW)).toBe('1 day ago');
  // A clock skew that puts a version in the future must not print "-3 minutes ago".
  expect(relativeTime(NOW + 60_000, NOW)).toBe('just now');
});

// --- the frame around the one real chapter ----------------------------------

test('exactly one chapter is real, and it is the one the editor names', () => {
  const { CHAPTERS, CURRENT_CHAPTER_ID, currentChapter, chapterLabel } =
    require('@/lib/session/chapters') as typeof import('@/lib/session/chapters');

  const available = CHAPTERS.filter((c) => c.available);
  expect(available).toHaveLength(1);
  expect(available[0].id).toBe(CURRENT_CHAPTER_ID);
  // The header says "Chapter 4"; the chapter list must agree, or the breadcrumb
  // is lying about where the writer is.
  expect(chapterLabel(currentChapter)).toBe('Chapter 4');
});
