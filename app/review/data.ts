/**
 * Static content for /review — disposable local-only tooling, not part of
 * the catalog. Hand-authored from the round-7 fix list plus each new
 * component's own meta.json description where no note was given. Never read
 * by build-registry.ts or anything else; safe to edit freely.
 *
 * Three groups this round:
 *   A "fixed"     — re-test, owner already flagged these with a note (see
 *                   .review-state.json, keyed by slug — never cleared here).
 *   B "untested"  — the rest of the first batch nobody has looked at yet.
 *   C "expansion" — three new lanes: multiplayer, reliability, and
 *                   wayfinding (chain-scale, hachure-fall, index-contour,
 *                   back-bearing, storey-pole, strip-station, pecked-ring,
 *                   bowditch-close, pin-register — nine, not the eight
 *                   originally scoped; bowditch-close finished after that
 *                   list was written). feat/r7-lab-6 has now merged into
 *                   feat/r7-integration, so the lane is included below.
 */

export type Lane = "identity" | "money" | "living" | "multiplayer" | "reliability" | "wayfinding";

export type ReviewItem = {
  slug: string;
  group: "fixed" | "untested" | "expansion";
  lane?: Lane;
  /** Group A only: one line of what changed. */
  change?: string;
  /** Group A only: one line of what to look for. */
  watch?: string;
  /** Group B/C only: one line, either the hand-written note or the meta.json description. */
  note?: string;
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
      "The demo persisted wall-clock age to localStorage, so the tree froze permanently 57.6s after first mount and stayed frozen across reloads; storage key now rolls every 20s.",
    watch: "Rings should keep accumulating even on a page you've had open a while.",
  },
  {
    slug: "floret-pack",
    group: "fixed",
    change: "Render position was quantized to 4px steps, which is the stutter; quantization removed.",
    watch: "Motion should be continuous now, not steppy.",
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
    change: "Reduced-motion painted one frame and never scheduled anything again; now a slow pulse.",
    watch: "Should be alive either way.",
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
    change: "The entering offset was applied after paint, so the entrance collapsed to a ~1.5px blip; moved pre-paint and travel raised.",
    watch: "Settle a payment should land with weight.",
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
    slug: "specie-clip",
    group: "untested",
    lane: "money",
    note: "Drag the coin; half the diameter is not half the money.",
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
];
