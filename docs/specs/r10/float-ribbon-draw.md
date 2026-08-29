# float-ribbon-draw

**tier:** core (card-scale, 2D canvas)

## Product surface it replaces
A multi-stage pipeline / job-status bar — the horizontal "queued → processing → done" step indicator, usually a row of static dots or a segmented progress bar.

## The real mechanic
The float-glass process (Pilkington process, the method that produces essentially all flat glass made today). Molten glass flows continuously from a furnace onto a bath of molten tin, floats and spreads under gravity and surface tension until it settles at its natural equilibrium thickness (~6.8mm for unconstrained float glass), then top rollers grip the edges and draw the ribbon forward at a controlled line speed while it travels the length of the bath, cooling from ~1,000°C where it lands to ~600°C where it lifts off onto the annealing lehr rollers. Source: documented float-glass manufacturing process (Pilkington process, standard flat-glass industry description).

## One-sentence mechanic description
A horizontal ribbon extrudes continuously from the left edge — molten and bright where it enters, visibly firming and dimming in luminance as it travels right — moving at a constant draw speed with zero start/stop.

## Rendering approach
2D canvas, full card width × a fixed ribbon-height band (28% of container height, vertically centred). No cell grid — the ribbon is a continuous horizontal luminance gradient whose profile scrolls; resolution is a 1D lookup of 64 samples across the ribbon's length, redrawn each frame, bilinearly interpolated for the fill.

## Real numbers
- Draw speed: ribbon texture scrolls left-to-right at 40 px/s (container-width-independent — computed as a fraction, 8% of container width per second, so it reads consistently at any card size).
- Thermal zone gradient (left = molten, right = set): luminance profile `L(x) = Lcold + (Lhot-Lcold) * exp(-x/λ)` where x is distance from the left (entry) edge in ribbon-lengths, λ = 0.35 (so ~63% of the luminance drop happens in the first third of the ribbon's visible length, matching the bath's front-loaded cooling curve).
- `Lhot` = 0.88 (near-white, molten), `Lcold` = 0.30 (near `--ns-muted`, set glass) — luminance only.
- A faint horizontal ripple (2px amplitude sine, wavelength 18% of container width) rides on the top edge only in the still-molten first third, and damps to flat by x/λ ≈ 1 — surface tension settling out as the glass firms.
- No acceleration, no pause, no discrete steps: the draw is a single constant-rate scroll, because the real process has no start/stop within a run.

## The resting loop
- t0: ribbon texture at scroll-phase 0 — ripple visible in the molten zone, gradient in its base position.
- t2.5s: scrolled 100px equivalent — texture pattern (ripple crest positions) visibly shifted right relative to t0, same overall luminance zones (the process itself doesn't change, only the texture riding through it moves).
- t5s: scrolled 200px equivalent — ripple crests at yet another position, distinct from both t0 and t2.5s.

## Reduced-motion freeze frame
Freezes at scroll-phase 0 (t0's frame) with the ripple at its most legible crest/trough spread — chosen because it's the phase where the ripple wavelength is most evenly visible across the molten third, not an arbitrary mid-scroll moment where crests could bunch near the edge.

## Interaction
If used for real pipeline stages (queued/processing/done), stage boundaries can be marked as fixed x-positions along the ribbon (a thin `--border` tick, never accent), but the ribbon's own scroll/thermal animation must keep running unconditionally — pausing the scroll to "wait" for a stage breaks Filter 2 (alive at rest) and misrepresents the real process, which never stops mid-draw.

## Light vs dark theme
Same `Lcold`→`Lhot` luminance sweep in both themes; in light theme the cold (right, set-glass) end sits close to `--surface`, so add a thin `--border` bottom rule under the full ribbon length to keep the set-glass zone from disappearing into the card background — check this first, before dark theme.

## Kill criteria
If, at card scale, the ribbon's molten-to-set transition is too gradual to distinguish from a flat grey bar (all three luminance sampling points within ~5% of each other), kill it — the zone contrast is the entire mechanic.

## Legibility
The one thing to follow: a fixed thermal gradient (bright left, dim right) with a ripple texture continuously scrolling through it at a slow, constant 40px/s — the eye tracks the ripple's steady rightward drift, not the gradient itself, which never changes shape.
