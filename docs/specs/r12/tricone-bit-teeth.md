# tricone-bit-teeth

- **slug:** tricone-bit-teeth
- **tier:** loud (full-bleed WebGL showpiece)

## Product surface it replaces (Filter 1)
Hero / full-bleed background — the crushed-rock-close-up hero, same slot as `weld-pool`
(liquid metal) or `dye-whorl` (ink), not yet covered by a "rock is being destroyed" mechanic.

## The real mechanic
A rotary tricone rock bit (Hughes/Reed style, standard in oil & gas and mineral rotary
drilling since the 1930s): three cone-shaped cutters mounted on offset journal bearings at
the bit's periphery. As the whole bit rotates about the borehole axis, each cone is forced
to counter-rotate about its own skewed axis by contact friction with the hole bottom — the
skew produces a gouging/scraping action, not pure rolling, so teeth both crush AND scrape
rock with every pass. Tungsten-carbide inserts (or milled steel teeth on softer-formation
bits) strike the formation in a fixed row pattern per revolution; crushed rock is swept away
by drilling-fluid jets from nozzles between the cones (same mud circulation this axis also
covers under `blast-hole-delay-sequence` and pipe-tripping — kept out of this component).

## One-sentence mechanic description
Three cone cutters chew across a rock face as the bit turns, each tooth strike leaving a
crush crater that fills, darkens and is swept clean by jetting fluid before the next pass.

## Rendering approach
2D canvas (not WebGL — the "crush crater" field is a height/luminance map, cheaper and more
controllable than a shader for a first pass; escalate to WebGL only if the height-field
accumulation cost forces it). Grid: rock-face height field sampled on a 96×96 cell grid
(scaled from the container's smaller dimension, cell size = min(w,h)/96), redrawn to an
offscreen canvas and blitted each frame — accumulation buffer persists between frames so
craters don't reset.

## Real numbers
- Bit rotation: 60–120 RPM at surface (rotary table) is realistic for a tricone bit; render
  at a DECOUPLED slow sweep of **8 RPM-equivalent** (one full lap of the three cone tracks
  every 7.5s) — the real rate is far too fast to read as individual tooth strikes, per the
  round 9 aliasing rule.
- 3 cones, each carrying **11 teeth** on its outer row (real bits run 8–14 depending on
  formation class) — 33 strike events per lap, so one strike roughly every **227ms** at the
  8 RPM-equivalent rate. That clears the "~1s between discrete events" legibility floor only
  if strikes are grouped: render as 3 simultaneous strikes (one per cone) every ~680ms rather
  than 33 discrete beats — matches how a viewer actually perceives multi-cone contact.
- Crater decay: each strike deposits a crater (radius 3–5 cells, depth 0.6–1.0 in a
  normalized 0–1 height field); craters heal (refill toward 0) at a decay constant of
  **0.015/frame** at 60fps (~1.1s to 90% refill), giving the surface a "constantly being
  worked, never permanently cratered" character — matches real hole-cleaning where fluid
  jetting continually resets the visible face.
- Mud-jet sweep: a faint luminance wash (peak +0.08 over base) radiates from bit centre
  outward at **140px/s**, repeating every 900ms, standing in for nozzle discharge.

## The resting loop
- **t0:** flat-lit rock height field, no craters, cones at their start angle.
- **2.5s:** first 2–3 strike clusters visible as fresh dark craters near center, one healed
  crater already fading back toward flat.
- **5s:** a ring of overlapping crater history has built up along the cones' swept track,
  continuously refreshing — old craters healing at the trailing edge as new ones land at the
  leading edge, so the ring never fills in or empties out.

## The reduced-motion freeze frame
Freeze at the moment right after a 3-cone simultaneous strike lands (one full crater cluster,
un-healed, at maximum depth) — the single most structured frame, showing the tooth pattern
clearly rather than a mid-heal blur.

## Interaction
None required (loud showpiece, ambient). If pointer interaction is added, it may only
brighten the swept ring in luminance near the cursor (a "light raking across the face"
effect) — must NOT tint with `--ns-accent`, must NOT change strike timing or rotation speed.

## Light vs dark theme
Height field is rendered via a luminance ramp from `--background` (raised/unstruck rock) to
`--foreground` (deepest fresh crater), with `--ns-muted` for the mid-heal band. In light
theme the ramp compresses toward the light end (raised rock stays close to `--background`,
craters read as a handful of contrast steps down) — must be checked early since a shallow
crater in light theme risks falling below the perceptual floor; if 3-stage crater depth
doesn't read in light theme, widen the ramp's dark anchor rather than adding a hue.

## Kill criteria
- If the height-field crater accumulation reads as generic noise/static rather than a
  legible "teeth striking a pattern," kill it — the mechanism has to look like impact, not
  grain.
- If decoupling the rotation rate to 8 RPM-equivalent still aliases against 60Hz paint
  (visible strobing rather than smooth cone travel), the concept fails the round 9 aliasing
  rule and dies.
- If it reads as a generic "rocky texture" hero indistinguishable from a bump-mapped granite
  background, kill it — the cone/tooth STRIKE pattern must be the legible feature, not
  ambient roughness.
