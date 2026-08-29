# jumbo-drill-boom-pattern

- **slug:** jumbo-drill-boom-pattern
- **tier:** loud (full-bleed WebGL/2D-canvas showpiece)

## Product surface it replaces (Filter 1)
Hero / full-bleed background — a rock-face tunnel-heading surface, adjacent to but distinct
from `tricone-bit-teeth` (this component's identity is a PATTERN of holes being drilled
across a face in sequence, not one bit crushing rock at a point; tricone-bit-teeth is
explicitly kept out of this axis to avoid overlap).

## The real mechanic
A drill jumbo (2-4 hydraulic boom drilling rig used in tunneling and drift development)
positions its booms against a rock heading and drills a full blast pattern — perimeter,
lookout, stoping, and lifter holes — before retreating for charging and firing. Each boom
carries a percussive rock drill (drifter) that both rotates and hammers a steel into the
rock; the operator (or an automated jumbo's control system) sequences hole positions boom by
boom, and drill steel visibly plunges into the face, then retracts and the boom repositions to
the next collar point in the pattern. Real jumbo patterns are drawn as numbered hole layouts
(a "drill and blast pattern" or "burn cut" pattern) — this is the same document-of-record
object the round's `blast-hole-delay-sequence` core component fires; this loud component is
strictly the DRILLING of the pattern (steel plunging into rock, hole by hole), never the
firing sequence — kept deliberately non-overlapping.

## One-sentence mechanic description
A boom's drill steel swings to each collar point across a full-bleed rock face and plunges in
with a hammering vibration, leaving a growing hole, before withdrawing and moving to the next.

## Rendering approach
2D canvas, full-bleed. Rock face rendered as a static-ish luminance-noise height field
(low-frequency Perlin/value noise, seeded once at mount) with holes punched into it
progressively. Drill steel + boom rendered as simple procedural line/rect geometry (no 3D
needed — an angled steel shaft with a small hammering jitter). Pattern grid derives from the
container's smaller dimension: a **5×7 hole pattern** (35 collar points, arranged as a
realistic burn-cut layout — tighter spacing near center, wider toward perimeter) scaled to
fit.

## Real numbers
- Real jumbo drills penetrate at roughly 1-3 m/min depending on rock hardness; a single hole
  (typically 3-5m deep in a tunnel round) takes on the order of 1-3 minutes real time — far
  too slow to loop watchably, so render each hole's drill-in at a fixed **1.8s** (compressed
  from the documented real ~90-180s), giving a visible "steel advancing into rock" motion
  rather than an instant cut.
- Percussive hammer rate on a real drifter: 30-60 Hz. Render as a small-amplitude (2-3px)
  high-frequency jitter on the steel during the drill-in phase, capped visually at a
  **12Hz-equivalent shake** (decoupled from the real rate per the round 9 aliasing rule —
  render believable vibration, don't try to hit 30-60Hz against a 60fps paint budget).
- Sequence: one hole drilled every **2.4s** (1.8s drill-in + 300ms withdraw + 300ms boom
  reposition swing to next collar) — clears the ~1s discrete-event floor with room to spare.
- Full pattern: 35 holes × 2.4s ≈ **84s** to drill the complete pattern, then a 3s pause (full
  pattern visible, all holes drilled, booms retracted to a parked position off to the side),
  then the face resets (holes fill back in over a 4s dissolve, standing in for the round being
  fired and a fresh face exposed) before the pattern restarts.

## The resting loop
- **t0:** roughly a third of the pattern already drilled (uneven cluster of holes, not a
  clean row), one boom mid-plunge with visible jitter.
- **2.5s:** one more hole complete, boom repositioned or mid-swing to the next collar point —
  visibly different hole count and boom position from t0.
- **5s:** noticeably more of the pattern filled in, a different region of the face now
  showing the hole cluster growing — the overall pattern silhouette has visibly progressed.

## The reduced-motion freeze frame
Freeze at roughly 60% pattern completion with the active boom mid-plunge (steel partway into
its current hole, jitter frozen) — shows drilled holes, an in-progress hole, and undrilled
collar points all at once, the most structured single frame available.

## Interaction
None required (ambient loud showpiece). If added, pointer proximity may brighten the rock
face in luminance near the cursor only (a raking-light effect, consistent with
`tricone-bit-teeth`'s interaction constraint) — must not affect drill sequencing or use
`--ns-accent`.

## Light vs dark theme
Rock face noise field ramps between `--background` and `--ns-muted` at rest; drilled holes
read as `--foreground`-anchored dark punctures with a thin `--ns-muted` rim (spoil/dust ring).
In light theme, confirm the undrilled-vs-drilled contrast survives — a hole rendered as a
simple dark dot against a light, low-contrast noise field risks reading as a design
imperfection rather than a legible drilled hole; a visible rim or shadow may be required to
disambiguate in light theme specifically.

## Kill criteria
- If the drilled-hole pattern, once built, reads as visually redundant with
  `blast-hole-delay-sequence` (both look like "a grid of holes changing state"), kill this
  one and keep the delay-sequence version, since sequencing is the stronger, more legible
  mechanic of the two.
- If the percussive jitter reads as a rendering glitch rather than a hammering drill in an
  actual runtime check, remove the jitter before shipping rather than tuning it indefinitely.
- If 35 holes at 2.4s/hole (84s) feels too long to ever show meaningful progress within a
  typical card-viewing session, shorten drill-in time or hole count, and if that still
  doesn't land, kill it.
