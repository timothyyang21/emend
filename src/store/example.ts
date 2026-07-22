import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { persistOptions } from '@/lib/storage';

/**
 * Example persisted slice. Copy this shape for real feature slices:
 * one file per feature under src/store/, composed in src/store/index.ts.
 */
type CounterState = {
  count: number;
  inc: () => void;
  reset: () => void;
};

export const useCounter = create<CounterState>()(
  persist(
    (set) => ({
      count: 0,
      inc: () => set((s) => ({ count: s.count + 1 })),
      reset: () => set({ count: 0 }),
    }),
    persistOptions('counter'),
  ),
);
