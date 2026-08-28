"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// ScrollFineRegister — a divider/footer band whose "content is streaming
// past" cue is built from the two cooperating registers a tilemap PPU
// (NES/SNES-class hardware) actually scrolls with, not a plain translateX
// tween. A COARSE register steps the visible window one whole tile at a
// time by swapping which tile glyph is addressed; a FINE register sweeps
// 0..cellPx-1 sub-pixel offsets within the current tile before the coarse
// register ticks over. What reads as smooth pixel-by-pixel motion is a
// sawtooth (fine ramping up then snapping to 0) gating a stepped counter
// (coarse incrementing once per sawtooth cycle) — and both registers are
// exposed as a live numeric readout so the mechanism is legible, not just
// its resulting motion.
//
// One totalSteps integer (in px) is the single source of truth: fine =
// totalSteps % cellPx, coarse = floor(totalSteps / cellPx) % tileCount. A
// fixed-rate accumulator ticks totalSteps by 1 every (480ms / cellPx) —
// so a full tile's worth of fine steps always takes exactly 480ms,
// regardless of how many discrete px steps cellPx works out to.
//
// tileCount (24-40) is the COARSE WRAP PERIOD — the pattern of tile
// glyphs repeats every tileCount cells and totalSteps wraps at
// tileCount*cellPx. That is deliberately kept separate from how many
// cells are actually rendered: renderCount = ceil(width/cellPx) +
// tileCount cells are painted (glyph = pattern[j % tileCount]), a
// full period wider than the viewport, so the strip never runs dry as
// totalSteps sweeps across an entire wrap cycle — a doubled-strip trick
// only covers a translate range up to one strip width, this covers the
// whole period.
//
// The glyph sequence itself is not a short repeating ramp: a fixed-seed
// mulberry32 PRNG draws `tileCount` glyph choices once per build, so the
// visual texture's true repeat period is the full tileCount*cellPx wrap
// (11.5-19.2s), not some short arithmetic cycle — otherwise the strip
// would loop every couple of seconds while only the readout kept counting.
//
// A single marker — an absolutely positioned overlay, not a strip cell —
// tracks `MARKER_LEAD` tiles ahead of the live coarse register at screen
// x = MARKER_LEAD*cellPx - fine, so it visibly slides left by cellPx px
// over the 480ms sweep and snaps back at the next coarse tick: the
// sawtooth made literally visible on the one thing a viewer's eye
// follows. Drawn as a full-height --foreground bracket (border-left +
// border-right only, cellPx wide) so it stays legible on top of every
// glyph underneath it, including the solid block.
//
// Geometry is derived from the container's smaller dimension (almost
// always height, for a horizontal band): cellPx = clamp(round(minDim/24),
// 8, 16). Translation is written directly to the track's transform and
// the readout's textContent every tick — no React state on the hot path.
// Pure DOM, zero colour literals: ink is `text-foreground` /
// `text-ns-muted`; `border-border` is used only for the band's own
// dividing rules, never as the marker's paint.
// ---------------------------------------------------------------------------

export interface ScrollFineRegisterProps {
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const MIN_CELL = 8;
const MAX_CELL = 16;
const CELL_DIVISOR = 24;
const SWEEP_MS = 480; // one full fine-register sweep (0..cellPx-1) = one coarse tick
const MIN_TILES = 24;
const MAX_TILES = 40;
const MARKER_LEAD = 4; // marker sits this many tiles ahead of the coarse index
const FROZEN_COARSE_FALLBACK = 12; // reduced-motion freeze target: mid-strip, tile-aligned

// A small "tile ROM" restricted to shading blocks — these are solid
// rectangles in every monospace face, so they read cleanly as tile
// pixels even at an 8px cell where a glyph with descenders/gaps would not.
const GLYPHS = "░▒▓█";

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

/** One glyph choice per tile index, 0..tileCount-1 — the true visual
 * repeat period, not a short arithmetic ramp. */
function buildPattern(tileCount: number): string[] {
  const rand = mulberry32(0x5f3a11);
  const pattern: string[] = [];
  for (let i = 0; i < tileCount; i++) {
    pattern.push(GLYPHS[Math.floor(rand() * GLYPHS.length)]!);
  }
  return pattern;
}

export function ScrollFineRegister({ className = "" }: ScrollFineRegisterProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const coarseRef = useRef<HTMLSpanElement>(null);
  const fineRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const track = trackRef.current;
    const marker = markerRef.current;
    const probe = probeRef.current;
    if (!root || !track || !marker || !probe) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let disposed = false;
    let cellPx = MIN_CELL;
    let tileCount = MIN_TILES; // coarse wrap period, in tiles
    let renderCount = MIN_TILES; // cells actually painted, >= period + viewport
    let stepMs = SWEEP_MS / cellPx;
    let totalSteps = 0; // px units; fine = totalSteps % cellPx, coarse = floor(totalSteps/cellPx) % tileCount
    let acc = 0;
    let last = 0;
    let raf = 0;
    let visible = true;
    let pattern: string[] = [];

    const paint = () => {
      const fine = totalSteps % cellPx;
      const coarse = Math.floor(totalSteps / cellPx) % tileCount;
      track.style.transform = `translate3d(${-totalSteps}px, 0, 0)`;
      marker.style.width = `${cellPx}px`;
      marker.style.transform = `translate3d(${MARKER_LEAD * cellPx - fine}px, 0, 0)`;
      marker.style.visibility = "visible";
      if (coarseRef.current) coarseRef.current.textContent = String(coarse).padStart(2, "0");
      if (fineRef.current) fineRef.current.textContent = String(fine);
    };

    // -- (re)build the tile strip for the current geometry. renderCount is
    // one full coarse period wider than the viewport so every reachable
    // translate offset within a period still fully covers the track. ------
    const build = () => {
      const rect = root.getBoundingClientRect();
      const minDim = Math.min(rect.width, rect.height);
      cellPx = Math.min(MAX_CELL, Math.max(MIN_CELL, Math.round(minDim / CELL_DIVISOR)));
      stepMs = SWEEP_MS / cellPx;

      const visibleTiles = Math.ceil(rect.width / Math.max(1, cellPx));
      tileCount = Math.min(MAX_TILES, Math.max(MIN_TILES, visibleTiles));
      renderCount = visibleTiles + tileCount + MARKER_LEAD + 1;
      pattern = buildPattern(tileCount);

      // measure the real glyph advance at this cellPx (monospace advance
      // is well under 1em) and scale the font so a glyph's rendered width
      // fills the cell — otherwise adjacent tiles read as separated bars,
      // not a contiguous tilemap.
      probe.style.fontSize = `${cellPx}px`;
      const advance = probe.getBoundingClientRect().width || cellPx * 0.6;
      const glyphFontPx = Math.max(6, Math.round(cellPx * Math.min(2.5, cellPx / advance)));

      track.textContent = "";
      for (let j = 0; j < renderCount; j++) {
        const span = document.createElement("span");
        span.setAttribute("aria-hidden", "true");
        span.style.display = "inline-flex";
        span.style.alignItems = "center";
        span.style.justifyContent = "center";
        span.style.width = `${cellPx}px`;
        span.style.height = `${cellPx}px`;
        span.style.overflow = "hidden";
        span.style.fontSize = `${glyphFontPx}px`;
        span.style.lineHeight = "1";
        span.style.flexShrink = "0";
        span.style.boxSizing = "border-box";
        span.className = "text-foreground";
        span.textContent = pattern[j % tileCount]!;
        track.appendChild(span);
      }
      totalSteps = ((totalSteps % (tileCount * cellPx)) + tileCount * cellPx) % (tileCount * cellPx);
    };

    const freeze = () => {
      const frozenCoarse = Math.min(tileCount - 1, FROZEN_COARSE_FALLBACK);
      totalSteps = frozenCoarse * cellPx; // fine === 0 exactly — a tile boundary flush with the viewport edge
      paint();
    };

    const loop = (now: number) => {
      raf = 0;
      if (!visible) return;
      if (last === 0) last = now;
      const dt = Math.min(100, now - last);
      last = now;
      acc += dt;
      while (acc >= stepMs) {
        acc -= stepMs;
        totalSteps += 1;
        if (totalSteps >= tileCount * cellPx) totalSteps -= tileCount * cellPx;
      }
      paint();
      raf = requestAnimationFrame(loop);
    };

    build();

    if (reduced) {
      freeze();
    } else {
      // start a few steps into the sweep so t0 already reads as
      // "mid-motion", not a just-ticked-over frame.
      totalSteps = 3;
      last = 0;
      raf = requestAnimationFrame(loop);
    }

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (disposed) return;
        build();
        if (reduced) freeze();
        else paint();
      }, 120);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(root);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !reduced && !raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(root);

    document.fonts?.ready?.then(() => {
      if (!disposed) onResize();
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`flex h-12 items-stretch overflow-hidden border-y border-border bg-background ${className}`}
    >
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <span
          ref={probeRef}
          aria-hidden="true"
          className="pointer-events-none absolute -left-[9999px] top-0 font-mono"
          style={{ visibility: "hidden", whiteSpace: "pre" }}
        >
          █
        </span>
        <div ref={trackRef} className="flex h-full items-center font-mono will-change-transform" />
        <div
          ref={markerRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 border-x border-foreground will-change-transform"
          style={{ visibility: "hidden" }}
        />
      </div>
      <div className="flex shrink-0 items-center gap-2 border-l border-border px-4 font-mono text-[11px] tabular-nums text-foreground">
        <span className="text-ns-muted">C</span>
        <span ref={coarseRef}>00</span>
        <span className="text-ns-muted">F</span>
        <span ref={fineRef}>0</span>
      </div>
    </div>
  );
}
