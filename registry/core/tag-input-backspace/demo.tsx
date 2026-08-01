"use client";

import { LooseThread } from "./component";

export default function LooseThreadDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / loose-thread — backspace arms, it doesn&apos;t delete
      </p>
      <LooseThread
        className="max-w-md"
        label="Topics"
        defaultValue={["design-systems", "accessibility", "react", "tokens", "motion"]}
        max={8}
      />
    </div>
  );
}
