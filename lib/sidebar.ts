// Sidebar hidden-state localStorage key. Deliberately a separate key from
// site-shell.tsx's own STORAGE_KEY ("ns-ui-nav-open-v2", which tracks which
// sections are expanded) — this is a different concern (whether the sidebar
// column renders at all) and the two must not merge or one clearing the
// other's storage would silently reset it. Versioned the same way, for the
// same reason: if the persisted shape ever needs to change incompatibly,
// bump to -v2 rather than reinterpret old values.
export const SIDEBAR_HIDDEN_KEY = "ns-ui-sidebar-hidden-v1";

/**
 * Runs synchronously in <head>, before React hydrates — same reasoning as
 * theme's NO_FLASH_SCRIPT (lib/theme.ts): a returning visitor who collapsed
 * the sidebar should never see a full-width nav flash open for one frame
 * before JS removes it. Sets a class on <html>; the actual hide + content
 * reflow is plain CSS (app/globals.css), scoped to the `lg` breakpoint so it
 * never touches the mobile drawer, which has its own, unrelated toggle.
 */
export const NO_FLASH_SIDEBAR_SCRIPT = `(function(){try{var k=${JSON.stringify(
  SIDEBAR_HIDDEN_KEY,
)};if(localStorage.getItem(k)==="1"){document.documentElement.classList.add("sidebar-hidden");}}catch(e){}})();`;
