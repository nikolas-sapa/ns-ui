"use client";

import { useState } from "react";
import { TorsionLatch } from "./component";

export default function TorsionLatchDemo() {
  const [killed, setKilled] = useState(false);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / torsion-latch — drag past the peak to commit
      </p>

      <div className="w-full max-w-md rounded-md border border-border bg-surface p-6">
        <div className="flex items-center justify-between gap-6">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              Kill switch
            </p>
            <p className="mt-1 text-sm text-muted">
              Cuts power to the whole rack. Drag the knob past the over-center
              point to commit, or release early and the spring carries it
              home.
            </p>
          </div>
          <TorsionLatch
            checked={killed}
            onCheckedChange={setKilled}
            aria-label="Kill switch"
          />
        </div>

        <p className="mt-5 border-t border-border pt-4 font-mono text-xs text-muted">
          rack power: {killed ? "cut" : "nominal"}
        </p>
      </div>

      <p className="max-w-md text-center text-xs text-muted">
        Drag the knob — winding past the midpoint whips it on, releasing
        early snaps it back. Focus it and press Space: the first press winds
        to the over-center point and holds, armed; a second press within 3s
        completes the whip. Switching off is single-phase.
      </p>
    </div>
  );
}
