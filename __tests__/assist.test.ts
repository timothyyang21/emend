import { test, expect } from '@jest/globals';

import { assist, mockAssist, setAssist } from '@/lib/writing/assist';

test('mockAssist returns labeled stub text that includes the input', async () => {
  const out = await assist('hello', 'continue');
  expect(out).toContain('stub');
  expect(out).toContain('hello');
});

test('setAssist swaps the implementation, then restores', async () => {
  setAssist(async () => 'REAL');
  expect(await assist('x', 'rewrite')).toBe('REAL');
  setAssist(mockAssist);
  expect(await assist('x', 'rewrite')).toContain('stub');
});
