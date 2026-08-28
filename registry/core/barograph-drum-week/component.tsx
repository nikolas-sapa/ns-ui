"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// BarographDrumWeek — an ambient "running continuously, unattended" status
// widget modelled on the aneroid barograph: a clockwork drum turns once per
// week under a pen arm, wrapped in chart paper that already carries the day
// and hour ruling PRINTED IN ADVANCE — the pen only ever adds ink, it never
// draws the grid. This build compresses the real 7-day/604,800s drum period
// into a 45s loop (documented ratio ~1 app-second : 3.7 real hours).
//
// Two canvases stand in for the two physical layers: a grid canvas holds the
// pre-ruled paper (7 day dividers, full height; 23 hour ticks per day, drawn
// as SHORT marks at the top/bottom edges only so 168 ticks read as a faint
// structural ruling rather than a solid mesh) and is only ever redrawn on
// resize/token change, never per-frame. An ink canvas accumulates the trace
// by drawing ONE new line segment per frame from the previous point to the
// current one — it is never cleared mid-cycle, matching the "permanent
// trace" identity of the recording-instrument family, and every point is
// also kept in a small history array so a resize (which invalidates a
// canvas's raster) can losslessly replot the whole trace at the new pixel
// size instead of losing it.
//
// The trace itself is two incommensurate sine terms — a slow "weather
// front" swing (randomized 8-14s period per cycle, amplitude +/-30% of
// chart height) plus a faster secondary term for texture — with a bounded
// per-frame random-walk micro-jitter (+/-0.3px) layered on top for capsule-
// response noise. The pen arm is a real DOM element (never canvas) pivoting
// from its own tip, positioned by trigonometry from the SAME xFrac/yFrac
// value that was just pushed into the ink history, so the two can never
// desync. At the 45s mark the ink layer (canvas + pen) crossfades to
// transparent over 500ms, the point history clears, a fresh randomized
// front is drawn, and the cycle resumes at the empty day-0 state — a fade,
// never a hard cut.
// ---------------------------------------------------------------------------

const DAYS = 7;
const HOURS_PER_DAY = 24;
const LOOP_MS = 45_000; // compressed 7-day drum period
const CROSSFADE_MS = 500; // loop-end fade back to day 0
const TICK_LEN_FRAC = 0.09; // hour-tick length as a fraction of chart height
const AMPLITUDE_FRAC = 0.3; // weather-front swing, +/-30% of chart height
const FRONT_PERIOD_MIN = 8; // seconds — randomized primary front period
const FRONT_PERIOD_MAX = 14;
const JITTER_STEP = 0.6; // px — per-frame random-walk increment
const JITTER_MAX = 0.3; // px — capsule micro-jitter clamp
const STATIC_DAY = 4; // reduced-motion freeze: day 4 of 7 (~57% across)

interface Front {
  t1: number;
  p1: number;
  t2: number;
  p2: number;
}

interface Point {
  /** 0..1 across the full 7-day chart width */
  x: number;
  /** 0..1 down the chart height */
  y: number;
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

function makeFront(rand: () => number): Front {
  const t1 = FRONT_PERIOD_MIN + rand() * (FRONT_PERIOD_MAX - FRONT_PERIOD_MIN);
  const p1 = rand() * Math.PI * 2;
  const t2 = t1 * (0.32 + rand() * 0.14); // unrelated secondary period, for texture
  const p2 = rand() * Math.PI * 2;
  return { t1, p1, t2, p2 };
}

function frontValue(tSec: number, f: Front): number {
  const v =
    0.66 * Math.sin((2 * Math.PI * tSec) / f.t1 + f.p1) +
    0.34 * Math.sin((2 * Math.PI * tSec) / f.t2 + f.p2);
  return Math.max(-1, Math.min(1, v));
}

interface Tokens {
  fg: string;
  border: string;
  muted: string;
}

function readTokens(): Tokens | null {
  if (typeof document === "undefined") return null;
  const cs = getComputedStyle(document.documentElement);
  const fg = cs.getPropertyValue("--foreground").trim();
  const border = cs.getPropertyValue("--border").trim();
  const muted = cs.getPropertyValue("--ns-muted").trim();
  if (!fg || !border || !muted) return null; // not loaded yet — no paint before this
  return { fg, border, muted };
}

export interface BarographDrumWeekProps {
  /** small mono label above the chart, e.g. the metric this trace tracks */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function BarographDrumWeek({
  label = "STATION UPTIME — 7 DAY TRACE",
  className = "",
}: BarographDrumWeekProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);
  const inkWrapRef = useRef<HTMLDivElement>(null);
  const inkCanvasRef = useRef<HTMLCanvasElement>(null);
  const penRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const chartWrap = chartWrapRef.current;
    const gridCanvas = gridCanvasRef.current;
    const inkWrap = inkWrapRef.current;
    const inkCanvas = inkCanvasRef.current;
    const pen = penRef.current;
    if (!chartWrap || !gridCanvas || !inkWrap || !inkCanvas || !pen) return;
    const gctx = gridCanvas.getContext("2d");
    const ictx = inkCanvas.getContext("2d");
    if (!gctx || !ictx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let disposed = false;
    let tokens: Tokens | null = null;
    let dpr = 1;
    let chartW = 0;
    let chartH = 0;
    let sized = false;
    let visible = true;

    const points: Point[] = [];
    let cycleStart = 0;
    let phase: "run" | "fade" = "run";
    let fadeStart = 0;
    let front = makeFront(Math.random);
    let jitterPx = 0;

    let raf = 0;
    let tokenWaitRaf = 0;

    const fitCanvas = (canvas: HTMLCanvasElement) => {
      canvas.width = Math.max(1, Math.round(chartW * dpr));
      canvas.height = Math.max(1, Math.round(chartH * dpr));
      const ctx = canvas.getContext("2d");
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawGrid = () => {
      if (!tokens || !sized) return;
      gctx.clearRect(0, 0, chartW, chartH);

      // day dividers: only 7 lines, so a low-alpha --ns-muted stroke still
      // reads as a sparse ruling rather than a fill — --border alone is
      // near-invisible against the light-theme background (~1.1:1) and
      // these 7 lines are what carries the spec's 6.4s legibility beat, so
      // they get just enough weight to stay countable at a glance.
      gctx.strokeStyle = tokens.muted;
      gctx.globalAlpha = 0.32;
      gctx.lineWidth = 1;
      gctx.beginPath();
      for (let d = 0; d <= DAYS; d++) {
        const x = Math.round((d / DAYS) * chartW) + 0.5;
        gctx.moveTo(x, 0);
        gctx.lineTo(x, chartH);
      }
      gctx.stroke();
      gctx.globalAlpha = 1;

      // hour ticks: plain --border at its designed near-invisible role,
      // and short marks at the top/bottom edges only, never a full-height
      // line — this is what keeps 7x24 = 168 ticks a faint ruling instead
      // of a visible mesh.
      gctx.strokeStyle = tokens.border;
      const tickLen = chartH * TICK_LEN_FRAC;
      gctx.beginPath();
      for (let d = 0; d < DAYS; d++) {
        for (let h = 1; h < HOURS_PER_DAY; h++) {
          const x = Math.round(((d + h / HOURS_PER_DAY) / DAYS) * chartW) + 0.5;
          gctx.moveTo(x, 0);
          gctx.lineTo(x, tickLen);
          gctx.moveTo(x, chartH - tickLen);
          gctx.lineTo(x, chartH);
        }
      }
      gctx.stroke();
    };

    const redrawInk = () => {
      if (!tokens || !sized) return;
      ictx.clearRect(0, 0, chartW, chartH);
      if (points.length === 0) return;
      ictx.strokeStyle = tokens.fg;
      ictx.lineWidth = Math.max(1, Math.min(chartW, chartH) * 0.006);
      ictx.lineJoin = "round";
      ictx.lineCap = "round";
      if (points.length === 1) {
        const p = points[0]!;
        ictx.beginPath();
        ictx.arc(p.x * chartW, p.y * chartH, ictx.lineWidth / 2, 0, Math.PI * 2);
        ictx.fillStyle = tokens.fg;
        ictx.fill();
        return;
      }
      ictx.beginPath();
      points.forEach((p, i) => {
        const x = p.x * chartW;
        const y = p.y * chartH;
        if (i === 0) ictx.moveTo(x, y);
        else ictx.lineTo(x, y);
      });
      ictx.stroke();
    };

    // -- pen arm: a real DOM element, pivoting from its own tip, positioned
    // from the exact same (xFrac, yFrac) that was just pushed into the ink
    // history — the single source of truth shared with the canvas draw, so
    // the two can never drift apart. ---------------------------------------
    const positionPen = (xFrac: number, yFrac: number, angleRad: number) => {
      const x = xFrac * chartW;
      const y = yFrac * chartH;
      const armLen = Math.max(10, Math.min(chartW, chartH) * 0.16);
      pen.style.width = `${armLen}px`;
      pen.style.transform = `translate(${(x - armLen).toFixed(2)}px, ${(y - 1).toFixed(2)}px) rotate(${angleRad.toFixed(3)}rad)`;
    };

    const angleBetween = (a: Point, b: Point): number => {
      const dx = (b.x - a.x) * chartW;
      const dy = (b.y - a.y) * chartH;
      if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) return 0;
      return Math.max(-0.6, Math.min(0.6, Math.atan2(dy, dx || 0.0001)));
    };

    const drawFrameSegment = (prev: Point | undefined, next: Point) => {
      if (!tokens || !sized) return;
      ictx.strokeStyle = tokens.fg;
      ictx.lineWidth = Math.max(1, Math.min(chartW, chartH) * 0.006);
      ictx.lineCap = "round";
      if (prev) {
        ictx.beginPath();
        ictx.moveTo(prev.x * chartW, prev.y * chartH);
        ictx.lineTo(next.x * chartW, next.y * chartH);
        ictx.stroke();
      } else {
        ictx.beginPath();
        ictx.arc(next.x * chartW, next.y * chartH, ictx.lineWidth / 2, 0, Math.PI * 2);
        ictx.fillStyle = tokens.fg;
        ictx.fill();
      }
    };

    const stepFrame = (elapsedMs: number) => {
      const xFrac = Math.min(1, elapsedMs / LOOP_MS);
      const tSec = elapsedMs / 1000;
      const val = frontValue(tSec, front);
      jitterPx += (Math.random() - 0.5) * JITTER_STEP;
      jitterPx = Math.max(-JITTER_MAX, Math.min(JITTER_MAX, jitterPx));
      const jitterFrac = chartH > 0 ? jitterPx / chartH : 0;
      const yFrac = Math.min(1, Math.max(0, 0.5 - AMPLITUDE_FRAC * val + jitterFrac));
      const prev = points[points.length - 1];
      const next: Point = { x: xFrac, y: yFrac };
      points.push(next);
      drawFrameSegment(prev, next);
      positionPen(xFrac, yFrac, prev ? angleBetween(prev, next) : 0);
    };

    const resizeAll = () => {
      if (!tokens) return;
      const rect = chartWrap.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) {
        sized = false;
        return;
      }
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      chartW = rect.width;
      chartH = rect.height;
      fitCanvas(gridCanvas);
      fitCanvas(inkCanvas);
      sized = true;
      drawGrid();
      redrawInk();
      const last = points[points.length - 1];
      if (last) {
        const prev = points[points.length - 2] ?? last;
        positionPen(last.x, last.y, angleBetween(prev, last));
      } else {
        positionPen(0, 0.5, 0);
      }
    };

    const buildStaticFrame = () => {
      // fully deterministic — reduced motion must render the same frozen
      // day-4 frame every time, never a random draw.
      const rand = mulberry32(0xba206);
      const staticFront = makeFront(rand);
      const xFracEnd = STATIC_DAY / DAYS;
      const samples = 220;
      for (let i = 0; i <= samples; i++) {
        const xFrac = (i / samples) * xFracEnd;
        const tSec = xFrac * (LOOP_MS / 1000);
        const val = frontValue(tSec, staticFront);
        const yFrac = Math.min(1, Math.max(0, 0.5 - AMPLITUDE_FRAC * val));
        points.push({ x: xFrac, y: yFrac });
      }
    };

    const loop = (now: number) => {
      if (disposed) return;
      if (!visible) {
        raf = 0; // IntersectionObserver re-arms this on re-entering view
        return;
      }
      raf = requestAnimationFrame(loop);
      if (!sized || !tokens) return;
      if (cycleStart === 0) cycleStart = now;
      if (phase === "run") {
        const elapsed = now - cycleStart;
        if (elapsed >= LOOP_MS) {
          phase = "fade";
          fadeStart = now;
          inkWrap.style.transition = `opacity ${CROSSFADE_MS}ms ease`;
          inkWrap.style.opacity = "0";
        } else {
          stepFrame(elapsed);
        }
      } else {
        if (now - fadeStart >= CROSSFADE_MS) {
          points.length = 0;
          ictx.clearRect(0, 0, chartW, chartH);
          front = makeFront(Math.random);
          jitterPx = 0;
          cycleStart = now;
          phase = "run";
          inkWrap.style.transition = "none";
          inkWrap.style.opacity = "1";
          void inkWrap.offsetHeight; // flush before the next transition arms
          positionPen(0, 0.5, 0);
        }
      }
    };

    // -- kickoff, retried from every path that can newly satisfy its
    // preconditions (mount, ResizeObserver, MutationObserver) rather than
    // attempted once at mount and abandoned — a container that is 0px wide
    // on first layout (lazy-mounted preview frame, display:none ancestor,
    // collapsed panel) must still start the moment it gets real size. -----
    let started = false;
    const kick = () => {
      if (started || disposed || !tokens || !sized) return;
      started = true;
      if (reduced) {
        buildStaticFrame();
        drawGrid();
        redrawInk();
        const last = points[points.length - 1];
        const prev = points[points.length - 2] ?? last;
        if (last && prev) positionPen(last.x, last.y, angleBetween(prev, last));
        return; // no rAF loop, no timers, no observers driving motion
      }
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (disposed) return;
      tokens = readTokens();
      if (!tokens) {
        tokenWaitRaf = requestAnimationFrame(start);
        return;
      }
      resizeAll();
      kick();
    };

    const ro = new ResizeObserver(() => {
      if (!tokens) return;
      resizeAll();
      kick();
    });
    ro.observe(chartWrap);

    const mo = new MutationObserver(() => {
      tokens = readTokens();
      if (tokens) {
        resizeAll();
        kick();
      }
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const io = new IntersectionObserver((entries) => {
      const wasVisible = visible;
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !wasVisible && !reduced && tokens && !raf) {
        tokens = readTokens() ?? tokens; // pick up any theme flip that happened while hidden
        resizeAll();
        // restart the cycle rather than resuming mid-flight — an arbitrarily
        // long time off-screen must not fade out a nearly-empty chart on
        // the very next frame back.
        points.length = 0;
        ictx.clearRect(0, 0, chartW, chartH);
        front = makeFront(Math.random);
        jitterPx = 0;
        cycleStart = 0;
        phase = "run";
        inkWrap.style.transition = "none";
        inkWrap.style.opacity = "1";
        positionPen(0, 0.5, 0);
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(chartWrap);

    start();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(tokenWaitRaf);
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`relative w-full max-w-sm overflow-hidden rounded-md border border-border bg-surface p-4 ${className}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="truncate font-mono text-[11px] tracking-widest text-ns-muted">{label}</p>
        <p className="shrink-0 font-mono text-[10px] tracking-widest text-ns-muted">7-DAY</p>
      </div>
      <div ref={chartWrapRef} className="relative w-full" style={{ aspectRatio: "2.2 / 1" }}>
        <canvas
          ref={gridCanvasRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
        <div ref={inkWrapRef} className="absolute inset-0" style={{ opacity: 1 }}>
          <canvas
            ref={inkCanvasRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full"
          />
          <div
            ref={penRef}
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 h-[2px] origin-right bg-foreground"
          />
        </div>
      </div>
    </div>
  );
}
