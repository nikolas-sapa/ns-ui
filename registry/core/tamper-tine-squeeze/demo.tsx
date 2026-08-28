"use client";

import { TamperTineSqueeze } from "./component";

export default function TamperTineSqueezeDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / tamper-tine-squeeze
      </p>

      <div className="w-full max-w-md">
        <TamperTineSqueeze />
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        A tine pair plunges either side of a sleeper, squeezes shut to pack the ballast beneath
        it, lifts, and steps to the next — an unbounded indeterminate loader for a long-running
        compaction/optimization task.
      </p>
    </div>
  );
}
