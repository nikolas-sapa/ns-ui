"use client";

import { useMemo, useRef, useState } from "react";

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

const CELL = 10;
const GAP = 2;
const STEP = CELL + GAP;
const MARGIN = 1.3;
const MAX_DOTS = 8;
const DOT_R = 0.55;
const LOUPE_CELL = 44;
const LOUPE_MARGIN = 4;
const LOUPE_DOT_R = 1.7;

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

interface DayCell {
  date: Date;
  iso: string;
  inRange: boolean;
  col: number;
  row: number;
}

export function StippleYear({ values = {}, endDate, className = "" }: StippleYearProps) {
  const today = useMemo(() => startOfDay(endDate ?? new Date()), [endDate]);

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

  const labelFor = (c: DayCell) => {
    const v = values[c.iso] ?? 0;
    const noun = v === 1 ? "contribution" : "contributions";
    return `${v} ${noun}, ${MONTHS[c.date.getMonth()]} ${c.date.getDate()}`;
  };

  const LEFT_LABEL_W = 20;
  const TOP_LABEL_H = 14;
  const viewW = LEFT_LABEL_W + weeks * STEP;
  const viewH = TOP_LABEL_H + 7 * STEP;

  return (
    <div className={`relative inline-block ${className}`}>
      <style>{CSS}</style>
      <svg viewBox={`0 0 ${viewW} ${viewH}`} width="100%" style={{ maxWidth: viewW }} focusable="false">
        <g aria-hidden="true" className="font-mono" style={{ fontSize: 6 }}>
          {monthLabels.map((m, i) => (
            <text key={i} x={LEFT_LABEL_W + m.col * STEP} y={TOP_LABEL_H - 4} fill="var(--muted)">
              {m.text}
            </text>
          ))}
          {WEEKDAY_LABELS.map((label, row) =>
            label ? (
              <text key={row} x={0} y={TOP_LABEL_H + row * STEP + CELL - 2} fill="var(--muted)">
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
                rx={1.5}
                fill="transparent"
                stroke={isHovered ? "var(--foreground)" : "var(--border)"}
                strokeWidth={isHovered ? 1 : 0.75}
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
          );
        })}
      </svg>

      {loupeCell && (
        <div className="pointer-events-none absolute right-0 top-0 z-10 flex flex-col items-center gap-1 rounded-[6px] border border-border bg-background p-1.5 shadow-sm">
          <svg
            key={loupeCell.iso}
            viewBox={`0 0 ${LOUPE_CELL} ${LOUPE_CELL}`}
            width={LOUPE_CELL}
            height={LOUPE_CELL}
            className="ns-sy-loupe"
            aria-hidden="true"
          >
            <rect x={0} y={0} width={LOUPE_CELL} height={LOUPE_CELL} rx={4} fill="var(--background)" stroke="var(--border)" strokeWidth={1} />
            {loupeUnits.map((u, k) => (
              <circle
                key={k}
                cx={LOUPE_MARGIN + u.x * (LOUPE_CELL - 2 * LOUPE_MARGIN)}
                cy={LOUPE_MARGIN + u.y * (LOUPE_CELL - 2 * LOUPE_MARGIN)}
                r={LOUPE_DOT_R}
                fill="var(--foreground)"
              />
            ))}
          </svg>
          <span className="whitespace-nowrap font-mono text-[10px] text-foreground">
            {loupeValue} {loupeValue === 1 ? "contribution" : "contributions"} - {MONTHS[loupeCell.date.getMonth()]}{" "}
            {loupeCell.date.getDate()}
          </span>
        </div>
      )}
    </div>
  );
}

const CSS = `
.ns-sy-cell { cursor: pointer; outline: none; transition: stroke 120ms ease-out; }
.ns-sy-cell:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
@keyframes ns-sy-zoom-in { from { transform: scale(0.55); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.ns-sy-loupe { transform-origin: center; animation: ns-sy-zoom-in 160ms cubic-bezier(0.16, 1, 0.3, 1); }
@media (prefers-reduced-motion: reduce) {
  .ns-sy-cell { transition: none; }
  .ns-sy-loupe { animation: none; }
}
`;
