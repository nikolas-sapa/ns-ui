"use client";

import { useEffect, useMemo, useRef } from "react";

// ---------------------------------------------------------------------------
// AuroraFlowChart — area chart whose fill IS an aurora curtain. The series
// drives curtain height per x-column, local slope sign steers a cool→warm hue
// band (falling = cooler, rising = warmer), and the noise-warped top edge
// drifts on 2-octave value noise even at rest. Data updates glide each
// column to its new height with a staggered ease. Canvas 2D curtain + DOM
// furniture (axis captions, legend, tooltip). Direct-DOM rAF loop — no React
// state on the hot path; every drawn color derives from theme tokens and is
// re-derived live when the documentElement class flips.
// ---------------------------------------------------------------------------

// deterministic 2-octave value noise (house noise2, shared with signal-terrain)
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

function niceCeil(v: number) {
  if (!(v > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const d = v / p;
  const m = d <= 1 ? 1 : d <= 2 ? 2 : d <= 2.5 ? 2.5 : d <= 5 ? 5 : 10;
  return m * p;
}

function parseColor(raw: string): [number, number, number] | null {
  const s = raw.trim();
  if (s.startsWith("#")) {
    const hx = s.slice(1);
    if (hx.length === 3) {
      const r = parseInt(hx[0] + hx[0], 16);
      const g = parseInt(hx[1] + hx[1], 16);
      const b = parseInt(hx[2] + hx[2], 16);
      if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
      return [r, g, b];
    }
    if (hx.length >= 6) {
      const r = parseInt(hx.slice(0, 2), 16);
      const g = parseInt(hx.slice(2, 4), 16);
      const b = parseInt(hx.slice(4, 6), 16);
      if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
      return [r, g, b];
    }
    return null;
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m && m[1]) {
    const parts = m[1].split(/[\s,/]+/).map(Number);
    if (parts.length >= 3 && parts.slice(0, 3).every((n) => Number.isFinite(n))) {
      return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
    }
  }
  return null;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sn = s / 100;
  const ln = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) =>
    ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [
    Math.round(255 * f(0)),
    Math.round(255 * f(8)),
    Math.round(255 * f(4)),
  ];
}

const rgba = (c: [number, number, number], a: number) =>
  `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// plot geometry + motion constants
const PAD_L = 46;
const PAD_R = 12;
const PAD_T = 30;
const PAD_B = 24;
const COL_W = 2; // curtain strip width in CSS px
const STAGGER_MS = 4; // per-column glide stagger, left → right
const WARP_FREQ = 6; // noise u spanned across the plot width
const DRIFT_U_PER_S = 0.05; // ambient drift speed in noise-u/s
const WARP_AMP = 0.06; // warp amplitude as a fraction of column height
const SPRING_K = 200; // crosshair spring stiffness, s^-2
const SPRING_C = 2 * 1.0 * Math.sqrt(SPRING_K); // zeta = 1, critically damped
const IDLE_MS = 5000; // pointer idle before the 30 fps cap kicks in
const IDLE_FRAME_MS = 1000 / 30;

export interface AuroraPoint {
  label: string;
  value: number;
}

// deterministic default series so <AuroraFlowChart /> renders bare
const DEFAULT_DATA: AuroraPoint[] = Array.from({ length: 24 }, (_, i) => ({
  label: `${String(i).padStart(2, "0")}:00`,
  value: Math.round(
    150 +
      95 * Math.max(0, Math.sin(((i - 4) / 24) * Math.PI * 2)) +
      50 * noise2(i * 0.7, 3.1)
  ),
}));

const defaultFormat = (v: number) => Math.round(v).toLocaleString("en-US");

export function AuroraFlowChart({
  data = DEFAULT_DATA,
  height = 300,
  yTicks = 4,
  glideMs = 600,
  formatValue = defaultFormat,
  showLegend = true,
  className = "",
  "aria-label": ariaLabel = "Aurora flow chart",
}: {
  /** series points, oldest → newest; updates glide the curtain to the new curve */
  data?: AuroraPoint[];
  /** chart height in px (width is fluid) */
  height?: number;
  /** horizontal gridline divisions above the baseline */
  yTicks?: number;
  /** ms for a column to glide to its new height after a data update */
  glideMs?: number;
  /** value formatter for tick captions and the tooltip */
  formatValue?: (v: number) => string;
  /** show the falling/rising hue legend */
  showLegend?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const tipLabelRef = useRef<HTMLSpanElement>(null);
  const tipValueRef = useRef<HTMLSpanElement>(null);
  const tipDeltaRef = useRef<HTMLSpanElement>(null);
  const coolSwatchRef = useRef<HTMLSpanElement>(null);
  const warmSwatchRef = useRef<HTMLSpanElement>(null);
  const retargetRef = useRef<((pts: AuroraPoint[]) => void) | null>(null);
  const dataRef = useRef(data);
  const fmtRef = useRef(formatValue);
  fmtRef.current = formatValue;

  // axis furniture is cold-path React — recomputed only when data changes
  const ticks = useMemo(() => {
    let mx = 0;
    for (const p of data) if (p.value > mx) mx = p.value;
    const nm = niceCeil(mx);
    const plotH = Math.max(1, height - PAD_T - PAD_B);
    const out: { top: number; value: number }[] = [];
    for (let k = 0; k <= yTicks; k++) {
      out.push({ top: PAD_T + plotH * (1 - k / yTicks), value: (nm * k) / yTicks });
    }
    return out;
  }, [data, height, yTicks]);

  const xLabels = useMemo(() => {
    if (data.length === 0) return [];
    const first = data[0]?.label ?? "";
    const last = data[data.length - 1]?.label ?? "";
    if (data.length < 3) return [first, last];
    const mid = data[Math.floor((data.length - 1) / 2)]?.label ?? "";
    return [first, mid, last];
  }, [data]);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const tip = tipRef.current;
    const tipLabel = tipLabelRef.current;
    const tipValue = tipValueRef.current;
    const tipDelta = tipDeltaRef.current;
    if (!root || !canvas || !tip) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // geometry
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

    // series state — closure locals + typed arrays only, never React state
    let count = 0;
    let cur = new Float32Array(0);
    let start = new Float32Array(0);
    let target = new Float32Array(0);
    let values: number[] = [];
    let labels: string[] = [];
    let transStart = -1; // performance.now() of last retarget, -1 = settled
    let lastPts: AuroraPoint[] | null = null;

    // crosshair spring + pointer
    let activeIdx = -1;
    let pxTarget = 0;
    let cx = 0;
    let cvx = 0;
    let lastPointerTs = performance.now();

    // loop state
    let raf = 0;
    let staticRaf = 0;
    let lastT = 0;
    let lastPaint = 0;
    let driftU = 0; // accumulated noise-u — pauses offscreen, stays 0 reduced
    let visible = true;

    // theme-derived ink — every drawn color comes from tokens, re-derived on
    // documentElement class changes so the curtain reads on both themes
    let bgC: [number, number, number] = [255, 255, 255];
    let fgC: [number, number, number] = [23, 23, 23];
    let borderC: [number, number, number] = [235, 235, 235];
    let accentC = "#006bff";
    let coolHue = 192;
    let warmHue = 326;
    let rampS = 80;
    let rampL = 37;
    let capA = 0.85;
    let coolStrip: HTMLCanvasElement | null = null;
    let warmStrip: HTMLCanvasElement | null = null;

    // 1×256 pre-baked alpha strip: pow(1 - y/h, 1.6) falloff, tinted at a
    // ramp endpoint; per column both strips blend by slope-mapped mix
    const bakeStrip = (rgb: [number, number, number], maxA: number) => {
      const c = document.createElement("canvas");
      c.width = 1;
      c.height = 256;
      const g = c.getContext("2d");
      if (!g) return null;
      const img = g.createImageData(1, 256);
      for (let y = 0; y < 256; y++) {
        const o = y * 4;
        img.data[o] = rgb[0];
        img.data[o + 1] = rgb[1];
        img.data[o + 2] = rgb[2];
        img.data[o + 3] = Math.round(255 * maxA * Math.pow(1 - y / 256, 1.6));
      }
      g.putImageData(img, 0, 0);
      return c;
    };

    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      const get = (name: string, fb: string) =>
        cs.getPropertyValue(name).trim() || fb;
      bgC = parseColor(get("--background", "#ffffff")) ?? [255, 255, 255];
      fgC = parseColor(get("--foreground", "#171717")) ?? [23, 23, 23];
      borderC = parseColor(get("--border", "#ebebeb")) ?? [235, 235, 235];
      accentC = get("--accent", "#006bff");
      const lum = (0.2126 * bgC[0] + 0.7152 * bgC[1] + 0.0722 * bgC[2]) / 255;
      const dark = lum < 0.5;
      // ramp endpoints keyed to theme luminance: bright/saturated on dark,
      // deep on light so the curtain still reads on white
      coolHue = dark ? 178 : 192;
      warmHue = dark ? 318 : 326;
      rampS = dark ? 92 : 80;
      rampL = dark ? 60 : 37;
      capA = dark ? 0.95 : 0.85;
      const maxA = dark ? 0.82 : 0.75;
      coolStrip = bakeStrip(hslToRgb(coolHue, rampS, rampL), maxA);
      warmStrip = bakeStrip(hslToRgb(warmHue, rampS, rampL), maxA);
      // legend swatches share the ramp endpoints (DOM, direct style write)
      if (coolSwatchRef.current) {
        coolSwatchRef.current.style.background = `hsl(${coolHue}, ${rampS}%, ${rampL}%)`;
      }
      if (warmSwatchRef.current) {
        warmSwatchRef.current.style.background = `hsl(${warmHue}, ${rampS}%, ${rampL}%)`;
      }
    };
    readTokens();

    const topEdgeY = (plotW: number, plotH: number, xPlot: number, hN: number) => {
      const colH = hN * plotH;
      const u = (xPlot / Math.max(1, plotW)) * WARP_FREQ + driftU;
      const warp = (noise2(u, 0.7) - 0.5) * 2 * colH * WARP_AMP;
      const y = PAD_T + plotH - colH + warp;
      return Math.min(PAD_T + plotH, Math.max(PAD_T, y));
    };

    const draw = (now: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const plotW = w - PAD_L - PAD_R;
      const plotH = h - PAD_T - PAD_B;
      // zero-size guard: never normalize or divide against a collapsed plot
      if (w < 2 || h < 2 || plotW < 4 || plotH < 4) return;

      // recessive gridlines + baseline, border token ink
      ctx.lineWidth = 1;
      for (let k = 0; k <= yTicks; k++) {
        const gy = Math.round(PAD_T + plotH * (1 - k / yTicks)) + 0.5;
        ctx.strokeStyle = rgba(borderC, k === 0 ? 0.9 : 0.5);
        ctx.beginPath();
        ctx.moveTo(PAD_L, gy);
        ctx.lineTo(PAD_L + plotW, gy);
        ctx.stroke();
      }

      const n = count;
      if (n === 0) return;

      // glide: each column eases start → target, staggered 4 ms left → right
      if (transStart >= 0) {
        for (let i = 0; i < n; i++) {
          const p = (now - transStart - i * STAGGER_MS) / glideMs;
          const e = glideEase(Math.min(1, Math.max(0, p)));
          const s = start[i] ?? 0;
          cur[i] = s + ((target[i] ?? 0) - s) * e;
        }
        if (now >= transStart + glideMs + n * STAGGER_MS) {
          cur.set(target);
          transStart = -1;
        }
      }

      // aurora curtain: per-x-column luminance strip, top edge noise-warped,
      // hue mixed cool→warm by the local slope sign
      const denom = Math.max(1, n - 1);
      const baseline = PAD_T + plotH;
      const hueSpan = warmHue - coolHue;
      for (let x = 0; x < plotW; x += COL_W) {
        const fi = (x / plotW) * denom;
        let i0 = Math.floor(fi);
        if (i0 > n - 2) i0 = Math.max(0, n - 2);
        const f = Math.min(1, Math.max(0, fi - i0));
        const v0 = cur[i0] ?? 0;
        const v1 = cur[Math.min(n - 1, i0 + 1)] ?? v0;
        const hN = n > 1 ? v0 + (v1 - v0) * f : v0;
        const colH = hN * plotH;
        if (colH < 0.75) continue;
        const u = (x / plotW) * WARP_FREQ + driftU;
        const warpY = (noise2(u, 0.7) - 0.5) * 2 * colH * WARP_AMP;
        let topY = baseline - colH + warpY;
        if (topY < PAD_T) topY = PAD_T;
        if (topY > baseline - 0.5) topY = baseline - 0.5;
        const stripH = baseline - topY;
        // slope over a 4-index window smooths the hue banding
        const iA = Math.max(0, i0 - 2);
        const iB = Math.min(n - 1, i0 + 2);
        const slope = ((cur[iB] ?? 0) - (cur[iA] ?? 0)) / Math.max(1, iB - iA);
        const mix = Math.min(1, Math.max(0, 0.5 + slope * 14));
        const gx = PAD_L + x;
        if (coolStrip && mix < 0.995) {
          ctx.globalAlpha = 1 - mix;
          ctx.drawImage(coolStrip, gx, topY, COL_W, stripH);
        }
        if (warmStrip && mix > 0.005) {
          ctx.globalAlpha = mix;
          ctx.drawImage(warmStrip, gx, topY, COL_W, stripH);
        }
        // luminous cap rides the warped top edge in the mixed hue
        ctx.globalAlpha = capA;
        ctx.fillStyle = `hsl(${coolHue + hueSpan * mix}, ${rampS}%, ${rampL}%)`;
        ctx.fillRect(gx, topY - 0.75, COL_W, 1.5);
      }
      ctx.globalAlpha = 1;

      // crosshair + active point — accent is reserved for this interaction
      if (activeIdx >= 0 && activeIdx < n) {
        ctx.strokeStyle = rgba(fgC, 0.22);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, PAD_T);
        ctx.lineTo(cx, baseline);
        ctx.stroke();
        const axp = (activeIdx / denom) * plotW;
        const ay = topEdgeY(plotW, plotH, axp, cur[activeIdx] ?? 0);
        ctx.fillStyle = rgba(bgC, 1);
        ctx.beginPath();
        ctx.arc(PAD_L + axp, ay, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = accentC;
        ctx.beginPath();
        ctx.arc(PAD_L + axp, ay, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const positionTooltip = () => {
      const plotW = w - PAD_L - PAD_R;
      const plotH = h - PAD_T - PAD_B;
      if (activeIdx < 0 || activeIdx >= count || plotW < 4 || plotH < 4) {
        tip.style.opacity = "0";
        return;
      }
      const denom = Math.max(1, count - 1);
      const axp = (activeIdx / denom) * plotW;
      const ay = topEdgeY(plotW, plotH, axp, cur[activeIdx] ?? 0);
      const tx = Math.min(w - 56, Math.max(56, PAD_L + axp));
      const ty = Math.max(10, ay - 10);
      tip.style.opacity = "1";
      tip.style.transform = `translate(${Math.round(tx)}px, ${Math.round(ty)}px) translate(-50%, -100%)`;
    };

    const updateTipContent = () => {
      if (activeIdx < 0 || activeIdx >= count) return;
      const v = values[activeIdx] ?? 0;
      if (tipLabel) tipLabel.textContent = labels[activeIdx] ?? "";
      if (tipValue) tipValue.textContent = fmtRef.current(v);
      if (tipDelta) {
        if (activeIdx === 0) {
          tipDelta.textContent = "Δ —";
        } else {
          const d = v - (values[activeIdx - 1] ?? v);
          tipDelta.textContent = `Δ ${d >= 0 ? "+" : "−"}${fmtRef.current(Math.abs(d))}`;
        }
      }
    };

    // reduced motion: no loop at all — one static frame (noise at t=0),
    // repainted on demand; tooltip and keyboard still work
    const scheduleStatic = () => {
      if (staticRaf) return;
      staticRaf = requestAnimationFrame(() => {
        staticRaf = 0;
        draw(performance.now());
        positionTooltip();
      });
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = lastT === 0 ? 1 / 60 : Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      driftU += dt * DRIFT_U_PER_S;

      // crosshair spring-follows the pointer x, k=200 s^-2, zeta=1
      let springActive = false;
      if (activeIdx >= 0) {
        const ax = SPRING_K * (pxTarget - cx) - SPRING_C * cvx;
        cvx += ax * dt;
        cx += cvx * dt;
        springActive = Math.abs(pxTarget - cx) > 0.3 || Math.abs(cvx) > 4;
        if (!springActive) {
          cx = pxTarget;
          cvx = 0;
        }
      }

      // idle throttle: drift is slow — halve paint rate to 30 fps when the
      // pointer has been idle > 5 s and no glide/spring is in flight
      const busyNow =
        transStart >= 0 || springActive || now - lastPointerTs < IDLE_MS;
      if (!busyNow && now - lastPaint < IDLE_FRAME_MS) return;
      lastPaint = now;
      draw(now);
      if (activeIdx >= 0) positionTooltip();
    };

    const wake = () => {
      if (reduced) {
        scheduleStatic();
        return;
      }
      if (!visible || raf) return;
      lastT = 0;
      raf = requestAnimationFrame(loop);
    };

    const retarget = (pts: AuroraPoint[]) => {
      if (pts === lastPts) return;
      lastPts = pts;
      const n = pts.length;
      let mx = 0;
      for (let i = 0; i < n; i++) mx = Math.max(mx, pts[i]?.value ?? 0);
      const nm = niceCeil(mx); // matches the React tick scale (same helper)
      const nextCur = new Float32Array(n);
      const nextStart = new Float32Array(n);
      const nextTarget = new Float32Array(n);
      values = new Array<number>(n);
      labels = new Array<string>(n);
      for (let i = 0; i < n; i++) {
        const p = pts[i];
        const v = p?.value ?? 0;
        values[i] = v;
        labels[i] = p?.label ?? "";
        nextTarget[i] = Math.min(1, Math.max(0, v / nm));
        const from = i < count ? cur[i] ?? 0 : 0;
        nextStart[i] = from;
        nextCur[i] = from;
      }
      count = n;
      cur = nextCur;
      start = nextStart;
      target = nextTarget;
      if (activeIdx >= count) activeIdx = count - 1;
      if (activeIdx >= 0) updateTipContent();
      if (reduced) {
        cur.set(target);
        transStart = -1;
        scheduleStatic();
      } else {
        transStart = performance.now();
        wake();
      }
    };
    retargetRef.current = retarget;
    retarget(dataRef.current); // initial glide-in from a flat baseline

    // interaction ------------------------------------------------------------
    const activate = (idx: number) => {
      if (idx < 0 || idx >= count) return;
      activeIdx = idx;
      const plotW = w - PAD_L - PAD_R;
      pxTarget = PAD_L + (idx / Math.max(1, count - 1)) * Math.max(1, plotW);
      updateTipContent();
      if (reduced) {
        cx = pxTarget;
        cvx = 0;
        scheduleStatic();
      } else {
        wake();
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      const x = e.clientX - rect.left;
      lastPointerTs = performance.now();
      const plotW = w - PAD_L - PAD_R;
      if (plotW < 4 || count === 0) return;
      if (activeIdx < 0) {
        // first contact: snap the crosshair under the pointer, then spring
        cx = Math.min(PAD_L + plotW, Math.max(PAD_L, x));
        cvx = 0;
      }
      const t = (x - PAD_L) / plotW;
      const idx = Math.min(
        count - 1,
        Math.max(0, Math.round(t * Math.max(1, count - 1)))
      );
      activate(idx);
    };

    const onPointerLeave = () => {
      activeIdx = -1;
      tip.style.opacity = "0";
      lastPointerTs = performance.now();
      if (reduced) scheduleStatic();
      else wake();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (count === 0) return;
      e.preventDefault();
      lastPointerTs = performance.now();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const idx =
        activeIdx < 0
          ? dir === 1
            ? 0
            : count - 1
          : Math.min(count - 1, Math.max(0, activeIdx + dir));
      if (activeIdx < 0) {
        const plotW = Math.max(1, w - PAD_L - PAD_R);
        cx = PAD_L + (idx / Math.max(1, count - 1)) * plotW;
        cvx = 0;
      }
      activate(idx);
    };

    const onBlur = () => {
      activeIdx = -1;
      tip.style.opacity = "0";
      if (reduced) scheduleStatic();
      else wake();
    };

    // observers --------------------------------------------------------------
    // full stop offscreen; drift pauses (driftU only advances while looping)
    const io = new IntersectionObserver((entries) => {
      const vis = entries[0]?.isIntersecting ?? true;
      if (vis === visible) return;
      visible = vis;
      if (!visible) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      } else {
        lastPaint = 0;
        wake();
      }
    });
    io.observe(root);

    const ro = new ResizeObserver(() => {
      resize();
      if (activeIdx >= 0) {
        const plotW = Math.max(1, w - PAD_L - PAD_R);
        pxTarget = PAD_L + (activeIdx / Math.max(1, count - 1)) * plotW;
      }
      lastPaint = 0;
      if (reduced) scheduleStatic();
      else wake();
    });
    ro.observe(root);

    // live theme re-derive: token flip on <html class="dark"> rebakes the
    // strips and repaints without a remount
    const mo = new MutationObserver(() => {
      readTokens();
      lastPaint = 0;
      if (reduced) scheduleStatic();
      else wake();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    root.addEventListener("pointermove", onPointerMove);
    root.addEventListener("pointerdown", onPointerMove);
    root.addEventListener("pointerleave", onPointerLeave);
    root.addEventListener("keydown", onKeyDown);
    root.addEventListener("blur", onBlur);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (staticRaf) cancelAnimationFrame(staticRaf);
      raf = 0;
      staticRaf = 0;
      io.disconnect();
      ro.disconnect();
      mo.disconnect();
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerdown", onPointerMove);
      root.removeEventListener("pointerleave", onPointerLeave);
      root.removeEventListener("keydown", onKeyDown);
      root.removeEventListener("blur", onBlur);
      retargetRef.current = null;
    };
  }, [glideMs, yTicks]);

  // data is a prop, not render state: pushes retarget the glide via ref
  useEffect(() => {
    dataRef.current = data;
    retargetRef.current?.(data);
  }, [data]);

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      role="img"
      aria-label={ariaLabel}
      className={`relative w-full cursor-crosshair select-none overflow-hidden rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${className}`}
      style={{ height }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 h-full w-full"
      />

      {/* y-gridline captions — DOM ink wears text tokens, themes for free */}
      {ticks.map((t, i) => (
        <span
          key={i}
          aria-hidden
          className="absolute font-mono text-[10px] leading-none text-muted"
          style={{ left: 6, top: t.top - 4, width: PAD_L - 12, textAlign: "right" }}
        >
          {formatValue(t.value)}
        </span>
      ))}

      {/* x-axis captions */}
      {xLabels.length > 0 && (
        <div
          aria-hidden
          className="absolute bottom-1.5 flex justify-between font-mono text-[10px] leading-none text-muted"
          style={{ left: PAD_L, right: PAD_R }}
        >
          {xLabels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      )}

      {/* legend — the hue band encodes local trend direction */}
      {showLegend && (
        <div
          aria-hidden
          className="absolute right-3 top-2 flex items-center gap-3 font-mono text-[10px] leading-none text-muted"
        >
          <span className="flex items-center gap-1.5">
            <span ref={coolSwatchRef} className="h-1 w-4 rounded-full bg-muted/40" />
            falling
          </span>
          <span className="flex items-center gap-1.5">
            <span ref={warmSwatchRef} className="h-1 w-4 rounded-full bg-muted/40" />
            rising
          </span>
        </div>
      )}

      {/* tooltip — direct-DOM positioned, snapped to the nearest data point */}
      <div
        ref={tipRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 z-10 whitespace-nowrap rounded-sm border border-border bg-surface px-2.5 py-1.5 font-mono text-[11px] leading-tight opacity-0 shadow-sm transition-opacity duration-150 will-change-transform motion-reduce:transition-none"
      >
        <span ref={tipLabelRef} className="mr-2 text-muted" />
        <span ref={tipValueRef} className="text-foreground" />
        <span ref={tipDeltaRef} className="ml-2 text-muted" />
      </div>
    </div>
  );
}
