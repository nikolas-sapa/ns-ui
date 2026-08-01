"use client";

import { useState } from "react";
import { StakeLine } from "./component";

const CSS = `
@keyframes ns-stake-demo-in{from{opacity:0;transform:translateY(6px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
@media (prefers-reduced-motion: reduce) {
  .ns-stake-demo-card { animation: none !important; opacity: 1; transform: none; }
}
`;

export default function StakeLineDemo() {
  const [created, setCreated] = useState(false);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <style>{CSS}</style>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / empty-state-survey — staked out before the data arrives
      </p>

      <div className="ns-stake-demo-frame w-full max-w-[560px] rounded-md border border-border bg-surface p-8">
        {created ? (
          <div role="status" className="grid grid-cols-3 gap-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="ns-stake-demo-card flex aspect-[4/3] flex-col justify-between rounded-md border border-border p-3"
                style={{
                  animation: "ns-stake-demo-in 320ms cubic-bezier(.34,1.56,.64,1) both",
                  animationDelay: `${i * 180}ms`,
                }}
              >
                <span className="text-xs font-medium text-foreground">Project {i + 1}</span>
                <span className="text-[11px] text-muted">Updated just now</span>
              </div>
            ))}
          </div>
        ) : (
          <StakeLine
            title="No projects yet"
            description="Projects show up here once you create one — the layout below is already staked out and waiting."
            actionLabel="Create a project"
            shape={{ kind: "cards", count: 6, columns: 3 }}
            onAction={() => setCreated(true)}
          />
        )}
      </div>
    </div>
  );
}
