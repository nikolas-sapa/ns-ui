// Single source of truth for the "draw no cursor of our own" preference —
// same three-call-site shape as lib/theme.ts: the anti-flash script (inlined
// into <head>, so it has to stay a plain string — no imports reach it at
// runtime), CursorToggle (writes it on click), and SmoothCursor (stops
// drawing, and reacts to the storage event from every other same-origin
// document, preview iframes and second tabs included).
//
// Presence-checked like SIDEBAR_HIDDEN_KEY rather than storing "on"/"off":
// the custom cursor is the default, so the only state worth persisting is the
// opt-out. Versioned for the same reason — if the stored shape ever has to
// change incompatibly, bump to -v2 instead of reinterpreting old values.
export const CURSOR_NATIVE_KEY = "ns-ui-cursor-native-v1";

/**
 * Class on <html> while the opt-out is in force. The class, not localStorage,
 * is what every *rendering* decision reads: it exists before first paint (the
 * script below), so the `cursor: none` rule and the toggle's own icon are
 * already correct on the frame the document is first painted, with no
 * client-side correction to flash through. Same split the theme's `.dark` and
 * the sidebar's `.sidebar-hidden` already use.
 */
export const CURSOR_NATIVE_CLASS = "native-cursor";

/**
 * Fired on `window` by `setNativeCursor` below. A classList change is not
 * observable without a MutationObserver, and the `storage` event deliberately
 * never fires in the document that made the write — so this is how the
 * toggle tells SmoothCursor, in its own document, to tear down or come back.
 */
export const CURSOR_PREF_EVENT = "ns-ui:cursor-pref";

/**
 * Runs synchronously in <head>, before React hydrates — same reasoning as the
 * theme's NO_FLASH_SCRIPT (lib/theme.ts). Without it, a visitor who turned the
 * custom cursor off still loses their native cursor for the frames between
 * paint and the effect that reads the preference, which is the exact flicker
 * the switch exists to remove.
 */
export const NO_FLASH_CURSOR_SCRIPT = `(function(){try{var k=${JSON.stringify(
  CURSOR_NATIVE_KEY,
)};if(localStorage.getItem(k)==="1"){document.documentElement.classList.add(${JSON.stringify(
  CURSOR_NATIVE_CLASS,
)});}}catch(e){}})();`;

/** Client-only. The class is set pre-paint, so this is the earliest truth. */
export function prefersNativeCursor(): boolean {
  return document.documentElement.classList.contains(CURSOR_NATIVE_CLASS);
}

/** Class only — used by the `storage` path, which must not write back. */
export function applyNativeCursorClass(next: boolean) {
  document.documentElement.classList.toggle(CURSOR_NATIVE_CLASS, next);
}

/** The write path: this document, storage, then the same-document listeners. */
export function setNativeCursor(next: boolean) {
  applyNativeCursorClass(next);
  try {
    if (next) localStorage.setItem(CURSOR_NATIVE_KEY, "1");
    else localStorage.removeItem(CURSOR_NATIVE_KEY);
  } catch {
    // Storage unavailable (private mode, locked down) — the switch still
    // works for this document, it just won't persist or reach other tabs.
  }
  window.dispatchEvent(new CustomEvent(CURSOR_PREF_EVENT));
}
