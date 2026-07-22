import { test, expect } from '@jest/globals';

import { useCounter } from '@/store';

test('counter increments and resets', () => {
  useCounter.getState().reset();
  useCounter.getState().inc();
  useCounter.getState().inc();
  expect(useCounter.getState().count).toBe(2);

  useCounter.getState().reset();
  expect(useCounter.getState().count).toBe(0);
});
