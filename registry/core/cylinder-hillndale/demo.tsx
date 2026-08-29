"use client";

import { CylinderHillndale } from "./component";

export default function CylinderHillndaleDemo() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-10 bg-background px-8 py-10">
      <div className="w-full max-w-3xl">
        <h2 className="mb-3 font-mono text-sm text-foreground">Section one</h2>
        <p className="mb-8 max-w-prose font-mono text-xs text-ns-muted">
          A rotating cylinder and its lead-screw-driven stylus carriage
          stand in for a plain rule, same idea as{" "}
          <code>&lt;hr /&gt;</code> — rotation and axial travel locked
          together, one wrap per turn.
        </p>
        <CylinderHillndale />
      </div>
      <div className="w-full max-w-3xl">
        <h2 className="mt-8 font-mono text-sm text-foreground">Section two</h2>
      </div>
    </div>
  );
}
