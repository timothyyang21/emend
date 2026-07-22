import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { persistOptions } from '@/lib/storage';
import type { ID, WritingEntry, WritingStore } from '@/types/contracts';

let seq = 0;
const makeId = (): ID => `${Date.now().toString(36)}-${(seq++).toString(36)}`;

export const useWriting = create<WritingStore>()(
  persist(
    (set) => ({
      entries: [],
      upsert: (draft) => {
        const now = Date.now();
        if (draft.id) {
          const id = draft.id;
          set((s) => ({
            entries: s.entries.map((e) =>
              e.id === id ? { ...e, title: draft.title, body: draft.body, imageUri: draft.imageUri, updatedAt: now } : e,
            ),
          }));
          return id;
        }
        const id = makeId();
        const entry: WritingEntry = {
          id,
          title: draft.title,
          body: draft.body,
          imageUri: draft.imageUri,
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ entries: [entry, ...s.entries] }));
        return id;
      },
      removeMany: (ids) => set((s) => ({ entries: s.entries.filter((e) => !ids.includes(e.id)) })),
      clear: () => set({ entries: [] }),
    }),
    persistOptions('writing'),
  ),
);
