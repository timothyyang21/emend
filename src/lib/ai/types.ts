export type AIRole = 'user' | 'assistant';

export interface AIMessage {
  role: AIRole;
  content: string;
}

export interface AIRequest {
  messages: AIMessage[];
  system?: string;
  maxTokens?: number;
}

/** A provider-neutral text service. `stream` also returns the full accumulated text. */
export interface AIService {
  readonly name: string;
  complete(req: AIRequest): Promise<string>;
  stream(req: AIRequest, onDelta: (text: string) => void, signal?: AbortSignal): Promise<string>;
}

export class AIError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'AIError';
    this.status = status;
  }
}

/** The last user message — what every adapter echoes or completes. */
export function lastUserMessage(req: AIRequest): string {
  for (let i = req.messages.length - 1; i >= 0; i--) {
    if (req.messages[i].role === 'user') return req.messages[i].content;
  }
  return '';
}
