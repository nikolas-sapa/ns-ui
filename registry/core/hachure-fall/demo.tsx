"use client";

import { HachureFall, type ElevationPoint } from "./component";

// A rolling 60km ride: a long flat run-in, a short punchy ramp, a plateau,
// a fast descent, then the day's real climb — steep enough near the top to
// show the comb going dense — before a false-flat finish. Distinct shapes,
// on purpose, so flat/steep/descent all read side by side.
const RIDE: ElevationPoint[] = [
  { km: 0, m: 40 },
  { km: 3, m: 42 },
  { km: 6, m: 41 },
  { km: 9, m: 44 },
  { km: 12, m: 46 },
  { km: 12.4, m: 62 },
  { km: 12.8, m: 86 },
  { km: 13.2, m: 104 },
  { km: 13.6, m: 116 },
  { km: 14, m: 122 },
  { km: 16, m: 124 },
  { km: 18, m: 121 },
  { km: 20, m: 123 },
  { km: 20.5, m: 96 },
  { km: 21, m: 66 },
  { km: 21.5, m: 40 },
  { km: 22, m: 22 },
  { km: 22.5, m: 12 },
  { km: 25, m: 14 },
  { km: 28, m: 16 },
  { km: 30, m: 18 },
  { km: 30.5, m: 34 },
  { km: 31, m: 58 },
  { km: 31.5, m: 90 },
  { km: 32, m: 128 },
  { km: 32.5, m: 172 },
  { km: 33, m: 222 },
  { km: 33.4, m: 264 },
  { km: 33.8, m: 300 },
  { km: 34.2, m: 328 },
  { km: 34.6, m: 348 },
  { km: 35, m: 360 },
  { km: 37, m: 366 },
  { km: 40, m: 372 },
  { km: 43, m: 376 },
  { km: 46, m: 380 },
];

export default function HachureFallDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / hachure-fall — stroke length is the only unit that matters
      </p>

      <div className="w-full max-w-2xl rounded-md border border-border bg-surface p-6">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Saturday club ride</h2>
            <p className="mt-1 text-sm text-ns-muted">46 km · Home lanes to the ridge climb</p>
          </div>
          <span className="shrink-0 rounded-full border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-ns-muted">
            +840 m
          </span>
        </div>

        <HachureFall data={RIDE} label="Saturday club ride elevation profile" />

        <p className="mt-4 font-mono text-[11px] text-ns-muted">
          hover or focus the profile — arrow keys move by distance, Page Up/Down jump to the next
          grade change
        </p>
      </div>
    </div>
  );
}
