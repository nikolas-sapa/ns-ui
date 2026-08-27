# film-gate-weave

- **slug:** `film-gate-weave`
- **tier:** loud (full-bleed showpiece)

## Product surface (Filter 1)

Background — a full-bleed ambient page background.

## The real mechanic

Film projector gate weave and bounce. A 35mm/16mm frame is held in the
projector's gate against the aperture plate while the shutter is open, but
the film is not rigidly fixed there — sprocket-hole play and (on
non-pin-registered projectors) friction-drive slop let each frame sit a few
hundredths of a millimeter off true from frame to frame. "Weave" is the
slow lateral/vertical drift across many frames; "bounce" is the faster,
snappier vertical jitter from sprocket-hole slack settling each time the
claw pulls a new frame down. The aperture/gate mask itself is rigid and
fixed on screen — the artifact is always relative motion of frame content
against a static reference edge, never the edge itself moving.

**Differentiated from two existing film-family components:**
`registry/core/pin-register` treats z-order as a draggable physical stack
of acetate separations (toggle/reorder, no weave). `registry/core/
scrubber-film-strip` (`SprocketScrub`) is a scrubber with sprocket-hole
chrome and a claw playhead, driven by pointer position, not idle drift.
Neither renders content weaving inside a fixed aperture at rest — that
static-edge-vs-drifting-content relationship is this concept's whole
identity and is what those two do not do.

## Mechanic, one sentence

A test-pattern frame held in a fixed projector aperture drifts and
micro-bounces against the gate's rigid edge, never sitting flush, the way
sprocket-hole slack lets real film wander frame to frame.

## Rendering approach

2D canvas, `w-full h-full`. Aperture mask (the gate) is drawn as a fixed
rectangle sized from the container's smaller dimension (`GATE_INSET =
containerMinDim * 0.08`), rigid, never displaced. Frame content — a simple
cross-hair + concentric circle "academy leader" target (no countdown
numerals; `curtain-leader-countdown` already owns those) — is drawn offset
by the weave/bounce each frame, clipped to the gate rectangle so the
misalignment against the fixed edge is directly visible.

## Real numbers

- Frame advance: 24fps, one weave/bounce sample per 41.7ms (the claw pull
  interval) — do not render pulldown cadence itself, only the per-frame
  settle.
- Weave (slow drift): two independent low-frequency components,
  `driftX(t) = 1.8% * frameWidth * sin(2π t / 3.1)`,
  `driftY(t) = 1.1% * frameHeight * sin(2π t / 4.7)` — periods deliberately
  non-round and mutually non-resonant so the combined path doesn't visibly
  loop.
- Bounce (fast vertical jitter, sprocket-hole play): on every 41.7ms frame
  advance, apply a snap-and-settle vertical impulse of amplitude `0.4% *
  frameHeight`, resolved as a critically-damped spring (`k ≈ 5200`, `c ≈
  2 * 0.95 * sqrt(k)`) settling over `tau ≈ 90ms` — this gives a snap
  character, not a smooth sinusoid, matching how real gate weave looks
  discontinuous frame-to-frame rather than gliding.
- Gate mask stroke: `--foreground`, full opacity, 2px — this is the fixed
  reference edge and must read as rigid; do not use `--border` (~1.1:1 in
  light, would vanish and remove the reference the whole concept depends
  on).
- Frame content stroke: `--foreground` at 0.6 opacity.
- DPR cap: 1.5.

## The resting loop

- **t0:** drift terms near mid-phase — content sits visibly down-and-right
  of the gate's true center, most recent bounce settling.
- **2.5s:** `driftX` period (3.1s) has completed most of a cycle and
  `driftY` (4.7s) is in a different quadrant — content has drifted to a
  different offset, direction reversed from t0.
- **5s:** neither period has completed a whole number of cycles by 5s, so
  the combined offset is a third distinct position, with a fresh bounce
  snap visible mid-settle.

The always-on bounce (a snap every 41.7ms) guarantees local motion even at
any instant the slow drift terms happen to cross zero.

## Reduced-motion freeze

`STATIC_TIME = 2.15` — a moment where the combined drift offset is clearly
non-zero and off-center (content visibly not flush with the gate edge),
freezing mid-bounce-settle so the spring's snap character is legible even
as a single frame.

## Interaction

None required for the ambient background. If present: hover may damp the
bounce amplitude toward zero over ~600ms (simulating a claw stall) but must
never fully stop the slow weave drift — the background stays alive under
hover. Must NOT tint with `--ns-accent`.

## Light vs dark

The gate mask must stay `--foreground` at full opacity in both themes — it
is the fixed reference the entire mechanic reads against, and losing it in
light theme (e.g. by reaching for `--border`) removes the concept's
legibility, not just its polish. Frame content sits at reduced opacity so
the mask reads as clearly "in front."

## Kill criteria

- If the gate mask isn't clearly rigid/fixed against the drifting content
  (e.g. both appear to move together, or the mask is too faint to register
  as an edge) the whole mechanic collapses into generic camera shake — kill.
- If the misalignment is imperceptible at card/full-bleed scale on a
  standard laptop panel (sub-pixel average offset) — kill.
- If it reads as indistinguishable from `scrubber-film-strip`'s sprocket
  chrome at a glance (i.e., the aperture mask isn't visually distinct from
  a sprocket-hole track) — kill.
