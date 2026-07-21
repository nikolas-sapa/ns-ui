"use client";

import { useEffect } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme";

/**
 * Puts `.dark` back on <html> after a *dynamic* route 404s.
 *
 * The anti-flash script in <head> writes that class before hydration, and on a
 * statically prerendered page it survives. But /preview/[name] renders on
 * demand, so its `notFound()` hands React a fresh tree for this same layout
 * and the reconciled <html className> drops the class the script added —
 * measured: /this-does-not-exist kept `dark`, /preview/not-a-real-component
 * lost it and rendered light for a dark-mode visitor.
 *
 * Reading the same key with the same fallback the script uses, once on mount,
 * restores it. No UI, and nothing to undo — ThemeToggle writes this key, so
 * this only ever re-applies the visitor's own choice.
 */
export function ThemeReassert() {
  useEffect(() => {
    let dark: boolean;
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      dark = stored
        ? stored === "dark"
        : window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch {
      dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    document.documentElement.classList.toggle("dark", dark);
  }, []);
  return null;
}
