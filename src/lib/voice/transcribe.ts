/**
 * Client for our own /api/transcribe function. The OpenRouter key lives there,
 * never here — EXPO_PUBLIC_* vars ship inside the public bundle.
 */
import { apiBase } from '@/lib/api';

export class TranscriptionError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'TranscriptionError';
    this.status = status;
  }
}

/**
 * Returns null only when there is genuinely no backend.
 *
 * The explicit var exists for native, which has no origin to be relative to.
 * Everything else derives from the API base — because .env.local is gitignored,
 * so a Vercel build has never seen EXPO_PUBLIC_TRANSCRIBE_ENDPOINT and the web
 * app reported "Voice is not configured in this build" while its own /api/
 * transcribe endpoint was sitting right there, working.
 */
export function transcribeEndpoint(): string | null {
  const explicit = process.env.EXPO_PUBLIC_TRANSCRIBE_ENDPOINT;
  if (explicit) return explicit;
  const base = apiBase();
  return base === null ? null : `${base}/api/transcribe`;
}

export async function transcribeAudio(
  audioBase64: string,
  format: string,
  /** Proper nouns from the writer's dictionary, so speech-to-text spells them right. */
  dictionary: string[] = [],
  signal?: AbortSignal
): Promise<string> {
  const endpoint = transcribeEndpoint();
  if (!endpoint) {
    throw new TranscriptionError('Voice is not configured in this build.');
  }

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64, format, dictionary }),
      signal,
    });
  } catch (e) {
    throw new TranscriptionError(
      `Could not reach the transcription service. ${e instanceof Error ? e.message : ''}`.trim()
    );
  }

  if (!res.ok) {
    // 413 is the one the writer can actually act on, so it gets its own words.
    if (res.status === 413) throw new TranscriptionError('That recording was too long.', 413);
    throw new TranscriptionError(`Transcription failed (${res.status}).`, res.status);
  }

  let json: { text?: string };
  try {
    json = (await res.json()) as { text?: string };
  } catch {
    throw new TranscriptionError('Transcription returned a malformed response.');
  }
  if (typeof json.text !== 'string') {
    throw new TranscriptionError('Transcription returned no text.');
  }
  return json.text.trim();
}
