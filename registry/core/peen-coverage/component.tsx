"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// PeenCoverage — an ambient card texture reproducing shot peening's coverage
// process (SAE/AMS peening spec), not a literal progress bar. A stream of
// small round shot is blasted at a metal surface at high velocity; each
// impact leaves a shallow dimple, and quality is graded by COVERAGE — the
// percentage of surface area that has taken a dimple — never by time or
// shot count directly. New impacts increasingly land on already-dimpled
// area as coverage rises, which is exactly the Avrami-type saturation curve
// real peening exhibits, and shops explicitly re-run passes past nominal
// 100% up to 150-200% coverage before calling a part done.
//
// Coverage is never computed from a closed-form curve and painted on: the
// bitmap is genuinely stamped by discrete, uniform-random impacts at a
// fixed rate, and the saturation read (denser regions increasingly
// re-covering rather than spreading) falls straight out of that random
// process the same way it does on a real part — the same reason a Poisson
// disc process converges to `1 - exp(-lambda*A*t)` coverage on its own.
// Overlap CLAMPS rather than stacks: a cell's depth is `Math.max`'d against
// each new stamp's falloff, so a second hit on covered ground re-confirms
// coverage instead of digging a deeper hole, matching real peening where a
// second strike on already-dimpled steel doesn't compound.
//
// Sim grid is a Float32Array at `cell = min(width,height)/48` resolution,
// derived from the card's own smaller dimension so a dimple always reads as
// roughly one grid cell regardless of card size. Every frame the grid is
// composed into a small offscreen canvas (one pixel per grid cell) and
// scaled up with imageSmoothingEnabled — this is what buys the soft
// stippled read and keeps per-frame cost flat at O(cols*rows) regardless of
// how many impacts have landed, rather than replaying impact history.
//
// A pass runs 16s: nominal (statistical) 100% coverage lands around t=8s,
// the pass is deliberately allowed to continue stamping to a visual
// 200%-equivalent density by t=16s (matching shops re-running passes past
// nominal before calling a part done), then the bitmap fades back to
// unpeened over 700ms — a legible "fresh part loaded" beat, the one place
// this mechanic is allowed a clean restart, because a resting peening LINE
// is a sequence of parts, not one part run forever. Cycle phase is
// deliberately desynced across mounts: the pass clock starts already
// partway in (offset derived from `performance.now()` at mount, backfilled
// by bulk-stamping that many virtual impacts instantly), so two page loads
// show different coverage states and a single mount's own three resting
// checkpoints (t0 / 2.5s / 5s of whichever cycle is running) read as
// visibly distinct textures rather than always starting blank.
//
// Hover/focus locally boosts impact rate 2x within a dwell radius (an
// operator lingering the nozzle over one spot, a real peening behaviour),
// decaying linearly over 500ms after the pointer leaves. This only adds
// EXTRA local impacts on top of the always-running global 90/s base rate —
// it never touches the 16s pass clock, so dwelling somewhere cannot stall
// or rush the reset. Highlights move in luminance only (deeper into the
// existing base->dimple ramp); --ns-accent never touches the surface.
// ---------------------------------------------------------------------------

export interface PeenCoverageProps {
  /** card heading */
  title?: string;
  /** card body copy */
  description?: string;
  /** trailing link label; omit to render the card with no link */
  linkLabel?: string;
  /** link href, used only when linkLabel is set */
  href?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
  /** inline styles merged onto the root element */
  style?: CSSProperties;
}

type RGB = [number, number, number];

function parseColor(raw: string): RGB | null {
  const s = raw.trim();
  if (s.startsWith("#")) {
    let hex = s.slice(1);
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    if (hex.length < 6) return null;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return Number.isNaN(r + g + b) ? null : [r, g, b];
  }
  const m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function relLuminance([r, g, b]: RGB): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function mixRGB(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CELL_DIVISOR = 48; // cell = min(w,h) / 48
const DIMPLE_RADIUS_CELLS = 1.3;
const BASE_RATE = 90; // impacts / second, global uniform-random
const HOVER_RADIUS_CELLS = 6;
const HOVER_EXTRA_RATE = 90; // extra impacts/s inside the dwell radius at full boost (-> ~2x locally)
const HOVER_DECAY_MS = 500;
const CYCLE_MS = 16000; // full pass: nominal coverage ~t=8s, visual 200%-equivalent by t=16s
const RESET_FADE_MS = 700;
// Reduced motion freezes at t=6s of a cycle (~55% coverage by the process's
// own statistics) — dense enough to read as an active process, short of
// either a blank start or a saturated-flat finish.
const STATIC_TIME_S = 6;
const FREEZE_PHASE = "55pct-coverage";

interface Grid {
  cols: number;
  rows: number;
  cells: Float32Array;
}

function makeGrid(cols: number, rows: number): Grid {
  return { cols, rows, cells: new Float32Array(Math.max(1, cols * rows)) };
}

function stampImpact(grid: Grid, fx: number, fy: number): void {
  const r = DIMPLE_RADIUS_CELLS;
  const minI = Math.max(0, Math.floor(fx - r));
  const maxI = Math.min(grid.cols - 1, Math.ceil(fx + r));
  const minJ = Math.max(0, Math.floor(fy - r));
  const maxJ = Math.min(grid.rows - 1, Math.ceil(fy + r));
  for (let j = minJ; j <= maxJ; j++) {
    for (let i = minI; i <= maxI; i++) {
      const dx = i + 0.5 - fx;
      const dy = j + 0.5 - fy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > r) continue;
      // soft circular indent, full depth at the centre easing to 0 at the
      // dimple's edge; clamp (max) against any prior value at this cell so
      // a second, overlapping hit re-confirms rather than compounds.
      const depth = smoothstep(0, 1, 1 - dist / r);
      const idx = j * grid.cols + i;
      const cur = grid.cells[idx] ?? 0;
      if (depth > cur) grid.cells[idx] = depth;
    }
  }
}

export function PeenCoverage({
  title = "Shot peening, pass 12",
  description = "Coverage, not shot count, is the spec — the pass keeps running past nominal until re-hits stop finding bare steel.",
  linkLabel = "Read the process card",
  href = "#",
  className = "",
  style,
}: PeenCoverageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufCanvas = document.createElement("canvas");
    const bufCtx = bufCanvas.getContext("2d", { willReadFrequently: false });
    if (!bufCtx) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;

    // -- token-derived colour, re-read on any theme class flip, never a literal --
    let bg: RGB = [10, 10, 10];
    let muted: RGB = [143, 143, 143];
    let fg: RGB = [237, 237, 237];
    let surfaceBase: RGB = bg;
    let dimpleColor: RGB = muted;
    const deriveColors = () => {
      const cs = getComputedStyle(document.documentElement);
      bg = parseColor(cs.getPropertyValue("--background")) ?? bg;
      muted = parseColor(cs.getPropertyValue("--ns-muted")) ?? muted;
      fg = parseColor(cs.getPropertyValue("--foreground")) ?? fg;
      const isDark = relLuminance(bg) < 0.5;
      if (isDark) {
        surfaceBase = bg;
        dimpleColor = muted;
      } else {
        // light theme: base leans toward --ns-muted so a further step still
        // has room to read before the surface color, dimples push one more
        // step toward --foreground along the same direction.
        surfaceBase = mixRGB(bg, muted, 0.42);
        dimpleColor = mixRGB(muted, fg, 0.45);
      }
    };
    deriveColors();

    let w = 0;
    let h = 0;
    let dpr = 1;
    let cell = 4;
    let grid = makeGrid(1, 1);
    let visible = true;
    let raf = 0;

    let cycleStartAt = 0; // performance.now() timestamp the current pass began (virtual)
    let phase: "active" | "fading" = "active";
    let fadeStartAt = 0;
    let fadeSnapshot: Float32Array | null = null;

    let accBase = 0;
    let accHover = 0;
    let lastNow = 0;

    let hovering = false;
    let hoverGX = 0;
    let hoverGY = 0;
    let hoverLeaveAt = 0;

    const rand = mulberry32(0x9e5f21b1);

    const cycleElapsedMs = (now: number) => now - cycleStartAt;

    const beginCycle = (now: number, virtualOffsetMs: number) => {
      grid = makeGrid(grid.cols, grid.rows);
      phase = "active";
      fadeSnapshot = null;
      accBase = 0;
      accHover = 0;
      cycleStartAt = now - virtualOffsetMs;
      lastNow = now;
      // backfill the offset instantly so two mounts land on different
      // coverage states instead of always starting blank at t0.
      const backfillImpacts = Math.floor((BASE_RATE * virtualOffsetMs) / 1000);
      for (let i = 0; i < backfillImpacts; i++) {
        stampImpact(grid, rand() * grid.cols, rand() * grid.rows);
      }
    };

    const hoverMultiplier = (now: number): number => {
      if (hovering) return 1;
      if (hoverLeaveAt === 0) return 0;
      const t = 1 - (now - hoverLeaveAt) / HOVER_DECAY_MS;
      return t > 0 ? t : 0;
    };

    const stepImpacts = (dtMs: number, now: number) => {
      const dtS = dtMs / 1000;
      accBase += BASE_RATE * dtS;
      const baseCount = Math.floor(accBase);
      accBase -= baseCount;
      for (let i = 0; i < baseCount; i++) {
        stampImpact(grid, rand() * grid.cols, rand() * grid.rows);
      }

      const mult = hoverMultiplier(now);
      if (mult > 0) {
        accHover += HOVER_EXTRA_RATE * mult * dtS;
        const hoverCount = Math.floor(accHover);
        accHover -= hoverCount;
        const rCells = HOVER_RADIUS_CELLS;
        for (let i = 0; i < hoverCount; i++) {
          const ang = rand() * Math.PI * 2;
          const rad = Math.sqrt(rand()) * rCells;
          const fx = Math.min(grid.cols, Math.max(0, hoverGX + Math.cos(ang) * rad));
          const fy = Math.min(grid.rows, Math.max(0, hoverGY + Math.sin(ang) * rad));
          stampImpact(grid, fx, fy);
        }
      } else {
        accHover = 0;
      }
    };

    const compose = () => {
      const cols = grid.cols;
      const rows = grid.rows;
      const img = bufCtx.createImageData(cols, rows);
      const data = img.data;
      const source = phase === "fading" && fadeSnapshot ? fadeSnapshot : grid.cells;
      let fadeT = 0;
      if (phase === "fading") {
        fadeT = Math.min(1, (performance.now() - fadeStartAt) / RESET_FADE_MS);
      }
      for (let idx = 0; idx < cols * rows; idx++) {
        let v = source[idx] ?? 0;
        if (phase === "fading") v = v * (1 - fadeT);
        const [r, g, b] = mixRGB(surfaceBase, dimpleColor, Math.min(1, v));
        const o = idx * 4;
        data[o] = r;
        data[o + 1] = g;
        data[o + 2] = b;
        data[o + 3] = 255;
      }
      bufCtx.putImageData(img, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(bufCanvas, 0, 0, cols, rows, 0, 0, w, h);
      return fadeT;
    };

    const draw = (now: number) => {
      if (w <= 0 || h <= 0) return;

      if (phase === "active") {
        const elapsed = cycleElapsedMs(now);
        if (elapsed >= CYCLE_MS) {
          phase = "fading";
          fadeStartAt = now;
          fadeSnapshot = grid.cells.slice();
        }
      }

      if (phase === "fading") {
        const fadeT = compose();
        if (fadeT >= 1) {
          beginCycle(now, 0);
        }
        return;
      }

      compose();
    };

    const loop = (now: number) => {
      const dt = lastNow === 0 ? 0 : Math.min(100, now - lastNow);
      lastNow = now;
      if (phase === "active") stepImpacts(dt, now);
      draw(now);
      if (!reduced && visible) raf = requestAnimationFrame(loop);
      else raf = 0;
    };
    const wake = () => {
      if (raf === 0 && !reduced && visible) {
        lastNow = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      if (w < 2 || h < 2) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      cell = Math.max(1, Math.min(w, h) / CELL_DIVISOR);
      const cols = Math.max(1, Math.ceil(w / cell));
      const rows = Math.max(1, Math.ceil(h / cell));
      bufCanvas.width = cols;
      bufCanvas.height = rows;
      grid = makeGrid(cols, rows);

      if (reduced) {
        // bake the deliberately-chosen freeze frame synchronously, once,
        // and never touch the grid again.
        phase = "active";
        fadeSnapshot = null;
        const impacts = Math.floor(BASE_RATE * STATIC_TIME_S);
        for (let i = 0; i < impacts; i++) {
          stampImpact(grid, rand() * cols, rand() * rows);
        }
        compose();
        return;
      }

      // fresh grid at the new resolution: restart the pass with a new
      // mount-time-derived phase offset so a resize doesn't just resume a
      // stale bitmap at the wrong cell count.
      const offsetMs = performance.now() % CYCLE_MS;
      beginCycle(performance.now(), offsetMs);
      draw(performance.now());
    };

    resize();
    if (!reduced) wake();

    const ro = new ResizeObserver(resize);
    ro.observe(root);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) wake();
      else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    io.observe(root);

    const mo = new MutationObserver(() => {
      deriveColors();
      draw(reduced ? 0 : performance.now());
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const onReducedChange = () => {
      reduced = mq.matches;
      if (reduced) {
        cancelAnimationFrame(raf);
        raf = 0;
        resize();
      } else {
        const offsetMs = performance.now() % CYCLE_MS;
        beginCycle(performance.now(), offsetMs);
        wake();
      }
    };
    mq.addEventListener("change", onReducedChange);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        wake();
      } else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const toGrid = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const gx = ((clientX - rect.left) / rect.width) * grid.cols;
      const gy = ((clientY - rect.top) / rect.height) * grid.rows;
      return { gx, gy };
    };
    const onPointerMove = (e: PointerEvent) => {
      if (reduced) return;
      const { gx, gy } = toGrid(e.clientX, e.clientY);
      hovering = true;
      hoverGX = gx;
      hoverGY = gy;
      hoverLeaveAt = 0;
    };
    const onPointerLeave = () => {
      hovering = false;
      hoverLeaveAt = performance.now();
    };
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("pointercancel", onPointerLeave);

    return () => {
      cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      mq.removeEventListener("change", onReducedChange);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("pointercancel", onPointerLeave);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      data-reduced-motion-freeze={FREEZE_PHASE}
      className={`ns-peen relative w-full max-w-sm overflow-hidden rounded-[14px] border border-border bg-background ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-auto absolute inset-0 h-full w-full" />
      <div ref={contentRef} className="pointer-events-none relative flex flex-col gap-3 p-6">
        <h3 className="text-balance font-sans text-lg font-medium text-foreground">{title}</h3>
        <p className="text-pretty font-mono text-xs leading-relaxed text-ns-muted">{description}</p>
        {linkLabel ? (
          <a
            href={href}
            className="pointer-events-auto mt-1 inline-flex w-fit items-center gap-1 rounded-sm font-mono text-xs font-medium text-foreground underline decoration-border underline-offset-4 transition-colors duration-150 hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            {linkLabel}
            <span aria-hidden="true">&rarr;</span>
          </a>
        ) : null}
      </div>
    </div>
  );
}

PeenCoverage.displayName = "PeenCoverage";

export default PeenCoverage;
