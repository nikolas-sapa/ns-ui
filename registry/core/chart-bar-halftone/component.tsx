"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// ChartBarHalftone — the dithered-chart family's bar chart. Bar fills are not
// flat color: each bar is a plate stamped with the SAME 4x4 Bayer matrix used
// by background-ascii-dither and ascii-engraving-contour elsewhere in this
// suite (the family's shared ordered-dither ramp — 17 discrete ink levels,
// 0 = empty, 16 = solid), so a bar's height is redundant with its own ink
// density: cover one channel and the other still carries the value. Density
// is the family's only value channel — pure var(--foreground) ink on
// var(--background) paper, no --ns-accent in the data itself, exactly like
// heatmap-year-stipple's choice. --ns-accent is reserved for keyboard focus,
// same convention as every other component in the suite.
//
// Bars are SVG paths filled with `url(#pattern)`, one pattern per ink level,
// so var(--foreground)/var(--background)/var(--border) resolve as ordinary
// CSS custom properties on presentation attributes — no canvas, no
// getComputedStyle, no theme MutationObserver: the browser's own cascade
// repaints both themes correctly on toggle for free.
// ---------------------------------------------------------------------------

export interface ChartBarHalftoneDatum {
  label: string;
  value: number;
}

export interface ChartBarHalftoneProps {
  data?: ChartBarHalftoneDatum[];
  /** chart title, used as the figure's accessible name and table caption */
  title?: string;
  className?: string;
}

// 4x4 Bayer matrix — the family's shared dither constant, raw 0..15 ints
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const LEVELS = 16; // 17 discrete steps, 0..16
const CELL = 4; // px per dither cell, shared pattern tile is 4x4 cells

const BAR_W = 22; // <=24px per the mark spec
const SLOT_W = 58;
const PLOT_H = 220;
const TOP_PAD = 34; // room for the tip label above the tallest bar
const AXIS_H = 8;
const LABEL_H = 22;
const LEFT_PAD = 12;
const RIGHT_PAD = 12;

function levelFor(norm: number): number {
  return Math.round(Math.min(1, Math.max(0, norm)) * LEVELS);
}

function formatValue(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return Math.round(v).toLocaleString();
}

/** rounded-top, square-baseline bar path, per the mark spec */
function barPath(x: number, yTop: number, yBase: number, w: number, r: number): string {
  const rr = Math.min(r, w / 2, Math.max(0, yBase - yTop));
  if (rr <= 0.01) return `M${x},${yBase} L${x},${yTop} L${x + w},${yTop} L${x + w},${yBase} Z`;
  return [
    `M${x},${yBase}`,
    `L${x},${yTop + rr}`,
    `Q${x},${yTop} ${x + rr},${yTop}`,
    `L${x + w - rr},${yTop}`,
    `Q${x + w},${yTop} ${x + w},${yTop + rr}`,
    `L${x + w},${yBase}`,
    `Z`,
  ].join(" ");
}

export function ChartBarHalftone({ data = [], title = "Chart", className = "" }: ChartBarHalftoneProps) {
  const uid = useId().replace(/[:]/g, "");
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      setEntered(true);
      return;
    }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
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

  const hovered = hoverIndex ?? null;

  return (
    <figure className={`ns-cbh inline-block ${className}`} aria-label={`${title}, bar chart`}>
      <style>{CSS}</style>
      <div className="flex items-center justify-between gap-3 pb-2">
        <span className="font-mono text-xs tracking-widest text-ns-muted">{title.toUpperCase()}</span>
        <button
          type="button"
          onClick={() => setShowTable((s) => !s)}
          className="ns-cbh-toggle rounded-sm border border-border px-2 py-1 font-mono text-[10px] tracking-widest text-ns-muted transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          aria-pressed={showTable}
        >
          {showTable ? "VIEW CHART" : "VIEW TABLE"}
        </button>
      </div>

      {showTable ? (
        <table className="ns-cbh-table w-full border-collapse font-mono text-xs">
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
        <div className="relative">
          <svg
            viewBox={`0 0 ${viewW} ${viewH}`}
            width={viewW}
            style={{ maxWidth: "100%" }}
            focusable="false"
            role="presentation"
          >
            <defs>
              {Array.from({ length: LEVELS + 1 }, (_, level) => (
                <pattern
                  key={level}
                  id={`${uid}-p${level}`}
                  x={0}
                  y={0}
                  width={CELL * 4}
                  height={CELL * 4}
                  patternUnits="userSpaceOnUse"
                >
                  {BAYER.map((b, i) =>
                    b < level ? (
                      <rect
                        key={i}
                        x={(i % 4) * CELL}
                        y={Math.floor(i / 4) * CELL}
                        width={CELL}
                        height={CELL}
                        fill="var(--foreground)"
                      />
                    ) : null
                  )}
                </pattern>
              ))}
            </defs>

            {/* gridlines — hairline, recessive, no tick labels since every bar is direct-labeled */}
            <g aria-hidden="true">
              {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                <line
                  key={f}
                  x1={LEFT_PAD}
                  x2={viewW - RIGHT_PAD}
                  y1={baseY - PLOT_H * f}
                  y2={baseY - PLOT_H * f}
                  stroke="var(--border)"
                  strokeWidth={1}
                />
              ))}
            </g>

            {bars.map((b) => {
              const isHover = hovered === b.index;
              const path = barPath(b.x, b.yTop, baseY, BAR_W, 4);
              const cx = b.x + BAR_W / 2;
              return (
                <g
                  key={b.label}
                  className="ns-cbh-bar"
                  aria-hidden="true"
                  style={
                    {
                      transformOrigin: `${cx}px ${baseY}px`,
                      transform: entered ? "scaleY(1)" : "scaleY(0)",
                      transitionDelay: `${b.index * 45}ms`,
                    } as CSSProperties
                  }
                >
                  <path d={path} fill={`url(#${uid}-p${b.level})`} opacity={isHover ? 1 : 0.92} />
                  <text
                    x={cx}
                    y={b.yTop - 8}
                    textAnchor="middle"
                    className="font-mono"
                    style={{ fontSize: 9.5, fill: "var(--foreground)" }}
                  >
                    {formatValue(b.value)}
                  </text>
                  <text
                    x={cx}
                    y={baseY + AXIS_H + LABEL_H - 7}
                    textAnchor="middle"
                    className="font-mono"
                    style={{ fontSize: 9.5, fill: "var(--ns-muted)" }}
                  >
                    {b.label}
                  </text>
                </g>
              );
            })}

            <line
              x1={LEFT_PAD}
              x2={viewW - RIGHT_PAD}
              y1={baseY}
              y2={baseY}
              stroke="var(--border)"
              strokeWidth={1}
              aria-hidden="true"
            />

            {/* hit targets — real interactive elements, sized past the bar's own
                painted pixels per the >=24px hit-area rule */}
            {bars.map((b) => (
              <rect
                key={`hit-${b.label}`}
                id={`${uid}-hit-${b.index}`}
                role="button"
                tabIndex={activeIndex === b.index ? 0 : -1}
                aria-label={`${b.label}: ${b.value.toLocaleString()}`}
                x={b.x + BAR_W / 2 - SLOT_W / 2}
                y={TOP_PAD - 12}
                width={SLOT_W}
                height={PLOT_H + 12}
                fill="transparent"
                className="ns-cbh-hit"
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
          </svg>

          {hovered !== null && bars[hovered] && (
            <div
              aria-hidden="true"
              className="ns-cbh-tip pointer-events-none absolute z-10 rounded-sm border border-border bg-background px-2 py-1 font-mono text-[11px] shadow-sm"
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
.ns-cbh-bar { transition: transform 480ms cubic-bezier(0.16, 1, 0.3, 1); }
.ns-cbh-hit { cursor: pointer; outline: none; }
.ns-cbh-hit:focus-visible { outline: 2px solid var(--ns-accent); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .ns-cbh-bar { transition: none; }
}
`;
