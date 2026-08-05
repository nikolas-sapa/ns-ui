"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// StippleYear — a GitHub-style year activity calendar where intensity is
// STIPPLE DENSITY, not color: every day cell holds 0-8 tiny ink dots placed
// by a deterministic, date-seeded jitter (an engraving/print metaphor, pure
// var(--foreground) on var(--background)). Dot positions are generated once
// in NORMALIZED [0,1] space per date (`stippleUnits`) and only scaled to
// pixels at render time — the loupe renders the exact same normalized
// points at 2x, so it's a literal zoomed copy, not a re-roll.
//
// Every cell is a focusable role="button" (roving tabindex — one cell has
// tabIndex 0 at a time, arrow keys move which one) so the automatic
// hover/press/focus screenshot pass and the a11y audit exercise the same
// interaction keyboard users get. Hover or focus opens a fixed loupe panel
// plus a Geist Mono tooltip; the cell's own aria-label already carries the
// same fact in text for anyone not using either.
// ---------------------------------------------------------------------------

export interface StippleYearProps {
  /** Map of ISO date ("YYYY-MM-DD") to an activity count. */
  values?: Record<string, number>;
  /** Last day of the 371-day window. Defaults to today. */
  endDate?: Date;
  className?: string;
}

const CELL = 16;
const GAP = 4;
const STEP = CELL + GAP;
const MARGIN = 1.9;
const MAX_DOTS = 8;
const DOT_R = 1.35;
const LOUPE_CELL = 68;
const LOUPE_MARGIN = 6;
const LOUPE_DOT_R = 3.2;
/** Fixed footprint of the side panel that holds the loupe — always reserved
 *  (even when nothing is hovered) so it never overlaps the grid's own cells
 *  and never shifts the component's box on hover. Wide enough for the
 *  longest realistic one-line caption ("20 contributions - Dec 25"). */
const LOUPE_PANEL_W = 172;
const LEFT_LABEL_W = 30;
const TOP_LABEL_H = 20;

/** Loupe ink-settle — every time a new cell is magnified into the loupe,
 *  its dots don't just appear: each one starts flung a short distance from
 *  its resting position (offset derived from the same per-dot mulberry32
 *  stream that placed it, so it's deterministic and replays identically for
 *  a given date, never Math.random()) and springs into place on an
 *  ease-out-expo curve, staggered a few ms apart per dot so the settle
 *  reads as ink landing on paper rather than one uniform pop. Kept well
 *  clear of the loupe's own 160ms zoom-in (LOUPE_SETTLE_MS is longer and
 *  starts from the same frame) so the two read as two distinct events, not
 *  one blurred bloom. */
const LOUPE_SETTLE_MS = 460;
const LOUPE_SETTLE_MAX = 22;
const LOUPE_SETTLE_STAGGER = 18;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}
function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}
function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dotCountFor(value: number, max: number): number {
  if (value <= 0) return 0;
  return Math.min(MAX_DOTS, 1 + Math.round((value / max) * (MAX_DOTS - 1)));
}

/** Normalized [0,1] dot positions for a date, deterministic and reused at any scale. */
function stippleUnits(iso: string, count: number): { x: number; y: number }[] {
  const rng = mulberry32(hashStr(iso));
  return Array.from({ length: count }, () => ({ x: rng(), y: rng() }));
}

/** Per-dot starting offset for the loupe's ink-settle entrance — a distinct
 *  PRNG stream (own hash suffix) so it never correlates with the dot's own
 *  resting position, but is still fully deterministic for a given date. */
function loupeSettleOffsets(iso: string, count: number): { dx: number; dy: number }[] {
  const rng = mulberry32(hashStr(`${iso}:settle`));
  return Array.from({ length: count }, () => {
    const angle = rng() * Math.PI * 2;
    const dist = LOUPE_SETTLE_MAX * (0.4 + rng() * 0.6);
    return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist };
  });
}

interface DayCell {
  date: Date;
  iso: string;
  inRange: boolean;
  col: number;
  row: number;
}

export function StippleYear({ values = {}, endDate, className = "" }: StippleYearProps) {
  const today = useMemo(() => startOfDay(endDate ?? new Date()), [endDate]);
  const loupeClipId = useId();

  const { cells, weeks, monthLabels } = useMemo(() => {
    const roughStart = addDays(today, -364);
    const start = addDays(roughStart, -roughStart.getDay());
    const totalDays = Math.round((today.getTime() - start.getTime()) / 86400000) + 1;
    const weeksN = Math.ceil(totalDays / 7);
    const list: DayCell[] = [];
    for (let i = 0; i < weeksN * 7; i++) {
      const date = addDays(start, i);
      list.push({ date, iso: isoDate(date), inRange: date <= today, col: Math.floor(i / 7), row: i % 7 });
    }
    const labels: { col: number; text: string }[] = [];
    let lastMonth = -1;
    for (const c of list) {
      if (c.row === 0 && c.date.getDate() <= 7 && c.date.getMonth() !== lastMonth) {
        labels.push({ col: c.col, text: MONTHS[c.date.getMonth()]! });
        lastMonth = c.date.getMonth();
      }
    }
    return { cells: list, weeks: weeksN, monthLabels: labels };
  }, [today]);

  const maxValue = useMemo(
    () => Math.max(1, ...cells.filter((c) => c.inRange).map((c) => values[c.iso] ?? 0)),
    [cells, values]
  );

  const [activeIndex, setActiveIndex] = useState(() => {
    const idx = cells.findIndex((c) => c.inRange && c.iso === isoDate(today));
    return idx === -1 ? 0 : idx;
  });
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const cellRefs = useRef<(SVGRectElement | null)[]>([]);

  const reducedMotionRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      reducedMotionRef.current = mq.matches;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Column/row-aware, not flat-index ±1/±7 — at a row boundary (top/bottom
  // of a week column) a flat index just wraps into the adjacent week's
  // opposite row, which reads as a diagonal jump instead of stopping.
  const focusCell = (col: number, row: number) => {
    if (row < 0 || row > 6 || col < 0 || col >= weeks) return;
    const next = col * 7 + row;
    if (!cells[next]?.inRange) return;
    setActiveIndex(next);
    cellRefs.current[next]?.focus();
  };

  const loupeIdx = hoverIndex;
  const loupeCell = loupeIdx !== null ? cells[loupeIdx] : null;
  const loupeValue = loupeCell ? (values[loupeCell.iso] ?? 0) : 0;
  const loupeUnits = loupeCell ? stippleUnits(loupeCell.iso, dotCountFor(loupeValue, maxValue)) : [];
  const loupeSettle = loupeCell ? loupeSettleOffsets(loupeCell.iso, loupeUnits.length) : [];

  const labelFor = (c: DayCell) => {
    const v = values[c.iso] ?? 0;
    const noun = v === 1 ? "contribution" : "contributions";
    return `${v} ${noun}, ${MONTHS[c.date.getMonth()]} ${c.date.getDate()}`;
  };

  const viewW = LEFT_LABEL_W + weeks * STEP;
  const viewH = TOP_LABEL_H + 7 * STEP;

  return (
    <div className={`ns-sy-grid inline-flex items-start gap-3 ${className}`}>
      <style>{CSS}</style>
      <svg
        className="ns-sy-canvas"
        viewBox={`0 0 ${viewW} ${viewH}`}
        width={viewW}
        style={{ maxWidth: "100%" }}
        focusable="false"
      >
        <g aria-hidden="true" className="font-mono" style={{ fontSize: 8.5 }}>
          {monthLabels.map((m, i) => (
            <text key={i} x={LEFT_LABEL_W + m.col * STEP} y={TOP_LABEL_H - 4} fill="var(--ns-muted)">
              {m.text}
            </text>
          ))}
          {WEEKDAY_LABELS.map((label, row) =>
            label ? (
              <text key={row} x={0} y={TOP_LABEL_H + row * STEP + CELL - 2} fill="var(--ns-muted)">
                {label}
              </text>
            ) : null
          )}
        </g>

        {cells.map((c, i) => {
          if (!c.inRange) return null;
          const value = values[c.iso] ?? 0;
          const count = dotCountFor(value, maxValue);
          const units = stippleUnits(c.iso, count);
          const x = LEFT_LABEL_W + c.col * STEP;
          const y = TOP_LABEL_H + c.row * STEP;
          const isActive = i === activeIndex;
          const isHovered = i === hoverIndex;
          return (
            <g key={c.iso}>
              <rect
                ref={(el) => {
                  cellRefs.current[i] = el;
                }}
                role="button"
                tabIndex={isActive ? 0 : -1}
                aria-label={labelFor(c)}
                x={x}
                y={y}
                width={CELL}
                height={CELL}
                rx={2}
                fill="transparent"
                stroke={isHovered ? "var(--foreground)" : "var(--border)"}
                strokeWidth={isHovered ? 1.25 : 0.9}
                strokeOpacity={isHovered ? 0.7 : 0.6}
                className="ns-sy-cell"
                style={{ outlineOffset: 1 }}
                onPointerEnter={() => setHoverIndex(i)}
                onPointerLeave={() => setHoverIndex((cur) => (cur === i ? null : cur))}
                onFocus={() => {
                  setActiveIndex(i);
                  setHoverIndex(i);
                }}
                onBlur={() => setHoverIndex((cur) => (cur === i ? null : cur))}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    focusCell(c.col, c.row - 1);
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    focusCell(c.col, c.row + 1);
                  } else if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    focusCell(c.col - 1, c.row);
                  } else if (e.key === "ArrowRight") {
                    e.preventDefault();
                    focusCell(c.col + 1, c.row);
                  }
                }}
              />
              <g className="ns-sy-dots">
                {units.map((u, k) => (
                  <circle
                    key={k}
                    cx={x + MARGIN + u.x * (CELL - 2 * MARGIN)}
                    cy={y + MARGIN + u.y * (CELL - 2 * MARGIN)}
                    r={DOT_R}
                    fill="var(--foreground)"
                    aria-hidden="true"
                  />
                ))}
              </g>
            </g>
          );
        })}
      </svg>

      {/* Fixed-footprint side panel, always rendered so the component's own
          box never resizes on hover — only its contents toggle. It sits
          beside the grid (not layered on top), so it can never occlude the
          cell that's actually being hovered. */}
      <div
        className="pointer-events-none flex shrink-0 flex-col items-center justify-center gap-1 rounded-[6px] border border-border bg-background p-1.5 shadow-sm"
        style={{ width: LOUPE_PANEL_W, height: viewH, visibility: loupeCell ? "visible" : "hidden" }}
      >
        {loupeCell && (
          <>
            <svg
              key={loupeCell.iso}
              viewBox={`0 0 ${LOUPE_CELL} ${LOUPE_CELL}`}
              width={LOUPE_CELL}
              height={LOUPE_CELL}
              className="ns-sy-loupe"
              aria-hidden="true"
            >
              <defs>
                <clipPath id={loupeClipId}>
                  <rect x={1} y={1} width={LOUPE_CELL - 2} height={LOUPE_CELL - 2} rx={4} />
                </clipPath>
              </defs>
              <rect x={0} y={0} width={LOUPE_CELL} height={LOUPE_CELL} rx={4} fill="var(--background)" stroke="var(--border)" strokeWidth={1} />
              <g clipPath={`url(#${loupeClipId})`}>
                {loupeUnits.map((u, k) => {
                  const settle = loupeSettle[k] ?? { dx: 0, dy: 0 };
                  return (
                    <circle
                      key={k}
                      cx={LOUPE_MARGIN + u.x * (LOUPE_CELL - 2 * LOUPE_MARGIN)}
                      cy={LOUPE_MARGIN + u.y * (LOUPE_CELL - 2 * LOUPE_MARGIN)}
                      r={LOUPE_DOT_R}
                      fill="var(--foreground)"
                      className="ns-sy-loupe-dot"
                      style={
                        {
                          "--sx": `${settle.dx.toFixed(2)}px`,
                          "--sy": `${settle.dy.toFixed(2)}px`,
                          animationDelay: `${k * LOUPE_SETTLE_STAGGER}ms`,
                        } as CSSProperties
                      }
                    />
                  );
                })}
              </g>
            </svg>
            <span className="whitespace-nowrap font-mono text-[10px] text-foreground">
              {loupeValue} {loupeValue === 1 ? "contribution" : "contributions"} - {MONTHS[loupeCell.date.getMonth()]}{" "}
              {loupeCell.date.getDate()}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

const CSS = `
.ns-sy-cell { cursor: pointer; outline: none; transition: stroke 120ms ease-out; }
.ns-sy-cell:focus-visible { outline: 2px solid var(--ns-accent); outline-offset: 1px; }
@keyframes ns-sy-zoom-in { from { transform: scale(0.55); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.ns-sy-loupe { transform-origin: center; animation: ns-sy-zoom-in 160ms cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes ns-sy-ink-settle {
  from { transform: translate(var(--sx), var(--sy)); opacity: 0.15; }
  to { transform: translate(0, 0); opacity: 1; }
}
.ns-sy-loupe-dot { animation: ns-sy-ink-settle ${LOUPE_SETTLE_MS}ms cubic-bezier(0.16, 1, 0.3, 1) backwards; }
@media (prefers-reduced-motion: reduce) {
  .ns-sy-cell { transition: none; }
  .ns-sy-loupe { animation: none; }
  .ns-sy-loupe-dot { animation: none; }
}
`;
