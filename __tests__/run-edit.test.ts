import { expect, test } from '@jest/globals';

import { SAMPLE_MARKDOWN } from '@/lib/api/sample';
import { computeHunks } from '@/lib/diff';
import { matchTrailingNewline } from '@/lib/session/runEdit';

test('a dropped trailing newline does not become a reviewable change', () => {
  // Exactly what claude-sonnet-4.5 returned for "change Susan's name to Janet
  // everywhere": the rename correct, the final newline gone.
  const modelOutput = SAMPLE_MARKDOWN.replaceAll('Susan', 'Janet').replace(/\n$/, '');

  expect(computeHunks(SAMPLE_MARKDOWN, modelOutput)).toHaveLength(3); // 2 real + 1 phantom

  const normalised = matchTrailingNewline(SAMPLE_MARKDOWN, modelOutput);
  const hunks = computeHunks(SAMPLE_MARKDOWN, normalised);
  expect(hunks).toHaveLength(2);
  expect(hunks.every((h) => h.before === 'Susan' && h.after === 'Janet')).toBe(true);
});

test('an added trailing newline is normalised away too', () => {
  const base = 'one line, no newline';
  expect(matchTrailingNewline(base, `${base}\n\n`)).toBe(base);
});

test('normalising never touches anything but the trailing newlines', () => {
  const base = 'a\n\nb\n';
  expect(matchTrailingNewline(base, 'a\n\nB')).toBe('a\n\nB\n');
  // Interior blank lines are prose structure, not trailing whitespace.
  expect(matchTrailingNewline(base, 'a\n\n\nb\n')).toBe('a\n\n\nb\n');
});

test('the seed is James’s passage verbatim, not a paraphrase', () => {
  // Guards against a well-meaning "cleanup" of the sample the demo is judged on.
  expect(SAMPLE_MARKDOWN).toContain("Thomas's kingdom");
  expect(SAMPLE_MARKDOWN).toContain('They were too full of her son.');
  // The hyphens are the author's. A model normalising them to em dashes is a
  // change nobody asked for; keeping them here is what makes that detectable.
  expect(SAMPLE_MARKDOWN).toContain("saw Thomas-no, she still couldn't bring herself to call him that-dashing");
  expect(SAMPLE_MARKDOWN.split('\n\n')).toHaveLength(3);
});
