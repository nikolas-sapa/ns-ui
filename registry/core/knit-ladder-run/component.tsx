"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// KnitLadderRun — an ambient status/health feedback card background: a field
// of knit stitches builds downward course by course, and at random intervals
// a dropped stitch opens a ladder ("run") that unravels a few rows before a
// latch-hook repair catches it and reknits the column. Source: weft-knit
// loop formation + latch-hook ladder repair (textile/knitting).
//
// Distinct from text-stitch-unpick (pointer-driven, letter-by-letter,
// irreversible per letter) and optimistic-stitch (a single row's write
// lifecycle, never loops): this is fully ambient, builds continuously, and
// its ladder-run is a RECURRING, SELF-HEALING fault, not a one-shot
// lifecycle or a pointer gesture.
//
// TIMELINE — two clocks, both derived from one elapsed-ms counter, no React
// state:
//   continuousCourse = elapsedMs / COURSE_MS   (smooth fractional scroll)
//   currentCourse    = floor(continuousCourse)  (newest row that exists)
// New courses enter at the bottom edge; existing courses drift upward and
// eventually exit the top (the "continuous fabric take-down" feed) — never
// a fixed-length pass.
//
// LADDER STATE MACHINE (one plain ref object, at most one ladder live):
//   idle -> trigger (random 7-10s gap) picks a column, a length (4-7 rows)
//   and an anchor `dropRow` = currentCourse - length (so the whole span
//   already exists and propagation never has to wait on new courses).
//   OPEN phase: row (dropRow + k) collapses from a stitch to a bare rail
//   at openAt(k) = openStartTime + k*350ms, animated over a 120ms window.
//   REPAIR phase starts once every row has opened (repairStart = openStart
//   + length*350ms) and closes rows bottom-up (the newest/last-opened row
//   closes FIRST) one rung every 300ms, each with a brief latch-hook glyph
//   and a 150ms close animation, until the topmost (drop) row reseals and
//   the column matches its neighbors again — the ladder always finishes.
// ---------------------------------------------------------------------------

const COURSE_MS = 900; // one full course (row) build event
const PITCH_TARGET = 10; // px, target stitch pitch
const MIN_COLS = 14;
const MAX_COLS = 28;

const LADDER_MIN_INTERVAL_MS = 7000;
const LADDER_MAX_INTERVAL_MS = 10000;
const LADDER_MIN_LEN = 4;
const LADDER_MAX_LEN = 7;
const OPEN_STEP_MS = 350;
const OPEN_ANIM_MS = 120;
const CLOSE_STEP_MS = 300;
const CLOSE_ANIM_MS = 150;

const AGE_FADE_ROWS = 14; // rows over which a fresh stitch recedes to the muted baseline
const MUTED_BASE_ALPHA = 0.55;
const FRESH_MAX_ALPHA = 0.75; // "moderate", never full-strength per spec

// reduced-motion freeze: a static ladder frozen mid-run, not derived from RNG
const STATIC_CURRENT_COURSE = 16;
const STATIC_DROP_ROW = 11;
const STATIC_LADDER_LEN = 3; // "2-3 rows open"

function easeOutCubic(x: number): number {
  const t = 1 - x;
  return 1 - t * t * t;
}

interface LadderState {
  active: boolean;
  column: number;
  dropRow: number;
  length: number;
  openStart: number; // elapsedMs
  repairStart: number; // elapsedMs, derived at trigger time
  nextTriggerAt: number; // elapsedMs
}

export interface KnitLadderRunProps {
  className?: string;
}

export function KnitLadderRun({ className = "" }: KnitLadderRunProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let fg = "currentColor";
    let muted = "currentColor";
    let width = 0;
    let height = 0;
    let dpr = 1;
    let sized = false;
    let visible = true;

    let pitch = PITCH_TARGET;
    let cols = MIN_COLS;

    const ladder: LadderState = {
      active: false,
      column: 0,
      dropRow: 0,
      length: 0,
      openStart: 0,
      repairStart: 0,
      nextTriggerAt: LADDER_MIN_INTERVAL_MS + Math.random() * (LADDER_MAX_INTERVAL_MS - LADDER_MIN_INTERVAL_MS),
    };

    const readTokens = () => {
      const s = getComputedStyle(document.documentElement);
      fg = s.getPropertyValue("--foreground").trim() || "currentColor";
      muted = s.getPropertyValue("--ns-muted").trim() || fg;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      if (width < 2 || height < 2) {
        sized = false;
        return;
      }
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      cols = Math.min(MAX_COLS, Math.max(MIN_COLS, Math.round(width / PITCH_TARGET)));
      pitch = width / cols;
      sized = true;
    };

    // small interlocked loop glyph — two overlapping arcs, the "stitch" unit
    const drawStitchGlyph = (cx: number, cy: number, color: string, alpha: number) => {
      if (alpha <= 0.01) return;
      const r = pitch * 0.28;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.32, r, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.32, r, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    const drawNormalStitch = (cx: number, cy: number, age: number, alphaMul: number = 1) => {
      if (alphaMul <= 0.01) return;
      const fresh = Math.min(1, Math.max(0, 1 - age / AGE_FADE_ROWS));
      drawStitchGlyph(cx, cy, muted, MUTED_BASE_ALPHA * alphaMul);
      if (fresh > 0.01) drawStitchGlyph(cx, cy, fg, fresh * FRESH_MAX_ALPHA * alphaMul);
    };

    // a bare vertical rail marking an open rung, plus an optional latch-hook
    // glyph while that rung is actively closing.
    const drawRail = (cx: number, cy: number, alpha: number) => {
      if (alpha <= 0.01) return;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = fg;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy - pitch / 2);
      ctx.lineTo(cx, cy + pitch / 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    const drawHookGlyph = (cx: number, cy: number, alpha: number) => {
      if (alpha <= 0.01) return;
      const s = pitch * 0.24;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = fg;
      ctx.lineWidth = 1.2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx, cy + s);
      ctx.lineTo(cx, cy - s * 0.2);
      ctx.arc(cx - s * 0.35, cy - s * 0.2, s * 0.35, 0, Math.PI * 1.4);
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    // renders one cell that belongs to the currently active ladder column,
    // returning true if it drew a ladder-specific state (caller skips the
    // normal stitch render in that case).
    const drawLadderCell = (rowIndex: number, cx: number, cy: number, elapsedMs: number, age: number): boolean => {
      if (!ladder.active) return false;
      const rowOffset = rowIndex - ladder.dropRow;
      if (rowOffset < 0 || rowOffset >= ladder.length) return false;

      const openAt = ladder.openStart + rowOffset * OPEN_STEP_MS;
      // rungs close bottom-up: the newest (highest offset) rung closes first
      const closeAt = ladder.repairStart + (ladder.length - 1 - rowOffset) * CLOSE_STEP_MS;

      if (elapsedMs < openAt) {
        drawNormalStitch(cx, cy, age);
        return true;
      }
      if (elapsedMs < openAt + OPEN_ANIM_MS) {
        // the loop glyph visibly collapses to a bare gap: fade the stitch
        // out while the rail fades in over the same 120ms window
        const eased = easeOutCubic((elapsedMs - openAt) / OPEN_ANIM_MS);
        drawNormalStitch(cx, cy, age, 1 - eased);
        drawRail(cx, cy, eased);
        return true;
      }
      if (elapsedMs < closeAt) {
        drawRail(cx, cy, 1);
        return true;
      }
      if (elapsedMs < closeAt + CLOSE_ANIM_MS) {
        // the latch-hook reseals the rung: stitch fades back in as the rail
        // fades out, with the hook glyph visible for the transition
        const p = (elapsedMs - closeAt) / CLOSE_ANIM_MS;
        const eased = easeOutCubic(p);
        drawRail(cx, cy, 1 - eased);
        drawNormalStitch(cx, cy, age, eased);
        drawHookGlyph(cx, cy, 1 - p);
        return true;
      }
      // fully repaired — render as a normal stitch and let this row age out
      // of ladder tracking on the next active-ladder check naturally
      return false;
    };

    const maybeAdvanceLadder = (elapsedMs: number, currentCourse: number) => {
      if (ladder.active) {
        const lastCloseAt = ladder.repairStart + (ladder.length - 1) * CLOSE_STEP_MS + CLOSE_ANIM_MS;
        if (elapsedMs >= lastCloseAt) {
          ladder.active = false;
          ladder.nextTriggerAt =
            elapsedMs + LADDER_MIN_INTERVAL_MS + Math.random() * (LADDER_MAX_INTERVAL_MS - LADDER_MIN_INTERVAL_MS);
        }
        return;
      }
      if (elapsedMs < ladder.nextTriggerAt) return;
      const length = LADDER_MIN_LEN + Math.floor(Math.random() * (LADDER_MAX_LEN - LADDER_MIN_LEN + 1));
      if (currentCourse - length < 0) return; // not enough built history yet, wait
      ladder.active = true;
      ladder.column = Math.floor(Math.random() * cols);
      ladder.length = length;
      ladder.dropRow = currentCourse - length;
      ladder.openStart = elapsedMs;
      ladder.repairStart = elapsedMs + length * OPEN_STEP_MS;
    };

    const drawField = (elapsedMs: number, staticLadder: { column: number; dropRow: number; length: number } | null) => {
      if (!sized) return;
      ctx.clearRect(0, 0, width, height);

      const continuousCourse = elapsedMs / COURSE_MS;
      const currentCourse = Math.floor(continuousCourse);
      const buildEdgeY = height - pitch / 2;

      const minRow = Math.floor(continuousCourse - height / pitch) - 1;

      for (let rowIndex = Math.max(0, minRow); rowIndex <= currentCourse; rowIndex++) {
        const cy = buildEdgeY - (continuousCourse - rowIndex) * pitch;
        if (cy < -pitch || cy > height + pitch) continue;
        const age = currentCourse - rowIndex;

        for (let col = 0; col < cols; col++) {
          const cx = col * pitch + pitch / 2;

          if (staticLadder) {
            const rowOffset = rowIndex - staticLadder.dropRow;
            if (col === staticLadder.column && rowOffset >= 0 && rowOffset < staticLadder.length) {
              drawRail(cx, cy, 1);
              continue;
            }
            drawNormalStitch(cx, cy, age);
            continue;
          }

          if (col === ladder.column && drawLadderCell(rowIndex, cx, cy, elapsedMs, age)) continue;
          drawNormalStitch(cx, cy, age);
        }
      }
    };

    let raf = 0;
    let startTime = 0;

    const loop = (now: number) => {
      if (!startTime) startTime = now;
      const elapsedMs = now - startTime;
      const currentCourse = Math.floor(elapsedMs / COURSE_MS);
      maybeAdvanceLadder(elapsedMs, currentCourse);
      drawField(elapsedMs, null);
      if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    };

    const drawReducedStatic = () => {
      const elapsedMs = STATIC_CURRENT_COURSE * COURSE_MS + COURSE_MS * 0.5;
      drawField(elapsedMs, { column: Math.floor(cols / 2), dropRow: STATIC_DROP_ROW, length: STATIC_LADDER_LEN });
    };

    const start = () => {
      if (reduced) {
        drawReducedStatic();
        return;
      }
      startTime = 0;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (reduced) drawReducedStatic();
      }, 120);
    };

    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        if (visible && !reduced) start();
      },
      { threshold: 0 }
    );
    io.observe(canvas);

    const onVis = () => {
      if (!document.hidden && visible && !reduced) start();
    };
    document.addEventListener("visibilitychange", onVis);

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced && sized) drawReducedStatic();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    readTokens();
    resize();
    start();

    return () => {
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className={`block h-full w-full ${className}`} />;
}
