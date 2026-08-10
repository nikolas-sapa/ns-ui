"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// RosensweigCrest — a flat pool of ASCII glyphs that erupts into a
// hexagonal lattice of spikes wherever the pointer's magnetic field crosses
// a critical threshold, exactly the phase change a real ferrofluid shows
// under a magnet (the Rosensweig instability). This is a deformable SURFACE,
// not particles: one hex lattice of "peak" points covers the field, each
// with its own spring-driven height, and every glyph cell renders the
// height/slope of whichever peak owns its patch of the surface (a faceted
// nearest-peak lookup, not a blurred interpolation — that's what gives the
// crests their sharp, faceted read instead of a smooth blob).
//
// Mechanism, per frame:
//  1. Field strength at a lattice point falls off with distance to the
//     pointer (quadratic falloff over `radius`), then a smoothstep against
//     `threshold` turns that falloff into a hard phase boundary: nothing
//     happens below it, a spike snaps toward full height just above it.
//  2. An exclusion rectangle (measured from the real DOM children — the
//     headline/CTA — expanded by a pad and a soft feather) forces the
//     target back to zero near and under that content, regardless of how
//     close the pointer gets. The surface physically cannot rise under the
//     wordmark; that's not a z-index trick, the field target is zero there.
//  3. Each lattice point springs toward its target with an intentionally
//     ASYMMETRIC response: stiff, underdamped when rising (a fast, slightly
//     overshooting snap — "erupts") and soft, heavily overdamped when
//     falling (a slow, heavy liquid slump). Same spring, two constants,
//     chosen by the sign of the error each frame.
//  4. The hex lattice is authored directly in PIXEL space (dy = dx * √3/2),
//     not in glyph-cell-index space — a lattice built by stepping whole
//     grid cells would come out visually stretched, since a monospace glyph
//     cell is taller than it is wide. Building positions in px and only
//     converting to the nearest glyph cell at draw time is what keeps the
//     hexagons equilateral on screen regardless of font metrics.
//
// Purely decorative: aria-hidden, pointer-events:none, and the pointer
// listener lives on the root container so it can never intercept a click
// meant for the real headline/CTA sitting above it in the same box.
// ---------------------------------------------------------------------------

const RAMP = ["·", "~", "≈", "∧", "▲"]; // flat pool -> crest
const HOLLOW_CHAR = "˘"; // moat between spikes, overrides the height bucket
const HEIGHT_STOPS = [0.02, 0.24, 0.5, 0.74, 1.01]; // upper bound per RAMP index

// pointer influence radius: derived per-instance from container size (see
// resize()), not a fixed px value. A fixed 230px reads fine in isolation but
// composed with the quadratic falloff + 0.5 smoothstep edge below, the
// onset ring only ever reaches d <= radius*(1-sqrt(THRESHOLD)) =~ 0.29*radius
// — a 230px constant was producing a ~67px onset radius (134px eruption)
// inside a full-bleed hero, unmistakably too small to read as "loud".
const FIELD_RADIUS_FACTOR = 1.02; // multiplier of min(width, height)
const FIELD_RADIUS_MIN = 260; // px floor, so scaled-down catalog cards still erupt visibly
const FIELD_RADIUS_MAX = 1100; // px ceiling, so huge heroes don't erupt everywhere at once
const THRESHOLD = 0.5; // fraction of field strength where the phase flips
const THRESHOLD_SOFTNESS = 0.14;
const K_UP = 260; // stiff spring, rising
const C_UP = 15; // low damping -> a small, deliberate overshoot on the snap
const K_DOWN = 26; // soft spring, falling
const C_DOWN = 42; // heavy overdamping -> viscous slump, not a bounce
const CURSOR_EASE = 0.22; // eases the tracked pointer itself (adds to the lag)
const LATTICE_FACTOR = 2.6; // lattice spacing = glyph cell size * this, in px
const EXCLUSION_PAD = 22; // px, expands the measured content rect
const EXCLUSION_FEATHER = 78; // px, soft falloff back to full field strength
const HOLLOW_DELTA = 0.22; // neighbor-max minus own height, to read as a moat
const HOLLOW_MAX_H = 0.55; // moats only register below this height
const DT_MAX = 0.035;
const SLEEP_EPS = 0.004; // aggregate energy below this + no active pointer -> sleep
const TOUCH_PERIOD_MS = 15000; // slow autonomous magnet lap on touch devices

function clamp(x: number, lo: number, hi: number) {
  return x < lo ? lo : x > hi ? hi : x;
}
function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
function heightBucket(h: number) {
  for (let i = 0; i < HEIGHT_STOPS.length; i++) if (h <= HEIGHT_STOPS[i]) return i;
  return HEIGHT_STOPS.length - 1;
}

export interface RosensweigCrestProps {
  /** grid cell size in px, also sets lattice spacing (cell size * 2.6) */
  cellSize?: number;
  /** headline / CTA rendered over the field; the field excludes this rect */
  children?: ReactNode;
  className?: string;
}

export function RosensweigCrest({
  cellSize = 13,
  children,
  className = "",
}: RosensweigCrestProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const exclRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const isTouch = window.matchMedia("(pointer: coarse)").matches;

    let fg = "currentColor";
    let muted = "currentColor";
    let cellW = cellSize;
    let cellH = cellSize;
    let cols = 0;
    let rows = 0;
    let width = 0;
    let height = 0;
    let sized = false;
    let disposed = false;

    // hex lattice, authored in px so it stays equilateral regardless of the
    // glyph cell's aspect ratio (see file header, point 4)
    const dx = () => Math.max(6, cellW * LATTICE_FACTOR);
    const dy = () => dx() * 0.8660254;
    let latCols = 0;
    let latRows = 0;
    let originX = 0;
    let originY = 0;
    let latH = new Float32Array(0);
    let latV = new Float32Array(0);
    let fieldRadius = FIELD_RADIUS_MIN;

    let exclX0 = 0;
    let exclY0 = 0;
    let exclX1 = -1; // x1 < x0 means "no exclusion rect"
    let exclY1 = -1;

    const readTokens = () => {
      fg = getComputedStyle(canvas).color;
      const cs = getComputedStyle(document.documentElement);
      muted = cs.getPropertyValue("--ns-muted").trim() || fg;
    };

    const measureCell = (fontFamily: string) => {
      const off = document.createElement("canvas");
      const octx = off.getContext("2d");
      if (!octx) return;
      octx.font = `${cellSize}px ${fontFamily}`;
      cellW = Math.max(4, octx.measureText("MMMMMMMMMM").width / 10);
      cellH = cellSize;
    };

    const latIndex = (r: number, c: number) => r * latCols + c;

    const measureExclusion = () => {
      const el = exclRef.current;
      const rootEl = rootRef.current;
      if (!el || !rootEl) {
        exclX1 = -1;
        return;
      }
      const rb = rootEl.getBoundingClientRect();
      const eb = el.getBoundingClientRect();
      if (eb.width < 1 || eb.height < 1) {
        exclX1 = -1;
        return;
      }
      exclX0 = eb.left - rb.left - EXCLUSION_PAD;
      exclY0 = eb.top - rb.top - EXCLUSION_PAD;
      exclX1 = eb.right - rb.left + EXCLUSION_PAD;
      exclY1 = eb.bottom - rb.top + EXCLUSION_PAD;
    };

    // 0 inside/near the excluded content, ramping to 1 by EXCLUSION_FEATHER
    // px outside it — this is what stops the surface from ever rising under
    // the headline, independent of where the pointer (or the touch
    // autopath) happens to sit.
    const exclusionFactor = (x: number, y: number) => {
      if (exclX1 < exclX0) return 1;
      const ox = Math.max(exclX0 - x, 0, x - exclX1);
      const oy = Math.max(exclY0 - y, 0, y - exclY1);
      const d = Math.hypot(ox, oy);
      return smoothstep(0, EXCLUSION_FEATHER, d);
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w < 2 || h < 2) {
        sized = false;
        return;
      }
      width = w;
      height = h;
      fieldRadius = clamp(
        Math.min(w, h) * FIELD_RADIUS_FACTOR,
        FIELD_RADIUS_MIN,
        FIELD_RADIUS_MAX
      );
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const fontFamily = getComputedStyle(canvas).fontFamily;
      measureCell(fontFamily);
      ctx.font = `${cellSize}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      cols = Math.max(8, Math.ceil(w / cellW));
      rows = Math.max(6, Math.ceil(h / cellH));

      const spacingX = dx();
      const spacingY = dy();
      originX = -2 * spacingX;
      originY = -2 * spacingY;
      latCols = Math.max(2, Math.ceil(w / spacingX) + 4);
      latRows = Math.max(2, Math.ceil(h / spacingY) + 4);
      latH = new Float32Array(latCols * latRows);
      latV = new Float32Array(latCols * latRows);

      measureExclusion();
      sized = true;
    };

    // finds the lattice point nearest (x,y) among the up-to-9 hex candidates
    // checked, plus the tallest height in that same neighborhood — the pair
    // is enough to decide "flat/rising/crest" vs "hollow moat next to a
    // taller spike" without keeping a precomputed adjacency list. maxH
    // deliberately includes the nearest point itself: when the nearest IS
    // the local tallest, maxH - bestH is 0 and the moat check never fires.
    const nearest = (x: number, y: number) => {
      const spacingX = dx();
      const spacingY = dy();
      const approxRow = Math.round((y - originY) / spacingY);
      let bestD = Infinity;
      let bestH = 0;
      let maxH = 0;
      for (let dr = -1; dr <= 1; dr++) {
        const r = approxRow + dr;
        if (r < 0 || r >= latRows) continue;
        const rowOffset = r % 2 !== 0 ? spacingX / 2 : 0;
        const approxCol = Math.round((x - originX - rowOffset) / spacingX);
        for (let dc = -1; dc <= 1; dc++) {
          const c = approxCol + dc;
          if (c < 0 || c >= latCols) continue;
          const px = originX + c * spacingX + rowOffset;
          const py = originY + r * spacingY;
          const ddx = px - x;
          const ddy = py - y;
          const d2 = ddx * ddx + ddy * ddy;
          const h = latH[latIndex(r, c)];
          if (h > maxH) maxH = h;
          if (d2 < bestD) {
            bestD = d2;
            bestH = h;
          }
        }
      }
      return { h: bestH, neighborMax: maxH };
    };

    const drawFrame = () => {
      if (!sized) return;
      const w = cols * cellW;
      const h = rows * cellH;
      ctx.clearRect(0, 0, w, h);

      for (let r = 0; r < rows; r++) {
        const cy = r * cellH + cellH / 2;
        for (let c = 0; c < cols; c++) {
          const cx = c * cellW + cellW / 2;
          const { h: peakH, neighborMax } = nearest(cx, cy);
          const isHollow =
            peakH < HOLLOW_MAX_H && neighborMax - peakH > HOLLOW_DELTA;

          if (isHollow) {
            ctx.globalAlpha = 0.55;
            ctx.fillStyle = muted;
            ctx.fillText(HOLLOW_CHAR, cx, cy);
            continue;
          }

          const bucket = heightBucket(peakH);
          if (bucket === 0) {
            ctx.globalAlpha = 0.32;
            ctx.fillStyle = muted;
          } else if (bucket === 1) {
            ctx.globalAlpha = 0.6;
            ctx.fillStyle = muted;
          } else {
            ctx.globalAlpha = 0.55 + 0.45 * (bucket / (RAMP.length - 1));
            ctx.fillStyle = fg;
          }
          ctx.fillText(RAMP[bucket], cx, cy);
        }
      }
      ctx.globalAlpha = 1;
    };

    // -- hot-path state: locals only, never React state ---------------------
    let raf = 0;
    let last = 0;
    let t = 0;
    let pointerActive = false;
    const cursor = { tx: 0, ty: 0, x: 0, y: 0 };

    const updatePhysics = (dt: number) => {
      let energy = 0;
      for (let r = 0; r < latRows; r++) {
        const rowOffset = r % 2 !== 0 ? dx() / 2 : 0;
        const py = originY + r * dy();
        for (let c = 0; c < latCols; c++) {
          const px = originX + c * dx() + rowOffset;
          const idx = latIndex(r, c);
          let target = 0;
          if (pointerActive) {
            const ddx = cursor.x - px;
            const ddy = cursor.y - py;
            const d = Math.hypot(ddx, ddy);
            let field = clamp(1 - d / fieldRadius, 0, 1);
            field = field * field; // quadratic falloff
            field = smoothstep(THRESHOLD, THRESHOLD + THRESHOLD_SOFTNESS, field);
            target = field * exclusionFactor(px, py);
          }
          const hNow = latH[idx];
          const vNow = latV[idx];
          const err = target - hNow;
          const k = err >= 0 ? K_UP : K_DOWN;
          const damp = err >= 0 ? C_UP : C_DOWN;
          const a = k * err - damp * vNow;
          const v = vNow + a * dt;
          const hNext = clamp(hNow + v * dt, 0, 1.12);
          latH[idx] = hNext;
          latV[idx] = v;
          energy += Math.abs(v) + hNext;
        }
      }
      return energy;
    };

    const loop = (now: number) => {
      const dt = last ? Math.min(DT_MAX, (now - last) / 1000) : 1 / 60;
      last = now;
      t += dt;

      if (isTouch) {
        // slow autonomous magnet path — the exclusion rect still guards the
        // headline even though nothing here checks its position
        const omega = (2 * Math.PI) / (TOUCH_PERIOD_MS / 1000);
        cursor.tx = width / 2 + Math.cos(t * omega) * width * 0.33;
        cursor.ty = height / 2 + Math.sin(t * omega * 1.3) * height * 0.3;
        pointerActive = true;
      }
      cursor.x += (cursor.tx - cursor.x) * CURSOR_EASE;
      cursor.y += (cursor.ty - cursor.y) * CURSOR_EASE;

      const energy = updatePhysics(dt);
      drawFrame();

      const settled = energy < SLEEP_EPS * Math.max(1, latCols * latRows * 0.02);
      raf =
        !document.hidden && (pointerActive || !settled)
          ? requestAnimationFrame(loop)
          : 0;
    };

    const wake = () => {
      if (!raf && !document.hidden) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return; // touch gets the autonomous path
      const rect = root.getBoundingClientRect();
      cursor.tx = e.clientX - rect.left;
      cursor.ty = e.clientY - rect.top;
      pointerActive = true;
      wake();
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      pointerActive = false;
      wake();
    };

    let ro: ResizeObserver | undefined;
    let exclRo: ResizeObserver | undefined;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (reduced) drawStaticErupted();
        else drawFrame();
      }, 150);
    };

    // reduced-motion: one static frame of the FORMED lattice, not the flat
    // rest state — a virtual magnet is placed once and heights are set
    // directly to their equilibrium target, no spring, no loop.
    const drawStaticErupted = () => {
      if (!sized) return;
      const vx = width * 0.62;
      const vy = height * 0.38;
      for (let r = 0; r < latRows; r++) {
        const rowOffset = r % 2 !== 0 ? dx() / 2 : 0;
        const py = originY + r * dy();
        for (let c = 0; c < latCols; c++) {
          const px = originX + c * dx() + rowOffset;
          const idx = latIndex(r, c);
          const d = Math.hypot(vx - px, vy - py);
          let field = clamp(1 - d / fieldRadius, 0, 1);
          field = field * field;
          field = smoothstep(THRESHOLD, THRESHOLD + THRESHOLD_SOFTNESS, field);
          latH[idx] = field * exclusionFactor(px, py);
          latV[idx] = 0;
        }
      }
      drawFrame();
    };

    readTokens();
    const mo = new MutationObserver(() => {
      readTokens();
      // a theme flip while asleep (rest, no pointer) would otherwise leave
      // stale-colored glyphs on screen until the next pointer wake — force
      // one repaint with the freshly-read tokens regardless of loop state.
      if (reduced) drawStaticErupted();
      else if (raf) wake();
      else drawFrame();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    document.fonts.ready.then(() => {
      if (disposed) return;
      resize();
      if (reduced) {
        drawStaticErupted();
      } else if (isTouch) {
        pointerActive = true;
        raf = requestAnimationFrame(loop);
      } else {
        drawFrame(); // flat pool, mirror-still, until the pointer arrives
      }
      ro = new ResizeObserver(() => {
        onResize();
      });
      ro.observe(root);
      if (exclRef.current) {
        exclRo = new ResizeObserver(() => {
          measureExclusion();
        });
        exclRo.observe(exclRef.current);
      }
    });

    if (!reduced && !isTouch) {
      root.addEventListener("pointermove", onMove);
      root.addEventListener("pointerleave", onLeave);
    }
    const onVis = () => {
      if (!document.hidden) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      ro?.disconnect();
      exclRo?.disconnect();
      mo.disconnect();
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [cellSize]);

  return (
    <div
      ref={rootRef}
      className={`relative isolate h-full w-full overflow-hidden bg-background font-mono ${
        /\bmin-h-/.test(className) ? "" : "min-h-screen"
      } ${className}`}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 block h-full w-full text-foreground [animation:ns-crest-breathe_7s_ease-in-out_infinite] motion-reduce:animate-none"
      />
      <style>{`
@keyframes ns-crest-breathe{0%,100%{opacity:0.86}50%{opacity:1}}
`}</style>
      {children ? (
        <div className="relative z-10 flex h-full w-full flex-col items-start justify-center gap-4 p-8 sm:p-14">
          {/* exclRef hugs just the content, not this w-full/h-full centering
              wrapper — measuring the wrapper instead would hand the field
              target an exclusion rect spanning the container's entire width
              (and most of its height on narrow cards), leaving the surface
              nowhere to erupt. */}
          <div ref={exclRef} className="flex flex-col items-start gap-4">
            {children}
          </div>
        </div>
      ) : null}
    </div>
  );
}
