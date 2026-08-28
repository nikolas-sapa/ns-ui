# spall-face

- **slug:** spall-face
- **tier:** core (card-scale)

## Product surface
Background texture panel (card-scale background, same slot family as `background-truchet-weave`, `background-ascii-dither`).

## The real mechanic
Freeze-thaw (frost) weathering: water in surface pores/cracks of porous rock or masonry freezes, expanding ~9% in volume and exerting pressure that exceeds the material's local tensile strength; repeated cycles fatigue the near-surface layer until a flake (spall) detaches, exposing fresh material beneath. Documented in geomorphology and masonry-conservation literature — field-observed frost-weathering recession rates on exposed rock faces are on the order of 0.1–2 mm/yr in freeze-thaw-active climates, and individual spall events are discrete (a flake a few mm to a few cm across detaching at once), not a continuous erosion.

## Mechanic description (user-facing)
A weathered rock face slowly conveys upward; every second or two a flake lifts, tips outward, and falls off, exposing a fresh patch that then darkens as it weathers toward its own eventual spall.

## Rendering approach
2D canvas, card-scale, `w-full h-full`. Face sampled as a fine luminance/height field on a grid derived from the container's smaller dimension (~48×48 cells). The entire sampled field is on a slow vertical conveyor (coordinate offset drifts continuously) so fresh, unweathered texture enters at one edge while weathered/exited texture leaves at the other — this is what makes the loop genuinely unbounded rather than a fixed surface that fills up and stops.

## Real numbers
- Real recession rate: 0.1–2 mm/yr (field range). A full "birth to spall" age-cycle for a given patch is compressed to ~40s render time — documented as illustrative compression in a code comment.
- Spall event cadence: one flake event somewhere on the face every 1.3–2s.
- Flake size: 4–7% of the container's smaller dimension.
- Spall event duration: ~350ms (lift ~120ms, tip ~100ms, fall off-frame ~130ms) — well above the round-9 "no blinks" floor.
- Freshly exposed patch: brightens immediately on exposure, then darkens/weathers gradually over the following several seconds as it ages toward its own eventual spall.

## The resting loop
- **t0:** face mid-conveyor, several patches at varied weathering ages (not uniformly fresh).
- **2.5s:** at least one spall event has completed since t0 (a new bright patch exists where an older, darker one used to be); conveyor offset visibly advanced.
- **5s:** further spall events fired at different locations; the patches present at t0 have aged/darkened or already spalled again.

## Reduced-motion freeze frame
Freeze on a frame with one flake mid-fall (past the lift stage, visibly departed from the face, its patch already brightening) plus at least one older, now-weathering patch elsewhere — shows the full lifecycle (fresh, aging, mid-spall) in one still.

## Interaction
None — ambient background texture. Pointer proximity must NOT trigger or accelerate spalling (the process is thermal/mechanical fatigue, not touch-driven); default is no interaction at all.

## Legibility
The ONE thing to follow: one flake's lift → tip → fall arc (~350ms), recurring roughly every 1.5s somewhere on the face. The freshly exposed patch it leaves behind is the visible "arrival" state that closes the beat.

## Light vs dark theme
Dark: dark stone base (low luminance, `--foreground`-derived), fresh patches read brighter, toward the `--ns-muted`/`--foreground` high end. Light: pale stone base; fresh patches read as a slightly DARKER, more structured patch relative to the already-pale weathered stone (inverted relationship, dye-whorl-style, not a literal color swap) — a uniformly brighter patch on already-pale light-theme stone would wash out, so this is checked early rather than as a final pass.

## Differentiator (checked against neighbour)
`registry/loud/edm-crater-field` is a statistical STEADY-STATE field of persistent pits on an otherwise unchanging bulk (birth rate balanced by removal rate, no net material transport, no conveyor). spall-face instead has directional material transport (a conveyor bringing fresh rock in one edge, spalled flakes permanently leaving the visible frame) and named discrete flake objects with a visible lift/tip/fall departure — not a pit simply appearing in place.

## Kill criteria
- If the conveyor drift isn't legible (face reads as a static pitted texture with no directional motion) → reject, converges on `edm-crater-field`.
- If a spall event reads as a blink (<200ms, no lift/tip/fall stages) → reject.
- If `--ns-accent` or any color literal touches the flake or exposed-patch highlight → reject.
- If light theme's fresh-patch inversion isn't legible against the pale base → reject.
