// Vercel serverless function — speech to text.
// The OpenRouter key lives HERE (server-side env var OPENROUTER_API_KEY) and is
// never shipped in the app bundle.
// Excluded from the app typecheck (see tsconfig "exclude") and NOT covered by
// `npm run verify` — changes here need manual review.

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash';

// A voice *instruction* is short. 6 MB of base64 is ~90s of 16kHz mono wav —
// far past anything a real command needs, and a cheap guard against a runaway
// recording burning tokens.
const MAX_BASE64_CHARS = 6_000_000;
const ALLOWED_FORMATS = ['wav', 'mp3', 'm4a', 'aac', 'ogg', 'flac'];

const BASE_PROMPT =
  'Transcribe this audio verbatim. It is a short editing instruction spoken by a ' +
  'writer about their manuscript. Reply with the transcript only — no commentary, ' +
  'no quotation marks, no preamble. If the audio contains no speech, reply with ' +
  'nothing at all.';

/**
 * Proper nouns from the writer's dictionary, as a spelling hint.
 *
 * This is the layer where a name actually gets lost. "Janet" comes back as
 * "Janette", the edit call then faithfully applies "Janette", and the dictionary
 * never gets a say — because by then the instruction genuinely says Janette, and
 * an explicit instruction is meant to outrank the list. Guarding only the edit
 * call guards the wrong end of the pipe.
 */
function namesPrompt(dictionary: string[]): string {
  if (dictionary.length === 0) return '';
  return (
    '\n\nThese names appear in this writer\'s book. If you hear one of them, spell ' +
    'it EXACTLY as written here, never a variant or a more common form:\n' +
    dictionary.map((t) => `- ${t}`).join('\n')
  );
}

type Req = { method?: string; body?: unknown };
type Res = {
  status: (code: number) => Res;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

export default async function handler(req: Req, res: Res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).json(null);
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    console.error('[transcribe] OPENROUTER_API_KEY is not set');
    res.status(500).json({ error: 'transcription is not configured' });
    return;
  }

  let raw: unknown;
  try {
    raw = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ error: 'invalid JSON body' });
    return;
  }
  const { audioBase64, format, dictionary } = (raw ?? {}) as {
    audioBase64?: string;
    format?: string;
    dictionary?: string[];
  };

  const names =
    Array.isArray(dictionary) && dictionary.every((t) => typeof t === 'string')
      ? dictionary.map((t) => t.trim()).filter(Boolean).slice(0, 200)
      : [];

  if (typeof audioBase64 !== 'string' || audioBase64.length === 0) {
    res.status(400).json({ error: 'audioBase64 required' });
    return;
  }
  if (audioBase64.length > MAX_BASE64_CHARS) {
    res.status(413).json({ error: 'recording too long' });
    return;
  }
  const fmt = typeof format === 'string' ? format.toLowerCase() : 'wav';
  if (!ALLOWED_FORMATS.includes(fmt)) {
    res.status(400).json({ error: `unsupported format: ${fmt}` });
    return;
  }

  try {
    const upstream = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: BASE_PROMPT + namesPrompt(names) },
              { type: 'input_audio', input_audio: { data: audioBase64, format: fmt } },
            ],
          },
        ],
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      console.error('[transcribe] openrouter %d: %s', upstream.status, detail.slice(0, 500));
      res.status(502).json({ error: 'transcription failed' });
      return;
    }

    const json = (await upstream.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = json.choices?.[0]?.message?.content;
    if (typeof text !== 'string') {
      console.error('[transcribe] unexpected response shape');
      res.status(502).json({ error: 'transcription failed' });
      return;
    }
    // The model is told to answer with nothing when there is no speech; an empty
    // transcript is a legitimate result, not an error. The UI says "I didn't
    // catch that" rather than pushing an empty instruction into the edit call.
    if (names.length > 0) console.log('[transcribe] ok (%d name hints)', names.length);
    res.status(200).json({ text: text.trim() });
  } catch (e) {
    console.error('[transcribe] request failed:', e);
    res.status(502).json({ error: 'transcription failed' });
  }
}
