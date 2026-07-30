"use client";

import { useRef, useState } from "react";

// 8 sub-row block-fraction glyphs, 1/8 full to 8/8 full
const BLOCKS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
const ROWS = 8;
const COL_W = 1; // ch, one glyph per column
const COL_GAP = 0.6; // ch, whitespace between columns
const PITCH = COL_W + COL_GAP;

export interface RampTraceProps {
  /** the series to plot; needs at least one value */
  data: number[];
  /** accessible name for each column, e.g. "Revenue"; used in per-option labels */
  label?: string;
  /** formats a raw value for the in-grid readout and accessible names */
  valueFormat?: (value: number) => string;
  className?: string;
}

export function RampTrace({
  data,
  label = "value",
  valueFormat = (v) => v.toLocaleString(),
  className = "",
}: RampTraceProps) {
  const series = data.length ? data : [0];
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min;
  const norm = series.map((v) => (range === 0 ? 0.5 : (v - min) / range));

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  const activeIdx = hoverIdx ?? focusIdx;
  const colRefs = useRef<(HTMLDivElement | null)[]>([]);

  const moveFocus = (i: number) => {
    const clamped = Math.min(series.length - 1, Math.max(0, i));
    colRefs.current[clamped]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const current = focusIdx ?? 0;
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        moveFocus(current - 1);
        break;
      case "ArrowRight":
        e.preventDefault();
        moveFocus(current + 1);
        break;
      case "Home":
        e.preventDefault();
        moveFocus(0);
        break;
      case "End":
        e.preventDefault();
        moveFocus(series.length - 1);
        break;
      default:
        break;
    }
  };

  const glyphFor = (i: number) => {
    const units = norm[i] * ROWS * 8;
    let fullRows = Math.floor(units / 8);
    let remainder = Math.round(units - fullRows * 8);
    if (remainder === 8) {
      fullRows = Math.min(ROWS, fullRows + 1);
      remainder = 0;
    }
    const rows: { glyph: string; kind: "bar" | "empty" }[] = [];
    for (let r = ROWS - 1; r >= 0; r--) {
      if (r < fullRows) {
        rows.push({ glyph: "█", kind: "bar" });
      } else if (r === fullRows && remainder > 0) {
        rows.push({ glyph: BLOCKS[remainder - 1], kind: "bar" });
      } else {
        rows.push({ glyph: " ", kind: "empty" });
      }
    }
    return rows;
  };

  return (
    <div className={`font-mono ${className}`}>
      <div className="relative h-[1.1em] text-xs" style={{ lineHeight: "1.1em" }}>
        {activeIdx !== null ? (
          <span
            aria-hidden
            className="absolute bottom-0 whitespace-nowrap text-accent"
            style={{ left: `${activeIdx * PITCH}ch` }}
          >
            {valueFormat(series[activeIdx])}
          </span>
        ) : null}
      </div>
      <div
        role="listbox"
        aria-label={label}
        aria-orientation="horizontal"
        className="flex items-end outline-none"
        style={{ gap: `${COL_GAP}ch` }}
        onKeyDown={onKeyDown}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocusIdx(null);
        }}
      >
        {series.map((v, i) => {
          // inversion follows hover-or-focus, but `aria-selected` and the focus
          // ring follow DOM focus alone: hovering column 3 while column 0 is
          // focused must not move the announced selection off column 0, nor
          // leave the genuinely focused column with no visible indicator.
          const selected = activeIdx === i;
          const focused = focusIdx === i;
          const rows = glyphFor(i);
          return (
            <div
              key={i}
              ref={(el) => {
                colRefs.current[i] = el;
              }}
              role="option"
              aria-selected={focused}
              aria-label={`${label} ${i + 1} of ${series.length}: ${valueFormat(v)}`}
              tabIndex={i === (focusIdx ?? 0) ? 0 : -1}
              onFocus={() => setFocusIdx(i)}
              onPointerEnter={() => setHoverIdx(i)}
              onPointerLeave={() => setHoverIdx(null)}
              onClick={(e) => e.currentTarget.focus()}
              className={`flex cursor-pointer flex-col text-center leading-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                selected ? "bg-foreground" : ""
              }`}
              style={{ width: `${COL_W}ch` }}
            >
              {rows.map((row, r) => (
                <span
                  key={r}
                  aria-hidden
                  style={{ lineHeight: "1.2em" }}
                  className={
                    // painting bg-foreground on every row, not just the
                    // column div, guarantees a fully solid fill top to
                    // bottom even though the column div and its rows don't
                    // share a background layer once each row is its own
                    // flex-blockified box.
                    selected
                      ? "bg-foreground"
                      : row.kind === "bar"
                        ? "text-foreground"
                        : "text-muted/30"
                  }
                >
                  {selected
                    ? // "█" is a fully-inked glyph: recoloring it to the
                      // background token (as the rest of this knock-out
                      // relies on) paints the *entire* cell in that dark
                      // color, which just blends back into the page and
                      // makes a tall bar's own rows disappear instead of
                      // highlighting them. A blank cell has no ink to fight
                      // the fill, so every row renders as blank and the
                      // row's own solid background does all the work — a
                      // uniform, unmistakable bar of color the full height
                      // of the column, bar rows and empty rows alike. A
                      // literal " " won't do it: a whitespace-only block box
                      // collapses its line box to zero height, which is why
                      // this needs a non-breaking space instead.
                      " "
                    : row.kind === "empty"
                      ? "·"
                      : row.glyph}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
