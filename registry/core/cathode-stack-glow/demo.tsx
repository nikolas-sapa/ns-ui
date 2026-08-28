"use client";

import { useState } from "react";
import { CathodeStackGlow } from "./component";

export default function CathodeStackGlowDemo() {
  const [count, setCount] = useState(482);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-16 bg-background p-6">
      <p className="font-mono text-xs tracking-widest text-ns-muted">
        ns-ui / cathode-stack-glow
      </p>

      <div className="flex flex-wrap items-center justify-center gap-12">
        <div className="flex flex-col items-center gap-3">
          <CathodeStackGlow value={String(count)} className="h-24 w-40" />
          <p className="font-mono text-[11px] tracking-[0.25em] text-ns-muted">
            ACTIVE USERS
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <CathodeStackGlow value="$1,240.00" className="h-20 w-72" />
          <p className="font-mono text-[11px] tracking-[0.25em] text-ns-muted">
            MRR
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setCount((c) => c + Math.ceil(Math.random() * 9))}
        className="rounded-sm border border-border px-4 py-1.5 font-mono text-[11px] tracking-widest text-ns-muted transition-colors duration-200 hover:border-white/20 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
      >
        bump count
      </button>
      <p className="max-w-md text-center font-mono text-[11px] text-ns-muted">
        every so often a cell silently sweeps through all ten digits at low
        duty cycle to keep unused cathodes from fouling — watch long enough
        and you'll catch one
      </p>
    </main>
  );
}
