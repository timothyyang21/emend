import { test, expect } from '@jest/globals';

import { createMockService } from '@/lib/ai/mock';

test('mock complete returns labeled stub text containing the last user message', async () => {
  const ai = createMockService({ delayMs: 0 });
  const out = await ai.complete({ messages: [{ role: 'user', content: 'hello there' }] });
  expect(ai.name).toBe('mock');
  expect(out).toContain('stub');
  expect(out).toContain('hello there');
});

test('mock stream emits multiple deltas that concatenate to the full text', async () => {
  const ai = createMockService({ delayMs: 0 });
  const deltas: string[] = [];
  const full = await ai.stream(
    { messages: [{ role: 'user', content: 'one two three' }] },
    (d) => deltas.push(d),
  );
  expect(deltas.length).toBeGreaterThan(1);
  expect(deltas.join('')).toBe(full);
  expect(full).toContain('one two three');
});

test('mock stream stops early when the signal is aborted', async () => {
  const ai = createMockService({ delayMs: 0 });
  const controller = new AbortController();
  controller.abort();
  const deltas: string[] = [];
  await ai.stream({ messages: [{ role: 'user', content: 'a b c d' }] }, (d) => deltas.push(d), controller.signal);
  expect(deltas).toEqual([]);
});
