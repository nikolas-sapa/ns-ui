"use client";

import { useEffect, useState } from "react";
import { HatchFill } from "./component";

export default function HatchFillDemo() {
  const [value, setValue] = useState(0);

  // self-driving run, same reasoning as the other determinate meters in this
  // suite: the meter reflects whatever value a caller feeds it, so the demo
  // supplies its own — no synthetic pointer/scroll input needed, hence
  // autoplay: none rather than a driver mode that would misrepresent this as
  // a scroll-linked component.
  useEffect(() => {
    let v = 0;
    let holdUntil = 0;
    const id = window.setInterval(() => {
      const now = performance.now();
      if (v >= 100) {
        if (holdUntil === 0) holdUntil = now + 1500;
        else if (now >= holdUntil) {
          v = 0;
          holdUntil = 0;
          setValue(0);
        }
        return;
      }
      v = Math.min(100, v + 2 + Math.random() * 4);
      setValue(v);
    }, 160);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      data-hatch-card
      className="flex min-h-screen flex-col items-center justify-center gap-10 px-6"
    >
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / progress-hatch
      </p>
      <div className="flex flex-col gap-8 rounded-xl border border-border bg-surface px-10 py-12">
        <HatchFill value={value} aria-label="Build progress" totalChars={44} className="text-xl" />
        <HatchFill
          value={100 - value}
          aria-label="Disk usage"
          totalChars={44}
          marks={[0, 20, 40, 60, 80, 100]}
          className="text-xl"
        />
      </div>
    </div>
  );
}
