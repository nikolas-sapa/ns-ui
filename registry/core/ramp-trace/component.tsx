"use client";

import { useRef, useState } from "react";

// 8 sub-row block-fraction glyphs, 1/8 full to 8/8 full
const BLOCKS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
const ROWS = 8;
const COL_W = 1; // ch, one glyph per column
const COL_GAP = 0.6; // ch, whitespace between columns
const PITCH = COL_W + COL_GAP;
const SLOPE_EPS = 0.02; // normalized-value delta below which the trend reads flat

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
    const lineRow = Math.min(ROWS - 1, Math.round(norm[i] * (ROWS - 1)));

    const next = norm[i + 1];
    let lineGlyph = "─";
    if (next !== undefined) {
      const d = next - norm[i];
      if (d > SLOPE_EPS) lineGlyph = "╱";
      else if (d < -SLOPE_EPS) lineGlyph = "╲";
    }

    const rows: { glyph: string; kind: "bar" | "line" | "empty" }[] = [];
    for (let r = ROWS - 1; r >= 0; r--) {
      if (r === lineRow) {
        rows.push({ glyph: lineGlyph, kind: "line" });
      } else if (r < fullRows) {
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
      <div className="relative h-[1.4em] text-xs" style={{ lineHeight: "1.4em" }}>
        {activeIdx !== null ? (
          <span
            aria-hidden
            className="absolute top-0 whitespace-nowrap text-accent"
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
          const selected = activeIdx === i;
          const rows = glyphFor(i);
          return (
            <div
              key={i}
              ref={(el) => {
                colRefs.current[i] = el;
              }}
              role="option"
              aria-selected={selected}
              aria-label={`${label} ${i + 1} of ${series.length}: ${valueFormat(v)}`}
              tabIndex={i === (focusIdx ?? 0) ? 0 : -1}
              onFocus={() => setFocusIdx(i)}
              onPointerEnter={() => setHoverIdx(i)}
              onPointerLeave={() => setHoverIdx(null)}
              onClick={(e) => e.currentTarget.focus()}
              className={`flex cursor-pointer flex-col text-center leading-none outline-none ${
                selected ? "bg-foreground text-background" : ""
              }`}
              style={{ width: `${COL_W}ch` }}
            >
              {rows.map((row, r) => (
                <span
                  key={r}
                  aria-hidden
                  style={{ lineHeight: "1.2em" }}
                  className={
                    selected
                      ? ""
                      : row.kind === "line"
                        ? "text-accent"
                        : row.kind === "bar"
                          ? "text-foreground"
                          : "text-muted/30"
                  }
                >
                  {row.kind === "empty" && !selected ? "·" : row.glyph}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
