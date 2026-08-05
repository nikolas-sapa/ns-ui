"use client";

import { RidgeWalk, type RidgeWalkModel } from "./component";

// A realistic model lineup: five sit on the Pareto frontier, two are
// dominated (Nano Plus by Nano, Core Legacy by Core) — so the frontier line,
// the dominated dots below it, and the "quality left on the table" connectors
// all render at rest.
const MODELS: RidgeWalkModel[] = [
  { id: "nano", name: "Atlas Nano", cost: 0.1, latency: 0.5, score: 58 },
  { id: "nano-plus", name: "Atlas Nano Plus", cost: 0.35, latency: 0.9, score: 55 },
  { id: "mini", name: "Atlas Mini", cost: 0.25, latency: 0.7, score: 68 },
  { id: "core", name: "Atlas Core", cost: 0.6, latency: 1.1, score: 79 },
  { id: "core-legacy", name: "Atlas Core Legacy", cost: 0.75, latency: 1.6, score: 74 },
  { id: "pro", name: "Atlas Pro", cost: 1.8, latency: 2.1, score: 88 },
  { id: "ultra", name: "Atlas Ultra", cost: 4.5, latency: 3.4, score: 94 },
];

export default function RidgeWalkDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-xl">
        <p className="mb-10 text-center font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / picker-pareto-frontier
        </p>
        <div className="mx-auto mb-10 max-w-md text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">
            Pick a point on the curve
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ns-muted">
            The rising line is the frontier: you can&apos;t buy more quality
            without paying in cost and latency. Dominated models sit below it —
            strictly worse, still selectable.
          </p>
        </div>
        <RidgeWalk models={MODELS} scoreLabel="MMLU" />
        <p className="mt-8 text-center font-mono text-[11px] text-ns-muted">
          Drag along the ridge, or arrow through the points — Home and End jump
          to the ends.
        </p>
      </div>
    </main>
  );
}
