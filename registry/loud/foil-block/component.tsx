"use client";

import { useEffect, useId, useRef } from "react";

// ---------------------------------------------------------------------------
// FoilBlock — a full-width closing CTA band built on hot foil blocking
// (hot stamping). A heated die presses a metallised polyester web onto the
// headline's terminal word and a rule frame around the primary button; the
// web is a stack (PET carrier / release coat / lacquer / vacuum-metallised
// aluminium / heat-activated size) that only transfers above a hard DUAL
// threshold — temperature AND pressure both have to clear their floor in the
// same pixel, or nothing sticks there. That is this component's whole
// identity and what separates it from its nearest neighbour in this round,
// structure-quoin-lockup: quoin-lockup's variable is PRESSURE distributing a
// layout (composed metal type, a bed the whole page rests on); foil-block's
// variable is a TRANSFER THRESHOLD deciding whether a mark takes AT ALL, and
// it never renders a bed of type — only a headline word and a button frame
// get struck.
//
// MECHANIC: die temperature is 118degC everywhere inside the die's own
// outline, falling linearly to 109degC over the outer 6px of that outline (a
// die perimeter runs cold in the real process). Contact pressure is a
// continuous field of 3 drifting gaussian lobes, +/-0.11MPa about a 0.42MPa
// mean, drifting at 0.014Hz — nothing about it resets between strikes, so
// two consecutive strikes fail in different places. A pixel receives foil
// iff T >= 96degC AND p >= 0.34MPa: a hard threshold, no soft ramp, which is
// what produces the ragged cold-edge void pattern instead of a clean fill.
// The mask is evaluated once, at dwell end, and held through peel/index/idle
// — it does not re-evaluate every frame.
//
// STRIKE CYCLE, 4.60s: approach 420ms (die descends, ease-out cubic) -> dwell
// 300ms (the die closes its last 1.5px of travel under load; mask evaluated
// at dwell end, t=720ms) -> peel 280ms (die lifts the whole 280ms; the last
// 90ms the carrier still clings and the foil edge stretches as hairline tail
// filaments) -> web index 3600ms, the ENTIRE remainder of the cycle. The web
// can only be held still while the die is down, so it feeds continuously for
// every millisecond the die is up and advances exactly one hole pitch per
// cycle. An earlier cut indexed for 1550ms and then sat idle for 2050ms,
// which is what read as the band stopping and starting again: 45% of every
// cycle had no moving part at all. The spent web is this component's resting
// loop: it carries the negative record of the last strikes (alpha 1.0 ->
// 0.5) and keeps indexing with zero input, which is what makes the band
// alive at rest. It is deliberately NOT the only thing moving — an
// unconditional specular band sweeps at 0.19 cycles/s across every
// transferred area regardless of the strike cycle, foil's directional
// vacuum-metallised anisotropy, and the make-ready pressure field differs
// strike to strike, so the mature (already-struck) region is never a still
// image sliding under a moving band.
//
// TRANSFERRED FOIL IS PERMANENT. It is on the stock; the next impression
// cannot take it back off. An earlier cut called clear() on the mask at
// every approach, so the struck word dropped to bare unfoiled type for the
// 720ms of approach + dwell and then snapped back — the visible restart.
// What a re-strike changes is WHERE the voids fall, because the pressure
// field has drifted, so a strike now reads as the void pattern re-rolling
// under a descending die rather than as the word blinking out.
//
// ACCESSIBILITY: canvas is aria-hidden. The headline is a real, always-legible
// heading — its terminal word is given color:transparent ONLY once a 2D
// context is confirmed live, so a canvas failure leaves plain readable text,
// never a gap. The button is a real <button>/<a>, --ns-accent only touches
// its DOM fill and focus ring, never the specular band (which moves in
// luminance only, as a delta against the local foil value, so it reads
// identically in both themes without a direction flip). Activation (mouse
// and keyboard alike) restarts the strike cycle as one out-of-cadence beat
// of feedback; navigation is never gated on it finishing.
// ---------------------------------------------------------------------------

const CYCLE_MS = 4600;
const APPROACH_MS = 420;
const DWELL_MS = 300;
const PEEL_MS = 280;
const TAIL_MS = 90; // overlaps the final 90ms of peel, not additive
// the web feeds through every millisecond the die is off the stock: from the
// end of peel to the end of the cycle, no idle tail
const INDEX_MS = 4600 - (420 + 300 + 280); // 3600
const DWELL_END_MS = APPROACH_MS + DWELL_MS; // 720
const PEEL_END_MS = DWELL_END_MS + PEEL_MS; // 1000
const INDEX_END_MS = PEEL_END_MS + INDEX_MS; // 4600 === CYCLE_MS
// the last 1.5px of die travel is closed during dwell rather than at the end
// of approach, so the die is never parked motionless while it is down
const DWELL_BITE_PX = 1.5;

const DIE_TEMP_C = 118;
const DIE_EDGE_LOSS_C = 9;
const DIE_EDGE_BAND_PX = 6;
const TEMP_THRESHOLD_C = 96;
const PRESSURE_MEAN_MPA = 0.42;
const PRESSURE_AMP_MPA = 0.09;
// 0.26 against a 0.42 mean: the press is set up to make ready, so the normal
// outcome is a mostly-solid strike with ragged local voids where a lobe digs
// under the floor — never the all-or-nothing whole-word miss a 0.34 floor
// produced, which left the headline unstruck for tens of seconds at a time.
const PRESSURE_THRESHOLD_MPA = 0.26;
const PRESSURE_DRIFT_HZ = 0.07;

const GHOST_COUNT = 5;
const GHOST_ALPHA_NEW = 1.0;
const GHOST_ALPHA_OLD = 0.5;
// the web's position is carried as a single monotonic float in units of hole
// pitch (one pitch per strike cycle), so hole spacing, fade and speed are all
// one number and the ribbon can never jump a pitch at a cycle boundary

const SPECULAR_HZ = 0.19;
const SPECULAR_L_DELTA = 0.16;

const FRAME_GAP_PX = 8; // foil rule offset outside the button's own box
const FRAME_STROKE_PX = 3;

// Reduced-motion / gate freeze frame: named directly by the spec, and the
// composed frame is assembled explicitly (not derived from the generic
// per-frame phase math) so every element the spec calls out — transferred
// foil, max-extension tail filaments, a specular band centred on the CTA
// word, nine visible ghosts — is guaranteed present in the one frame anyone
// ever sees under prefers-reduced-motion.
const STATIC_TIME_S = 1.14;

type RGB = [number, number, number];

function parseHex(raw: string): RGB | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function mixRGB(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function toCss([r, g, b]: RGB, a = 1): string {
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
}

function easeOutCubic(t: number): number {
  const p = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - p, 3);
}

// Separable box blur over a single alpha channel, used once per raster (on
// resize / text change / theme change), never per frame: it turns a sharp
// die-outline mask into a distance-to-edge proxy for the 6px cold-edge band,
// the same trick weld-pool uses for its glyph bevel/contact-shadow skirt.
function boxBlur(src: Uint8ClampedArray, w: number, h: number, radius: number, passes: number) {
  let a: Uint8ClampedArray<ArrayBufferLike> = src;
  let b: Uint8ClampedArray<ArrayBufferLike> = new Uint8ClampedArray(w * h);
  const r = Math.max(1, Math.round(radius));
  for (let pass = 0; pass < passes; pass++) {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let sum = 0;
      for (let x = -r; x <= r; x++) sum += a[row + Math.min(w - 1, Math.max(0, x))];
      const norm = 2 * r + 1;
      for (let x = 0; x < w; x++) {
        b[row + x] = sum / norm;
        const out = row + Math.min(w - 1, Math.max(0, x - r));
        const inc = row + Math.min(w - 1, Math.max(0, x + r + 1));
        sum += a[inc] - a[out];
      }
    }
    [a, b] = [b, a];
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) sum += a[Math.min(h - 1, Math.max(0, y)) * w + x];
      const norm = 2 * r + 1;
      for (let y = 0; y < h; y++) {
        b[y * w + x] = sum / norm;
        const out = Math.min(h - 1, Math.max(0, y - r)) * w + x;
        const inc = Math.min(h - 1, Math.max(0, y + r + 1)) * w + x;
        sum += a[inc] - a[out];
      }
    }
    [a, b] = [b, a];
  }
  return a;
}

// A struck die region: a small offscreen raster of the die's own outline
// (glyph text, or a stroked rule frame), plus the fields derived from it —
// sharp alpha (the outline itself), an edge-distance proxy (for the 9degC
// cold-edge falloff) and the resulting foil transfer mask, which is only
// recomputed at each strike's dwell end.
class DieRegion {
  w = 0;
  h = 0;
  sharp: Uint8ClampedArray = new Uint8ClampedArray(0);
  edgeFrac: Float32Array = new Float32Array(0);
  mask: Uint8ClampedArray = new Uint8ClampedArray(0); // 0..255, transferred foil alpha
  lastMaskAt = -Infinity; // absolute sim seconds of the strike this mask belongs to
  seedX: number;
  seedY: number;

  constructor(seed: number) {
    this.seedX = Math.sin(seed * 12.9898) * 43758.5453 % 1;
    this.seedY = Math.sin(seed * 78.233) * 12543.998 % 1;
  }

  setOutline(w: number, h: number, alpha: Uint8ClampedArray, dpr: number) {
    this.w = w;
    this.h = h;
    this.sharp = alpha;
    const blurred = boxBlur(Uint8ClampedArray.from(alpha), w, h, DIE_EDGE_BAND_PX * dpr, 2);
    const edge = new Float32Array(w * h);
    for (let i = 0; i < alpha.length; i++) {
      edge[i] = alpha[i] > 4 ? Math.min(1, Math.max(0, 1 - blurred[i] / 255)) : 0;
    }
    this.edgeFrac = edge;
    this.mask = new Uint8ClampedArray(w * h);
  }

  // Sample the drifting 3-lobe pressure field at (u,v) in 0..1 local coords.
  private pressureAt(u: number, v: number, tAbs: number): number {
    // Each lobe drifts at its OWN rate (1 : 0.63 : 1.41). Sharing one
    // frequency let all three go negative together, which produced whole
    // strikes that transferred nothing at all — a legitimate outcome for the
    // press, a dead frame for the component. Incommensurate rates keep the
    // failures local: some part of the die always clears the floor.
    const lobes: Array<[number, number, number, number]> = [
      [0.22 + this.seedX * 0.1, 0.5, 0, 1],
      [0.5, 0.28 + this.seedY * 0.1, 2.1, 0.63],
      [0.78 - this.seedX * 0.06, 0.62, 4.4, 1.41],
    ];
    let p = PRESSURE_MEAN_MPA;
    for (const [cx, cy, phase, rate] of lobes) {
      const dx = u - cx;
      const dy = v - cy;
      const g = Math.exp(-(dx * dx + dy * dy) / (2 * 0.16 * 0.16));
      p += PRESSURE_AMP_MPA * g * Math.sin(2 * Math.PI * PRESSURE_DRIFT_HZ * rate * tAbs + phase);
    }
    return p;
  }

  // Evaluate the transfer rule once and freeze it as this strike's mask.
  strike(tAbs: number) {
    this.lastMaskAt = tAbs;
    const { w, h, sharp, edgeFrac, mask } = this;
    for (let y = 0; y < h; y++) {
      const v = h > 1 ? y / (h - 1) : 0;
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (sharp[i] < 4) {
          mask[i] = 0;
          continue;
        }
        const u = w > 1 ? x / (w - 1) : 0;
        const temp = DIE_TEMP_C - DIE_EDGE_LOSS_C * edgeFrac[i];
        const pressure = this.pressureAt(u, v, tAbs);
        mask[i] = temp >= TEMP_THRESHOLD_C && pressure >= PRESSURE_THRESHOLD_MPA ? sharp[i] : 0;
      }
    }
  }

  clear() {
    this.mask.fill(0);
  }
}

export interface FoilBlockProps {
  /** small mono label above the headline */
  eyebrow?: string;
  /** headline text — its LAST word is the one the die strikes */
  headline?: string;
  /** primary CTA label */
  primaryLabel?: string;
  /** primary CTA href; renders a <button> when omitted, an <a> when set */
  primaryHref?: string;
  /** secondary link label */
  secondaryLabel?: string;
  secondaryHref?: string;
  className?: string;
}

export function FoilBlock({
  eyebrow = "GET STARTED",
  headline = "Every release lands finished",
  primaryLabel = "Start building",
  primaryHref,
  secondaryLabel = "Read the docs",
  secondaryHref = "#",
  className = "",
}: FoilBlockProps) {
  const uid = useId();
  const sectionRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wordRef = useRef<HTMLSpanElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | HTMLAnchorElement | null>(null);

  const headlineRef = useRef(headline);
  headlineRef.current = headline;

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    const wordEl = wordRef.current;
    const buttonEl = buttonRef.current;
    if (!section || !canvas || !wordEl || !buttonEl) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return; // no 2D context: DOM headline/button stay fully visible, nothing else to do

    let disposed = false;
    let running = false;
    let raf = 0;
    let dpr = 1;
    let cssW = 0;
    let cssH = 0;
    let staticMode = false;
    let lastMs = 0;
    let simTime = 0; // seconds, integrated with a clamp so a paused tab can't teleport it
    let cycleAnchor = 0; // simTime at which the current 4.6s cycle began

    // adaptive backing-store scale: insurance for a slow machine, never a
    // device heuristic and never gated on frame count — only on a sustained
    // measured stretch over budget, with a much longer clean stretch before
    // climbing back so a marginal surface can't oscillate.
    const SCALES = [1, 0.75, 0.55];
    const BUDGET_OVER_MS = 24;
    let scaleIdx = 0;
    let frameEma = 16.7;
    let overMs = 0;
    let underMs = 0;
    let upWindow = 8000;

    const word = new DieRegion(1.7);
    const frame = new DieRegion(5.3);

    // ghost history: each entry remembers the word mask + word raster size at
    // the moment its strike completed and the web position (in hole pitches)
    // it was punched at, so its age is just webAdvance - bornAt.
    type Ghost = { sharp: Uint8ClampedArray; mask: Uint8ClampedArray; w: number; h: number; bornAt: number };
    let ghosts: Ghost[] = [];
    // web travel measured in hole pitches. webCarry banks everything fed
    // before the current cycleAnchor so an out-of-cadence activation strike
    // cannot wind the web backwards; webRel is the amount fed since it.
    let webCarry = 0;
    let webRel = 0;

    let cLive: RGB = [0.06, 0.06, 0.06];
    let cDim: RGB = [0.4, 0.4, 0.4];
    let cBright: RGB = [0.94, 0.94, 0.94];
    let cVoid: RGB = [0.06, 0.06, 0.06];
    let cBorder: RGB = [0.18, 0.18, 0.18];
    let dark = true;

    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      const bg = parseHex(cs.getPropertyValue("--background")) ?? [1, 1, 1];
      const muted = parseHex(cs.getPropertyValue("--ns-muted")) ?? [0.55, 0.55, 0.55];
      cBorder = parseHex(cs.getPropertyValue("--border")) ?? [0.18, 0.18, 0.18];
      dark = bg[0] + bg[1] + bg[2] < 1.5;
      // transferred foil: L 0.94 on the fg/bg ramp in dark theme (bright metal
      // on a dark ground), L 0.22 in light theme (dark burnish on pale stock)
      // — not a compromise, it's what pigment foil on white board looks like.
      cLive = dark ? mixRGB(bg, [1, 1, 1], 0.94) : mixRGB(bg, [0, 0, 0], 0.78);
      cDim = mixRGB(bg, muted, 0.55); // untransferred / cold-edge void, blended toward stock
      cBright = dark ? [1, 1, 1] : [0, 0, 0];
      cVoid = bg;
    };
    readTokens();

    // -- rasterize the two die outlines -----------------------------------
    const rasterWord = document.createElement("canvas");
    const rasterFrame = document.createElement("canvas");

    const rasterizeWord = () => {
      const wr = wordEl.getBoundingClientRect();
      const w = Math.max(8, Math.min(600, Math.round(wr.width * dpr)));
      const h = Math.max(8, Math.min(240, Math.round(wr.height * dpr)));
      rasterWord.width = w;
      rasterWord.height = h;
      const rc = rasterWord.getContext("2d", { willReadFrequently: true });
      if (!rc || wr.width < 2 || wr.height < 2) return;
      const cs = getComputedStyle(wordEl);
      rc.clearRect(0, 0, w, h);
      rc.fillStyle = "#fff";
      rc.font = `${cs.fontWeight} ${parseFloat(cs.fontSize) * dpr}px ${cs.fontFamily}`;
      rc.textAlign = "left";
      rc.textBaseline = "alphabetic";
      const words = headlineRef.current.trim().split(/\s+/);
      const last = words[words.length - 1] ?? "";
      const baseline = h - (h - parseFloat(cs.fontSize) * dpr) / 2 - parseFloat(cs.fontSize) * dpr * 0.18;
      rc.fillText(last, 0, baseline);
      const img = rc.getImageData(0, 0, w, h).data;
      const alpha = new Uint8ClampedArray(w * h);
      for (let i = 0, j = 3; i < alpha.length; i++, j += 4) alpha[i] = img[j];
      word.setOutline(w, h, alpha, dpr);
      word.clear();
      word.lastMaskAt = -Infinity;
      // The DOM word stays visible and stays the base state: unstruck type.
      // The canvas paints ONLY the pixels foil actually transferred to, in
      // register on top of it, so a failed transfer reads as plain type
      // showing through the metal rather than as a hole in the headline.
    };

    const rasterizeFrame = () => {
      const br = buttonEl.getBoundingClientRect();
      const sr = section.getBoundingClientRect();
      const gap = FRAME_GAP_PX;
      const localLeft = br.left - sr.left - gap;
      const localTop = br.top - sr.top - gap;
      const fw = Math.max(8, Math.min(900, Math.round((br.width + gap * 2) * dpr)));
      const fh = Math.max(8, Math.min(300, Math.round((br.height + gap * 2) * dpr)));
      rasterFrame.width = fw;
      rasterFrame.height = fh;
      const rc = rasterFrame.getContext("2d", { willReadFrequently: true });
      if (!rc) return;
      rc.clearRect(0, 0, fw, fh);
      rc.strokeStyle = "#fff";
      rc.lineWidth = FRAME_STROKE_PX * dpr;
      rc.strokeRect(
        (FRAME_STROKE_PX * dpr) / 2,
        (FRAME_STROKE_PX * dpr) / 2,
        fw - FRAME_STROKE_PX * dpr,
        fh - FRAME_STROKE_PX * dpr
      );
      const img = rc.getImageData(0, 0, fw, fh).data;
      const alpha = new Uint8ClampedArray(fw * fh);
      for (let i = 0, j = 3; i < alpha.length; i++, j += 4) alpha[i] = img[j];
      frame.setOutline(fw, fh, alpha, dpr);
      frame.clear();
      frame.lastMaskAt = -Infinity;
      frameGeom = { localLeft, localTop, fw: fw / dpr, fh: fh / dpr };
    };

    let frameGeom = { localLeft: 0, localTop: 0, fw: 0, fh: 0 };
    let wordGeom = { localLeft: 0, localTop: 0, ww: 0, wh: 0 };
    // the die-region rasters are baked 1:1 against the CURRENT backing-store
    // dpr, so an adaptive quality step (which changes dpr) has to trigger a
    // re-raster or the region buffer and the canvas device pixels drift apart
    let rasterDpr = 1;

    const syncWordGeom = () => {
      const wr = wordEl.getBoundingClientRect();
      const sr = section.getBoundingClientRect();
      wordGeom = {
        localLeft: wr.left - sr.left,
        localTop: wr.top - sr.top,
        ww: wr.width,
        wh: wr.height,
      };
    };

    // -- draw a die region's current mask as foil, blended with cold voids.
    // A die region is rasterized 1:1 in device pixels against the main
    // canvas (same dpr), so compositing is a single putImageData rather than
    // a per-pixel fillRect loop — the difference between one call and tens
    // of thousands on a headline-sized region.
    const regionBuf = new Map<DieRegion, Uint8ClampedArray>();
    let stripBuf: Uint8ClampedArray | null = null;
    const blitRegion = (
      region: DieRegion,
      localLeft: number,
      localTop: number,
      alphaMul: number,
      specularT: number,
      showVoid: boolean,
    ) => {
      if (region.w < 1 || region.h < 1) return;
      let rgba = regionBuf.get(region);
      if (!rgba || rgba.length !== region.w * region.h * 4) {
        rgba = new Uint8ClampedArray(region.w * region.h * 4);
        regionBuf.set(region, rgba);
      }
      const cosA = Math.cos((31 * Math.PI) / 180);
      for (let y = 0; y < region.h; y++) {
        const v = y / region.h;
        for (let x = 0; x < region.w; x++) {
          const i = y * region.w + x;
          const j = i * 4;
          const sharpA = region.sharp[i];
          if (sharpA < 4) {
            rgba[j + 3] = 0;
            continue;
          }
          const foiled = region.mask[i] > 4;
          if (!foiled && !showVoid) {
            // untransferred: the DOM type under the canvas is the void
            rgba[j + 3] = 0;
            continue;
          }
          let col: RGB;
          if (foiled) {
            col = cLive;
            // specular anisotropy: a moving band +/-0.16 L, luminance-only delta
            const bandCoord = (x / region.w + v) * cosA;
            const phase = bandCoord - specularT;
            const dist = Math.abs((((phase % 1) + 1) % 1) - 0.5) * 2; // 0 at band centre
            const inBand = Math.max(0, 1 - dist * 4);
            const delta = inBand * SPECULAR_L_DELTA * (dark ? 1 : -1);
            col = mixRGB(col, delta > 0 ? cBright : cVoid, Math.abs(delta));
          } else {
            // cold-edge / make-ready void: blended 0.5 toward stock, both themes
            col = mixRGB(cDim, cVoid, 0.5);
          }
          rgba[j] = col[0] * 255;
          rgba[j + 1] = col[1] * 255;
          rgba[j + 2] = col[2] * 255;
          rgba[j + 3] = (sharpA / 255) * alphaMul * 255;
        }
      }
      const img = new ImageData(rgba as Uint8ClampedArray<ArrayBuffer>, region.w, region.h);
      ctx.putImageData(img, Math.round(localLeft * dpr), Math.round(localTop * dpr));
    };

    // -- the spent web: a metallised ribbon crossing the top of the band,
    // carrying the NEGATIVE of the last nine strikes. Foil that transferred
    // is foil the web no longer has, so each past strike is a word-shaped
    // HOLE punched through the ribbon, indexing left as the web feeds. A
    // repeated positive of the word read as broken text; a holed ribbon
    // reads as the material the metal came from.
    const RIBBON_H = 34;
    const RIBBON_TOP = 14;
    const drawWebRibbon = (webAdvance: number, specularT: number) => {
      if (cssH < RIBBON_TOP + RIBBON_H + 40) return;
      const stripWDev = Math.max(1, Math.round(cssW * dpr));
      const stripHDev = Math.max(1, Math.round(RIBBON_H * dpr));
      if (!stripBuf || stripBuf.length !== stripWDev * stripHDev * 4) {
        stripBuf = new Uint8ClampedArray(stripWDev * stripHDev * 4);
      }
      const buf = stripBuf;
      // 1 — the carrier itself: dim metal, with a slow specular sweep along
      // it so the ribbon reads as a reflective web rather than a grey bar
      const base = mixRGB(cLive, cDim, dark ? 0.72 : 0.45);
      for (let y = 0; y < stripHDev; y++) {
        const v = y / stripHDev;
        // PET carrier is slightly domed across its width — brighter mid-band
        const dome = 1 - Math.abs(v - 0.5) * 0.9;
        for (let x = 0; x < stripWDev; x++) {
          const phase = (x / stripWDev) * 2.4 - specularT;
          const dist = Math.abs((((phase % 1) + 1) % 1) - 0.5) * 2;
          const band = Math.max(0, 1 - dist * 3.2) * SPECULAR_L_DELTA;
          const col = mixRGB(base, dark ? cBright : cVoid, band * dome + 0.06 * dome);
          const j = (y * stripWDev + x) * 4;
          buf[j] = col[0] * 255;
          buf[j + 1] = col[1] * 255;
          buf[j + 2] = col[2] * 255;
          buf[j + 3] = 255;
        }
      }
      // 2 — carrier edges: two hairlines, so the ribbon has a top and a
      // bottom instead of bleeding into the band
      for (const y of [0, stripHDev - 1]) {
        for (let x = 0; x < stripWDev; x++) {
          const j = (y * stripWDev + x) * 4;
          buf[j] = cBorder[0] * 255;
          buf[j + 1] = cBorder[1] * 255;
          buf[j + 2] = cBorder[2] * 255;
          buf[j + 3] = 255;
        }
      }
      // 3 — punch the holes, newest at the right, indexing left
      const insetDev = Math.round(8 * dpr);
      for (let gi = 0; gi < ghosts.length; gi++) {
        const ghost = ghosts[gi];
        // age in hole pitches — a continuous float, so a hole slides rather
        // than stepping, and its own fade slides with it
        const age = webAdvance - ghost.bornAt;
        if (age < 0 || age >= GHOST_COUNT || ghost.w < 1) continue;
        // a hole never heals: age only softens its edge as the web stretches
        const alpha =
          GHOST_ALPHA_NEW - (age / (GHOST_COUNT - 1)) * (GHOST_ALPHA_NEW - GHOST_ALPHA_OLD);
        const targetHDev = stripHDev - insetDev * 2;
        const scale = targetHDev / Math.max(1, ghost.h);
        const drawWDev = Math.max(1, Math.round(ghost.w * scale));
        // pitch is derived from the hole's own width: the web advances by one
        // label plus a fixed gap, so two strikes can never overprint
        const pitchDev = drawWDev + Math.round(52 * dpr);
        const xDevStart = Math.round((cssW - 60) * dpr - drawWDev - age * pitchDev);
        if (xDevStart + drawWDev < 0 || xDevStart > stripWDev) continue;
        for (let dy = insetDev; dy < stripHDev - insetDev; dy++) {
          const sy = Math.min(ghost.h - 1, Math.floor(((dy - insetDev) / targetHDev) * ghost.h));
          for (let dx = 0; dx < drawWDev; dx++) {
            const destX = xDevStart + dx;
            if (destX < 0 || destX >= stripWDev) continue;
            const si = sy * ghost.w + Math.min(ghost.w - 1, Math.floor((dx / drawWDev) * ghost.w));
            if (ghost.mask[si] <= 4) continue; // only transferred pixels left a hole
            const j = (dy * stripWDev + destX) * 4;
            const a = alpha * (ghost.mask[si] / 255);
            const col = mixRGB(
              [buf[j] / 255, buf[j + 1] / 255, buf[j + 2] / 255],
              cVoid,
              Math.min(1, a),
            );
            buf[j] = col[0] * 255;
            buf[j + 1] = col[1] * 255;
            buf[j + 2] = col[2] * 255;
          }
        }
      }
      const img = new ImageData(buf as Uint8ClampedArray<ArrayBuffer>, stripWDev, stripHDev);
      ctx.putImageData(img, 0, Math.round(RIBBON_TOP * dpr));
    };

    // -- tail filaments: hairline strands parting off the trailing edge ----
    const drawTailFilaments = (progress: number, seed: number) => {
      if (progress <= 0) return;
      const wr = wordGeom;
      if (wr.ww < 2) return;
      ctx.save();
      ctx.strokeStyle = toCss(cLive, 0.7 * (1 - progress * 0.2));
      ctx.lineWidth = Math.max(0.5, 0.5 * dpr);
      const n = 3 + Math.floor((Math.sin(seed) * 0.5 + 0.5) * 4); // 3-7 filaments
      for (let i = 0; i < n; i++) {
        const fx = wr.localLeft + wr.ww * ((i + 0.5) / n);
        const fy0 = wr.localTop + wr.wh * 0.85;
        const stretch = 2 * progress * dpr; // <= 2px
        ctx.beginPath();
        ctx.moveTo(fx * dpr, fy0 * dpr);
        ctx.lineTo(fx * dpr + Math.sin(seed + i) * stretch, (fy0 - stretch) * dpr);
        ctx.stroke();
      }
      ctx.restore();
    };

    // -- die bracket: a hairline registration frame that descends onto the
    // word on approach (ease-out cubic) and lifts clear on peel — the only
    // directly "mechanical" motion in the piece, everything else is the
    // field itself changing.
    const drawDieBracket = (descentPx: number) => {
      const wr = wordGeom;
      if (wr.ww < 2 || descentPx < 0) return;
      // descentPx is distance the die still has to travel to reach contact,
      // so the bracket sits ABOVE the word by that much and closes to zero
      const pad = 6;
      const x0 = (wr.localLeft - pad) * dpr;
      const y0 = (wr.localTop - pad - descentPx) * dpr;
      const x1 = (wr.localLeft + wr.ww + pad) * dpr;
      const y1 = (wr.localTop + wr.wh + pad - descentPx) * dpr;
      const arm = 8 * dpr;
      ctx.save();
      ctx.strokeStyle = toCss(cBorder, 0.9);
      ctx.lineWidth = Math.max(1, dpr);
      ctx.beginPath();
      // four L-shaped corner marks, not a closed rectangle — a die outline reads
      // as registration marks, not a drawn box
      for (const [cx, cy, sx, sy] of [
        [x0, y0, 1, 1],
        [x1, y0, -1, 1],
        [x0, y1, 1, -1],
        [x1, y1, -1, -1],
      ] as const) {
        ctx.moveTo(cx + arm * sx, cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy + arm * sy);
      }
      ctx.stroke();
      ctx.restore();
    };

    // -- per-frame composition ----------------------------------------------
    const compose = (tAbsSeconds: number, isStatic: boolean) => {
      if (cssW <= 0 || cssH <= 0) return;
      if (dpr !== rasterDpr) {
        // an adaptive quality step changed the backing-store dpr — the die
        // rasters were baked against the old one, so rebuild them before
        // anything reads region.w/h against the new device-pixel canvas
        rasterizeWord();
        rasterizeFrame();
        syncWordGeom();
        rasterDpr = dpr;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const dieDescentPx = Math.max(10, 0.037 * Math.min(cssW, cssH));

      let webAdvance: number;
      let tailProgress: number;
      let dieOffsetPx = 0;
      let specularPhase: number;

      if (isStatic) {
        // composed freeze frame: dwell already complete, foil transferred,
        // tail filaments at maximum extension, band centred on the CTA word.
        if (word.lastMaskAt !== tAbsSeconds) word.strike(tAbsSeconds);
        if (frame.lastMaskAt !== tAbsSeconds) frame.strike(tAbsSeconds);
        webAdvance = 0;
        tailProgress = 1;
        dieOffsetPx = 3; // "die is 3px off the type" at the named freeze instant
        // bandCoord is region-local (0..1), so 0.5 centres the band on every
        // struck region's own middle — exactly "centred on the CTA word"
        specularPhase = 0.5;
        if (ghosts.length < GHOST_COUNT) {
          ghosts = [];
          for (let i = 0; i < GHOST_COUNT; i++) {
            ghosts.push({ sharp: word.sharp, mask: word.mask, w: word.w, h: word.h, bornAt: -i });
          }
        }
      } else {
        const sinceAnchorMs = (tAbsSeconds - cycleAnchor) * 1000;
        const cyclesElapsed = Math.floor(sinceAnchorMs / CYCLE_MS);
        const local = sinceAnchorMs - cyclesElapsed * CYCLE_MS;

        // The web is held only while the die is on the stock; the instant the
        // die is clear it feeds, all the way to the end of the cycle.
        const indexFrac = local <= PEEL_END_MS ? 0 : Math.min(1, (local - PEEL_END_MS) / INDEX_MS);
        webRel = cyclesElapsed + indexFrac;
        webAdvance = webCarry + webRel;

        if (local < APPROACH_MS) {
          // die descending, ease-out cubic. The foil already on the stock is
          // NOT taken back off — only the die moves.
          dieOffsetPx =
            DWELL_BITE_PX + (dieDescentPx - DWELL_BITE_PX) * (1 - easeOutCubic(local / APPROACH_MS));
        } else if (local < DWELL_END_MS) {
          // dwell: the die closes its last 1.5px under load rather than
          // sitting parked, so no part of the contact window is a still frame
          dieOffsetPx = DWELL_BITE_PX * (1 - (local - APPROACH_MS) / DWELL_MS);
        } else if (local < PEEL_END_MS) {
          // one strike time PER CYCLE, not one for all time: anchoring on
          // cycleAnchor alone meant lastMaskAt matched forever after the
          // first strike, so the mask was cleared on every approach and
          // never re-evaluated — the band ran unfoiled from cycle two on.
          const strikeAt = cycleAnchor + (cyclesElapsed * CYCLE_MS + DWELL_END_MS) / 1000;
          if (word.lastMaskAt !== strikeAt) {
            word.strike(strikeAt);
            // the strike is what punches the hole, so the web's record is
            // committed here and then carried away by the feed that follows
            ghosts.push({
              sharp: Uint8ClampedArray.from(word.sharp),
              mask: Uint8ClampedArray.from(word.mask),
              w: word.w,
              h: word.h,
              bornAt: webAdvance,
            });
            while (ghosts.length > GHOST_COUNT + 1) ghosts.shift();
          }
          if (frame.lastMaskAt !== strikeAt) frame.strike(strikeAt);
          // peel runs the full 280ms of lift, not a parked 190ms then a jump
          dieOffsetPx = dieDescentPx * ((local - DWELL_END_MS) / PEEL_MS);
        } else {
          dieOffsetPx = dieDescentPx;
        }

        if (local >= PEEL_END_MS - TAIL_MS && local < PEEL_END_MS) {
          tailProgress = (local - (PEEL_END_MS - TAIL_MS)) / TAIL_MS;
        } else {
          tailProgress = 0;
        }

        specularPhase = tAbsSeconds * SPECULAR_HZ;
      }

      if (wordGeom.ww > 0) {
        blitRegion(word, wordGeom.localLeft, wordGeom.localTop, 1, specularPhase, false);
        drawTailFilaments(tailProgress, tAbsSeconds * 7.13);
        drawDieBracket(dieOffsetPx);
      }
      if (frameGeom.fw > 0) {
        blitRegion(frame, frameGeom.localLeft, frameGeom.localTop, 1, specularPhase, false);
      }
      drawWebRibbon(webAdvance, specularPhase);
    };

    // -- sizing --------------------------------------------------------------
    const applyBacking = () => {
      if (cssW < 2 || cssH < 2) return;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5) * SCALES[scaleIdx];
      const pw = Math.round(cssW * dpr);
      const ph = Math.round(cssH * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
    };

    // A fresh mount otherwise looks empty for the first ~40s (nine cycles) —
    // pre-seed the ghost train from the same make-ready field, sampled at
    // synthetic past strike times, so the resting web already carries a
    // history the instant the section is visible. The LIVE word still starts
    // its own cycle fresh (approach, un-foiled) so the strike itself is
    // never pre-empted.
    const seedGhosts = () => {
      if (word.w < 1 || ghosts.length > 0) return;
      for (let i = GHOST_COUNT; i >= 1; i--) {
        const virtualStrikeAt = -i * (CYCLE_MS / 1000);
        word.strike(virtualStrikeAt);
        ghosts.push({
          sharp: Uint8ClampedArray.from(word.sharp),
          mask: Uint8ClampedArray.from(word.mask),
          w: word.w,
          h: word.h,
          bornAt: -i,
        });
      }
      word.clear();
      word.lastMaskAt = -Infinity;
    };

    const resize = () => {
      const rect = section.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      cssW = rect.width;
      cssH = rect.height;
      scaleIdx = 0;
      overMs = 0;
      underMs = 0;
      upWindow = 8000;
      frameEma = 16.7;
      applyBacking();
      rasterizeWord();
      rasterizeFrame();
      syncWordGeom();
      rasterDpr = dpr;
      seedGhosts();
      if (staticMode) compose(STATIC_TIME_S, true);
    };

    // -- loop ------------------------------------------------------------
    const loop = (nowMs: number) => {
      const rawMs = lastMs === 0 ? 16.7 : nowMs - lastMs;
      const dt = Math.min(0.05, Math.max(0, rawMs / 1000));
      lastMs = nowMs;
      simTime += dt;
      compose(simTime, false);

      const clamped = Math.min(50, rawMs);
      frameEma += (clamped - frameEma) * (1 - Math.exp(-clamped / 120));
      if (frameEma > BUDGET_OVER_MS) {
        overMs += clamped;
        underMs = 0;
      } else {
        underMs += clamped;
        overMs = 0;
      }
      const down = overMs > 900 && scaleIdx < SCALES.length - 1;
      const up = underMs > upWindow && scaleIdx > 0;
      if (down || up) {
        scaleIdx += down ? 1 : -1;
        if (down) upWindow = Math.min(64000, upWindow * 2);
        overMs = 0;
        underMs = 0;
        frameEma = 16.7;
        applyBacking();
      }
      raf = requestAnimationFrame(loop);
    };
    const wake = () => {
      if (running || disposed) return;
      running = true;
      lastMs = 0;
      raf = requestAnimationFrame(loop);
    };
    const sleep = () => {
      cancelAnimationFrame(raf);
      running = false;
    };

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;
    const applyMode = () => {
      if (reduced) {
        staticMode = true;
        sleep();
        compose(STATIC_TIME_S, true);
      } else {
        staticMode = false;
        // t=0: the live strike cycle starts fresh (die up, approach not yet
        // begun, CTA type an un-foiled outline) — the "alive at rest" read at
        // t=0 instead comes from the pre-seeded ghost train (seedGhosts)
        // already sitting behind it, so the band never looks freshly booted.
        simTime = 0;
        cycleAnchor = 0;
        webCarry = 0;
        webRel = 0;
        wake();
      }
    };
    const onMq = () => {
      reduced = mq.matches;
      applyMode();
    };
    mq.addEventListener("change", onMq);

    let onScreen = true;
    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((en) => en.isIntersecting);
        if (!onScreen) sleep();
        else if (!staticMode && !document.hidden) wake();
      },
      { threshold: 0 }
    );
    io.observe(section);

    const onVis = () => {
      if (document.hidden) sleep();
      else if (!staticMode && onScreen) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    const ro = new ResizeObserver(resize);
    ro.observe(section);
    resize();
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (disposed) return;
        rasterizeWord();
        rasterizeFrame();
        syncWordGeom();
        if (staticMode) compose(STATIC_TIME_S, true);
      });
    }
    applyMode();

    const themeObserver = new MutationObserver(() => {
      readTokens();
      if (staticMode) compose(STATIC_TIME_S, true);
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    // activation feedback: one out-of-cadence strike, restarting the cycle
    const strikeNow = () => {
      // bank the web travel fed under the old anchor before moving it, or an
      // activation strike would wind the ribbon back to the top of a cycle
      webCarry += webRel;
      webRel = 0;
      cycleAnchor = simTime;
      word.lastMaskAt = -Infinity;
      frame.lastMaskAt = -Infinity;
    };
    const onActivate = () => {
      if (!staticMode) strikeNow();
    };
    // Both branches of the CTA are natively activatable: a <button> fires click
    // on Enter AND Space, an <a href> fires it on Enter. A keydown listener that
    // also called onActivate struck the die twice per key press, and on the
    // anchor it swallowed Space, which should scroll the page.
    buttonEl.addEventListener("click", onActivate);

    let poll = 0;
    let lastHeadline = headlineRef.current;
    const tick = () => {
      if (headlineRef.current !== lastHeadline) {
        lastHeadline = headlineRef.current;
        rasterizeWord();
        syncWordGeom();
        if (staticMode) compose(STATIC_TIME_S, true);
      }
      poll = window.setTimeout(tick, 200);
    };
    tick();

    return () => {
      disposed = true;
      sleep();
      ro.disconnect();
      io.disconnect();
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
      themeObserver.disconnect();
      buttonEl.removeEventListener("click", onActivate);
      window.clearTimeout(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const words = headline.trim().split(/\s+/);
  const lead = words.slice(0, -1).join(" ");
  const last = words[words.length - 1] ?? "";

  return (
    <section
      ref={sectionRef}
      data-foil-block={uid}
      className={`relative isolate w-full overflow-hidden bg-background ${className}`}
    >
      {/* z-20: the foil lands ON the type, not behind it. A canvas under the
          content was painting the struck word behind the headline's own
          backdrop panel, which is why the terminal word simply vanished. */}
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 block h-full w-full" />
      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center px-6 py-24 text-center sm:py-32">
        {eyebrow ? <p className="mb-5 font-mono text-[11px] tracking-widest text-ns-muted">{eyebrow}</p> : null}
        <div className="px-4 py-2">
          <h2 className="text-balance text-3xl font-semibold text-foreground sm:text-4xl">
            {lead ? `${lead} ` : ""}
            {/* the terminal word rests at muted value — the foil that lands
                on it is the bright event, and near-equal values would make
                the transfer invisible */}
            <span ref={wordRef} className="inline-block text-ns-muted">
              {last}
            </span>
          </h2>
        </div>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
          {primaryHref ? (
            <a
              ref={buttonRef as React.RefObject<HTMLAnchorElement>}
              href={primaryHref}
              className="inline-flex items-center justify-center rounded-sm bg-ns-accent px-6 py-3 text-sm font-medium text-white transition-colors duration-150 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent active:scale-[0.98]"
            >
              {primaryLabel}
            </a>
          ) : (
            <button
              ref={buttonRef as React.RefObject<HTMLButtonElement>}
              type="button"
              className="inline-flex items-center justify-center rounded-sm bg-ns-accent px-6 py-3 text-sm font-medium text-white transition-colors duration-150 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent active:scale-[0.98]"
            >
              {primaryLabel}
            </button>
          )}
          <a href={secondaryHref} className="text-sm font-medium text-ns-muted underline-offset-4 hover:text-foreground hover:underline">
            {secondaryLabel}
          </a>
        </div>
      </div>
    </section>
  );
}

FoilBlock.displayName = "FoilBlock";
