# pipe-stand-trip

- **slug:** pipe-stand-trip
- **tier:** core (card-scale DOM/canvas)

## Product surface it replaces (Filter 1)
Progress / stepper — a bounded-but-cyclic "N discrete units being processed off a queue and
racked one at a time" surface (nearest siblings: `queue-triage-ratchet`, `stepper-ratchet`),
distinct from those by mechanism (a physical hoist-and-rack cycle, not an abstract tally).

## The real mechanic
"Tripping pipe" on a drilling rig: to change the bit or run a survey tool, the crew pulls the
entire drill string out of the hole in multi-joint sections called STANDS (typically triples —
three ~30ft joints made up, ~93ft total). The traveling block/elevator lifts a stand clear of
the rotary table, the driller sets slips to hang the remaining string, breaks out the
connection, and the derrickman racks the freed stand in the fingerboard at the top of the
derrick before the elevator lowers back down empty for the next stand. This repeats until the
whole string is out (tripping out) or the reverse happens going back in (tripping in) — rig
floors track progress as "stands racked" against total depth.

## One-sentence mechanic description
An elevator descends into the hole, lifts one pipe stand clear, and racks it in the
fingerboard before dropping back down for the next, the depth counter falling with each trip.

## Rendering approach
DOM + CSS transforms: a vertical derrick lane (SVG or absolutely-positioned divs) with a
fingerboard row of stand slots along the top edge and a single elevator element that
translates along the Y axis. Geometry derives from the container's smaller dimension (a
narrow card gets a compressed derrick height with proportionally smaller stand slots, not a
cropped one). No canvas required.

## Real numbers
- 12 stand slots in the fingerboard row (typical fingerboard capacity range 90-135, scaled
  down for card legibility; document the real range in the instruction paragraph for the
  builder).
- One full trip cycle (elevator down empty → latch → hoist stand clear → swing to fingerboard
  → rack → return down): **2.4s** per stand, comfortably clearing the "~1s between discrete
  events" legibility floor with headroom to show the swing-and-rack transition as a real
  motion, not a blink.
- Elevator travel: down-stroke 700ms (ease-in, accelerating as if under gravity-assisted
  lowering), hoist-up 500ms (ease-out, decelerating as the block brake sets), swing-to-rack
  200ms lateral, rack-seat 300ms (a small settle bounce, ~15px overshoot decaying over 2
  frames), return-down 700ms.
- Depth counter: decrements by one stand-length equivalent (documented as ~93ft) per
  completed cycle, counting down from 12 stands to 0, then holds "OUT" for 1.8s, then resets
  to 12 and runs tripping-IN (racked stands unrack one at a time back down the derrick,
  counter climbing) for the same per-cycle timing before looping back to tripping-out.
- Full loop (12 stands out + hold + 12 stands in) ≈ **60s**.

## The resting loop
- **t0:** mid-cycle — elevator partway up the derrick carrying a stand, 5 of 12 slots already
  racked, depth counter reads a mid-range value (not a round number, e.g. "7 STANDS").
- **2.5s:** roughly one full cycle further — one more slot filled, elevator in a different
  phase of its travel, counter decremented — visibly different slot-fill count AND elevator
  position from t0.
- **5s:** another full cycle-plus further along — slot count and elevator phase both clearly
  advanced again, direction (racking up vs unracking) still the same as t0/2.5s unless the
  loop happened to cross the OUT/hold/IN boundary, which is itself a legitimate visible state
  change.

## The reduced-motion freeze frame
Freeze with the elevator at the rack-seat moment (stand fully racked, elevator still
adjacent, mid-settle) — the frame that shows hoist, stand, and fingerboard slot relationship
most clearly, rather than the ambiguous empty-elevator travel frames.

## Interaction
None required. If added: hovering a racked stand slot could show its stand number
(`stand 6 of 12`) as a tooltip — must not retrigger the trip cycle or restyle the elevator
with `--ns-accent`.

## Light vs dark theme
Derrick structure and fingerboard rendered in `--border` at low opacity (structural, not a
fill), stands and elevator in `--foreground`/`--ns-muted` value steps. In light theme, an
empty vs. racked fingerboard slot must stay distinguishable — check that the racked-stand fill
doesn't collapse toward the same value as the slot's empty outline.

## Kill criteria
- If it reads as a generic "vertical progress bar with a moving dot," kill it — the
  hoist/swing/rack three-phase motion and the growing fingerboard row are what make this a
  real rig mechanic rather than a restyled loader.
- If the depth counter and the fingerboard fill rate visibly desync (counter says 4 stands
  out, fingerboard shows 6 racked), the mechanic reads as broken rather than mechanical —
  fix or kill.
- If 2.4s/cycle still feels too slow to sustain attention across a 60s full loop in an actual
  runtime check, shorten the OUT-hold pause before cutting per-stand timing.
