"use client";

import { DynamicWeightText } from "./component";

export default function DynamicWeightTextDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / text-variable-weight — move the cursor across
      </p>
      <DynamicWeightText
        text="Weight follows you"
        className="text-6xl tracking-tight"
      />
    </div>
  );
}
