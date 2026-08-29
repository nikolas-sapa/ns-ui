# bombe-drum-halt

**tier:** core

**product surface it replaces:** a search/lookup loading indicator — the slot for "the
system is searching/checking many possibilities," distinct from a generic progress bar
(there's no known endpoint or percentage) and from other loaders like `loader-braille` or
`loader-pendulum-sync` by its specific scan-then-halt-then-resume cadence.

**the real mechanic, with source:** the electromechanical Bombe's drum-scanning search.
Banks of rotating drums (each representing a candidate rotor position) spin continuously
through the hypothesis space; a sensing relay bank tests each position as the drums pass
it, and when a candidate briefly satisfies the test criteria the whole bank of drums stops
dead (the "stop"), a diagonal-board-style check runs against that candidate, and — since
almost every stop is a false positive — the drums release and resume spinning moments
later. Sourced from the drum-and-stop search cycle, not the electrical/plugboard logic
being tested.

**one-sentence mechanic description:** a row of drums spins continuously through positions
until, every so often, all of them lock still at once for a beat while a check runs, then
they let go and keep spinning.

**rendering approach:** DOM. Three to four vertical drum columns side by side, each drum a
tall `overflow:hidden` window over a repeating tick-mark strip, translated continuously via
`requestAnimationFrame` (not CSS `animation: infinite`, so the halt can pause the same
driving clock precisely rather than fighting a separate animation timeline). A thin
horizontal "sensing bar" sits across all drums at a fixed height. Geometry: drum width =
container's smaller dimension / 9, drum height = container's smaller dimension x 0.85.

**REAL NUMBERS:**
- rendered scan speed: **180 tick-marks/s** scroll speed per drum (a visually smooth
  continuous blur-free scroll, well under the paint rate so it reads as spinning, not
  strobing) — explicitly a rendered rate, not the historical rate: the real Bombe tested on
  the order of hundreds of rotor-hypotheses per second, far above what could ever read as
  anything but noise on a 60Hz screen, so this component decouples the visible scan speed
  from that real rate rather than attempting to represent it 1:1 (round-9 rate-decoupling
  rule).
- drum offset: each of the 3-4 drums scrolls at the same speed but a different phase
  offset (drum N starts `N * 0.6s` ahead) so they don't visually lock-step.
- halt interval: a halt event fires roughly every **4-6s** (randomized within that range
  each cycle, never a fixed metronome — the real search doesn't stop on a beat).
- halt sequence: drums decelerate from full speed to a dead stop over **180ms**, hold
  fully still for **900ms** (during which the sensing bar brightens toward `--foreground`
  full opacity — this is the "check running" beat), then re-accelerate to full scan speed
  over **220ms**. Total halt event ≈ 1.3s, comfortably above the round-9 "roughly a second
  between events, with visible departure and arrival" bar.
- false-positive resolve: at the end of 85% of halts the sensing bar simply dims back down
  as drums resume (rejected candidate); on the remaining 15% a drum column's current tick
  mark holds a 40%-opacity outline ring for one extra 600ms after resuming, as a rarer
  "this one got a second look" variant — still resolves, never latches permanently.

**the resting loop — t0 / 2.5s / 5s:** t0: drums scanning continuously, phase-offset from
each other, no halt in progress (or one just resolving, depending on session start phase).
t=2.5s: drums have scrolled substantially further, sensing bar unchanged unless a halt fell
in this window. t=5s: on average about one halt event has occurred and fully resolved
somewhere in the 0-5s window (mean interval ~5s), so t=5s should differ from t0 in drum
scroll position regardless, and very likely shows a full halt-and-resume having happened.

**reduced-motion freeze frame:** `STATIC_PHASE`: freezes mid-halt, at the point where drums
are fully stopped and the sensing bar is at peak brightness (the 900ms hold, not the
decel/reaccel transition) — the single frame that shows the mechanism doing its actual
work, not mid-scroll blur.

**interaction:** none. Ambient search/loading indicator; no click-to-force-a-halt, no
result readout (would imply a real search result and pull this toward representing actual
data, out of scope for an ambient loader).

**light vs dark theme:** drum tick marks at `--foreground` 45% opacity (numerous, so kept
dim to avoid visual noise at 180 marks/s scroll), sensing bar idle at `--foreground` 20%
opacity rising to 90% during a halt (luminance-only intensity change, the entire halt
signal). Drum column separators use `--border`. No accent anywhere.

**legibility line:** the ONE followable thing is the halt itself — all drums stopping
together, the sensing bar visibly brightening while they're still, then release — cadence:
halts land every 4-6s and the full event (decel + 900ms hold + reaccel) takes ~1.3s, long
enough to register "it stopped, something happened, it's moving again" as three distinct
beats rather than a blink.

**kill criteria:** if the continuous drum scroll at rest reads as noise/static rather than
purposeful scanning, or if the halt event is too brief/frequent to register as a discrete
beat against the constant background motion, kill it.
