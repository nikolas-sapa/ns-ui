/**
 * Static content for /review — disposable local-only tooling, not part of
 * the catalog. Hand-authored from the latest fix list plus each new
 * component's own meta.json description where no note was given. Never read
 * by build-registry.ts or anything else; safe to edit freely.
 *
 * Four groups now (round r8a added a fourth, see bottom of the array):
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
 *                   EXPANSION_COUNT/R8A_COUNT) — never hardcode a count in
 *                   prose here or there.
 *   D "r8a"       — round 8a's 34 components, ported from the throwaway
 *                   app/r8a/page.tsx lab (left in place, untouched). No
 *                   lane: r8a's own thematic groupings (curtains,
 *                   backgrounds, heroes, ...) are a different axis than the
 *                   identity/money/living lane enum, so they live in each
 *                   row's `eyeball` text and the page's jump index instead.
 */

export type Lane = "identity" | "money" | "living" | "multiplayer" | "reliability" | "wayfinding";

export type ReviewItem = {
  slug: string;
  group: "fixed" | "untested" | "expansion" | "r8a";
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
];
