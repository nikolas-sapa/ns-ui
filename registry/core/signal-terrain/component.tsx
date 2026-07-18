"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// deterministic 2-octave value noise — no deps, stable across frames
// ---------------------------------------------------------------------------
function hash2(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}
function vnoise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function noise2(x: number, y: number) {
  return 0.65 * vnoise(x, y) + 0.35 * vnoise(x * 2.1 + 19.7, y * 2.1 + 7.3);
}

// cubic-bezier(0.22, 1, 0.36, 1) solved via Newton–Raphson
function makeBezier(p1x: number, p1y: number, p2x: number, p2y: number) {
  const cx = 3 * p1x;
  const bx = 3 * (p2x - p1x) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * p1y;
  const by = 3 * (p2y - p1y) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const s = slopeX(t);
      if (Math.abs(s) < 1e-6) break;
      t -= (sampleX(t) - x) / s;
    }
    return sampleY(Math.min(1, Math.max(0, t)));
  };
}
const glideEase = makeBezier(0.22, 1, 0.36, 1);

const EMPTY: number[] = [];

// ---------------------------------------------------------------------------
// SignalTerrain — Unknown-Pleasures ridgeline landscape where incoming data
// samples scroll forward as ridgelines (history recedes into ambient Perlin
// terrain) and the cursor dents the mesh gravitationally. Canvas 2D,
// painter's-algorithm occlusion, refs only — the rAF loop is the sole writer.
// ---------------------------------------------------------------------------
export function SignalTerrain({
  series = EMPTY,
  cols = 96,
  rows = 40,
  ambientAmplitude = 18,
  dataAmplitude = 68,
  glideMs = 600,
  dentSigma = 90,
  dentDepth = 26,
  className = "h-96",
  "aria-label": ariaLabel = "Live signal terrain",
}: {
  /** data samples, oldest → newest; newest enters at the front row */
  series?: number[];
  /** vertices per ridgeline */
  cols?: number;
  /** ridgeline count (back to front) */
  rows?: number;
  /** ambient noise height in px at the front row */
  ambientAmplitude?: number;
  /** data peak height in px at the front row */
  dataAmplitude?: number;
  /** ms for the history to glide one row back after a push */
  glideMs?: number;
  /** gaussian radius of the cursor dent in screen px */
  dentSigma?: number;
  /** max cursor dent depth in px */
  dentDepth?: number;
  className?: string;
  "aria-label"?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const seriesRef = useRef<number[]>(series);
  const transRef = useRef(-1); // performance.now() of last push, -1 = settled
  const reducedRef = useRef(false);
  const drawRef = useRef<(() => void) | null>(null);

  // series is data, not render state: push detection + redraw happen in refs
  useEffect(() => {
    const prev = seriesRef.current;
    if (series === prev) return;
    const pushed =
      series.length !== prev.length ||
      (series.length > 0 &&
        series[series.length - 1] !== prev[prev.length - 1]);
    seriesRef.current = series;
    if (pushed) {
      if (reducedRef.current) drawRef.current?.();
      else transRef.current = performance.now();
    }
  }, [series]);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    reducedRef.current = reduced;

    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = () => {
      const rect = root.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
    };
    resize();

    // hot-path state — refs/locals only, never React state
    let raf = 0;
    let last = 0;
    let visible = true;
    let hovered = false;
    let px = 0;
    let py = 0;
    let dentAmt = 0;
    let dentVel = 0;
    let smoothMax = 0;
    const xs = new Float32Array(cols);
    const ys = new Float32Array(cols);
    const invCols = 1 / Math.max(1, cols - 1);
    const invRows = 1 / Math.max(1, rows - 1);
    const twoSigma2 = 2 * dentSigma * dentSigma;

    const draw = (now: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const s = seriesRef.current;
      const len = s.length;

      // glide progress: 1 = settled, eases 0 → 1 over glideMs after a push
      let et = 1;
      if (!reduced && transRef.current >= 0) {
        const p = (now - transRef.current) / glideMs;
        if (p >= 1) {
          transRef.current = -1;
        } else {
          et = glideEase(p);
        }
      }

      // smoothed normalization peak over the visible window
      let mx = 1e-6;
      for (let i = Math.max(0, len - rows - 1); i < len; i++) {
        const sv = s[i] ?? 0;
        if (sv > mx) mx = sv;
      }
      smoothMax = smoothMax === 0 ? mx : smoothMax + (mx - smoothMax) * 0.05;

      const scroll = reduced ? 0 : (now / 1000) * 0.06; // 0.06 noise u/s
      const horizonY = h * 0.16;
      const baseY = h * 0.94;
      const pad = w * 0.03;
      const usable = Math.max(1, w - pad * 2);
      const hasDent = dentAmt > 0.001 || dentAmt < -0.001;

      ctx.lineJoin = "round";
      // back → front: stroke then fill below with the background so nearer
      // ridges occlude farther ones (painter's-algorithm ridgeline trick)
      for (let r = 0; r < rows; r++) {
        const t = r * invRows; // 0 = horizon, 1 = front
        const rowY = horizonY + (baseY - horizonY) * t * t; // quadratic ease
        const rowW = usable * (0.65 + 0.35 * t); // narrows 35% at the back
        const x0 = pad + (usable - rowW) / 2;

        // fractional sample index: history glides one row back per push
        const idx = len - rows + r - 1 + et;
        const i0 = Math.floor(idx);
        const f = idx - i0;
        const v0 = i0 >= 0 && i0 < len ? (s[i0] ?? 0) : 0;
        const v1 = i0 + 1 >= 0 && i0 + 1 < len ? (s[i0 + 1] ?? 0) : 0;
        const val = Math.min(1.4, Math.max(0, (v0 + (v1 - v0) * f) / smoothMax));
        const texIdx = Math.round(idx); // texture travels with the sample
        const frontScale = 0.25 + 0.75 * t;
        const ambScale = ambientAmplitude * (0.3 + 0.7 * t);
        const depthCoord = (rows - 1 - r) * 0.35 + scroll;

        for (let c = 0; c < cols; c++) {
          const cn = c * invCols;
          const x = x0 + rowW * cn;
          const amb = ambScale * noise2(cn * 4 + 7.3, depthCoord);
          const env = Math.exp(-((cn - 0.5) * (cn - 0.5)) / (2 * 0.18 * 0.18));
          const tex = 0.55 + 0.45 * noise2(cn * 9 + 3.1, texIdx * 0.7);
          let y = rowY - amb - dataAmplitude * frontScale * val * env * tex;
          if (hasDent) {
            const dx = x - px;
            const dy = y - py;
            y += dentDepth * dentAmt * Math.exp(-(dx * dx + dy * dy) / twoSigma2);
          }
          xs[c] = x;
          ys[c] = y;
        }

        // occlusion fill down to the bottom edge
        ctx.beginPath();
        ctx.moveTo(xs[0] ?? 0, ys[0] ?? 0);
        for (let c = 1; c < cols; c++) ctx.lineTo(xs[c] ?? 0, ys[c] ?? 0);
        ctx.lineTo(x0 + rowW, h + 2);
        ctx.lineTo(x0, h + 2);
        ctx.closePath();
        ctx.fillStyle = "#0a0a0a";
        ctx.fill();

        // ridgeline stroke: rgba(143,143,143,0.25) 1px at the horizon
        // fading to #ededed 1.5px at the front
        const mix = Math.pow(t, 1.3);
        const g = Math.round(143 + (237 - 143) * mix);
        const a = 0.25 + 0.75 * mix;
        ctx.beginPath();
        ctx.moveTo(xs[0] ?? 0, ys[0] ?? 0);
        for (let c = 1; c < cols; c++) ctx.lineTo(xs[c] ?? 0, ys[c] ?? 0);
        ctx.strokeStyle = `rgba(${g},${g},${g},${a})`;
        ctx.lineWidth = 1 + 0.5 * mix;
        ctx.stroke();
      }
    };

    if (reduced) {
      // static fallback: current series at rest, no scroll, no dent;
      // redrawn instantly on data change (via drawRef) and on resize
      drawRef.current = () => draw(0);
      draw(0);
      const ro = new ResizeObserver(() => {
        resize();
        draw(0);
      });
      ro.observe(root);
      return () => {
        ro.disconnect();
        drawRef.current = null;
      };
    }

    const loop = (now: number) => {
      const dt = last === 0 ? 1 / 60 : Math.min(0.05, (now - last) / 1000);
      last = now;
      if (hovered) {
        // lerp toward full dent at 0.12/frame (framerate-normalized)
        const prev = dentAmt;
        dentAmt += (1 - dentAmt) * (1 - Math.pow(0.88, dt * 60));
        dentVel = (dentAmt - prev) / dt; // carry velocity into the release
      } else if (dentAmt !== 0 || dentVel !== 0) {
        // underdamped spring release: k = 70 s^-2, zeta = 0.6 → one rebound
        const k = 70;
        const c = 2 * 0.6 * Math.sqrt(k);
        dentVel += (-k * dentAmt - c * dentVel) * dt;
        dentAmt += dentVel * dt;
        if (Math.abs(dentAmt) < 0.0005 && Math.abs(dentVel) < 0.005) {
          dentAmt = 0;
          dentVel = 0;
        }
      }
      draw(now);
      raf = visible ? requestAnimationFrame(loop) : 0;
    };
    raf = requestAnimationFrame(loop);

    // ambient scroll never settles, so "sleep" = pause offscreen
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && raf === 0) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(root);

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      px = e.clientX - rect.left;
      py = e.clientY - rect.top;
      hovered = true;
    };
    const onLeave = () => {
      hovered = false;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(root);
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerdown", onMove);
    root.addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerdown", onMove);
      root.removeEventListener("pointerleave", onLeave);
    };
  }, [cols, rows, ambientAmplitude, dataAmplitude, glideMs, dentSigma, dentDepth]);

  return (
    <div
      ref={rootRef}
      role="img"
      aria-label={ariaLabel}
      className={`relative w-full overflow-hidden ${className}`}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );
}
