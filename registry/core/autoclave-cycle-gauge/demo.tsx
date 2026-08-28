"use client";

import { AutoclaveCycleGauge } from "./component";

export default function AutoclaveCycleGaugeDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / autoclave-cycle-gauge</p>

      <AutoclaveCycleGauge label="Rendering export" />

      <p className="max-w-md text-center text-xs text-ns-muted">
        A long-running export, mid-flight: a slow come-up, a steady hold, then a fast release. This can take a few
        minutes — you can close the tab.
      </p>
    </div>
  );
}
