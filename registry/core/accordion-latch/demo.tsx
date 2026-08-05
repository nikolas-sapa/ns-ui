"use client";

import { useEffect, useRef } from "react";
import { HaspFold, type HaspFoldItem } from "./component";

const ITEMS: HaspFoldItem[] = [
  {
    id: "manifest",
    title: "Cargo manifest",
    content: "Fourteen crates, sealed at the depot, checksum verified on arrival.",
  },
  {
    id: "route",
    title: "Route notes",
    content: "Coastal leg first, inland transfer at the junction, one overnight hold.",
  },
  {
    id: "custody",
    title: "Chain of custody",
    content: "Signed at every handoff — depot, transfer, final delivery.",
  },
];

// Self-driving: real click() dispatch on the header buttons, on a timer,
// so the demo exercises the same code path a pointing user would and the
// screenshot gate catches the board mid-open/mid-close rather than only
// ever at rest — matching autosave-ratchet's script-driven-through-real-state
// pattern, just via DOM clicks instead of a prop.
const SCRIPT_IDS = ["manifest", "route", "custody", "route"];
const STEP_MS = 2400;

export default function HaspFoldDemo() {
  const rootRef = useRef<HTMLDivElement>(null);
  const stepRef = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => {
      const id = SCRIPT_IDS[stepRef.current % SCRIPT_IDS.length];
      const header = rootRef.current?.querySelector<HTMLButtonElement>(
        `button[aria-controls$="-p-${id}"]`
      );
      header?.click();
      stepRef.current += 1;
    }, STEP_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / accordion-latch
      </p>

      <div ref={rootRef} className="w-full max-w-md">
        <HaspFold items={ITEMS} defaultOpen={["manifest"]} />
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        Opening rotates the hasp off its staple, lifts the lid, then unfolds
        the section — closing reverses and the hasp drops with a settle.
      </p>
    </div>
  );
}
