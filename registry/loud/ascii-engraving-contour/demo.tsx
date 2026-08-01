"use client";

import { BurinEtch } from "./component";

export default function BurinEtchDemo() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / burin-etch — move the cursor across the plate
      </p>
      <div className="h-[70vh] w-full max-w-3xl overflow-hidden rounded-[16px] border border-border bg-background">
        <BurinEtch className="rounded-[16px]" />
      </div>
      <p className="max-w-md text-center text-xs text-muted">
        Hatch density comes from contour bands through an orbiting metaball
        field, not from raw brightness — the pointer polishes a trail finer,
        and the plate slips on a fixed interval and self-heals.
      </p>
    </main>
  );
}
