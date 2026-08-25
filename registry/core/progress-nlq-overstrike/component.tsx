"use client";

// ProgressNlqOverstrike — a determinate progress meter modeled on real
// 9-pin dot-matrix "Near Letter Quality" printing, not an invented dot
// texture. NLQ mode made a coarse 9-pin head fake higher resolution by
// striking every line TWICE: pass one lays dots on the head's native
// pitch, then the carriage returns and pass two strikes the SAME line
// again with the head shifted by exactly HALF a dot pitch, so the second
// pass's dots land in the gaps the first pass left rather than on top of
// them. The interleaved result reads roughly twice as dense as either
// pass alone. This is a real, documented NLQ mechanic (vs. "draft" mode,
// which is the single first pass only) — distinct from a sibling
// component, nav-overstrike-typewriter, which reproduces TYPEWRITER
// overstrike: stacking whole glyphs on top of one another in the SAME
// character cell (a compositing trick, zero spatial offset). This
// component's signature is the opposite of that: identical ink struck
// TWICE at a deliberate spatial offset of exactly half a cell, a
// printer-mechanism fact, not a typography one. Lattice A and lattice B
// below are drawn pitch/2 apart on the same row so the offset is
// unmistakable at a glance — the two components can never be confused.
//
// The progress fill is literalized as the printhead's travel: every
// column left of the fill boundary has already received both passes
// (solid double-density ink). The boundary column is the one currently
// under the head — it is mid dwell, and dwells in a real, continuously
// running two-phase cycle: first pass only, then both passes together
// (NLQ complete), then a brief carriage/paper-feed gap, repeating. That
// cycle runs off `performance.now()` in the rAF loop regardless of
// whether `value` is changing, which is what keeps a HELD, unchanging
// value alive at rest: the head is still sitting there striking the same
// line, not idling. Columns right of the boundary are blank paper, shown
// only as a sparse single-pass --ns-muted guide dot (never doubled) so
// the unprinted region reads as track, not absence.
//
// Scale note: the half-pitch interleave needs at least ~2 legible pixels
// of separation between a lattice-A dot and its lattice-B neighbor to read
// as two dots rather than one blur. Below MIN_PITCH_PX (5px) that
// separation collapses and the two passes visually fuse into a single
// denser dot — still a correct progress read (dense vs. sparse), but the
// NLQ interleave itself stops being perceptible below roughly 40px of bar
// height. The clamp keeps pitch at or above that floor rather than
// scaling dots down indefinitely.

import { useEffect, useLayoutEffect, useRef } from "react";

const MIN_ROWS_SHORT = 6; // dot-pitch rows guaranteed across the bar's shorter dimension (height)
const MIN_PITCH_PX = 5;
const MAX_PITCH_PX = 13;
const DOT_R_FRAC = 0.27; // dot radius as a fraction of pitch — leaves a visible gap between A/B dots
const GUIDE_R_FRAC = 0.14; // unprinted track guide dots: smaller, single pass only

const STRIKE_PERIOD_MS = 900; // one full first-pass / both-passes / feed-gap cycle at the boundary
const STRIKE_FIRST_FRAC = 0.4; // fraction of the cycle showing pass A alone
const STRIKE_GAP_FRAC = 0.1; // fraction of the cycle showing the carriage/paper-feed gap
const BAND_COLS = 1.4; // width, in pitch units, of the "currently under the head" strike zone

const DISPLAY_EASE = 0.14; // per-frame lerp rate easing the drawn fill toward `value`

// reduced-motion freeze: NOT t=0. Freezes at a nonzero, non-degenerate
// fraction of the bar so printed (double-density), the active strike
// column (frozen at its "both passes complete" phase, the moment the
// interleave is most visible) and unprinted guide track are all on
// screen simultaneously.
const STATIC_STRIKE_PHASE = STRIKE_FIRST_FRAC + (1 - STRIKE_FIRST_FRAC - STRIKE_GAP_FRAC) * 0.5;

interface Tokens {
  fg: string;
  muted: string;
}

function readTokens(): Tokens {
  const cs = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return { fg: get("--foreground", "#171717"), muted: get("--ns-muted", "#4d4d4d") };
}

export interface ProgressNlqOverstrikeProps {
  /** progress, 0-100 (controlled). */
  value: number;
  /** accessible label for the progressbar. */
  "aria-label"?: string;
  /** extra classes merged onto the rendered root element — size it here (e.g. "h-16 w-72"); the canvas fills whatever box it's given */
  className?: string;
}

export function ProgressNlqOverstrike({
  value,
  "aria-label": ariaLabel = "Progress",
  className = "",
}: ProgressNlqOverstrikeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tokensRef = useRef<Tokens>({ fg: "", muted: "" });
  const valueRef = useRef(Math.max(0, Math.min(100, value)));
  const displayRef = useRef(valueRef.current);

  // token derive — synchronous, before first paint, so nothing can ever
  // draw with an empty/default ink color
  useLayoutEffect(() => {
    tokensRef.current = readTokens();
  }, []);

  useEffect(() => {
    valueRef.current = Math.max(0, Math.min(100, value));
  }, [value]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let advancePerPx = 0.6; // '@' advance-width / font-size, refined once the mono font is ready
    let pitch = 8;
    let width = 0;
    let height = 0;
    let visible = true;
    let raf = 0;
    let metricsGen = 0;

    const measureAdvance = () => {
      const gen = ++metricsGen;
      const measure = () => {
        if (gen !== metricsGen) return;
        const off = document.createElement("canvas").getContext("2d");
        if (!off) return;
        const REF = 100;
        off.font = `${REF}px "GeistMono", ui-monospace, monospace`;
        const w = off.measureText("@").width;
        if (w > 0) advancePerPx = w / REF;
        computeGeometry();
      };
      if (document.fonts?.ready) {
        document.fonts.ready.then(measure);
      } else {
        measure();
      }
    };

    const computeGeometry = () => {
      const rect = container.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const shortDim = height; // wide-and-short surface: pitch derives from height, not width
      const cellSize = Math.min(MAX_PITCH_PX * 2, Math.max(MIN_PITCH_PX * 2, shortDim / MIN_ROWS_SHORT));
      // fold the measured mono advance-width in so the dot pitch stays
      // proportioned to the same character-cell scale every other
      // registry component derives from, even though no glyphs are drawn
      const fontProportioned = cellSize * advancePerPx * 1.4;
      pitch = Math.min(MAX_PITCH_PX, Math.max(MIN_PITCH_PX, fontProportioned));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.ceil(width * dpr);
      canvas.height = Math.ceil(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reduced) {
        displayRef.current = valueRef.current;
        drawFrame(STATIC_STRIKE_PHASE);
      } else {
        start();
      }
    };

    const drawFrame = (strikePhaseOverride: number | null) => {
      if (width === 0 || height === 0) return;
      ctx.clearRect(0, 0, width, height);
      const { fg, muted } = tokensRef.current;
      const boundaryPx = (displayRef.current / 100) * width;
      const bandPx = BAND_COLS * pitch;

      const cyc =
        strikePhaseOverride ?? (((performance.now() % STRIKE_PERIOD_MS) / STRIKE_PERIOD_MS) as number);
      const secondPassActive = cyc >= STRIKE_FIRST_FRAC && cyc < 1 - STRIKE_GAP_FRAC;

      const rows = Math.max(1, Math.round(height / pitch));
      const rowPitch = height / rows;
      const cols = Math.ceil(width / pitch) + 1;

      ctx.fillStyle = fg;
      for (let j = 0; j < rows; j++) {
        const y = rowPitch * (j + 0.5);
        for (let i = 0; i < cols; i++) {
          const xA = i * pitch;
          const xB = xA + pitch / 2;
          const dPrinted = boundaryPx - bandPx / 2; // everything left of here got both passes already
          const dActiveEnd = boundaryPx + bandPx / 2;

          // lattice A (the pass every printed column has, always struck
          // first — visible for the whole cycle, both in the already-
          // printed region and in the active strike band)
          if (xA >= -pitch && xA < dActiveEnd) {
            drawDot(ctx, xA, y, pitch * DOT_R_FRAC, fg);
          }
          // lattice B (the half-pitch-offset second pass)
          if (xB <= dActiveEnd && xB >= -pitch) {
            const inPrintedZone = xB < dPrinted;
            const inActiveZone = xB >= dPrinted && xB < dActiveEnd;
            if (inPrintedZone) {
              drawDot(ctx, xB, y, pitch * DOT_R_FRAC, fg);
            } else if (inActiveZone && secondPassActive) {
              drawDot(ctx, xB, y, pitch * DOT_R_FRAC, fg);
            }
          }
          // unprinted paper: a sparse, single-pass, never-doubled guide dot
          if (xA > dActiveEnd) {
            drawDot(ctx, xA, y, pitch * GUIDE_R_FRAC, muted);
          }
        }
      }
    };

    const drawDot = (c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) => {
      c.fillStyle = color;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    };

    const loop = () => {
      raf = 0;
      if (!visible || document.hidden) return; // paused: no reschedule, a wake() call restarts it
      displayRef.current += (valueRef.current - displayRef.current) * DISPLAY_EASE;
      drawFrame(null);
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (raf || reduced) return;
      raf = requestAnimationFrame(loop);
    };

    const ro = new ResizeObserver(computeGeometry);
    ro.observe(container);

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        if (visible) start();
      },
      { threshold: 0 }
    );
    io.observe(container);

    const onVisibility = () => {
      if (!document.hidden) start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onReducedChange = () => {
      reduced = mq.matches;
      if (reduced) {
        cancelAnimationFrame(raf);
        raf = 0;
        displayRef.current = valueRef.current;
        drawFrame(STATIC_STRIKE_PHASE);
      } else {
        start();
      }
    };
    mq.addEventListener("change", onReducedChange);

    const mo = new MutationObserver(() => {
      tokensRef.current = readTokens();
      if (reduced) drawFrame(STATIC_STRIKE_PHASE);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });

    measureAdvance();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      mq.removeEventListener("change", onReducedChange);
    };
  }, []);

  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div
      ref={containerRef}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={ariaLabel}
      className={`relative block overflow-hidden ${className}`}
    >
      <canvas ref={canvasRef} aria-hidden className="block h-full w-full" />
    </div>
  );
}
