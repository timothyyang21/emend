/**
 * Typed client for our own serverless functions.
 *
 * Integrator-owned so that Agent C (doc store / autosave) has something real to
 * import on day one instead of waiting for Agent B's handlers to merge. B owns
 * the server side of these endpoints; this file owns the wire format, which is
 * pinned by @/types/contracts either way.
 *
 * No API keys here, ever — they live in the functions.
 */
import type {
  DocumentSnapshot,
  DocumentVersion,
  EditRequest,
  EditResponse,
  PutDocumentRequest,
} from '@/types/contracts';

export { SAMPLE_MARKDOWN } from './sample';

export class ApiClientError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
  }
}

/**
 * Base URL for the functions. Unset in a build with no backend — callers must
 * handle null rather than assume, so the app degrades to local-only instead of
 * throwing on every keystroke.
 */
export function apiBase(): string | null {
  return process.env.EXPO_PUBLIC_API_BASE ?? null;
}

export function apiConfigured(): boolean {
  return apiBase() !== null;
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const base = apiBase();
  if (!base) throw new ApiClientError('No backend configured for this build.');

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
  } catch (e) {
    throw new ApiClientError(
      `Could not reach the server. ${e instanceof Error ? e.message : ''}`.trim()
    );
  }

  if (!res.ok) {
    let detail = '';
    try {
      detail = ((await res.json()) as { error?: string }).error ?? '';
    } catch {
      // Body was not JSON; the status alone has to carry the message.
    }
    throw new ApiClientError(detail || `Request failed (${res.status}).`, res.status);
  }

  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiClientError('Server returned a malformed response.');
  }
}

export function getDocument(signal?: AbortSignal): Promise<DocumentSnapshot> {
  return request<DocumentSnapshot>('/api/document', { method: 'GET', signal });
}

export function putDocument(
  body: PutDocumentRequest,
  signal?: AbortSignal
): Promise<DocumentSnapshot> {
  return request<DocumentSnapshot>('/api/document', {
    method: 'PUT',
    body: JSON.stringify(body),
    signal,
  });
}

export function getVersions(signal?: AbortSignal): Promise<DocumentVersion[]> {
  return request<{ versions: DocumentVersion[] }>('/api/versions', {
    method: 'GET',
    signal,
  }).then((r) => r.versions);
}

/** The edit call. Whole document in, whole document out — see contracts. */
export function requestEdit(body: EditRequest, signal?: AbortSignal): Promise<string> {
  return request<EditResponse>('/api/edit', {
    method: 'POST',
    body: JSON.stringify(body),
    signal,
  }).then((r) => r.revisedMarkdown);
}
