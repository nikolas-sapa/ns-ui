"use client";

// ---------------------------------------------------------------------------
// EvalDeltaTable — two eval runs compared case by case.
//
// One table row per case, sorted by delta descending, with a diverging bar
// drawn off a labelled zero line: bars to the right of zero are gains, bars to
// the left are regressions. Both scores and the signed delta are printed next
// to every bar, so the table reads without the chart and the chart reads
// without the table.
// ---------------------------------------------------------------------------

import { useMemo } from "react";

export interface EvalCase {
  /** Short, stable case identifier. */
  id: string;
  /** Score on the baseline run, 0..1. */
  baseline: number;
  /** Score on the candidate run, 0..1. */
  candidate: number;
}

export interface EvalDeltaTableProps {
  /** The two runs, one entry per eval case. */
  cases: EvalCase[];
  /** |delta| below this counts as unchanged. Default 0.005. */
  tieEps?: number;
  /** Half-width of the delta axis. Defaults to the largest |delta|, rounded up to 0.05. */
  scale?: number;
  /** Accessible caption for the table. */
  label?: string;
  className?: string;
}

function signed(n: number, digits = 3): string {
  const s = Math.abs(n).toFixed(digits);
  return n > 0 ? `+${s}` : n < 0 ? `−${s}` : s;
}

export function EvalDeltaTable({
  cases,
  tieEps = 0.005,
  scale,
  label = "Eval cases, sorted by score delta",
  className,
}: EvalDeltaTableProps) {
  const { rows, up, down, tie, max } = useMemo(() => {
    const rows = cases
      .map((c) => ({ ...c, delta: c.candidate - c.baseline }))
      .sort((a, b) => b.delta - a.delta);
    const peak = rows.reduce((m, r) => Math.max(m, Math.abs(r.delta)), 0);
    return {
      rows,
      up: rows.filter((r) => r.delta >= tieEps).length,
      down: rows.filter((r) => r.delta <= -tieEps).length,
      tie: rows.filter((r) => Math.abs(r.delta) < tieEps).length,
      max: scale ?? Math.max(0.05, Math.ceil(peak / 0.05) * 0.05),
    };
  }, [cases, tieEps, scale]);

  return (
    <div className={["w-full font-sans text-foreground", className].filter(Boolean).join(" ")}>
      <p className="mb-3 font-mono text-[11px] tabular-nums text-ns-muted">
        {rows.length} cases · {up} improved · {down} regressed · {tie} unchanged
      </p>

      <table className="w-full table-fixed border-collapse">
        <caption className="sr-only">{label}</caption>
        <colgroup>
          <col />
          <col style={{ width: 52 }} />
          <col style={{ width: 52 }} />
          <col style={{ width: "42%" }} />
          <col style={{ width: 64 }} />
        </colgroup>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="pb-2 text-left font-mono text-[10px] font-normal uppercase tracking-[0.16em] text-ns-muted">
              Case
            </th>
            <th scope="col" className="pb-2 text-right font-mono text-[10px] font-normal uppercase tracking-[0.16em] text-ns-muted">
              Base
            </th>
            <th scope="col" className="pb-2 pr-4 text-right font-mono text-[10px] font-normal uppercase tracking-[0.16em] text-ns-muted">
              Cand
            </th>
            <th scope="col" className="pb-2 text-left font-mono text-[10px] font-normal uppercase tracking-[0.16em] text-ns-muted">
              Δ score
            </th>
            <th scope="col" className="pb-2 text-right font-mono text-[10px] font-normal uppercase tracking-[0.16em] text-ns-muted">
              Δ
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const pct = Math.min(1, Math.abs(r.delta) / max) * 50;
            return (
              <tr key={r.id}>
                <td className="py-[3px] pr-3">
                  <span className="block truncate font-mono text-[11px] text-foreground">{r.id}</span>
                </td>
                <td className="py-[3px] text-right font-mono text-[11px] tabular-nums text-ns-muted">
                  {r.baseline.toFixed(2)}
                </td>
                <td className="py-[3px] pr-4 text-right font-mono text-[11px] tabular-nums text-ns-muted">
                  {r.candidate.toFixed(2)}
                </td>
                <td className="relative py-[3px]">
                  <span aria-hidden className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
                  {Math.abs(r.delta) < tieEps ? null : (
                    <span
                      aria-hidden
                      className="absolute top-1/2 block h-[7px] -translate-y-1/2 bg-foreground/70"
                      style={
                        r.delta > 0
                          ? { left: "50%", width: `${pct}%`, minWidth: 1 }
                          : { left: `${50 - pct}%`, width: `${pct}%`, minWidth: 1 }
                      }
                    />
                  )}
                </td>
                <td className="py-[3px] text-right font-mono text-[11px] tabular-nums text-foreground">
                  {signed(r.delta)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} className="pr-4 pt-2 align-top font-mono text-[10px] uppercase tracking-[0.16em] text-ns-muted">
              Δ score · candidate − baseline
            </td>
            <td className="relative pt-2">
              <span className="block h-px w-full bg-border" />
              <span className="mt-1 flex justify-between font-mono text-[10px] tabular-nums text-ns-muted">
                <span>{"−"}{max.toFixed(2)}</span>
                <span>0</span>
                <span>+{max.toFixed(2)}</span>
              </span>
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default EvalDeltaTable;
