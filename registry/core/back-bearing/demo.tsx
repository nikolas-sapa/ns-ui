"use client";

import { BackBearing } from "./component";

export default function BackBearingDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / back-bearing
      </p>
      <BackBearing label="Departure bearing" defaultValue={42} className="max-w-xs" />
      <p className="max-w-sm text-center font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        drag the card, or type a heading
      </p>
    </div>
  );
}
