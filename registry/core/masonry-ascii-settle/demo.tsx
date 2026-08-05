"use client";

import { MasonryAsciiSettle, type MasonryAsciiTile } from "./component";

const TILES: MasonryAsciiTile[] = [
  { id: "t1", title: "Meltwater channel", seed: 3, aspect: 0.8 },
  { id: "t2", title: "Condensation study", seed: 11, aspect: 1.25 },
  { id: "t3", title: "Caustic net", seed: 19, aspect: 0.65 },
  { id: "t4", title: "Refraction drift", seed: 27, aspect: 1.05 },
  { id: "t5", title: "Surface tension", seed: 5, aspect: 0.9 },
  { id: "t6", title: "Foam decay", seed: 33, aspect: 1.4 },
  { id: "t7", title: "Light pool census", seed: 41, aspect: 0.75 },
  { id: "t8", title: "Grain field", seed: 17, aspect: 1.1 },
];

export default function MasonryAsciiSettleDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / masonry-ascii-settle
      </p>
      <div className="w-full max-w-3xl">
        <MasonryAsciiSettle tiles={TILES} />
      </div>
      <p className="max-w-md text-center text-xs text-ns-muted">
        Every tile resolves from a coarse ASCII halftone to a fine one as it
        drops into its column. Resize the window to watch it re-pack.
      </p>
    </div>
  );
}
