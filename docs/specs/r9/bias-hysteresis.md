# bias-hysteresis

**tier:** core

**product surface it replaces:** a level/capacity meter or gauge (the read-only
"how loaded is this" family — sibling to `meter-threshold-trip`,
`meter-quota-meniscus` — but for a saturation/headroom value rather than a
quota).

**the real mechanic, with source:** analog tape recording linearizes an
inherently nonlinear magnetic medium by superimposing a high-frequency AC
bias signal (~100–150kHz on professional decks) on the audio; the tape's
flux density B vs. drive field H traces a hysteresis loop, not a straight
line. As input level climbs toward and past 0dB, the loop widens and its
corners round off toward saturation — this rounding is what makes analog
tape "soft clip" instead of hard-clip, the mechanism behind the colloquial
"tape saturation" sound. Source: standard AC-bias magnetic recording theory
(Jiles–Atherton hysteresis model; documented on any professional
reel-to-reel service manual, e.g. Studer A80/Ampex ATR bias alignment
procedures).

**one-sentence mechanic description:** a glowing point sweeps a closed
loop whose shape — narrow and sharp at low drive, wide and rounded at high
drive — is the tape's own magnetic memory of the signal driving it.

**rendering approach:** 2D canvas, single closed X-Y path (H on x, B on y),
plotted as `B = tanh(k·(H ∓ Hc))` (sign set by sweep direction, giving the
characteristic open lobed loop rather than a single curve), 240-point
resolution, redrawn every frame. Loop plotted in a square region of side
`min(width,height) * 0.7`, so it holds shape at card scale.

**REAL NUMBERS:**
- Real bias frequency: 150kHz (documented in the spec text/label only —
  never rendered 1:1, decoupled per the round-9 legibility rule).
- Drive sweep (the rendered rate): H oscillates as a slow LFO,
  period 8.3s (0.12Hz), amplitude ±1.4 normalized units.
- Coercivity `Hc = 0.18`, saturation `Bsat = 0.92`.
- Loop envelope (the saturation amount) breathes on its own slower cycle,
  period 21s, modulating peak H amplitude between 0.6 and 1.4 — this is
  what makes the loop's overall width/roundedness visibly change across a
  5-second sample, not just the marker's position on a fixed loop.
- Marker traces the full 240-point path once per 8.3s cycle, i.e. ~29
  points/second — smooth to the eye, nowhere near paint-rate aliasing risk.

**the resting loop:** t0 — marker somewhere on the loop, loop at whatever
phase of its 21s envelope-breath it started at. 2.5s — marker has traveled
~30% of one lobe, loop width has shifted measurably (21s cycle → ~12% of a
full breath elapsed). 5s — marker has crossed into the opposite lobe, loop
shape visibly wider or narrower than at t0.

**the reduced-motion freeze frame:** phase = 0.62 of the drive cycle — H
descending through zero on the widest part of the saturated lobe. Chosen
because it's the single frame that shows the full open loop AND the
saturation rounding at its most pronounced, rather than a thin near-origin
sliver.

**interaction (if any) and what it must NOT do:** none required. If a
hover-driven "current drive level" numeric readout is added, it must not
recolor the loop stroke or fill with `--ns-accent` — accent is reserved for
a focus ring on any interactive chrome only, never the loop itself.

**light theme vs dark:** loop stroke is `--foreground` at full opacity;
axis crosshair is a thin `--border` line (separator only, never the loop's
own line); the enclosed hysteresis area gets a very low-opacity
(~0.05) `--foreground` fill so the "area under the loop = energy lost to
saturation" reads as a filled shape in both themes without ever touching
hue. Light theme is the harder case for that fill — verify it doesn't
disappear at low opacity against a near-white background before shipping.

**kill criteria:** if, without the axis/label context, the loop is
indistinguishable from generic oscilloscope Lissajous decoration (risk of
reading as a restyle of `hero-oscilloscope`) — kill it. If the envelope
breathing is too subtle to notice inside a 5-second sample once actually
built, kill it rather than shipping a static-looking loop with a moving dot.

**legibility:** the ONE thing to follow is the bright marker riding the
loop's edge. Cadence: one full lobe traversal every ~8.3s — slow enough to
track continuously with the eye, never a discrete jump.
