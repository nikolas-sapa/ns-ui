# spiral-chute-accrete

**tier:** loud

**product surface it replaces:** background — a full-bleed ambient section
backdrop (e.g. behind a hero headline or a section divider), not a loader
or progress element; there is no completion state.

**the real mechanic, with source:** a gravity spiral chute, the helical
slide used to move bulk parcels/mail sacks between floors in sorting
facilities and department-store stockrooms without powered conveyance —
items enter at the top, descend a continuous helical ramp under gravity
alone (friction and the helix's banking keep speed roughly bounded rather
than accelerating unchecked), and accumulate in a bin or landing area at
the bottom, which is periodically cleared/exchanged before it overflows.

**one-sentence mechanic description:** Small parcels drop in at the top of
a spiral ramp, one at a time, and slide down the helix in continuous
view, landing in a pile at the bottom that grows until it's swept clear.

**rendering approach:** 2D canvas, full-bleed, geometry derived from
container height (spiral radius = 0.32 * min(w,h), 3.5 total turns from
top to bottom). Spiral path is a parametric function `r*cos/sin(theta) +
theta*pitch` evaluated once and cached; parcels are small flat-shaded
squares/rects positioned by evaluating that function at each parcel's own
progress value, not by re-deriving the curve per frame.

**REAL NUMBERS:**
- Real descent speed on a shallow spiral chute: roughly 1-3 m/s depending
  on incline/friction, giving a real top-to-bottom transit on a multi-story
  chute of a few seconds — this is one of the rare cases where the real
  rate and the legible rate are close, so descent is rendered close to
  real-world proportion rather than artificially decoupled: one parcel
  takes 3.6s to traverse the full 3.5-turn spiral.
- New parcel spawns at the top every 1.3s (fixed cadence) — at 3.6s transit
  and 1.3s spawn interval, roughly 2-3 parcels are in-transit on the spiral
  simultaneously at any moment, each at a different theta so they never
  visually overlap on the same winding.
- Landing pile: each arriving parcel adds one tile to a loosely-packed
  pile at the chute's base (position jittered within a fixed small radius
  from a period-9 offset sequence, not per-frame randomness, so the pile
  shape is deterministic and reproducible for reduced-motion/testing).
- Pile clear: every 9.0s (fixed), the pile sweeps away over 500ms (tiles
  slide off-canvas to one side, staggered 30ms apart) as if collected —
  this is the mechanism that keeps the pile bounded forever without the
  loop ever completing or stopping.

**the resting loop:** t0 — 2-3 parcels visible at different points on the
spiral, plus a partial pile at the base at some point in its 9s
fill/clear cycle. t2.5s — at least one parcel has completed its descent
and landed (pile grew by at least one tile), spiral parcels have advanced
to clearly different theta positions. t5s — the pile has very likely swept
clear at least once (9s period, so by t5s it's mid-fill again on a
visibly smaller pile than a "full" one) — the sweep event itself, if it
lands inside 0-5s, is a strong, unambiguous is-this-alive signal.

**reduced-motion freeze frame:** named `MID_DESCENT`, chosen at a point
in the 9s cycle where the pile is roughly half full (not empty right
after a sweep, not overflowing right before one) and at least two parcels
are visible mid-spiral at clearly different turns — the frame that shows
spiral, motion-implying parcel spacing, and an in-progress pile all at
once, most representative of the steady state.

**interaction:** none. Full-bleed ambient background; no pointer state.

**what it must NOT do:** must not tint parcels or the pile-sweep moment
with `--ns-accent` — parcels differentiate from the spiral ramp by a
luminance step against `--background` only. Must not let the pile
actually overflow off-canvas before its scheduled sweep — the 9.0s clear
interval must be tuned against the spawn/landing rate so the pile never
visually breaches the canvas edge, which would misread as a bug.

**light vs dark:** the spiral ramp structure sits at `--border`-derived
low contrast (it's the track, not the subject) in both themes; parcels
and the pile need a clear luminance step toward `--foreground` so they
read as the moving subject against the ramp. Check light theme first —
a flat monochrome helix on a light background is where the ramp is most
likely to disappear entirely if its contrast step is too close to the
`--border` floor.

**kill criteria:** if 2-3 simultaneously-visible parcels on the spiral
isn't enough motion to read as "alive" at a glance (the near-real-time
descent speed chosen here trades legibility headroom for physical
accuracy), the fix is a shorter spawn interval to raise simultaneous
parcel count, not a faster descent speed, which would break the
close-to-real-world proportion this concept was chosen to preserve.
