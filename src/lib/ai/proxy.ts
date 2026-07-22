// `expo/fetch` is used instead of the global fetch because React Native's global
// fetch cannot stream response bodies on native. It ships with Expo SDK 54.
import { fetch as expoFetch } from 'expo/fetch';

import { AIError, AIRequest, AIService } from './types';

const MAX_TOKENS = 4096;

function body(req: AIRequest, stream: boolean) {
  return JSON.stringify({
    messages: req.messages,
    system: req.system,
    maxTokens: Math.min(req.maxTokens ?? MAX_TOKENS, MAX_TOKENS),
    stream,
  });
}

/** Talks to our own /api/ai function. The API key lives there, never here. */
export function createProxyService(endpoint: string): AIService {
  return {
    name: 'proxy',

    async complete(req) {
      const res = await expoFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body(req, false),
      });
      if (!res.ok) throw new AIError(`AI proxy returned ${res.status}`, res.status);
      let json: { text?: string };
      try {
        json = (await res.json()) as { text?: string };
      } catch {
        throw new AIError('AI proxy returned a malformed response body');
      }
      if (typeof json.text !== 'string') throw new AIError('AI proxy returned no text');
      return json.text;
    },

    async stream(req, onDelta, signal) {
      const res = await expoFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body(req, true),
        signal,
      });
      if (!res.ok) throw new AIError(`AI proxy returned ${res.status}`, res.status);
      if (!res.body) throw new AIError('AI proxy returned no stream body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (!chunk) continue;
        full += chunk;
        onDelta(chunk);
      }
      const tail = decoder.decode();
      if (tail) {
        full += tail;
        onDelta(tail);
      }
      return full;
    },
  };
}
