"use client";

import { useState } from "react";
import { RuleSparkline } from "./component";

// deterministic series — identical on server and client (no hydration drift)
const REVENUE = [
  46.2, 46.8, 46.5, 47.1, 47.4, 47.0, 47.6, 48.1, 47.9, 48.4, 48.2, 48.8,
  49.1, 48.9, 49.4, 49.2, 49.8, 50.1, 49.9, 50.4, 50.8, 50.6, 51.2, 51.5,
];
const LATENCY = [
  112, 128, 118, 141, 122, 135, 108, 131, 146, 119, 127, 152, 116, 138, 124,
  149, 133, 111, 142, 126, 137, 121, 144, 130,
];
const ERRORS = [
  3, 18, 6, 42, 11, 29, 4, 55, 21, 8, 38, 14, 61, 9, 27, 47, 5, 33, 72, 12,
  24, 58, 16, 44,
];

// mirrors the component's volatility buckets so the mapping is legible
function ruleInfo(data: number[]): { rule: number; cv: number } {
  const n = data.length;
  if (n < 2) return { rule: 4, cv: 0 };
  const mean = data.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(
    data.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n
  );
  const cv = Math.abs(mean) < 1e-9 ? (sd > 0 ? 1 : 0) : sd / Math.abs(mean);
  if (cv < 0.08) return { rule: 4, cv };
  if (cv < 0.2) return { rule: 108, cv };
  if (cv < 0.4) return { rule: 110, cv };
  return { rule: 30, cv };
}

function DeltaPill({ pct, invert = false }: { pct: number; invert?: boolean }) {
  const good = invert ? pct <= 0 : pct >= 0;
  const cls = good
    ? "border-[var(--success)]/25 bg-[var(--success)]/10 text-[var(--success)]"
    : "border-[var(--error)]/25 bg-[var(--error)]/10 text-[var(--error)]";
  return (
    <span
      className={`rounded-full border px-2 py-0.5 font-mono text-[11px] tabular-nums ${cls}`}
    >
      {pct >= 0 ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}

function MetricTile({
  label,
  data,
  value,
  invert = false,
  mood,
  format,
}: {
  label: string;
  data: number[];
  value: string;
  invert?: boolean;
  mood: string;
  format: (v: number) => string;
}) {
  const first = data[0] ?? 1;
  const lastV = data[data.length - 1] ?? 0;
  const pct = first !== 0 ? ((lastV - first) / first) * 100 : 0;
  const { rule, cv } = ruleInfo(data);
  return (
    <div className="p-5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="font-mono text-[11px] tracking-widest text-ns-muted">
          {label}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-ns-muted">
          RULE {rule} · CV {cv.toFixed(2)} · {mood}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-3">
        <span className="text-2xl font-semibold tabular-nums text-foreground">
          {value}
        </span>
        <DeltaPill pct={pct} invert={invert} />
      </div>
      <div className="mt-3">
        <RuleSparkline
          data={data}
          className="h-14"
          aria-label={`${label} sparkline`}
          formatValue={(v) => format(v)}
        />
      </div>
    </div>
  );
}

export default function RuleSparklineDemo() {
  const [revenue, setRevenue] = useState<number[]>(REVENUE);
  const [latency, setLatency] = useState<number[]>(LATENCY);
  const [errors, setErrors] = useState<number[]>(ERRORS);

  // append one point per series at its own volatility — shows the 200ms
  // tail sweep and keeps each tile inside its rule bucket
  const push = () => {
    setRevenue((p) => {
      const lastV = p[p.length - 1] ?? 50;
      return [...p, +(lastV + (Math.random() - 0.42) * 0.9).toFixed(1)];
    });
    setLatency((p) => [...p, Math.round(128 + (Math.random() - 0.5) * 42)]);
    setErrors((p) => [
      ...p,
      Math.round(
        Math.random() < 0.5 ? 3 + Math.random() * 14 : 22 + Math.random() * 52
      ),
    ]);
  };

  const revLast = revenue[revenue.length - 1] ?? 0;
  const latLast = latency[latency.length - 1] ?? 0;
  const errLast = errors[errors.length - 1] ?? 0;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / sparkline-automaton
        </p>
        <h1 className="text-lg font-semibold text-foreground">
          The texture reads the data
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-ns-muted">
          Each sparkline grows an elementary cellular automaton beneath its
          line — one generation per data point, rule picked by volatility.
          Calm revenue stays sparse (rule 4); jittery latency knits (rule
          108); chaotic errors boil (rule 30).
        </p>
        <div className="mt-5 divide-y divide-border overflow-hidden rounded-md border border-border bg-surface">
          <MetricTile
            label="REVENUE"
            data={revenue}
            value={`$${revLast.toFixed(1)}k`}
            mood="CALM"
            format={(v) => `$${v.toFixed(1)}k`}
          />
          <MetricTile
            label="LATENCY P95"
            data={latency}
            value={`${latLast} ms`}
            invert
            mood="MODERATE"
            format={(v) => `${Math.round(v)} ms`}
          />
          <MetricTile
            label="ERRORS / MIN"
            data={errors}
            value={`${errLast}`}
            invert
            mood="VOLATILE"
            format={(v) => `${Math.round(v)}`}
          />
          <div className="flex items-center justify-between gap-4 px-5 py-3">
            <span className="font-mono text-[11px] text-ns-muted">
              scrub a strip, or arrow-key it while focused
            </span>
            <button
              type="button"
              onClick={push}
              className="rounded-sm border border-border px-3 py-1.5 font-mono text-[11px] tracking-widest text-ns-muted transition-colors duration-200 hover:border-foreground/20 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
            >
              PUSH DATA
            </button>
          </div>
        </div>
        <p className="mt-3 font-mono text-[11px] text-ns-muted">
          identical data reproduces identical texture — the seed row is the
          first value&apos;s bits
        </p>
      </div>
    </main>
  );
}
