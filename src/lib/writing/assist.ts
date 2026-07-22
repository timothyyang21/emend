import { createMockService, getAIService } from '@/lib/ai';
import type { AIService } from '@/lib/ai';

export type AssistAction = 'continue' | 'rewrite' | 'shorten';
export type AssistFn = (text: string, action: AssistAction) => Promise<string>;

const SYSTEM: Record<AssistAction, string> = {
  continue: 'You are a writing assistant. Continue the text naturally in the same voice. Return only the continuation.',
  rewrite: 'You are a writing assistant. Rewrite the text more clearly, keeping its meaning and voice. Return only the rewrite.',
  shorten: 'You are a writing assistant. Make the text shorter without losing meaning. Return only the shortened text.',
};

const via =
  (service: AIService): AssistFn =>
  (text, action) =>
    service.complete({ messages: [{ role: 'user', content: text }], system: SYSTEM[action], maxTokens: 1024 });

/** The zero-setup stub — used when no AI endpoint is configured, and by tests. */
export const mockAssist: AssistFn = (text, action) => via(createMockService({ delayMs: 0 }))(text, action);

let current: AssistFn | null = null;

/** Swap in a real implementation day-of. */
export function setAssist(fn: AssistFn): void {
  current = fn;
}

export const assist: AssistFn = (text, action) => (current ?? via(getAIService()))(text, action);
