"use client";

import { AsciiDissolveTransition } from "./component";

function OverviewPanel() {
  return (
    <div className="flex h-full w-full flex-col justify-between bg-background p-6 font-mono">
      <p className="text-xs uppercase tracking-widest text-muted">Overview</p>
      <div className="flex flex-col gap-2">
        <p className="text-3xl font-semibold text-foreground">1,204</p>
        <p className="text-xs text-muted">active sessions</p>
      </div>
    </div>
  );
}

function DetailPanel() {
  return (
    <div className="flex h-full w-full flex-col justify-between bg-background p-6 font-mono">
      <p className="text-xs uppercase tracking-widest text-muted">Session Detail</p>
      <div className="flex flex-col gap-2">
        <p className="text-3xl font-semibold text-accent">#a41f</p>
        <p className="text-xs text-muted">connected 04:12</p>
      </div>
    </div>
  );
}

export default function AsciiDissolveTransitionDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">ns-ui / transition-ascii-dissolve</p>
      <AsciiDissolveTransition
        from={<OverviewPanel />}
        to={<DetailPanel />}
        className="h-64 w-full max-w-md"
      />
    </div>
  );
}
