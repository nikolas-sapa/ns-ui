"use client";

import { useEffect, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// GrainCrest — sortable data-table headers where each <th> carries a one-line
// braille micro-histogram of its own column's distribution ("the grain")
// under the label, so skew, outliers and bimodality are answered before
// anyone sorts. Numeric columns render a 16-glyph histogram on the shared
// dots-78/dots-3678/dots-25678/dots-all braille ramp (⣀⣤⣶⣿), log-binned with
// a small ᴸ tag when the column is heavily right-skewed; categorical columns
// render a dominance bar showing the top category's share instead. Clicking
// a header sorts the table — the crest never changes shape, since sorting
// doesn't change the data — instead a ▸ marker eases along the strip to show
// where the row now on top sits inside that column's own distribution,
// sliding to the opposite end when direction flips. Differs from
// sparkline-ascii / stat-row-baseline-spark by putting distribution shape
// INSIDE the sort control itself and encoding sort state as a position
// within a distribution, not a trend over time — most table columns have no
// time axis.
// ---------------------------------------------------------------------------

const BIN_COUNT = 12;
const SKEW_RATIO = 4; // max/median at or above this ⇒ log-binned + ᴸ tag
const LEVELS = [" ", "⣀", "⣤", "⣶", "⣿"]; // 0..4 fill levels, bottom-anchored

export type NumericColumn = {
  key: string;
  label: string;
  type: "numeric";
  /** appended to the default formatter, e.g. "ms" */
  unit?: string;
  /** overrides the default formatter entirely */
  format?: (value: number) => string;
};

export type CategoricalColumn = {
  key: string;
  label: string;
  type: "categorical";
};

export type GrainColumn = NumericColumn | CategoricalColumn;

export interface GrainCrestRow {
  id: string;
  /** shown in the leading, non-sortable identity column */
  label: string;
  [key: string]: string | number;
}

export interface GrainCrestTableProps {
  columns?: GrainColumn[];
  rows?: GrainCrestRow[];
  /** header text for the leading identity column */
  identityLabel?: string;
  title?: string;
  className?: string;
}

type NumericDerived = {
  type: "numeric";
  min: number;
  max: number;
  median: number;
  skewed: boolean;
  edges: number[];
  counts: number[];
  maxCount: number;
};

type CategoricalDerived = {
  type: "categorical";
  entries: [string, number][];
  total: number;
  dominantLabel: string;
  dominantCount: number;
  dominantShare: number;
};

type ColumnDerived = NumericDerived | CategoricalDerived;

function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function buildEdges(min: number, max: number, log: boolean, binCount: number): number[] {
  const edges: number[] = [];
  if (max <= min) {
    for (let i = 0; i <= binCount; i++) edges.push(min);
    return edges;
  }
  if (log) {
    const ratio = max / min;
    for (let i = 0; i <= binCount; i++) edges.push(min * Math.pow(ratio, i / binCount));
  } else {
    const step = (max - min) / binCount;
    for (let i = 0; i <= binCount; i++) edges.push(min + step * i);
  }
  edges[0] = min;
  edges[binCount] = max;
  return edges;
}

function binIndexForValue(edges: number[], value: number): number {
  const last = edges.length - 2;
  for (let i = 0; i <= last; i++) {
    if (value <= edges[i + 1]) return i;
  }
  return last;
}

function levelGlyph(count: number, maxCount: number): string {
  if (count <= 0) return LEVELS[0];
  const lvl = Math.min(4, Math.max(1, Math.ceil((count / maxCount) * 4)));
  return LEVELS[lvl];
}

function defaultFormat(unit?: string) {
  return (v: number) => `${Math.round(v).toLocaleString("en-US")}${unit ?? ""}`;
}

function numericSummary(col: NumericColumn, d: NumericDerived): string {
  const fmt = col.format ?? defaultFormat(col.unit);
  const skewNote = d.skewed ? ", right-skewed" : "";
  return `median ${fmt(d.median)}, range ${fmt(d.min)} to ${fmt(d.max)}${skewNote}`;
}

function categoricalSummary(d: CategoricalDerived): string {
  const pct = Math.round(d.dominantShare * 100);
  return `${d.entries.length} categories, top ${d.dominantLabel} at ${pct}%`;
}

function computeMarkerPos(col: GrainColumn, d: ColumnDerived, row: GrainCrestRow): number {
  if (d.type === "numeric") {
    const idx = binIndexForValue(d.edges, Number(row[col.key]));
    return (idx + 0.5) / BIN_COUNT;
  }
  const value = String(row[col.key]);
  if (value === d.dominantLabel) return d.dominantShare / 2;
  return d.dominantShare + (1 - d.dominantShare) / 2;
}

const DEFAULT_COLUMNS: GrainColumn[] = [
  { key: "latency", label: "Latency", type: "numeric", unit: "ms" },
  { key: "cost", label: "Cost", type: "numeric", format: (v) => `$${v.toFixed(0)}` },
  { key: "region", label: "Region", type: "categorical" },
  { key: "status", label: "Status", type: "categorical" },
];

const DEFAULT_ROWS: GrainCrestRow[] = [
  { id: "r1", label: "GET /health", latency: 42, cost: 12, region: "us-east", status: "ok" },
  { id: "r2", label: "GET /status", latency: 58, cost: 15, region: "us-east", status: "ok" },
  { id: "r3", label: "GET /users/:id", latency: 61, cost: 18, region: "us-west", status: "ok" },
  { id: "r4", label: "GET /search", latency: 74, cost: 21, region: "us-east", status: "ok" },
  { id: "r5", label: "GET /cart", latency: 88, cost: 24, region: "eu-central", status: "ok" },
  { id: "r6", label: "POST /login", latency: 95, cost: 27, region: "us-east", status: "ok" },
  { id: "r7", label: "GET /orders", latency: 101, cost: 30, region: "us-west", status: "ok" },
  { id: "r8", label: "GET /catalog", latency: 112, cost: 33, region: "us-east", status: "ok" },
  { id: "r9", label: "POST /checkout", latency: 118, cost: 36, region: "eu-central", status: "slow" },
  { id: "r10", label: "GET /recommend", latency: 129, cost: 39, region: "us-west", status: "ok" },
  { id: "r11", label: "GET /reports", latency: 145, cost: 42, region: "apac", status: "ok" },
  { id: "r12", label: "POST /webhook", latency: 168, cost: 45, region: "us-east", status: "slow" },
  { id: "r13", label: "GET /export", latency: 210, cost: 48, region: "eu-central", status: "ok" },
  { id: "r14", label: "GET /batch-sync", latency: 305, cost: 52, region: "apac", status: "slow" },
  { id: "r15", label: "POST /reindex", latency: 640, cost: 58, region: "us-west", status: "error" },
  { id: "r16", label: "POST /bulk-import", latency: 2100, cost: 65, region: "us-east", status: "error" },
];

export function GrainCrestTable({
  columns = DEFAULT_COLUMNS,
  rows = DEFAULT_ROWS,
  identityLabel = "Endpoint",
  title = "Request latency by route",
  className = "",
}: GrainCrestTableProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [detail, setDetail] = useState<string | null>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const derived = useMemo(() => {
    const map = new Map<string, ColumnDerived>();
    for (const col of columns) {
      if (col.type === "numeric") {
        const values = rows.map((r) => Number(r[col.key]));
        const sortedVals = [...values].sort((a, b) => a - b);
        const min = sortedVals[0] ?? 0;
        const max = sortedVals[sortedVals.length - 1] ?? 0;
        const median = quantile(sortedVals, 0.5);
        const skewed = min > 0 && median > 0 && max / median >= SKEW_RATIO;
        const edges = buildEdges(min, max, skewed, BIN_COUNT);
        const counts = new Array(BIN_COUNT).fill(0);
        for (const v of values) counts[binIndexForValue(edges, v)]++;
        const maxCount = Math.max(1, ...counts);
        map.set(col.key, { type: "numeric", min, max, median, skewed, edges, counts, maxCount });
      } else {
        const counts = new Map<string, number>();
        for (const r of rows) {
          const v = String(r[col.key]);
          counts.set(v, (counts.get(v) ?? 0) + 1);
        }
        const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
        const total = rows.length || 1;
        const [dominantLabel, dominantCount] = entries[0] ?? ["—", 0];
        map.set(col.key, {
          type: "categorical",
          entries,
          total,
          dominantLabel,
          dominantCount,
          dominantShare: dominantCount / total,
        });
      }
    }
    return map;
  }, [columns, rows]);

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return rows;
    const arr = [...rows];
    arr.sort((a, b) => {
      const c =
        col.type === "numeric"
          ? Number(a[col.key]) - Number(b[col.key])
          : String(a[col.key]).localeCompare(String(b[col.key]));
      return sortDir === "asc" ? c : -c;
    });
    return arr;
  }, [rows, columns, sortKey, sortDir]);

  const topRow = sortKey ? sortedRows[0] : undefined;

  const onSort = (col: GrainColumn) => {
    if (col.key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col.key);
      setSortDir(col.type === "numeric" ? "desc" : "asc");
    }
  };

  const handleNumericHover = (
    e: React.PointerEvent<HTMLSpanElement>,
    col: NumericColumn,
    d: NumericDerived
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const idx = Math.min(BIN_COUNT - 1, Math.floor(frac * BIN_COUNT));
    const fmt = col.format ?? defaultFormat(col.unit);
    const count = d.counts[idx] ?? 0;
    setDetail(
      `${col.label}: ${fmt(d.edges[idx])}–${fmt(d.edges[idx + 1])} · ${count} row${count === 1 ? "" : "s"}`
    );
  };

  const handleCategoricalHover = (
    e: React.PointerEvent<HTMLSpanElement>,
    col: CategoricalColumn,
    d: CategoricalDerived
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const pct = Math.round(d.dominantShare * 100);
    if (frac <= d.dominantShare) {
      setDetail(
        `${col.label}: ${d.dominantLabel} · ${d.dominantCount} row${d.dominantCount === 1 ? "" : "s"} (${pct}%)`
      );
    } else {
      const rest = d.total - d.dominantCount;
      setDetail(`${col.label}: other categories · ${rest} row${rest === 1 ? "" : "s"} (${100 - pct}%)`);
    }
  };

  const renderHeaderShell = (
    col: GrainColumn,
    active: boolean,
    numeric: boolean,
    skewed: boolean,
    accessibleName: string,
    summary: string,
    markerPos: number | null,
    strip: React.ReactNode
  ) => (
    <th
      key={col.key}
      scope="col"
      aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
      className={`px-3 py-2.5 align-top last:pr-5 ${numeric ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={() => onSort(col)}
        onFocus={() => setDetail(`${col.label}: ${summary}`)}
        onBlur={() => setDetail(null)}
        aria-label={accessibleName}
        className={`group flex w-full flex-col gap-1 rounded-sm px-1 py-1 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent ${
          numeric ? "items-end text-right" : "items-start text-left"
        }`}
      >
        <span
          className={`inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-widest transition-colors duration-150 ${
            active ? "text-foreground" : "text-ns-muted group-hover:text-foreground"
          }`}
        >
          {numeric && skewed && (
            <span aria-hidden className="text-[9px] normal-case text-ns-muted">
              ᴸ
            </span>
          )}
          {col.label}
          <svg
            viewBox="0 0 8 8"
            aria-hidden
            className={`h-2 w-2 transition-opacity duration-150 ${
              active ? "opacity-100" : "opacity-0 group-hover:opacity-60"
            } ${active && sortDir === "asc" ? "rotate-180" : ""}`}
            fill="currentColor"
          >
            <path d="M4 6 0.8 2h6.4Z" />
          </svg>
        </span>

        {strip}

        <span aria-hidden className="relative block h-2 w-full">
          {markerPos !== null && (
            <span
              data-grain-marker
              className="absolute -top-0.5 text-[10px] leading-none text-ns-accent"
              style={{
                left: `${markerPos * 100}%`,
                transform: "translateX(-50%)",
                transition: reduced ? "none" : "left 550ms cubic-bezier(0.19, 1, 0.22, 1)",
              }}
            >
              ▸
            </span>
          )}
        </span>
      </button>
    </th>
  );

  const renderNumericHeader = (col: NumericColumn, d: NumericDerived) => {
    const active = sortKey === col.key;
    const summary = numericSummary(col, d);
    const sortState = active ? (sortDir === "asc" ? "sorted ascending" : "sorted descending") : "sortable";
    const accessibleName = `${col.label}, ${sortState}, ${summary}`;
    const markerPos = active && topRow ? computeMarkerPos(col, d, topRow) : null;
    const strip = (
      <span
        aria-hidden
        onPointerMove={(e) => handleNumericHover(e, col, d)}
        onPointerLeave={() => setDetail(null)}
        className="block whitespace-nowrap font-mono text-[12px] leading-none text-ns-muted"
      >
        {d.counts.map((c, i) => (
          <span key={i}>{levelGlyph(c, d.maxCount)}</span>
        ))}
      </span>
    );
    return renderHeaderShell(col, active, true, d.skewed, accessibleName, summary, markerPos, strip);
  };

  const renderCategoricalHeader = (col: CategoricalColumn, d: CategoricalDerived) => {
    const active = sortKey === col.key;
    const summary = categoricalSummary(d);
    const sortState = active ? (sortDir === "asc" ? "sorted ascending" : "sorted descending") : "sortable";
    const accessibleName = `${col.label}, ${sortState}, ${summary}`;
    const markerPos = active && topRow ? computeMarkerPos(col, d, topRow) : null;
    const strip = (
      <span
        aria-hidden
        onPointerMove={(e) => handleCategoricalHover(e, col, d)}
        onPointerLeave={() => setDetail(null)}
        className="block whitespace-nowrap font-mono text-[12px] leading-none"
      >
        {Array.from({ length: BIN_COUNT }, (_, i) => {
          const filled = i < Math.round(d.dominantShare * BIN_COUNT);
          return (
            <span key={i} className={filled ? "text-foreground" : "text-ns-muted/40"}>
              {filled ? "⣿" : "⣀"}
            </span>
          );
        })}
      </span>
    );
    return renderHeaderShell(col, active, false, false, accessibleName, summary, markerPos, strip);
  };

  const renderHeaderCell = (col: GrainColumn) => {
    const d = derived.get(col.key);
    if (!d) return null;
    if (col.type === "numeric" && d.type === "numeric") return renderNumericHeader(col, d);
    if (col.type === "categorical" && d.type === "categorical") return renderCategoricalHeader(col, d);
    return null;
  };

  return (
    <div className={`overflow-hidden rounded-md border border-border bg-background ${className}`}>
      {title && (
        <div className="flex items-baseline justify-between gap-4 px-5 pb-3 pt-5">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
          <span className="font-mono text-[11px] tracking-wider text-ns-muted">{rows.length} rows</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="px-5 py-2.5 text-left align-top">
                {/* py-1 mirrors the sortable headers' button padding so this
                    non-interactive label shares their first-line baseline */}
                <span className="inline-block py-1 font-mono text-[11px] uppercase tracking-widest text-ns-muted">
                  {identityLabel}
                </span>
              </th>
              {columns.map((col) => renderHeaderCell(col))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-b-0">
                <td className="px-5 py-3 font-medium text-foreground">{row.label}</td>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3 py-3 font-mono text-xs tabular-nums text-ns-muted ${
                      col.type === "numeric" ? "text-right" : "text-left"
                    }`}
                  >
                    {col.type === "numeric"
                      ? (col.format ?? defaultFormat(col.unit))(Number(row[col.key]))
                      : String(row[col.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-border px-5 py-2.5">
        <p className="min-h-[1em] font-mono text-[11px] text-ns-muted">
          {detail ?? "Hover a header's grain to inspect a bin."}
        </p>
      </div>
    </div>
  );
}
