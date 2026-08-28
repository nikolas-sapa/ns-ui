# frazil-dam

- **slug:** frazil-dam
- **tier:** core (card-scale)

## Product surface
Loader / progress indicator — same slot family as `vacuum-filtration-cake-build`, `loader-die-tumble`, `loader-thread-spool`.

## The real mechanic
Frazil ice: fine, flat, mm-scale ice crystals that nucleate directly within supercooled, turbulent water (rivers, wave-mixed sea surface) rather than at a fixed still interface — turbulence keeps them suspended and mixed through the water column instead of skinning over the top. Crystals are advected by the flow and accumulate against obstructions: a channel narrowing, an ice-boom rack, the leading edge of an already-frozen reach, building a frazil/anchor-ice dam. Once accumulated mass or local hydraulics cross a threshold, a portion of the dam sloughs off as a coherent mass and is carried downstream (documented "ice run"/anchor-ice release events in river-ice engineering literature, e.g. Beltaos, *River Ice Formation*), after which accumulation resumes from a smaller residual base — never a full reset to bare channel.

## Mechanic description (user-facing)
Fine ice crystals drift through turbulent water and pile up against a rack; every 15–20 seconds the crest calves off downstream and the dam resumes building from what's left.

## Rendering approach
2D canvas, card-scale, `w-full h-full`, geometry derived from container's smaller dimension. Left-to-right flow channel; crystals as small (2–4px at typical card size) sprites advected by a 2-octave curl-noise velocity field re-evaluated at 20Hz. A dam mass profile accumulates against a fixed rack near the right edge.

## Real numbers
- Crystal transport (nucleation to lodging): real ~2–8s in an actively forming reach — already human-scale, rendered near 1:1, no decoupling needed here.
- Spawn rate: 6–10 crystals/s at the left edge.
- Dam accumulation: real timescale is minutes-to-hours; compressed to ~15–20s render time to reach release threshold (documented compression, illustrative).
- Release threshold: dam crest at 70% of channel width.
- Release event: ~35–45% of accumulated mass detaches as one coherent chunk, crosses the frame downstream over ~1.2s and exits; residual dam (55–65% of prior mass, never to zero) remains as the new accumulation base.

## The resting loop
- **t0:** dam mid-accumulation (some nonzero crest height), crystals visibly in transit through the channel.
- **2.5s:** crest visibly higher (or, if a release just fired, visibly lower with a chunk mid-transit downstream) than t0 — crystal positions have also advanced.
- **5s:** either a full release cycle has completed since t0 (crest rose, calved, dropped) or accumulation has progressed further — state differs visibly from both prior checkpoints either way.

## Reduced-motion freeze frame
Freeze mid-accumulation at ~55% toward the release threshold, with several crystals visibly mid-transit in the channel — shows both the ongoing flow and the building dam in one still, more structured than an empty-channel t0.

## Interaction
None required — ambient loader. If bound to a real async value (`useWhen` should note this as an option), the accumulation fraction may map to actual progress, but the default demo runs ambient and unbound, still cycling through release events regardless.

## Legibility
The ONE thing to follow: the dam's crest at the rack. Watch it rise, then calve one visible chunk downstream (~1.2s, clear departure and arrival at the frame edge), then resume rising from a visibly reduced but nonzero base. A full cycle recurs every ~15–20s.

## Light vs dark theme
Dark: near-black turbulent water, pale crystals and dam mass via luminance. Light: pale-grey water (`--ns-muted`-derived), dam and crystals read as a luminance step down from the water field toward `--foreground`. The rack/obstruction structural line is drawn at genuine foreground contrast, never at `--border`'s ~1.1:1 separator contrast (a structural element must stay visible).

## Differentiator (checked against neighbours)
`registry/core/vacuum-filtration-cake-build` is a monotonic, non-releasing Darcy-decay fill under still liquid (a single bounded 14s fill-then-stop cycle, drip cadence stretching, no flow visible except drips) — frazil-dam is continuous turbulent transport (visible crystal advection throughout the channel, not drips) that accumulates and PERIODICALLY, REPEATEDLY calves, and never terminates.

## Kill criteria
- If accumulation and release don't visibly differ across a t0/2.5s/5s screenshot window (e.g., landing twice in the same slow phase with no crystal motion) → reject.
- If the release event reads as a blink rather than a departing/arriving mass → reject (round-9 cadence rule).
- If crystal turbulence/flow is dropped in favor of a static fill bar → reject (converges on `vacuum-filtration-cake-build`).
- If any color literal or `--ns-accent` touches the dam or crystals → reject.
