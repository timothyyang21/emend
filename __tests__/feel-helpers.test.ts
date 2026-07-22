import { test, expect } from '@jest/globals';

import { staggerDelay } from '@/lib/motion/stagger';
import { shouldDelete } from '@/lib/ui/swipe';

test('staggerDelay: first item has no delay', () => {
  expect(staggerDelay(0, 50)).toBe(0);
});

test('staggerDelay: nth item scales by step', () => {
  expect(staggerDelay(3, 50)).toBe(150);
});

test('staggerDelay: long lists are capped so they do not crawl', () => {
  expect(staggerDelay(100, 50)).toBe(300);
  expect(staggerDelay(100, 50, 500)).toBe(500);
});

test('staggerDelay: negative or non-finite index has no delay', () => {
  expect(staggerDelay(-2, 50)).toBe(0);
  expect(staggerDelay(Number.NaN, 50)).toBe(0);
});

test('shouldDelete: a left swipe past the threshold deletes', () => {
  expect(shouldDelete(-100, 80)).toBe(true);
});

test('shouldDelete: a left swipe short of the threshold does not', () => {
  expect(shouldDelete(-50, 80)).toBe(false);
});

test('shouldDelete: a right swipe never deletes', () => {
  expect(shouldDelete(120, 80)).toBe(false);
});

test('shouldDelete: non-finite translation never deletes', () => {
  expect(shouldDelete(Number.NaN, 80)).toBe(false);
});
