import { test, expect, jest, beforeEach, afterEach } from '@jest/globals';

import { createAutosaver } from '@/lib/writing/autosave';

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

test('debounces and saves only the last scheduled value', () => {
  const saved: string[] = [];
  const a = createAutosaver<string>((v) => saved.push(v), 500);
  a.schedule('a');
  a.schedule('ab');
  a.schedule('abc');
  expect(saved).toEqual([]);
  jest.advanceTimersByTime(500);
  expect(saved).toEqual(['abc']);
});

test('flush saves the pending value immediately', () => {
  const saved: string[] = [];
  const a = createAutosaver<string>((v) => saved.push(v), 500);
  a.schedule('x');
  a.flush();
  expect(saved).toEqual(['x']);
});

test('cancel aborts pending save and flush does nothing', () => {
  const saved: string[] = [];
  const a = createAutosaver<string>((v) => saved.push(v), 500);
  a.schedule('x');
  a.cancel();
  a.flush();
  jest.advanceTimersByTime(500);
  expect(saved).toEqual([]);
});
