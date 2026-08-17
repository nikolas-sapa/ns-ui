"use client";

import { ForageVein } from "./component";

export default function ForageVeinDemo() {
  return (
    <main className="min-h-screen bg-background">
      {/* no scripted path here — the veins on screen are whatever the sim's
          trail-following agents actually reinforced between the headline,
          the button and each logo below (every data-vein-node element is
          its own food source) since mount */}
      <ForageVein className="min-h-screen">
        <div data-vein-node className="mx-auto max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-ns-muted">
            ns-ui / forage-vein
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
            The topology finds itself.
          </h1>
          <p className="mt-4 text-sm text-ns-muted sm:text-base">
            Thousands of foraging agents lay and lose trail between this headline, the button
            below, and the row under it. Nothing here is a drawn line.
          </p>
        </div>
        <div>
          <a
            data-vein-node
            href="#docs"
            className="inline-flex items-center justify-center rounded-full bg-ns-accent px-6 py-3 text-sm font-medium text-white transition-colors duration-150 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            Read the docs
          </a>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-6 font-mono text-xs uppercase tracking-widest text-ns-muted">
          <span data-vein-node>Latency Co</span>
          <span data-vein-node>Peer Point</span>
          <span data-vein-node>Undersea</span>
          <span data-vein-node>Last Mile</span>
        </div>
      </ForageVein>
    </main>
  );
}
