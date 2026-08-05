"use client";

import { useEffect } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme";

/**
 * No UI. Mounted once in the root layout, so it runs in the host page *and*
 * in every preview iframe (they share the same layout).
 *
 * The `storage` event fires in every other same-origin document when one of
 * them writes localStorage — never in the document that made the write. So
 * when the host's ThemeToggle sets the key, this listener is what applies
 * the change inside already-mounted iframes, live, with no reload. Freshly
 * mounted iframes don't need this at all — they get the right theme from the
 * inline anti-flash script reading localStorage on their own first paint.
 */
export function ThemeSync() {
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      // A key of `null` means the whole storage area was cleared.
      if (e.key !== THEME_STORAGE_KEY && e.key !== null) return;
      const dark = e.newValue
        ? e.newValue === "dark"
        : window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", dark);
    }
    window.addEventListener("storage", onStorage);

    // With no stored choice the theme *is* the OS preference, so it has to
    // keep tracking it — otherwise a visitor whose system flips to dark
    // (manually or at sunset) sits on the stale theme until a reload.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    function onScheme() {
      try {
        if (localStorage.getItem(THEME_STORAGE_KEY)) return;
      } catch {
        // Storage unavailable — same as no stored choice: follow the OS.
      }
      document.documentElement.classList.toggle("dark", mq.matches);
    }
    mq.addEventListener("change", onScheme);

    return () => {
      window.removeEventListener("storage", onStorage);
      mq.removeEventListener("change", onScheme);
    };
  }, []);

  return null;
}
