import { test, expect } from '@jest/globals';

import { count } from '@/lib/writing/count';

test('empty string is all zeros', () => {
  expect(count('')).toEqual({ words: 0, chars: 0, readingMinutes: 0 });
});

test('counts words and chars, handling extra whitespace', () => {
  const m = count('  hello   world  ');
  expect(m.words).toBe(2);
  expect(m.chars).toBe('  hello   world  '.length);
  expect(m.readingMinutes).toBe(1);
});
