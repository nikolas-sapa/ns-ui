"use client";

import { useEffect, useRef } from "react";
import { SieveFacets } from "./component";

// Self-driving: the facets are real uncontrolled toggle buttons, so the
// script dispatches real clicks on the rendered chips on a timer — toggling
// one facet off (opens a gap, particles sift through, count widens) then
// back on, with no pointer or keyboard input required to see every state.
const SCRIPT = [
  { index: 1, delay: 1000 },
  { index: 1, delay: 3000 },
];

export default function SieveFacetsDemo() {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timers = SCRIPT.map(({ index, delay }) =>
      setTimeout(() => {
        const chips = wrapRef.current?.querySelectorAll<HTMLButtonElement>("button[aria-pressed]");
        chips?.[index]?.click();
      }, delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / filter-facet-mesh
      </p>
      <div ref={wrapRef} className="w-full max-w-md">
        <SieveFacets />
      </div>
      <p className="max-w-xs text-center text-xs text-muted">
        Toggle a facet — the mesh gains or loses a thread and the result
        count sifts to its new value.
      </p>
    </main>
  );
}
