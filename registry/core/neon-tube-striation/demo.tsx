"use client";

import { NeonTubeStriation } from "./component";

export default function NeonTubeStriationDemo() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-10 bg-background px-8 py-10">
      <div className="w-full max-w-3xl">
        <h2 className="mb-3 text-sm text-foreground">Section one</h2>
        <p className="mb-8 max-w-prose text-xs text-ns-muted">
          A lit neon-tube divider in place of a plain rule — moving striations
          drift along the tube while the electrode ends slowly darken.
        </p>
        <NeonTubeStriation />
      </div>
      <div className="w-full max-w-3xl">
        <h2 className="mt-8 text-sm text-foreground">Section two</h2>
      </div>
    </div>
  );
}
