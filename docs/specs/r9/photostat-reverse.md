# photostat-reverse

**tier:** loud (full-bleed showpiece)

**product surface it replaces:** hero / full-bleed background.

**the real mechanic, with source:** the photostat process (in wide commercial
use for line-art reproduction and enlarging/reducing documents, roughly
1910s-1970s before photocopiers displaced it): a document is photographed
directly onto photosensitive paper and developed in-camera, producing a
same-generation copy that is TONE-REVERSED (a negative — dark source lines
come out as light lines on a dark ground). To get a positive/true-tone copy,
that negative photostat is itself re-photographed and developed a second
time, flipping tone back. Each generation pass also measurably softens and
thickens fine detail (line art loses crispness generation over generation —
well-documented "generation loss" in photostat and photocopy reproduction
alike). Source: photostat/stat-camera direct-positive-via-double-exposure
process, documented generation-loss in photographic line-art reproduction.

**one-sentence mechanic description:** a full-bleed field of type/line-art
flips between a negative and a positive generation every exposure, each
generation a little softer and thicker than the one before it, until the
drift is reset by a fresh, crisp exposure.

**rendering approach:** WebGL, full-bleed, DPR-aware backing store capped at
1.5. A single large headline/wordmark (caller-supplied text or a built-in
line-art glyph set) rendered to an SDF (signed distance field) texture once at
mount/resize, so tone-flip and blur/thicken are pure fragment-shader
operations on one static field rather than re-rasterizing text per frame.
Geometry (glyph scale, stroke width) derives from the container's smaller
dimension.

**REAL NUMBERS:**
- generation cycle: one tone-flip exposure every 1.3s (round-9 "roughly a
  second between events" applied directly — this is a discrete event, not a
  continuous drift, and needs to be exactly this followable)
- transition itself: 260ms cross-fade between generations, NOT an instant cut
  — during the 260ms the outgoing generation's SDF distance threshold sweeps
  through zero (this is what makes it read as a flip through a physical
  in-between state, departure and arrival both visible, rather than a blink,
  per the round-9 "the transition itself must show departure and arrival"
  rule)
- generation drift: each generation's stroke width increases by 4% and its
  edge sharpness (SDF threshold softness) increases by 6% over the previous
  generation, compounding for up to 5 generations before reset
- reset: on generation 6, the field snaps back to generation-1 crispness
  (stroke width and softness both reset), but the reset is NOT itself a
  tone-flip — it lands on whichever tone (positive/negative) generation 5 was
  already displaying, so the viewer reads "suddenly sharp again" as a distinct
  event from the regular flip cadence
- full cycle: 5 generations × 1.3s = 6.5s before the crisp reset

**the resting loop:** t0 = generation 1, positive tone, maximum crispness.
t=2.5s ≈ generation 2 (just past its flip, softened 4%, now negative tone).
t=5s ≈ generation 4 (softened ~12-16%, tone flipped twice more since
2.5s) — visibly softer and a different tone than both t0 and 2.5s.

**reduced-motion freeze frame:** generation 3, positive tone (mid-drift — soft
enough to show the generation-loss mechanic exists, still legible as text,
not the maximally-degraded generation 5 frame which risks being illegible as
a static image).

**legibility:** the ONE thing to follow is the tone-flip itself — the
headline visibly inverting from dark-on-light to light-on-dark (in luminance
terms) once every 1.3s, with a visible 260ms transition rather than a cut.
Softening is a secondary, slower-building cue a viewer notices across several
flips, not something that has to be followed frame to frame — the flip is
the followable event, softening is the payoff for watching it a few cycles.

**interaction:** pointer proximity to the headline may locally hold that
region at generation-1 crispness (a small radius "fresh exposure" halo
following the cursor, luminance-only brightening, no accent) — this must NOT
pause or desync the global flip cadence elsewhere in the frame, and must
default to `"none"` autoplay mode since the base loop is unconditional
self-animation, not pointer-driven.

**light vs dark theme:** the tone-flip mechanic already IS a value inversion,
so both themes get the exact same generation-1 "positive" starting value
mapping (foreground-on-background) — what changes between themes is only the
degradation's endpoint values (how far toward middle-grey the softening pushes
edges before it reads as mush), checked early since light theme has less
headroom between `--foreground` and `--background` than dark theme typically
does.

**kill criteria:** if the tone-flip at 1.3s cadence reads as strobing rather
than a legible alternation (the round-9 failure mode this whole axis is
built to avoid), slow the cadence further before shipping — if it still
strobes at 2s+, kill the concept rather than keep tuning. If the SDF-based
softening looks like a blur filter rather than "generation loss," the
mechanic has been reduced to a stock effect and should be reworked or killed.
