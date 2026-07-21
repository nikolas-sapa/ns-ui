// Single source of truth for the theme localStorage key. Three call sites
// need to agree on it: the anti-flash script (inlined into <head>, so it has
// to stay a plain string — no imports reach it at runtime), ThemeToggle
// (writes it on click), and ThemeSync (reacts to it via the storage event in
// every other same-origin document, including the preview iframes).
export const THEME_STORAGE_KEY = "ns-ui-theme";

/**
 * Runs synchronously in <head>, before React hydrates, so `.dark` lands on
 * <html> before first paint. Order of preference: an explicit stored choice,
 * else the visitor's system preference. Wrapped in try/catch because
 * localStorage throws in some locked-down browser contexts (private mode,
 * disabled storage) — falling through to system preference there is fine.
 */
export const NO_FLASH_SCRIPT = `(function(){try{var k=${JSON.stringify(
  THEME_STORAGE_KEY,
)};var s=localStorage.getItem(k);var d=s?s==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;
