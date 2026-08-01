"use client";

export type StatPolarity = "higherIsBetter" | "lowerIsBetter" | "neutral";

export interface StatTileData {
  /** Stable id, used as the React key and in the aria-label. */
  id: string;
  label: string;
  value: number;
  /** Suffix ("%", "ms") or "$" for a prefix — anything else renders as a suffix. */
  unit?: string;
  /** Chronological, oldest first, NOT including `value` — value is the implicit latest point. */
  history: number[];
  /** Index into `history` the delta is measured against. Defaults to 0 (the oldest point). */
  baselineIndex?: number;
  /** States what the delta is against, e.g. "30d ago" — the delta is never shown without it. */
  baselineLabel: string;
  /** Which direction is actually good. Omit (or "neutral") to render the delta with no emphasis. */
  polarity?: StatPolarity;
  precision?: number;
}

export interface StatTileRowProps {
  tiles: StatTileData[];
  className?: string;
}

const W = 100;
const H = 34;
const PAD = 3;

function formatValue(v: number, unit: string | undefined, precision: number): string {
  const n = v.toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision });
  if (!unit) return n;
  return unit === "$" ? `$${n}` : `${n}${unit}`;
}

function Sparkline({
  points,
  baselineIndex,
  favorable,
}: {
  points: number[];
  baselineIndex: number;
  favorable: boolean | null;
}) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const x = (i: number) => (points.length === 1 ? W / 2 : (i / (points.length - 1)) * W);
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - PAD * 2);

  const lineD = points.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const areaD = `${lineD} L${x(points.length - 1)},${H} L${x(0)},${H} Z`;
  const lastIdx = points.length - 1;
  const baselineY = y(points[baselineIndex] ?? points[0]);
  const baselineX = x(baselineIndex);

  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 h-9 w-full overflow-visible"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
    >
      <path d={areaD} className="fill-muted/10" />
      <path d={lineD} className="fill-none stroke-muted" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      {/* baseline guide — only surfaces on hover/focus, alongside the reference dot below */}
      <line
        x1={baselineX}
        x2={baselineX}
        y1={baselineY}
        y2={H}
        className="stroke-border opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
        strokeWidth={1}
        strokeDasharray="2 2"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={baselineX}
        cy={baselineY}
        r={2}
        className="fill-background stroke-muted opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={x(lastIdx)} cy={y(points[lastIdx])} r={2.25} className={favorable ? "fill-accent" : "fill-foreground"} />
    </svg>
  );
}

function Tile({ tile }: { tile: StatTileData }) {
  const precision = tile.precision ?? 0;
  const baselineIndex = Math.min(Math.max(tile.baselineIndex ?? 0, 0), Math.max(tile.history.length - 1, 0));
  const baseline = tile.history[baselineIndex] ?? tile.value;
  const delta = tile.value - baseline;
  const direction: "up" | "down" | "flat" = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const polarity = tile.polarity ?? "neutral";
  const favorable =
    polarity === "neutral" ? null : polarity === "higherIsBetter" ? delta > 0 : delta < 0;
  const arrow = direction === "up" ? "▲" : direction === "down" ? "▼" : "–";
  const deltaText = formatValue(Math.abs(delta), tile.unit, precision);
  const points = [...tile.history, tile.value];

  const directionWord = direction === "up" ? "up" : direction === "down" ? "down" : "unchanged";
  const goodnessWord = favorable === null ? "" : favorable ? ", favorable" : ", unfavorable";
  const ariaLabel = `${tile.label}: ${formatValue(tile.value, tile.unit, precision)}, ${directionWord} ${deltaText} vs ${tile.baselineLabel}${goodnessWord}`;

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className="group relative flex min-h-[128px] w-full flex-col justify-between overflow-hidden rounded-md border border-border bg-surface p-4 text-left transition-colors duration-150 hover:border-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <div className="relative z-10">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">{tile.label}</p>
        <p className="font-mono text-2xl tabular-nums text-foreground">{formatValue(tile.value, tile.unit, precision)}</p>
        <p className={`mt-1 font-mono text-xs tabular-nums ${favorable ? "font-semibold text-accent" : "text-muted"}`}>
          <span aria-hidden>{arrow}</span> {deltaText}
          <span className="ml-1 text-muted/80">vs {tile.baselineLabel}</span>
        </p>
      </div>
      <Sparkline points={points} baselineIndex={baselineIndex} favorable={favorable} />
    </button>
  );
}

/**
 * A KPI row where every number arrives with its receipts: the sparkline
 * behind the figure is the same history the delta is computed from, and the
 * delta always states what it's measured against rather than assuming
 * "vs last point" silently. See each tile's instruction section for the
 * honesty rules governing color and direction.
 */
export function StatTileRow({ tiles, className = "" }: StatTileRowProps) {
  return (
    <div
      role="group"
      aria-label="Stat tiles"
      className={`grid gap-3 ${className}`}
      // Container-width responsive rather than viewport-media-query
      // responsive: a row dropped into a narrow sidebar wraps to fewer
      // columns on its own, the same as inside a full-width dashboard body —
      // no breakpoint prop to get wrong.
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(11rem, 1fr))" }}
    >
      {tiles.map((tile) => (
        <Tile key={tile.id} tile={tile} />
      ))}
    </div>
  );
}
