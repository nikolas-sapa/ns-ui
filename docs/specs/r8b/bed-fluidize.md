# bed-fluidize

- **slug:** `bed-fluidize`
- **tier:** loud (full-bleed WebGL showpiece)

## Product surface it replaces
Hero background — full-bleed ambient behind a headline.

## The real mechanic
Gas-fluidized particle bed. Above the minimum fluidization velocity (`Umf`), gas rising through a bed of granular solid suspends the particles so the bed behaves like a boiling liquid: gas voids ("bubbles") nucleate at the distributor plate, rise, and coalesce, growing in diameter with height per the Darton bubble-growth relation, while particles circulate downward around the bubble wakes. Source: standard fluidized-bed reactor behaviour (chemical/process engineering — catalytic crackers, dryers, combustors all run this regime).

## One-sentence mechanic description
A bed of particles suspended by rising gas boils continuously — voids nucleate at the floor, grow and merge as they climb, and burst at the surface while particles recirculate downward around them.

## Rendering approach
WebGL, fullscreen triangle + fragment shader. Particle field simulated as a 2D height/density field on a 128×72 sim grid (scaled to container aspect, minimum-dimension-derived cell size so it holds card-scale down to ~360px wide), point-sprite instanced particles rendered on top (target: 1 particle sprite per ~9px² of container area, capped at 6000 instances). Bubble voids are procedural: signed-distance blobs advected upward, radius growing with height, using a coalescence rule when two blobs' surfaces touch (merge into one blob of combined area, matching real bubble coalescence).

## Real numbers
- Bubble nucleation rate at the distributor: 2.2 bubbles/s per 100px of container width at minimum fluidization (loosely mapped from real bubbling-bed frequencies of 1–5 Hz per distributor zone).
- Initial bubble diameter at nucleation: 3% of container height. Growth: diameter scales as `height^0.4` from nucleation point to bed surface (Darton correlation exponent), capped at 22% of container height before forced burst.
- Bubble rise velocity: `0.71 * sqrt(g_eff * D_bubble)` where `g_eff` is a tuned constant giving ~14% of container height/s for a mid-sized bubble — visually: a bubble crosses the bed in 2.5–4s depending on size.
- Particle circulation: downward drift velocity in bubble wakes = 60% of local bubble rise velocity, matching the real observation that wake particles trail bubbles rather than free-falling.
- Bed surface: particles ejected above the nominal fill line when a bubble bursts, ballistic arc lasting 220–380ms, falling back under a constant downward acceleration.

## The resting loop
- t0: 4–6 small bubbles visible near the distributor (bed floor), surface relatively flat.
- 2.5s: at least one bubble has grown past 12% of bed height and is mid-rise, surface shows 1–2 recent burst craters settling.
- 5s: bubble population and size distribution has fully cycled at least once (no bubble present at t0 survives to t5 — every void present at t0 has burst and been replaced), so the frame is structurally different, not just phase-shifted.

## Reduced-motion freeze frame
Freeze at the moment a mid-sized bubble (12–15% of bed height) sits at 60% of the bed's vertical span, with a visible burst crater from a prior bubble still settling at the surface — the single frame that shows nucleation-growth-burst all represented at once. Named: `FREEZE_PHASE = mid-rise-with-recent-burst`.

## Interaction
Pointer position locally raises the effective gas velocity within a radius (particles agitate more, bubble nucleation rate rises) — a physically real fluidized-bed behavior (local gas maldistribution). Decays back to ambient rate over 600ms after pointer leaves. Must NOT: tint agitated particles with `--ns-accent`; the agitation must read via increased local particle velocity/luminance jitter only.

## Light vs dark theme
Dark: particles at a `--ns-muted` base rising to `--foreground` at peak local velocity (agitation = brighter). Light: bed body at `--background`-to-`--ns-muted` ramp (particles must stay a visible step below `--foreground` so the bed doesn't wash into any headline text sitting over it) with bubble interiors *darker* than the bed (voids read as absence, not brightness, in light theme — the inverse relationship called out in the recipe's dye-whorl precedent). Checked in light theme first per token rules.

## Kill criteria
Reject if: bubbles don't visibly nucleate/grow/coalesce/burst (reads as generic noise churn, no longer a fluidized bed); if particle count is too sparse to read as a "bed" at card scale on a resize; if it converges toward looking like existing granular/noise showpieces already in the registry rather than showing the distinct nucleate-grow-burst cycle.
