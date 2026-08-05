"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// ChartBarDither — the dithered-chart family's bar chart, and the family's
// first CANVAS member (chart-bar-halftone/-donut-halftone are SVG patterns;
// this one and its three siblings render pixels directly, per the owner's
// call that a raster dither can do something a discrete vector pattern
// cannot: continuous, ANIMATED ink resolution). Ink density still carries
// the value redundantly with bar height, but the mechanic here is a real
// interaction, not a static plate: bars rest at a coarse 7px dither cell —
// a deliberately loose print — and the hovered/focused bar's cell size
// eases down to a fine 2px over ~360ms, a literal focus-pull from a rough
// proof to a resolved print, while every other bar eases back up to coarse.
// Density is still the only value channel (var(--foreground) ink on
// var(--background) paper, --ns-accent reserved for focus only, matching
// heatmap-year-stipple's precedent) — the focus-pull changes RESOLUTION,
// never hue, so the family's colour rule survives untouched.
// ---------------------------------------------------------------------------

export interface ChartBarDitherDatum {
  label: string;
  value: number;
}

export interface ChartBarDitherProps {
  data?: ChartBarDitherDatum[];
  /** chart title, used as the figure's accessible name and table caption */
  title?: string;
  className?: string;
}

// 4x4 Bayer matrix — the family's shared dither constant, raw 0..15 ints
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const LEVELS = 16;

const COARSE_CELL = 7;
const FINE_CELL = 2;
const LERP_EPS = 0.05;

const BAR_W = 22;
const SLOT_W = 58;
const PLOT_H = 220;
const TOP_PAD = 34;
const AXIS_H = 8;
const LABEL_H = 22;
const LEFT_PAD = 12;
const RIGHT_PAD = 12;
const ENTRANCE_MS = 480;
const ENTRANCE_STAGGER = 45;

function levelFor(norm: number): number {
  return Math.round(Math.min(1, Math.max(0, norm)) * LEVELS);
}

function formatValue(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return Math.round(v).toLocaleString();
}

function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

interface Tokens {
  fg: string;
  bg: string;
  muted: string;
  border: string;
  accent: string;
}

function readTokens(): Tokens {
  const cs = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    fg: get("--foreground", "#171717"),
    bg: get("--background", "#ffffff"),
    muted: get("--ns-muted", "#4d4d4d"),
    border: get("--border", "#ebebeb"),
    accent: get("--ns-accent", "#006bff"),
  };
}

function useTokens(): Tokens {
  const [tokens, setTokens] = useState<Tokens>(() =>
    typeof document === "undefined"
      ? { fg: "#171717", bg: "#ffffff", muted: "#4d4d4d", border: "#ebebeb", accent: "#006bff" }
      : readTokens()
  );
  useEffect(() => {
    const sync = () => setTokens(readTokens());
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
    return () => mo.disconnect();
  }, []);
  return tokens;
}

/** Rounded-top, square-baseline bar path, rendered with an ordered-dither
 *  fill clipped to it — cell size controls print resolution, not colour. */
function paintBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  yTop: number,
  yBase: number,
  w: number,
  r: number,
  level: number,
  cell: number,
  ink: string
) {
  const rr = Math.min(r, w / 2, Math.max(0, yBase - yTop));
  ctx.save();
  ctx.beginPath();
  if (rr <= 0.01) {
    ctx.rect(x, yTop, w, yBase - yTop);
  } else {
    ctx.moveTo(x, yBase);
    ctx.lineTo(x, yTop + rr);
    ctx.quadraticCurveTo(x, yTop, x + rr, yTop);
    ctx.lineTo(x + w - rr, yTop);
    ctx.quadraticCurveTo(x + w, yTop, x + w, yTop + rr);
    ctx.lineTo(x + w, yBase);
    ctx.closePath();
  }
  ctx.clip();

  ctx.fillStyle = ink;
  const startCol = Math.floor(x / cell);
  const endCol = Math.ceil((x + w) / cell);
  const startRow = Math.floor(yTop / cell);
  const endRow = Math.ceil(yBase / cell);
  for (let gy = startRow; gy < endRow; gy++) {
    for (let gx = startCol; gx < endCol; gx++) {
      const idx = (((gy % 4) + 4) % 4) * 4 + (((gx % 4) + 4) % 4);
      if (BAYER[idx] < level) {
        ctx.fillRect(gx * cell, gy * cell, cell, cell);
      }
    }
  }
  ctx.restore();
}

export function ChartBarDither({ data = [], title = "Chart", className = "" }: ChartBarDitherProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tokens = useTokens();
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const uidRef = useRef(`cbd-${Math.random().toString(36).slice(2, 8)}`);
  const uid = uidRef.current;

  const reducedRef = useRef(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      reducedRef.current = mq.matches;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const n = data.length;
  const maxValue = useMemo(() => Math.max(1, ...data.map((d) => d.value)), [data]);
  const viewW = LEFT_PAD + n * SLOT_W + RIGHT_PAD;
  const viewH = TOP_PAD + PLOT_H + AXIS_H + LABEL_H;
  const baseY = TOP_PAD + PLOT_H;

  const bars = useMemo(
    () =>
      data.map((d, i) => {
        const norm = d.value / maxValue;
        const x = LEFT_PAD + i * SLOT_W + (SLOT_W - BAR_W) / 2;
        const h = PLOT_H * norm;
        const yTop = baseY - h;
        return { ...d, index: i, x, yTop, level: levelFor(norm) };
      }),
    [data, maxValue, baseY]
  );

  const focusBar = (i: number) => {
    if (i < 0 || i >= n) return;
    setActiveIndex(i);
    document.getElementById(`${uid}-hit-${i}`)?.focus();
  };

  // per-bar animated dither cell size (the focus-pull), plus a per-bar
  // mount-entrance progress; both driven by one rAF loop, refs so the draw
  // loop never re-subscribes to React state.
  const cellRef = useRef<number[]>([]);
  const mountAtRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    cellRef.current = bars.map(() => COARSE_CELL);
    mountAtRef.current = performance.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = viewW * dpr;
    canvas.height = viewH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const draw = () => {
      ctx.clearRect(0, 0, viewW, viewH);

      ctx.strokeStyle = tokens.border;
      ctx.lineWidth = 1;
      [0, 0.25, 0.5, 0.75, 1].forEach((f) => {
        const y = Math.round(baseY - PLOT_H * f) + 0.5;
        ctx.beginPath();
        ctx.moveTo(LEFT_PAD, y);
        ctx.lineTo(viewW - RIGHT_PAD, y);
        ctx.stroke();
      });

      let stillAnimating = false;
      const now = performance.now();

      bars.forEach((b, i) => {
        const delay = i * ENTRANCE_STAGGER;
        const t = reducedRef.current ? 1 : Math.min(1, Math.max(0, (now - mountAtRef.current - delay) / ENTRANCE_MS));
        if (t < 1) stillAnimating = true;
        const grow = easeOutExpo(t);

        const target = hoverIndex === i ? FINE_CELL : COARSE_CELL;
        const cur = cellRef.current[i] ?? COARSE_CELL;
        const next = reducedRef.current ? target : cur + (target - cur) * 0.22;
        cellRef.current[i] = Math.abs(next - target) < LERP_EPS ? target : next;
        if (Math.abs(cellRef.current[i] - target) >= LERP_EPS) stillAnimating = true;

        const yTop = baseY - (baseY - b.yTop) * grow;
        paintBar(ctx, b.x, yTop, baseY, BAR_W, 4, b.level, cellRef.current[i], tokens.fg);

        ctx.font = `9.5px "GeistMono", ui-monospace, monospace`;
        ctx.textAlign = "center";
        ctx.fillStyle = tokens.fg;
        ctx.globalAlpha = grow;
        ctx.fillText(formatValue(b.value), b.x + BAR_W / 2, yTop - 8);
        ctx.globalAlpha = 1;
        ctx.fillStyle = tokens.muted;
        ctx.fillText(b.label, b.x + BAR_W / 2, baseY + AXIS_H + LABEL_H - 7);
      });

      ctx.strokeStyle = tokens.border;
      ctx.beginPath();
      ctx.moveTo(LEFT_PAD, baseY + 0.5);
      ctx.lineTo(viewW - RIGHT_PAD, baseY + 0.5);
      ctx.stroke();

      if (stillAnimating && !reducedRef.current) {
        rafRef.current = requestAnimationFrame(draw);
      }
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
    // hoverIndex/activeIndex intentionally retrigger a fresh draw+lerp pass
  }, [bars, tokens, viewW, viewH, baseY, hoverIndex, activeIndex]);

  const hovered = hoverIndex ?? null;

  return (
    <figure className={`ns-cbd inline-block ${className}`} aria-label={`${title}, bar chart`}>
      <style>{CSS}</style>
      <div className="flex items-center justify-between gap-3 pb-2">
        <span className="font-mono text-xs tracking-widest text-ns-muted">{title.toUpperCase()}</span>
        <button
          type="button"
          onClick={() => setShowTable((s) => !s)}
          className="ns-cbd-toggle rounded-sm border border-border px-2 py-1 font-mono text-[10px] tracking-widest text-ns-muted transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          aria-pressed={showTable}
        >
          {showTable ? "VIEW CHART" : "VIEW TABLE"}
        </button>
      </div>

      {showTable ? (
        <table className="ns-cbd-table w-full border-collapse font-mono text-xs">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr>
              <th scope="col" className="border-b border-border px-2 py-1.5 text-left text-ns-muted">
                Category
              </th>
              <th scope="col" className="border-b border-border px-2 py-1.5 text-right text-ns-muted tabular-nums">
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label}>
                <td className="border-b border-border px-2 py-1.5 text-foreground">{d.label}</td>
                <td className="border-b border-border px-2 py-1.5 text-right text-foreground tabular-nums">
                  {d.value.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative" style={{ width: viewW, maxWidth: "100%" }}>
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            style={{ width: viewW, height: viewH, maxWidth: "100%", display: "block" }}
          />

          {bars.map((b) => (
            <button
              key={b.label}
              type="button"
              id={`${uid}-hit-${b.index}`}
              tabIndex={activeIndex === b.index ? 0 : -1}
              aria-label={`${b.label}: ${b.value.toLocaleString()}`}
              className="ns-cbd-hit absolute cursor-pointer border-0 bg-transparent p-0 outline-none"
              style={{
                left: b.x + BAR_W / 2 - SLOT_W / 2,
                top: TOP_PAD - 12,
                width: SLOT_W,
                height: PLOT_H + 12,
              }}
              onPointerEnter={() => setHoverIndex(b.index)}
              onPointerLeave={() => setHoverIndex((c) => (c === b.index ? null : c))}
              onFocus={() => {
                setActiveIndex(b.index);
                setHoverIndex(b.index);
              }}
              onBlur={() => setHoverIndex((c) => (c === b.index ? null : c))}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  focusBar(b.index - 1);
                } else if (e.key === "ArrowRight") {
                  e.preventDefault();
                  focusBar(b.index + 1);
                }
              }}
            />
          ))}

          {hovered !== null && bars[hovered] && (
            <div
              aria-hidden="true"
              className="ns-cbd-tip pointer-events-none absolute z-10 rounded-sm border border-border bg-background px-2 py-1 font-mono text-[11px] shadow-sm"
              style={{
                left: `${((bars[hovered].x + BAR_W / 2) / viewW) * 100}%`,
                top: `${(Math.max(0, bars[hovered].yTop - 34) / viewH) * 100}%`,
                transform: "translateX(-50%)",
              }}
            >
              <strong className="text-foreground">{formatValue(bars[hovered].value)}</strong>{" "}
              <span className="text-ns-muted">{bars[hovered].label}</span>
            </div>
          )}
        </div>
      )}
    </figure>
  );
}

const CSS = `
.ns-cbd-hit { touch-action: manipulation; }
.ns-cbd-hit:focus-visible { outline: 2px solid var(--ns-accent); outline-offset: 2px; }
`;
