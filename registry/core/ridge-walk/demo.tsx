"use client";

import { RidgeWalk, type RidgeWalkModel } from "./component";

// Dominated models keep a clear x-gap from their dominators so their ticks
// (and the 22px overlay hit targets) never stack — near-coincident points
// made the dominated tick's centre unhittable behind its neighbour.
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
      <div className="w-full max-w-2xl">
        <p className="mb-10 text-center font-mono text-xs tracking-widest text-muted">
          ns-ui / ridge-walk
        </p>
        <div className="mx-auto mb-10 max-w-xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">
            Pick a point on the curve
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Every model plotted by cost, latency, and quality. The ridge is
            the frontier — dominated models sit honestly below it, still
            selectable.
          </p>
        </div>
        <RidgeWalk models={MODELS} scoreLabel="MMLU" />
        <p className="mt-10 text-center font-mono text-[11px] text-muted">
          Drag along the ridge, or arrow through it — Home and End jump to
          the ends.
        </p>
      </div>
    </main>
  );
}
