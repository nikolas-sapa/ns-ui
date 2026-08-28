# stack-step-carousel

**tier:** loud (full-bleed background/showpiece).

**product surface it replaces:** background / hero backdrop.

**the real mechanic:** vacuum thin-film deposition on a planetary
carrier. Mirror/lens blanks are mounted on a rotating planetary carrier
(sun-and-planet gearing) inside a coating chamber; each pass a substrate
makes under the fixed evaporation/sputter source deposits one quarter-wave
layer, and the mirror's reflectance climbs a step each time. Source: optical
thin-film deposition on planetary tooling (e-beam/ion-assisted quarter-wave
stack growth), a genuinely continuous industrial batch process — the
chamber runs planetary rotation for the whole cycle, not a one-shot flash.

**one-sentence mechanic description:** Mirror blanks ride a planetary
carrier past a fixed coating source, each pass depositing one quarter-wave
layer and stepping the mirror's brightness up another notch.

**rendering approach:** WebGL or 2D canvas, an array of substrate discs
arranged on two nested rotating rings (sun ring + planet spin per disc).
Grid: 8 substrate discs on the outer ring, disc radius = `0.09 *
min(w,h)`, source arc fixed at the top of the frame.

**REAL NUMBERS:**
- Sun ring (carrier) period: 14s.
- Planet (substrate) spin period: 3.5s — a 4:1 ratio, matching real
  planetary-tooling gear ratios.
- Source arc width: 30° at the top of the frame.
- Each substrate crossing the source arc increments its layer count by 1
  (reflectance/luminance follows the real quarter-wave reflectance
  recursion magnitude, never a literal interference colour — value only).
- Layer cap: 12 layers per substrate, at which point that substrate is
  swapped for a fresh blank — swaps are staggered per-disc (not
  synchronized), so at any given moment 2-3 of the 8 discs are freshly
  reloaded while others are mid-stack. This keeps the whole chamber from
  ever visibly finishing and stopping.
- Source-crossing glow: arrives-brightens-departs over 800ms per crossing.

**the resting loop:** t0 — discs at varied luminance (mid-batch, staggered
layer counts). 2.5s — at least 2-3 discs have crossed the source arc and
visibly stepped up one luminance notch. 5s — further stepping visible, plus
the carrier ring has visibly rotated to a new configuration.

**the reduced-motion freeze frame:** a frame with one disc mid-crossing
under the source (bright source glow on that disc) and the others at
staggered heights, named `"carrier-crossing"`.

**interaction:** pointer over a disc raises a subtle luminance halo showing
that disc's current layer count as a bump in brightness — no accent tint,
no change to the sun/planet rotation rates.

**how it reads in light theme vs dark:** value-only reflectance ramp from
`--ns-muted` (bare substrate) toward `--foreground` (fully stacked) in
dark theme; light theme retunes bias/contrast per the weld-pool convention
(fully-stacked still reads as the higher-contrast extreme, not literally
inverted to a different hue relationship) — no hue anywhere.

**legibility:** the one thing to follow is a single substrate disc's
brightness stepping up as it passes under the fixed source arc — cadence
one step every 3.5s per disc (its own spin period), each crossing rendered
as an 800ms glow that visibly arrives, brightens, and departs rather than a
blink, comfortably above the round 9 ~1s-between-events floor.

**kill criteria:** if reflectance stepping reads as a literal colour change
(interference bloom hue) in either theme, kill. If the staggered-reload
approach fails and the batch instead reads as a synchronized full-chamber
reset (violates "alive at rest," reads as a process finishing and
stopping), kill.
