"use client";

import { RupertSnap } from "./component";

// Compliance > Audit log, at the width the table actually gets in a settings
// pane. The default 14-entry dataset is left alone: it is already seeded with
// the two facts the component exists to show — a plausible mixed-actor trail
// (humans, a CI deploy, an ops bot) and enough length that a tamper near the
// tail leaves a clearly untouched head above the break.
//
// breakIndex is pinned to 9 (entry #10, `role.granted:owner`) rather than left
// to the component's `length - 5` default so the resting screenshot and the
// tamper cascade always name the same row, and so the tampered entry is the one
// a reader would actually care about having been edited after the fact.
export default function RupertSnapDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / rupert-snap
      </p>

      <div className="w-full max-w-3xl">
        <RupertSnap breakIndex={9} />
      </div>

      <p className="max-w-xl text-center text-xs text-ns-muted">
        Each entry&apos;s stored hash is a function of its own fields and the previous entry&apos;s
        hash. Editing entry 10 after the fact re-derives every hash from 10 onward, so the two chains
        disagree from exactly that row down — the head of the log never moves, because nothing above
        the break depends on it.
      </p>
    </div>
  );
}
