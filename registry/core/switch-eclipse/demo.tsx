"use client";

import { useState } from "react";
import { UmbraToggle } from "./component";

// Real, user-driven state — clicking/dragging/keying the switch flips it.
// The landing-page card still animates unattended: meta.json's
// `autoplay: { mode: "press" }` has the shared driver (app/preview/[name]/
// autoplay-driver.tsx) synthesize genuine pointer presses on the
// `[role="switch"]` track, which land on the same onCheckedChange below —
// no separate self-driving script needed here.
export default function UmbraToggleDemo() {
  const [checked, setChecked] = useState(false);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / umbra-toggle
      </p>

      <div className="flex flex-col items-center gap-6 rounded-[12px] border border-border bg-background px-10 py-10">
        <UmbraToggle checked={checked} onCheckedChange={setChecked} />
        <p className="max-w-xs text-center text-xs text-muted">
          A dark disc eclipses a bright one — the crescent and corona are
          computed geometry, not sprite frames.
        </p>
      </div>
    </div>
  );
}
