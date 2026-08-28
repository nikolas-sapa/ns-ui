# bitplane-cascade

**tier:** loud

**product surface it replaces:** full-bleed hero / background band.

**the real mechanic, with source:** Amiga-class planar framebuffers (and 1-bit fax/plotter
graphics before them) don't store a pixel's value in one place. An N-bit-deep image is stored as
N separate 1-bit bitplanes, each the full resolution of the frame, and the final pixel value is
the sum of the corresponding bit from every plane (plane 0 contributes 1, plane 1 contributes 2,
plane 2 contributes 4, etc. — binary place value). The hardware (or a software blitter) composes
the visible image by ORing/adding planes together in sequence; if you watch the composition
happen one plane at a time, a coarse silhouette from the low bit resolves into finer tonal
structure as each higher plane is added.

**one-sentence mechanic description:** a field of large soft shapes resolves in visible stages —
a coarse 2-tone silhouette appears first, then each subsequent bitplane adds a finer layer of
tonal detail on top of it, cascading up to a full luminance gradient before the whole stack
resets and rebuilds from plane 0 again.

**rendering approach:** 2D canvas, full-bleed. A single underlying scalar field (smooth Perlin/
value noise or a soft radial blend, doesn't matter which — the point is the *reveal*, not the
field generator) sampled once. Four bitplanes derived from thresholding that field's value at 4
binary-weighted cut levels (place values 1/2/4/8, i.e. 4-bit / 16-level output). Each plane
composited additively into an accumulator canvas as it "arrives."

**REAL NUMBERS:** 4 planes. Plane arrival interval: 350ms (plane 0 at t=0, plane 1 at t=350ms,
plane 2 at t=700ms, plane 3 at t=1050ms) — slow enough that each addition is a distinct visible
step, not a flicker. Full-stack hold: 900ms once all 4 planes are composited (clean final image
visible). Reset-and-rebuild: the accumulator clears and plane 0 reappears, full cycle length
350*4 + 900 = 2300ms. Field resolution: sampled at a grid derived from the container's smaller
dimension, `cell = clamp(round(minDim / 96), 4, 12)` px per sample, upscaled with no smoothing
between samples so each plane's threshold edge stays a visible hard boundary.

**the resting loop:** t0 — plane 0 just landed, coarse 2-tone silhouette only, most of the field
either fully off or fully on with a single hard edge. t2.5s — mid-cycle (2300ms period places
2.5s about one cycle plus 200ms in), 2-3 planes composited, visibly finer tonal banding than t0.
t5s — different phase again (5s is ~2.17 cycles in), likely near a full-stack hold or an early
plane, visibly distinct from both earlier states.

**the reduced-motion freeze frame:** freeze at plane 2 of 4 just landed (t=700ms equivalent,
NOT the full-stack hold and NOT plane 0 alone) — the frame that most clearly shows the mechanic
mid-cascade: coarse structure already visible, finer banding partially resolved, one more step
visibly pending.

**interaction:** none. Must not tie plane arrival to pointer position or scroll — the mechanic is
a fixed hardware compositing cadence, not a reveal-on-hover effect.

**light vs dark:** each plane's "on" state is drawn at a luminance step derived from
`--foreground`/`--background` mix (plane threshold levels map directly to the accumulator's
opacity toward `--foreground`), never accent; in light theme the lowest plane's silhouette is the
hardest to see against a light background, so raise the plane-0-only contrast floor (minimum 25%
mix toward `--foreground`) rather than letting it disappear at t0 in light mode.

**kill criteria:** if the 4-step cascade reads as generic "fade in" rather than distinct additive
stages (i.e. an observer sees smooth interpolation, not stepped plane arrivals), the hard
per-plane threshold edges need to be more aggressive, or the concept dies as a restyle of a
generic reveal transition.

**legibility:** the ONE thing to follow is a single hard edge from plane 0's silhouette staying
fixed while progressively finer banding fills in around it; the 350ms per-plane cadence and
900ms hold give the eye a clear beat to count "one more layer landed" four times per cycle.
