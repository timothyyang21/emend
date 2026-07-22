/**
 * The document store — one manuscript, always on screen, always saved.
 *
 * Responsibilities, in order of how badly they hurt when wrong:
 *  1. The app opens onto real prose. Server copy if we can get it, the copy on
 *     this device if we can't, the seeded sample if there isn't one. Never an
 *     empty box, never a crash.
 *  2. Every local edit is written back, debounced, with the LAST text winning.
 *  3. `status` / `error` tell the truth at all times — they are rendered to the
 *     writer in words via SYNC_STATUS_LABEL. A save that failed says so.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { SAMPLE_MARKDOWN, apiConfigured, getDocument, putDocument } from '@/lib/api';
import { AUTOSAVE_DELAY_MS, createDebouncedSaver } from '@/lib/doc/autosave';
import { persistOptions } from '@/lib/storage';
import type { DocStore, SyncStatus } from '@/types/contracts';

/**
 * Bump whenever SAMPLE_MARKDOWN (or the shape below) changes. Persisted state
 * lies to you: without this, a device that opened the app once keeps serving the
 * OLD seed forever and you debug a bug that only exists in AsyncStorage.
 * `migrate` throws the stale copy away rather than trying to reconcile it.
 */
// 2: the seed became James's passage. Devices that opened the app before that
// were carrying the old sample in AsyncStorage, and their local copy — being
// "real local work" — got pushed UP to the server, overwriting the new seed.
export const DOC_PERSIST_VERSION = 2;

/**
 * Where the text on screen came from. Exists so we NEVER have to ask
 * "is this still the sample?" by comparing strings — a round trip through a text
 * field hands back curly quotes and collapsed whitespace and silently unhooks
 * any such check.
 */
export type DocOrigin = 'seed' | 'local' | 'server';

interface DocState extends DocStore {
  /** Provenance of `markdown`. Never inferred by comparing against the seed. */
  origin: DocOrigin;
  /** True when there are local edits not yet acknowledged by the server. */
  dirty: boolean;
}

/** Also used by `migrate` — resetting means "become exactly this again". */
export const INITIAL_DOC_STATE = {
  // Seeded, not empty: the first frame is prose even before load() resolves.
  markdown: SAMPLE_MARKDOWN,
  version: 0,
  status: 'idle' as SyncStatus,
  error: null as string | null,
  lastSyncedAt: null as number | null,
  origin: 'seed' as DocOrigin,
  dirty: false,
};

function messageOf(e: unknown, fallback: string): string {
  const raw = e instanceof Error ? e.message.trim() : '';
  return raw.length > 0 ? raw : fallback;
}

export const useDoc = create<DocState>()(
  persist(
    (set, get) => {
      /**
       * The single writer to the server. Owned by the saver below, so it only
       * ever runs one at a time.
       *
       * Note what it does NOT do: it never writes `markdown` back from the
       * response. The response describes the text we sent, which may already be
       * stale — adopting it would undo whatever the writer typed while the
       * request was in the air.
       */
      const writeToServer = async (payload: { markdown: string; label?: string }) => {
        if (!apiConfigured()) {
          // Local-only build. AsyncStorage persistence IS the save here, and it
          // has already happened; saying "Saving…" forever would be a lie.
          set({ status: 'idle', error: null, dirty: false, lastSyncedAt: Date.now() });
          return;
        }

        set({ status: 'saving', error: null });
        const snapshot = await putDocument({
          markdown: payload.markdown,
          baseVersion: get().version,
          label: payload.label,
        });

        const stillCurrent = get().markdown === payload.markdown;
        set({
          version: snapshot.version,
          lastSyncedAt: snapshot.updatedAt,
          // Another edit landed mid-flight; it is queued and about to be saved,
          // so we are not clean and not idle yet.
          dirty: !stillCurrent,
          status: stillCurrent ? 'idle' : 'saving',
          error: null,
        });
      };

      const saver = createDebouncedSaver<{ markdown: string; label?: string }>(
        writeToServer,
        AUTOSAVE_DELAY_MS,
        (error) => {
          set({
            status: 'error',
            dirty: true,
            error: messageOf(
              error,
              'Could not save your changes. They are still on this device.'
            ),
          });
        }
      );

      return {
        ...INITIAL_DOC_STATE,

        async load() {
          set({ status: 'loading', error: null });
          const local = get();
          // Fall back to what is on this device only if this device actually has
          // something of the writer's — provenance, not string comparison.
          const fallbackMarkdown =
            local.origin === 'seed' ? SAMPLE_MARKDOWN : local.markdown;

          if (!apiConfigured()) {
            // Not an error state: a build with no backend is a legitimate mode,
            // and "Not saved" would be crying wolf.
            set({ markdown: fallbackMarkdown, status: 'idle', error: null });
            return;
          }

          try {
            const snapshot = await getDocument();

            // Unsaved local work outranks the server copy. The server's version
            // of a document whose last save failed is OLDER than what is on this
            // device, and silently replacing it would destroy the writer's work.
            if (local.dirty && local.origin !== 'seed') {
              set({
                markdown: local.markdown,
                version: snapshot.version,
                status: 'saving',
                error: null,
              });
              saver.schedule({ markdown: local.markdown, label: 'recovered local changes' });
              return;
            }

            set({
              markdown: snapshot.markdown,
              version: snapshot.version,
              lastSyncedAt: snapshot.updatedAt,
              origin: 'server',
              dirty: false,
              status: 'idle',
              error: null,
            });
          } catch (e) {
            // Degrade, loudly but safely: real prose on screen, honest status.
            set({
              markdown: fallbackMarkdown,
              status: 'error',
              error: messageOf(e, 'Could not reach the server.'),
            });
          }
        },

        setMarkdown(markdown: string, label?: string) {
          // Identical text is not an edit. Without this, mounting the editor
          // would schedule a save of a document nobody touched.
          if (markdown === get().markdown) return;

          set({
            markdown,
            origin: 'local',
            dirty: true,
            status: 'saving',
            error: null,
          });
          saver.schedule({ markdown, label });
        },

        async flush() {
          await saver.flush();
        },
      };
    },
    {
      ...persistOptions('doc'),
      version: DOC_PERSIST_VERSION,
      // Only the manuscript and its provenance survive a restart. Status and
      // error describe *this* session; a rehydrated "Saving…" would be a ghost.
      partialize: (s) => ({
        markdown: s.markdown,
        version: s.version,
        lastSyncedAt: s.lastSyncedAt,
        origin: s.origin,
        dirty: s.dirty,
      }),
      migrate: () => ({ ...INITIAL_DOC_STATE }),
    }
  )
);
