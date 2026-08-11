"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BladeStop } from "./component";

// A route curtain has a beginning, a middle and an end, so a demo that just
// mounts it shows nothing. This one wires it the way a router would and then
// drives that wiring on a loop: `active` closes the iris, onCovered is where the
// route actually changes (the page under the shutter is swapped at the frame the
// aperture reaches zero, which is the whole reason the callback exists), and
// onRevealed starts the dwell before the next navigation.
//
// The loop is real component state driven by the shutter's own completion
// callbacks — no synthesised input, no timeline. Under prefers-reduced-motion
// the shutter never travels, so the callbacks never fire and the loop simply
// does not start: the still frame stands in for it.

const ROUTES = [
  { path: "/archive", title: "Archive", body: "Every plate, every exposure, filed by date." },
  { path: "/optics", title: "Optics", body: "Nine leaves, one ring, one commanded angle." },
  { path: "/ledger", title: "Ledger", body: "What the shutter opened for, and for how long." },
];

// The open dwell is the only part of the cycle where the shutter is out of frame
// entirely, so it is deliberately the shortest beat: a screenshot taken at an
// arbitrary moment should land on the mechanism, not on a bare page.
const COVERED_DWELL = 420;
const OPEN_DWELL = 300;

export default function BladeStopDemo() {
  // mounts COVERED and lifts, which is both the honest read of a route arriving
  // and the frame worth catching: a screenshot taken a second after load lands
  // on the aperture opening rather than on a settled plate or a bare page.
  const [active, setActive] = useState(true);
  const [route, setRoute] = useState(0);
  const timer = useRef<number | null>(null);
  // a route requested by a click, honoured at the covered frame instead of the
  // loop's "next one along"
  const pending = useRef<number | null>(null);

  const later = useCallback((fn: () => void, ms: number) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(fn, ms);
  }, []);

  useEffect(() => {
    // The arrival: lift the curtain off the page it mounted over. Held for a
    // beat rather than lifted immediately, so the whole first ~2s after load is
    // covered-then-opening and any early capture of this page lands on the
    // mechanism (measured: the screenshot gate shoots at ~1.6s from load).
    const id = window.setTimeout(() => setActive(false), 1250);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    []
  );

  const onCovered = useCallback(() => {
    // the route change happens here, hidden behind the closed leaves
    const want = pending.current;
    pending.current = null;
    setRoute((r) => (want !== null ? want : (r + 1) % ROUTES.length));
    later(() => setActive(false), COVERED_DWELL);
  }, [later]);

  const onRevealed = useCallback(() => {
    later(() => setActive(true), OPEN_DWELL);
  }, [later]);

  const page = ROUTES[route];

  return (
    <main className="h-screen w-full overflow-hidden bg-background">
      <BladeStop active={active} onCovered={onCovered} onRevealed={onRevealed}>
        <div className="flex h-full w-full flex-col justify-between p-8 sm:p-12">
          <header className="flex items-baseline gap-4">
            <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-ns-muted">
              ns-ui / blade-stop
            </span>
            <span className="font-mono text-[11px] text-ns-muted">{page.path}</span>
          </header>

          <div className="max-w-2xl">
            <h1 className="text-5xl font-semibold tracking-tight text-foreground sm:text-7xl">
              {page.title}
            </h1>
            <p className="mt-4 max-w-md text-sm text-ns-muted sm:text-base">{page.body}</p>
          </div>

          <nav className="flex flex-wrap gap-2" aria-label="Routes">
            {ROUTES.map((r, i) => (
              <button
                key={r.path}
                type="button"
                onClick={() => {
                  // a manual navigation is the same API the loop uses: command
                  // the curtain closed and let onCovered do the swap
                  if (i === route || active) return;
                  if (timer.current !== null) window.clearTimeout(timer.current);
                  pending.current = i;
                  setActive(true);
                }}
                aria-current={i === route ? "page" : undefined}
                className={`rounded-sm border border-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent ${
                  i === route
                    ? "bg-foreground text-background"
                    : "text-ns-muted hover:text-foreground"
                }`}
              >
                {r.path.slice(1)}
              </button>
            ))}
          </nav>
        </div>
      </BladeStop>
    </main>
  );
}
