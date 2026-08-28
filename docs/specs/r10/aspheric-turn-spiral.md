# aspheric-turn-spiral

**tier:** loud (full-bleed WebGL showpiece hero). Answers a backlog gap
named more than once (`docs/component-backlog.md`: "lens / magnifier | 5 |
`text-prism-split` is close but is a text instrument") — this is the loud,
full-bleed lens answer that gap points at; `lens-ascii-magnify` and
`slider-loupe` already cover the core-tier magnifier interaction.

**product surface it replaces:** hero.

**the real mechanic:** single-point diamond turning (SPDT) of an aspheric
lens surface on an ultra-precision lathe. A diamond tool cuts a continuous
Archimedean-family spiral from the optic's center to its rim; spindle
rotation plus radial feed jointly generate the turning marks, and the local
groove pitch tightens toward the edge because that's where an aspheric
sag rate is highest. Source: precision diamond turning of aspheric optics
(ultra-precision lathe practice, e.g. Moore Nanotechnology / Precitech-class
machines).

**one-sentence mechanic description:** A diamond tool spirals from a lens's
center to its rim on a turning lathe, cutting a continuous groove whose
spacing tightens toward the edge the way an aspheric surface actually
curves.

**rendering approach:** WebGL, full-bleed, fragment-shader height field.
Groove depth is a function of spiral phase, evaluated analytically per
pixel (polar radius/angle in), not rasterized from a CPU path. DPR capped
at 1.5 (matches the weld-pool convention for full-bleed area cost). Disc
radius fills the smaller viewport dimension with a small margin.

**REAL NUMBERS:**
- Spindle rate (screen): 0.08 rev/s — slowed from real SPDT spindle speeds
  of ~600-3000 rpm. Explicitly decoupled per the round 9 rule: the real
  rate is documented here, never animated 1:1.
- Radial feed: continuous, follows a smooth triangle wave over a 90s full
  period (45s outward center→rim, 45s inward rim→center) — the spindle
  never stops; only feed direction reverses, smoothly, which is itself a
  legitimate real-process event (a verification or re-finishing pass), not
  a fabricated reset.
- Spiral pitch: shrinks with radius following an approximate k=-1 conic sag
  term, so groove density visibly increases toward the rim.
- Groove depth amplitude: 0.015 of viewport's smaller dimension, height
  field, lit by 3 simulated raking light sources at different
  elevations/azimuths (weld-pool's "give the environment structure"
  convention) so a nearly-flat local patch still crosses multiple
  reflection bands.

**the resting loop:** t0 — groove visible partway along the current feed
direction, fine banding denser toward one side. 2.5s — the cut position has
visibly advanced along the radius, a bright specular glint has traveled
with it. 5s — cut position clearly further along still (period is 90s, so
direction has not yet reversed at t0+5s under normal phase), composition
distinct from both earlier frames.

**the reduced-motion freeze frame:** `STATIC_T` chosen at feed = 60% of
radius, named `"spiral-60pct"` — the point of highest visible fringe
density before the reversal, the most structured single frame.

**interaction:** pointer position orbits a specular highlight across the
groove height field (parallax read of the surface), luminance-only —
brighter reflection band position shifts, never a colour or accent tint.
Must NOT restart the cut, change feed rate, or reset spiral phase on
interaction.

**how it reads in light theme vs dark:** height field lit through the same
5-stop luminance ramp as weld-pool (`--background` → `--foreground` derived
stops), near-black to near-white in both themes; light theme retunes
bias/contrast, not direction, checked early since full-bleed light is the
harder case.

**legibility:** the one thing to follow is the bright specular glint
traveling along the spiral groove, at a rate matching the slowed 0.08
rev/s spindle (roughly one visible arc-sweep every ~2.5s) — explicitly
decoupled from the real multi-thousand-rpm spindle rate so it never
approaches strobe territory.

**kill criteria:** if it reads as a generic chrome sphere with lines rather
than a legible center-to-rim spiral-fed groove, or if the 90s
direction-reversal reads as a jarring reset instead of a smooth traverse,
kill.
