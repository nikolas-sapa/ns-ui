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
  // Front of the rail: the most immediately striking work, alternating
  // collections so the first screen shows both registers rather than reading
  // as one. The list was 18 core to 2 loud, which sold the showcase short and
  // made the grid look more uniform than the registry actually is.
  "glyph-tide", // loud   full-bleed ASCII plasma, drag through it
  "caustic-coverflow", // core   drag to scrub, flick for momentum
  "torus-render", // loud   ASCII torus, real depth buffer, drag-rotate
  "particle-hero", // core   a field that answers the cursor
  "vanish-run", // loud   perspective corridor, cursor steers the vanishing point
  "glyph-cast", // core   block-letter wordmark lit by the pointer
  "meridian-spin", // loud   ASCII globe with a day/night terminator
  "crack-compare", // core   the before/after divider is a fracture
  "oscillo-crest", // loud   oscilloscope trace, pointer rings the wave
  "wake-glyph", // core   cursor wake with velocity-dependent decay
  "scarp-horizon", // loud   layered ridgelines, per-layer parallax
  "ridge-walk", // core   pick a point on a pareto frontier
  "nested-slug", // loud   wordmark whose letterforms are made of readable text
  "bough-index", // core   tree whose connectors redraw as it collapses
  "chladni-tune", // loud   sand locks into a symmetric figure on target
  "gnomon-set", // core   sundial time picker
  "knockout-404", // loud   type carved out of the surface
  "tumbler-gate", // core   align the notch, hold, confirm
  "frost-scrub", // loud   scroll is the defroster
  "cipher-reel-otp", // core   OTP reels
  "burin-etch", // loud   contour hatch, pointer polishes a trail
  "dovetail-run", // core
  "singularity-text", // loud
  "sieve-facets", // core
  // Tail: the rest of the previous curation, order preserved.
  "scissor-reach",
  "flywheel-pull",
  "hump-yard",
  "after-image",
  "lodestone-hero",
  "warp-lattice",
  "vortex-street",
  "mercury-minimap",
  "bedrock-trace",
  "grain-tally",
  "bimetal-trip",
  "beacon-cadence",
];
