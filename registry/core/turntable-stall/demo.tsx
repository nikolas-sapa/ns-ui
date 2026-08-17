"use client";

import { useState } from "react";
import { TurntableSwitcher } from "./component";

export default function TurntableSwitcherDemo() {
  const [log, setLog] = useState<string[]>([]);

  return (
    <div className="flex min-h-screen items-start justify-center bg-background px-6 py-20 text-foreground">
      <div className="w-full max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-widest text-ns-muted">
          ns-ui / turntable-stall
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Switching authority has a middle
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ns-muted">
          Open the switcher and pick a different org. The bridge slews on a
          real spring — it overshoots, it takes a moment, and the org-scoped
          nav below it visibly disconnects the instant you commit. It only
          reconnects once the bridge is exactly on the stall angle AND the
          simulated server has confirmed the switch — not one moment sooner.
        </p>

        <div className="mt-10 rounded-md border border-border bg-background p-6">
          <TurntableSwitcher
            defaultValue="acme"
            onValueChange={(id) => setLog((l) => [id, ...l].slice(0, 6))}
          />
        </div>

        <p className="mt-4 font-mono text-xs text-ns-muted">
          {log.length === 0
            ? "connected → awaiting a switch"
            : `connected → ${log.join(" ← ")}`}
        </p>
      </div>
    </div>
  );
}
