"use client";

import { useEffect, useRef, useState } from "react";
import { AuroraFlowChart, type AuroraPoint } from "./component";

// Deterministic seeded PRNG — series must be identical on server and client
function mulberry32(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

type RangeKey = "24h" | "7d" | "30d";

const RANGES: RangeKey[] = ["24h", "7d", "30d"];
const POINTS = 90;
// fixed anchor keeps SSR/client labels identical (no Date.now, UTC getters)
const ANCHOR_MS = Date.UTC(2026, 6, 18, 14, 32);
const STEP_MS: Record<RangeKey, number> = {
  "24h": 16 * 60_000,
  "7d": 112 * 60_000,
  "30d": 8 * 3_600_000,
};
const BASE: Record<RangeKey, number> = { "24h": 1420, "7d": 1180, "30d": 940 };
const SEED: Record<RangeKey, number> = { "24h": 11, "7d": 23, "30d": 41 };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function labelAt(range: RangeKey, k: number): string {
  const d = new Date(ANCHOR_MS - (POINTS - 1 - k) * STEP_MS[range]);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  if (range === "24h") return `${hh}:${mm}`;
  if (range === "7d") return `${DAYS[d.getUTCDay()]} ${hh}:00`;
  return `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, "0")}`;
}

// 90-point believable traffic curve: diurnal wave + jitter, with a visible
// regime change (a deploy) stepping the baseline up ~1.6x around index 56
function makeSeries(range: RangeKey): AuroraPoint[] {
  const rng = mulberry32(SEED[range]);
  const base = BASE[range];
  const pts: AuroraPoint[] = [];
  for (let i = 0; i < POINTS; i++) {
    const wave = 0.78 + 0.22 * Math.sin((i / POINTS) * Math.PI * 3 + 0.8);
    const regime = i < 56 ? 1 : Math.min(1.62, 1 + (i - 55) * 0.14);
    const jitter = 0.9 + 0.2 * rng();
    pts.push({
      label: labelAt(range, i),
      value: Math.round(base * wave * regime * jitter),
    });
  }
  return pts;
}

export default function AuroraFlowChartDemo() {
  const [range, setRange] = useState<RangeKey>("24h");
  const [seriesMap, setSeriesMap] = useState<Record<RangeKey, AuroraPoint[]>>(
    () => ({
      "24h": makeSeries("24h"),
      "7d": makeSeries("7d"),
      "30d": makeSeries("30d"),
    })
  );
  const nextIdxRef = useRef<Record<RangeKey, number>>({
    "24h": POINTS,
    "7d": POINTS,
    "30d": POINTS,
  });

  // live ticker: push a datapoint every 3 s so the glide mechanic shows
  useEffect(() => {
    const rng = mulberry32(0x9e37 + range.length);
    const id = window.setInterval(() => {
      setSeriesMap((prev) => {
        const arr = prev[range];
        const last = arr[arr.length - 1]?.value ?? BASE[range];
        const k = nextIdxRef.current[range]++;
        const walk = 0.95 + 0.1 * rng();
        const value = Math.round(
          Math.min(BASE[range] * 2.6, Math.max(BASE[range] * 0.5, last * walk))
        );
        return {
          ...prev,
          [range]: [...arr.slice(1), { label: labelAt(range, k), value }],
        };
      });
    }, 3000);
    return () => window.clearInterval(id);
  }, [range]);

  const active = seriesMap[range];
  const lastV = active[active.length - 1]?.value ?? 0;
  const prevV = active[active.length - 2]?.value ?? lastV;
  const delta = lastV - prevV;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-20">
      <div className="w-full max-w-3xl">
        <p className="font-mono text-xs tracking-[0.25em] text-muted">
          ns-ui / aurora-flow-chart
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
          The fill is the phenomenon
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          An area chart whose fill is an aurora curtain: value drives curtain
          height, hue tracks local trend — falling runs cool, rising runs warm —
          and the noise-warped top edge drifts even at rest. New datapoints
          glide the curve to its next shape.
        </p>

        <div className="mt-8 rounded-md border border-border bg-surface p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
                  Request volume
                </span>
                <span className="relative flex h-1.5 w-1.5" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-muted/50 motion-reduce:hidden" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-muted" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">
                  {lastV.toLocaleString("en-US")}
                </span>
                <span className="font-mono text-xs text-muted">
                  req/min · {delta >= 0 ? "+" : "−"}
                  {Math.abs(delta).toLocaleString("en-US")} vs prev
                </span>
              </div>
            </div>

            <div
              role="group"
              aria-label="Time range"
              className="flex items-center gap-1 rounded-sm border border-border p-0.5"
            >
              {RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  aria-pressed={range === r}
                  className={`rounded-sm px-2.5 py-1 font-mono text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                    range === r
                      ? "border border-foreground/15 bg-background text-foreground"
                      : "border border-transparent text-muted hover:bg-foreground/5 hover:text-foreground"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <AuroraFlowChart
              data={active}
              height={300}
              aria-label={`Request volume, ${range} view`}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 font-mono text-[11px] text-muted">
            <span>live — a datapoint pushes every 3 s and glides in</span>
            <span>hover for the crosshair · focus + arrow keys step points</span>
          </div>
        </div>
      </div>
    </main>
  );
}
