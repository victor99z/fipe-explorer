import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/** Delay for network/database filter queries while user is actively typing. */
export const FILTER_DEBOUNCE_MS = 600;

/** Delay for in-memory option filters (searchable dropdowns, brand popovers). */
export const LOCAL_FILTER_DEBOUNCE_MS = 250;

function shallowEqual<T extends object>(a: T, b: T): boolean {
  const keysA = Object.keys(a) as Array<keyof T>;
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
 * Ignores referential churn on unrelated renders so active countdowns are not reset.
 */
export function useDebouncedFields<T extends object>(
  liveValue: T,
  delayMs = FILTER_DEBOUNCE_MS,
  onCommit?: (next: T) => void,
): [T, (next: T, options?: { silent?: boolean }) => void] {
  const stableLiveRef = useRef<T>(liveValue);
  if (!shallowEqual(stableLiveRef.current, liveValue)) {
    stableLiveRef.current = liveValue;
  }
  const stableLive = stableLiveRef.current;

  const [debounced, setDebounced] = useState<T>(stableLive);
  const timerRef = useRef<number | null>(null);
  const debouncedRef = useRef<T>(debounced);
  debouncedRef.current = debounced;
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  const cancelPending = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (shallowEqual(debouncedRef.current, stableLive)) {
      cancelPending();
      return;
    }
    cancelPending();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      debouncedRef.current = stableLive;
      setDebounced(stableLive);
      onCommitRef.current?.(stableLive);
    }, delayMs);

    return cancelPending;
  }, [stableLive, delayMs, cancelPending]);

  const flushNow = useCallback(
    (next: T, options?: { silent?: boolean }) => {
      cancelPending();
      const changed = !shallowEqual(debouncedRef.current, next);
      debouncedRef.current = next;
      setDebounced((prev) => (shallowEqual(prev, next) ? prev : next));
      if (changed && !options?.silent) {
        onCommitRef.current?.(next);
      }
    },
    [cancelPending],
  );

  return [debounced, flushNow];
}

/**
 * Debounces a single primitive value (e.g., dropdown or local table search input).
 */
export function useDebouncedValue<T>(
  liveValue: T,
  delayMs = LOCAL_FILTER_DEBOUNCE_MS,
): [T, (next: T) => void] {
  const wrapped = useMemo(() => ({ value: liveValue }), [liveValue]);
  const [debounced, flushWrapped] = useDebouncedFields(wrapped, delayMs);
  const flushNow = useCallback(
    (next: T) => flushWrapped({ value: next }),
    [flushWrapped],
  );
  return [debounced.value, flushNow];
}
