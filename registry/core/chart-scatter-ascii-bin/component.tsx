"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// ChartScatterAsciiBin — a scatter plot rendered as a glyph-density grid
// (no scatter or hexbin exists anywhere in this registry — histogram-live-
// grain bins one dimension into falling grains, stem-and-leaf-live keeps
// every raw digit, chart-bar-dither is one categorical series; none of the
// three bins two continuous dimensions at once). Every point is binned into
// a coarse cell grid and each cell's glyph comes from the family's shared
// 10-step ASCII ramp (" .:-=+*#%@") scaled to that cell's point count — a
// static print of the joint distribution.
//
// The mechanic: a circular brush follows the pointer (or a focused, arrow-
// key-steerable hit target for keyboard users) and LIVE re-bins — not the
// grid cells, the raw points themselves, by exact distance to the brush
// centre — so the readout ("N pts selected, mean x/y") is exact, not a cell
// count. Every cell whose glyph is currently touched by the brush relinks
// to var(--ns-accent) ink in place, which is the only colour anywhere in the
// piece and reserved for the live interaction the same way chart-bar-dither
// reserves it for keyboard focus. Nothing else in the registry re-bins
// against a live pointer radius.
// ---------------------------------------------------------------------------

const RAMP = " .:-=+*#%@";

export interface ScatterPoint {
  x: number;
  y: number;
}

export interface ChartScatterAsciiBinProps {
  /** synthetic sample; x/y in arbitrary plot units, any range */
  data?: ScatterPoint[];
  title?: string;
  /** brush radius in plot px */
  brushRadius?: number;
  className?: string;
}

const COLS = 42;
const ROWS = 20;
const CELL = 13;
const LEFT_PAD = 34;
const TOP_PAD = 20;
const BOTTOM_PAD = 30;
const RIGHT_PAD = 12;
const PLOT_W = COLS * CELL;
const PLOT_H = ROWS * CELL;
const ENTRANCE_MS = 320;

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

function useReducedMotion(): boolean {
  const ref = useRef(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      ref.current = mq.matches;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return ref.current;
}

// deterministic two-cluster synthetic sample — clearly fabricated demo data
function defaultSample(): ScatterPoint[] {
  const pts: ScatterPoint[] = [];
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const gauss = () => {
    let u = 0;
    let v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  for (let i = 0; i < 140; i++) {
    pts.push({ x: 30 + gauss() * 14, y: 65 + gauss() * 10 });
  }
  for (let i = 0; i < 90; i++) {
    pts.push({ x: 74 + gauss() * 10, y: 30 + gauss() * 12 });
  }
  return pts;
}

export function ChartScatterAsciiBin({
  data,
  title = "Sample distribution",
  brushRadius = 46,
  className = "",
}: ChartScatterAsciiBinProps) {
  const points = useMemo(() => data ?? defaultSample(), [data]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hitRef = useRef<HTMLDivElement>(null);
  const tokens = useTokens();
  const reduced = useReducedMotion();
  const rafRef = useRef(0);
  const mountAtRef = useRef(0);

  const [brush, setBrush] = useState<{ x: number; y: number } | null>(null);
  const brushRef = useRef(brush);
  brushRef.current = brush;

  const xMin = useMemo(() => Math.min(...points.map((p) => p.x)), [points]);
  const xMax = useMemo(() => Math.max(...points.map((p) => p.x)), [points]);
  const yMin = useMemo(() => Math.min(...points.map((p) => p.y)), [points]);
  const yMax = useMemo(() => Math.max(...points.map((p) => p.y)), [points]);
  const xSpan = Math.max(1e-6, xMax - xMin);
  const ySpan = Math.max(1e-6, yMax - yMin);

  const toPx = (p: ScatterPoint) => ({
    px: ((p.x - xMin) / xSpan) * PLOT_W,
    // screen y grows downward; plot y should grow upward
    py: PLOT_H - ((p.y - yMin) / ySpan) * PLOT_H,
  });

  const plotPoints = useMemo(() => points.map(toPx), [points, xMin, xSpan, yMin, ySpan]);

  const cellCounts = useMemo(() => {
    const counts = new Uint16Array(COLS * ROWS);
    for (const { px, py } of plotPoints) {
      const cx = Math.min(COLS - 1, Math.max(0, Math.floor(px / CELL)));
      const cy = Math.min(ROWS - 1, Math.max(0, Math.floor(py / CELL)));
      counts[cy * COLS + cx]++;
    }
    return counts;
  }, [plotPoints]);
  const maxCount = useMemo(() => Math.max(1, ...cellCounts), [cellCounts]);

  const selection = useMemo(() => {
    if (!brush) return null;
    let n = 0;
    let sx = 0;
    let sy = 0;
    for (const { px, py } of plotPoints) {
      const dx = px - brush.x;
      const dy = py - brush.y;
      if (dx * dx + dy * dy <= brushRadius * brushRadius) {
        n++;
        sx += px;
        sy += py;
      }
    }
    if (n === 0) return { n: 0, meanX: 0, meanY: 0 };
    // back to data units for the readout
    const mpx = sx / n;
    const mpy = sy / n;
    const meanX = xMin + (mpx / PLOT_W) * xSpan;
    const meanY = yMin + (1 - mpy / PLOT_H) * ySpan;
    return { n, meanX, meanY };
  }, [brush, brushRadius, plotPoints, xMin, xSpan, yMin, ySpan]);

  useEffect(() => {
    mountAtRef.current = performance.now();
  }, [points]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const viewW = LEFT_PAD + PLOT_W + RIGHT_PAD;
    const viewH = TOP_PAD + PLOT_H + BOTTOM_PAD;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = viewW * dpr;
    canvas.height = viewH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const draw = () => {
      const now = performance.now();
      const t = reduced ? 1 : Math.min(1, (now - mountAtRef.current) / ENTRANCE_MS);
      ctx.clearRect(0, 0, viewW, viewH);

      ctx.strokeStyle = tokens.border;
      ctx.lineWidth = 1;
      ctx.strokeRect(LEFT_PAD + 0.5, TOP_PAD + 0.5, PLOT_W, PLOT_H);

      ctx.font = `${CELL - 3}px "GeistMono", ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const bx = brushRef.current;
      const r2 = brushRadius * brushRadius;

      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          const count = cellCounts[row * COLS + col];
          if (count === 0) continue;
          const level = Math.min(RAMP.length - 1, Math.round((count / maxCount) * (RAMP.length - 1)));
          const ch = RAMP[level];
          if (ch === " ") continue;
          const cx = LEFT_PAD + col * CELL + CELL / 2;
          const cy = TOP_PAD + row * CELL + CELL / 2;
          const dx = cx - LEFT_PAD - (bx?.x ?? -9999);
          const dy = cy - TOP_PAD - (bx?.y ?? -9999);
          const inBrush = bx !== null && dx * dx + dy * dy <= r2;
          ctx.fillStyle = inBrush ? tokens.accent : tokens.fg;
          ctx.globalAlpha = t;
          ctx.fillText(ch, cx, cy);
          ctx.globalAlpha = 1;
        }
      }

      if (bx) {
        ctx.strokeStyle = tokens.accent;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(LEFT_PAD + bx.x, TOP_PAD + bx.y, brushRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // axis ticks
      ctx.fillStyle = tokens.muted;
      ctx.font = `9px "GeistMono", ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.fillText(xMin.toFixed(0), LEFT_PAD, TOP_PAD + PLOT_H + 14);
      ctx.fillText(xMax.toFixed(0), LEFT_PAD + PLOT_W, TOP_PAD + PLOT_H + 14);
      ctx.save();
      ctx.textAlign = "right";
      ctx.fillText(yMax.toFixed(0), LEFT_PAD - 6, TOP_PAD + 4);
      ctx.fillText(yMin.toFixed(0), LEFT_PAD - 6, TOP_PAD + PLOT_H);
      ctx.restore();

      if (t < 1 && !reduced) rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [cellCounts, maxCount, tokens, reduced, brush, brushRadius, xMin, xMax, yMin, yMax]);

  const setBrushFromEvent = (e: { clientX: number; clientY: number }) => {
    const el = hitRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setBrush({ x: Math.min(PLOT_W, Math.max(0, x)), y: Math.min(PLOT_H, Math.max(0, y)) });
  };

  const step = CELL;
  const keyMove = (dx: number, dy: number) => {
    setBrush((cur) => {
      const base = cur ?? { x: PLOT_W / 2, y: PLOT_H / 2 };
      return {
        x: Math.min(PLOT_W, Math.max(0, base.x + dx)),
        y: Math.min(PLOT_H, Math.max(0, base.y + dy)),
      };
    });
  };

  return (
    <figure className={`ns-csab inline-block ${className}`} aria-label={`${title}, scatter plot`}>
      <style>{CSS}</style>
      <div className="flex items-center justify-between gap-3 pb-2">
        <span className="font-mono text-xs tracking-widest text-ns-muted">{title.toUpperCase()}</span>
        <span className="font-mono text-[11px] text-ns-muted tabular-nums" aria-live="off">
          {selection ? `${selection.n} pts · mean (${selection.meanX.toFixed(1)}, ${selection.meanY.toFixed(1)})` : `${points.length} pts total`}
        </span>
      </div>
      <div className="relative" style={{ width: LEFT_PAD + PLOT_W + RIGHT_PAD, maxWidth: "100%" }}>
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          style={{
            width: LEFT_PAD + PLOT_W + RIGHT_PAD,
            height: TOP_PAD + PLOT_H + BOTTOM_PAD,
            maxWidth: "100%",
            display: "block",
          }}
        />
        <div
          ref={hitRef}
          role="button"
          tabIndex={0}
          aria-label="Brush the scatter plot: drag or use arrow keys to select nearby points"
          className="ns-csab-hit absolute cursor-crosshair rounded-sm outline-none"
          style={{ left: LEFT_PAD, top: TOP_PAD, width: PLOT_W, height: PLOT_H }}
          onPointerMove={(e) => setBrushFromEvent(e)}
          onPointerDown={(e) => setBrushFromEvent(e)}
          onPointerLeave={() => setBrush(null)}
          onFocus={() => setBrush((c) => c ?? { x: PLOT_W / 2, y: PLOT_H / 2 })}
          onBlur={() => setBrush(null)}
          onKeyDown={(e) => {
            const d = e.shiftKey ? step * 3 : step;
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              keyMove(-d, 0);
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              keyMove(d, 0);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              keyMove(0, -d);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              keyMove(0, d);
            } else if (e.key === "Escape") {
              setBrush(null);
            }
          }}
        />
      </div>
    </figure>
  );
}

const CSS = `
.ns-csab-hit:focus-visible { outline: 2px solid var(--ns-accent); outline-offset: 2px; }
`;
