"use client";

import { useCallback, useEffect, useState } from "react";

// A number state that remembers itself in localStorage (used for resizable panel sizes so the user's
// layout — chat width, bottom-panel height, composer height — survives reloads AND re-mounts).
//
// IMPORTANT: we do NOT read localStorage in the useState initializer. On the server that value is the
// default (no window), and React DISCARDS the client initializer's value during hydration — so the
// saved size was "never restored" and the panel snapped back to the default. Instead we render the
// default first (SSR-safe, no mismatch) and LOAD the saved value in an effect right after mount. Writes
// happen SYNCHRONOUSLY inside the setter, so a resize is always persisted immediately.
export function usePersistentNumber(key: string, def: number): [number, (v: number | ((p: number) => number)) => void] {
  const [val, setVal] = useState<number>(def);

  // Restore the saved value once, on mount (client only).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      const n = raw == null ? NaN : Number(raw);
      if (Number.isFinite(n)) setVal(n);
    } catch {}
  }, [key]);

  const set = useCallback(
    (v: number | ((p: number) => number)) => {
      setVal((prev) => {
        const next = typeof v === "function" ? (v as (p: number) => number)(prev) : v;
        try { localStorage.setItem(key, String(next)); } catch {}
        return next;
      });
    },
    [key],
  );

  return [val, set];
}
