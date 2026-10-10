"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CURSOR_NATIVE_KEY,
  applyNativeCursorClass,
  prefersNativeCursor,
  setNativeCursor,
} from "@/lib/cursor";

/**
 * The visitor's off switch for the replacement cursor (smooth-cursor.tsx).
 * Modelled on ThemeToggle, including the one thing that matters most here: the
 * icon swap is pure CSS (`native-cursor:hidden` / `native-cursor:block`) keyed
 * off the same `.native-cursor` class the anti-flash script already put on
 * <html> before paint, so the correct glyph is there on the first frame.
 * `mounted` only gates the a11y state, which can't be known during SSR.
 *
 * Shown only where the cursor it controls actually runs — see the
 * `.cursor-toggle` rule in globals.css, which repeats SmoothCursor's own
 * fine-pointer + hover + no-reduced-motion condition rather than offering a
 * switch for something already native.
 */
export function CursorToggle() {
  const [native, setNative] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setNative(prefersNativeCursor());
    setMounted(true);

    // The `storage` event fires in every OTHER same-origin document — a second
    // tab, and the preview iframes, which render this same shell. Apply the
    // class here so this document's own icon follows, exactly as ThemeSync
    // does for the theme.
    function onStorage(e: StorageEvent) {
      // A key of `null` means the whole storage area was cleared.
      if (e.key !== CURSOR_NATIVE_KEY && e.key !== null) return;
      const next = e.newValue === "1";
      applyNativeCursorClass(next);
      setNative(next);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = useCallback(() => {
    const next = !prefersNativeCursor();
    setNativeCursor(next);
    setNative(next);
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        mounted
          ? native
            ? "Turn on the custom cursor"
            : "Turn off the custom cursor"
          : "Toggle the custom cursor"
      }
      // Pressed = our cursor is the one being drawn, which is the default.
      aria-pressed={mounted ? !native : undefined}
      suppressHydrationWarning
      // Same box, hit area and focus ring as its neighbour ThemeToggle — the
      // ::after only grows the clickable region, capped at half the cluster's
      // flex gap so it can't steal that button's clicks. `display` is left to
      // the `.cursor-toggle` rule in globals.css (no `inline-flex` utility
      // here), since that rule is also what hides this control where there is
      // no custom cursor to switch off.
      className="cursor-toggle relative size-9 shrink-0 items-center justify-center rounded-sm text-ns-muted outline-none transition-colors motion-reduce:transition-none hover:bg-border/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background after:absolute after:-inset-x-[2px] after:-inset-y-[6px] after:content-['']"
    >
      <PointerIcon className="native-cursor:hidden" />
      <PointerOffIcon className="hidden native-cursor:block" />
    </button>
  );
}

function PointerIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`size-4 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.7 3.1 13.4 7.5 9.3 8.5 8.2 12.6Z" />
    </svg>
  );
}

function PointerOffIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`size-4 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.7 3.1 13.4 7.5 9.3 8.5 8.2 12.6Z" />
      {/* Struck from top-right so the line crosses the body rather than
          running parallel to either of the arrow's own long edges. */}
      <path d="M13.8 2.2 2.6 13.4" />
    </svg>
  );
}
