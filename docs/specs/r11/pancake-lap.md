# pancake-lap

- **slug:** pancake-lap
- **tier:** loud (full-bleed showpiece)

## Product surface
Full-bleed background panel (section background, same slot as `background-halftone-rosette`/`background-capillary-wick`).

## The real mechanic
Pancake ice: in cold, wave-agitated open water, ice can't form a solid sheet because wave action keeps breaking it up, so it instead forms roughly circular disc-shaped pans (WMO sea-ice nomenclature term). Pans nucleate small and grow at their edges; repeated wave-driven collisions between pans grind slush onto each pan's rim, building the diagnostic raised bumper edge. As pans crowd together under continued wave action, adjacent pans don't just jostle into a packed arrangement — one pan's edge rides up and OVER a neighbour's edge (rafting/overriding), producing a locally doubled, thicker ice layer at the overlap that can subsequently weld into a larger composite floe. Sourced from polar sea-ice field literature (WMO ice nomenclature; marginal-ice-zone wave/ice studies, e.g. Doble & Wadhams on pancake formation timescales — characteristic pan diameter set within roughly 30 minutes of formation under a given wave field).

## Mechanic description (user-facing)
A field of circular ice pans jostles on dark water; every couple of seconds one pan visibly climbs up onto a neighbour's rim and settles, leaving a permanently thicker weld at that spot.

## Rendering approach
2D canvas, full-bleed, `w-full h-full`, top-down view. Spatial hash grid for collision buckets, cell size = container's smaller dimension / 12. Pan count derived from frame area / average pan footprint (target ~40–70 concurrent pans on a typical hero).

## Real numbers
- Pan growth-to-stable-size: real ~20–40 min under active wave forcing → compressed to 6–9s render time per pan (~250x).
- Swell/collision cycle: real wave period in marginal-ice-zone conditions ~4–8s — rendered near 1:1 at ~5s per swell cycle (the one sub-mechanic intentionally NOT compressed, since it's already human-scale — this is the round-9 "decouple only where the real rate would alias" rule applied by NOT touching an already-legible rate).
- Rafting/lap event: occurs somewhere in the field roughly every 1.8–2.5s; each event takes ~700ms door-to-door (rise ~250ms, cross/settle ~450ms).
- Ambient drift: pans translate ~4px/s toward one frame edge; pans exiting are replaced by new small pans nucleating at the opposite edge, so field composition continuously turns over.

## The resting loop
- **t0:** field of pans at mixed maturity, mid-turnover (not all-new, not fully jammed).
- **2.5s:** at least one rafting event has completed somewhere (a visibly thicker, doubled-luminance lens now exists that wasn't there at t0); pan positions have drifted.
- **5s:** field composition has turned over further — pans present at t0 near the exit edge are gone, replaced by fresh small pans at the entry edge; a different rafting event has fired elsewhere.

## Reduced-motion freeze frame
Freeze mid-frame on a full field showing mixed pan maturity (some just-nucleated small discs, some full-grown with raised rims) and at least one pan caught mid-lap, rim visibly overlapping a neighbour — the most structurally complete frame, not a sparse early one.

## Interaction
None — ambient full-bleed background. If any: a very subtle, fast-decaying local ripple under the pointer that never displaces a pan's actual position (a lap event is wave-driven, not user-driven — moving pans on hover would misattribute the mechanic).

## Legibility
The ONE thing to follow: a single rafting/lap event — one pan's edge visibly rising over its neighbour's rim, crossing, and settling. Roughly one such event is visible somewhere in frame every 1.8–2.5s, each lasting ~700ms with a clear rise/cross/settle arc, not a blink.

## Light vs dark theme
Dark: near-black open water, pale-grey pan tops, darker wet rims (rim shading via a luminance step down from the pan-top value, never `--border` as a fill). Light: pale-grey water (`--ns-muted`-derived), pan tops read white-ish (near `--foreground`'s light-theme value), rims read as a step DOWN in luminance from the pan top — same directional relationship (ice brighter than water) held in both themes via bias/contrast shift, not a color swap. Checked in light theme early since flat pale-on-pale is the failure mode to catch.

## Kill criteria
- If pans read as generic non-overlapping circle-packing with no legible lap event in any 3s window → reject (converges to `background-lloyd-relax`/`floret-pack`'s territory).
- If the field ever reaches a fully jammed, static frame with no ongoing edge turnover → reject (finishes and stops).
- If rim or lap-weld highlight uses `--ns-accent` or any color literal → reject.
- If light theme pans lose contrast against the water field → reject.
