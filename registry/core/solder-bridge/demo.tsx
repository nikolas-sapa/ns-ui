"use client";

import { useState } from "react";
import { SolderBridge } from "./component";

// Real, user-driven state — clicking/keying the switch flips it. The
// landing-page card still animates unattended: meta.json's
// `autoplay: { mode: "press" }` has the shared driver (app/preview/[name]/
// autoplay-driver.tsx) synthesize genuine pointer presses on the
// `button[role="switch"]` target, which land on the same onCheckedChange
// below — no separate self-driving timer needed here. A second,
// non-interactive instance pinned to a partial `ratio` shows that prop
// independent of the boolean switch.
export default function SolderBridgeDemo() {
  const [checked, setChecked] = useState(false);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / solder-bridge
      </p>

      <div className="flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3">
          <SolderBridge
            checked={checked}
            onCheckedChange={setChecked}
            aria-label="Route traffic to secondary"
          />
          <p className="font-mono text-[11px] uppercase tracking-wide text-muted">
            {checked ? "on — 90% routed right" : "off — 90% routed left"}
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <SolderBridge ratio={0.35} aria-label="Cache allocation" />
          <p className="font-mono text-[11px] uppercase tracking-wide text-muted">
            ratio=0.35 — partial allocation
          </p>
        </div>
      </div>

      <p className="max-w-md text-center text-xs text-muted">
        Click or press Space to toggle. Mass melts across the neck and
        pinches off; the ratio prop renders any partial split directly.
      </p>
    </div>
  );
}
