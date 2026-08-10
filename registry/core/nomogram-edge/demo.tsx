"use client";

import { useState } from "react";
import { NomogramEdge } from "./component";

// requests x unit price -> monthly cost, plus a second capacity read: active
// users x events per user -> monthly event volume. Same mechanism, different
// domains, so the middle scale genuinely lands at a different physical
// fraction of its column for each instance (see component.tsx's header).
export default function NomogramEdgeDemo() {
  const [result, setResult] = useState<number | null>(null);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-3xl">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / nomogram-edge
        </p>
        <h1 className="text-lg font-semibold text-foreground">
          The answer is where the straightedge crosses
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-ns-muted">
          Drag either handle. The line stays taut between them and the middle
          scale reads the product off wherever it crosses — no separate
          calculation, the geometry is the calculation.
        </p>

        <div className="mt-5">
          <NomogramEdge
            onValuesChange={(_l, _r, w) => setResult(w)}
          />
        </div>

        {result !== null ? (
          <p className="mt-2 font-mono text-[11px] text-ns-muted">
            last committed read: {result >= 1000 ? `$${Math.round(result).toLocaleString()}/mo` : `$${result.toFixed(2)}/mo`}
          </p>
        ) : null}

        <div className="mt-6">
          <NomogramEdge
            leftLabel="Active users"
            rightLabel="Events / user / mo"
            middleLabel="Monthly events"
            leftMin={10}
            leftMax={10_000}
            rightMin={0.5}
            rightMax={50}
            defaultLeftValue={2_000}
            defaultRightValue={12}
            formatLeft={(v) => `${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v)} users`}
            formatRight={(v) => `${v.toFixed(1)} events`}
            formatResult={(v) =>
              v >= 1000 ? `${Math.round(v).toLocaleString()} events/mo` : `${v.toFixed(1)} events/mo`
            }
          />
        </div>
      </div>
    </main>
  );
}
