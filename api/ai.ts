// Vercel serverless function. The Anthropic API key lives HERE (server-side env
// var ANTHROPIC_API_KEY) and is never shipped in the app bundle.
// Excluded from the app typecheck (see tsconfig "exclude"); Vercel transpiles this
// file but does NOT typecheck it, and it is not covered by `npm run verify` — so
// changes here need extra care and manual review.
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-opus-4-8';
const MAX_TOKENS = 4096;
const MAX_MESSAGES = 50;
const MAX_CONTENT_CHARS = 100_000;

// Minimal structural types so this needs no @vercel/node dependency.
type Req = {
  method?: string;
  body?: unknown;
};
type Res = {
  status: (code: number) => Res;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => void;
  write: (chunk: string) => void;
  end: () => void;
  headersSent?: boolean;
};

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

export default async function handler(req: Req, res: Res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }

  let raw: unknown;
  try {
    raw = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ error: 'invalid JSON body' });
    return;
  }
  const { messages, system, maxTokens, stream } = (raw ?? {}) as {
    messages?: { role: 'user' | 'assistant'; content: string }[];
    system?: string;
    maxTokens?: number;
    stream?: boolean;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages required' });
    return;
  }

  const shapeValid = messages.every(
    (m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
  );
  if (!shapeValid) {
    res.status(400).json({ error: 'invalid messages' });
    return;
  }

  if (messages.length > MAX_MESSAGES) {
    res.status(413).json({ error: 'request too large' });
    return;
  }
  const totalContentChars = messages.reduce(
    (sum, m) => sum + (typeof m.content === 'string' ? m.content.length : 0),
    0
  );
  if (totalContentChars > MAX_CONTENT_CHARS) {
    res.status(413).json({ error: 'request too large' });
    return;
  }

  const safeMaxTokens =
    typeof maxTokens === 'number' && Number.isFinite(maxTokens) && maxTokens > 0
      ? maxTokens
      : MAX_TOKENS;

  const params = {
    model: MODEL,
    max_tokens: Math.min(safeMaxTokens, MAX_TOKENS),
    ...(system ? { system } : {}),
    messages,
  };

  try {
    if (stream) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      const s = client.messages.stream(params);
      for await (const event of s) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          res.write(event.delta.text);
        }
      }
      res.end();
      return;
    }

    const message = await client.messages.create(params);
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    res.status(200).json({ text });
  } catch (e) {
    console.error('[ai] request failed:', e);
    if (res.headersSent) {
      // Streaming already flushed bytes; can't send a fresh status/JSON body now.
      // The client sees a truncated stream and handles it via its own error path.
      res.end();
      return;
    }
    res.status(502).json({ error: 'AI request failed' });
  }
}
