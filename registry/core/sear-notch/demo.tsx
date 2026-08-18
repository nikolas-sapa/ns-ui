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

// six spikes of deliberately varied duration: a couple of seconds (never
// fires, any duration bucket), ~45s (fires only at 30s), ~95s (30s/1m),
// ~7min (30s/1m/5m), ~18min (fires at every bucket including 15m), and one
// more short near-miss near the end — so dragging the duration handle
// across its four stops visibly reclassifies a different subset each time.
const SPIKES: { start: number; dur: number; peak: number }[] = [
  { start: 180, dur: 6, peak: 420 },
  { start: 420, dur: 45, peak: 400 },
  { start: 760, dur: 95, peak: 410 },
  { start: 1150, dur: 420, peak: 430 },
  { start: 1900, dur: 1100, peak: 440 },
  { start: 3100, dur: 20, peak: 405 },
];

const WINDOW_S = 3660;
const STEP_S = 5;
const BASELINE = 180;

function buildData(): SearNotchPoint[] {
  const rand = mulberry32(20260817);
  const points: SearNotchPoint[] = [];
  for (let s = 0; s <= WINDOW_S; s += STEP_S) {
    let v = BASELINE + 22 * Math.sin(s / 210) + (rand() - 0.5) * 16;
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
const SPIKE_VALUE = 430;

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
            windowLabel="past 1h"
            unit="ms"
            data={DATA}
            liveValue={simulateLive ? SPIKE_VALUE : LAST_VALUE}
            defaultThreshold={350}
            defaultForMs={60_000}
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
