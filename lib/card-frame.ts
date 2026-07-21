/**
 * Card framing hints — how a component is *framed* inside a landing-page card.
 *
 * Sibling concept to `lib/autoplay.ts`, and the other half of the same problem.
 * Autoplay answers "this demo is frozen because nothing is touching it".
 * Framing answers "this demo is unreadable because the thing worth seeing is a
 * speck". A card renders the demo at a real 1440x900 viewport scaled to the
 * card's width (~660px, i.e. 0.46x). A demo whose subject is one 130px button
 * centred in that viewport shows a 60px button in a 660x410 box of empty
 * background — the owner's verdict is "I don't understand what this does", and
 * no amount of motion fixes it.
 *
 * So a component may declare, in its `meta.json`, which element is the subject:
 *
 *   "card": { "focus": "[role=radiogroup]", "padding": 0.4 }
 *
 * The card then scales and translates so that element's box (plus padding)
 * fills the card, instead of showing the whole viewport. Nothing about the
 * component, the demo or the direct `/preview/<name>` link changes — this is
 * purely how the *thumbnail* is cropped.
 *
 * Like autoplay this is site-only metadata: it never reaches `registry.json`,
 * `public/r/*.json` or `llms.txt`, because it says nothing about the
 * component's API. See `scripts/build-autoplay.ts`, which emits it.
 */

export type CardFrame = {
  /**
   * CSS selector, queried inside the preview document. The first match's
   * border box is the subject. Matching nothing (or a zero-size box) falls
   * back to the untouched full-viewport framing — never throws, never zooms
   * onto nothing.
   */
  focus: string;
  /**
   * Breathing room around the subject, as a fraction of its own box, added on
   * every side. `0` crops flush to the element; `0.4` surrounds it with 40% of
   * its own width/height of context. Default {@link DEFAULT_PADDING}.
   */
  padding?: number;
  /**
   * Upper bound on the zoom applied on top of the card's base scale. Guards a
   * tiny subject (a 24px icon) from being blown up to fill the card. Default
   * {@link DEFAULT_MAX_ZOOM}.
   */
  maxZoom?: number;
};

export const DEFAULT_PADDING = 0.15;
export const DEFAULT_MAX_ZOOM = 4;

/** Map of component name -> framing hint, generated from the meta.json sidecars. */
export type CardFrameMap = Record<string, CardFrame>;

/** Narrow unknown JSON to a hint. Anything malformed becomes `null` (no framing). */
export function parseCardFrame(value: unknown): CardFrame | null {
  if (!value || typeof value !== "object") return null;
  const focus = (value as { focus?: unknown }).focus;
  if (typeof focus !== "string" || !focus.trim()) return null;
  return value as CardFrame;
}

export type Fit = { scale: number; tx: number; ty: number };

/**
 * The transform that puts `subject` (in preview-viewport pixels) in the middle
 * of a `cardW` x `cardH` card, given a preview viewport of `frameW` x `frameH`.
 *
 * Fits the *constraining* axis — a tall subject in a wide card is bounded by
 * height, a wide one by width — so the padded subject is always fully visible,
 * then centres it on the other axis. The result is clamped two ways: the zoom
 * never goes below 1 (framing only ever crops in, so an opted-in component can
 * never end up smaller than it is today) nor above `maxZoom`, and the
 * translation is clamped to the frame's own edges so the crop can never expose
 * blank space outside the preview viewport.
 */
export function fitTo(
  subject: { left: number; top: number; width: number; height: number },
  frame: CardFrame,
  cardW: number,
  cardH: number,
  frameW: number,
  frameH: number,
): Fit | null {
  const base = cardW / frameW;
  if (!(subject.width > 0) || !(subject.height > 0)) return null;

  const pad = Math.max(0, frame.padding ?? DEFAULT_PADDING);
  const boxW = subject.width * (1 + pad * 2);
  const boxH = subject.height * (1 + pad * 2);

  const maxZoom = Math.max(1, frame.maxZoom ?? DEFAULT_MAX_ZOOM);
  const zoom = Math.min(maxZoom, Math.max(1, Math.min(cardW / (boxW * base), cardH / (boxH * base))));
  const scale = base * zoom;

  const cx = subject.left + subject.width / 2;
  const cy = subject.top + subject.height / 2;
  // Clamped so the scaled frame always covers the card: tx in [cardW - scale*frameW, 0].
  const tx = clamp(cardW / 2 - scale * cx, cardW - scale * frameW, 0);
  const ty = clamp(cardH / 2 - scale * cy, cardH - scale * frameH, 0);
  return { scale, tx, ty };
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}
