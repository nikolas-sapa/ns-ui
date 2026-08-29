# leaven-crest-fall

- **slug:** `leaven-crest-fall`
- **tier:** core (card-scale SVG/DOM)

## product surface it replaces
A system-health/status gauge (queue depth, load indicator) — currently a numeric readout or a static arc gauge.

## the real mechanic
A sourdough starter after feeding: yeast and lactic-acid bacteria ferment the flour, producing CO2 that domes the surface upward, blistering with surface bubbles as it rises to a peak (bakers mark the jar to track 2-3x rise), then collapses/falls as gas escapes and food depletes, ready to be fed again. A home starter on a twice-daily feeding schedule runs this rise-fall arc every ~8-12 hours at room temp. Source: standard sourdough-starter maintenance.

## one-sentence mechanic description
A jar's surface dome rises with a blistering bubble texture to a peak, then visibly deflates as the bubbles thin out in step with the fall, resets with a feed pulse, and rises again.

## rendering approach
SVG cross-section: a jar outline (drawn once, static, in `--border`) with a filled dome path (`--foreground`-derived fill) whose height is animated, plus circular bubble elements scattered across the dome's visible top surface.

## real numbers
- Full cycle: 8s logistic rise from 1.0x to 2.4x baseline dome height, 4s exponential-decay fall back to 1.05x baseline (never fully flat — real starter leaves residual film), then a 600ms feed pulse (brief brightness flash + small volume bump) before the next rise. Total loop ≈ 12.6s.
- Surface bubbles nucleate via a Poisson process at rate λ = 0.8/s during rise; each bubble grows `r(t) = r0 * (t - tbirth)^0.3` up to a max radius of `minDim * 0.015`.
- During the fall phase, bubbles pop (radius → 0 over 120ms) at a rate matching the instantaneous derivative of the height-decay curve, so the visible bubble population thins exactly as the dome height drops — the micro (bubbles) is causally tied to the macro (height), not decorative.

## the resting loop
- t0: mid-rise, dome at ≈1.4x baseline, moderate bubble count.
- 2.5s: further into rise (or at peak, depending on loop phase) — taller dome, more bubbles than t0.
- 5s: past the 8s rise mark only if the phase lands there; otherwise still rising but visibly different height/bubble-count from both t0 and 2.5s (continuous logistic curve guarantees a visible delta at any 2.5s spacing within the 12.6s loop).

## reduced-motion freeze frame
Freeze at t=8s of the 12.6s loop: peak dome height, maximum bubble count — the most structured, highest-information frame ("risen" state), not t0 and not the collapsed state.

## interaction
None required (ambient status). Optional: a click/tap can trigger an immediate feed-pulse + fresh rise, but the component must autoplay through full cycles regardless of any input.

## light vs dark theme
Dome fill sits at a `--ns-muted` value against a `--background` jar interior, bubbles outlined in `--border` — check light theme early since a shallow dome/bubble contrast can flatten out against a light `--ns-muted`.

## kill criteria
- If, once built, the rise-fall arc reads as a generic sinusoidal "breathing" loading indicator (several exist in the loader family) — the mandatory differentiator is the asymmetric logistic-rise/exponential-fall timing plus the bubble population being derivative-coupled to height, not a symmetric pulse. Kill if that coupling isn't visually legible.
- Redundant with any krausen/fermenter-head concept sourced on the same round — if both ship, one is a restyle of the other; this one wins on being scaled to a familiar home-kitchen object (jar) rather than an industrial vessel.

## legibility
The ONE thing to follow: the dome's crest height rising then visibly deflating within one 12.6s cycle, with surface bubbles thinning out in step with the fall. Cadence: one full rise-crest-fall arc every 12.6s — slow enough to watch the whole arc, with the feed-pulse marking a clear cycle boundary.
