"use client";

import { HeroGlyphSilhouettePack } from "./component";

export default function HeroGlyphSilhouettePackDemo() {
  return (
    <HeroGlyphSilhouettePack
      className="min-h-screen"
      shapes={["wordmark", "star", "orbit"]}
      wordmarkText="NS"
      holdMs={2200}
      migrateMs={1400}
    >
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        One cloud, three shapes
      </h1>
      <p className="mt-2 max-w-[42ch] text-sm leading-relaxed text-ns-muted">
        The same glyph particles re-solve into a new silhouette on a timer, migrating rather than resetting.
      </p>
    </HeroGlyphSilhouettePack>
  );
}
