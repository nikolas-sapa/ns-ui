"use client";

import { useEffect, useId, useRef } from "react";

// ---------------------------------------------------------------------------
// HelicorderLineWrap — a seismograph helicorder drum record: a pen traces one
// horizontal line at a time; when it runs off the right margin it steps down
// to the row below and starts again at the left, so the record grows as a
// stack of offset lines, oldest at top, rather than one continuous scroll.
//
// 8 fixed row slots, each its own <canvas> (a completed row is a static
// bitmap — it is never redrawn once finished, only the live row is painted
// incrementally). Once all 8 fill, a further wrap SHIFTS the whole stack up
// by one row (canvas-to-canvas drawImage copies, oldest row's content
// discarded) rather than looping/fading the whole card, so motion in the
// tower stays continuous forever instead of resetting.
//
// The wrap itself — the ONE followable event per the round-9 legibility rule
// — is never a teleport: the pen head fades out at the right margin over
// 80ms, the stack shifts (or steps down) while it is invisible, and a fresh
// pen head fades in at the left margin of the next row over 120ms. Idle
// drawing pauses for that 200ms window so nothing competes with the step.
// ---------------------------------------------------------------------------

export interface HelicorderLineWrapProps {
  /** Seconds of app time per traced row. @default 12 */
  lineSeconds?: number;
  /** Number of stacked rows in the drum. @default 8 */
  rows?: number;
  /** Average seconds between quake spikes (randomized +-40%). @default 28 */
  quakeIntervalSeconds?: number;
  /** Freezes on the composed still frame without unmounting. */
  paused?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

type Phase = "drawing" | "fadeOut" | "fadeIn";

const MARGIN_PX = 2; // px kept clear at each row's edges so the trace never touches the border
const WRAP_FADE_OUT_MS = 80;
const WRAP_FADE_IN_MS = 120;
const IDLE_AMP_PX = 2; // baseline microseism, +-2px
const QUAKE_AMP_MIN = 15;
const QUAKE_AMP_MAX = 20;
const QUAKE_RISE_MS = 200;
const QUAKE_DECAY_MS = 2500;

// The reduced-motion / paused still: 4 of 8 rows completed, the 5th traced
// 60% across, one quake bump baked into an earlier completed row — a clearly
// mid-instrument, structured frame.
const STATIC_ROW = 4;
const STATIC_PROGRESS = 0.6;

// Smooth, seeded pseudo-noise (sum of two incommensurate sines) so both the
// live trace and the deterministic static frame can evaluate "the same kind
// of wiggle" at any x without needing stored random samples.
function microseism(x: number): number {
  return IDLE_AMP_PX * (0.6 * Math.sin(x * 0.041 + 1.7) + 0.4 * Math.sin(x * 0.095 + 0.3));
}

function quakeEnvelope(elapsedMs: number): number {
  if (elapsedMs < 0) return 0;
  if (elapsedMs < QUAKE_RISE_MS) return elapsedMs / QUAKE_RISE_MS;
  const t = elapsedMs - QUAKE_RISE_MS;
  return Math.exp(-t / (QUAKE_DECAY_MS / 3));
}

export function HelicorderLineWrap({
  lineSeconds = 12,
  rows = 8,
  quakeIntervalSeconds = 28,
  paused = false,
  className = "",
  style,
}: HelicorderLineWrapProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const headRef = useRef<HTMLDivElement | null>(null);
  const uid = useId();
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const canvases = rowRefs.current.slice(0, rows);
    if (canvases.some((c) => !c)) return;
    const head = headRef.current;

    let disposed = false;
    let raf = 0;
    let running = false;
    let staticMode = false;

    let rowW = 0;
    let rowH = 0;
    let dpr = 1;

    let fg = "#171717";
    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      fg = cs.getPropertyValue("--foreground").trim() || "#171717";
    };
    readColors();

    // ---- per-row backing store ---------------------------------------------
    const ctxs: (CanvasRenderingContext2D | null)[] = canvases.map((c) =>
      c!.getContext("2d", { alpha: true })
    );

    const sizeCanvas = (c: HTMLCanvasElement, ctx: CanvasRenderingContext2D | null) => {
      const pw = Math.max(2, Math.round(rowW * dpr));
      const ph = Math.max(2, Math.round(rowH * dpr));
      if (c.width !== pw || c.height !== ph) {
        c.width = pw;
        c.height = ph;
      }
      c.style.width = `${rowW}px`;
      c.style.height = `${rowH}px`;
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };

    // ---- live-row state ------------------------------------------------------
    let liveRow = 0; // index into canvases, current bottom of the growing tower
    let stackFull = false;
    let x = 0; // css px across the live row, 0..rowW
    let lastX = 0;
    let lastY = 0;
    let lineMs = lineSeconds * 1000;
    let speedPxPerMs = 0;

    let simMs = 0;
    let nextQuakeAtMs = quakeIntervalSeconds * 1000 * (0.6 + Math.random() * 0.8);
    let quakeStartMs = -1e9;
    let quakeAmp = 0;
    let quakeSign = 1;

    let phase: Phase = "drawing";
    let phaseStartMs = 0;

    const resetRow = () => {
      x = MARGIN_PX;
      lastX = MARGIN_PX;
      lastY = rowH / 2;
    };

    const clearRowCanvas = (i: number) => {
      const c = canvases[i]!;
      const ctx = ctxs[i]!;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const shiftStackUp = () => {
      // canvas-to-canvas copy: row i takes row i+1's finished bitmap, row
      // `rows-1` (the one about to become live again) is cleared. This is
      // what makes the oldest trace scroll off the top instead of the whole
      // card looping and restarting.
      for (let i = 0; i < rows - 1; i++) {
        const dst = canvases[i]!;
        const dctx = ctxs[i]!;
        const src = canvases[i + 1]!;
        dctx.setTransform(1, 0, 0, 1, 0, 0);
        dctx.clearRect(0, 0, dst.width, dst.height);
        dctx.drawImage(src, 0, 0);
        dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      clearRowCanvas(rows - 1);
    };

    const drawSegment = (row: number, x0: number, y0: number, x1: number, y1: number) => {
      const ctx = ctxs[row];
      if (!ctx) return;
      ctx.strokeStyle = fg;
      ctx.lineWidth = 1.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    };

    const traceY = (progressX: number, nowMs: number) => {
      let y = rowH / 2 + microseism(progressX);
      const env = quakeEnvelope(nowMs - quakeStartMs);
      if (env > 0.001) y += quakeSign * quakeAmp * env;
      return y;
    };

    const placeHead = (rowIndex: number, px: number, py: number, opacity: number) => {
      if (!head) return;
      head.style.transform = `translate(${px - 2}px, ${rowIndex * rowH + py - 2}px)`;
      head.style.opacity = String(opacity);
    };

    // ---- deterministic static frame -----------------------------------------
    const drawStaticFrame = () => {
      for (let i = 0; i < rows; i++) clearRowCanvas(i);
      if (head) head.style.opacity = "0";
      for (let r = 0; r < rows; r++) {
        if (r > STATIC_ROW) continue;
        const fullWidth = r < STATIC_ROW;
        const targetX = fullWidth ? rowW - MARGIN_PX : MARGIN_PX + (rowW - 2 * MARGIN_PX) * STATIC_PROGRESS;
        let px = MARGIN_PX;
        let py = rowH / 2;
        const step = 3;
        for (let sx = MARGIN_PX + step; sx <= targetX; sx += step) {
          let sy = rowH / 2 + microseism(sx);
          // bake one quake bump into row 1, mid-height, so the still isn't a
          // flat instrument with nothing having ever happened
          if (r === 1) {
            const bumpCenter = rowW * 0.55;
            const bumpEnv = quakeEnvelope(QUAKE_RISE_MS + (sx - bumpCenter) * 22);
            if (sx >= bumpCenter) sy += 18 * bumpEnv;
          }
          drawSegment(r, px, py, sx, sy);
          px = sx;
          py = sy;
        }
      }
    };

    // ---- main loop ------------------------------------------------------------
    let lastMs = performance.now();

    const stepDrawing = (dt: number, nowMs: number) => {
      if (nextQuakeAtMs <= simMs) {
        quakeStartMs = simMs;
        quakeAmp = QUAKE_AMP_MIN + Math.random() * (QUAKE_AMP_MAX - QUAKE_AMP_MIN);
        quakeSign = Math.random() < 0.5 ? -1 : 1;
        nextQuakeAtMs = simMs + quakeIntervalSeconds * 1000 * (0.64 + Math.random() * 1.43);
      }

      x += speedPxPerMs * dt;
      const clampedX = Math.min(x, rowW - MARGIN_PX);
      const y = traceY(clampedX, simMs);
      drawSegment(liveRow, lastX, lastY, clampedX, y);
      lastX = clampedX;
      lastY = y;
      placeHead(liveRow, clampedX, y, 1);

      if (x >= rowW - MARGIN_PX) {
        phase = "fadeOut";
        phaseStartMs = nowMs;
      }
    };

    const stepWrap = (nowMs: number) => {
      const elapsed = nowMs - phaseStartMs;
      if (phase === "fadeOut") {
        const t = Math.min(1, elapsed / WRAP_FADE_OUT_MS);
        placeHead(liveRow, lastX, lastY, 1 - t);
        if (t >= 1) {
          // the step itself happens while the head is invisible
          if (stackFull) {
            shiftStackUp();
            liveRow = rows - 1;
          } else if (liveRow < rows - 1) {
            liveRow += 1;
            if (liveRow === rows - 1) stackFull = true;
          } else {
            stackFull = true;
            shiftStackUp();
          }
          resetRow();
          phase = "fadeIn";
          phaseStartMs = nowMs;
          placeHead(liveRow, lastX, lastY, 0);
        }
      } else if (phase === "fadeIn") {
        const t = Math.min(1, elapsed / WRAP_FADE_IN_MS);
        placeHead(liveRow, lastX, lastY, t);
        if (t >= 1) phase = "drawing";
      }
    };

    const loop = (nowMs: number) => {
      const rawMs = Math.min(50, nowMs - lastMs);
      lastMs = nowMs;
      simMs += rawMs;
      if (phase === "drawing") stepDrawing(rawMs, nowMs);
      else stepWrap(nowMs);
      raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (running || disposed) return;
      running = true;
      lastMs = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const sleep = () => {
      cancelAnimationFrame(raf);
      running = false;
    };

    const resetAll = () => {
      for (let i = 0; i < rows; i++) clearRowCanvas(i);
      liveRow = 0;
      stackFull = false;
      resetRow();
      phase = "drawing";
      if (head) head.style.opacity = "0";
    };

    const applySize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const changed = Math.abs(rect.width - rowW) > 0.5 || Math.abs(rect.height / rows - rowH) > 0.5;
      rowW = rect.width;
      rowH = rect.height / rows;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      lineMs = Math.max(1000, lineSeconds * 1000);
      speedPxPerMs = rowW / lineMs;
      for (let i = 0; i < rows; i++) sizeCanvas(canvases[i]!, ctxs[i]);
      if (changed) {
        if (staticMode) drawStaticFrame();
        else resetAll();
      }
    };

    const ro = new ResizeObserver(applySize);
    ro.observe(wrap);
    applySize();

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;
    const applyMode = () => {
      if (reduced || pausedRef.current) {
        staticMode = true;
        sleep();
        drawStaticFrame();
      } else {
        if (staticMode) resetAll();
        staticMode = false;
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
    io.observe(wrap);

    const onVis = () => {
      if (document.hidden) sleep();
      else if (!staticMode && onScreen) wake();
    };
    document.addEventListener("visibilitychange", onVis);
    applyMode();

    let lastPolledPaused = pausedRef.current;
    let poll = 0;
    const tick = () => {
      if (pausedRef.current !== lastPolledPaused) {
        lastPolledPaused = pausedRef.current;
        applyMode();
      }
      poll = window.setTimeout(tick, 140);
    };
    tick();

    const themeObserver = new MutationObserver(() => {
      readColors();
      if (staticMode) drawStaticFrame();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      disposed = true;
      ro.disconnect();
      io.disconnect();
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
      themeObserver.disconnect();
      window.clearTimeout(poll);
      sleep();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineSeconds, rows, quakeIntervalSeconds]);

  return (
    <div
      ref={wrapRef}
      data-helicorder-line-wrap={uid}
      role="img"
      aria-label="Seismic activity monitor, live helicorder trace"
      className={`relative flex h-full w-full flex-col overflow-hidden bg-background ${className}`}
      style={style}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`relative flex-1 ${i > 0 ? "border-t border-border" : ""}`}>
          <canvas
            ref={(el) => {
              rowRefs.current[i] = el;
            }}
            aria-hidden="true"
            className="absolute inset-0 block h-full w-full"
          />
        </div>
      ))}
      {/* the pen head: a single overlay dot, its position and opacity
          written directly every frame (never React state) so the 80ms/120ms
          wrap fade reads as one continuous instrument, not a re-render */}
      <div
        ref={headRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 h-1 w-1 rounded-full bg-foreground opacity-0"
      />
    </div>
  );
}

HelicorderLineWrap.displayName = "HelicorderLineWrap";
