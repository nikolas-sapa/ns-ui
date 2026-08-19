"use client";

import { useMemo, useRef, useState } from "react";

export type TideCell = { date: string; value: number };

// A year of daily values read as a tide table: one column per week, one row per
// weekday, depth carried by a single-hue sequential ramp rather than a rainbow.
//
// Every step is mixed at runtime from --ns-accent into --background, so the ramp is
// re-stepped by the theme instead of being two hardcoded palettes: the same 5
// stops read as ink-on-paper in light and as lit water in dark. A day with no
// reading is not step 0 of the ramp — it is border-coloured slack, so "nothing
// recorded" never looks like "recorded, and low".
const STEPS = [18, 34, 52, 74, 100];
const SLACK = "color-mix(in oklab, var(--border) 70%, var(--background))";
const depth = (step: number) =>
  `color-mix(in oklab, var(--ns-accent) ${STEPS[step]}%, var(--background))`;

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function TideLedger({
  data,
  weeks = 26,
  cell = 13,
  gap = 3,
  label = "Daily readings",
  onSelect,
  className = "",
}: {
  /** one entry per day; the trailing `weeks * 7` days are shown */
  data: TideCell[];
  /** number of weeks (columns) rendered, most recent last */
  weeks?: number;
  /** px edge of one day cell */
  cell?: number;
  /** px gap between cells, both axes */
  gap?: number;
  /** caption above the grid; also the grid's accessible name */
  label?: string;
  /** called with the clicked day's data */
  onSelect?: (cell: TideCell) => void;
  /** extra classes merged onto the rendered root element */
  className?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [cursor, setCursor] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);

  // Column-major: index = week * 7 + weekday, which is the order the DOM is in,
  // so arrow-key movement is plain index arithmetic rather than a lookup.
  const cells = useMemo(() => data.slice(-(weeks * 7)), [data, weeks]);
  const max = useMemo(() => Math.max(1, ...cells.map((c) => c.value)), [cells]);

  const stepOf = (value: number) =>
    value <= 0 ? -1 : Math.min(STEPS.length - 1, Math.floor((value / max) * STEPS.length));

  const move = (delta: number) => {
    const next = Math.min(cells.length - 1, Math.max(0, cursor + delta));
    setCursor(next);
    setActive(next);
    (gridRef.current?.children[next] as HTMLElement | undefined)?.focus();
  };

  const shown = active !== null ? cells[active] : null;

  return (
    <figure className={["ns-hct-figure inline-flex flex-col gap-3", className].join(" ")}>
      <figcaption className="flex items-baseline justify-between gap-6 font-mono text-[11px] uppercase tracking-[0.18em] text-ns-muted">
        <span>{label}</span>
        {/* The readout is the direct label: one value, the hovered one, rather
            than a number stamped on 182 cells. */}
        <span className="text-foreground/80" aria-live="polite">
          {shown ? `${shown.date} · ${shown.value}` : `peak ${max}`}
        </span>
      </figcaption>

      <div className="flex gap-2">
        <div
          className="grid shrink-0 text-[10px] text-ns-muted"
          style={{ gridTemplateRows: `repeat(7, ${cell}px)`, rowGap: gap }}
          aria-hidden
        >
          {DAYS.map((d, i) => (
            <span key={d} className="leading-none" style={{ fontSize: 9, lineHeight: `${cell}px` }}>
              {i % 2 === 0 ? d[0] : ""}
            </span>
          ))}
        </div>

        <div
          ref={gridRef}
          role="grid"
          aria-label={label}
          className="grid"
          style={{
            gridTemplateRows: `repeat(7, ${cell}px)`,
            gridAutoFlow: "column",
            gridAutoColumns: `${cell}px`,
            gap,
          }}
          onKeyDown={(e) => {
            const delta =
              e.key === "ArrowRight" ? 7 : e.key === "ArrowLeft" ? -7 : e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
            if (!delta) return;
            e.preventDefault();
            move(delta);
          }}
          onMouseLeave={() => setActive(null)}
        >
          {cells.map((c, i) => {
            const step = stepOf(c.value);
            return (
              <button
                key={c.date}
                type="button"
                role="gridcell"
                // Roving tabindex: the grid is one tab stop, arrows walk it.
                tabIndex={i === cursor ? 0 : -1}
                aria-label={`${c.date}: ${c.value}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => {
                  setCursor(i);
                  setActive(i);
                }}
                onClick={() => onSelect?.(c)}
                className="rounded-[2px] transition-[transform,box-shadow] duration-150 ease-out hover:scale-[1.35] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent motion-reduce:transition-none motion-reduce:hover:scale-100"
                style={{
                  background: step < 0 ? SLACK : depth(step),
                  // 2px surface ring so neighbouring depths never bleed into one
                  // continuous field.
                  boxShadow: active === i ? "0 0 0 2px var(--background), 0 0 0 3px var(--ns-accent)" : "none",
                }}
              />
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ns-muted">
        <span>slack</span>
        <span className="h-[10px] w-[10px] rounded-[2px]" style={{ background: SLACK }} />
        {STEPS.map((_, i) => (
          <span key={i} className="h-[10px] w-[10px] rounded-[2px]" style={{ background: depth(i) }} />
        ))}
        <span>flood</span>
      </div>
    </figure>
  );
}
