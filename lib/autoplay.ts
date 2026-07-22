/**
 * Autoplay descriptors — how a component demonstrates itself, unattended,
 * inside a landing-page card.
 *
 * 37 of the 50 components only wake on input (hover, pointer movement, drag,
 * press, scroll), so inside a card they froze on a still frame. Rather than 37
 * bespoke animations, each component declares *what kind of input wakes it* in
 * its `meta.json`, and one shared driver synthesises that input.
 *
 * This type is the contract. It is site-only metadata: it never reaches
 * `registry.json`, `public/r/*.json` or `llms.txt` — a consumer installing the
 * component gets nothing about it, because it says nothing about the
 * component's API. See `scripts/build-autoplay.ts`.
 */

export const AUTOPLAY_MODES = ["pointer-path", "scroll", "press", "drag", "type", "none"] as const;
export type AutoplayMode = (typeof AUTOPLAY_MODES)[number];

export const AUTOPLAY_PATHS = ["sweep", "orbit", "figure8"] as const;
export type AutoplayPath = (typeof AUTOPLAY_PATHS)[number];

/** Normalized point inside the resolved target's box. `[0,0]` = top-left. */
export type NormPoint = [number, number];

export type AutoplaySpec = {
  mode: AutoplayMode;
  /** One full cycle in ms, including the rest beat. Default 4000. */
  period?: number;
  /** Wait this long after mount before the first cycle, in ms. Default 600. */
  delay?: number;

  /**
   * CSS selector, queried inside the demo root. Matching nothing (or omitted)
   * falls back to the demo root — never throws.
   * `pointer-path`/`drag`: the box the path runs over is the *union* of every
   * match, so `"button"` over a row of nine items gives exactly that row.
   * `press`: the control to press — first match only (default `button`).
   * `type`: the input(s) to type into (default `input, textarea,
   * [contenteditable]`). When the selector matches *several* elements — a
   * multi-box OTP, one `<input>` per digit — character k is dispatched to the
   * k-th match, because the demo is `inert` and its internal focus-advance is
   * a no-op. When it matches one, the whole string goes to that element.
   */
  target?: string;

  // --- pointer-path / drag ------------------------------------------------
  /** Path shape over the target box. Default `sweep`. */
  path?: AutoplayPath;
  /**
   * Margin as a fraction of the target box, −0.45 to 0.45. Positive shrinks
   * the box, negative overshoots it (a sweep then enters and leaves).
   * Default 0.12 for `pointer-path`, 0 for `drag`.
   */
  inset?: number;

  // --- scroll -------------------------------------------------------------
  /** CSS selector for the scroll container. Default: the embed document. */
  scroller?: string;
  /** Fractions of the scrollable range to travel between. Default `[0, 1]`. */
  range?: [number, number];

  // --- press / type -------------------------------------------------------
  /**
   * `press`: how long the pointer stays down, in ms (default 900).
   * `type`: how long the fully-typed string rests before it clears and the
   * loop repeats, in ms (default 1600).
   */
  hold?: number;

  // --- type ---------------------------------------------------------------
  /**
   * The string typed into the target on a loop, one character per keystroke.
   * Required for `type` — a descriptor without it does nothing.
   */
  text?: string;
  /**
   * Characters per second. Default 3. Keep it low (2-3) for components whose
   * per-key animation is the point, so each keystroke is legible.
   */
  cps?: number;

  // --- drag ---------------------------------------------------------------
  /** Grab point, normalized in the target box. Default `[0.2, 0.5]`. */
  from?: NormPoint;
  /** Release point, normalized in the target box. Default `[0.8, 0.5]`. */
  to?: NormPoint;
};

/** Map of component name -> descriptor, generated from the meta.json sidecars. */
export type AutoplayMap = Record<string, AutoplaySpec>;

/** Narrow unknown JSON to a spec. Anything malformed becomes `null` (no driver). */
export function parseAutoplay(value: unknown): AutoplaySpec | null {
  if (!value || typeof value !== "object") return null;
  const mode = (value as { mode?: unknown }).mode;
  if (typeof mode !== "string") return null;
  if (!(AUTOPLAY_MODES as readonly string[]).includes(mode)) return null;
  if (mode === "none") return null;
  return value as AutoplaySpec;
}
