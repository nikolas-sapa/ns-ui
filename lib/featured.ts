/**
 * Curation, because recency-only sorting has no quality signal: whatever
 * component was built most recently leads the homepage regardless of how
 * good it is. This is a slug list rather than a `featured` flag in each
 * component's meta.json because those files belong to the registry build,
 * not the homepage.
 *
 * Order is deliberate — it is the order the featured rail and the
 * featured-first sort both use, front-loaded with the components that
 * reward a visitor actually touching them (drag, type, click) over the ones
 * that are best watched. Verify a slug still exists (`npm run registry:build`
 * regenerates `registry.json`) before adding one; a stale slug is silently
 * dropped by the filter in `app/page.tsx` rather than crashing the build.
 */
export const FEATURED: string[] = [
  "gnomon-set",
  "tumbler-gate",
  "cipher-reel-otp",
  "dovetail-run",
  "sieve-facets",
  "ridge-walk",
  "scissor-reach",
  "flywheel-pull",
  "hump-yard",
  "after-image",
  "chladni-tune",
  "lodestone-hero",
  "caustic-coverflow",
  "warp-lattice",
  "vortex-street",
  "mercury-minimap",
  "bedrock-trace",
  "grain-tally",
  "bimetal-trip",
  "beacon-cadence",
];
