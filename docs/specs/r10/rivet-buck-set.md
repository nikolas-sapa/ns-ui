# rivet-buck-set

**tier:** core

**product surface it replaces:** a lock/pin/fasten toggle — pinning a message, locking a
row, fixing a card in place — currently served by a generic pin-icon rotate or a plain
filled/outline swap.

**the real mechanic, with its source:** hot/solid riveting with a bucking bar (aircraft
structures practice). A rivet is driven through two sheets; a bucking bar held against the
factory head absorbs the hammering force while a rivet gun on the opposite side deforms the
protruding shank into a "shop head," flattening and mushrooming it outward against the back
sheet. On hot-driven rivets the shank also cools after driving and shrinks slightly along
its length, adding clamp-up force between the sheets as it contracts — the clamp force
keeps building for a short time after the visible forming stops, which is the detail that
separates this from a generic squash animation: the shape finishes forming before the
clamp finishes tightening.

**one-sentence mechanic description:** a rivet shank flattens and mushrooms into a domed
shop head under repeated hammer strikes, then keeps drawing the two sheets tighter for a
moment after its shape stops changing, as it cools and shrinks.

**rendering approach:** DOM/SVG. Rivet shank + forming head as an SVG path (radial profile
built from a small set of control radii at fixed heights, animated per-strike); two sheet
edges as flat `<div>` panels the shop head visibly draws together (a measurable gap that
narrows).

**REAL NUMBERS:**
- 5 discrete hammer strikes, 90ms apart (450ms total forming), each strike widening the
  shop-head's control radii by a decaying increment (strike 1: +3.4px, strike 2: +2.1px,
  strike 3: +1.3px, strike 4: +0.8px, strike 5: +0.5px — geometric decay ~0.62, matching
  how each successive blow does less new deformation as the metal work-hardens) and
  triggering a brief 40ms radial "shock" overshoot-then-settle on the head profile so each
  strike is visually distinct, not a smooth ramp.
- post-forming shrink/clamp: over the following 1.8s (well after the last strike), the two
  sheet-edge panels draw 2px closer together on a slow ease, and the shop head's base
  (where it meets the sheet) tightens by a subtle 1px radius reduction — this is the ONE
  thing to follow: the head stops changing shape at 450ms but the JOINT keeps tightening
  for another 1.8s.
- hold: 1.6s at full clamp.
- reset: 400ms fade back to an unformed shank (straight, proud of the sheet), then loop.
- full period: 450 + 1800 + 1600 + 400 = 4.25s, continuous.

**the resting loop:** t0 — bare shank, sheets at starting gap, no strikes yet. t2.5s — well
past forming (450ms) and into/past the shrink window (450+1800=2250ms), so t2.5s sits just
into the clamp hold — sheets fully drawn together, head fully formed. t5s — second cycle
(5s mod 4.25s = 0.75s in) is mid-forming, partway through the 5-strike sequence — visibly
different (partial head, strikes 1-3 landed, sheets still at gap) from the t2.5s frame.

**the reduced-motion freeze frame, named explicitly:** `STATIC_PHASE = "clamped"` — shop
head fully formed, sheets fully drawn together at minimum gap. Chosen because it is the
only frame that shows the completed joint; the bare-shank frame shows nothing formed yet.

**interaction (if any) and what it must NOT do:** press-and-hold or click can trigger one
full strike-sequence + clamp cycle on demand (e.g. "pin this row") instead of waiting for
the ambient loop; the 5-strike cadence must stay discrete (90ms apart, each with its own
40ms shock) even when interaction-triggered — collapsing it into one smooth deformation
loses the mechanic. No `--ns-accent` on the shop head at any point, including the clamp
moment — luminance/geometry only.

**how it reads in light vs dark theme:** dark — shop head and shank read as `--foreground`
against dark sheets, the shock-overshoot on each strike as a brief +luminance flash at the
head's rim (like a highlight catching the freshly-struck metal) rather than a color change.
Light — same rim-flash logic, capped lower in magnitude so it doesn't overshoot into a
blown highlight on light panels (check directly, this is the same overshoot-cap pattern
used across the other joining specs in this batch — light theme has less headroom above
`--foreground` than dark theme has above `--background`).

**kill criteria:** if the 5 strikes read as one smooth squash rather than 5 discrete
impacts, reject — the discreteness IS the mechanic (bucking bar under repeated hammer
blows, not a continuous press). If the post-forming shrink/clamp draw-together is
imperceptible (sheets don't visibly narrow after the head stops changing shape), reject —
that's the specific detail that distinguishes this from a generic rivet-pop animation.
