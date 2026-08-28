# groove-pitch

**tier:** core

**product surface it replaces:** a loader/progress indicator (distinct
from `loader-spirograph-trace`, which traces a fixed closed rosette shape
for percent-complete — this component's spiral is open-ended and its
identity is the SPACING between turns changing, not the fraction of a
shape inked in).

**the real mechanic, with source:** a vinyl mastering lathe's cutting head
varies groove pitch — the radial spacing between adjacent spiral turns —
in real time based on program amplitude and bass content, historically
under a Neumann VMS pitch-control computer reading a preview head slightly
ahead of the cutting stylus. Loud or bass-heavy passages get pulled wider
(fewer grooves per inch) so adjacent groove walls don't intersect and
cause the cutter to break through; quiet passages get packed tight to fit
more program time on the disc. Source: standard disc-mastering "variable
pitch" cutting practice (Neumann VMS70/80 documentation; the reason a
loud, bassy record side runs shorter than a quiet one of the same groove
length).

**one-sentence mechanic description:** a cutting point spirals outward
from the center, and the spacing between the turn it just cut and the one
before it visibly widens over loud passages and tightens over quiet ones.

**rendering approach:** 2D canvas, single continuous spiral path drawn
from center outward (Archimedean-style, radius growing with angle), pitch
(radial gain per revolution) driven by a baked amplitude envelope along
the spiral's length. Spiral fits inside a circle of diameter
`min(width,height) * 0.85`.

**REAL NUMBERS:**
- Real quiet-passage groove pitch: ~40 grooves/mm (documented reference
  only). Rendered turn spacing oscillates between 2.2px and 5.8px at card
  scale (derived from `min(width,height)`), a >2.5x visible ratio so the
  pitch change reads clearly at small sizes.
- Real disc rotation: 33⅓ RPM (documented only, never rendered 1:1 — a
  1.8s/rev strobe rate against a 60Hz paint budget is exactly the round-9
  aliasing trap). Rendered cutting-point advance: one full revolution
  every 3s.
- Pitch-band structure: 5 alternating wide/narrow zones baked along the
  spiral's length, each zone spanning ~4s of traversal at the render rate,
  so a band transition is visible roughly every 4 seconds.
- Full spiral (one "record side") completes outward traversal in 42s, then
  resets to the inner lead-in and restarts — an unbounded loop.

**the resting loop:** t0 — cutting-point marker at some position, a
partial spiral with 1–2 pitch-band transitions already visible behind it.
2.5s — marker has advanced roughly 1/17th of the full traversal, one more
band transition likely crossed. 5s — a clearly longer spiral, at least one
full wide-to-narrow-to-wide cycle visible in the drawn turns.

**the reduced-motion freeze frame:** traversal progress = 0.35, positioned
exactly at a wide-to-narrow pitch transition — the single frame with the
clearest side-by-side evidence that spacing is modulating, rather than an
ambiguous mid-band frame where pitch looks constant.

**interaction (if any) and what it must NOT do:** none required for the
ambient loop. If a hover-driven numeric "pitch" readout is added, it must
render in `--foreground`/`--ns-muted` text only — never recolor the spiral
stroke with `--ns-accent`.

**light theme vs dark:** spiral stroke `--foreground`, full opacity. If an
adjacent-turn "groove shadow" is added for depth, it must use `--border`
at true separator strength (not a stroke standing in for geometry) — check
in light theme first, where `--border` is ~1.1:1 and can vanish if used
for anything load-bearing.

**kill criteria:** if the finished spiral is visually indistinguishable
from `loader-spirograph-trace` at a glance (both are spirals; the pitch
must be the unmistakable, load-bearing difference) — kill it and say so.
If the pitch-band transitions read as noise rather than as a legible
"wide here, narrow there" pattern once built, kill it.

**legibility:** the ONE thing to follow is the turn spacing widening or
narrowing right at the spiral's growing outer edge. Cadence: a pitch-band
transition every ~4s — long enough to watch the spacing visibly open or
close, not a blink.
