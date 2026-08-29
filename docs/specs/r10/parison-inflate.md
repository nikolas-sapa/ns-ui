# parison-inflate

**tier:** core (card-scale, 2D canvas)

## Product surface it replaces
A capacity / fill-progress meter — the linear or radial progress bar used for "storage used," "quota filled," or a determinate load meter.

## The real mechanic
Parison inflation in glassblowing. After gathering, the gaffer blows a controlled breath of air down the blowpipe into the solid-but-workable gob, forming a thick-walled bubble (the parison) inside the glass. As it inflates, the bubble's wall thins in proportion to how much the radius has grown (wall volume is roughly conserved, so wall thickness falls off close to 1/r² as the bubble expands), and inflation is self-limiting — a thin-walled, over-blown parison chills and stiffens faster than a thick one, which is why gaffers reheat between blows rather than blowing continuously. Source: standard hot-shop parison-forming sequence.

## One-sentence mechanic description
A thick-walled bubble inflates from a small dense core toward a larger, thinner-walled sphere, its growth visibly slowing as the wall thins, then resets and reheats to blow again.

## Rendering approach
2D canvas, single field, no grid. Two concentric circles (outer wall, inner cavity) whose radii derive from the container's smaller dimension: outer radius sweeps from 8% to 44% of that dimension over the inflate phase. Wall thickness rendered as the gap between the two circles, filled with a radial luminance gradient (denser/brighter near the wall, fading toward the cavity centre).

## Real numbers
- Inflate phase: 2.6s. Radius grows on `r(t) = r0 + (r1-r0) * (1 - exp(-t/τ))`, τ = 0.85s — fast initial expansion that visibly decelerates, mirroring the real self-limiting behaviour (not a linear or ease-out cosmetic curve).
- Wall thickness at radius r: `w(r) = w0 * (r0/r)^1.8` (an approximation of the real ~1/r² thinning, tempered to 1.8 so it stays visible instead of vanishing to a hairline) — starts at 22% of r0, thins to roughly 4% of r1 at full inflation.
- Hold at full inflation: 0.6s (the "about to over-blow" beat).
- Deflate-and-reset: 0.5s, eased back to r0 (the piece is pulled from the pipe / a fresh gather starts) — this is a visible reset, not a jump-cut, so the loop reads as cyclical process rather than a glitch.
- Total cycle: 3.7s, repeats indefinitely.

## The resting loop
- t0: small, thick-walled bubble near the start of an inflate phase.
- t2.5s: ~2.5s into a 3.7s cycle — bubble near or at full inflation, wall visibly thin, distinctly larger than at t0.
- t5s: into the second cycle's early inflate phase (5s mod 3.7s ≈ 1.3s) — small-to-mid bubble again, but at a different radius/thickness than the t0 frame (t0 is right at cycle start, t5s is partway through inflate), so all three frames are visibly distinct.

## Reduced-motion freeze frame
Freezes at 80% of the inflate phase (t ≈ 2.08s into the cycle) — wall visibly thinned but not yet at the hold plateau, the frame that most clearly shows "still actively inflating" without ambiguity about direction.

## Interaction
If mapped to a real determinate value (e.g. storage percentage), the inflate curve should map monotonically to that value with no loop — 100% holds at full inflation and does not deflate/reset. Must not tint the wall or cavity with `--ns-accent` at any fill level, including 100%; completion reads via full inflation + the hold beat, not colour.

## Light vs dark theme
Wall gradient interpolates `--ns-muted` (cavity/thin-wall) to `--foreground` (thick wall, denser glass reads brighter/denser in luminance) in both themes. In light theme, verify the thin-walled near-cavity edge doesn't drop below visible contrast against `--surface` — thicken the minimum wall floor slightly if it does, rather than lightening the token.

## Kill criteria
If the wall-thinning effect is imperceptible at card scale (looks like a simple circle growing, no sense of material thinning), kill it — a growing circle alone is not a differentiated mechanic from any generic radial progress indicator.

## Legibility
The one thing to follow: a bubble growing while its rim visibly thins, decelerating as it grows, over a ~2.6s inflate beat — long enough to watch the deceleration happen rather than just seeing a before/after size change.
