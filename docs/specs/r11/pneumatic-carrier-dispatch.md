# pneumatic-carrier-dispatch

- **tier:** core
- **product surface:** dispatch/job queue tray (the strip that shows print
  jobs, exports, or background tasks moving from "sent" to "delivered" —
  currently owned by a plain progress-list or a spinner-per-row).

## the real mechanic

A pneumatic tube transport system (bank teller lines, hospital lab
networks, Lamson tube installations): a carrier canister is loaded at a
station, a blower's pressure differential launches it down the tube run at
near-terminal velocity, and at the receiving station a trapped air cushion
ahead of the carrier acts as a dashpot — decelerating it smoothly instead
of letting it slam — before it drops into the catch bin and the line
clears for the next carrier.

## mechanic description

A carrier launches into the tube on blower pressure, cruises near top
speed, then brakes against a trapped air cushion and thunks softly into
the tray.

## rendering approach

DOM/SVG, no canvas. A card-scale tube path (rounded-rect channel, diameter
~6% of the container's smaller dimension) with 2-3 waypoint stations along
it and a catch tray at the terminus. Carrier = a filled capsule
(`--foreground`) ~2.2x the tube diameter long, positioned with an
imperative `transform: translate()` driven by rAF (not CSS keyframes — the
three-phase asymmetric easing needs a hand-rolled curve, not a single
timing function). Up to 3 carriers may be in flight at once on independent
phase offsets.

## real numbers

- Dispatch interval: one new carrier launches every 2.6s ± 15% jitter
  (staggered per slot so up to 3 carriers are never in visual lockstep).
- Launch phase: 180ms, accelerating 0 → 0.85 of cruise velocity.
- Cruise phase: constant velocity across ~70% of tube length; cruise
  velocity set so total tube transit (launch+cruise+cushion) is 1.05s.
- Cushion/decel phase: final 12% of tube length, 260ms, exponential decay
  (`tau` = 70ms) down to a soft stop.
- Thunk settle: 90ms micro-bounce (3px overshoot then rest) on arrival.
- Catch tray holds up to 6 settled carriers stacked; the oldest fades out
  (opacity + scale, 900ms) once a 7th arrives, representing "processed."

## the resting loop

- t0: one carrier mid-cruise somewhere in the tube, tray holding some
  count 0-6.
- 2.5s: that carrier (or its successor) has completed a full cushion +
  thunk + settle cycle — tray count has changed and a new carrier is
  launching or mid-cruise.
- 5s: a second full dispatch cycle has landed — tray count and in-flight
  carrier position are both different from both earlier samples, since 2.6s
  dispatch interval and 1.05s transit time are not commensurate with the
  2.5s sample point.

## reduced-motion freeze frame

CARRIER_SETTLED: a carrier just completed its cushion decel and sits at
rest in the tray, mid-fill (tray showing 3-4 of its 6 slots occupied) —
the most structured frame, showing tube, a completed arrival, and queue
depth all at once. Not t0's arbitrary mid-flight moment.

## interaction

None required for the ambient loop. If the tray is made focusable/
expandable, hover/focus may reveal a plain-text readout ("2 in transit / 4
delivered", real state, not decorative) — `--ns-accent` may only appear on
that element's focus ring, never on the tube or carrier.

## light vs dark theme

Tube wall uses `--ns-muted` at low opacity for the constriction shape
itself (not `--border`, which is too faint to read as structure at card
scale) with a fainter inner `--border` guideline optional. Carrier is
always solid `--foreground` so it stays legible against the tube wall in
both themes without any hue shift.

## legibility

The ONE thing to follow: a single carrier's cruise-then-cushion-then-thunk
motion — fast and steady, then visibly braking, then settling. Cadence:
one full transit takes just over a second and a new carrier launches
every 2.6s, both comfortably past the "~1s between discrete events" floor.

## kill criteria

- If the cushion/decel phase isn't perceptibly different from the cruise
  phase at card scale (i.e. it just looks like one smooth glide), the
  entire point — a real dashpot deceleration, not a linear stop — has
  failed. Reject.
- If dispatch cadence has to exceed roughly 1/s to look "alive," reject
  per the r9 cadence rule.
