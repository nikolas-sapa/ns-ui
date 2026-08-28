"use client";

import { WeldNuggetGrow } from "./component";

export default function WeldNuggetGrowDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / weld-nugget-grow — hold to merge
      </p>
      <WeldNuggetGrow onConfirm={() => {}}>Hold to merge</WeldNuggetGrow>
    </div>
  );
}
