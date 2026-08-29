# semaphore-arm-tension

**tier:** core

**product surface it replaces:** a status/feedback badge or dot (e.g. build,
deploy, or system-state indicator) — the arm's position IS the state instead
of a colored pill.

**the real mechanic, with source:** UK lower-quadrant mechanical semaphore
signalling — the arm is mounted so gravity alone holds it at Danger
(horizontal); it only moves to Clear (~55° below horizontal) when a taut
signal wire, pulled from a signal box up to ~1,000 yards away via cranks,
overcomes a counterweight. If the wire breaks or slackens, the arm falls
back to Danger by gravity — the mechanism is fail-safe by construction, not
by logic. At night a lamp behind the arm's spectacle provided the aspect;
this spec keeps the lamp as a fixed luminance source only (see monochrome
note below), never a coloured glass swap. Source: UK mechanical signalling
practice, lower-quadrant arm/wire/counterweight actuation as documented in
period signal-engineering drawings (Great Western Railway and successors),
still in limited service.

**one-sentence mechanic description:** A signal arm hangs at Danger by
gravity and only reaches Clear when a taut wire pulls it down, so its
position is always physically honest about whether the wire is under
tension.

**rendering approach:** DOM + SVG, no canvas. Post height = 0.7 × the
container's smaller dimension; arm length = 0.42 × the same. Lamp housing
sits at the post head, arm pivots from beside it, counterweight hangs below
the pivot on a short link.

**REAL NUMBERS:**
- Arm rotation: Danger 0° (horizontal) → Clear −55° (below horizontal),
  standard UK lower-quadrant throw.
- Signal wire run: up to 1,000 yards (914m), steel, thermal expansion
  coefficient 11.7×10⁻⁶/°C — a real diurnal swing puts several inches of
  length change into the run, normally taken up by a wire adjuster but
  leaving residual tension ripple.
- Rendered wire-tension cycle (decoupled from the real diurnal rate per the
  round-9 rule): 9-second sine period, driving the arm tip ±6px and the
  counterweight ±4px in phase opposition (arm rises as weight drops).
- Lamp: simulated oil-flame luminance flicker, Perlin-noise-driven, sampled
  at 12Hz, luminance range 0.82–1.0 of peak — a slow candle-like drift, not
  a strobe.

**the resting loop:** t0 shows the arm at its current state angle with the
tip at some point in its 9s bob and the lamp at a baseline luminance. At
2.5s the tip has moved along roughly a quarter of the bob cycle and the
lamp's flicker sample has independently drifted. At 5s the tip is past the
cycle's midpoint — on the opposite side of its range from t0 — and the lamp
shows a different noise sample again; all three signals (arm bob,
counterweight bob, lamp flicker) differ at every sampled time.

**the reduced-motion freeze frame:** freezes at Clear (arm depressed 55°,
tip at neutral mid-bob, lamp at peak luminance) — the most-structured
frame, not the Danger/t0 default.

**interaction (if any) and what it must NOT do:** clicking the arm (or a
labeled control) toggles Danger↔Clear with a ~250ms eased rotation plus a
1–2° overshoot settling in ~400ms (the wire snapping taut/slack). Must NOT
tint the arm or lamp with `--ns-accent` on toggle — state reads via angle
and a focus ring only.

**light theme vs dark:** arm/post/counterweight are `--foreground` at full
weight in both themes. Lamp glow is a luminance halo built from
`--foreground`/`--background`, brighter in dark, a smaller value bump in
light — never a colored roundel. Check the lamp housing keeps a visible
outline against a bright light-theme card.

**kill criteria:** if the wire-tension bob is imperceptible at card scale
(under ~3px rendered) or the lamp flicker reads as a glitch/strobe instead
of a slow drift, kill it.

**legibility line:** the ONE followable thing is the arm tip's slow up/down
bob riding the simulated wire-tension cycle; cadence is a 9-second full
period, so a 2–3s glance shows clear directional movement, not a jump cut.
