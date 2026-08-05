"use client";

import { ChartFunnelStageDrop } from "./component";

const DATA = [
  { label: "Visited", value: 12400 },
  { label: "Signed up", value: 6200 },
  { label: "Activated", value: 3100 },
  { label: "Subscribed", value: 980 },
];

export default function ChartFunnelStageDropDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / chart-funnel-stage-drop
        </p>
        <div className="rounded-md border border-border bg-surface p-5">
          <ChartFunnelStageDrop data={DATA} title="Signup funnel" />
        </div>
      </div>
    </main>
  );
}
