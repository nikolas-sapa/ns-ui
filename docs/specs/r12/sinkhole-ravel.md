# sinkhole-ravel

- **slug:** sinkhole-ravel
- **tier:** core (card-scale DOM/canvas)

## Product surface it replaces (Filter 1)
Destructive-action confirm — same family as `shakeout-crumble` (foundry shakeout) and
`crack-arrest-hole` (fatigue-crack arrest), differentiated by mechanism: cavity ravelling is
an upward-propagating VOID migration through a granular overburden culminating in periodic
surface collapse events, not a vibration-driven cohesion failure (`shakeout-crumble`) or a
crack-growth-toward-a-drilled-hole (`crack-arrest-hole`).

## The real mechanic
Cover-collapse sinkholes (common in karst terrain over limestone with a sand/soil mantle):
groundwater slowly dissolves a void in the bedrock below. The granular cover above the void
doesn't just sit there — grains at the void's ceiling continuously ravel (individually lose
support and fall into the cavity below, a real geotechnical term for progressive granular
collapse into an unsupported opening), so the void migrates UPWARD through the overburden
one grain-layer at a time, tracing a "stoping" chimney. This can continue for a long time
with no surface expression at all. Eventually the migrating void gets close enough to the
surface that the remaining crust can no longer arch-bridge its own weight, and it drops
suddenly — a genuine collapse event, not a continuation of the slow ravel — leaving a
crater. Loose material immediately begins sliding down the crater's own new angle-of-repose
walls to partially backfill it, and the whole slow-ravel-then-collapse process resumes from
a new nucleation point nearby (real karst fields have multiple sinkholes at different stages
at once).

## One-sentence mechanic description
A void chimneys upward through buried granular cover as its ceiling grains continuously
ravel into the cavity below, until the crust over it can no longer bridge its own weight and
drops in one sudden collapse, leaving a crater whose walls immediately begin sliding back in.

## Rendering approach
2D canvas. Cross-section view: a granular overburden field rendered as ~1800-2400 static
grains packed into rows (count derived from container's smaller dimension, `MAX_GRAINS =
clamp(round(minDim * minDim / 340), 1800, 2400)`), each grain a filled circle at a jittered
lattice position. A single scalar VOID HEIGHT tracks how far up the chimney has migrated
(0 = void only at the bedrock line, 1 = void has reached the surface crust). Grains whose row
falls below the current void height are individually removed (raveled) on their own random
per-grain trigger, never in a body-wide sweep, so the ravel front looks organic rather than a
straight wipe line.

## Real numbers
- Ravel rate: void height advances at **0.09/s** (roughly 11s to cross the full overburden
  height) with a low-amplitude jitter (±15% per 400ms) so the advance doesn't read as
  perfectly linear.
- Grain ravel trigger: any grain within the current ravel band (void height ± one grain-row)
  has an independent **1-in-6 chance per 250ms tick** of raveling (removed with a short 180ms
  fall+fade), which keeps individual grain-loss events visible roughly every 250-400ms — well
  inside the round 9 "~1s between discrete events" legibility floor while still reading as
  continuous background activity, since it is a field of small events rather than one big one.
- Collapse trigger: once void height crosses **0.94**, the remaining crust (top 6% of the
  overburden height) drops as a single collapse event over **220ms** (fast, ballistic) —
  this is the one big legible event a viewer tracks, roughly once per 12-14s cycle.
- Backfill: for **3.5s** after collapse, loose grains at the crater's new rim slide inward
  along a 34deg angle-of-repose slope (one grain every ~140ms) until the crater is roughly
  55% refilled — never fully, so the crater scar is visible going into the next cycle.
- Renucleation: **900ms** after backfill settles, a new void seed starts at a different
  lateral position (never the same spot twice in a row), so the visible chimney location
  drifts across the panel cycle to cycle rather than reusing one hole.

## The resting loop
- **t0:** an arbitrary mid-ravel frame — void partway up the chimney, a visible column of
  missing grains below an intact-looking crust, with 1-2 grains mid-fall.
- **2.5s:** void height visibly higher (or a collapse/backfill already in progress if timing
  landed there), different individual grains missing than at t0.
- **5s:** either a collapse has occurred and the crater is actively backfilling, or the void
  is close to the crust and the ravel band is visibly agitated (grain-loss rate at its
  highest, right before collapse) — either way, structurally different from t0 and 2.5s.

## The reduced-motion freeze frame
Freeze immediately after a collapse, before backfill starts (crater fully open, walls sharp,
maximum void visible) — the single most structured frame, showing the complete chimney shape
the mechanic is named for.

## Interaction
Gated on click-arm-then-confirm, matching the destructive-confirm family pattern (see
`shakeout-crumble`): first activation arms — the ravel rate visibly accelerates (teasing an
early collapse) as a countdown window runs, reversible, nothing lost yet. A second
activation inside that window commits: the collapse fires immediately (regardless of where
the ambient cycle currently sits) and `onConfirm` fires once, exactly as the crater finishes
dropping. Letting the window expire, Escape while armed, or losing focus de-arms: ravel rate
eases back to ambient. Must NOT tint the void, ravel band, or collapsing crust with
`--ns-accent` — that token is reserved for the button's own focus ring only.

## Light vs dark theme
Grains fill in `--foreground` at reduced alpha (~0.55) against `--background`; the void
itself is simply absence (background showing through), so it needs no separate color at all
in either theme. `--ns-muted` marks the ravel band's agitation glow (a faint radius around
actively-raveling grains) — check in light theme that this glow stays visible against
`--background` without needing to brighten past `--ns-muted`'s defined value.

## Kill criteria
- If the ravel front reads as a generic wipe/dissolve rather than individual grains dropping
  on independent timers, kill it — grain-by-grain independence is what separates this from a
  simple reveal transition.
- If the collapse event isn't clearly distinguishable from the ambient ravel (i.e. it just
  looks like ravel sped up rather than a sudden drop), kill it — the collapse is the one
  legible headline event per cycle and it must read as categorically different motion.
- If it reads as a restyle of `shakeout-crumble`'s grain-detachment mechanic once built, kill
  it — the upward-migrating void chimney and the sudden crust collapse must be the primary
  read, not generic granular attrition.
