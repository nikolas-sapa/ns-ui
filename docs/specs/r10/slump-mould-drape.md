# slump-mould-drape

**tier:** core (card-scale, 2D canvas)

## Product surface it replaces
A content-reveal / completion moment — the settle animation a card, panel, or empty-state uses when content finishes loading and locks into its final shape.

## The real mechanic
Kiln-slumping in warm glass work. A flat glass blank is heated in a kiln to its slumping range (roughly 600–700°C for soda-lime, well below full fusing temperature) and sags purely under gravity over/into a mould — the centre droops first since it's least supported, and the drape spreads outward toward the rim as heat and time progress, with the edges settling last against the mould's contour. It's a slow, continuous viscous deformation, not a snap or a bounce. Source: standard kiln-forming/slumping technique (warm glass studio practice).

## One-sentence mechanic description
A flat line sags from the centre outward into a mould's contour, the droop spreading toward the edges over several seconds until the whole profile has settled and conforms to the shape beneath it.

## Rendering approach
2D canvas. A horizontal glass "sheet" is represented as a sampled height profile across N = 32 points spanning the container's width; each point's y-offset derives from the container's smaller dimension (max droop = 30% of that dimension). The mould contour underneath is a fixed reference curve (a shallow bowl: `mould(x) = depth * (1 - cos(2πx))/2` style profile) drawn as a thin static `--border` line.

## Real numbers
- Full drape duration: 4.5s from flat to fully conformed — slow enough to read as a viscous sag, not a spring.
- Each of the 32 sample points settles independently: point i's droop follows `y_i(t) = mould(x_i) * (1 - exp(-(t - delay_i)/τ))` where delay_i is proportional to the point's distance from centre (delay ranges 0s at centre to 1.8s at the outer edge) and τ = 1.0s — this staggered-delay-plus-decay is what produces the centre-first, edges-last visual rather than a uniform fade.
- Hold at full conformity: 1.5s (the "fully slumped" beat, profile motionless, matches mould exactly).
- Reset: profile lifts back to flat over 0.4s (a kiln unloading a piece and a fresh flat blank going in) — quick relative to the drape, since the real reset (swapping blanks) is a discrete offstage event, not a slow process.
- Total cycle: 6.4s, repeats indefinitely.

## The resting loop
- t0: near cycle start — profile essentially flat, centre just beginning to dip.
- t2.5s: centre and inner points substantially conformed to the mould, outer points still well above it — a visibly asymmetric, mid-drape profile.
- t5s: past the full-drape point (4.5s) — profile fully conformed and holding, distinctly different silhouette from both t0 (flat) and t2.5s (partial, asymmetric).

## Reduced-motion freeze frame
Freezes mid-drape at t = 2.5s equivalent (centre conformed, outer edge still ~40% above the mould) — the frame that most clearly shows the mechanic's signature centre-first/edges-last asymmetry, which neither the flat start nor the fully-settled end can show on their own.

## Interaction
None required for the base loop; if triggered as a one-shot reveal (content finishes loading → drape plays once to its settled hold), the settled state must persist rather than looping into reset — looping is only for the ambient/idle version of the component. Must not use `--ns-accent` on the mould contour or the settled profile; the "arrived" state reads via full geometric conformity to the mould line, not colour.

## Light vs dark theme
Glass profile line drawn at `--foreground`, mould reference line at `--border` in both themes — check light theme's `--border` line for the ~1.1:1 contrast the token rules call out; if the mould contour is meant to stay visible as a target the profile drapes toward, it may need a slightly heavier stroke weight (not a different token) in light theme to stay legible against `--surface`.

## Kill criteria
If the staggered centre-first settling reads as simple synchronized easing (all points appear to move together) at card scale, kill it — the whole differentiator from a generic "reveal" animation is the visible lag between centre and edge.

## Legibility
The one thing to follow: the gap between the sagging profile and the fixed mould line beneath it closing from the centre outward — over 4.5s, slow enough to watch the closure spread toward the edges rather than perceiving it as a single snap into place.
