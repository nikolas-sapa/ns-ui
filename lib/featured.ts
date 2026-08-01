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
  "background-ascii-plasma", // loud   full-bleed ASCII plasma, drag through it
  "gallery-coverflow-caustic", // core   drag to scrub, flick for momentum
  "ascii-torus-donut", // loud   ASCII torus, real depth buffer, drag-rotate
  "hero-particles-webgl", // core   a field that answers the cursor
  "hero-ascii-tunnel", // loud   perspective corridor, cursor steers the vanishing point
  "hero-ascii-wordmark", // core   block-letter wordmark lit by the pointer
  "ascii-globe-spin", // loud   ASCII globe with a day/night terminator
  "compare-crack-seam", // core   the before/after divider is a fracture
  "hero-oscilloscope", // loud   oscilloscope trace, pointer rings the wave
  "background-ascii-wake", // core   cursor wake with velocity-dependent decay
  "hero-ascii-terrain", // loud   layered ridgelines, per-layer parallax
  "picker-pareto-frontier", // core   pick a point on a pareto frontier
  "hero-recursive-type", // loud   wordmark whose letterforms are made of readable text
  "tree-box-drawing", // core   tree whose connectors redraw as it collapses
  "slider-chladni-tune", // loud   sand locks into a symmetric figure on target
  "time-picker-sundial", // core   sundial time picker
  "not-found-knockout", // loud   type carved out of the surface
  "confirm-dial-align", // core   align the notch, hold, confirm
  "scroll-defrost", // loud   scroll is the defroster
  "otp-reel", // core   OTP reels
  "ascii-engraving-contour", // loud   contour hatch, pointer polishes a trail
  "wizard-dovetail", // core
  "hero-gravity-well", // loud
  "filter-facet-mesh", // core
  // Tail: the rest of the previous curation, order preserved.
  "minimap-pantograph",
  "refresh-pull-flywheel",
  "view-toggle-rails",
  "undo-ghost-row",
  "hero-dipole-field",
  "grid-magnetic-lattice",
  "hero-vortex-street",
  "toc-minimap-mercury",
  "citation-grounding-hatch",
  "histogram-live-grain",
  "meter-threshold-trip",
  "status-glyph-cadence",
];
