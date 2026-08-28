# caddisfly-case-assembly

**tier:** core

**product surface it replaces:** loader (a determinate/indeterminate build-
up loader, alongside `loader-die-tumble`/`loader-thread-spool`/`loader-
braille`, mechanically distinct from all — none of the existing loaders are
a discrete particle-selection-and-cementing process).

**the real mechanic, with source:** Caddisfly larvae (Trichoptera) build
protective cases by selecting mineral grains (sand, gravel fragments) from
the substrate one at a time, testing them roughly by size against the
existing case rim, and cementing accepted grains onto the case's leading
edge with silk, working around the rim in a rough spiral/helical course so
the tube extends and widens as the larva grows (documented in Trichoptera
case-building ethology — e.g. Hansell 1968 "The house-building behaviour of
the caddis fly larva"). Grain rejection (too big/too small/wrong shape for
the current rim gap) is a real, observed part of the behavior, not just
acceptance.

**one-sentence mechanic description:** Grains drift in one at a time, get
measured against the open gap at the case's growing rim, and either cement
into place — extending the tube in a slow spiral — or get rejected and
drift away, repeating until the case is complete.

**rendering approach:** 2D canvas. The case rim is a closed polyline (a
slightly irregular tube cross-section, radius derived from
`min(w,h) * 0.18`), extended by adding cemented grains as small filled
polygons (rounded quadrilaterals, 4-7px per side at card scale) along the
rim's advancing edge.

**REAL NUMBERS:**
- Candidate grain rate: 1 candidate grain evaluated per 340ms.
- Candidate grain size: sampled from a real bimodal-ish distribution
  (60% "fine" 3-5px, 40% "coarse" 6-9px, matching real substrate mixed-grade
  sediment) at random rotation.
- Acceptance test: current rim gap width (the open space at the active
  build edge) must be within ±22% of the candidate grain's size; grains
  outside that band are rejected.
- Rejected grain: renders for 260ms drifting 18px away from the rim at a
  random angle while fading to 0 opacity, then is removed — a visible "no".
- Accepted grain: eases into position over 220ms (ease-out), rim gap updates
  to the new remaining space, and the build cursor advances along the rim by
  the grain's placed width.
- Spiral advance: after completing one full rim circumference (rim gap
  wraps back to start), the whole case extends 5px in tube-length (rendered
  as the case's visible "depth" via a second, slightly offset rim drawn
  behind the first) and a fresh rim course begins — one full course takes
  ~14-20 accepted grains, roughly 8-12s at these rates including rejections.
- Overall acceptance rate ~55-65% (roughly matching real substrate grain-
  size variance against a single target gap), so roughly 1 in 2 candidates
  visibly bounces off before one sticks — this rejection visibility is the
  mechanic's whole point, not an incidental detail.
- Case complete at 5 courses (~40-100s depending on rejection variance);
  on completion, holds for 4s then the whole case fades to `--border` outline
  only over 1.5s and a fresh case restarts from a bare rim.

**resting loop (t0/2.5s/5s):** t0 shows a bare single-course rim with the
first candidate grain drifting in. At 2.5s several grains are cemented, at
least one rejection has visibly bounced off. At 5s the first course is
partially or fully wrapped, second course's offset depth-rim may have begun
— genuinely different grain count and rim shape at each mark.

**reduced-motion freeze frame:** a case frozen mid-third-course (2 complete
courses visible as depth rings, third course half-built with a clearly
irregular, real-looking mixed grain rim) — named `CASE_MIDBUILD`, chosen
because it shows both the depth-ring structure from finished courses and the
raw grain-by-grain rim texture of an active one.

**interaction:** none; ambient loader-style component with no forced
duration (it's a resting loop, not a determinate progress signal — must NOT
be wired to any actual async operation's real progress, since the case-
complete/restart cycle runs on its own clock regardless of what it's loading
for).

**light vs dark:** cemented grains render in `--ns-muted` fill with a thin
`--border` outline per grain (so individual grains stay legible against each
other, not just against the background); rejected grains use the same fill
but fade through the same tokens so no dark/light asymmetry; depth rings
from completed courses use `--border` only. Check light theme specifically
for grain-to-grain edge legibility since `--border` at ~1.1:1 may need the
per-grain outline bumped to a slightly higher alpha in light to stay visibly
separated grain-from-grain rather than blurring into one shape.

**kill criteria:** if the rejection bounce isn't clearly distinguishable
from an accepted grain at a glance (i.e., both just look like "something
appeared near the rim"), the whole selection mechanic collapses into generic
particle accumulation and should be cut.

**legibility:** the one thing to follow is a single grain's accept/reject
decision at the rim — drift in, brief pause at the gap, then either snap-
cement (220ms) or bounce-away-and-fade (260ms); at 1 candidate/340ms a
viewer can watch individual decisions rather than a blur of particles.
