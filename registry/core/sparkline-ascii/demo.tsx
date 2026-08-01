"use client";

import { RampTrace } from "./component";

const SERIES = [
  12, 18, 15, 22, 30, 28, 34, 40, 37, 44, 52, 48, 55, 61, 58, 64, 70, 66, 72,
  80, 76, 82, 88, 84, 90, 95, 91, 97, 102, 98,
];

export default function RampTraceDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-10">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / ramp-trace
      </p>
      <RampTrace
        data={SERIES}
        label="MRR"
        valueFormat={(v) => `$${v}k`}
        className="w-full max-w-2xl"
      />
      <p className="max-w-md text-center font-mono text-xs text-muted">
        hover a column, or focus the chart and use arrow keys
      </p>
    </div>
  );
}
