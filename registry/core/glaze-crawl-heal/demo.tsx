"use client";

import { useEffect, useState } from "react";
import { GlazeCrawlHeal, type GlazeStatus } from "./component";

// a realistic system-status card: one live indicator riding out an incident
// and back, plus fixed reference rows so all three kiln states sit on
// screen at once for comparison. No pointer or keyboard in the loop — this
// is an ambient control, not an interactive one.
const RUN: { status: GlazeStatus; ms: number }[] = [
  { status: "healthy", ms: 4200 },
  { status: "degraded", ms: 4600 },
  { status: "down", ms: 4400 },
];

const ROWS: { status: GlazeStatus; service: string }[] = [
  { status: "healthy", service: "API" },
  { status: "degraded", service: "Search index" },
  { status: "down", service: "Webhooks" },
];

export default function GlazeCrawlHealDemo() {
  const [step, setStep] = useState(0);
  const active = RUN[step % RUN.length]!;

  useEffect(() => {
    const t = window.setTimeout(() => setStep((s) => s + 1), active.ms);
    return () => window.clearTimeout(t);
  }, [step, active.ms]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-12 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / glaze-crawl-heal
      </p>

      <div className="flex flex-col items-center gap-10 sm:flex-row sm:items-stretch">
        {/* showpiece — large enough that bubble/crater/patch behaviour clearly reads */}
        <div className="flex flex-col items-center justify-center gap-5 rounded-xl border border-border bg-surface px-10 py-10">
          <GlazeCrawlHeal status={active.status} size={72} showLabel={false} />
          <GlazeCrawlHeal status={active.status} size={16} />
        </div>

        {/* status page row — the realistic inline usage, badge scale */}
        <div className="flex w-[300px] flex-col gap-4 rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Platform</span>
            <GlazeCrawlHeal status={active.status} size={14} />
          </div>
          <div className="h-px w-full bg-border" />
          <ul className="flex flex-col gap-3">
            {ROWS.map((row) => (
              <li key={row.service} className="flex items-center justify-between">
                <span className="text-xs text-ns-muted">{row.service}</span>
                <GlazeCrawlHeal status={row.status} size={14} />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="max-w-md text-center font-mono text-[10px] leading-relaxed text-ns-muted">
        bubbles burst and heal — operational closes in under a second,
        degraded lingers, down crawls into bare patches that never close
      </p>
    </div>
  );
}
