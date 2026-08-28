# cylinder-hillndale

**tier:** core

**product surface it replaces:** a divider (a continuously-alive
horizontal rule in the `divider-petscii-vu` / `divider-mosaic-split` /
`divider-teletext-mosaic` family — distinct mechanic: a helical
rotation-locked-to-translation motif rather than any of those three's
pattern-fill or scan techniques).

**the real mechanic, with source:** early Edison cylinder phonographs
recorded via a vertically-modulated ("hill-and-dale") helical groove cut
into a rotating wax cylinder — the reproducing/cutting stylus rides groove
DEPTH variation, not the side-to-side lateral modulation vinyl records
later used. A fine lead-screw advances the stylus carriage axially at a
fixed pitch in exact lockstep with cylinder rotation, which is what
physically produces a single continuous helix rather than a set of
concentric rings. Source: standard Edison cylinder phonograph mechanism
documentation (the lead-screw-driven carriage and hill-and-dale vertical
cut, as distinct from Berliner's later lateral-cut disc).

**one-sentence mechanic description:** a cylinder turns while a stylus
carriage rides its helical groove, and the carriage visibly steps sideways
by exactly one wrap's width for every full turn — rotation and
translation locked together, never independent.

**rendering approach:** 2D canvas or SVG, side-elevation view of a
rotating cylinder with a helical groove line wrapped around it, and a
stylus/carriage marker riding along the groove, advancing axially in sync
with rotation. Cylinder length and wrap spacing derived from the
container's smaller dimension.

**REAL NUMBERS:**
- Real Edison standard cylinder rotation: 160 RPM (documented only,
  deliberately decoupled). Rendered rotation: 1 revolution per 2.6s.
- Real groove pitch: ~100 threads/inch (0.254mm). Rendered helical wrap
  spacing at card scale: 6px per wrap.
- Real cylinder length: 4 inches (~102mm) standard, mapped proportionally
  to the canvas width.
- The lead relationship is a non-negotiable geometric identity, not a
  tunable knob: carriage axial advance per frame = (wrap spacing) ×
  (fraction of one revolution completed that frame) — so one full wrap of
  translation always exactly matches one full revolution, at any frame
  rate.
- Full cylinder traversal (start to end of the 4" length) completes in
  26s, then the carriage snaps back to the start and a new pass begins —
  unbounded loop.

**the resting loop:** t0 — carriage at some axial position, cylinder at
some rotational phase. 2.5s — carriage has advanced roughly 1 full wrap
(2.5s / 2.6s-per-rev ≈ one wrap crossing has just happened), a visibly
different axial position. 5s — carriage has advanced ~2 wraps further,
clearly past its t0 position, groove-depth shading pattern under it
changed with the baked signal envelope.

**the reduced-motion freeze frame:** traversal progress = 40% — carriage
clearly past the start (not an ambiguous "just began" t0 frame), with the
groove-depth shading mid-modulation visibly non-uniform under and near the
stylus.

**interaction (if any) and what it must NOT do:** none — this is a pure
ambient divider motif, no interactive surface.

**light theme vs dark:** cylinder body outline `--foreground`; groove
helix `--foreground` stroke, its width modulated to represent depth
(hill/dale) rather than any color shift; if a static end-cap or mounting
detail is added it uses `--border` as a true separator only. No
`--ns-accent` anywhere — there is nothing interactive to reserve it for.

**kill criteria:** if the carriage's one-wrap-per-turn stepping isn't
legible once built (i.e. it just looks like "a barrel spinning" with no
visible link between rotation and the carriage's sideways creep), the
entire mechanic has collapsed to decoration — kill it. If it reads as a
restyle of `loader-thread-spool`'s coiling motif at a glance, kill it and
say so.

**legibility:** the ONE thing to follow is the carriage's sideways
position relative to the groove it's riding. Cadence: one full wrap
crossing every 2.6s (matching one full cylinder rotation) — enough time to
watch the carriage step over exactly one wrap and confirm the
rotation-locked-to-translation identity by eye.
