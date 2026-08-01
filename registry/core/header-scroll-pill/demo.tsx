"use client";

import { useEffect, useRef } from "react";
import { ScrollIsland } from "./component";

// Self-driving: scripted scroll checkpoints move the page through top ->
// each section -> a fast upward flick back to top, exercising the compact
// pill, the section label roll, and the overshoot flick without needing any
// pointer/keyboard input in the loop.
const SECTIONS = [
  { id: "intro", label: "Intro" },
  { id: "work", label: "Work" },
  { id: "process", label: "Process" },
  { id: "contact", label: "Contact" },
];

const CHECKPOINTS: { y: number; ms: number; fast?: boolean }[] = [
  { y: 0, ms: 1200 },
  { y: 900, ms: 1400 },
  { y: 1800, ms: 1400 },
  { y: 2700, ms: 1400 },
  { y: 0, ms: 1600, fast: true },
];

export default function ScrollIslandDemo() {
  const stepRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      const cp = CHECKPOINTS[stepRef.current % CHECKPOINTS.length]!;
      if (cp.fast) {
        // fast upward flick: jump most of the way, then a quick final step
        window.scrollTo({ top: cp.y + 400, behavior: "auto" });
        requestAnimationFrame(() => {
          requestAnimationFrame(() => window.scrollTo({ top: cp.y, behavior: "auto" }));
        });
      } else {
        window.scrollTo({ top: cp.y, behavior: "smooth" });
      }
      stepRef.current += 1;
      timerRef.current = setTimeout(run, cp.ms);
    };

    timerRef.current = setTimeout(run, 500);
    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div id="top" className="min-h-screen">
      <ScrollIsland wordmark="ns-ui" sections={SECTIONS} />

      <div className="flex flex-col items-center gap-2 px-6 pb-10 pt-28">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          ns-ui / header-scroll-pill
        </p>
        <p className="max-w-md text-center text-xs text-muted">
          Scroll to compress the bar into a pill; a fast upward scroll flicks
          it back open with overshoot.
        </p>
      </div>

      {SECTIONS.map((s, i) => (
        <section
          key={s.id}
          id={s.id}
          className="flex h-[900px] flex-col items-center justify-center gap-4 border-t border-border px-6"
        >
          <span className="font-mono text-xs uppercase tracking-wide text-muted">
            Section {i + 1} of {SECTIONS.length}
          </span>
          <h2 className="text-3xl font-medium text-foreground">{s.label}</h2>
          <p className="max-w-sm text-center text-sm text-muted">
            Fake page content for the scroll demo — the header above reacts
            to scroll position and this section's visibility.
          </p>
        </section>
      ))}
    </div>
  );
}
