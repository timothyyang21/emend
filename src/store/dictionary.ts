import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { persistOptions } from '@/lib/storage';

/**
 * The story bible: proper nouns the model must spell exactly.
 *
 * Book-level, not chapter-level — a character's name is a fact about the novel,
 * which is why this lives beside the chapter index rather than inside Chapter 4.
 *
 * Seeded from the sample passage so it demonstrates itself on first run. Bump
 * DICTIONARY_PERSIST_VERSION whenever SEED changes: persisted state lies to you,
 * and a device that opened the app once would otherwise keep the old list
 * forever (this exact rule was learned the hard way — see DEVLOG).
 */
export const DICTIONARY_PERSIST_VERSION = 1;

export const SEED_TERMS = ['Thomas', 'Susan', 'Janet', 'Maple', 'Vine', 'New York'];

export interface DictionaryState {
  terms: string[];
  add: (term: string) => void;
  remove: (term: string) => void;
  reset: () => void;
}

/** Trim, collapse inner whitespace, drop empties. Never mutates the input. */
export function normaliseTerm(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/** Case-insensitive so "susan" cannot sit beside "Susan" and confuse the model. */
export function hasTerm(terms: readonly string[], term: string): boolean {
  const needle = normaliseTerm(term).toLowerCase();
  return terms.some((t) => t.toLowerCase() === needle);
}

export const useDictionary = create<DictionaryState>()(
  persist(
    (set, get) => ({
      terms: [...SEED_TERMS],

      add(raw) {
        const term = normaliseTerm(raw);
        if (!term || hasTerm(get().terms, term)) return;
        set({ terms: [...get().terms, term] });
      },

      remove(term) {
        set({ terms: get().terms.filter((t) => t !== term) });
      },

      reset() {
        set({ terms: [...SEED_TERMS] });
      },
    }),
    {
      ...persistOptions('dictionary'),
      version: DICTIONARY_PERSIST_VERSION,
      migrate: () => ({ terms: [...SEED_TERMS] }),
    }
  )
);
