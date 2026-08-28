# remontoire-rewind

- **tier:** core
- **product surface:** progress bar / sync-transfer indicator (the strip that shows an upload, sync, or long-running job advancing).

## the real mechanic

A remontoire d'egalite (constant-force remontoire, e.g. in Harrison's
regulators and later precision clocks) solves the problem that a mainspring
or driving weight delivers falling, non-constant torque as it unwinds. A
small secondary spring sits between the main power source and the
escapement: the mainspring slowly winds THIS spring up over an interval,
then a trip releases it to discharge at one constant, calibrated force into
the escapement, and is immediately rewound for the next interval. The
escapement never feels the mainspring's decay — only ever the remontoire's
flat, repeated release.

## mechanic description

A small spring is quietly wound tight by a slow driver, then trips and
dumps its stored force in one clean release, over and over, forever.

## rendering approach

DOM + CSS custom properties, no canvas needed. A bar track (the progress
strip) plus a small coiled-spring glyph (SVG path, 5 turns) sitting above
it that visibly tightens then snaps.

## real numbers

- Rewind interval: real precision-clock remontoires typically re-arm every
  30s. Rendered cycle compressed to 3.2s per rewind-then-trip for card
  legibility (documented ~9.4x compression from the real rate) — well
  clear of the r9 aliasing band since it's a discrete event, not a
  continuous oscillation.
- Wind phase: 2.9s of the 3.2s cycle — spring glyph's coil pitch tightens
  from 5 visible turns down to 2 (turns compress via `stroke-dasharray`
  offset animation, `ease-in` — winding gets visually harder near the end,
  matching a spring's rising resistance), and the progress bar's fill
  advances at a barely-perceptible 0.3%/s "creep."
- Trip + discharge: 0.3s — spring glyph snaps from 2 turns back out to 5
  (`cubic-bezier(.2,1.4,.4,1)`, one small overshoot) and the progress bar's
  fill jumps forward by a fixed 6% in that same 0.3s, ~20x its creep rate —
  the trip must read as a distinct kick, not a continuation of the creep.
- Bar wraps at 100% and restarts at 0% seamlessly (no pause at the seam)
  — an unbounded loop, since this is an idle/demo state, not a real
  transfer with an end.

## the resting loop

- t0: spring at 5 turns (just tripped), bar mid-cycle.
- 2.5s: spring compressed to ~2.3 turns (near end of wind phase, visibly
  tighter coil), bar has crept forward ~0.7% plus accumulated whole trips.
- 5s: at least one more full trip has fired (visible jump in the bar,
  spring back out to 5 turns then re-compressing) — the composite state at
  5s never matches either t0 or 2.5s because trip count and phase position
  aren't commensurate with either sample point.

## reduced-motion freeze frame

Spring at 3.5 turns (mid-wind, clearly neither fully coiled nor fully
tripped) with the bar's fill sitting just after a trip-jump (a slightly
brighter fill segment at the leading edge, per the trip glyph below) —
reads as "a mechanism mid-cycle," not t0's "just fired" moment which looks
closer to a static full bar.

## interaction

None required — this is a passive progress indicator. If used with a real
`value` prop (actual transfer percentage), the creep/trip rhythm still
runs but the bar's OVERALL fill is driven by `value`, not by the loop's own
accumulation; the spring glyph becomes pure "work is happening" chrome
layered on top. It must NOT let `--ns-accent` bleed into the trip flash —
the brighter leading-edge segment on trip is a luminance lift on
`--foreground`, never accent.

## light vs dark theme

Spring stroke and bar fill both derive from `--foreground`; empty track
uses `--ns-muted` at low opacity (never `--border` as a fill, per token
rules — track needs to read as "not yet filled," and `--border`'s ~1.1:1
light-theme contrast would make it invisible). Trip flash is `--foreground`
lifted to full opacity for 150ms then eased back to the bar's normal fill
opacity — same in both themes, verified by equal-RGB pixel sampling.

## legibility

The ONE thing to follow: the spring visibly tightening then snapping loose.
Cadence: one full wind-and-trip cycle every 3.2s gives roughly 3 seconds of
build before each release — comfortably past the r9 "~1s between discrete
events" floor, so the trip reads as a payoff rather than a twitch.

## kill criteria

- If the trip jump and the creep read as the same motion (i.e. a viewer
  can't tell "slow build" from "fast release" without staring), the whole
  point of constant-force delivery — visible contrast between charging and
  discharging — has failed and it's just a generic progress bar with a
  spring icon glued on. Reject.
- If removing the spring glyph entirely leaves an equally legible
  component, the mechanic isn't doing any work — reject.
