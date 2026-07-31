"use client";

import { useEffect, useState } from "react";
import { GelWash } from "./component";

// Self-driving: load, lift, rest, load again — so the card and the preview both
// show the whole cycle without anyone touching it.
export default function GelWashDemo() {
  const [run, setRun] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    // Weighted towards the wash being up: the card is a still frame most of the
    // time, and a still frame of the page it already uncovered says nothing.
    const up = window.setTimeout(() => setReady(true), 3000);
    const next = window.setTimeout(() => setRun((r) => r + 1), 7000);
    return () => {
      window.clearTimeout(up);
      window.clearTimeout(next);
    };
  }, [run]);

  return (
    <div className="relative min-h-screen">
      <section className="flex min-h-screen flex-col justify-center gap-6 px-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">ns-ui / gel-wash</p>
        <h1 className="max-w-2xl text-4xl leading-tight text-foreground">
          The page was already here. Three stage gels were in front of it.
        </h1>
        <p className="max-w-md text-sm text-muted">
          The blackout leaves first, so the last thing you see is coloured light sweeping off real
          content — not a panel vanishing over nothing.
        </p>
        <button
          type="button"
          onClick={() => setRun((r) => r + 1)}
          // z-[60]: above the wash, so it stays reachable mid-cycle.
          className="relative z-[60] w-fit rounded-[6px] border border-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-foreground hover:bg-border/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Run again
        </button>
      </section>

      <GelWash key={run} ready={ready} label="Loading" />
    </div>
  );
}
