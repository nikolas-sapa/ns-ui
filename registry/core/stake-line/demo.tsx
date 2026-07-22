"use client";

import { StakeLine } from "./component";

export default function StakeLineDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / stake-line — staked out before the data arrives
      </p>

      <div className="w-full max-w-[560px] rounded-md border border-border bg-surface p-8">
        <StakeLine
          title="No projects yet"
          description="Projects show up here once you create one — the layout below is already staked out and waiting."
          actionLabel="Create a project"
          shape={{ kind: "cards", count: 6, columns: 3 }}
        />
      </div>
    </div>
  );
}
