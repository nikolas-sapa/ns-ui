/**
 * Static content for /review — disposable local-only tooling, not part of
 * the catalog. Hand-authored from the latest fix list plus each new
 * component's own meta.json description where no note was given. Never read
 * by build-registry.ts or anything else; safe to edit freely.
 *
 * Six groups now (round r8a added a fourth, round r8b a fifth, round r9 a
 * sixth, see bottom of the array):
 *   A "fixed"     — re-test, owner already flagged these with a note (see
 *                   .review-state.json, keyed by slug — never cleared here).
 *                   Row copy (change/watch) must describe the MOST RECENT
 *                   fix, not whichever round first added the row — update
 *                   both fields whenever a fixed component gets another
 *                   pass, and bump COPY_ROUND_LABEL in page.tsx alongside.
 *   B "untested"  — the rest of the first batch nobody has looked at yet.
 *   C "expansion" — three new lanes: multiplayer, reliability, and
 *                   wayfinding (chain-scale, hachure-fall, index-contour,
 *                   back-bearing, storey-pole, strip-station, pecked-ring,
 *                   bowditch-close, pin-register — nine, not the eight
 *                   originally scoped; bowditch-close finished after that
 *                   list was written). feat/r7-lab-6 has now merged into
 *                   feat/r7-integration, so the lane is included below.
 *                   Group sizes are read live off this array's own group
 *                   field in page.tsx (FIXED_COUNT/UNTESTED_COUNT/
 *                   EXPANSION_COUNT/R8A_COUNT/R8B_COUNT) — never hardcode a
 *                   count in prose here or there.
 *   D "r8a"       — round 8a's 34 components, ported from the throwaway
 *                   app/r8a/page.tsx lab (left in place, untouched). No
 *                   lane: r8a's own thematic groupings (curtains,
 *                   backgrounds, heroes, ...) are a different axis than the
 *                   identity/money/living lane enum, so they live in each
 *                   row's `eyeball` text and the page's jump index instead.
 *   E "r8b"       — round 8b's 16 components, registered normally (unlike
 *                   r8a, no throwaway lab page was needed). Also flat, no
 *                   lane, same reasoning as r8a.
 *   F "r9"        — round 9's 28 components, registered normally, same flat
 *                   no-lane shape as r8b. `eyeball` lines fold in each
 *                   builder's own self-flagged deviations/risks (e.g. a
 *                   spec number deliberately not followed, an unverified
 *                   light-theme pass) verbatim, so the owner judges those
 *                   directly rather than discovering them independently.
 */

export type Lane = "identity" | "money" | "living" | "multiplayer" | "reliability" | "wayfinding";

export type ReviewItem = {
  slug: string;
  group: "fixed" | "untested" | "expansion" | "r8a" | "r8b" | "r9";
  lane?: Lane;
  /** Group A only: one line of what changed. */
  change?: string;
  /** Group A only: one line of what to look for. */
  watch?: string;
  /** Group B/C only: one line, either the hand-written note or the meta.json description. */
  note?: string;
  /** The diagnostic "what to look at" line: names the SPECIFIC way this
   *  component's mechanic can be faked, inverted, or misread — not a
   *  generic description. Ported verbatim from wherever a round first wrote
   *  it (app/r8a/page.tsx for r8a); never invented fresh here. */
  eyeball?: string;
  /** Label for a per-row remount control, for components whose interesting
   *  state isn't the resting one (e.g. the curtains, closed by default). */
  resetLabel?: string;
  /** Which round added this row — "r7" for everything above pre-dating this
   *  field. Lets data.ts accumulate rounds instead of being rewritten each
   *  time; the round filter in page.tsx derives its options from whatever
   *  values are actually present here. */
  round?: string;
};

export const LANE_LABEL: Record<Lane, string> = {
  identity: "Identity, access and trust",
  money: "Money in motion",
  living: "Living systems and growth",
  multiplayer: "Multiplayer, presence and annotation",
  reliability: "Reliability and operations",
  wayfinding: "Wayfinding and spatial",
};

export const REVIEW_ITEMS: ReviewItem[] = [
  // Group A — Re-test, fixed since you flagged it (order matters: read order).
  {
    slug: "cambium-lay",
    group: "fixed",
    change:
      "The settled interior rings now shimmer, staggered by ring index, so brightness travels radially inward through material already laid down; the outer boundary keeps its wave.",
    watch: "Motion inside the rings, not only at the growing edge.",
  },
  {
    slug: "floret-pack",
    group: "fixed",
    change: "The head now rotates as well as streaming outward, 6 degrees per second.",
    watch: "The spiral pattern turning between glances while florets still drift out.",
  },
  {
    slug: "ring-graze",
    group: "fixed",
    change:
      "The front only moved when growth banked a whole cell, so it sat still then popped; it now previews the next claim at partial opacity.",
    watch: "The edge should advance smoothly.",
  },
  {
    slug: "polyp-bud",
    group: "fixed",
    change: "One bud decision per tick regardless of exposed tips; now four per tick at a faster cadence.",
    watch: "Should read wilder.",
  },
  {
    slug: "lamina-dome",
    group: "fixed",
    change:
      "The whole ridge now breathes, driven by the same oscillator and phase as the sea level that suppresses drowned columns; no column's real height ever decreases.",
    watch: "The mountain silhouette rising and settling, not a static ridge.",
  },
  {
    slug: "flyball-throttle",
    group: "fixed",
    change: "The demo never passed onNewPurchase/onRaiseLimit, so both buttons were literal no-ops; now wired.",
    watch: "Pressing New purchase should visibly move the governor.",
  },
  {
    slug: "spindle-strike",
    group: "fixed",
    change:
      "Nothing. A hard hunt (settle at 20/50/100/300/600ms, rapid doubles, 15 presses at 16ms, settle+refund at every offset from 1 to 31ms, 60 zero-delay clicks, all repeated under reduced motion) reproduced no defect.",
    watch: "If it misbehaves again, note what you were doing — click cadence, tab switching, resizing, or how long the page had been open.",
  },
  {
    slug: "specie-clip",
    group: "fixed",
    change:
      "The live chord line dropped from the blue accent to --border; accent now appears only on focus rings. It was kept rather than deleted because the two coin halves render identically, so there is no visible clip edge to show the slider's position.",
    watch: "No blue anywhere except when you focus a control.",
  },

  // Group B — Still untested from the first batch. Lane order: identity, money, living.
  {
    slug: "turntable-stall",
    group: "untested",
    lane: "identity",
    note: "Org switcher as a roundhouse turntable — nav stays disconnected through the whole slew, reconnecting only at the stall angle once the server confirms.",
  },
  {
    slug: "rack-seat",
    group: "untested",
    lane: "identity",
    note: "Step-up auth as switchgear racking — a sensitive-actions group rails out until fresh verification racks it back in.",
  },
  {
    slug: "bitting-cut",
    group: "untested",
    lane: "identity",
    note: "Every passkey gets a physical key blade whose six notch depths are cut deterministically from its credential id.",
  },
  {
    slug: "envelope-window",
    group: "untested",
    lane: "identity",
    note: "OAuth consent as a physical envelope — each granted scope die-cuts a window showing exactly what the app can see.",
  },
  {
    slug: "manifold-bleed",
    group: "untested",
    lane: "identity",
    note: "Connected-app grants as a valve manifold — revoking drains the line backward only after the server confirms.",
  },
  {
    slug: "tally-cleave",
    group: "untested",
    lane: "identity",
    note: "Org invites as split wooden tallies — accepting slides the matching foil home so the grain lines prove the match.",
  },
  {
    slug: "idler-drop",
    group: "untested",
    lane: "identity",
    note: "Delegated admin as a gear train — revoking swings an idler out so the delegate's gear freewheels to a stop.",
  },
  {
    slug: "rupert-snap",
    group: "untested",
    lane: "identity",
    note: "Hash-chained audit log as a chain of Prince Rupert's drops — tampering shatters every entry tailward from the break.",
  },
  {
    slug: "crossfoot-gap",
    group: "untested",
    lane: "money",
    note: "Type a wrong number, the gap should open to the size of the error.",
  },
  {
    slug: "remnant-cut",
    group: "untested",
    lane: "money",
    note: "Plan-change proration as a draper cutting cloth — the unused remnant slides into the new plan, rounding shows as a labelled sliver.",
  },
  {
    slug: "mesh-lash",
    group: "untested",
    lane: "money",
    note: "Currency field where two meshed gears draw the FX rate and gear backlash is the provider's spread.",
  },
  {
    slug: "lining-wear",
    group: "untested",
    lane: "money",
    note: "Dunning card where the 'active' clutch is a friction lining — each failed charge wears it down until it disengages.",
  },
  {
    slug: "frank-register",
    group: "untested",
    lane: "money",
    note: "Prepaid wallet payment as a postal franking meter — a descending BALANCE and ascending SPENT odometer always sum to purchased credits.",
  },
  {
    slug: "contra-strike",
    group: "untested",
    lane: "money",
    note: "Partial refund drags a struck span across the amount bar, then appends a negative contra row beneath the original — never edited, only struck through.",
  },
  {
    slug: "punch-figure",
    group: "untested",
    lane: "money",
    note: "Issued amount punched through the sheet as a dot matrix — correctable only by a second VOID pass struck diagonally across it.",
  },
  {
    slug: "rapid-wire",
    group: "untested",
    lane: "money",
    note: "Payment submission as an Edwardian cash railway — the amount catapults to the cashier post, then coasts back with the receipt.",
  },
  {
    slug: "forage-vein",
    group: "untested",
    lane: "living",
    note: "Hero background where a Physarum-style plasmodium forages the page's own content boxes — veins thicken and starved sources retract and regrow.",
  },
  {
    slug: "auxin-canal",
    group: "untested",
    lane: "living",
    note: "Veins should route around the headline.",
  },
  {
    slug: "thallus-siege",
    group: "untested",
    lane: "living",
    note: "Full-bleed pane of crustose lichen colonies growing radial fronts, stalling on contact and senescing from the centre outward.",
  },
  {
    slug: "agar-starve",
    group: "untested",
    lane: "living",
    note: "Bacterial colony grown from a live, depleting nutrient field — a rich plate spreads smooth, a starved one forks into branching fingers.",
  },
  {
    slug: "murmur-shear",
    group: "untested",
    lane: "living",
    note: "Dusk hero of ~1500 boid starlings — a slow falcon pass propagates an escape turn faster than the flock drifts, shearing a density band.",
  },
  {
    slug: "flash-entrain",
    group: "untested",
    lane: "living",
    note: "DOM fireflies pulse-couple over a nearest-neighbour graph, self-organising from scatter into unison and back apart, forever.",
  },

  // Group C — New, three more lanes. Lane order: multiplayer, reliability, wayfinding.
  {
    slug: "due-slip",
    group: "expansion",
    lane: "multiplayer",
    note: "Library due-slip read-receipt ledger where each new arrival's ink chip plays a press-in stamp, and alpha eases toward a hard floor by the 14th row.",
  },
  {
    slug: "return-aviso",
    group: "expansion",
    lane: "multiplayer",
    note: "A mention chip's detached stub only travels back and docks solid the instant deliveryState reaches 2 (seen), unfurling a timestamp beside it.",
  },
  {
    slug: "galley-bracket",
    group: "expansion",
    lane: "multiplayer",
    note: "Remote text selections draw as stroke brackets and underlines whose offset and opacity are set purely by arrival order within overlapping ranges, never by fill colour.",
  },
  {
    slug: "mull-hinge",
    group: "expansion",
    lane: "multiplayer",
    note: "A margin comment's hinge visibly shears on a damped spring as its anchor drifts, then splits along a jagged seam once the anchored text is deleted.",
  },
  {
    slug: "zipper-stall",
    group: "expansion",
    lane: "multiplayer",
    note: "Merge teeth mesh flush only up to a rotated range input's position, which clamps hard at the first unresolved conflict and jams the handle rather than stopping silently.",
  },
  {
    slug: "growth-ring",
    group: "expansion",
    lane: "multiplayer",
    note: "Arming an older version in the tree-ring version viewer rotates every newer ring open 8deg on a hinge before you confirm the restore.",
  },
  {
    slug: "vellum-scrape",
    group: "expansion",
    lane: "multiplayer",
    note: "Dragging the version rail reveals overwritten ghost text per run through a pure-CSS step function; restoring a run permanently re-inks it independent of the rail from then on.",
  },
  {
    slug: "raft-moor",
    group: "expansion",
    lane: "multiplayer",
    note: "Collaborator initial chips cluster into \"rafts\" along a position rail, mooring outward in arrival order on a spring — never a collapsed \"+n\" badge.",
  },
  {
    slug: "pole-shy",
    group: "expansion",
    lane: "multiplayer",
    note: "Same-row cursor name labels repel each other like magnets with inverse-square falloff; the actively-typing user's label carries a stronger field so bystanders drift back.",
  },
  {
    slug: "routing-slip",
    group: "expansion",
    lane: "multiplayer",
    note: "Approval stamps press in per signer; a signature landing after an earlier, still-unsigned approver renders visibly skewed as \"out of turn.\"",
  },
  {
    slug: "clock-card",
    group: "expansion",
    lane: "multiplayer",
    note: "Per-collaborator activity cards sit proud of a shared datum by clamped cumulative unread hours, settling flush on a transform transition once marked caught up.",
  },
  {
    slug: "press-register",
    group: "expansion",
    lane: "multiplayer",
    note: "Your paragraph and a collaborator's diverging draft render as offset printer's plates with registration crosshairs, the offset driven by live word-level edit distance, never elapsed time.",
  },
  {
    slug: "creep-span",
    group: "expansion",
    lane: "reliability",
    note: "The SLO error-budget wire sags permanently on any day that burned past 1x — strain only accumulates, so a day dropping back under 1x can't undo the sag.",
  },
  {
    slug: "fusee-cone",
    group: "expansion",
    lane: "reliability",
    note: "Dragging the fusee cone's four knots is clamped so the alert-trip curve can never get LESS sensitive as budget runs out.",
  },
  {
    slug: "passing-loop",
    group: "expansion",
    lane: "reliability",
    note: "The canary funicular is locked at exactly 50% until you confirm the points switch; only then can the cable travel on to 100%.",
  },
  {
    slug: "running-belay",
    group: "expansion",
    lane: "reliability",
    note: "Pressing Arrest springs the leader dot straight back to the last passed anchor with a taut-then-slack rope, never a stage-by-stage walk backward.",
  },
  {
    slug: "seep-lattice",
    group: "expansion",
    lane: "reliability",
    note: "Drag the rollout slider and watch the traced perimeter jump to outline only the single largest connected wet cluster, computed from real grid adjacency, not a radial guess.",
  },
  {
    slug: "night-store",
    group: "expansion",
    lane: "reliability",
    note: "Each cache brick's dot-stipple density decays purely from its own time-since-last-hit, so a thrashing key visibly flickers while steady neighbours stay warm.",
  },
  {
    slug: "chain-scale",
    group: "expansion",
    lane: "wayfinding",
    note: "Drag the handle and watch the bar's length always resolve to a 1-2-5 round number, snapping with a 180ms width spring exactly at each ladder crossing rather than drawing the raw drag value.",
  },
  {
    slug: "hachure-fall",
    group: "expansion",
    lane: "wayfinding",
    note: "Scrub along the profile and watch each segment's perpendicular hachure strokes lengthen and crowd together purely from that segment's real-world grade, never from colour.",
  },
  {
    slug: "index-contour",
    group: "expansion",
    lane: "wayfinding",
    note: "Drag the minutes slider and watch each band re-thresholded fresh via marching squares from the real per-node cost field, every third line breaking its own stroke to fit an inline minute label.",
  },
  {
    slug: "back-bearing",
    group: "expansion",
    lane: "wayfinding",
    note: "Drag the card and check the back reading always sits exactly 180 degrees opposite the fore reading, with the graduated card the only thing that rotates under a fixed lubber line.",
  },
  {
    slug: "storey-pole",
    group: "expansion",
    lane: "wayfinding",
    note: "Switch floors and watch the datum line spring to each slab's real elevation, so a double-height lobby renders visibly taller than a mezzanine rather than an evenly spaced list.",
  },
  {
    slug: "strip-station",
    group: "expansion",
    lane: "wayfinding",
    note: "Scroll the strip and check row spacing tracks real ground distance, with the 44px floor breaking into an equation-station zigzag and skipped chainage rather than silently compressing.",
  },
  {
    slug: "pecked-ring",
    group: "expansion",
    lane: "wayfinding",
    note: "Drag the radius handle and count the dashes: each one is exactly 100m of ground circumference, re-spacing rather than just re-counting once you cross into 10-dash 1km bundles.",
  },
  {
    slug: "bowditch-close",
    group: "expansion",
    lane: "wayfinding",
    note: "Close the traverse near vertex 0 and press Balance: the misclosure gap should redistribute across every leg in proportion to that leg's own walked distance, never split evenly or dumped on the last point.",
  },
  {
    slug: "pin-register",
    group: "expansion",
    lane: "wayfinding",
    note: "Hover the panel and toggle a layer off: it should spring sideways off the registration pins into a parked, translucent slot rather than fade away, while the fan itself is driven by one shared explode scalar.",
  },

  // Round 8a — 34 new components, ported from app/r8a/page.tsx (the
  // throwaway manual test lab). `eyeball` is that page's diagnostic
  // "what to look at" line, verbatim; `note` carries its "replaces:" line.
  // No lane: r8a's groupings (curtains, backgrounds, heroes, ...) are a
  // different axis than the identity/money/living lane enum, so they live
  // in the eyeball text and the jump index instead of being forced into it.
  {
    slug: "curtain-leader-countdown",
    group: "r8a",
    round: "r8a",
    note: "Replaces: preloader / route curtain.",
    eyeball:
      "The 2-pop flash (right before the cut to black) must be pure ink value, no color tint — sample it in both themes. The black beat between cycles must still show the ring outline and a ghost of the target, never a truly empty frame.",
    resetLabel: "Re-trigger countdown",
  },
  {
    slug: "curtain-traveler-draw",
    group: "r8a",
    round: "r8a",
    note: "Replaces: preloader / route curtain.",
    eyeball:
      "Use the demo's own \"Skip curtain\" button to draw it open. Watch one individual pleat's shadow/highlight line, not the panel's outer edge — it should visibly shift on its own ~4s breathing cycle even while closed. If only the whole panel pulses opacity/scale while the fold lines stay put, the breathing is faked. Parts horizontally on a corded track — compare against Austrian Gather (bottom-up) and Tab Diagonal (one corner only) below.",
    resetLabel: "Reset curtain (closed)",
  },
  {
    slug: "curtain-austrian-gather",
    group: "r8a",
    round: "r8a",
    note: "Replaces: preloader / route curtain.",
    eyeball:
      "Use the demo's own \"Skip curtain\" button to hoist it. The fabric should SCALLOP and BUNCH upward into a row of swags as it lifts — bottom-up, not sliding flat sideways (that's Traveler Draw) or peeling from one diagonal corner (that's Tab Diagonal). Each swag should belong visibly to its own pair of lift lines.",
    resetLabel: "Reset curtain (closed)",
  },
  {
    slug: "curtain-tab-diagonal",
    group: "r8a",
    round: "r8a",
    note: "Replaces: preloader / route curtain.",
    eyeball:
      "Use the demo's own \"Skip curtain\" button to haul it. Only the bottom-inner (center-meeting) corner should lift diagonally toward a fixed tie-off point — the top edge and the outer wing corner must stay put. If the whole panel slides or the top edge moves, this isn't distinct from the traveler curtain.",
    resetLabel: "Reset curtain (closed)",
  },
  {
    slug: "background-halftone-rosette",
    group: "r8a",
    round: "r8a",
    note: "Replaces: full-bleed ambient background.",
    eyeball:
      "High-coverage centre must be FURTHER from the page background in value than the low-coverage edges — in BOTH themes. If the centre looks closer to the background in dark mode, the blend mode is inverted for that theme.",
  },
  {
    slug: "background-capillary-wick",
    group: "r8a",
    round: "r8a",
    note: "Replaces: full-bleed ambient background.",
    eyeball:
      "Ink should only ever travel along a fixed vein lattice, front by front, snapping along discrete branching lines — never spreading as a soft, open-fluid cloud (that would be its sibling, dye-whorl, a different mechanic). Watch a single front advance along one edge, then branch at a junction.",
  },
  {
    slug: "background-engine-turn-guilloche",
    group: "r8a",
    round: "r8a",
    note: "Replaces: full-bleed ambient background.",
    eyeball:
      "Three overlapping ring patterns should visibly beat/drift against each other — their lathe ratios are deliberately mismatched — reading as a banknote security pattern that's alive, not a frozen decorative engraving. If it looks like a static print, the ratios collapsed to something too close together.",
  },
  {
    slug: "hero-404-quadrant-occlusion",
    group: "r8a",
    round: "r8a",
    note: "Replaces: hero / 404 page.",
    eyeball:
      "Zoom into the numeral edges: strokes should look like real half/quadrant blocks (▘▝▖▗▚▞ etc.), each cell independently choosing which quarter is filled — not one single density glyph per cell like the rest of the registry. Thin numeral strokes should stay legible, not break up into noise.",
  },
  {
    slug: "not-found-attribute-clash",
    group: "r8a",
    round: "r8a",
    note: "Replaces: 404 background.",
    eyeball:
      "This is a MONOCHROME stand-in for ZX Spectrum colour clash — there must be no hue anywhere, in either theme. Look for cells where a glyph/weight visibly snaps or blocks out detail because two overlapping regions are fighting over one cell's single glyph+weight budget.",
  },
  {
    slug: "divider-petscii-vu",
    group: "r8a",
    round: "r8a",
    note: "Replaces: divider.",
    eyeball:
      "Every cell must be strictly on/off — a solid --foreground block or nothing, never a partial-alpha or ramped glyph. If any cell looks like it's fading in/out rather than snapping between two states, the density-ramp mechanic (used elsewhere in the registry) has leaked in here, which this component is built to avoid.",
  },
  {
    slug: "divider-teletext-mosaic",
    group: "r8a",
    round: "r8a",
    note: "Replaces: divider.",
    eyeball:
      "Look at the sub-cell structure: this addresses a 2-wide x 3-tall sextant grid (six positions), not the 2x2 quadrant blocks or the 2x4 braille dots used elsewhere in the registry. Patterns should read chunkier and more angular than a quadrant-block divider.",
  },
  {
    slug: "empty-state-braille-orbit",
    group: "r8a",
    round: "r8a",
    note: "Replaces: empty state.",
    eyeball:
      "Head bright (--foreground), tail fading to --ns-muted — pure grey, no hue creeping into the fade. The orbit must never settle to a point or stop; it should still be moving whenever you look back at it.",
  },
  {
    slug: "empty-state-mezzotint",
    group: "r8a",
    round: "r8a",
    note: "Replaces: empty state.",
    eyeball:
      "This should read as built SUBTRACTIVELY — starts near-solid and light is scraped/burnished in, the opposite of every other density-ramp glyph in the registry, which builds density up from empty. If it looks like it's filling in from nothing rather than being worn away from solid, the polarity is backward.",
  },
  {
    slug: "nav-blue-noise-scrim",
    group: "r8a",
    round: "r8a",
    note: "Replaces: nav / overlay scrim.",
    eyeball:
      "The dimming grain behind the nav should read as fine, isotropic noise reshuffling every frame — never a visible repeating crosshatch/lattice. A regular repeating pattern means it fell back to ordered dithering instead of true blue noise.",
  },
  {
    slug: "nav-overstrike-typewriter",
    group: "r8a",
    round: "r8a",
    note: "Replaces: nav.",
    eyeball:
      "The ruled line beneath the current nav link should read as the deepest, darkest stack — several characters struck into the SAME cell — distinctly denser than the other links' lines. That's overstrike compositing in one cell, not this registry's usual single-glyph density ramp.",
  },
  {
    slug: "loader-ascii-diffuse-fill",
    group: "r8a",
    round: "r8a",
    note: "Replaces: loader.",
    eyeball:
      "The texture should look grainy and organic, with error propagating diagonally across the grid frame to frame — never a repeating fixed checkerboard-like pattern. A visible repeating lattice means it fell back to ordered (Bayer) dithering instead of real Floyd-Steinberg error diffusion.",
  },
  {
    slug: "progress-nlq-overstrike",
    group: "r8a",
    round: "r8a",
    note: "Replaces: progress bar.",
    eyeball:
      "At the fill boundary, look for two dot lattices offset by exactly half a cell pitch (two interleaved passes) — not stacked glyphs in one cell (that's Nav Overstrike Typewriter's different mechanic). The boundary should stay alive at rest, cycling single-pass → double-pass → paper-feed gap, even while the value isn't changing. Documented limit, not a bug: below ~40px of bar height the two passes visually fuse into one denser dot and the interleave stops being perceptible (still reads correctly as dense-vs-sparse progress).",
  },
  {
    slug: "cursor-sixel-reveal",
    group: "r8a",
    round: "r8a",
    note: "Replaces: hero / full-bleed background.",
    eyeball:
      "The circular window's edge must dissolve into the glyph field — no hard rim, no lighter/darker disc around it. Check both themes; a visible ring is worst in dark and means the canvas isn't painting an opaque --background fill before each pass.",
  },
  {
    slug: "cursor-subpixel-fringe",
    group: "r8a",
    round: "r8a",
    note: "Replaces: hero / full-bleed background.",
    eyeball:
      "Each cell should show three separate vertical --foreground slivers (RGB-stripe stand-ins), brightest where the underlying field's slope is steepest — not one blended glyph per cell. Fringing should track edges/gradients in the field, not appear uniformly everywhere.",
  },
  {
    slug: "gallery-ascii-gradient-orientation",
    group: "r8a",
    round: "r8a",
    note: "Replaces: gallery.",
    eyeball:
      "Toggle theme: the same cells should stay lit, only their ink color should change. If a different set of glyphs lights up per theme, the Sobel pass is reading canvas pixels instead of the shared noise array.",
  },
  {
    slug: "card-dot-gain-screen",
    group: "r8a",
    round: "r8a",
    note: "Replaces: card.",
    eyeball:
      "Diagonal sweep across the card, highlight (top-left, sparse dots) to shadow (bottom-right): shadow dots should visibly BRIDGE and plug into solid ink rather than staying separate circles all the way to full coverage. That nonlinear plugging near the shadow end is the real dot-gain curve — a linear-looking gradient means the gain terms aren't applied.",
  },
  {
    slug: "crack-arrest-hole",
    group: "r8a",
    round: "r8a",
    note: "Replaces: confirm / abort control.",
    eyeball:
      "This needs a real HOLD (Space/Enter, or press-and-hold pointer) — a plain click won't arrest it. Holding should grow a jagged crack from the left edge toward a fixed drilled hole; releasing early should heal it back to nothing on a spring and re-seed a visibly different crack path for the next attempt. Reaching the hole is what stops it — an arrest, not a destructive break-through.",
  },
  {
    slug: "shakeout-crumble",
    group: "r8a",
    round: "r8a",
    note: "Replaces: destructive confirm button.",
    eyeball:
      "Click (or Space/Enter) once to arm, then click again within the countdown window to commit — or let it expire, or press Escape, to cancel and watch the sand reclaim itself back over the casting. At rest it should already be alive on its own ~7s vibrate/settle cycle even with zero input. ~2600 individually-thresholded grains: it should read as granular compaction failure, not a wipe or a sweeping front.",
  },
  {
    slug: "glaze-crawl-heal",
    group: "r8a",
    round: "r8a",
    note: "Replaces: status badge.",
    eyeball:
      "The demo shows all three statuses side by side (a cycling live badge plus three fixed reference rows: healthy/degraded/down) specifically so the states can be compared behaviourally, not by colour — healthy closes a crater in under a second, degraded lingers 1-3s, down never closes and leaves ragged bare patches. Documented limit, not a bug: below ~14px badge diameter the mechanic itself stops resolving and only the text label still carries the state.",
  },
  {
    slug: "jominy-quench",
    group: "r8a",
    round: "r8a",
    note: "Replaces: comparison card.",
    eyeball:
      "Rows are hoverable and focusable (Tab through them) — the accent highlight should only ever appear on the hovered/focused bar's row, never in the resting render. Temperature is mapped to LUMINANCE, not hue (this registry has no orange) — the hottest point on each bar should blend toward --foreground, not toward a warm color.",
  },
  {
    slug: "spark-test-id",
    group: "r8a",
    round: "r8a",
    note: "Replaces: file upload / detector.",
    eyeball:
      "A low idle spark shower should run unconditionally from mount, before any file is dropped — it must never be a dead frame. Drop or select a file (any of the accepted types) to see the shower change signature: image files throw dense, repeatedly-forking short bursts; audio/video throws long sparse straight lines; archives/binaries throw short dense low-lying streams.",
  },
  {
    slug: "hero-faraday-wave-cell",
    group: "r8a",
    round: "r8a",
    note: "Replaces: hero / full-bleed background.",
    eyeball:
      "The standing-wave pattern should tessellate into stripes, squares, or hexagons depending on which wave triad is active, and drift slowly rather than sit static. Heavy: evaluates roughly 30k trig operations per frame, so it's one of the two components this page's lazy-mount is specifically protecting against — if scroll stutters near it, that's the thing to check first.",
  },
  {
    slug: "divider-telephone-cord-delam",
    group: "r8a",
    round: "r8a",
    note: "Replaces: divider.",
    eyeball:
      "The ridge should wander side to side as it advances (a 'telephone cord' buckling pattern), with occasional branch points where it visibly forks into two — not a clean single sine wave. Compare against the other two dividers on this page: PETSCII VU is strictly two-state on/off, Teletext Mosaic addresses a 2x3 sextant grid; this one is a continuous wandering ridge, closer to a hand-drawn line than either.",
  },
  {
    slug: "kelvin-wake",
    group: "r8a",
    round: "r8a",
    note: "Replaces: nav.",
    eyeball:
      "The wake pattern beneath the links should stay confined inside a V-shaped envelope held at a constant ~19.47° half-angle regardless of anything else changing — that angle is the real, famous invariant of the physics, not a stylistic choice. Documented limit, not a bug: below ~24-28px of strip height the envelope collapses and stops reading clearly.",
  },
  {
    slug: "shearer-advance",
    group: "r8a",
    round: "r8a",
    note: "Replaces: loader / infinite-scroll strip.",
    eyeball:
      "The conveyor's dash pattern should scroll in ONE constant direction regardless of which way the shearer itself is currently traversing — those two motions are deliberately independent, exactly like a real armoured face conveyor. Roof supports should advance in a travelling wave one at a time behind the shearer, not all flip together. Author's own flag: this may still read as generic bouncing dots rather than a directional conveyor — a plan-view rebuild is the known fix if so.",
  },
  {
    slug: "hero-slice-comb",
    group: "r8a",
    round: "r8a",
    note: "Replaces: hero / full-bleed background.",
    eyeball:
      "Brightness must come from pure overlap accumulation — the rim where slices pile up tangent to the camera denser than the sparse head-on interior — with no shading/lighting term added on top. If any face looks shaded rather than built from stacked slice density, the mechanic is wrong.",
  },
  {
    slug: "hero-text-ring-funnel",
    group: "r8a",
    round: "r8a",
    note: "Replaces: hero / full-bleed background.",
    eyeball:
      "This should read as typography given depth by phase lag between rings, not a glyph-grid tunnel. Documented limit, not a bug: below ~420px container height the far rings hit the 9px font floor and the taper flattens out.",
  },
  {
    slug: "background-text-branch-canopy",
    group: "r8a",
    round: "r8a",
    note: "Replaces: background.",
    eyeball:
      "Every limb is real words drawn with fillText — this should read as text-as-geometry, not strokes with a texture. Documented limit, not a bug: at small container sizes the outermost limbs degrade to a single short word.",
  },
  {
    slug: "hero-glyph-silhouette-pack",
    group: "r8a",
    round: "r8a",
    note: "Replaces: hero / full-bleed background.",
    eyeball:
      "The wordmark silhouette needs more resolved particles per unit area than the star or orbit silhouettes to read cleanly, so it's the first of the three to degrade at card size — check it specifically at small containers, not just full-bleed.",
  },

  // Group E — round 8b's 16 components, flat (no lane), same reasoning as
  // r8a. Core tier first, then loud.
  {
    slug: "gravure-cell-wipe",
    group: "r8b",
    round: "r8b",
    note: "Replaces: divider / background texture strip.",
    eyeball:
      "Look for a genuine engraved-depth story, not a scanline: individual cell alpha should vary by depth (some cells read darker than their neighbours at the same wipe-age), and roughly half the strip should read raw/unwiped-dense at any instant with the other half settled — not just a thin band trailing the blade. Count cells across the short axis; fewer than ~20 means the pitch clamp failed and the mechanic is illegible.",
  },
  {
    slug: "riso-drum-pass",
    group: "r8b",
    round: "r8b",
    note: "Replaces: loader / background ambient texture.",
    eyeball:
      "Check the cumulative registration offset across the three passes — each pass should visibly land ~1.3px/0.7px off the last, producing real moiré/drift where dot fields overlap, not a static halftone. Builder flag: DOT_THRESHOLD and THRESHOLD_DELTA weren't specified in the spec — dot density and the inter-pass registration doubling are the builder's own guesses, so judge whether the density and drift both actually read at card scale rather than assuming the numbers are load-bearing. If it looks like one flat dither pattern with no drift or drum-rotation sweep, the mechanic has collapsed into chart-bar-halftone's territory.",
  },
  {
    slug: "screen-flood-stroke",
    group: "r8b",
    round: "r8b",
    note: "Replaces: loader / ambient progress indicator.",
    eyeball:
      "Two distinct passes must be visible: a light, low-alpha flood smear and a firm high-alpha print pass that actually leaves ink behind, decaying toward a residual ghost floor rather than fully clearing — check for a lingering stain, not a wipe to nothing. Builder flag: the reduced-motion freeze lands at 1140ms (the spec's named '60%-printed' frame), not the spec's literal 1500ms — confirm that's still a legible mid-print-stroke read, not a drift into the wrong phase.",
  },
  {
    slug: "roller-occlusion",
    group: "r8b",
    round: "r8b",
    note: "Replaces: loader / progress ambient.",
    eyeball:
      "The tube must pinch fully closed (~4% width) under an occluding roller and rebound asymmetrically (60ms close / 90ms release), not a symmetric squash. Builder flag: roller radius is built at 0.62x tube diameter, not the spec's 12% — at 12% the roller could never physically flatten the tube to full occlusion, so check specifically whether the tube actually closes to near-zero width at contact, or just dents.",
  },
  {
    slug: "peen-coverage",
    group: "r8b",
    round: "r8b",
    note: "Replaces: background / ambient card texture.",
    eyeball:
      "Watch for the Avrami saturation story: new impacts should increasingly land on already-dimpled area as coverage climbs (patchy, then dense stipple), not an even tiled fill-in. At the cycle's peak the whole surface should visibly fade back to blank over ~700ms and restart — check that reads as a deliberate 'fresh part loaded' beat, not a glitch or a dead frame.",
  },
  {
    slug: "eink-waveform-ghost",
    group: "r8b",
    round: "r8b",
    note: "Replaces: empty state.",
    eyeball:
      "At any glance, a scattered handful of cells — not the whole panel — should be mid-transition, each flashing briefly to full black/white before landing on its true grey; that per-cell shoot-through must be the dominant motion, not the periodic ~14s full-panel black/white refresh flash. If you only ever notice motion during the refresh flash, the continuous per-cell layer has failed to register.",
  },
  {
    slug: "lcd-response-smear",
    group: "r8b",
    round: "r8b",
    note: "Replaces: card.",
    eyeball:
      "The overshoot must read as a discrete spike-then-settle, not a soft trailing blur (that would be kelvin-wake's mechanic, not this one) — and the rising overshoot should look visibly different from the falling undershoot. Builder flag: GtG keyframe timings are scaled 20x the spec's literal ms values (ratios kept exact) specifically so the overshoot is perceptible at 60fps at all — verify it still reads as a fast discrete settle, not a slow smear that's drifted into motion-blur territory.",
  },
  {
    slug: "divider-mosaic-split",
    group: "r8b",
    round: "r8b",
    note: "Replaces: divider.",
    eyeball:
      "The gap between lit sub-cell blocks must be a real unpainted background gap, not an optical illusion of contrast — check specifically in light theme at small card widths that each tile still looks separated, not fused into a solid contiguous shape (which would make it indistinguishable from divider-teletext-mosaic). Confirm the column-wise write sweep reads as a genuinely different cadence from the teletext sibling's row-wise sweep.",
  },
  {
    slug: "meter-matrix-scan",
    group: "r8b",
    round: "r8b",
    note: "Replaces: meter.",
    eyeball:
      "Brightness bands must look like 8 discrete quantized steps, not a smooth analog gradient — check adjacent LEDs for banding rather than a blend, especially the faintest 'on' band against a light-theme background. Also check for a fleeting moment where the row-scan structure itself (one row lit ahead of the others) is visible, not just a permanently-simultaneous static readout — a panel that never shows scan banding has faked the multiplex mechanic in software only.",
  },
  {
    slug: "overflow-chip-mux",
    group: "r8b",
    round: "r8b",
    note: "Replaces: list/tag overflow indicator.",
    eyeball:
      "Seed with more than 8 items (below budget, nothing should multiplex at all) and watch the visible chip subset actually rotate every ~130ms — a different set of 8 at t0/2.5s/5s. Check the accessibility layer independently of the visual flicker: an sr-only list of every item plus a visible 'N of M shown' count must both be present at all times, not just the flickering subset.",
  },
  {
    slug: "bed-fluidize",
    group: "r8b",
    round: "r8b",
    note: "Replaces: hero background.",
    eyeball:
      "Track one bubble's full life: it should nucleate small near the floor, visibly grow as it rises, possibly merge with another bubble it touches, then burst at the surface with an ejected particle spray — not generic noise churn. Builder flag: this was built in 2D canvas, not the WebGL the spec calls for — judge whether particle density and bubble legibility still hold up at card scale despite the lower-cost renderer, since sparse-at-card-scale is exactly the failure mode WebGL was specified against.",
  },
  {
    slug: "tray-weep",
    group: "r8b",
    round: "r8b",
    note: "Replaces: divider / background band.",
    eyeball:
      "Find a weeping cap: during a weep event its bubbling should visibly reverse to a downward droplet, not just pause — that direction reversal is the one mechanic that makes this read as a distillation tray rather than generic bubbling. Also check that trays are NOT in phase with each other (each should sit at a different froth/spill point) — if every band looks identical, it's been tiled rather than cascaded.",
  },
  {
    slug: "offset-fountain-split",
    group: "r8b",
    round: "r8b",
    note: "Replaces: hero / background.",
    eyeball:
      "Watch one region of banding over several seconds: it should visibly even out as the roller cascade smears it, while a new uneven band forms elsewhere — never settling flat, since the fountain-key drift never stops. If it just looks like drifting cloud noise with no evening-out/reforming story, or needs color to read the split, it's failed. Builder flag: built in 2D canvas, not the WebGL the spec calls for — check performance and banding legibility at full-bleed scale specifically.",
  },
  {
    slug: "film-gate-weave",
    group: "r8b",
    round: "r8b",
    note: "Replaces: background.",
    eyeball:
      "The gate rectangle (2px, full-opacity foreground) must never move — only the crosshair/circle test pattern inside it drifts and bounces. Confirm there's a genuine, always-nonzero gap between the fixed gate edge and the drifting content at any glance, not just at select instants; the content should never sit flush. This has no sprocket-hole chrome at all — if it's being confused with scrubber-film-strip, something's wrong.",
  },
  {
    slug: "rolling-shutter-skew",
    group: "r8b",
    round: "r8b",
    note: "Replaces: background.",
    eyeball:
      "The vertical rule grid should bend smoothly into a parallelogram, never jump or tear — a discontinuity would mean this has drifted into flyback-tear's failure mode, which this concept exists specifically to avoid. Builder flag: pan amplitude is scaled ~6x over the spec's literal numbers — at the spec's literal value the skew would only be 2-3px and invisible on a laptop panel — check whether the shear now reads as a deliberate rolling-shutter bend or has become an obviously exaggerated wobble.",
  },
  {
    slug: "hero-beam-glyph",
    group: "r8b",
    round: "r8b",
    note: "Replaces: hero wordmark.",
    eyeball:
      "Corners and stroke endpoints should visibly glow brighter than long straight runs — check this holds in both themes, not just dark. Builder flag: the stroke font is hand-authored, not a real digitized Hershey set — check the B, R, S, and 8 letterforms specifically for stroke topology that doesn't actually match how those letters are conventionally drawn (open counters, wrong stroke count/order) before trusting the wordmark reads correctly at a glance.",
  },

  // Group F — round 9's 28 components, flat (no lane), same reasoning as
  // r8a/r8b. `eyeball` folds in each builder's own self-flagged deviations
  // and unverified risks verbatim (see the header comment above) alongside
  // the spec's own kill criteria / legibility line.
  {
    slug: "interlace-field-comb",
    group: "r9",
    round: "r9",
    note: "Replaces: full-bleed hero / background band.",
    eyeball:
      "The comb serration must appear only on a moving diagonal edge and visibly grow then shrink on the ~4.0s re-weave cycle (divergence -> clean weave -> divergence) — if the 1-3px scanline pitch reads as a static soft gradient with no comb at any phase, that's the spec's named kill condition. Confirm the weave-to-clean moment is genuinely sharp, not a residual blur.",
  },
  {
    slug: "chargen-rom-slice",
    group: "r9",
    round: "r9",
    note: "Replaces: loader / status glyph moment.",
    eyeball:
      "Track one glyph's hard horizontal seam moving down through its 8 rows at 35ms/row (~280ms/glyph) — if it reads as a generic fade/wipe rather than discrete slice-by-slice fetch, that's the named kill condition. Builder flag: t0 is deliberately seeded 170ms into the cycle so the t0/2.5s/5s screenshots don't all land on the same 500ms hold — if that offset or any timing constant gets retuned, re-check the three samples still actually differ.",
  },
  {
    slug: "scroll-fine-register",
    group: "r9",
    round: "r9",
    note: "Replaces: divider / footer band.",
    eyeball:
      "Confirm the numeric coarse/fine readout is genuinely tied to the visible tile snap, not decorative debug text that could be deleted with zero loss of legibility (the named kill condition) — watch one tile slide over the 480ms sawtooth and the coarse counter tick exactly once per snap. Builder flags: the marker only travels ~7px per sweep at the 8px cell floor any divider-height band will hit, which may read as jitter rather than followable motion — exactly round 8b's legibility failure — check this specifically at divider height; also unverified is the bracket's contrast over the tile strip in light theme.",
  },
  {
    slug: "bitplane-cascade",
    group: "r9",
    round: "r9",
    note: "Replaces: full-bleed hero / background band.",
    eyeball:
      "Watch plane 0's coarse silhouette hold fixed while three more binary-weighted planes visibly step in around it at a 350ms cadence — if it reads as smooth interpolation rather than four distinct stepped arrivals, that's the named kill condition. Builder flag: built MSB-first, not the spec's literal LSB-first place-value order — confirm the coarse-to-fine reveal still reads correctly (coarsest structure first) despite the reversed bit order.",
  },
  {
    slug: "delta-frame-macroblock",
    group: "r9",
    round: "r9",
    note: "Replaces: background band / divider.",
    eyeball:
      "Pick one flagged block and confirm its outline flashes then fades over ~340ms while every neighboring block visibly does nothing — if the flagged/unflagged distinction reads as generic grid shimmer instead of discrete per-block change events, that's the named kill condition. Builder flag: flags-per-tick capped to 2-4 blocks instead of the spec's 6-10%, because 6-10% overlapped into continuous shimmer — judge whether 2-4 blocks/tick still reads as a legible, countable change-detection decision rather than under-selling the mechanic.",
  },
  {
    slug: "grinding-chatter-lobes",
    group: "r9",
    round: "r9",
    note: "Replaces: loader / activity indicator.",
    eyeball:
      "Watch the rim grow from near-circular to visibly scalloped over the full 6s growth arc, then check it holds a fixed lobe count until a dress event clears it — lobe count changing mid-growth, or amplitude falling below the perceptual floor at minimum card width before the 2.5s checkpoint, are both named kill conditions. Builder flags: pointer boost scales amplitude rather than warping the growth curve; rim gradient contrast in light theme is unverified — check both.",
  },
  {
    slug: "profilometer-trace",
    group: "r9",
    round: "r9",
    note: "Replaces: divider.",
    eyeball:
      "Watch the ring-buffer wrap point specifically for a visible jump/seam — that's a named kill condition — and confirm scroll speed holds steady at 24px/s regardless of frame rate (elapsed-time-driven, not frame-count-driven). Check trace amplitude doesn't fall below the perceptual floor at minimum divider height/card width.",
  },
  {
    slug: "edm-crater-field",
    group: "r9",
    round: "r9",
    note: "Replaces: hero / full-bleed background.",
    eyeball:
      "Pick one crater and watch its full 5.5s birth-to-fade lifetime — the field's overall density must hold visually constant (steady-state birth rate balanced by erosion), never accumulating toward a saturated, static-looking surface, which is the named kill condition and exactly the failure this spec exists to avoid. Confirm the raised-rim glint reads from value/shading alone, no hue.",
  },
  {
    slug: "cmm-probe-touch",
    group: "r9",
    round: "r9",
    note: "Replaces: empty state.",
    eyeball:
      "Watch one station's full approach-touch-flash-retract-travel cycle at 1.2s/station — a station-to-station jump that reads as instant/blinking rather than showing real approach/retract motion is the named kill condition (the exact overflow-chip-mux failure). Confirm the lap never completes and stops (it must index forever) and that the trailing fade of recently-touched points reads as a legible recent-history trail, not noise.",
  },
  {
    slug: "honing-crosshatch",
    group: "r9",
    round: "r9",
    note: "Replaces: background / ambient card texture.",
    eyeball:
      "Pick a single scratch stroke and watch it fade over its full 4.5s lifetime while the two crosshatch families' angle stays visually fixed (a controlled process parameter, not incidental) and aggregate density holds steady — angle drift/scatter, or density saturating solid or emptying out, are both named kill conditions. Builder flag: light theme is unverified.",
  },
  {
    slug: "toner-fuse-streak",
    group: "r9",
    round: "r9",
    note: "Replaces: loader / progress indicator.",
    eyeball:
      "Confirm the toner-starvation streak and edge-deletion thinning are both visibly present and load-bearing, not decorative — if the wipe reads as a generic loading shimmer with those two artifacts removed mentally, that's the named kill condition. Check it still renders convincingly without a caller-supplied content mask, using only the built-in placeholder pattern. Builder flag: light theme is unverified.",
  },
  {
    slug: "fiche-step-repeat",
    group: "r9",
    round: "r9",
    note: "Replaces: gallery / thumbnail grid.",
    eyeball:
      "Watch the raster-order fill sweep — cells should populate in a legible left-to-right, top-to-bottom sequence, not read as random cells popping in (the named kill condition). Check the index-strip typing feels integral to the sheet completing, not a bolted-on afterthought — the spec says cut it rather than ship it half-realized.",
  },
  {
    slug: "carbon-ply-fade",
    group: "r9",
    round: "r9",
    note: "Replaces: activity feed / notification fanout.",
    eyeball:
      "Confirm each ply in the stack shows a visibly different falloff (opacity/scale) from its neighbors — a generic drop-shadowed card pile with no visible per-ply difference is the named kill condition — and that the strike cadence never needs to exceed ~1/s to feel alive (a faster cadence would break the round-9 legibility rule and should have been killed, not sped up). Builder flag: rows were made contiguous rather than the spec's overlapping offset stack, because an overlapping stack would have buried the lower plies' text — judge whether contiguous rows still read as one strike propagating through ranked plies.",
  },
  {
    slug: "fax-line-slip",
    group: "r9",
    round: "r9",
    note: "Replaces: loading / connecting state.",
    eyeball:
      "The paper-slip fault band must be readable as 'one thing went wrong here' on a first, uninstructed look — if it needs the spec's explanation to register, that's the named kill condition (a Filter 2 'striking at first glance' failure). Check the handshake-tone waveform and the top-to-bottom scan build both read as real fax mechanics, not generic loading motion.",
  },
  {
    slug: "photostat-reverse",
    group: "r9",
    round: "r9",
    note: "Replaces: hero / full-bleed background.",
    eyeball:
      "Watch the negative/positive tone-flip at its 1.3s cadence — if it reads as strobing rather than a legible alternation, that's the named kill condition (this whole axis exists to avoid exactly that failure mode). Confirm the SDF-based softening reads as generation loss (progressive thickening/blur across repeated copies), not a stock blur filter applied once.",
  },
  {
    slug: "kymograph-smoke-trace",
    group: "r9",
    round: "r9",
    note: "Replaces: hero.",
    eyeball:
      "Watch the bright scratch trace lengthen at the stylus tip with one twitch spike every 3.2s — confirm the subtractive soot-vs-paper identity is distinguishable at a glance from dye-whorl's additive ink diffusion (a named kill condition if it isn't). Check the resmoking brush pass reads as a distinct, harder-edged wipe, not a soft fade — a fade would make the infinite-loop mechanism read as a bug, not a feature.",
  },
  {
    slug: "helicorder-line-wrap",
    group: "r9",
    round: "r9",
    note: "Replaces: loader / ambient status indicator.",
    eyeball:
      "Watch the pen wrap from the right margin of one row to the left margin of the row below, once every 12s with an explicit 200ms fade transition — if the vertical stack-and-step-down isn't visually distinguishable from a plain looping ticker, that's the named kill condition. Confirm 8 rows stay legible (not hairlines) at minimum card width, and that the 25px/s sweep doesn't alias against 60fps paint. Builder flag: light theme is unverified.",
  },
  {
    slug: "barograph-drum-week",
    group: "r9",
    round: "r9",
    note: "Replaces: card.",
    eyeball:
      "Confirm the DOM pen-arm overlay's tip stays exactly synced to the canvas ink's actual endpoint at every frame — any drift between the two is a named disqualifying bug, not a rough edge. Watch the day-gridline crossing every 6.4s as the ink trail's leading edge lengthens; if this is indistinguishable from a generic sparkline once the printed-paper grid and DOM pen arm are removed mentally, that's the named kill condition. Also check the 168-tick gridline mesh reads as a faint ruling, never a solid wash, in both themes. Builder flag: light theme is unverified.",
  },
  {
    slug: "bias-hysteresis",
    group: "r9",
    round: "r9",
    note: "Replaces: level/capacity meter or gauge.",
    eyeball:
      "Without reading the axis labels, check whether the loop is still distinguishable from generic oscilloscope Lissajous decoration — if not, that's the named kill condition (risk of reading as a hero-oscilloscope restyle). Confirm the envelope's breathing is actually noticeable inside a 5-second sample, not just a static-looking loop with a moving dot. Builder flag: the 0.05-alpha enclosed-area fill is unverified in light theme and may need raising to ~0.08 — check specifically there.",
  },
  {
    slug: "groove-pitch",
    group: "r9",
    round: "r9",
    note: "Replaces: loader / progress indicator.",
    eyeball:
      "Confirm the finished spiral is unmistakably different from loader-spirograph-trace at a glance — the pitch (spacing between turns changing, wide-here/narrow-there) must be the load-bearing difference, not the shape; visual indistinguishability from that sibling is the named kill condition. Check the pitch-band transitions read as a legible pattern, not noise.",
  },
  {
    slug: "capstan-slip",
    group: "r9",
    round: "r9",
    note: "Replaces: determinate progress bar.",
    eyeball:
      "Confirm the mechanic reads through transport geometry itself — a driven shaft, a nip, a periodic slip-and-recover — and not as a generic 'loading with dots/segments' motif once the transport chrome is mentally stripped away (the named kill condition). Check it isn't visually confusable with idler-drop's gear-train motif at a glance — capstan-slip has no teeth or ratio, only continuous linear tape speed with a slip.",
  },
  {
    slug: "tonearm-skate",
    group: "r9",
    round: "r9",
    note: "Replaces: read-only quality/tracking gauge.",
    eyeball:
      "Without axis/label context, check whether the sweeping needle still reads as a geometric tracking-error function with two exact zero points, or just as noisy jitter — the latter is the named kill condition ('null point' meaning nothing to a glance-level viewer). Confirm the disc-plus-sweeping-arm silhouette doesn't get confused with a plain clock hand (clock-card) or with dial-moire's drag-driven rotary control — this one is ambient and autonomous, zero user input.",
  },
  {
    slug: "cylinder-hillndale",
    group: "r9",
    round: "r9",
    note: "Replaces: divider.",
    eyeball:
      "Watch the carriage's sideways creep and confirm it visibly steps by exactly one wrap per full cylinder turn — if it just looks like 'a barrel spinning' with no legible link between rotation and the carriage's lateral motion, that's the named kill condition. Check it doesn't read as a restyle of loader-thread-spool's radial coiling. Builder flag: wrap spacing scales with width instead of a literal 6px, specifically to keep both the pitch and the 26s traversal true — check spacing still reads correctly at both small and large container widths.",
  },
  {
    slug: "jacquard-card-chain",
    group: "r9",
    round: "r9",
    note: "Replaces: ambient status/activity strip.",
    eyeball:
      "Watch the needle-bank ripple resolve left-to-right over 160ms at each 900ms card read — random flicker instead of a legible ripple-to-held-pattern is the named kill condition, as is dropping cadence below ~700ms/card (the overflow-chip-mux failure mode the spec names explicitly — never speed up to fix it, only slow down further). Confirm the 220ms card slide reads as a clear departure/arrival, and that this reads as a mechanical process, not a settings/config toggle array. Builder flag: card stock is a 0.35-alpha --ns-muted fill, resolving a spec that asked for both outline-only AND punched holes — judge whether the fill still reads as physical card stock rather than a generic panel.",
  },
  {
    slug: "tufting-gun-loop-pile",
    group: "r9",
    round: "r9",
    note: "Replaces: empty-state / background texture fill.",
    eyeball:
      "Watch the gun head/crosshair sweep one row at ~30 cells/s (~1.1s/row) with tufts popping in just behind it — if the row-by-row order isn't visually distinguishable from peen-coverage's random scatter at a glance, that's the named kill condition (the ordered sweep is this component's entire reason for existing). Confirm the scrolling feed reads as a smooth, steady conveyor, not jittery. Builder flag: light theme is unverified.",
  },
  {
    slug: "knit-ladder-run",
    group: "r9",
    round: "r9",
    note: "Replaces: ambient status/health feedback moment.",
    eyeball:
      "Track the ladder gap itself — its position, and whether it's opening or closing — at the spec's one-row-per-300-350ms cadence; propagation/repair reading too fast to track that direction would be the round 8b overflow-chip-mux failure this spec is written against. Confirm the ladder always fully repairs (never reaches the top edge unrepaired) and that the fault reads as an intentional recurring self-heal, not a broken render. Builder flag: two builders wrote this slug concurrently; the surviving version is the second one, verified coherent across all three files (component.tsx, demo.tsx, meta.json) — worth a fresh end-to-end look rather than assuming the first pass's shape.",
  },
  {
    slug: "bobbin-lace-pricking",
    group: "r9",
    round: "r9",
    note: "Replaces: decorative divider / empty-state ornament.",
    eyeball:
      "Track the working band's position and the pull of the one pin just behind it — the load-bearing removal-behind-the-band mechanic no sibling lattice (mesh-lash, seep-lattice, pin-register) has. If the crossing motion is too fine-grained to read at card scale (pin pitch under ~10px), or if the whole thing reads as a generic abstract 'connecting dots' network rather than legible crossing pairs with a visible working band, those are the spec's named kill conditions.",
  },
  {
    slug: "warp-knit-tricot-lapping",
    group: "r9",
    round: "r9",
    note: "Replaces: ambient background/divider texture.",
    eyeball:
      "Watch the guide bar's alternating shog direction (left vs right) at each course — one shog every 500ms with a 200ms directional slide is the one thing to track. Builder flag: the builder says if this reads as a flat mat rather than a legible zigzag chevron, that is a kill, not a tweak — judge accordingly. Also check it stays visually distinct from background-truchet-weave's continuous arc weave and never converges toward loader-loom-weave's full-width shuttle-pass look (both named kill conditions).",
  },
];
