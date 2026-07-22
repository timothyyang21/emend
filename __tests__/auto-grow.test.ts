import { test, expect } from '@jest/globals';

import { clampHeight } from '@/lib/ui/autoGrow';

test('content shorter than the minimum clamps up to the minimum', () => {
  expect(clampHeight(20, 96, 240)).toBe(96);
});

test('content between the bounds is used as-is', () => {
  expect(clampHeight(150, 96, 240)).toBe(150);
});

test('content taller than the maximum clamps down to the maximum', () => {
  expect(clampHeight(999, 96, 240)).toBe(240);
});

test('zero, negative, and non-finite heights fall back to the minimum', () => {
  expect(clampHeight(0, 96, 240)).toBe(96);
  expect(clampHeight(-40, 96, 240)).toBe(96);
  expect(clampHeight(Number.NaN, 96, 240)).toBe(96);
});
