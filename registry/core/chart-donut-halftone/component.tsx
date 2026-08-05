"use client";

import { useEffect, useId, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// ChartDonutHalftone — the dithered-chart family's part-to-whole chart. The
// backlog flags pie/donut as a form to build "only with a real reason": the
// dataviz heuristic says bar beats pie for almost every job, and a donut
// whose slice DENSITY re-encoded its own share would be the textbook
// anti-pattern (a value-ramp on a channel that already shows the value via
// angle). The reason here is that the segments are ORDINAL — a small, fixed
// size-tier scale — not nominal categories. Angle still carries the only
// magnitude channel (share of the whole); density carries the tier's
// POSITION in the size scale (S sparsest -> XL densest), the same "one hue,
// monotone lightness steps" idea the dataviz skill prescribes for an ordinal
// ramp, translated into ink density instead of lightness. The two channels
// encode two different facts, so nothing is double-encoded.
//
// Same shared constant as chart-bar-halftone: the 4x4 Bayer matrix already
// used by background-ascii-dither and ascii-engraving-contour, stamped into
// 17 discrete ink-level patterns (0 empty, 16 solid) and duplicated verbatim
// here so both chart-family members produce byte-identical density at the
// same level. Pure var(--foreground) ink on var(--background) paper, no
// --ns-accent in the data channel, --ns-accent reserved for keyboard focus only —
// the family's colour decision, matching heatmap-year-stipple's precedent.
// ---------------------------------------------------------------------------

export interface ChartDonutHalftoneDatum {
  label: string;
  value: number;
}

export interface ChartDonutHalftoneProps {
  /** ordinal, low -> high tier order (e.g. size tiers, funnel stages) */
  data?: ChartDonutHalftoneDatum[];
  title?: string;
  /** unit suffix appended to the center readout, e.g. "orders" */
  unit?: string;
  className?: string;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const LEVELS = 16;
const CELL = 4;

const SIZE = 240;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUTER = 96;
const R_INNER = 56;
const GAP_RAD = 0.035;
const EXPLODE_PX = 6;

function ordinalLevel(rank: number, total: number): number {
  if (total <= 1) return LEVELS;
  return Math.round((rank / (total - 1)) * LEVELS);
}

// rounded to 3 decimals: Math.cos/sin can differ by a ULP between Node (SSR)
// and the browser's engine (CSR), which otherwise surfaces as a hydration
// mismatch in the serialized `d` string despite both being "correct"
function r3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function polar(r: number, angle: number) {
  return { x: r3(CX + r * Math.cos(angle)), y: r3(CY + r * Math.sin(angle)) };
}

function wedgePath(rOuter: number, rInner: number, a0: number, a1: number): string {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const p0o = polar(rOuter, a0);
  const p1o = polar(rOuter, a1);
  const p1i = polar(rInner, a1);
  const p0i = polar(rInner, a0);
  return [
    `M${p0o.x},${p0o.y}`,
    `A${rOuter},${rOuter} 0 ${large} 1 ${p1o.x},${p1o.y}`,
    `L${p1i.x},${p1i.y}`,
    `A${rInner},${rInner} 0 ${large} 0 ${p0i.x},${p0i.y}`,
    `Z`,
  ].join(" ");
}

function formatValue(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return Math.round(v).toLocaleString();
}

export function ChartDonutHalftone({
  data = [],
  title = "Chart",
  unit = "",
  className = "",
}: ChartDonutHalftoneProps) {
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

  const total = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data]);

  const wedges = useMemo(() => {
    let angle = -Math.PI / 2;
    return data.map((d, i) => {
      const frac = total > 0 ? d.value / total : 0;
      const sweep = frac * Math.PI * 2;
      const a0 = angle;
      const a1 = angle + sweep;
      angle = a1;
      const insetA0 = sweep > GAP_RAD * 2.2 ? a0 + GAP_RAD / 2 : a0;
      const insetA1 = sweep > GAP_RAD * 2.2 ? a1 - GAP_RAD / 2 : a1;
      const mid = (insetA0 + insetA1) / 2;
      return {
        ...d,
        index: i,
        a0: insetA0,
        a1: insetA1,
        mid,
        frac,
        level: ordinalLevel(i, data.length),
      };
    });
  }, [data, total]);

  const focusWedge = (i: number) => {
    if (i < 0 || i >= data.length) return;
    setActiveIndex(i);
    document.getElementById(`${uid}-w-${i}`)?.focus();
  };

  const shown = hoverIndex ?? null;
  const shownWedge = shown !== null ? wedges[shown] : null;
  // resting caption stays short (fits the ring's hole at any title length);
  // the fuller title already sits in the header directly above the chart
  const centerLabel = shownWedge ? shownWedge.label : unit || "total";
  const centerValue = shownWedge ? shownWedge.value : total;

  return (
    <figure className={`ns-cdh inline-flex items-center gap-6 ${className}`} aria-label={`${title}, donut chart`}>
      <style>{CSS}</style>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-xs tracking-widest text-ns-muted">{title.toUpperCase()}</span>
          <button
            type="button"
            onClick={() => setShowTable((s) => !s)}
            className="ns-cdh-toggle rounded-sm border border-border px-2 py-1 font-mono text-[10px] tracking-widest text-ns-muted transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
            aria-pressed={showTable}
          >
            {showTable ? "VIEW CHART" : "VIEW TABLE"}
          </button>
        </div>

        {showTable ? (
          <table className="ns-cdh-table border-collapse font-mono text-xs">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr>
                <th scope="col" className="border-b border-border px-2 py-1.5 text-left text-ns-muted">
                  Tier
                </th>
                <th scope="col" className="border-b border-border px-2 py-1.5 text-right text-ns-muted tabular-nums">
                  Value
                </th>
                <th scope="col" className="border-b border-border px-2 py-1.5 text-right text-ns-muted tabular-nums">
                  Share
                </th>
              </tr>
            </thead>
            <tbody>
              {wedges.map((w) => (
                <tr key={w.label}>
                  <td className="border-b border-border px-2 py-1.5 text-foreground">{w.label}</td>
                  <td className="border-b border-border px-2 py-1.5 text-right text-foreground tabular-nums">
                    {w.value.toLocaleString()}
                  </td>
                  <td className="border-b border-border px-2 py-1.5 text-right text-foreground tabular-nums">
                    {Math.round(w.frac * 100)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="relative" style={{ width: SIZE, height: SIZE }}>
            <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} focusable="false" role="presentation">
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

              {wedges.map((w) => {
                const isActive = hoverIndex === w.index;
                const dx = isActive ? r3(Math.cos(w.mid) * EXPLODE_PX) : 0;
                const dy = isActive ? r3(Math.sin(w.mid) * EXPLODE_PX) : 0;
                return (
                  <path
                    key={w.label}
                    id={`${uid}-w-${w.index}`}
                    role="button"
                    tabIndex={activeIndex === w.index ? 0 : -1}
                    aria-label={`${w.label}: ${w.value.toLocaleString()}${unit ? ` ${unit}` : ""}, ${Math.round(w.frac * 100)}%`}
                    d={wedgePath(R_OUTER, R_INNER, w.a0, w.a1)}
                    fill={`url(#${uid}-p${w.level})`}
                    className="ns-cdh-wedge"
                    style={{
                      transform: `translate(${dx}px, ${dy}px) scale(${entered ? 1 : 0.6})`,
                      opacity: entered ? 1 : 0,
                      transformOrigin: `${CX}px ${CY}px`,
                      transitionDelay: `${w.index * 55}ms`,
                    }}
                    onPointerEnter={() => setHoverIndex(w.index)}
                    onPointerLeave={() => setHoverIndex((c) => (c === w.index ? null : c))}
                    onFocus={() => {
                      setActiveIndex(w.index);
                      setHoverIndex(w.index);
                    }}
                    onBlur={() => setHoverIndex((c) => (c === w.index ? null : c))}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                        e.preventDefault();
                        focusWedge((w.index - 1 + data.length) % data.length);
                      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                        e.preventDefault();
                        focusWedge((w.index + 1) % data.length);
                      }
                    }}
                  />
                );
              })}
            </svg>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
              <span className="font-sans text-2xl font-semibold text-foreground">{formatValue(centerValue)}</span>
              <span className="mt-0.5 max-w-[6.5rem] truncate px-1 font-mono text-[10px] tracking-widest text-ns-muted">
                {centerLabel.toUpperCase()}
              </span>
            </div>
          </div>
        )}
      </div>

      {!showTable && (
        <ul className="ns-cdh-legend flex flex-col gap-2 font-mono text-xs" aria-hidden="true">
          {wedges.map((w) => (
            <li key={w.label} className="flex items-center gap-2">
              <svg width={14} height={14} aria-hidden="true">
                <rect width={14} height={14} rx={2} fill={`url(#${uid}-p${w.level})`} stroke="var(--border)" />
              </svg>
              <span className="text-foreground">{w.label}</span>
              <span className="text-ns-muted">{Math.round(w.frac * 100)}%</span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

const CSS = `
.ns-cdh-wedge { transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 420ms ease-out; cursor: pointer; outline: none; }
.ns-cdh-wedge:focus-visible { outline: 2px solid var(--ns-accent); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .ns-cdh-wedge { transition: none; }
}
`;
