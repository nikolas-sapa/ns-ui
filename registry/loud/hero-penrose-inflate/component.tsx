"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// PenroseInflate — a hero backdrop that is a genuine Penrose P3 rhomb
// quasicrystal, built by Robinson-triangle substitution rather than drawn or
// tiled.
//
// GEOMETRY. A triangle is (type, A, B, C). Type 0 is the acute Robinson
// triangle (36-72-72: legs AB = AC, base BC = leg/phi); type 1 is the obtuse
// one (108-36-36: legs AB = AC, base BC = leg*phi). The substitution is the
// standard deflation:
//   type 0: P = A + (B - A)/phi  ->  (0, C, P, B), (1, P, C, A)
//   type 1: Q = B + (A - B)/phi, R = B + (C - B)/phi
//                                ->  (1, R, C, A), (1, Q, R, B), (0, R, Q, A)
// and it is a strict refinement: the children exactly partition the parent
// (child area sums to the parent's to 12 decimal places, both types).
//
// R sits ON the base BC, at B + (C - B)/phi — NOT offset from Q. Solving
// |RA| = |RQ| = |RC| = leg/phi and |RB| = leg is what puts it there, and it is
// the only placement that keeps every child isoceles: offsetting from Q
// instead scales that leg by phi and the tiling degenerates from generation
// two onward (measured: 20 of 50 triangles still isoceles at gen 2, versus
// 340 of 340 with this placement, base/leg holding at exactly 0.618034 and
// 1.618034 through gen 4). At depth 6 the stroked legs fall into exactly five
// direction clusters 36 degrees apart, 18/54/90/126/162, with identical
// population — which is the five-fold symmetry the resting frame is judged on.
//
// RHOMBS, NOT TRIANGLES. Every base edge BC is shared by exactly two triangles
// of the SAME type that are mirror images across it (verified numerically over
// four generations of the seed: of 180 BC edges at gen 4, 160 are same-type
// mirror pairs and the other 20 are the outer hull — no BC edge ever abuts a
// triangle of the other type). BC is therefore the internal bisector seam of a rhomb, and it is
// NEVER stroked. Two type-0 halves glued on BC give the thin 36/144 rhomb; two
// type-1 halves give the fat 72/108 rhomb. Omitting that one edge per triangle
// is the entire legibility of the piece: strokes it and you get a
// triangulation, omit it and the frame reads as fat and thin rhombi with
// unmistakable five-fold symmetry and no translational repeat.
//
// MOTION. A single scale s(t) = phi^f, f = (t / period) mod 1, applied about
// the canvas centre. Two lists are held: a coarse level N and its one-deeper
// substitution N+1. Across the last 40% of the cycle each coarse triangle
// independently swaps to its children when a per-triangle score (mostly a
// smooth low-frequency field, part deterministic white hash) falls under a
// smoothstepped front — so the level change is a continuous resolving pass,
// never an instantaneous global pop. At the wrap the fine list is culled to
// the viewport, multiplied by phi and becomes the new coarse list, which is
// pixel-for-pixel the frame that was just on screen at s = phi. Endless,
// seamless zoom at a calm ~20 s per phi.
//
// POINTER. An inflation lens. Its strength L eases 0 -> 1 with tau 0.6 s on
// enter and back on leave, and it raises that same swap threshold locally by
// L * exp(-d^2 / (2 * (0.32 * min(w,h))^2)). Because the threshold is compared
// against the per-triangle score rather than a hard radius, the coarse/fine
// boundary is dithered instead of a visible circle.
//
// Ink is getComputedStyle(canvas).color, re-read on a documentElement class
// MutationObserver. --ns-accent appears only on the CTA focus rings, never in the
// tiling. dpr clamped to 2, ResizeObserver, rAF paused on document.hidden.
// prefers-reduced-motion: substitute once, draw exactly one frame at s = 1
// with L = 0, no rAF, no pointer listeners.
// ---------------------------------------------------------------------------

const PHI = 1.6180339887498949;
const INV_PHI = 1 / PHI;

const MAX_TRIANGLES = 12000; // hard budget across both levels
const LINE_WIDTH = 0.9;
const ALPHA_FAT = 0.55; // type 1 — the dominant fat rhombi carry the structure
const ALPHA_THIN = 0.24; // type 0 — thin rhombi recede
const LENS_TAU = 0.6; // s
const LENS_FRACTION = 0.32; // sigma as a fraction of min(w, h)
const FLIP_START = 0.6; // cycle fraction at which the resolving pass begins
const SEED_RADIUS_K = 0.62; // seed decagon radius / viewport diagonal
const CULL_MARGIN = 56; // px of model-space slack kept outside the viewport
const DT_MAX = 0.05;

interface TriList {
  n: number;
  type: Uint8Array;
  /** 6 floats per triangle: ax ay bx by cx cy */
  xy: Float64Array;
}

function seedWheel(radius: number): TriList {
  const n = 10;
  const type = new Uint8Array(n);
  const xy = new Float64Array(n * 6);
  for (let i = 0; i < n; i++) {
    const a1 = ((2 * i - 1) * Math.PI) / 10;
    const a2 = ((2 * i + 1) * Math.PI) / 10;
    let bx = Math.cos(a1) * radius;
    let by = Math.sin(a1) * radius;
    let cx = Math.cos(a2) * radius;
    let cy = Math.sin(a2) * radius;
    if (i % 2 === 1) {
      // every second triangle mirrored, so the wheel closes as a legal decagon
      const tx = bx;
      const ty = by;
      bx = cx;
      by = cy;
      cx = tx;
      cy = ty;
    }
    const o = i * 6;
    xy[o] = 0;
    xy[o + 1] = 0;
    xy[o + 2] = bx;
    xy[o + 3] = by;
    xy[o + 4] = cx;
    xy[o + 5] = cy;
  }
  return { n, type, xy };
}

/**
 * One deflation step. Returns the child list plus a childStart index so a
 * parent's children are the contiguous range [childStart[i], childStart[i+1]).
 * Aborts cleanly at `budget`: parents past the cut get an empty range and stay
 * coarse forever, which the renderer already handles.
 */
function substitute(
  src: TriList,
  budget: number
): { out: TriList; childStart: Int32Array } {
  let outN = 0;
  let cut = src.n;
  for (let i = 0; i < src.n; i++) {
    const add = src.type[i] === 0 ? 2 : 3;
    if (outN + add > budget) {
      cut = i;
      break;
    }
    outN += add;
  }

  const type = new Uint8Array(outN);
  const xy = new Float64Array(outN * 6);
  const childStart = new Int32Array(src.n + 1);
  let o = 0;

  const emit = (t: number, ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => {
    type[o] = t;
    const k = o * 6;
    xy[k] = ax;
    xy[k + 1] = ay;
    xy[k + 2] = bx;
    xy[k + 3] = by;
    xy[k + 4] = cx;
    xy[k + 5] = cy;
    o++;
  };

  for (let i = 0; i < src.n; i++) {
    childStart[i] = o;
    if (i >= cut) continue;
    const s = i * 6;
    const ax = src.xy[s]!;
    const ay = src.xy[s + 1]!;
    const bx = src.xy[s + 2]!;
    const by = src.xy[s + 3]!;
    const cx = src.xy[s + 4]!;
    const cy = src.xy[s + 5]!;
    if (src.type[i] === 0) {
      const px = ax + (bx - ax) * INV_PHI;
      const py = ay + (by - ay) * INV_PHI;
      emit(0, cx, cy, px, py, bx, by);
      emit(1, px, py, cx, cy, ax, ay);
    } else {
      const qx = bx + (ax - bx) * INV_PHI;
      const qy = by + (ay - by) * INV_PHI;
      const rx = bx + (cx - bx) * INV_PHI;
      const ry = by + (cy - by) * INV_PHI;
      emit(1, rx, ry, cx, cy, ax, ay);
      emit(1, qx, qy, rx, ry, bx, by);
      emit(0, rx, ry, qx, qy, ax, ay);
    }
  }
  childStart[src.n] = o;
  return { out: { n: outN, type, xy }, childStart };
}

/** Keep triangles whose bounding box meets the box, then scale by `k`. */
function cullAndScale(src: TriList, halfW: number, halfH: number, k: number): TriList {
  const keep = new Int32Array(src.n);
  let m = 0;
  for (let i = 0; i < src.n; i++) {
    const o = i * 6;
    const x0 = src.xy[o]!;
    const y0 = src.xy[o + 1]!;
    const x1 = src.xy[o + 2]!;
    const y1 = src.xy[o + 3]!;
    const x2 = src.xy[o + 4]!;
    const y2 = src.xy[o + 5]!;
    if (Math.min(x0, x1, x2) > halfW) continue;
    if (Math.max(x0, x1, x2) < -halfW) continue;
    if (Math.min(y0, y1, y2) > halfH) continue;
    if (Math.max(y0, y1, y2) < -halfH) continue;
    keep[m++] = i;
  }
  const type = new Uint8Array(m);
  const xy = new Float64Array(m * 6);
  for (let j = 0; j < m; j++) {
    const i = keep[j]!;
    type[j] = src.type[i]!;
    const s = i * 6;
    const d = j * 6;
    for (let c = 0; c < 6; c++) xy[d + c] = src.xy[s + c]! * k;
  }
  return { n: m, type, xy };
}

/**
 * Per-triangle swap score in [0,1). Mostly a smooth low-frequency field, so
 * the resolving pass reads as a coherent front rather than salt-and-pepper;
 * 30% deterministic white hash so the front's edge — and the lens boundary
 * that shares this field — is dithered rather than a clean curve or circle.
 */
function scoresFor(list: TriList, radius: number): Float32Array {
  const out = new Float32Array(list.n);
  for (let i = 0; i < list.n; i++) {
    const o = i * 6;
    const u = ((list.xy[o]! + list.xy[o + 2]! + list.xy[o + 4]!) / 3) / radius;
    const v = ((list.xy[o + 1]! + list.xy[o + 3]! + list.xy[o + 5]!) / 3) / radius;
    const smooth =
      0.55 * Math.sin(4.1 * u + 1.3) * Math.cos(3.3 * v - 0.7) +
      0.45 * Math.sin(2.2 * u - 1.9 * v + 2.1);
    const g = Math.min(1, Math.max(0, 0.5 + 0.5 * smooth));
    const s = Math.sin(u * 127.1 + v * 311.7) * 43758.5453;
    const white = s - Math.floor(s);
    out[i] = 0.7 * g + 0.3 * white;
  }
  return out;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export interface PenroseInflateProps {
  /** mono eyebrow label above the headline */
  eyebrow?: string;
  /** each entry is one rendered line of the h1 */
  headline?: string[];
  /** supporting copy under the headline */
  subcopy?: string;
  /** primary CTA button/link */
  primaryCta?: { label: string; href: string };
  /** optional secondary CTA rendered beside the primary one */
  secondaryCta?: { label: string; href: string };
  /** substitution depth of the resting tiling; clamped to 1..7 */
  depth?: number;
  /** ms for one full phi-ratio zoom cycle */
  period?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function PenroseInflate({
  eyebrow = "P3 / APERIODIC",
  headline = ["Order without", "repetition"],
  subcopy = "Two rhombi, one substitution rule, and a pattern that never repeats itself at any scale. Move the pointer and the tiling inflates one level finer wherever you look.",
  primaryCta = { label: "Start building", href: "#start" },
  secondaryCta = { label: "Read the derivation", href: "#derivation" },
  depth = 6,
  period = 20000,
  className = "",
}: PenroseInflateProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const levels = Math.max(1, Math.min(7, Math.round(depth)));
    const periodS = Math.max(4, period / 1000);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");

    let w = 0;
    let h = 0;
    let radius = 1;
    let ink = "currentColor";
    let coarse: TriList = { n: 0, type: new Uint8Array(0), xy: new Float64Array(0) };
    let fine: TriList = coarse;
    let childStart: Int32Array<ArrayBufferLike> = new Int32Array(1);
    let score: Float32Array<ArrayBufferLike> = new Float32Array(0);
    let raf = 0;
    let running = false;
    let elapsed = 0;
    let lastTs = 0;
    let cycle = 0;

    const lens = { x: -1e5, y: -1e5, over: false, strength: 0 };

    const readInk = () => {
      ink = getComputedStyle(canvas).color;
    };

    const rebuildFine = () => {
      const budget = Math.max(0, MAX_TRIANGLES - coarse.n);
      const r = substitute(coarse, budget);
      fine = r.out;
      childStart = r.childStart;
      score = scoresFor(coarse, radius);
    };

    const buildFromSeed = () => {
      radius = SEED_RADIUS_K * Math.hypot(w, h);
      let list = seedWheel(radius);
      for (let d = 0; d < levels; d++) {
        list = substitute(list, MAX_TRIANGLES).out;
      }
      coarse = cullAndScale(list, w / 2 + CULL_MARGIN, h / 2 + CULL_MARGIN, 1);
      rebuildFine();
      cycle = 0;
      elapsed = 0;
    };

    // One cycle done: the fine level, culled to what stays on screen and
    // inflated by phi, IS the frame currently drawn at s = phi.
    //
    // The cull box is the FULL kept box divided by phi, so scaling by phi
    // reproduces exactly the box the previous coarse list covered. Both
    // coverage and population are then an exact fixed point: 2.618 children x
    // the 1/phi^2 area retained = 1.0. Culling to (w/2)/phi + margin instead
    // also converges — the box is recomputed from w every wrap, so nothing
    // compounds — but it converges on a WIDER box, w/2 + margin*phi, carrying
    // about 6% more tiles (1350 against 1276 at depth 6). Measured over 20
    // wraps at seven aspect ratios from 390x844 to 3440x1440, this form peaks
    // at 4,632 triangles at depth 6 and 11,414 at depth 7, under the 12,000
    // budget everywhere; the wider form pushes depth 7 past it and truncates.
    // That matters because a truncated parent has no children to become and
    // would leave a permanent hole here, not a stale tile.
    const advance = () => {
      coarse = cullAndScale(
        fine,
        (w / 2 + CULL_MARGIN) / PHI,
        (h / 2 + CULL_MARGIN) / PHI,
        PHI
      );
      rebuildFine();
    };

    const draw = (f: number, strength: number) => {
      if (w < 4 || h < 4 || coarse.n === 0) return;
      const s = Math.pow(PHI, f);
      const flip = smoothstep(FLIP_START, 1, f);
      const halfW = w / 2;
      const halfH = h / 2;
      const sigma = LENS_FRACTION * Math.min(w, h);
      const inv2s2 = 1 / (2 * sigma * sigma);
      const useLens = strength > 0.004;

      ctx.clearRect(0, 0, w, h);
      const pThin = new Path2D();
      const pFat = new Path2D();

      for (let i = 0; i < coarse.n; i++) {
        const o = i * 6;
        const ax = halfW + coarse.xy[o]! * s;
        const ay = halfH + coarse.xy[o + 1]! * s;
        const bx = halfW + coarse.xy[o + 2]! * s;
        const by = halfH + coarse.xy[o + 3]! * s;
        const cx = halfW + coarse.xy[o + 4]! * s;
        const cy = halfH + coarse.xy[o + 5]! * s;

        // bounding-box cull before any stroke work
        if (Math.min(ax, bx, cx) > w) continue;
        if (Math.max(ax, bx, cx) < 0) continue;
        if (Math.min(ay, by, cy) > h) continue;
        if (Math.max(ay, by, cy) < 0) continue;

        let thr = flip;
        if (useLens) {
          const gx = (ax + bx + cx) / 3 - lens.x;
          const gy = (ay + by + cy) / 3 - lens.y;
          const e = Math.exp(-(gx * gx + gy * gy) * inv2s2);
          thr = flip + (1 - flip) * strength * e;
        }

        const cs = childStart[i]!;
        const ce = childStart[i + 1]!;
        if (ce > cs && score[i]! < thr) {
          for (let j = cs; j < ce; j++) {
            const k = j * 6;
            const p = fine.type[j] === 1 ? pFat : pThin;
            // B -> A -> C: the two legs only. The base B-C is the mirror seam
            // shared with this triangle's partner half and is never stroked.
            p.moveTo(halfW + fine.xy[k + 2]! * s, halfH + fine.xy[k + 3]! * s);
            p.lineTo(halfW + fine.xy[k]! * s, halfH + fine.xy[k + 1]! * s);
            p.lineTo(halfW + fine.xy[k + 4]! * s, halfH + fine.xy[k + 5]! * s);
          }
        } else {
          const p = coarse.type[i] === 1 ? pFat : pThin;
          p.moveTo(bx, by);
          p.lineTo(ax, ay);
          p.lineTo(cx, cy);
        }
      }

      ctx.lineWidth = LINE_WIDTH;
      ctx.lineJoin = "round";
      ctx.strokeStyle = ink;
      ctx.globalAlpha = ALPHA_FAT;
      ctx.stroke(pFat);
      ctx.globalAlpha = ALPHA_THIN;
      ctx.stroke(pThin);
      ctx.globalAlpha = 1;
    };

    const loop = (ts: number) => {
      const dt = lastTs ? Math.min(DT_MAX, (ts - lastTs) / 1000) : 1 / 60;
      lastTs = ts;
      elapsed += dt;
      const c = Math.floor(elapsed / periodS);
      if (c !== cycle) {
        cycle = c;
        advance();
      }
      const target = lens.over ? 1 : 0;
      lens.strength += (target - lens.strength) * Math.min(1, dt / LENS_TAU);
      draw(elapsed / periodS - cycle, lens.strength);
      raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (running || mq.matches || document.hidden) return;
      running = true;
      lastTs = 0;
      raf = requestAnimationFrame(loop);
    };
    const sleep = () => {
      cancelAnimationFrame(raf);
      running = false;
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      lens.x = e.clientX - rect.left;
      lens.y = e.clientY - rect.top;
      lens.over = true;
    };
    const onPointerLeave = () => {
      lens.over = false;
    };
    // pointerleave does not bubble, so a synthetic leave dispatched straight to
    // a descendant (the autoplay driver hit-tests and dispatches to the element
    // under its cursor) would never reach this listener and the lens would
    // stay inflated forever. pointerout does bubble: treat it as a leave only
    // when the pointer actually left the hero subtree.
    const onPointerOut = (e: PointerEvent) => {
      const next = e.relatedTarget as Node | null;
      if (!next || !root.contains(next)) lens.over = false;
    };

    let listening = false;
    const applyMode = () => {
      if (mq.matches) {
        sleep();
        if (listening) {
          root.removeEventListener("pointermove", onPointerMove);
          root.removeEventListener("pointerleave", onPointerLeave);
          root.removeEventListener("pointerout", onPointerOut);
          listening = false;
        }
        lens.strength = 0;
        draw(0, 0);
      } else {
        if (!listening) {
          root.addEventListener("pointermove", onPointerMove);
          root.addEventListener("pointerleave", onPointerLeave);
          root.addEventListener("pointerout", onPointerOut);
          listening = true;
        }
        wake();
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) return;
      const nw = Math.round(rect.width);
      const nh = Math.round(rect.height);
      if (nw === w && nh === h) return;
      w = nw;
      h = nh;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildFromSeed();
      applyMode();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const themeObserver = new MutationObserver(() => {
      readInk();
      if (mq.matches) draw(0, 0);
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const onVis = () => {
      if (document.hidden) sleep();
      else wake();
    };
    document.addEventListener("visibilitychange", onVis);
    const onMq = () => applyMode();
    mq.addEventListener("change", onMq);

    readInk();
    resize();

    return () => {
      sleep();
      ro.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      mq.removeEventListener("change", onMq);
      if (listening) {
        root.removeEventListener("pointermove", onPointerMove);
        root.removeEventListener("pointerleave", onPointerLeave);
        root.removeEventListener("pointerout", onPointerOut);
      }
    };
  }, [depth, period]);

  return (
    <section
      ref={rootRef}
      data-hero="penrose"
      className={`relative isolate flex w-full flex-col justify-center overflow-hidden bg-background px-6 py-24 sm:px-12 ${className}`}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 h-full w-full text-foreground"
      />
      <div className="mx-auto w-full max-w-3xl">
        <p className="font-mono text-[11px] tracking-[0.28em] text-ns-muted">
          {eyebrow}
        </p>
        <h1 className="mt-5 text-balance font-semibold tracking-tight text-foreground [font-size:clamp(2.5rem,7vw,4.75rem)] [line-height:1.02]">
          {headline.map((line, i) => (
            <span key={i} className="block">
              {line}
            </span>
          ))}
        </h1>
        <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-ns-muted">
          {subcopy}
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <a
            href={primaryCta.href}
            data-cta="primary"
            className="rounded-sm bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            {primaryCta.label}
          </a>
          <a
            href={secondaryCta.href}
            data-cta="secondary"
            className="rounded-sm border border-border bg-background/70 px-5 py-2.5 text-sm font-medium text-foreground backdrop-blur-sm transition-colors hover:border-foreground/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            {secondaryCta.label}
          </a>
        </div>
      </div>
    </section>
  );
}
