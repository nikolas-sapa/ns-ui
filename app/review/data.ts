/**
 * Static content for /review — disposable local-only tooling, not part of
 * the catalog. Hand-authored from the latest fix list plus each new
 * component's own meta.json description where no note was given. Never read
 * by build-registry.ts or anything else; safe to edit freely.
 *
 * Nine groups now (round r8a added a fourth, round r8b a fifth, round r9 a
 * sixth, round r10 a seventh, round r11 an eighth, round r12 a ninth, see
 * bottom of the array):
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
 *   G "r10"       — round 10's 30 components, flat, same shape as r8b/r9.
 *   H "r11"       — round 11's 30 components, flat, same shape.
 *   I "r12"       — round 12's 30 components, flat, same shape. `note` is
 *                   "Replaces: <surface>." taken from that component's own
 *                   spec's "product surface it replaces" line; `eyeball` is
 *                   a diagnostic built from that spec's own kill criteria
 *                   and legibility line (never a restatement of the
 *                   description) — the specific way THAT component's
 *                   mechanic can be faked, inverted, or misread, not a
 *                   generic "watch it move" prompt.
 */

export type Lane = "identity" | "money" | "living" | "multiplayer" | "reliability" | "wayfinding";

export type ReviewItem = {
  slug: string;
  group: "fixed" | "untested" | "expansion" | "r8a" | "r8b" | "r9" | "r10" | "r11" | "r12" | "r13";
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

  // Group G — round 10's 30 components, flat (no lane), same reasoning as
  // r8a/r8b/r9. `note` is "Replaces: <surface>." from each spec's own
  // "product surface it replaces" line; `eyeball` is built from that spec's
  // own kill criteria and legibility line.
  {
    slug: "adhesive-squeeze-bead",
    group: "r10",
    round: "r10",
    note: "Replaces: a merge/combine-two-items affordance (docking a panel, attaching a chip, merging two cards).",
    eyeball:
      "Watch the seam settle from uneven to smooth as the bead builds — if it reads as a generic border-radius pulse rather than a bead with individually varying growth points cementing along a seam, that's the named kill condition.",
  },
  {
    slug: "aspheric-turn-spiral",
    group: "r10",
    round: "r10",
    note: "Replaces: hero.",
    eyeball:
      "Track the specular glint traveling along the spiral groove (about one arc-sweep every 2.5s, deliberately decoupled from the real multi-thousand-rpm spindle) — if it reads as a generic chrome sphere with decorative lines rather than a legible center-to-rim spiral, or the periodic direction reversal reads as a jarring reset instead of a smooth traverse, that's the named kill condition.",
  },
  {
    slug: "autoclave-cycle-gauge",
    group: "r10",
    round: "r10",
    note: "Replaces: a progress/status meter for a long-running background process.",
    eyeball:
      "Within the first 5s, check whether the needle's ramp and vent phases read at visibly different speeds (12s ramp / 15s hold / 5s vent) — if ramp and vent look the same speed, that's the named kill condition.",
  },
  {
    slug: "bombe-drum-halt",
    group: "r10",
    round: "r10",
    note: "Replaces: a search/lookup loading indicator.",
    eyeball:
      "Watch the drum's continuous scroll for whether it reads as purposeful scanning rather than noise/static, and confirm the halt event registers as a clear discrete beat against that background motion, not a barely-there blip — both are named kill conditions.",
  },
  {
    slug: "braze-capillary-fill",
    group: "r10",
    round: "r10",
    note: "Replaces: a linear progress/validation-fill indicator.",
    eyeball:
      "Confirm the wetted/molten highlight reads as a luminance shift, not a colour shift, and that the fillet meniscus builds directionally with real curvature rather than reading as a generic dot — a progress bar with a gradient painted over it is the named kill condition.",
  },
  {
    slug: "centrifuge-rotor-band",
    group: "r10",
    round: "r10",
    note: "Replaces: a loading/progress indicator.",
    eyeball:
      "Check the rotor's spin reads as smooth motion, not a strobe or a frozen disc, and confirm the four density bands have visibly migrated outward by t=5s (3px over each 8s hold) — an imperceptible drift is the named kill condition.",
  },
  {
    slug: "crimp-barrel-set",
    group: "r10",
    round: "r10",
    note: "Replaces: a connect/link/attach confirmation control.",
    eyeball:
      "Check the crimped end-state for a visible witness dimple and strand flare, not just a closed clamp, and confirm open/close reads as two distinct held states rather than a blur — and confirm the dies never tint with accent colour on seat, the standing accent-highlight defect.",
  },
  {
    slug: "differential-analyser-trace",
    group: "r10",
    round: "r10",
    note: "Replaces: a live/streaming line-chart background.",
    eyeball:
      "Confirm the wheel-on-disc radius visibly tracks the trace curve beside it (a causal link, not arbitrary wobble), and that the fast constant disc spin doesn't visually drown out that slower radius signal, which is the actual point.",
  },
  {
    slug: "extrusion-die-cut",
    group: "r10",
    round: "r10",
    note: "Replaces: a loader/progress fill for long-running background jobs.",
    eyeball:
      "Watch one blade sweep start-to-end (220ms, roughly every 2.2s) — if it reads as a blink rather than a visible travel, or the rope texture only reads under colour (must hold in pure luminance), or the whole thing collapses into a generic dithered progress bar indistinguishable from progress-hatch/progress-wick, that's the named kill condition.",
  },
  {
    slug: "float-ribbon-draw",
    group: "r10",
    round: "r10",
    note: "Replaces: a multi-stage pipeline/job-status bar.",
    eyeball:
      "Sample luminance at the ribbon's three zones (molten/cooling/set) — if they read within ~5% of each other rather than a real thermal gradient, the zone contrast (the entire mechanic) has collapsed to a flat grey bar, the named kill condition.",
  },
  {
    slug: "gather-marver",
    group: "r10",
    round: "r10",
    note: "Replaces: a file-upload/processing indicator.",
    eyeball:
      "Compare the blob's shape at t0 vs t5s — if they look like the same uneven blob with no visible rounding correction, that's the named kill condition; the whole mechanic depends on a real before/after within a single observation window.",
  },
  {
    slug: "glory-hole-cycle",
    group: "r10",
    round: "r10",
    note: "Replaces: a generic 'processing/actively syncing' status chip.",
    eyeball:
      "Check light theme specifically during the last ~1.5s of each 4s cycle — if the decaying glow becomes indistinguishable from the resting chip background rather than still reading as 'dim, not gone,' that's the named kill condition.",
  },
  {
    slug: "knife-edge-rack-focus",
    group: "r10",
    round: "r10",
    note: "Replaces: loader (an 'instrument is actively reading' placeholder).",
    eyeball:
      "Watch for distinct zone banding as the shadow boundary sweeps (not a plain vignette), and check the 0.6s null-dwell pause at flat grey reads as a deliberate diagnostic hold, not the component freezing or breaking — both named kill conditions.",
  },
  {
    slug: "lap-stroke-trace",
    group: "r10",
    round: "r10",
    note: "Replaces: background/ambient card texture.",
    eyeball:
      "Watch for 5s whether the golden-ratio stroke pattern is distinguishable from a simple closed loop, and check for the disc/blank framing and pressure-dwell interaction that separates this from generic decorative Spirograph — missing either is the named kill condition.",
  },
  {
    slug: "lug-cage-tally",
    group: "r10",
    round: "r10",
    note: "Replaces: a generic loading/processing spinner.",
    eyeball:
      "Watch for 10+ seconds whether a wheel's pin-flash visibly causes the tally bar to tick — if the five spinning wheels just read as decorative clutter with no perceivable causal link to the tally's advance, that's the named kill condition.",
  },
  {
    slug: "magnetron-racetrack-sweep",
    group: "r10",
    round: "r10",
    note: "Replaces: background.",
    eyeball:
      "Check whether an accumulating eroded-groove texture is legible beneath the glow ring — if it just reads as a generic rotating spinner/loader with no physical erosion context, or the 22s sweep period reads as inert rather than alive, that's the named kill condition.",
  },
  {
    slug: "microtome-ribbon-feed",
    group: "r10",
    round: "r10",
    note: "Replaces: full-bleed hero.",
    eyeball:
      "Watch one segment form at the blade edge (1.4s cadence) — confirm a visible banding join at each segment boundary, not a smooth wavy line with no seams, and confirm the cadence is slow enough to track individual sections rather than a blur.",
  },
  {
    slug: "millstone-furrow-flow",
    group: "r10",
    round: "r10",
    note: "Replaces: ambient background/divider panel for a 'processing' section.",
    eyeball:
      "Mentally strip the particles and check whether the two-layer furrow moiré (runner over bedstone) still reads as a moving band on its own — if not, this is a restyle of an existing radial background. Separately confirm each grain visibly shrinks in size as it spirals outward rather than just vanishing at the end.",
  },
  {
    slug: "parison-inflate",
    group: "r10",
    round: "r10",
    note: "Replaces: a capacity/fill-progress meter.",
    eyeball:
      "Watch the bubble's rim thickness as it grows and decelerates over 2.6s — if it just reads as a circle expanding with no sense of the wall thinning, that's the named kill condition; a growing circle alone isn't a differentiated mechanic.",
  },
  {
    slug: "rivet-buck-set",
    group: "r10",
    round: "r10",
    note: "Replaces: a lock/pin/fasten toggle.",
    eyeball:
      "Count the hammer strikes — they must read as 5 discrete impacts, not one smooth squash, and after forming stops, check the two sheets visibly narrow together (the shrink/clamp draw-together) — both are what distinguish this from a generic rivet-pop animation, and missing either is the named kill condition.",
  },
  {
    slug: "roast-first-crack",
    group: "r10",
    round: "r10",
    note: "Replaces: full-bleed hero/background for a brewing/in-progress landing moment.",
    eyeball:
      "Watch for stretches longer than ~3s where no crack event fires — the drum should never read as dead that long. Separately confirm the drum's slow 0.15 rev/s rotation is still perceptible against the beans' own tumbling motion, and that beans-plus-fissures don't collapse into indistinguishable noise at card scale — this is a loud/full-bleed-only concept for exactly that reason.",
  },
  {
    slug: "roller-break-reduce",
    group: "r10",
    round: "r10",
    note: "Replaces: a multi-stage progress/pipeline indicator.",
    eyeball:
      "Watch a single particle cross each roll pair (150ms nip pass) — it must visibly compress, not instantly swap size. Check the corrugation rotation doesn't alias/strobe at 60fps, and confirm this reads as an actively-driven nip squeezing particles, not sieve-throw's passive mesh-aperture pass-or-fail — the same grain-size-reduction beat rotated 90° is the named kill condition.",
  },
  {
    slug: "rotor-window-bank",
    group: "r10",
    round: "r10",
    note: "Replaces: full-bleed hero/decorative background band.",
    eyeball:
      "Watch the double-step carry specifically — it must read as an emergent property of two wheels turning at different rates, not an arbitrary gimmick, and the three wheels together must read as a cipher-machine mechanism, not a plain digit odometer. The whole component lives or dies on that double-step being visibly different from a normal single-wheel carry.",
  },
  {
    slug: "slump-mould-drape",
    group: "r10",
    round: "r10",
    note: "Replaces: a content-reveal/completion moment.",
    eyeball:
      "Watch whether the centre of the reveal visibly settles before the edges do, over the full 4.5s — if every point appears to move together in sync, the whole differentiator from a generic reveal animation (visible centre-to-edge lag) has been lost.",
  },
  {
    slug: "sorter-pocket-route",
    group: "r10",
    round: "r10",
    note: "Replaces: an ambient processing/organizing loader.",
    eyeball:
      "Watch a card's deflection angle and timing as it routes to a bin — it should read as decided, not jittery/random, even though no literal value is shown. If the five bins just read as static and boring rather than a live sorting mechanism, that's the named kill condition.",
  },
  {
    slug: "soxhlet-siphon-cycle",
    group: "r10",
    round: "r10",
    note: "Replaces: a loading/progress indicator.",
    eyeball:
      "Track the liquid level rising for ~20s then draining in well under a second — if the fill and dump don't read as two clearly different paces, or the dump looks like a blink with no visible drain motion, that's the named kill condition; the slow/fast contrast IS the mechanic.",
  },
  {
    slug: "stack-step-carousel",
    group: "r10",
    round: "r10",
    note: "Replaces: background/hero backdrop.",
    eyeball:
      "Check reflectance stepping is a pure luminance change in both themes, never a colour/hue shift (no interference-bloom tint). Confirm the batch reload is staggered per-disc, not a synchronized full-chamber reset — the latter would read as a process finishing and stopping, failing 'alive at rest.'",
  },
  {
    slug: "vacuum-filtration-cake-build",
    group: "r10",
    round: "r10",
    note: "Replaces: a progress/processing indicator.",
    eyeball:
      "Compare drop cadence at t0 vs t=5s — it should have visibly stretched (at least ~2x slower), and the cake should show real growth, not read as a static blob; either failing is the named kill condition.",
  },
  {
    slug: "weld-nugget-grow",
    group: "r10",
    round: "r10",
    note: "Replaces: a press-and-hold confirm button.",
    eyeball:
      "Confirm the electrode clamp geometry and hold/solidify sequence are visible on their own, without the rare expulsion burst — if the nugget just reads as a generic pulsing circle indistinguishable from a loading spinner, that's the named kill condition; the occasional spark burst is a bonus, not what should be carrying legibility.",
  },
  {
    slug: "winnow-chaff-drift",
    group: "r10",
    round: "r10",
    note: "Replaces: full-bleed hero/background for a 'processing/filtering' landing moment.",
    eyeball:
      "Check grain and chaff read as two distinct kinds of physical matter (not just one paler copy of the other), and watch the ~9s gust cycle for a clear directional drift trend, not jitter — and compare directly against hero-particles-webgl/the ASCII falling-field family to confirm this isn't generic falling particles with a two-population reskin.",
  },

  // Group H — round 11's 30 components, flat (no lane), same reasoning as
  // r10.
  {
    slug: "airlift-slug-flow",
    group: "r11",
    round: "r11",
    note: "Replaces: a background file-sync/upload activity rail.",
    eyeball:
      "Watch one rising slug and its liquid plug — they must read as two coupled parts moving together (plug riding immediately ahead), not a single blob; the whole point of slug flow is that two-part coupling, and losing it is the named kill condition.",
  },
  {
    slug: "arc-ladder-climb",
    group: "r11",
    round: "r11",
    note: "Replaces: a full-bleed section-divider/hero background.",
    eyeball:
      "Watch one arc climb and vanish (~1.8s average) — check the jitter reads as a real plasma channel, not a wobbling line (a sub-30Hz random walk, decoupled from paint rate), and confirm the arc holds a full luminance band above the diverging rails in light theme without borrowing --ns-accent.",
  },
  {
    slug: "brinicle-descent",
    group: "r11",
    round: "r11",
    note: "Replaces: a full-bleed hero/background panel.",
    eyeball:
      "Take a 2.5s screenshot comparison of the tip descending — growth must be visible, not static. Confirm multiple tube lifecycles overlap (a new one nucleating before the last fully empties) rather than one-at-a-time, and check light theme specifically for real tube structure, not a flat pale rectangle.",
  },
  {
    slug: "cathode-stack-glow",
    group: "r11",
    round: "r11",
    note: "Replaces: a stat/metric readout tile.",
    eyeball:
      "At actual stat-tile digit size, check the ghost-stack edge effect is still visible (not just 'a number with slightly fuzzy edges'), and compare the 3-6Hz micro-flicker side-by-side against a plain static digit — if it reads as a rendering glitch rather than gas noise, that's a named kill condition.",
  },
  {
    slug: "column-wheel-heart-reset",
    group: "r11",
    round: "r11",
    note: "Replaces: a feedback moment (confirm/save pulse).",
    eyeball:
      "Compare the needle's normal drifting run against its reset snap (0.2s, every 4.5s) — the reset must read as an instantaneous, position-independent correction fundamentally different in character from an eased tween, not just a faster version of the same motion.",
  },
  {
    slug: "curd-cut-whey",
    group: "r11",
    round: "r11",
    note: "Replaces: a batch-processing status indicator.",
    eyeball:
      "Watch individual cubes shrink — they must visibly NOT shrink in lockstep (independent jittered rates), and the whole thing needs a discrete knife-cut plus a periodic 6s stir jostle to read as distinct from vacuum-filtration-cake-build's single continuous cake-buildup process, not a reskin of it.",
  },
  {
    slug: "decatron-step-ring",
    group: "r11",
    round: "r11",
    note: "Replaces: a circular step/progress indicator.",
    eyeball:
      "Check light theme specifically — unlit ring nodes must stay visible against the background, not vanish into it (which would leave only a wandering dot). Confirm the guide-phase stretch and the main-phase snap read as two visually distinct motions, not one generic rotating dot.",
  },
  {
    slug: "elevator-leg-dump",
    group: "r11",
    round: "r11",
    note: "Replaces: loader (an ambient 'system is working' indicator).",
    eyeball:
      "Watch the bucket dump cadence (8 buckets, ~1.1s spacing) — it should read as a steady stream of discrete dump events, neither long dead stretches with nothing happening nor an overwhelming blur; check it never drops below roughly 1s between visible dumps.",
  },
  {
    slug: "equation-kidney-cam",
    group: "r11",
    round: "r11",
    note: "Replaces: a section divider.",
    eyeball:
      "Watch the marker's reversals — the timing between them should feel uneven and asymmetric (2.5-4s, derived from a real kidney-cam curve), not a metronomic sine wave. Glance at it for under 2s and ask whether a static divider with one centered tick would look the same — if so, the motion isn't earning its keep.",
  },
  {
    slug: "facer-stamp-flip",
    group: "r11",
    round: "r11",
    note: "Replaces: loader (a batch-processing indicator for a document pipeline).",
    eyeball:
      "Watch enough envelopes pass the gate to catch a no-op (roughly 1 in 4) — it needs its own small distinguishing beat (a fainter gate-line flash), not to look identical to a flip; if every envelope looks the same at the gate, the mechanic has flattened into generic 'things move and get marked.'",
  },
  {
    slug: "foam-drain-coarsen",
    group: "r11",
    round: "r11",
    note: "Replaces: a full-bleed hero/section background.",
    eyeball:
      "Compare the resting frame directly against background-lloyd-relax and background-ascii-voronoi-walls — if it's just a uniformly-toned relaxed cell mesh with no height-graded border-width gradient AND no visible discrete T1/T2 rearrangement events, this is a restyle and fails. Pick one small cell and watch it individually shrink to a point and vanish (roughly every 2-3s) — if you can't track a single event, only shimmer, that's also a kill.",
  },
  {
    slug: "frazil-dam",
    group: "r11",
    round: "r11",
    note: "Replaces: a loader/progress indicator.",
    eyeball:
      "Watch the dam crest calve one visible chunk downstream (~1.2s, a clear departure and arrival at the frame edge) — a blink-fast release with no visible mass in flight is a named kill condition. Confirm accumulation and release genuinely differ across a t0/2.5s/5s comparison, and that this doesn't collapse into vacuum-filtration-cake-build's static fill-bar territory.",
  },
  {
    slug: "gluten-windowpane",
    group: "r11",
    round: "r11",
    note: "Replaces: a background-task progress/status indicator.",
    eyeball:
      "Confirm the strand-alignment itself (jittery angles resolving to parallel) is legible at card scale and is what's carrying the 'stretch test' identity — not just an alpha fade that would read identically to skeleton-develop's one-shot photographic reveal. This is a repeating elasticity test (3.2s/cycle), not a one-time reveal.",
  },
  {
    slug: "jam-kickout-loop",
    group: "r11",
    round: "r11",
    note: "Replaces: loader (an ambient background-job-with-retries indicator).",
    eyeball:
      "Watch for the diverter arm's swing on a kickout event (roughly 1-in-6) — it needs to read as a deliberate mechanical gesture recirculating an item, not as the component randomly breaking. If it still reads as a bug rather than a designed retry path, that's the named kill condition.",
  },
  {
    slug: "lamination-fold-shear",
    group: "r11",
    round: "r11",
    note: "Replaces: a multi-stage stepper/pipeline-progress indicator.",
    eyeball:
      "Count the bands at each fold (3 → 9 → 27, one fold every 2.3s) — confirm they stay distinguishable and never render finer than 27 (which would blur into scanline noise). Check this reads as literal band-count doubling on a fold event, not carbon-ply-fade's falloff-density stack or shear-billow's fluid shear — both are named restyle risks.",
  },
  {
    slug: "leaven-crest-fall",
    group: "r11",
    round: "r11",
    note: "Replaces: a system-health/status gauge.",
    eyeball:
      "Compare the rise and the fall shapes directly — rise should read logistic (slow-start, accelerating, then plateauing) and fall exponential (fast-then-tailing), an asymmetric pair, not a symmetric sine breathing pulse. Confirm surface bubble population visibly thins in step with the falling crest, not on its own independent clock.",
  },
  {
    slug: "mailbag-hook-exchange",
    group: "r11",
    round: "r11",
    note: "Replaces: hero/full-bleed background.",
    eyeball:
      "Watch the crane hook during the ~7s idle gap between exchanges — the residual pendulum decay must read as visibly 'still settling/waiting,' not as the component having stalled or broken. Check specifically whether a bag is on the hook and whether that changed at the last exchange — everything else here is peripheral atmosphere.",
  },
  {
    slug: "melt-pond-drain",
    group: "r11",
    round: "r11",
    note: "Replaces: loader/empty-state ambient panel.",
    eyeball:
      "Watch one drain event (~1.2s: a dimple forms, level falls, floor settles) — an instant level-snap with no visible sequence is a named kill condition. Across several cycles, confirm the drain point migrates to a different spot on the rim each time rather than always opening at the same location, which would read as a fixed mechanical valve rather than real migrating drainage.",
  },
  {
    slug: "neon-tube-striation",
    group: "r11",
    round: "r11",
    note: "Replaces: a horizontal section divider/rule.",
    eyeball:
      "At actual divider height (thin), check the striation bands are still individually wide enough to read as bands, not generic shimmer. Separately, the end-darkening ramp is deliberately slow (imperceptible without a 90s screenshot diff) — don't mistake its subtlety for a bug, but do confirm light theme holds the tube looking 'lit' without borrowing accent colour.",
  },
  {
    slug: "pancake-lap",
    group: "r11",
    round: "r11",
    note: "Replaces: a full-bleed background panel.",
    eyeball:
      "Watch for one pan's edge visibly rising over a neighbour's rim, crossing, and settling (~700ms, roughly every 1.8-2.5s somewhere in frame) — if no such event is visible in any 3s window, this reads as generic circle-packing (background-lloyd-relax/floret-pack territory). Also confirm the field never fully jams into a static frame with zero ongoing edge turnover — that would read as a process finishing and stopping.",
  },
  {
    slug: "plasma-filament-wander",
    group: "r11",
    round: "r11",
    note: "Replaces: full-bleed interactive hero background.",
    eyeball:
      "Move the pointer and check the filaments lead-compensate smoothly toward it rather than snapping instantly (an instant snap would violate the same lesson weld-pool already learned). At a realistic hero card size (not full 100vw), confirm the 11 filaments read as distinct reaching lines, not visual noise, and that light theme keeps them the clearly brightest element without leaning on accent colour.",
  },
  {
    slug: "pneumatic-carrier-dispatch",
    group: "r11",
    round: "r11",
    note: "Replaces: a dispatch/job queue tray.",
    eyeball:
      "Watch one carrier's transit — it should visibly brake into a cushioned deceleration before it thunks to a stop, distinctly different in speed from its earlier fast cruise. If it just looks like one smooth glide with no perceptible braking phase, the real dashpot deceleration (the whole point) has been lost.",
  },
  {
    slug: "rack-snail-strike",
    group: "r11",
    round: "r11",
    note: "Replaces: a live count/stat tile.",
    eyeball:
      "Watch a rack's fall depth against how many times the hammer strikes afterward — the depth should visibly determine the strike count, not read as decoration bolted onto an unrelated ticking number. Ask whether the bare stat figure alone would tell you the same thing equally well — if so, the mechanism isn't earning its screen time.",
  },
  {
    slug: "remontoire-rewind",
    group: "r11",
    round: "r11",
    note: "Replaces: a progress bar/sync-transfer indicator.",
    eyeball:
      "Compare the slow ~3s wind-up against the sudden trip release — they need to read as clearly different characters of motion (a visible build vs. an instant snap-loose), not just two speeds of the same tween. Ask whether removing the spring glyph would leave an equally legible progress indicator — if so, the mechanic isn't doing any real work.",
  },
  {
    slug: "spall-face",
    group: "r11",
    round: "r11",
    note: "Replaces: a background texture panel.",
    eyeball:
      "Watch one flake's lift → tip → fall arc (~350ms, roughly every 1.5s somewhere on the face) — a sub-200ms blink with no visible stages is a named kill condition. Separately confirm the whole face has directional conveyor drift, not just a static pitted texture (which would converge on edm-crater-field), and check light theme's freshly-exposed patch stays legible against the pale base.",
  },
  {
    slug: "spiral-chute-accrete",
    group: "r11",
    round: "r11",
    note: "Replaces: background (full-bleed ambient section backdrop).",
    eyeball:
      "Count how many parcels are visibly in flight on the spiral at once — at least 2-3 simultaneously is what should read as 'alive' at a glance. If it doesn't, the fix the spec calls for is a shorter spawn interval, not a faster descent — check the descent speed hasn't been sped up to compensate, which would break the near-real-time proportion this concept is built around.",
  },
  {
    slug: "steam-trap-batch-flush",
    group: "r11",
    round: "r11",
    note: "Replaces: an inline sync-status glyph or telemetry/event-buffer indicator.",
    eyeball:
      "At actual small (~24px) scale, check the 340ms blow-down still registers as a distinct fast phase against the preceding 3.2s fill, not just a generic sawtooth reset. The speed CONTRAST between the two is the entire mechanic — if it reads as a plain looping fill-then-reset bar with no mechanical 'trip' snap, that's the named kill condition.",
  },
  {
    slug: "tourbillon-cage",
    group: "r11",
    round: "r11",
    note: "Replaces: a full-bleed loading/route-transition curtain.",
    eyeball:
      "Within the first second of looking, check whether you see two things spinning at different rates (a fast, discrete ticking fork against a slow-turning cage) or just 'a thing spinning' — the latter is the named kill condition. Confirm the fork's balance frequency stays fast enough (not dropped below ~1.5Hz) that its ticks read as sharp discrete kicks, not a blur.",
  },
  {
    slug: "venturi-ejector-draw",
    group: "r11",
    round: "r11",
    note: "Replaces: a processing/analyzing loading spinner.",
    eyeball:
      "Watch the single marked tracer speed up specifically as it passes through the narrowed throat — the constriction has to visibly do something to the flow, not just look like a pipe with ambient dots drifting through. Confirm the tracer stays distinguishable from ambient particles by luminance alone, without leaning on accent colour to make it pop.",
  },
  {
    slug: "wind-regulator-bellows",
    group: "r11",
    round: "r11",
    note: "Replaces: a streaming media 'buffer-ahead' indicator.",
    eyeball:
      "Watch the lid's height for a discrete step-up on each 1.4s feeder stroke, followed by a smooth continuous drain in between — two visually distinct rhythms (pulsed supply vs. steady drain), not just 'a bar that goes up and down.' If it reads as a standard buffer bar with cosmetic bellows skinning and no functional distinction, that's the named kill condition.",
  },

  // Group I — round 12's 30 components, flat (no lane), same reasoning as
  // r10/r11.
  {
    slug: "auger-flighting-spoil",
    group: "r12",
    round: "r12",
    note: "Replaces: loader (a continuous-work indicator with an accumulating byproduct).",
    eyeball:
      "Watch the spoil pile's silhouette — it needs a stable, real angle-of-repose shape, not just a scatter of falling dots. In an actual 5s+ screenshot check, confirm the steady-state retire-fade turnover (old spoil fading out as new lands) is visually distinguishable from the earlier build-up phase, and that the spinning auger reads as secondary to the accumulating pile, not the primary read (which would restyle loader-thread-spool).",
  },
  {
    slug: "blast-hole-delay-sequence",
    group: "r12",
    round: "r12",
    note: "Replaces: a status feed/loader array.",
    eyeball:
      "In an actual runtime check, confirm the 900ms row-to-row cadence is genuinely followable (not the overflow-chip-mux failure of reading 'too fast to track'), and that the row-by-row propagation direction is the obviously legible feature, not just 'a grid of dots doing something.' In light theme, check the unfired/firing/spent states resolve in 3 clean luminance steps, not a muddy two-state blur.",
  },
  {
    slug: "caddisfly-case-assembly",
    group: "r12",
    round: "r12",
    note: "Replaces: loader (a determinate/indeterminate build-up loader).",
    eyeball:
      "Watch a single candidate grain's full decision (drift-in, brief pause at the gap, then either a 220ms snap-cement into place or a 260ms bounce-away-and-fade) — if accept and reject both just read as 'something appeared near the rim,' the whole selection mechanic collapses into generic particle accumulation. Also check light theme specifically: completed-course guide rings are drawn in --border at ~1.1:1 contrast, bumped to a higher alpha for grain-to-grain separation — confirm cemented grains stay legible against each other there, not just against the page background.",
  },
  {
    slug: "catenary-contact-stagger",
    group: "r12",
    round: "r12",
    note: "Replaces: a live connection/sync-quality indicator.",
    eyeball:
      "Watch the contact strip's side-to-side sweep (2.0s per pass) for smoothness at 60fps (no strobe/alias), and confirm the rare arc event (~every 20s) reads as a clearly separate, brief punctuation against that steady rhythm — not random flicker woven into the main sweep.",
  },
  {
    slug: "crack-polygon-order",
    group: "r12",
    round: "r12",
    note: "Replaces: a section divider/decorative panel fill.",
    eyeball:
      "Zoom into where a new crack meets an existing one — it must stop dead at a T-junction, never cross through (a crossing crack is the named kill condition, and is exactly what would make this indistinguishable from compare-crack-seam's free-crossing fissures). Confirm you can see three distinct generations — primary cells visibly being subdivided by finer cracks, not just 'a pattern filling in.' Check the rewet/heal phase reads as the surface genuinely clearing back to blank before the next cycle, not a generic fade that leaves the process looking finished and stopped.",
  },
  {
    slug: "edge-burnish-glaze",
    group: "r12",
    round: "r12",
    note: "Replaces: divider (a horizontal edge-trim rule).",
    eyeball:
      "Compare directly against honing-crosshatch and lap-stroke-trace — if the gloss just reads as another fixed-angle repeated-scratch texture, the load-bearing difference (an uneven gain-then-decay gloss economy, not a scratch angle) has failed to register. Watch cells the bright stroke passed several sweeps ago (4.6s per traversal) — they should visibly dull over time, giving a second, slower cue for where the stroke is about to return.",
  },
  {
    slug: "expansion-gap-breather",
    group: "r12",
    round: "r12",
    note: "Replaces: a divider/spacer between two independently-sized layout regions.",
    eyeball:
      "At a typical divider width, watch the gap width over a 2-3 second glance — it should show clear, unhurried movement (a 14s full cycle), not read as static because the amplitude collapsed to sub-pixel. The SVG overlay is 66px wide and overpaints ~14px into each neighbour at minimum gap — check a consumer with tight padding wouldn't see tongues drawn over their content, and confirm the tapered-teeth geometry is still distinguishable from a plain rectangular gap at small sizes.",
  },
  {
    slug: "flag-hoist-run",
    group: "r12",
    round: "r12",
    note: "Replaces: ambient loader/in-flight queue-depth indicator.",
    eyeball:
      "Watch one flag chip's climb → break-out → fly → strike cycle (~4.2s total) — the 300ms break-out rotation at the top needs to read as a clear, distinct 'arrival at the yard' moment, not just the climb continuing as one smooth slide. Compare against toast-gravity-stack at a glance — if this reads as the same queue-and-clear pattern rather than a hoist with a real break-out moment, that's the named kill condition.",
  },
  {
    slug: "fresnel-flash-group",
    group: "r12",
    round: "r12",
    note: "Replaces: full-bleed hero/section-background showpiece.",
    eyeball:
      "Between primary flashes (every 8.0s), watch for the smaller inter-facet glint traveling around the drum's rim (crossing 12 o'clock roughly every 1.0s) — if the only motion you register is the on/off primary flash, the continuous rotation has failed and it's reading as a blink. Check light theme specifically for a perceptible rotating drum, not a flat grey disc.",
  },
  {
    slug: "honeycomb-draw",
    group: "r12",
    round: "r12",
    note: "Replaces: background/divider texture panel.",
    eyeball:
      "Watch a single cell wall specifically as it straightens from a round overlap into a hex edge (1.4s spring settle) — if the whole grid just looks like a static hex pattern fading in via opacity, the mechanic (walls visibly straightening) has reduced to a generic fade-in and failed. Also check for the separate 4-7s recap flash once the grid is complete, a second followable event distinct from the initial build.",
  },
  {
    slug: "jumbo-drill-boom-pattern",
    group: "r12",
    round: "r12",
    note: "Replaces: hero/full-bleed background (rock-face tunnel-heading surface).",
    eyeball:
      "Compare directly against blast-hole-delay-sequence — if this just reads as another 'grid of holes changing state' with no differentiator, the spec itself says kill this one and keep the delay-sequence version. Watch the percussive jitter on an active hole — it must read as a hammering drill, not a rendering glitch. Judge whether 84s for the full 35-hole pattern still shows meaningful visible progress within a realistic card-viewing session.",
  },
  {
    slug: "knot-capsize-cycle",
    group: "r12",
    round: "r12",
    note: "Replaces: capacity/status gauge.",
    eyeball:
      "Watch the capsize moment (900ms, at peak of the 8s load cycle) — the two crossing loops must visibly slide and reseat into the new arrangement, not blink-swap topology instantly. Check the knot geometry itself is recognizable as an actual granny/reef distinction, not generic abstract crossing line art — that specific knot identity is what motivates the whole mechanic.",
  },
  {
    slug: "mudflow-levee-build",
    group: "r12",
    round: "r12",
    note: "Replaces: a progress/activity track.",
    eyeball:
      "Watch material accumulate specifically at the channel's MARGINS, not as a generic bar filling or a track glowing — the self-built confining bank is the entire mechanic. When a breach/avulsion fires, it needs to read as a clearly distinct sudden channel-jump, categorically different from the ongoing ambient narrowing — if it just reads as a value filling a fixed channel, that's progress-wick's territory, the named kill condition.",
  },
  {
    slug: "orb-web-construction",
    group: "r12",
    round: "r12",
    note: "Replaces: full-bleed hero background.",
    eyeball:
      "Confirm you can tell the bridge→frame→radii→auxiliary→capture phases apart as they build, not just 'lines appearing in sequence.' Specifically watch the solid capture spiral overtake the dashed auxiliary spiral turn by turn (520ms/turn) — that dashed-to-solid swap is the load-bearing detail. Separately, watch for the slower 9-13s tear-then-rebuilt-sector cycle as a second event on a longer look.",
  },
  {
    slug: "pipe-stand-trip",
    group: "r12",
    round: "r12",
    note: "Replaces: a progress/stepper.",
    eyeball:
      "Check the hoist/swing/rack motion reads as three distinct phases, not one moving dot up a bar. Cross-check the depth counter's number against the fingerboard's actual racked-stand count at any moment — any visible desync between the two (counter says one thing, fingerboard shows another) reads as broken rather than mechanical, a named kill condition.",
  },
  {
    slug: "range-light-transit",
    group: "r12",
    round: "r12",
    note: "Replaces: ambient feedback moment/connection-sync status.",
    eyeball:
      "Watch the gap between the two discs specifically — it should read as closing and reopening (a convergence-and-divergence story), not generic bouncing-dots motion with no relationship between the two. Since a full alignment only recurs every 14-18s, watch for at least that long before judging — if you never actually catch the brief brighten-then-fade alignment moment within a realistic glance window, the component's defining moment is too sparse to land.",
  },
  {
    slug: "ripple-migrate-slip",
    group: "r12",
    round: "r12",
    note: "Replaces: hero/full-bleed background.",
    eyeball:
      "Watch one slipface avalanche event (roughly every 1.1-1.6s) — it should read as a discrete stoss-build-then-lee-slip event, not the whole ripple silhouette continuously wobbling. Take an actual 5s screenshot comparison and confirm the whole bedform has visibly migrated downwind, not just that individual grains flickered in place. Confirm this reads as a standing dune silhouette, never individual flying grains (which would be winnow-chaff-drift's territory).",
  },
  {
    slug: "ropewalk-lay-twist",
    group: "r12",
    round: "r12",
    note: "Replaces: ambient card background.",
    eyeball:
      "Watch the single point where 3 strands converge into 1 rope — it should complete one visible rotation roughly every 3.55s, a genuine rotating convergence, not a fixed braid pattern that looks the same whether you're watching or not. Confirm the drum's wrap count is climbing over subsequent seconds as a second, slower confirmation the rope is actually being laid, not just spinning in place.",
  },
  {
    slug: "semaphore-arm-cast",
    group: "r12",
    round: "r12",
    note: "Replaces: ambient loader/multi-stage status indicator.",
    eyeball:
      "Watch the two arms — they should snap to a held angle pair and pause there (a discrete symbol, roughly every 2.15s) rather than sweeping continuously like clock hands. Check the 550ms swing itself shows a clear departure from the old angle and arrival at the new one, never an instant snap. Below ~120px card height, confirm the two arms haven't collapsed into an unreadable blob.",
  },
  {
    slug: "semaphore-arm-tension",
    group: "r12",
    round: "r12",
    note: "Replaces: a status/feedback badge or dot.",
    eyeball:
      "At actual card scale, check the arm tip's up/down bob (riding a 9-second wire-tension cycle) is visibly larger than ~3px — an imperceptible bob is a named kill condition. Watch the lamp's flicker specifically for whether it reads as a slow, legible drift or as a glitchy strobe.",
  },
  {
    slug: "serving-mallet-wind",
    group: "r12",
    round: "r12",
    note: "Replaces: loader/processing indicator (a thin ambient bar).",
    eyeball:
      "Within 1s of looking, check you can immediately tell served rope from bare rope. Watch the bright turn-lock highlight snap to the newest completed turn (every 0.9s) and separately track the served/bare boundary sliding at a slower 22px/s — confirm these two cadences read as clearly separate rhythms (a fast anchor point and a slow confirmation), not one aliasing into jitter on top of the other.",
  },
  {
    slug: "shutter-telegraph-board",
    group: "r12",
    round: "r12",
    note: "Replaces: ambient loader/decorative multi-stage status indicator.",
    eyeball:
      "Watch the staggered flip-wave cross the 2x3 shutter grid (60ms stagger between shutters, 320ms per flip) as a new symbol forms every 2.0s — it needs a distinct telegraph identity, not a generic accordion/skeleton-loader sweep; if you can't tell it apart from a loading skeleton at a glance, that's the named kill condition. Below ~100px card height, check the six shutters haven't compressed into an unreadable blob.",
  },
  {
    slug: "sinkhole-ravel",
    group: "r12",
    round: "r12",
    note: "Replaces: a destructive-action confirm.",
    eyeball:
      "Watch individual grains along the ravel front — they should drop on visibly independent timers, not as one uniform wipe/dissolve sweeping across. When the collapse fires, check it reads as categorically different motion from the ambient ravel (a sudden drop), not just the same ravel sped up. Compare against shakeout-crumble at a glance — the upward-migrating void chimney and sudden crust collapse need to be the primary read here, not generic grain attrition.",
  },
  {
    slug: "sleeper-renewal-relay",
    group: "r12",
    round: "r12",
    note: "Replaces: a live 'processing/refreshing' ambient row indicator.",
    eyeball:
      "Check light theme specifically for the old-vs-new sleeper fill contrast — it must not collapse to indistinguishable. Watch one sleeper's full lift-out → swap → drop-in cycle (1.3s, ~450ms departure + ~350ms arrival) — if it reads as an instant blink rather than that sequence, that's the named kill condition.",
  },
  {
    slug: "tamper-tine-squeeze",
    group: "r12",
    round: "r12",
    note: "Replaces: a 'compacting/optimizing' loader.",
    eyeball:
      "Watch one tine pair's plunge → squeeze-shut → lift cycle (1.6s per sleeper) — the ~500ms squeeze-shut moment needs to read as a clearly held 'arrival,' not a blink, and the overall rhythm should feel like a deliberate mechanical squeeze, not nervous jitter. Check the packed-vs-loose ballast texture is actually distinguishable at card scale, not just implied.",
  },
  {
    slug: "termite-ventilation-shafts",
    group: "r12",
    round: "r12",
    note: "Replaces: full-bleed background.",
    eyeball:
      "Mentally strip the flowing particles and ask if what's left (a fixed network) still reads as distinct from a generic pulsing-vein background. Confirm the network itself is visibly FIXED (unlike auxin-canal's growing space-colonization vessels), and watch one conduit's flow slow to a full stop for 1.5s at a crossover stall, then resume in the opposite direction — that reversal is the followable event, once per 42s cycle at each of the two stalls.",
  },
  {
    slug: "tricone-bit-teeth",
    group: "r12",
    round: "r12",
    note: "Replaces: hero/full-bleed background (crushed-rock close-up).",
    eyeball:
      "Watch the crater field for whether it reads as teeth actively striking a pattern into rock (real impact) or just generic noisy static — the STRIKE pattern must be the legible feature, not ambient roughness (which would make this indistinguishable from a bump-mapped granite background). Check the cone's rotation (decoupled down to an 8 RPM-equivalent) is smooth at 60fps, not visibly strobing/aliasing.",
  },
  {
    slug: "turbidite-graded-bed",
    group: "r12",
    round: "r12",
    note: "Replaces: a timeline/activity log.",
    eyeball:
      "Zoom into a single layer and check its internal grading — coarse at the bottom fining upward to fine at top — is actually legible, not just a solid-colored band (the graded structure inside each layer, not the stacking itself, is the whole mechanic). Check each new layer's base shows a visible scour notch, distinguishable from a flat stacking seam. Compare against growth-ring — the per-layer internal grading and irregular pulse-driven timing need to be the primary read, not a restyle of its ring-per-save pattern.",
  },
  {
    slug: "wasp-nest-envelope",
    group: "r12",
    round: "r12",
    note: "Replaces: full-bleed hero/background texture.",
    eyeball:
      "At normal viewing distance, check the layered banding is actually visible, not one flat texture. Watch the stroke-batch sweep the cutaway's exposed growth front (individual fan strokes landing at 3.4/s, batches every 5-8s) and confirm the cutaway reads as a structurally-motivated cross-section, not decorative styling. The cutaway walls are drawn in --border, which is only ~1.1:1 contrast in light theme — check they're actually visible there, the exact invisible-stroke trap.",
  },
  {
    slug: "welt-channel-close",
    group: "r12",
    round: "r12",
    note: "Replaces: divider (a full-width section-rule).",
    eyeball:
      "Watch a flap that's a few stitches behind the working needle — it should fold flush over 260ms as a continuous lift→flush hinge transform, never a hard cut/pop. At normal card-width scale (no zooming), confirm you can tell which flaps are still open and which have already folded closed.",
  },

  // Group J — round 13, 12 landing-page components (flat, no lane).
  {
    slug: "foil-block",
    group: "r13",
    round: "r13",
    note: "Closing CTA band (this surface had ZERO components in 546). Hot foil blocking: a mark transfers only where temperature AND pressure both clear their floor in the same pixel, so every strike fails differently.",
    eyeball:
      "Watch the spent foil web index between strikes — that is the resting loop. The die must strike the headline's terminal word as well as the button, and no bed of type may appear (that is quoin-lockup's territory). Its builder found the spec's phase table summed to 4510ms against a stated 4.60s and trusted the total.",
  },
  {
    slug: "peel-flow",
    group: "r13",
    round: "r13",
    note: "Closing CTA band, the second of two. Powder-coat orange peel levelling as a lambda^4 low-pass filter: short texture gone in about a second, 1mm texture surviving minutes, in the same patch.",
    eyeball:
      "The band sweeping across is fine; the region it has ALREADY passed must keep changing too (cure-shrinkage telegraphing), not just slide. Its builder ran that crop test offline and it passed. The CTA button is the one place accent is allowed here.",
  },
  {
    slug: "joint-iron",
    group: "r13",
    round: "r13",
    note: "Footer. The footer bucket had ONE member in 546 and that one is a scroll instrument. A French groove formed under a heated iron with 14 percent spring-back on release.",
    eyeball:
      "The question that matters: delete the canvas and does this stop being a footer, or just lose an ornament? Its first pass rendered the notch as a background erase plus a lit lip, which is an animated top border, which is exactly why footing-course was removed from this repo. It was caught and reworked to a lit recess. No scroll response by design.",
  },
  {
    slug: "spreader-bar",
    group: "r13",
    round: "r13",
    note: "Logo wall. The only concept in the round that handles unequal optical weight by physics: each mark's measured ink coverage solves the fulcrum balance, so a heavy mark hangs closer in.",
    eyeball:
      "Seven torsional pendulums at incommensurate periods plus a draught torque, so it has no rest state and no cycle length. Rotation caps at 34 degrees so no mark drops below 0.83 of frontal width. If the positions look authored rather than solved, the mechanic has not landed.",
  },
  {
    slug: "flying-splice",
    group: "r13",
    round: "r13",
    note: "Logo ribbon. The subject is moved off the strip and onto the rolls: radius falls 64.6 to 27.5px while RPM more than doubles.",
    eyeball:
      "A marquee whose subject is the strip is the crowded shape; this one is about the roll running out. Its builder found the spec's own worked example violated its 30 percent kill criterion and added a width floor.",
  },
  {
    slug: "slate-gauge",
    group: "r13",
    round: "r13",
    note: "Testimonial wall. Double-lap slating: every quote is occluded to its computed gauge margin, the wall geometry never changes, one slate lifts on its nail.",
    eyeball:
      "Aliveness is one lifted slate, not the wall shuffling. Full quote text is in the DOM and reachable by screen reader even when visually lapped, so check keyboard traversal reads whole quotes.",
  },
  {
    slug: "cockle-swell",
    group: "r13",
    round: "r13",
    note: "Pull-quote. Paper cockling with 5:1 CD/MD hygroexpansivity, so the ridges are directional and you can tell which way the grain runs.",
    eyeball:
      "This is the round's test of type on a moving surface. Its builder measured worst-frame composited contrast at 5.65:1 (under floor) and added a direction-aware clamp converging to about 7.0. Read the quote at the worst frame, not the average one.",
  },
  {
    slug: "quoin-lockup",
    group: "r13",
    round: "r13",
    note: "Bento grid whose variable is PRESSURE, not cell assignment: quoins relax, a tile pies out of plane, a planer block snaps it flush.",
    eyeball:
      "Every other bento rearranges cells; this one never does. Its builder found five tiles at 4+2+2+1+1 need ten cells and a 3x3 has nine, so the base grid is 3x4 with the leftover packed with furniture. The planer fires every 24.6s, outside a 5s glance.",
  },
  {
    slug: "damask-float",
    group: "r13",
    round: "r13",
    note: "Feature grid where one cloth spans the whole grid and hover reverses figure and ground as a front, with no fade and no translate.",
    eyeball:
      "The reversal must be a real change in the shading model, not a crossfade, and the grid must already be alive before you touch it. Its builder pinned base tone to the spec's luminance table after its own BRDF measured 1.3:1 against a required 1.6-2.2:1.",
  },
  {
    slug: "rocker-blot",
    group: "r13",
    round: "r13",
    note: "Waitlist capture. A rocker blotter whose accumulated mirrored residue IS the social proof; the form does not clear on success.",
    eyeball:
      "Its builder caught that this went visually dead at 5.4s while passing every gate screenshot at 0/2.5/5s, and added an unforced ambient blotting every 6s. Check the queue position reads as located, and that the lifted entry stroke stays visible as evidence.",
  },
  {
    slug: "indicator-rack",
    group: "r13",
    round: "r13",
    note: "Plan selector. Cash-register indicator tablets, where changing plan is a SORT and not a mutation: two plates cross on every change and the population is conserved.",
    eyeball:
      "A number that tweens between values is the common answer and is not this. Renamed from flag-rack to avoid reading as a signal-flag component. Arrow keys, Home/End and an aria-live price announcement all work.",
  },
  {
    slug: "kiss-cut",
    group: "r13",
    round: "r13",
    note: "Marquee. Content is what REMAINS after a subtraction: the die cuts the face stock and not the liner, the label stays down and the waste matrix peels away.",
    eyeball:
      "NEEDS YOUR EYE SPECIFICALLY: the rewind spool is positioned by deriving from the fixed 38 degree strip angle rather than placed by hand, and its builder asked whether it still reads as a corner rather than upper-middle at your aspect ratios. Also confirm the cut reads as through the face only, not all the way through.",
  },
];
