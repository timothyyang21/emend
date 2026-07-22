import { create } from 'zustand';

import { apiConfigured, getVersions } from '@/lib/api';
import type { DocumentVersion } from '@/types/contracts';

/**
 * The version stack, as the app sees it.
 *
 * Not persisted and never authoritative: the server owns history, this is a
 * cache of what it last told us. Restoring does NOT happen here — it goes
 * through the document store like any other edit, so there is exactly one path
 * that writes to the manuscript.
 */
export type HistoryStatus = 'idle' | 'loading' | 'error';

export interface HistoryState {
  versions: DocumentVersion[];
  status: HistoryStatus;
  error: string | null;
  refresh: () => Promise<void>;
}

export const useHistory = create<HistoryState>((set) => ({
  versions: [],
  status: 'idle',
  error: null,

  async refresh() {
    if (!apiConfigured()) {
      // No backend in this build: there is no history, and saying "failed" about
      // a feature that simply isn't wired would be crying wolf.
      set({ versions: [], status: 'idle', error: null });
      return;
    }
    set({ status: 'loading', error: null });
    try {
      set({ versions: await getVersions(), status: 'idle', error: null });
    } catch (e) {
      set({
        status: 'error',
        error: e instanceof Error ? e.message : 'Could not load your history.',
      });
    }
  },
}));
