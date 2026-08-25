"use client";

import { DividerTelephoneCordDelam } from "./component";

export default function DividerTelephoneCordDelamDemo() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-10 bg-background px-8 py-10">
      <div className="w-full max-w-3xl">
        <h2 className="mb-3 font-mono text-sm text-foreground">Section one</h2>
        <p className="mb-8 max-w-prose font-mono text-xs text-ns-muted">
          A compressed film delaminating from its substrate stands in for a
          plain rule — the buckle front wanders and re-forks continuously,
          never settling.
        </p>
        <DividerTelephoneCordDelam />
      </div>
      <div className="w-full max-w-3xl">
        <h2 className="mt-8 font-mono text-sm text-foreground">Section two</h2>
      </div>
    </div>
  );
}
