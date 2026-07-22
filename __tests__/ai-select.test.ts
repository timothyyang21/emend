import { test, expect, afterEach, jest } from '@jest/globals';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));

import { getAIService, withMockFallback } from '@/lib/ai';
import { AIService } from '@/lib/ai/types';

const ENV = 'EXPO_PUBLIC_AI_ENDPOINT';

afterEach(() => {
  delete process.env[ENV];
});

test('getAIService returns the mock when no endpoint is configured', () => {
  delete process.env[ENV];
  expect(getAIService().name).toBe('mock');
});

test('getAIService returns the proxy when an endpoint is configured', () => {
  process.env[ENV] = 'https://example.com/api/ai';
  expect(getAIService().name).toBe('proxy');
});

test('withMockFallback returns mock output when the primary throws', async () => {
  const broken: AIService = {
    name: 'broken',
    complete: async () => {
      throw new Error('network down');
    },
    stream: async () => {
      throw new Error('network down');
    },
  };
  const errors: unknown[] = [];
  const service = withMockFallback(broken, (e) => errors.push(e));

  const out = await service.complete({ messages: [{ role: 'user', content: 'hi there' }] });
  expect(out).toContain('stub');
  expect(out).toContain('hi there');
  expect(errors).toHaveLength(1);

  const deltas: string[] = [];
  const full = await service.stream({ messages: [{ role: 'user', content: 'a b' }] }, (d) => deltas.push(d));
  expect(deltas.join('')).toBe(full);
  expect(errors).toHaveLength(2);
});
