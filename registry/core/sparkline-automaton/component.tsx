"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// RuleSparkline — inline KPI sparkline over an elementary cellular-automaton
// texture. The Wolfram rule is selected by the series' volatility (coefficient
// of variation): calm data grows a sparse automaton, volatile data a chaotic
// one, one generation column per data point — the texture reads the data
// instead of decorating it. CA is computed once per data update and cached to
// an offscreen canvas; rAF exists only during the entrance sweep and active
// scrub, cancelled otherwise.
// ---------------------------------------------------------------------------

type Vec3 = [number, number, number];

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

function parseColor(raw: string): Vec3 | null {
  const s = raw.trim();
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex.slice(0, 1) + hex.slice(0, 1), 16);
      const g = parseInt(hex.slice(1, 2) + hex.slice(1, 2), 16);
      const b = parseInt(hex.slice(2, 3) + hex.slice(2, 3), 16);
      return Number.isNaN(r + g + b) ? null : [r, g, b];
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return Number.isNaN(r + g + b) ? null : [r, g, b];
    }
    return null;
  }
  const m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

// deterministic per-cell hash → stable alpha texture across repaints
function hash01(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

// volatility bucket → elementary rule. cv = stddev/mean, zero-mean guarded.
function volatilityRule(data: number[]): { rule: number; cv: number } {
  const n = data.length;
  if (n < 2) return { rule: 4, cv: 0 };
  let sum = 0;
  for (let i = 0; i < n; i++) sum += data[i] ?? 0;
  const mean = sum / n;
  let sq = 0;
  for (let i = 0; i < n; i++) {
    const d = (data[i] ?? 0) - mean;
    sq += d * d;
  }
  const sd = Math.sqrt(sq / n);
  const denom = Math.abs(mean);
  const cv = denom < 1e-9 ? (sd > 1e-9 ? 1 : 0) : sd / denom;
  if (cv < 0.08) return { rule: 4, cv };
  if (cv < 0.2) return { rule: 108, cv };
  if (cv < 0.4) return { rule: 110, cv };
  return { rule: 30, cv };
}

// seed row derived from the first value's IEEE-754 bits (mulberry32 walk) —
// identical data reproduces identical texture
function seedRow(rows: number, firstValue: number): Uint8Array {
  const f = new Float32Array(1);
  f[0] = firstValue;
  let s = (new Uint32Array(f.buffer)[0] ?? 0) || 0x9e3779b9;
  const out = new Uint8Array(rows);
  for (let i = 0; i < rows; i++) {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    out[i] = (((t ^ (t >>> 14)) >>> 0) >>> 8) & 1;
  }
  return out;
}

function nextGen(prev: Uint8Array, rule: number): Uint8Array {
  const n = prev.length;
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const l = prev[(i - 1 + n) % n] ?? 0;
    const c = prev[i] ?? 0;
    const r = prev[(i + 1) % n] ?? 0;
    out[i] = (rule >> ((l << 2) | (c << 1) | r)) & 1;
  }
  return out;
}

const DEFAULT_DATA = [
  42, 44, 43, 47, 45, 49, 46, 51, 48, 53, 50, 47, 52, 55, 51, 56, 53, 58, 55,
  60, 57, 61, 59, 63,
];

function defaultFormat(v: number) {
  return v.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

export function RuleSparkline({
  data = DEFAULT_DATA,
  cellSize = 3,
  entranceMs = 900,
  strokeWidth = 1.5,
  formatValue = defaultFormat,
  className = "h-14",
  "aria-label": ariaLabel = "KPI sparkline",
}: {
  /** series values, oldest → newest; one CA generation per point */
  data?: number[];
  /** CA cell height in px */
  cellSize?: number;
  /** entrance sweep duration in ms */
  entranceMs?: number;
  /** polyline stroke width in px */
  strokeWidth?: number;
  /** scrub readout formatter */
  formatValue?: (value: number, index: number) => string;
  /** extra classes merged onto the rendered root element */
  className?: string;
  /** accessible name for the sparkline. Default "KPI sparkline". */
  "aria-label"?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readoutRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef(data);
  const formatRef = useRef(formatValue);
  formatRef.current = formatValue;
  const ariaLabelRef = useRef(ariaLabel);
  ariaLabelRef.current = ariaLabel;
  const engineRef = useRef<{ setData: (d: number[]) => void } | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const readout = readoutRef.current;
    if (!root || !canvas || !readout) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const off = document.createElement("canvas");
    const octx = off.getContext("2d");
    if (!octx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // -- token-derived ink: read at mount, re-derived on theme class change --
    let fg: Vec3 = [237, 237, 237];
    let ac: Vec3 = [0, 107, 255];
    let mu: Vec3 = [143, 143, 143];
    const derive = () => {
      const cs = getComputedStyle(document.documentElement);
      fg = parseColor(cs.getPropertyValue("--foreground")) ?? fg;
      ac = parseColor(cs.getPropertyValue("--ns-accent")) ?? ac;
      mu = parseColor(cs.getPropertyValue("--ns-muted")) ?? mu;
    };
    derive();

    // -- hot-path state: locals only, never React state ---------------------
    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let last = 0;
    let cur: number[] = dataRef.current;
    let gens: Uint8Array[] = [];
    let rule = 4;
    let rows = 0;
    let xs = new Float32Array(0);
    let ys = new Float32Array(0);
    let pathLen = 0;
    // sweep: -1 = settled (fully revealed)
    let sweepStart = -1;
    let sweepDur = entranceMs;
    let sweepFromFrac = 0;
    // scrub spring: k = 250 s^-2, zeta = 1.0 (critically damped)
    const K = 250;
    const C = 2 * Math.sqrt(K);
    let hx = 0;
    let hv = 0;
    let tx = 0;
    let alpha = 0;
    let targetAlpha = 0;
    let ai = -1;
    let readoutAi = -1;
    let readoutShown = false;

    const computeCA = () => {
      gens = [];
      const picked = volatilityRule(cur);
      rule = picked.rule;
      rows = Math.max(0, Math.floor(h / cellSize));
      if (cur.length === 0 || rows === 0) return;
      let row = seedRow(rows, cur[0] ?? 0);
      gens.push(row);
      for (let i = 1; i < cur.length; i++) {
        row = nextGen(row, rule);
        gens.push(row);
      }
    };

    const computeGeometry = () => {
      const n = cur.length;
      xs = new Float32Array(n);
      ys = new Float32Array(n);
      pathLen = 0;
      if (n === 0 || w <= 0 || h <= 0) return;
      let mn = Infinity;
      let mx = -Infinity;
      for (let i = 0; i < n; i++) {
        const v = cur[i] ?? 0;
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
      const span = mx - mn;
      const padY = Math.max(3, strokeWidth + 2);
      for (let i = 0; i < n; i++) {
        xs[i] = n > 1 ? (i / (n - 1)) * w : w / 2;
        ys[i] =
          span > 1e-12
            ? padY + (1 - ((cur[i] ?? 0) - mn) / span) * (h - padY * 2)
            : h / 2;
      }
      for (let i = 1; i < n; i++) {
        const dx = (xs[i] ?? 0) - (xs[i - 1] ?? 0);
        const dy = (ys[i] ?? 0) - (ys[i - 1] ?? 0);
        pathLen += Math.sqrt(dx * dx + dy * dy);
      }
    };

    // CA texture painted ONCE per data/theme/size change — never per frame
    const paintOffscreen = () => {
      off.width = Math.max(1, Math.round(w * dpr));
      off.height = Math.max(1, Math.round(h * dpr));
      const n = gens.length;
      if (w <= 0 || h <= 0 || n === 0) return;
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      octx.clearRect(0, 0, w, h);
      const colW = w / n;
      const gap = colW > 2.5 ? 1 : 0;
      const cellGap = cellSize > 2 ? 1 : 0;
      for (let i = 0; i < n; i++) {
        const g = gens[i];
        if (!g) continue;
        const x = i * colW;
        for (let r = 0; r < rows; r++) {
          if (!g[r]) continue;
          // foreground ink at 8–14% alpha, deterministic per cell
          const a = 0.08 + 0.06 * hash01(i * 7.13 + 1.7, r * 3.71 + 9.2);
          octx.fillStyle = `rgba(${fg[0]},${fg[1]},${fg[2]},${a.toFixed(3)})`;
          octx.fillRect(
            x,
            r * cellSize,
            Math.max(0.5, colW - gap),
            cellSize - cellGap
          );
        }
      }
    };

    const sweepX = (now: number) => {
      if (sweepStart < 0) return w;
      const p = (now - sweepStart) / sweepDur;
      if (p >= 1) {
        sweepStart = -1;
        return w;
      }
      const from = sweepFromFrac * w;
      return from + (w - from) * glideEase(p);
    };

    const draw = (now: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (w <= 0 || h <= 0) return;
      const sx = Math.max(0, Math.min(w, sweepX(now)));
      // CA backdrop revealed by clip-rect sweep (source-rect blit)
      if (sx > 0.5 && off.width > 1) {
        ctx.drawImage(off, 0, 0, sx * dpr, off.height, 0, 0, sx, h);
      }
      // polyline drawn via dash-offset technique
      const n = cur.length;
      if (n >= 2 && pathLen > 0) {
        const frac = sx / w;
        if (frac > 0.001) {
          ctx.beginPath();
          ctx.moveTo(xs[0] ?? 0, ys[0] ?? 0);
          for (let i = 1; i < n; i++) ctx.lineTo(xs[i] ?? 0, ys[i] ?? 0);
          ctx.strokeStyle = `rgb(${ac[0]},${ac[1]},${ac[2]})`;
          ctx.lineWidth = strokeWidth;
          ctx.lineJoin = "round";
          ctx.lineCap = "round";
          if (frac < 1) ctx.setLineDash([pathLen * frac, pathLen]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      // scrub hairline + snapped point marker
      if (alpha > 0.01 && n > 0 && ai >= 0) {
        const cx = Math.round(hx) + 0.5;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = `rgba(${mu[0]},${mu[1]},${mu[2]},0.7)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, h);
        ctx.stroke();
        ctx.fillStyle = `rgb(${ac[0]},${ac[1]},${ac[2]})`;
        ctx.beginPath();
        ctx.arc(xs[ai] ?? 0, ys[ai] ?? 0, strokeWidth + 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    };

    const springActive = () =>
      targetAlpha > 0 && (Math.abs(tx - hx) > 0.3 || Math.abs(hv) > 3);
    const active = () =>
      sweepStart >= 0 || springActive() || Math.abs(targetAlpha - alpha) > 0.01;

    const loop = (now: number) => {
      const dt = Math.min(0.05, last === 0 ? 1 / 60 : (now - last) / 1000);
      last = now;
      // critically damped spring toward the snapped target
      const a = K * (tx - hx) - C * hv;
      hv += a * dt;
      hx += hv * dt;
      if (!springActive() && targetAlpha > 0) {
        hx = tx;
        hv = 0;
      }
      alpha += (targetAlpha - alpha) * Math.min(1, dt * 14);
      if (Math.abs(targetAlpha - alpha) <= 0.01) alpha = targetAlpha;
      draw(now);
      if (active()) {
        raf = requestAnimationFrame(loop);
      } else {
        // genuinely idle: no rAF at rest — draw once settled, then stop
        raf = 0;
        last = 0;
        draw(now);
      }
    };
    const wake = () => {
      if (raf === 0 && !reduced) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const updateReadout = () => {
      const show = targetAlpha > 0 && ai >= 0 && ai < cur.length;
      if (show && (readoutAi !== ai || !readoutShown)) {
        readoutAi = ai;
        const val = formatRef.current(cur[ai] ?? 0, ai);
        readout.textContent = val;
        root.setAttribute("aria-label", `${ariaLabelRef.current}, ${val}`);
        const rw = readout.offsetWidth;
        const x = Math.max(0, Math.min(w - rw, (xs[ai] ?? 0) - rw / 2));
        readout.style.transform = `translateX(${x.toFixed(1)}px)`;
      }
      if (show !== readoutShown) {
        readoutShown = show;
        readout.style.opacity = show ? "1" : "0";
        if (!show) root.setAttribute("aria-label", ariaLabelRef.current);
      }
    };

    const setActive = (i: number, show: boolean) => {
      const n = cur.length;
      if (n === 0 || w <= 0) return;
      ai = Math.max(0, Math.min(n - 1, i));
      tx = xs[ai] ?? 0;
      targetAlpha = show ? 1 : 0;
      updateReadout();
      if (reduced) {
        hx = tx;
        hv = 0;
        alpha = targetAlpha;
        draw(performance.now());
      } else {
        wake();
      }
    };

    const rebuild = () => {
      computeCA();
      computeGeometry();
      paintOffscreen();
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      rebuild();
      if (ai >= 0) {
        tx = xs[ai] ?? 0;
        readoutAi = -1; // reposition the readout against the new geometry
        updateReadout();
      }
      if (raf === 0) draw(performance.now());
    };
    // arm the entrance BEFORE the first paint so frame 0 renders at sweep≈0
    // (no one-frame flash of the finished texture)
    if (!reduced && entranceMs > 0) {
      sweepFromFrac = 0;
      sweepDur = entranceMs;
      sweepStart = performance.now();
    }
    resize();

    const samePrefix = (a: number[], b: number[]) => {
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
      return true;
    };

    const setData = (d: number[]) => {
      if (d === cur) return;
      const prev = cur;
      const prevRule = rule;
      cur = d;
      const picked = volatilityRule(cur);
      // tail push: same prefix, same rule bucket → extrude only new columns
      const isTail =
        prev.length > 0 &&
        cur.length > prev.length &&
        picked.rule === prevRule &&
        gens.length === prev.length &&
        rows > 0 &&
        samePrefix(prev, cur);
      if (isTail) {
        rule = picked.rule;
        let row = gens[gens.length - 1] ?? seedRow(rows, cur[0] ?? 0);
        for (let i = prev.length; i < cur.length; i++) {
          row = nextGen(row, rule);
          gens.push(row);
        }
        computeGeometry();
        paintOffscreen();
      } else {
        rebuild();
      }
      if (ai >= cur.length) ai = cur.length - 1;
      if (ai >= 0) {
        tx = xs[ai] ?? 0;
        readoutAi = -1; // force readout refresh
        updateReadout();
      }
      if (reduced || w <= 0) {
        draw(performance.now());
        return;
      }
      // 200ms sweep over the new tail only (full width on replacement)
      sweepFromFrac =
        isTail && cur.length > 1 ? (prev.length - 1) / (cur.length - 1) : 0;
      sweepDur = 200;
      sweepStart = performance.now();
      wake();
    };
    engineRef.current = { setData };

    // -- entrance: 900ms left→right reveal, skipped under reduced motion ----
    if (!reduced && entranceMs > 0) wake();

    // -- events -------------------------------------------------------------
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const n = cur.length;
      if (n === 0 || rect.width <= 0) return;
      const x = e.clientX - rect.left;
      setActive(Math.round((x / rect.width) * (n - 1)), true);
    };
    const onLeave = () => {
      targetAlpha = 0;
      updateReadout();
      if (reduced) {
        alpha = 0;
        draw(performance.now());
      } else {
        wake();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const step = e.key === "ArrowLeft" ? -1 : 1;
      setActive((ai < 0 ? cur.length - 1 : ai) + step, true);
    };
    const onBlur = () => onLeave();
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerdown", onMove);
    root.addEventListener("pointerleave", onLeave);
    root.addEventListener("keydown", onKey);
    root.addEventListener("blur", onBlur);

    const ro = new ResizeObserver(resize);
    ro.observe(root);
    // live theme re-derive: repaint the cached CA in the new ink
    const mo = new MutationObserver(() => {
      derive();
      paintOffscreen();
      if (raf === 0) draw(performance.now());
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerdown", onMove);
      root.removeEventListener("pointerleave", onLeave);
      root.removeEventListener("keydown", onKey);
      root.removeEventListener("blur", onBlur);
      engineRef.current = null;
    };
  }, [cellSize, entranceMs, strokeWidth]);

  useEffect(() => {
    dataRef.current = data;
    engineRef.current?.setData(data);
  }, [data]);

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={ariaLabel}
      tabIndex={0}
      style={{ touchAction: "pan-y" }}
      className={`relative w-full cursor-crosshair overflow-hidden rounded-sm outline-none transition-colors duration-200 hover:bg-foreground/[0.03] focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent ${className}`}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 h-full w-full"
      />
      <div
        ref={readoutRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none absolute left-0 top-0.5 rounded-sm border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-foreground opacity-0 transition-opacity duration-150"
      />
    </div>
  );
}
