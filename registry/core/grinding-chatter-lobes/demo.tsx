"use client";

import { GrindingChatterLobes } from "./component";

export default function GrindingChatterLobesDemo() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / grinding-chatter-lobes
      </p>
      <GrindingChatterLobes />
      <p className="max-w-sm text-center font-mono text-[11px] tracking-widest text-ns-muted">
        rim self-excites into a lobed profile, saturates, dresses, repeats
      </p>
    </main>
  );
}
