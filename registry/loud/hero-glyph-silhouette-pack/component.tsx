"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// HeroGlyphSilhouettePack — a full-bleed hero where a cloud of monospace
// glyph particles is packed to fill an ARBITRARY VECTOR SILHOUETTE, not a
// grid or a disc. The silhouette is the constraint the packer solves
// against, and the whole point is that the constraint can CHANGE: on a
// timer, with no pointer required, the cloud re-solves against a new
// silhouette and every particle migrates to a freshly-sampled slot inside
// the new shape. That retargeting is the mechanic — masonry-ascii-settle
// resolves glyph PITCH into a fixed rectangular tile grid (coarse -> fine,
// same lattice throughout) and floret-pack grows glyphs outward along a
// fixed golden-angle radial flow from one meristem to one rim — neither ever
// asks "which arbitrary shape do these particles belong inside right now,"
// and neither ever retargets a live population against a second, unrelated
// boundary. Here the boundary itself is swapped at runtime and the same
// live particles are re-assigned into it.
//
// SILHOUETTE = ALPHA MASK, SAMPLED, NOT WALKED. Each shape is authored as
// simple canvas path data (line/arc segments, or rasterized text for a
// wordmark) drawn once into an offscreen canvas; only the alpha channel is
// read back, then box-blurred twice for a cheap "distance-ish" edge
// falloff (no real distance transform). That blurred field is both the
// inside/outside test AND the importance weight for sampling target points:
// interior pixels stay near full weight, edge pixels taper, so the packed
// cloud naturally thins toward the boundary instead of cutting hard.
//
// RE-SOLVE, NOT RESHUFFLE. When the active shape changes, new target points
// are sampled from the new mask and assigned back to the CURRENT live
// particles by sorting both sets on x and pairing in order — a cheap
// approximate nearest-matching that keeps flight paths short and coherent
// (an O(n log n) alternative to real assignment, deliberately not exact).
// Each particle's flight is staggered, eased, and bulges off the straight
// line toward its target — visible migration, not a snap. Breathing (a
// small continuous per-particle wobble) and pointer repulsion apply on top
// of the current interpolated position at every phase, resting or
// migrating, so the cloud is never motionless and never fully static.
// ---------------------------------------------------------------------------

export type SilhouetteId = "wordmark" | "star" | "orbit";

export interface HeroGlyphSilhouettePackProps {
  /** Sequence of silhouettes the cloud cycles through and re-solves against, in order. */
  shapes?: SilhouetteId[];
  /** Text rasterized for the "wordmark" silhouette. */
  wordmarkText?: string;
  /** Live particle count. Derived from the container's smaller dimension when omitted. */
  particleCount?: number;
  /** Glyph charset particles are drawn from, one glyph assigned per particle for its lifetime. */
  glyphs?: string;
  /** How long a shape holds, fully packed, before the next re-solve begins. */
  holdMs?: number;
  /** Flight duration of the slowest-staggered particle during a re-solve. */
  migrateMs?: number;
  /** Content rendered as real DOM above the canvas — headline, eyebrow, CTA. */
  children?: ReactNode;
  className?: string;
}

const DEFAULT_SHAPES: SilhouetteId[] = ["wordmark", "star", "orbit"];
const DEFAULT_GLYPHS = "+x*.oO";
const MASK_LONG_SIDE = 220; // offscreen mask resolution, px, long edge
const MASK_THRESHOLD = 0.05; // blurred-alpha cutoff below which a mask pixel carries no sampling weight
const MAX_DPR = 1.5; // full-bleed loud cap per showpiece-recipe
const MIN_PARTICLES = 180;
const MAX_PARTICLES = 700;
const ALPHA_BUCKETS = 6; // color-blend buckets, batched draw per bucket
const MIGRATE_STAGGER_MS = 420; // spread of per-particle flight start times
const ARC_BULGE = 0.17; // perpendicular bulge as a fraction of flight distance
// Amplitude/frequency chosen so the hold phase (default 2600ms) alone
// crosses a visible fraction of the sine's swing, not just the re-solve —
// a first pass at 2.4px/0.65rad-s-ish sat under the perceptual floor for
// the whole hold, so t0-vs-2.5s differences were carried entirely by the
// migration rather than by breathing at rest.
const WOBBLE_AMP_PX = 4.2; // idle breathing amplitude
const WOBBLE_FREQ = 1.15; // rad/s-ish
const REPEL_RADIUS_PX = 68;
const REPEL_STRENGTH_PX = 40;
const REPEL_EASE = 0.22;

interface Tokens {
  fg: string;
  muted: string;
}

function readTokens(el: HTMLElement): Tokens {
  const cs = getComputedStyle(el);
  return { fg: cs.getPropertyValue("--foreground").trim(), muted: cs.getPropertyValue("--ns-muted").trim() };
}

function parseHex(raw: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(raw.trim());
  if (!m || !m[1]) return null;
  const int = parseInt(m[1], 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

// Precomputed muted -> foreground stops for the alpha-bucket draw batching
// below (rule: never arithmetic on raw token strings at draw time — derive
// the ramp once per token read, same idiom floret-pack uses for its
// young -> mature stops). If a token hasn't resolved to a parseable value
// yet, this is a no-op that keeps whatever ramp was already built rather
// than substituting a literal grey — callers only ever invoke this after
// tokens have been read in useLayoutEffect, so in practice it always has a
// real value the first time it runs.
function buildStops(tokens: Tokens, count: number, prev: string[]): string[] {
  const muted = parseHex(tokens.muted);
  const fg = parseHex(tokens.fg);
  if (!muted || !fg) return prev;
  const stops: string[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 1 : i / (count - 1);
    stops.push(`rgb(${lerpChannel(muted.r, fg.r, t)},${lerpChannel(muted.g, fg.g, t)},${lerpChannel(muted.b, fg.b, t)})`);
  }
  return stops;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function easeInOutCubic(t: number): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

interface Mask {
  data: Float32Array;
  w: number;
  h: number;
}

function boxBlur(src: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          sum += src[yy * w + xx] ?? 0;
          n++;
        }
      }
      out[y * w + x] = n ? sum / n : 0;
    }
  }
  return out;
}

// All path data authored here directly — no image assets, no SVG file. The
// offscreen canvas this draws into is read back for its ALPHA CHANNEL only
// (see rasterizeMask) and never composited to a visible surface, but `ink`
// is still threaded in from the live --foreground read rather than any
// literal — an opaque fill of any value would work for the mask itself,
// this just means there is no second color source to keep straight.
function drawSilhouettePath(
  ctx: CanvasRenderingContext2D,
  id: SilhouetteId,
  w: number,
  h: number,
  text: string,
  ink: string
) {
  ctx.fillStyle = ink;
  if (id === "wordmark") {
    let fontSize = Math.floor(h * 0.64);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${fontSize}px "GeistMono", ui-monospace, monospace`;
    while (fontSize > 8 && ctx.measureText(text).width > w * 0.86) {
      fontSize -= 2;
      ctx.font = `700 ${fontSize}px "GeistMono", ui-monospace, monospace`;
    }
    ctx.fillText(text, w / 2, h / 2 + fontSize * 0.03);
    return;
  }
  if (id === "star") {
    const cx = w / 2;
    const cy = h / 2;
    const outer = Math.min(w, h) * 0.46;
    const inner = outer * 0.42;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    return;
  }
  // "orbit" — a simple interlocked icon pair: two ring annuli, drawn with
  // even-odd fill so each ring's own centre stays hollow.
  const cy = h / 2;
  const r = Math.min(w, h) * 0.3;
  const ringW = r * 0.34;
  for (const cx of [w * 0.38, w * 0.62]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.arc(cx, cy, r - ringW, 0, Math.PI * 2, true);
    ctx.fill("evenodd");
  }
}

function rasterizeMask(id: SilhouetteId, aspect: number, text: string, ink: string): Mask {
  const long = MASK_LONG_SIDE;
  const w = aspect >= 1 ? long : Math.max(24, Math.round(long * aspect));
  const h = aspect >= 1 ? Math.max(24, Math.round(long / aspect)) : long;
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const octx = off.getContext("2d");
  if (!octx) return { data: new Float32Array(w * h), w, h };
  octx.clearRect(0, 0, w, h);
  drawSilhouettePath(octx, id, w, h, text, ink);
  const img = octx.getImageData(0, 0, w, h).data;
  const raw = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) raw[i] = (img[i * 4 + 3] ?? 0) / 255;
  return { data: boxBlur(boxBlur(raw, w, h), w, h), w, h };
}

// Weighted importance-sample of `count` target points from the mask,
// returned in container-NORMALIZED [0,1] space so a later resize just
// rescales the draw, no resampling needed.
function sampleTargets(mask: Mask, count: number, rand: () => number): Float32Array {
  const { data, w, h } = mask;
  const cum = new Float32Array(w * h);
  let total = 0;
  for (let i = 0; i < w * h; i++) {
    const v = (data[i] ?? 0) > MASK_THRESHOLD ? (data[i] ?? 0) : 0;
    total += v;
    cum[i] = total;
  }
  const out = new Float32Array(count * 2);
  if (total <= 0) {
    // degenerate mask (nothing rasterized, e.g. empty text): scatter rather
    // than collapse to a corner, so the frame is never emptier than "cloud".
    for (let i = 0; i < count; i++) {
      out[i * 2] = rand();
      out[i * 2 + 1] = rand();
    }
    return out;
  }
  for (let i = 0; i < count; i++) {
    const r = rand() * total;
    let lo = 0;
    let hi = w * h - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((cum[mid] ?? 0) < r) lo = mid + 1;
      else hi = mid;
    }
    const px = lo % w;
    const py = Math.floor(lo / w);
    const jx = (rand() - 0.5) / w;
    const jy = (rand() - 0.5) / h;
    out[i * 2] = (px + 0.5) / w + jx;
    out[i * 2 + 1] = (py + 0.5) / h + jy;
  }
  return out;
}

// Cheap approximate nearest-matching: pair particles and targets by their
// rank along x. Keeps re-solve flight paths short and mostly non-crossing
// without real O(n^2) assignment.
function assignByXOrder(curU: Float32Array, targets: Float32Array, n: number, outU: Float32Array, outV: Float32Array) {
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => (curU[a] ?? 0) - (curU[b] ?? 0));
  const tOrder = Array.from({ length: n }, (_, i) => i).sort((a, b) => (targets[a * 2] ?? 0) - (targets[b * 2] ?? 0));
  for (let k = 0; k < n; k++) {
    const particleIdx = order[k]!;
    const targetIdx = tOrder[k]!;
    outU[particleIdx] = targets[targetIdx * 2] ?? 0;
    outV[particleIdx] = targets[targetIdx * 2 + 1] ?? 0;
  }
}

export function HeroGlyphSilhouettePack({
  shapes = DEFAULT_SHAPES,
  wordmarkText = "NS",
  particleCount,
  glyphs = DEFAULT_GLYPHS,
  holdMs = 2600,
  migrateMs = 1600,
  children,
  className = "",
}: HeroGlyphSilhouettePackProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const shapeList = shapes.length > 0 ? shapes : DEFAULT_SHAPES;
    const glyphChars = glyphs.length > 0 ? Array.from(glyphs) : Array.from(DEFAULT_GLYPHS);
    const rand = mulberry32(0xa17b3e91);

    let tokens = readTokens(root);
    let stops: string[] = [];
    stops = buildStops(tokens, ALPHA_BUCKETS, stops);
    let cssW = 0;
    let cssH = 0;
    let dpr = 1;
    let glyphPx = 12;
    let n = 0;
    let masks: Mask[] = [];
    let sized = false;
    let disposed = false;
    let visible = true;

    // Particle state, one flight record per particle: prevU/V is where the
    // active (or most recently completed) flight started, toU/V is its
    // destination. Between re-solves prevU/V===toU/V and eased sits at 1,
    // i.e. "resting" is simply a completed flight, not a separate state.
    let prevU = new Float32Array(0);
    let prevV = new Float32Array(0);
    let toU = new Float32Array(0);
    let toV = new Float32Array(0);
    let startAt = new Float32Array(0);
    let duration = new Float32Array(0);
    let phase = new Float32Array(0);
    let bulgeSign = new Float32Array(0);
    let glyphIdx = new Uint8Array(0);
    // scratch, reused every frame: no per-frame allocation on the hot path
    let drawX = new Float32Array(0);
    let drawY = new Float32Array(0);
    let bucketOf = new Uint8Array(0);
    let bucketOrder = new Int32Array(0);
    let repelX = new Float32Array(0);
    let repelY = new Float32Array(0);
    // counting-sort scratch for the alpha-bucket draw batch — fixed size
    // (ALPHA_BUCKETS never changes), allocated once, reused and zeroed
    // every frame rather than reallocated
    const bucketCounts = new Int32Array(ALPHA_BUCKETS + 1);
    const bucketCursor = new Int32Array(ALPHA_BUCKETS);

    let shapeIndex = -1;
    let nextRetargetAt = 0;
    let raf = 0;
    let last = 0;
    let t = 0;
    const pointer = { x: -1e5, y: -1e5, active: false };

    const flightWindowMs = () => migrateMs + MIGRATE_STAGGER_MS;

    const computeParticleCount = () => {
      // Glyph size derives from the container's smaller dimension
      // regardless of whether particleCount is explicit or auto — an
      // explicit count still needs the right glyph size for its container.
      const minDim = Math.max(1, Math.min(cssW, cssH));
      glyphPx = Math.min(20, Math.max(9, Math.round(minDim / 34)));
      if (particleCount) return particleCount;
      const cellArea = glyphPx * glyphPx * 8.5;
      const estimate = Math.round((cssW * cssH) / cellArea);
      return Math.min(MAX_PARTICLES, Math.max(MIN_PARTICLES, estimate));
    };

    const buildMasks = () => {
      const aspect = cssW > 0 && cssH > 0 ? cssW / cssH : 1;
      // tokens.fg is read in useLayoutEffect before this can run, so it is
      // always a real value here; an invalid/empty fillStyle assignment is
      // simply ignored by the canvas 2D context (no source literal needed
      // as a stand-in — this mask only feeds an alpha test, never a screen).
      masks = shapeList.map((id) => rasterizeMask(id, aspect, wordmarkText, tokens.fg));
    };

    const allocateParticles = (count: number) => {
      n = count;
      prevU = new Float32Array(n);
      prevV = new Float32Array(n);
      toU = new Float32Array(n);
      toV = new Float32Array(n);
      startAt = new Float32Array(n);
      duration = new Float32Array(n);
      phase = new Float32Array(n);
      bulgeSign = new Float32Array(n);
      glyphIdx = new Uint8Array(n);
      drawX = new Float32Array(n);
      drawY = new Float32Array(n);
      bucketOf = new Uint8Array(n);
      bucketOrder = new Int32Array(n);
      repelX = new Float32Array(n);
      repelY = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        // scattered birth state: cloud starts formless and condenses into
        // shapes[0] on the first retarget, rather than popping in solved.
        prevU[i] = rand();
        prevV[i] = rand();
        toU[i] = prevU[i]!;
        toV[i] = prevV[i]!;
        startAt[i] = -1e9;
        duration[i] = migrateMs;
        phase[i] = rand() * Math.PI * 2;
        bulgeSign[i] = rand() < 0.5 ? -1 : 1;
        glyphIdx[i] = Math.floor(rand() * glyphChars.length);
      }
    };

    const retarget = (index: number, now: number) => {
      shapeIndex = ((index % shapeList.length) + shapeList.length) % shapeList.length;
      const mask = masks[shapeIndex];
      if (!mask) return;
      const targets = sampleTargets(mask, n, rand);
      const nextU = new Float32Array(n);
      const nextV = new Float32Array(n);
      assignByXOrder(toU, targets, n, nextU, nextV);
      for (let i = 0; i < n; i++) {
        prevU[i] = toU[i]!;
        prevV[i] = toV[i]!;
        toU[i] = nextU[i]!;
        toV[i] = nextV[i]!;
        startAt[i] = now + rand() * MIGRATE_STAGGER_MS;
        duration[i] = migrateMs * (0.85 + rand() * 0.3);
      }
      nextRetargetAt = now + holdMs + flightWindowMs();
    };

    const measure = () => {
      const rect = root!.getBoundingClientRect();
      cssW = rect.width;
      cssH = rect.height;
      if (cssW < 4 || cssH < 4) {
        sized = false;
        return;
      }
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.max(1, Math.round(cssW * dpr));
      canvas.height = Math.max(1, Math.round(cssH * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = computeParticleCount();
      if (count !== n) allocateParticles(count);
      buildMasks();
      ctx.font = `${glyphPx}px "GeistMono", ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      sized = true;
    };

    const draw = () => {
      if (!sized) return;
      ctx.clearRect(0, 0, cssW, cssH);

      for (let i = 0; i < n; i++) {
        const elapsed = t * 1000 - (startAt[i] ?? 0);
        const dur = duration[i] ?? migrateMs;
        let eased: number;
        if (reduced) {
          eased = 1;
        } else if (elapsed <= 0) {
          eased = 0;
        } else {
          eased = easeInOutCubic(Math.min(1, elapsed / dur));
        }
        const fu = prevU[i] ?? 0;
        const fv = prevV[i] ?? 0;
        const tu = toU[i] ?? 0;
        const tv = toV[i] ?? 0;
        let bu = fu + (tu - fu) * eased;
        let bv = fv + (tv - fv) * eased;

        if (!reduced) {
          // perpendicular bulge, peaks mid-flight, zero at both ends — the
          // migration reads as a flight, not a straight tween.
          const bulge = Math.sin(eased * Math.PI) * ARC_BULGE * (bulgeSign[i] ?? 1);
          const ddx = tu - fu;
          const ddy = tv - fv;
          const len = Math.hypot(ddx, ddy) || 1;
          bu += (-ddy / len) * bulge * (Math.hypot(ddx, ddy) || 0.02);
          bv += (ddx / len) * bulge * (Math.hypot(ddx, ddy) || 0.02);
        }

        let px = bu * cssW;
        let py = bv * cssH;

        if (!reduced) {
          const wobbleScale = 0.4 + 0.6 * eased;
          const ph = phase[i] ?? 0;
          px += Math.sin(t * WOBBLE_FREQ + ph) * WOBBLE_AMP_PX * wobbleScale;
          py += Math.cos(t * WOBBLE_FREQ * 0.83 + ph * 1.3) * WOBBLE_AMP_PX * wobbleScale;

          if (pointer.active) {
            const dx = px - pointer.x;
            const dy = py - pointer.y;
            const d = Math.hypot(dx, dy);
            if (d < REPEL_RADIUS_PX) {
              const falloff = 1 - d / REPEL_RADIUS_PX;
              const mag = falloff * falloff * REPEL_STRENGTH_PX;
              const inv = d > 0.001 ? 1 / d : 0;
              repelX[i] = (repelX[i] ?? 0) + ((dx * inv * mag) - (repelX[i] ?? 0)) * REPEL_EASE;
              repelY[i] = (repelY[i] ?? 0) + ((dy * inv * mag) - (repelY[i] ?? 0)) * REPEL_EASE;
            } else {
              repelX[i] = (repelX[i] ?? 0) * (1 - REPEL_EASE);
              repelY[i] = (repelY[i] ?? 0) * (1 - REPEL_EASE);
            }
          } else {
            repelX[i] = (repelX[i] ?? 0) * (1 - REPEL_EASE);
            repelY[i] = (repelY[i] ?? 0) * (1 - REPEL_EASE);
          }
          px += repelX[i] ?? 0;
          py += repelY[i] ?? 0;
        }

        drawX[i] = px;
        drawY[i] = py;
        const bucket = Math.min(ALPHA_BUCKETS - 1, Math.floor(eased * ALPHA_BUCKETS));
        bucketOf[i] = bucket;
      }

      // counting sort into bucketOrder so the draw pass below sets
      // ctx.fillStyle only ALPHA_BUCKETS times total, not once per particle
      // — bucketCounts/bucketCursor are pre-sized scratch, zeroed in place
      bucketCounts.fill(0);
      for (let i = 0; i < n; i++) bucketCounts[(bucketOf[i] ?? 0) + 1]!++;
      for (let b = 0; b < ALPHA_BUCKETS; b++) bucketCounts[b + 1]! += bucketCounts[b]!;
      bucketCursor.set(bucketCounts.subarray(0, ALPHA_BUCKETS));
      for (let i = 0; i < n; i++) {
        const b = bucketOf[i] ?? 0;
        bucketOrder[bucketCursor[b]!] = i;
        bucketCursor[b]!++;
      }

      for (let b = 0; b < ALPHA_BUCKETS; b++) {
        ctx.fillStyle = stops[b] ?? stops[stops.length - 1] ?? tokens.fg;
        const start = bucketCounts[b]!;
        const end = bucketCounts[b + 1]!;
        for (let k = start; k < end; k++) {
          const idx = bucketOrder[k]!;
          const ch = glyphChars[glyphIdx[idx] ?? 0] ?? glyphChars[0] ?? "+";
          ctx.fillText(ch, drawX[idx] ?? 0, drawY[idx] ?? 0);
        }
      }
    };

    const loop = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      t += dt;
      const nowMs = t * 1000;
      if (!reduced && shapeIndex < 0) retarget(0, nowMs);
      else if (!reduced && nowMs >= nextRetargetAt) retarget(shapeIndex + 1, nowMs);
      draw();
      if (!document.hidden && visible) raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (reduced || raf || document.hidden || !visible) return;
      last = 0;
      raf = requestAnimationFrame(loop);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = root!.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
    };
    const onPointerLeave = () => {
      pointer.active = false;
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        measure();
        if (!sized) return;
        if (reduced) {
          // A resize can reallocate the particle pool (count derives from
          // the container's smaller dimension), which reseeds every
          // particle at a scattered birth position — always re-solve back
          // onto the current (or first) shape so the frozen frame never
          // regresses to scatter.
          retarget(shapeIndex < 0 ? 0 : shapeIndex, 0);
          for (let i = 0; i < n; i++) {
            prevU[i] = toU[i]!;
            prevV[i] = toV[i]!;
          }
          draw();
        } else if (shapeIndex < 0) {
          retarget(0, t * 1000);
        }
      }, 120);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(root);

    const io = new IntersectionObserver(
      (entries) => {
        visible = (entries[0]?.isIntersecting ?? true) as boolean;
        if (visible) wake();
      },
      { threshold: 0 }
    );
    io.observe(root);

    const onVisibility = () => {
      if (!document.hidden) wake();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const mo = new MutationObserver(() => {
      tokens = readTokens(root!);
      stops = buildStops(tokens, ALPHA_BUCKETS, stops);
      if (reduced) draw();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    document.fonts.ready.then(() => {
      if (disposed) return;
      tokens = readTokens(root!);
      stops = buildStops(tokens, ALPHA_BUCKETS, stops);
      measure();
      if (!sized) return;
      if (reduced) {
        // Freeze on the first silhouette fully solved — a chosen non-t0
        // structured frame, never a mid-flight or scattered one. No rAF
        // loop, no wobble, no repulsion: nothing in this branch reads a
        // clock after this point.
        retarget(0, 0);
        for (let i = 0; i < n; i++) {
          prevU[i] = toU[i]!;
          prevV[i] = toV[i]!;
        }
        draw();
      } else {
        root!.addEventListener("pointermove", onPointerMove);
        root!.addEventListener("pointerleave", onPointerLeave);
        raf = requestAnimationFrame(loop);
      }
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      root!.removeEventListener("pointermove", onPointerMove);
      root!.removeEventListener("pointerleave", onPointerLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapes, wordmarkText, particleCount, glyphs, holdMs, migrateMs]);

  return (
    <div ref={rootRef} className={`relative isolate min-h-[480px] w-full overflow-hidden bg-background ${className}`}>
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 block h-full w-full" />
      {children ? (
        <div className="relative z-10 flex min-h-[inherit] flex-col items-center justify-center px-8 py-14">
          {/* Scrim hugs the copy, not the whole pane — a silhouette that
              fills the frame would otherwise fight the headline for
              contrast; keeping the backdrop tight to the text block is what
              keeps the rest of the cloud fully visible around it. */}
          <div className="flex max-w-xl flex-col items-center gap-2 rounded-xl bg-background/80 px-8 py-8 text-center backdrop-blur-sm">
            {children}
          </div>
        </div>
      ) : null}
    </div>
  );
}
