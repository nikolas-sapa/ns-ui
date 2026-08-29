"use client";

import { useRef, useState } from "react";
import { AirliftSlugFlow } from "./component";

const FILES = ["invoice-2026-q3.pdf", "design-tokens.json", "onboarding.mp4", "roadmap.xlsx"];

export default function AirliftSlugFlowDemo() {
  const [pulseRow, setPulseRow] = useState(-1);
  const cursorRef = useRef(0);

  const onSlugArrival = () => {
    const row = cursorRef.current % FILES.length;
    cursorRef.current += 1;
    setPulseRow(row);
    window.setTimeout(() => setPulseRow((r) => (r === row ? -1 : r)), 500);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-md">
        <p className="mb-6 text-center font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / airlift-slug-flow
        </p>
        <div className="flex gap-4 rounded-md border border-border p-4">
          <div className="h-72">
            <AirliftSlugFlow onSlugArrival={onSlugArrival} className="w-6" />
          </div>
          <ul className="flex flex-1 flex-col divide-y divide-border">
            {FILES.map((name, i) => (
              <li key={name} className="flex items-center justify-between gap-3 py-3">
                <span className="truncate text-sm text-foreground">{name}</span>
                <span
                  className="font-mono text-[10px] uppercase tracking-widest transition-colors duration-300"
                  style={{ color: pulseRow === i ? "var(--foreground)" : "var(--ns-muted)" }}
                >
                  Syncing
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-6 text-center font-mono text-[11px] text-ns-muted">
          discrete air slugs drag a liquid plug up the conduit — delivery in pulses, not a stream
        </p>
      </div>
    </main>
  );
}
