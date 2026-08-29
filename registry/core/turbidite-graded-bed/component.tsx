"use client";

import { useEffect, useId, useRef } from "react";

// ---------------------------------------------------------------------------
// TurbiditeGradedBed — a submarine-fan stratigraphic column: an ambient
// "history is accumulating" strip where each discrete flow-pulse event
// deposits ONE new graded bed at the top, coarse grains settling first at
// its sharp base and progressively finer grains capping it as the current
// loses competence (a real Bouma-sequence fining-upward signature). The
// stack keeps growing pulse by pulse, oldest beds compressing slightly under
// the newer overburden and eventually scrolling off the bottom.
//
// Every layer's internal grain-size gradient is a fixed set of dot
// descriptors (position/radius-factor/alpha-factor, colour-free) computed
// ONCE at deposit time and cached; painting that dot set into pixels happens
// once per theme read, never per frame — the per-frame cost is just a
// handful of drawImage calls compositing already-rendered layer bitmaps
// into the visible strip. The one animated thing each pulse is the reveal:
// the coarse base appears first, then a fining sweep uncovers the rest of
// the layer moving upward — the followable event, ~530ms once every ~3.2s
// on average, slow enough to watch form.
//
// Basal scour: the instant a new pulse starts, the layer it is about to
// bury gets an irregular scalloped notch eaten into its cap over 80ms (an
// overpaint in --background tracing a jittered curve, never a straight
// line) with a thin --border stroke tracing the resulting erosive contact —
// the real signature that separates one event's bed from the next, distinct
// from a flat stacking seam.
// ---------------------------------------------------------------------------

export interface TurbiditeGradedBedProps {
  /** average seconds between flow-pulse events (irregular, 1.8-5.5s bounds). @default 3.2 */
  pulseIntervalSeconds?: number;
  /** freezes on the reduced-motion still without unmounting */
  paused?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

interface Dot {
  x: number; // local px, 0..layerWidth
  y: number; // local px, 0 = layer's fine cap, baseHeight = layer's coarse base
  rf: number; // radius factor 0..1 (already includes per-dot jitter)
  af: number; // alpha factor 0..1 (already includes per-dot jitter)
}

interface Layer {
  baseHeight: number; // deposited height, px, never mutated
  height: number; // current rendered height after compaction
  compression: number; // 0..COMPRESSION_CAP
  yTop: number; // current top offset in strip-space, recomputed every pulse
  dots: Dot[];
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texW: number; // css px width the canvas was baked at
  depositStart: number; // ms, performance.now() at deposit start; -1 once settled
  scourPoints: number[] | null; // depth px per sample, set once this layer is buried
  scourStart: number; // ms; -1 until scour begins
  scourSettled: boolean;
}

const MIN_INTERVAL_MS = 1800;
const MAX_INTERVAL_MS = 5500;
const MEAN_INTERVAL_MS = 3200;

const SCOUR_MS = 80;
const DEPOSIT_BASE_MS = 120; // coarse base appears
const DEPOSIT_FINE_MS = 330; // fining sweep upward through the rest
const DEPOSIT_TOTAL_MS = DEPOSIT_BASE_MS + DEPOSIT_FINE_MS;

const LAYER_MIN_PX = 14;
const LAYER_MAX_PX = 34;

const COMPRESSION_PER_EVENT = 0.003; // 0.3% per subsequent event
const COMPRESSION_CAP = 0.4;
const BOTTOM_ZONE_FRAC = 0.8; // bottom 20% of the visible strip compacts

const DOT_RADIUS_MIN = 0.5;
const DOT_RADIUS_MAX = 2.1;
const DOT_DENSITY_MIN = 3; // dots per ~40px row-width at the fine cap
const DOT_DENSITY_MAX = 11; // dots per ~40px row-width at the coarse base
const DOT_ALPHA_MIN = 0.2; // perceptual floor kept clear of zero for light theme
const DOT_ALPHA_MAX = 0.9;
const ROW_STEP = 1.6;

const CULL_MARGIN_PX = 48;
const REDUCED_MOTION_LAYERS = 6; // enough to fill+overflow a typical card

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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// exponential-ish irregular spacing, clamped to bounds proportional to the
// requested mean (default mean 3.2s -> the documented 1.8-5.5s bounds)
function nextInterval(rand: () => number, meanMs: number): number {
  const raw = -meanMs * Math.log(1 - rand() * 0.98);
  const min = meanMs * (MIN_INTERVAL_MS / MEAN_INTERVAL_MS);
  const max = meanMs * (MAX_INTERVAL_MS / MEAN_INTERVAL_MS);
  return clamp(raw, min, max);
}

// skewed strength scalar: most pulses modest, occasional ones large
function pulseHeight(rand: () => number, scale: number): number {
  const strength = Math.pow(rand(), 3); // concentrated near 0, tail toward 1
  return (LAYER_MIN_PX + (LAYER_MAX_PX - LAYER_MIN_PX) * strength) * scale;
}

function buildDots(baseHeight: number, texW: number, rand: () => number): Dot[] {
  const dots: Dot[] = [];
  for (let y = 0; y < baseHeight; y += ROW_STEP) {
    const t = baseHeight > 0 ? y / baseHeight : 0; // 0 cap(fine) -> 1 base(coarse)
    const density = DOT_DENSITY_MIN + (DOT_DENSITY_MAX - DOT_DENSITY_MIN) * t;
    const count = Math.max(1, Math.round((density * texW) / 40));
    for (let i = 0; i < count; i++) {
      dots.push({
        x: rand() * texW,
        y: y + (rand() - 0.5) * ROW_STEP,
        rf: t * (0.65 + rand() * 0.45),
        af: t * (0.7 + rand() * 0.3),
      });
    }
  }
  return dots;
}

function paintLayerCanvas(layer: Layer, colors: { fg: string; bg: string }, dpr: number) {
  const c = layer.canvas;
  const w = layer.texW;
  const h = layer.baseHeight;
  const pw = Math.max(1, Math.round(w * dpr));
  const ph = Math.max(1, Math.round(h * dpr));
  if (c.width !== pw || c.height !== ph) {
    c.width = pw;
    c.height = ph;
  }
  const ctx = layer.ctx;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, w, h);
  for (const d of layer.dots) {
    const r = DOT_RADIUS_MIN + (DOT_RADIUS_MAX - DOT_RADIUS_MIN) * d.rf;
    const a = DOT_ALPHA_MIN + (DOT_ALPHA_MAX - DOT_ALPHA_MIN) * d.af;
    ctx.globalAlpha = a;
    ctx.fillStyle = colors.fg;
    ctx.beginPath();
    ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function buildScourPoints(rand: () => number, samples: number): number[] {
  const maxDepth = 2 + rand() * 2; // 2-4px
  const phase = rand() * Math.PI * 2;
  const pts: number[] = [];
  for (let i = 0; i < samples; i++) {
    const u = i / (samples - 1);
    const wobble = 0.5 + 0.5 * Math.sin(u * Math.PI * 3.1 + phase);
    const jitter = (rand() - 0.5) * 0.6;
    pts.push(clamp(maxDepth * (wobble + jitter), 0.4, maxDepth));
  }
  return pts;
}

export function TurbiditeGradedBed({
  pulseIntervalSeconds = 3.2,
  paused = false,
  className = "",
  style,
}: TurbiditeGradedBedProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const uid = useId();
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let disposed = false;
    let raf = 0;
    let running = false;
    let staticMode = false;
    let onScreen = true;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let scale = 1; // derived from the strip's own (smaller) dimension: width

    let layers: Layer[] = [];
    let pulseTimer = 0;
    const rand = mulberry32(0x7b1d3e);
    const meanMs = Math.max(200, pulseIntervalSeconds * 1000);

    let colors = { fg: "#171717", bg: "#ffffff", border: "#e5e5e5" };
    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      colors = {
        fg: cs.getPropertyValue("--foreground").trim() || "#171717",
        bg: cs.getPropertyValue("--background").trim() || "#ffffff",
        border: cs.getPropertyValue("--border").trim() || "#e5e5e5",
      };
    };
    readColors();

    const makeLayer = (heightPx: number): Layer => {
      const c = document.createElement("canvas");
      const lctx = c.getContext("2d")!;
      const layer: Layer = {
        baseHeight: heightPx,
        height: heightPx,
        compression: 0,
        yTop: 0,
        dots: buildDots(heightPx, w, rand),
        canvas: c,
        ctx: lctx,
        texW: w,
        depositStart: -1,
        scourPoints: null,
        scourStart: -1,
        scourSettled: true,
      };
      paintLayerCanvas(layer, colors, dpr);
      return layer;
    };

    // -- one deposit: shift the whole stack down by the new layer's height,
    // start eroding the (now-buried) previous top layer's cap, then start
    // the new layer's own base-then-fining reveal. ------------------------
    const depositPulse = (nowMs: number) => {
      const heightPx = pulseHeight(rand, scale);
      const newLayer = makeLayer(heightPx);
      newLayer.depositStart = nowMs;

      const prevTop = layers[0];
      for (const l of layers) l.yTop += heightPx;
      layers.unshift(newLayer);

      if (prevTop) {
        prevTop.scourPoints = buildScourPoints(rand, 10);
        prevTop.scourStart = nowMs;
        prevTop.scourSettled = false;
      }

      // compaction: any layer whose current span sits in the bottom 20% of
      // the visible strip squeezes a little further under the new overburden
      for (const l of layers) {
        if (l === newLayer) continue;
        if (l.yTop + l.height > BOTTOM_ZONE_FRAC * h) {
          l.compression = Math.min(COMPRESSION_CAP, l.compression + COMPRESSION_PER_EVENT);
          l.height = l.baseHeight * (1 - l.compression);
        }
      }
      recomputeStack();

      // cull anything fully scrolled past the bottom edge
      while (layers.length && (layers[layers.length - 1]?.yTop ?? 0) > h + CULL_MARGIN_PX) {
        layers.pop();
      }
    };

    const recomputeStack = () => {
      let y = 0;
      for (const l of layers) {
        l.yTop = y;
        y += l.height;
      }
    };

    const scheduleNextPulse = () => {
      window.clearTimeout(pulseTimer);
      pulseTimer = window.setTimeout(() => {
        if (disposed || staticMode) return;
        depositPulse(performance.now());
        scheduleNextPulse();
      }, nextInterval(rand, meanMs));
    };

    // -- composite the whole visible strip from cached layer bitmaps; the
    // only per-frame work is a reveal clip (depositing layer) and a scour
    // overpaint (freshly buried layer), both driven off elapsed time, never
    // by recomputing the dot fields themselves. ---------------------------
    const drawScene = (nowMs: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      for (let i = layers.length - 1; i >= 0; i--) {
        const l = layers[i];
        if (!l) continue;
        if (l.yTop > h || l.yTop + l.height < 0) continue;

        let revealTopLocal = 0; // texture-local y above which nothing is drawn yet
        if (l.depositStart >= 0) {
          const elapsed = nowMs - l.depositStart;
          if (elapsed < DEPOSIT_BASE_MS) {
            // coarse base appears first: reveal only the bottom slice
            const baseSliceFrac = 0.28;
            revealTopLocal = l.baseHeight * (1 - baseSliceFrac);
          } else if (elapsed < DEPOSIT_TOTAL_MS) {
            const fineT = (elapsed - DEPOSIT_BASE_MS) / DEPOSIT_FINE_MS;
            const startFrac = 0.72; // matches (1 - baseSliceFrac) above
            revealTopLocal = l.baseHeight * startFrac * (1 - fineT);
          } else {
            l.depositStart = -1;
            revealTopLocal = 0;
          }
        }

        const srcH = Math.max(0, l.baseHeight - revealTopLocal);
        if (srcH <= 0) continue;
        const destFracH = srcH / l.baseHeight;
        const destY = l.yTop + l.height * (revealTopLocal / l.baseHeight);
        const destH = l.height * destFracH;

        ctx.drawImage(
          l.canvas,
          0,
          revealTopLocal * dpr,
          l.texW * dpr,
          srcH * dpr,
          0,
          destY,
          w,
          destH
        );

        // erosive basal scour on the layer that just got buried
        if (l.scourPoints && !l.scourSettled) {
          const elapsed = nowMs - l.scourStart;
          const progress = clamp(elapsed / SCOUR_MS, 0, 1);
          if (progress >= 1) l.scourSettled = true;
          drawScourNotch(l, progress);
        } else if (l.scourPoints) {
          drawScourNotch(l, 1);
        }
      }
    };

    const drawScourNotch = (l: Layer, progress: number) => {
      const pts = l.scourPoints;
      if (!pts) return;
      const n = pts.length;
      ctx.beginPath();
      ctx.moveTo(0, l.yTop);
      for (let k = 0; k < n; k++) {
        const x = (k / (n - 1)) * w;
        const y = l.yTop + pts[k]! * progress;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, l.yTop);
      ctx.closePath();
      ctx.fillStyle = colors.bg;
      ctx.fill();

      ctx.beginPath();
      for (let k = 0; k < n; k++) {
        const x = (k / (n - 1)) * w;
        const y = l.yTop + pts[k]! * progress;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    // -- deterministic reduced-motion / paused still: several complete
    // graded beds stacked, the freshest one fully formed and settled, its
    // own basal scour fully baked, no active deposit/scour in flight. -----
    const drawStaticFrame = () => {
      layers = [];
      let y = 0;
      let prevTop: Layer | null = null;
      for (let i = 0; i < REDUCED_MOTION_LAYERS; i++) {
        const heightPx = pulseHeight(rand, scale);
        const l = makeLayer(heightPx);
        l.depositStart = -1;
        if (prevTop) {
          prevTop.scourPoints = buildScourPoints(rand, 10);
          prevTop.scourSettled = true;
        }
        layers.unshift(l);
        for (const other of layers) if (other !== l) other.yTop += heightPx;
        prevTop = l;
        y += heightPx;
      }
      recomputeStack();
      drawScene(performance.now());
    };

    const resetAll = () => {
      window.clearTimeout(pulseTimer);
      layers = [];
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
    };

    const loop = (nowMs: number) => {
      if (!running) return;
      drawScene(nowMs);
      raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (running || disposed || staticMode) return;
      running = true;
      raf = requestAnimationFrame(loop);
      scheduleNextPulse();
    };
    const sleep = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      running = false;
      window.clearTimeout(pulseTimer);
    };

    const applySize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const changed = Math.abs(rect.width - w) > 0.5 || Math.abs(rect.height - h) > 0.5;
      w = rect.width;
      h = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      scale = clamp(w / 220, 0.6, 1.6);
      const pw = Math.max(2, Math.round(w * dpr));
      const ph = Math.max(2, Math.round(h * dpr));
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      if (changed) {
        // baked layer bitmaps are sized to the old strip width — a resize
        // invalidates them, so restart cleanly rather than rescale in place
        if (staticMode) drawStaticFrame();
        else {
          resetAll();
          if (!pausedRef.current) wake();
        }
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
        if (onScreen && !document.hidden) wake();
      }
    };
    const onMq = () => {
      reduced = mq.matches;
      applyMode();
    };
    mq.addEventListener("change", onMq);

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
    const pollPaused = () => {
      if (pausedRef.current !== lastPolledPaused) {
        lastPolledPaused = pausedRef.current;
        applyMode();
      }
      poll = window.setTimeout(pollPaused, 140);
    };
    pollPaused();

    const themeObserver = new MutationObserver(() => {
      readColors();
      for (const l of layers) paintLayerCanvas(l, colors, dpr);
      if (staticMode) drawScene(performance.now());
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
  }, [pulseIntervalSeconds]);

  return (
    <div
      ref={wrapRef}
      data-turbidite-graded-bed={uid}
      role="img"
      aria-label="Accumulating stratigraphic record, one graded sediment layer per flow event"
      className={`relative h-full w-full overflow-hidden bg-background ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 block h-full w-full" />
    </div>
  );
}

TurbiditeGradedBed.displayName = "TurbiditeGradedBed";
