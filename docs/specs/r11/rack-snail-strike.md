# rack-snail-strike

- **tier:** core
- **product surface:** live count / stat tile (the number that ticks up when new items arrive — resolved tickets, new signups, completed jobs).

## the real mechanic

The rack-and-snail striking mechanism (English/French striking clocks,
from the 17th century on) is how a clock decides HOW MANY times to strike
the hour without any counting logic: a toothed rack falls until it's
stopped by a stepped spiral cam (the "snail," one step per hour, 1-12,
shortest step = 12 o'clock, longest = 1 o'clock — the rack falls FARTHER
when there's LESS to strike). A gathering pallet then walks the rack back
up one tooth at a time, and every tooth gathered fires one hammer blow on
the bell. The count is physically encoded as a distance, read out as a
sequence of discrete strikes.

## mechanic description

A cam's rotation sets how far a toothed rack drops, then the rack is
gathered back up one tooth per strike — the distance it fell IS the count.

## rendering approach

DOM + SVG, no canvas. A small stepped-spiral snail cam (SVG path, 12
steps) drives a rack (a row of tooth-shaped divs) that drops then climbs
back, each climbed tooth firing a number increment on an adjacent stat
figure.

## real numbers

- Cycle length: 8s, an unbounded repeating loop (not a real hour — this is
  a demo/idle cadence, documented as compressed from the real once-per-hour
  event).
- Cam rotation: 0.3s to select a new snail step (fast, matches the real
  mechanism's near-instant "warning" release) — snail step cycles through
  a fixed sequence (3, 7, 1, 12, 5, 9 — deliberately non-monotonic so
  successive counts never form a predictable ramp, matching how real hours
  don't reset to 1 after 12 within a demo loop).
- Rack fall: 0.4s, `ease-in` (accelerating, as a falling rack under
  gravity), distance proportional to (13 - stepValue) so a low count (a 12)
  falls far and a high count (a 1) falls short — this is the one place the
  "more strikes = less fall" real-mechanism logic must be visible in the
  geometry, not just in the resulting number.
- Gathering/striking: one tooth climbed and one hammer strike per 0.85s,
  stepValue times per cycle — comfortably clears the r9 ~1s-between-events
  floor. Each strike is a genuine departure-then-arrival: the hammer glyph
  lifts 60% of its travel over 0.55s (`ease-out`), then falls the
  remaining 40% in 0.15s with a small overshoot bounce (`cubic-bezier
  (.3,1.6,.4,1)`) and the stat figure increments on hammer contact, not on
  lift.
- Rest gap: 0.6-1.4s of stillness after the last strike before the next
  cam rotation begins (varies with stepValue since a shorter strike count
  finishes its climb sooner within the fixed 8s cycle) — this pause is
  itself part of the mechanism's real character (striking clocks are
  silent between hours) and doubles as a natural resting beat.

## the resting loop

- t0: mid-strike-sequence on one snail value, hammer at some point in its
  lift/fall arc, stat figure mid-count.
- 2.5s: a different snail value has been selected (cam visibly rotated to
  a new step), rack has fallen to a different depth, strike count so far
  differs from t0's.
- 5s: at least one full 8s cycle hasn't elapsed, so cam step, rack depth,
  and strike progress are all at yet another combination — never matching
  t0 or 2.5s because the 6-value step sequence and the 0.85s strike
  cadence aren't in phase with the 2.5s sampling interval.

## reduced-motion freeze frame

Rack at half-climbed on the "7" step (visibly fallen a middle distance,
three teeth already gathered, hammer resting up against the bell having
just struck) — shows cam, rack depth, and hammer-at-bell all in one frame,
unlike t0 which can land mid-fall with the hammer not yet engaged.

## interaction

None in the idle demo state. If wired to a real live count (e.g. "12 new
this hour"), the snail step is set directly from the incoming count instead
of cycling the fixed sequence, and a genuinely new arrival re-triggers one
full fall-and-gather sequence rather than snapping the number — but the
component must NOT poll or animate off a wall-clock hour; it only reacts to
an explicit prop change.

## light vs dark theme

Snail cam and rack teeth stroked in `--ns-muted` (structural, not the
event); hammer and bell rendered in `--foreground` since the strike is the
climactic moment. `--ns-accent` never touches the hammer or the stat
figure's increment flash — the flash is a 150ms luminance lift on
`--foreground` only, verified by pixel sampling in both themes.

## legibility

The ONE thing to follow: the hammer's lift-pause-strike-bounce, and how
many times it repeats before going quiet. Cadence: 0.85s per strike sits
just past the r9 floor, and the distinct lift/fall asymmetry (fast lift,
faster overshot fall) gives each strike a clear departure and arrival so a
viewer can actually count along, which is the whole point of a mechanism
whose real job is "make the count legible without reading a number."

## kill criteria

- If a viewer can't tell the rack's fall DEPTH is what determines the
  strike count (i.e. it just looks like a number ticking up with random
  cam decoration), the mechanism has failed to earn its screen time —
  reject.
- If the stat figure alone (no rack/cam/hammer) would communicate the same
  information equally well, this is a restyle of an existing counter, not
  a new mechanism — reject.
