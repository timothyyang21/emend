import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { persistOptions } from '@/lib/storage';

/**
 * The dictionary: proper nouns the model must spell exactly, and what each one
 * IS. Without the second half it is a spelling list, not a dictionary — and the
 * description is the part that actually helps the model, because "Vine" alone
 * cannot tell it a street from a character.
 *
 * Book-level, not chapter-level: a character's name is a fact about the novel.
 *
 * Bump DICTIONARY_PERSIST_VERSION whenever SEED_ENTRIES or the shape changes.
 * Persisted state lies to you — a device that opened the app once would
 * otherwise keep the old list forever (learned the hard way; see DEVLOG).
 */
export const DICTIONARY_PERSIST_VERSION = 2;

export interface DictionaryEntry {
  term: string;
  /** Optional. One line, in the writer's words. */
  description?: string;
}

export const SEED_ENTRIES: DictionaryEntry[] = [
  { term: 'Thomas', description: "Susan's son. Died at the corner of Maple and Vine." },
  { term: 'Susan', description: "Thomas's mother. The point of view of the passage." },
  { term: 'Janet', description: 'A name Susan may be renamed to.' },
  { term: 'Maple', description: 'A street. Half of the corner where the car took Thomas.' },
  { term: 'Vine', description: 'A street. The other half of that corner.' },
  { term: 'New York', description: 'Upstate. Where the house and the forest are.' },
];

export interface DictionaryState {
  entries: DictionaryEntry[];
  add: (term: string, description?: string) => void;
  remove: (term: string) => void;
  describe: (term: string, description: string) => void;
  reset: () => void;
}

/** Trim and collapse inner whitespace. Never mutates the input. */
export function normaliseTerm(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/** Case-insensitive so "susan" cannot sit beside "Susan". */
export function hasTerm(entries: readonly DictionaryEntry[], term: string): boolean {
  const needle = normaliseTerm(term).toLowerCase();
  return entries.some((e) => e.term.toLowerCase() === needle);
}

/**
 * What goes to the model. The contract carries `string[]`, so a description
 * rides along on its term — which is also how the model reads it best:
 * "Vine — a street" is unambiguous where "Vine" is not.
 */
export function toPromptTerms(entries: readonly DictionaryEntry[]): string[] {
  return entries.map((e) =>
    e.description?.trim() ? `${e.term} — ${e.description.trim()}` : e.term
  );
}

export const useDictionary = create<DictionaryState>()(
  persist(
    (set, get) => ({
      entries: SEED_ENTRIES.map((e) => ({ ...e })),

      add(rawTerm, description) {
        const term = normaliseTerm(rawTerm);
        if (!term || hasTerm(get().entries, term)) return;
        set({ entries: [...get().entries, { term, description: description?.trim() || undefined }] });
      },

      remove(term) {
        set({ entries: get().entries.filter((e) => e.term !== term) });
      },

      describe(term, description) {
        set({
          entries: get().entries.map((e) =>
            e.term === term ? { ...e, description: description || undefined } : e
          ),
        });
      },

      reset() {
        set({ entries: SEED_ENTRIES.map((e) => ({ ...e })) });
      },
    }),
    {
      ...persistOptions('dictionary'),
      version: DICTIONARY_PERSIST_VERSION,
      migrate: () => ({ entries: SEED_ENTRIES.map((e) => ({ ...e })) }),
    }
  )
);
