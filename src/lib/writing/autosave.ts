import { useEffect, useRef } from 'react';

export function createAutosaver<T>(save: (v: T) => void, delayMs: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { v: T } | null = null;

  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const cancel = () => {
    clearTimer();
    pending = null;
  };

  return {
    schedule(v: T) {
      pending = { v };
      clearTimer();
      timer = setTimeout(() => {
        timer = null;
        save(v);
        pending = null;
      }, delayMs);
    },
    flush() {
      clearTimer();
      if (pending) {
        save(pending.v);
        pending = null;
      }
    },
    cancel,
  };
}

export function useAutosave<T>(value: T, save: (v: T) => void, delayMs = 800): void {
  const saveRef = useRef(save);
  saveRef.current = save;
  const saver = useRef(createAutosaver<T>((v) => saveRef.current(v), delayMs));
  useEffect(() => {
    saver.current.schedule(value);
  }, [value]);
  useEffect(() => {
    const s = saver.current;
    return () => s.flush();
  }, []);
}
