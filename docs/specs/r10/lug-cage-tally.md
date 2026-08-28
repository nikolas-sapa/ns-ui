# lug-cage-tally

**tier:** core

**product surface it replaces:** a generic loading/processing spinner — the same slot as
`loader-spring-bars` or `loader-die-tumble`, a plain "something is running" indicator, not
a security/keystream visual (deliberately kept out of the user-facing framing).

**the real mechanic, with source:** the lug-and-cage assembly of a pin-and-lug mechanical
cipher machine (M-209-family). Several wheels, each ringed with pins that can be set
active/inactive, rotate at slightly different, mutually prime step counts so their combined
pattern doesn't repeat for a very long time. A rotating cage carries sliding lugs; on each
cage revolution, every lug checks whether the wheel pin at its current position is active,
and each engaged lug nudges a mechanical tally counter forward by one. The component
surfaces the tally counter ticking as the visible payoff of the wheels' rotation, not any
cryptographic meaning behind it.

**one-sentence mechanic description:** several small wheels with raised and flat pins spin
at their own speeds past a row of sliding arms, and every time an arm meets a raised pin it
nudges a tally bar forward one notch.

**rendering approach:** DOM. Five wheels arranged in a horizontal row (rotating disc
elements with 8 pin-marks around the rim, CSS `transform: rotate()`), a single sliding-lug
row above them (small tick marks, one per wheel, sitting at each wheel's 12-o'clock read
position), and a tally bar below (segmented, notches filling left-to-right). Geometry:
wheel diameter = container's smaller dimension / 6.5, tally bar height = wheel diameter x
0.3, all scaling together from that one base unit.

**REAL NUMBERS:**
- wheel pin count: **8 pins per wheel**, each independently active/inactive in a fixed
  pattern (roughly half active, set once at mount, not randomized per frame).
- wheel rotation rates (deg/s), five wheels: **51.4, 60, 72, 90, 102.9** — chosen so their
  full-cycle periods (7s, 6s, 5s, 4s, 3.5s) share no common small factor, giving a combined
  repeat period well past a minute of viewing.
- read event: each wheel fires a "pin read" the instant its active pin crosses the
  12-o'clock lug position — a brief 90ms luminance flash on that wheel's rim mark, not a
  color change.
- tally advance: **one notch per engaged read**, notch fill transition 140ms ease-out;
  average engaged-read rate across all five wheels works out to roughly **1 tally tick /
  0.7s** given 8-pin/half-active wheels at the rates above.
- tally bar length: **24 notches**, on the 25th tick the leftmost notch fades out over
  200ms as the new one fills on the right — rolling window, no hard reset/flash-to-empty.

**the resting loop — t0 / 2.5s / 5s:** t0: five wheels at whatever rotation phase the
continuous run has reached, tally bar partially filled from prior ticks. t=2.5s: each wheel
has rotated a different amount (their rates differ), at least 2-3 tally ticks have landed
(2.5s / 0.7s ≈ 3.6), visibly moving the fill edge right. t=5s: wheel phases now visibly
decorrelated from their t0 relationship (the point of the mutually-prime rates), tally bar
has advanced roughly 7 notches from t0, and the rolling-window fade may have triggered once.

**reduced-motion freeze frame:** `STATIC_PHASE`: freezes at a moment where at least 2 of
the 5 wheels show their pin flash mid-fade (not one clean flash, not zero) and the tally
bar sits at roughly 60% fill — the frame that best shows "wheels at different phases,
mechanism mid-tally," not a clean idle state.

**interaction:** none. Ambient loader only; no start/stop control, no numeric readout of
the tally count (a visible number would tip this toward a progress/quota meter, a different
already-covered surface).

**light vs dark theme:** wheel rim from `--foreground` at 55% opacity, pin marks at 85%,
the 12-o'clock lug tick at `--foreground` full opacity (highest-contrast fixed reference
point). Tally notches: filled = `--foreground` 80%, empty = `--border` outline only, never
filled with `--border`. No accent; the read-event flash brightens toward `--foreground`
(luminance only), never tints toward `--ns-accent`.

**legibility line:** the ONE followable thing is picking one wheel and watching its pin
flash land the instant its rim mark crosses the fixed lug tick at 12 o'clock, then seeing
the tally bar's next notch fill shortly after — cadence: each wheel's own read recurs every
3.5-7s depending on which wheel, slow enough to anticipate and watch land, while the
combined tally ticks faster (~0.7s average) so the bar itself always looks busy even
between any one wheel's individual reads.

**kill criteria:** if five independently-spinning wheels read as generic decorative
clutter with no visible tie to the tally bar's advance, or if the pin-flash-to-tally-tick
causal link isn't perceivable even after watching for 10+ seconds, kill it.
