"use client";

import { useEffect, useRef } from "react";
import { BallotDrop } from "./component";

// Self-driving: the ballot is a real uncontrolled radio input (clicking is
// the only API), so the script dispatches real clicks on the rendered radio
// buttons on a timer — first casting a vote, then changing it, so the gate's
// screenshot can catch a settled slip and the demo exercises the retract +
// drop path on its own, with no pointer or keyboard input required.
const SCRIPT = [
  { index: 0, delay: 900 },
  { index: 1, delay: 2600 },
];

export default function BallotDropDemo() {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timers = SCRIPT.map(({ index, delay }) =>
      setTimeout(() => {
        const radios = wrapRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
        radios?.[index]?.click();
      }, delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / ballot-drop
      </p>
      <div ref={wrapRef}>
        <BallotDrop />
      </div>
      <p className="max-w-xs text-center text-xs text-muted">
        Pick a slip — it folds and drops through the slot. Choosing another
        pulls the old one back out first.
      </p>
    </main>
  );
}
