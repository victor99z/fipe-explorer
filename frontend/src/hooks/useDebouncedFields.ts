import { useCallback, useEffect, useRef, useState } from 'react';

function shallowEqual<T extends Record<string, unknown>>(a: T, b: T): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.is(a[key], b[key])) return false;
  }
  return true;
}

/**
 * Debounces a group of live input values while preserving an imperative
 * `flushNow` escape hatch for form submits, filter resets, and URL sync.
 */
export function useDebouncedFields<T extends Record<string, unknown>>(
  liveValue: T,
  delayMs = 450,
): [T, (next: T) => void] {
  const [debounced, setDebounced] = useState<T>(liveValue);
  const timerRef = useRef<number | null>(null);
  const debouncedRef = useRef<T>(debounced);
  debouncedRef.current = debounced;

  const cancelPending = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (shallowEqual(debouncedRef.current, liveValue)) {
      cancelPending();
      return;
    }
    cancelPending();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setDebounced(liveValue);
    }, delayMs);

    return cancelPending;
  }, [liveValue, delayMs, cancelPending]);

  const flushNow = useCallback(
    (next: T) => {
      cancelPending();
      setDebounced((prev) => (shallowEqual(prev, next) ? prev : next));
    },
    [cancelPending],
  );

  return [debounced, flushNow];
}
