/**
 * Debounced, serialised saver — the thing standing between a writer's keystrokes
 * and their manuscript being safe on a server.
 *
 * Deliberately pure and UI-free so it can be tested with fake timers outside a
 * store, a component, or a network. `src/store/doc.ts` is the only caller in the
 * app; everything interesting about the timing lives here.
 *
 * Two guarantees, and they are the whole reason this file exists:
 *
 *  1. RAPID EDITS COALESCE. Scheduling three times inside the delay performs one
 *     save, of the third value.
 *  2. A SAVE IN FLIGHT IS NEVER CLOBBERED, AND THE LATEST TEXT ALWAYS WINS.
 *     Saves run strictly one at a time. A value scheduled while a save is in
 *     flight is not raced against it — it is queued and written immediately
 *     after, so the last thing the writer typed is the last thing stored.
 */

/** ~800ms: long enough to coalesce a burst of typing, short enough to feel live. */
export const AUTOSAVE_DELAY_MS = 800;

export interface DebouncedSaver<T> {
  /** Record a new value and (re)start the debounce clock. */
  schedule: (value: T) => void;
  /**
   * Save anything pending right now and wait for the queue to drain. Resolves
   * once nothing is in flight. Never rejects — failures go to `onError`.
   */
  flush: () => Promise<void>;
  /** Drop the pending value and stop the clock. An in-flight save still finishes. */
  cancel: () => void;
  /** True while a value is waiting for the debounce OR being written. */
  isPending: () => boolean;
}

export function createDebouncedSaver<T>(
  save: (value: T) => Promise<void>,
  delayMs: number = AUTOSAVE_DELAY_MS,
  onError?: (error: unknown) => void
): DebouncedSaver<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  // A one-slot queue: superseded values are worthless, so a newer schedule
  // simply overwrites the older one. `null` means nothing is waiting.
  let queued: { value: T } | null = null;
  let inFlight: Promise<void> | null = null;

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  // Drains the slot serially. Because this loop re-checks `queued` after each
  // await, a value scheduled mid-save is picked up here rather than starting a
  // competing write — that is guarantee (2).
  async function drain(): Promise<void> {
    while (queued !== null) {
      const next = queued.value;
      queued = null;
      try {
        await save(next);
      } catch (error) {
        // A failed save must be visible, never swallowed — but it also must not
        // wedge the saver: later edits still get their chance to be written.
        onError?.(error);
      }
    }
  }

  function kick(): Promise<void> {
    if (inFlight === null) {
      inFlight = drain().finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  }

  return {
    schedule(value: T) {
      queued = { value };
      clearTimer();
      timer = setTimeout(() => {
        timer = null;
        void kick();
      }, delayMs);
    },

    async flush() {
      clearTimer();
      if (queued !== null) void kick();
      // Loop, because draining one save can be followed by another arriving
      // while we were awaiting the first.
      while (inFlight !== null) {
        await inFlight;
      }
    },

    cancel() {
      clearTimer();
      queued = null;
    },

    isPending() {
      return queued !== null || inFlight !== null || timer !== null;
    },
  };
}
