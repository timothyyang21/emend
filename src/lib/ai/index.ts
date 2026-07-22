import { createMockService } from './mock';
import { createProxyService } from './proxy';
import { AIService } from './types';

export { AIError } from './types';
export type { AIMessage, AIRequest, AIRole, AIService } from './types';
export { createMockService } from './mock';
export { createProxyService } from './proxy';

/** Never let an AI outage break the UI — fall back to the mock and report it. */
export function withMockFallback(primary: AIService, onError?: (e: unknown) => void): AIService {
  const mock = createMockService();
  let fellBack = false;
  return {
    get name() {
      return fellBack ? `${primary.name}(mock-fallback)` : primary.name;
    },
    async complete(req) {
      try {
        return await primary.complete(req);
      } catch (e) {
        onError?.(e);
        fellBack = true;
        return mock.complete(req);
      }
    },
    async stream(req, onDelta, signal) {
      let emittedAny = false;
      try {
        return await primary.stream(
          req,
          (chunk) => {
            emittedAny = true;
            onDelta(chunk);
          },
          signal
        );
      } catch (e) {
        if (emittedAny) throw e;
        onError?.(e);
        fellBack = true;
        return mock.stream(req, onDelta, signal);
      }
    },
  };
}

/**
 * Pick the service for this build. EXPO_PUBLIC_AI_ENDPOINT is a URL (safe to be
 * public); the API key lives in the serverless function behind it, never here.
 * Read at call time so it is testable.
 */
export function getAIService(): AIService {
  const endpoint = process.env.EXPO_PUBLIC_AI_ENDPOINT;
  if (!endpoint) return createMockService();
  return withMockFallback(createProxyService(endpoint), (e) => {
    console.warn('[ai] proxy failed, falling back to mock:', e);
  });
}
