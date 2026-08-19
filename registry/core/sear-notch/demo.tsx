"use client";

import { useState } from "react";
import { SearNotch, type SearNotchPoint } from "./component";

// deterministic PRNG (mulberry32) — fixed seed so the backtest dataset is
// byte-identical between server and client render, no hydration mismatch
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// smoothstep ramp so a spike's edges are a curve the crossing-interpolation
// resolves cleanly, not an instant vertical jump
function smoothstep(t: number) {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

// Two dominant spikes, sized so at rest (threshold 280ms, dwell 5m) each
// classified excursion is a real fraction of the chart, not a hairline: a
// ~224s excursion (about 60px wide) stays hollow because it never dwelled
// the required 5 minutes, and a ~484s excursion (about 130px wide) fires
// solid because it did. A third ~17s blip is background noise the rule
// correctly ignores, not one of the two shapes the demo is built around. A
// 30-minute window keeps both real excursions legible instead of shrinking
// them to a sliver against a full hour.
const SPIKES: { start: number; dur: number; peak: number }[] = [
  { start: 100, dur: 15, peak: 300 },
  { start: 300, dur: 220, peak: 340 },
  { start: 700, dur: 480, peak: 350 },
];

const WINDOW_S = 1800;
const STEP_S = 5;
const BASELINE = 180;

function buildData(): SearNotchPoint[] {
  const rand = mulberry32(20260817);
  const points: SearNotchPoint[] = [];
  for (let s = 0; s <= WINDOW_S; s += STEP_S) {
    let v = BASELINE + 15 * Math.sin(s / 210) + (rand() - 0.5) * 12;
    for (const spike of SPIKES) {
      const edge = 4; // seconds of ramp in/out
      if (s >= spike.start - edge && s <= spike.start + spike.dur + edge) {
        let frac = 1;
        if (s < spike.start) frac = smoothstep((s - (spike.start - edge)) / edge);
        else if (s > spike.start + spike.dur) frac = smoothstep(1 - (s - (spike.start + spike.dur)) / edge);
        v = v + (spike.peak - v) * frac;
      }
    }
    points.push({ t: s * 1000, v: Math.round(v * 10) / 10 });
  }
  return points;
}

const DATA = buildData();
const LAST_VALUE = DATA[DATA.length - 1].v;
const SPIKE_VALUE = 340;

export default function SearNotchDemo() {
  const [simulateLive, setSimulateLive] = useState(false);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">ns-ui / sear-notch</p>
        <h1 className="text-lg font-semibold text-foreground">Checkout latency alert</h1>
        <p className="mt-1 text-sm leading-relaxed text-ns-muted">
          Drag the notch floor to set the threshold and its right shoulder to set how long the
          metric has to dwell above it. Excursions are replayed against that exact rule — hollow
          means it crossed but never dwelled long enough, solid means it would have paged.
        </p>

        <div className="mt-5 rounded-md border border-border p-5">
          <SearNotch
            metricLabel="Checkout p99 latency"
            windowLabel="past 30 min"
            unit="ms"
            data={DATA}
            liveValue={simulateLive ? SPIKE_VALUE : LAST_VALUE}
            defaultThreshold={280}
            defaultForMs={300_000}
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-4 rounded-md border border-border px-5 py-3">
          <span className="font-mono text-[11px] text-ns-muted">
            simulate the live reading holding above threshold
          </span>
          <button
            type="button"
            onClick={() => setSimulateLive((s) => !s)}
            aria-pressed={simulateLive}
            className="rounded-sm border border-border px-3 py-1.5 font-mono text-[11px] tracking-widest text-ns-muted transition-colors duration-200 hover:border-foreground/20 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            {simulateLive ? "STOP" : "SIMULATE SPIKE"}
          </button>
        </div>

        <p className="mt-3 font-mono text-[11px] text-ns-muted">
          the sear beside the chart winds up in real time while the live value holds above
          threshold, and releases the instant dwell reaches the required duration
        </p>
      </div>
    </main>
  );
}
