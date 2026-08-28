# airlift-slug-flow

- **tier:** core
- **product surface:** background file-sync/upload activity rail — a slim
  conduit sitting beside a file list or sync panel showing data actively
  moving, replacing a generic spinner + percentage or a looping "syncing…"
  dots label.

## the real mechanic

An airlift pump (mining/well dewatering, geothermal lift, aquarium
airlift): compressed air injected at the foot of a submerged riser pipe
forms discrete gas slugs. Each slug's buoyant rise drags a plug of liquid
immediately ahead of it up the pipe — the classic two-phase "slug flow"
regime — so delivery arrives in distinct pulses, not a continuous stream.

## mechanic description

Discrete air slugs injected at the pipe's foot rise and drag a plug of
liquid immediately ahead of them, so flow arrives in distinct pulses
rather than a continuous stream.

## rendering approach

DOM/SVG, vertical rail. Rail width derived from the container's smaller
dimension (~8% of min-dim, capped), height fills the available card
height. Static liquid column: `--ns-muted` low-opacity fill for the whole
rail. Air slug: rounded capsule, `--foreground` at reduced opacity
(bubble read). Liquid plug: solid `--foreground` band immediately above/
ahead of the slug, same speed, riding together.

## real numbers

- Slug injection interval: 1.8s. Real airlift slugging frequency is
  pipe-diameter/flow-rate dependent but commonly falls in the 0.5-3 Hz
  band for small risers — 1.8s sits inside that real range and already
  clears the "~1s between discrete events" floor with no compression
  needed.
- Slug rise speed: constant 140px/s (buoyancy-driven rise is
  near-constant, unlike an accelerating flow).
- Slug height: 9% of rail height. Dragged liquid plug: trails immediately
  above the slug for 14% of rail height, same speed.
- On reaching the top, the slug/plug pair fades out over 220ms and
  deposits into a small accumulator basin at the rail's head; the basin
  fill increments 1/14th per arrival, resets after 14 arrivals (~25s full
  macro-cycle — self-contained, no external data required).

## the resting loop

- t0: basin at some fill fraction, one slug/plug pair mid-rise at some
  point in the rail.
- 2.5s: that pair has risen ~350px further or already discharged and a new
  pair injected — vertical position and basin fill level both visibly
  different from t0 (1.8s injection period isn't commensurate with the
  2.5s sample).
- 5s: at least one more full slug cycle has completed; basin fill level
  has advanced again.

## reduced-motion freeze frame

MID_RISER: a slug/plug pair frozen at exactly 50% of rail height — the
single frame that shows both the slug and its trailing plug clearly
separated from the static column above and below it. Not t0's arbitrary
phase.

## interaction

None required for the ambient rail. If placed adjacent to real file rows,
a slug's arrival at the basin may pulse the corresponding row's status
text once (a real, discrete state change) — never tint the slug or plug
with `--ns-accent`; luminance only.

## light vs dark theme

The static `--ns-muted` column risks washing out in light theme — spec a
slightly higher static-column opacity floor in light mode specifically,
since the moving slug/plug (`--foreground`, unmodified across themes) is
already the primary legibility carrier and doesn't need adjustment. Verify
light theme early per the token rules.

## legibility

The ONE thing to follow: a slug rising with its liquid plug riding
immediately ahead of it — two parts moving together, not one blob.
Cadence: one slug every 1.8s, matching the real mechanic's own rate, well
past the "~1s between discrete events" floor.

## kill criteria

- If the slug and its dragged plug read as a single indistinguishable
  blob rather than two coupled parts, the whole point of slug flow (a gas
  pocket dragging a liquid plug, not a smooth column) has failed; reject.
- If injection cadence has to exceed roughly 1/s to look "busy," reject
  per the r9 cadence rule.
