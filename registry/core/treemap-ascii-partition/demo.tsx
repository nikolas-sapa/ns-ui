"use client";

import { AsciiPartition } from "./component";

export default function AsciiPartitionDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / treemap-ascii-partition
      </p>

      <div className="inline-block rounded-[12px] border border-border bg-background p-6">
        <AsciiPartition />
      </div>

      <p className="max-w-md text-center text-xs text-muted">
        Click a rectangle to descend a level; density is an ASCII ramp keyed
        to value. Use the breadcrumb or Escape to climb back out.
      </p>
    </div>
  );
}
