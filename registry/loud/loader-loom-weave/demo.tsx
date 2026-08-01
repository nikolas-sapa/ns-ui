"use client";

import { LoomShuttle } from "./component";

export default function LoomShuttleDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / loom-shuttle — progress is cloth on the loom
      </p>
      <LoomShuttle className="w-full max-w-md" />
    </div>
  );
}
