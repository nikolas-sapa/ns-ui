"use client";

import { useEffect, useState } from "react";
import { ScreenFloodStroke } from "./component";

// Self-driving: shows the pure ambient loop next to a determinate variant
// whose progress climbs and resets on its own, so both usages demonstrate
// unforced motion with no pointer input required — hence autoplay: none.
export default function ScreenFloodStrokeDemo() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setProgress((v) => (v >= 1 ? 0 : Math.min(1, v + 0.05)));
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      data-screen-flood-stroke-stage
      className="flex min-h-screen flex-col items-center justify-center gap-10 bg-background px-6"
    >
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / screen-flood-stroke
      </p>
      <div className="flex flex-wrap items-center justify-center gap-10">
        <div className="flex flex-col items-center gap-3">
          <ScreenFloodStroke aria-label="Loading" />
          <span className="font-mono text-xs text-ns-muted">ambient</span>
        </div>
        <div className="flex flex-col items-center gap-3">
          <ScreenFloodStroke aria-label="Printing" progress={progress} />
          <span className="font-mono text-xs text-ns-muted">
            determinate — {Math.round(progress * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}
