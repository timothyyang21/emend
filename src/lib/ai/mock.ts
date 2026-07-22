import { AIRequest, AIService, lastUserMessage } from './types';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Zero-setup fake so the streaming UI is demoable with no key and no network. */
export function createMockService(opts?: { delayMs?: number }): AIService {
  const delayMs = opts?.delayMs ?? 15;
  const text = (req: AIRequest) => `[mock stub] ${lastUserMessage(req)}`.trim();

  return {
    name: 'mock',
    async complete(req) {
      return text(req);
    },
    async stream(req, onDelta, signal) {
      const full = text(req);
      const words = full.split(' ');
      let emitted = '';
      for (const word of words) {
        if (signal?.aborted) return emitted;
        if (delayMs > 0) await wait(delayMs);
        const chunk = emitted ? ` ${word}` : word;
        emitted += chunk;
        onDelta(chunk);
      }
      return emitted;
    },
  };
}
