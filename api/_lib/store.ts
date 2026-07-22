// Persistence for the single POC document + its version stack.
//
// ─── ON DURABILITY, READ THIS BEFORE TRUSTING IT ────────────────────────────
// Vercel serverless functions are STATELESS. Module-level variables live only as
// long as one warm instance, and `os.tmpdir()` is that instance's own scratch
// disk: it survives calls that happen to land on the same instance and vanishes
// otherwise. So the file store below is genuinely durable for `npm run dev:api`
// (one long-lived process) and only best-effort in production.
//
// Real durable persistence means Vercel KV or Vercel Blob, which has to be
// PROVISIONED ON THE ACCOUNT and injects its own credentials — an account
// operation the integrator owns. Nothing here provisions anything, handles a
// credential, or adds a dependency that needs a login. When the integrator wires
// KV/Blob up, it drops in as a third implementation of `DocumentStore` and
// `selectStore()` picks it; no handler changes.
// ────────────────────────────────────────────────────────────────────────────

import { accessSync, constants, mkdirSync } from 'node:fs';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { DocumentSnapshot, DocumentVersion } from '../../src/types/contracts';
import { DOCUMENT_ID } from '../../src/types/contracts';
import { SAMPLE_MARKDOWN } from '../../src/lib/api/sample';
import { MAX_VERSIONS, newestFirst, pushVersion, sanitizeStack } from './versions';

export interface StoredState {
  snapshot: DocumentSnapshot;
  /** Newest first. The state each write replaced. */
  versions: DocumentVersion[];
}

/** The seam. Two implementations below; swap in KV/Blob later without touching handlers. */
export interface DocumentStore {
  readonly kind: 'file' | 'memory';
  read(): Promise<StoredState | null>;
  write(state: StoredState): Promise<void>;
}

// --- implementations -------------------------------------------------------

function createFileStore(dir: string): DocumentStore {
  const file = join(dir, 'document.json');
  return {
    kind: 'file',
    async read() {
      try {
        const raw = await readFile(file, 'utf8');
        return JSON.parse(raw) as StoredState;
      } catch (e) {
        const code = (e as NodeJS.ErrnoException).code;
        if (code !== 'ENOENT') {
          console.error('[store] unreadable state at %s (%s) — treating as empty', file, code);
        }
        return null;
      }
    },
    async write(state) {
      // Write-then-rename: a crash mid-write leaves the old file intact rather
      // than a half-JSON file that reads as "no document".
      const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(tmp, JSON.stringify(state), 'utf8');
      await rename(tmp, file);
    },
  };
}

function createMemoryStore(): DocumentStore {
  let state: StoredState | null = null;
  return {
    kind: 'memory',
    async read() {
      return state;
    },
    async write(next) {
      state = next;
    },
  };
}

/** Runtime selection: a writable tmpdir gets the file store, otherwise memory. */
function selectStore(): DocumentStore {
  const dir = process.env.EMEND_STORE_DIR ?? join(tmpdir(), 'emend-store');
  try {
    mkdirSync(dir, { recursive: true });
    accessSync(dir, constants.W_OK);
    return createFileStore(dir);
  } catch (e) {
    console.error('[store] no writable dir at %s — falling back to memory:', dir, e);
    return createMemoryStore();
  }
}

const store: DocumentStore = selectStore();
console.log('[store] using %s store', store.kind);

// --- document operations ---------------------------------------------------

function seed(): StoredState {
  return {
    snapshot: {
      id: DOCUMENT_ID,
      markdown: SAMPLE_MARKDOWN,
      version: 1,
      updatedAt: Date.now(),
    },
    versions: [],
  };
}

/** Defensive: a state file from an older shape must not 500 a cold read. */
function normalize(raw: StoredState | null): StoredState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw.snapshot as Partial<DocumentSnapshot> | undefined;
  if (!s || typeof s.markdown !== 'string' || typeof s.version !== 'number') return null;
  return {
    snapshot: {
      id: typeof s.id === 'string' ? s.id : DOCUMENT_ID,
      markdown: s.markdown,
      version: s.version,
      updatedAt: typeof s.updatedAt === 'number' ? s.updatedAt : Date.now(),
    },
    versions: sanitizeStack(raw.versions),
  };
}

// Serialise read-modify-write inside a process. Last-write-wins is the policy
// between clients; it is not an excuse to interleave two writes into one file.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => undefined);
  return next;
}

async function loadOrSeed(): Promise<StoredState> {
  const existing = normalize(await store.read());
  if (existing) return existing;
  const fresh = seed();
  await store.write(fresh);
  console.log('[store] seeded document at version %d from SAMPLE_MARKDOWN', fresh.snapshot.version);
  return fresh;
}

/** GET /api/document. Seeds from SAMPLE_MARKDOWN at version 1 if nothing is stored. */
export function readSnapshot(): Promise<DocumentSnapshot> {
  return serial(async () => (await loadOrSeed()).snapshot);
}

/**
 * PUT /api/document. Last-write-wins: `baseVersion` is telemetry, not a lock.
 * Bumps the version and pushes the PREVIOUS state onto the stack with `label`.
 */
export function writeSnapshot(
  markdown: string,
  label?: string,
  baseVersion?: number
): Promise<DocumentSnapshot> {
  return serial(async () => {
    const current = await loadOrSeed();

    if (typeof baseVersion === 'number' && baseVersion !== current.snapshot.version) {
      console.log(
        '[document] stale write: client had v%d, server has v%d — last write wins',
        baseVersion,
        current.snapshot.version
      );
    }

    const previous: DocumentVersion = {
      version: current.snapshot.version,
      markdown: current.snapshot.markdown,
      createdAt: current.snapshot.updatedAt,
      ...(label ? { label } : {}),
    };

    const next: StoredState = {
      snapshot: {
        id: current.snapshot.id,
        markdown,
        version: current.snapshot.version + 1,
        updatedAt: Date.now(),
      },
      versions: pushVersion(current.versions, previous, MAX_VERSIONS),
    };

    await store.write(next);
    return next.snapshot;
  });
}

/** GET /api/versions. Newest first, capped. */
export function readVersions(): Promise<DocumentVersion[]> {
  return serial(async () => newestFirst((await loadOrSeed()).versions).slice(0, MAX_VERSIONS));
}

export const storeKind = store.kind;
