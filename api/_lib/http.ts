// Shared plumbing for the serverless functions.
//
// Minimal STRUCTURAL Req/Res types so nothing here needs @vercel/node — the same
// shape `scripts/dev-api.mjs` shims locally and Vercel supplies in production.
// (See api/transcribe.ts, which is the house style this file follows.)
//
// NOTE ON IMPORTS: the dev server runs these files through Node's type stripping
// as ESM, which requires an explicit `.ts` extension on every *value* import.
// `import type` is erased and stays extensionless.

export type Req = { method?: string; body?: unknown; url?: string };

export type Res = {
  status: (code: number) => Res;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

/** Same permissive CORS as api/transcribe.ts — the app is a public web/native client. */
export function cors(res: Res, methods: string): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', `${methods}, OPTIONS`);
}

/**
 * Parse a JSON body that may arrive as a string (dev server, and Vercel when the
 * content-type is not application/json) or as an already-parsed object.
 * Returns `undefined` when the body is unparseable — the caller decides the status.
 */
export function parseBody(body: unknown): Record<string, unknown> | undefined {
  if (body === undefined || body === null || body === '') return {};
  if (typeof body === 'object') return body as Record<string, unknown>;
  if (typeof body !== 'string') return undefined;
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed === null || typeof parsed !== 'object') return undefined;
    return parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }
}
