# delta-frame-macroblock

**tier:** core

**product surface it replaces:** background band / divider (a quiet full-width strip behind or
between content, not a hero).

**the real mechanic, with source:** video codecs (MPEG/H.26x-class) don't re-send every pixel of
every frame. After an initial full (I-)frame, subsequent (P-)frames encode only the macroblocks
that changed, each tagged with a motion vector or a "skip, unchanged" flag; a decoder redraws
only the flagged blocks and leaves the rest of the frame buffer untouched. Scrub a codec's
per-block change map and you see a sparse, shifting set of highlighted blocks against a mostly
static field — exactly the compression artifact visible as "blockiness" in low-bitrate video,
made deliberate and visible here instead of being an unwanted defect.

**one-sentence mechanic description:** a grid of macroblocks sits mostly static, and on each
"frame" tick only a small, shifting subset of blocks is redrawn (flagged as changed, briefly
outlined), while every other block is explicitly left untouched — visualizing the skip-flag
decision itself, not just a redraw.

**rendering approach:** DOM grid or 2D canvas, macroblock grid derived from the container's
smaller dimension: `block = clamp(round(minDim / 16), 12, 24)` px square blocks, arranged in
rows/cols filling the container. Each block holds a static low-contrast base tone (a fixed
per-block luminance from a seeded noise field, drawn once). A "delta" pass runs on a timer,
selecting a small subset of blocks to redraw with a brief highlighted outline + a slightly
shifted tone (simulating the motion-compensated redraw), then fading the outline back to rest.

**REAL NUMBERS:** frame tick: every 220ms (a visualized codec P-frame interval — deliberately
slower than a real 24-30fps codec tick per the round 9 decoupling rule, so each delta event is
individually followable). Delta fraction: 6-10% of blocks flagged changed per tick (typical
P-frame sparse-update ratio). Flagged-block outline: appears instantly on the tick, holds at full
`--border`-weight for 140ms, fades over the next 200ms back to unoutlined. Block size 12-24px per
the geometry rule above; a 320px-wide card at 16px blocks holds a 20-block-wide grid.

**the resting loop:** t0 — a scatter of freshly-flagged blocks mid-fade from a recent tick,
static base grid otherwise unchanged since mount. t2.5s — roughly 11 ticks elapsed (220ms each),
a different scatter of blocks flagged, base tones in the previously-flagged blocks now settled at
their new values (visibly different subset than t0's pattern). t5s — a further ~11 ticks in,
different scatter again, cumulative tone drift visible in blocks that have been flagged multiple
times versus ones untouched since mount.

**the reduced-motion freeze frame:** freeze immediately after a tick with its outlines at full
strength (0ms into the 140ms hold, not mid-fade) — the frame that most clearly shows which
blocks are flagged versus static, before any fade softens the read.

**interaction:** none. Must not flag blocks near the pointer — the mechanic is a codec's own
change-detection decision, not a hover-responsive grid; a pointer-linked flag pattern would also
risk the accent-highlight failure mode called out in the showpiece recipe.

**light vs dark:** base block tones are a narrow luminance band around `--ns-muted`/
`--background` (small per-block value offsets, no hue), and the flagged-block outline uses
`--border` at full component-local opacity (not the ambient ~1.1:1 wash) so the outline itself
stays visible as a stroke without violating the separator-token rule; in light theme widen the
base per-block tone variance slightly (currently token-derived, so this is a multiplier on the
noise amplitude, not a new color) since subtle blocks wash out faster on a light background.

**kill criteria:** if the flagged/unflagged distinction isn't legible at rest (i.e. it reads as
generic grid noise rather than "these specific blocks just changed, those didn't"), the outline
and fade timing need to be more aggressive, or the concept dies — the whole point is the
skip-flag decision being visible, not a shimmering grid.

**legibility:** the ONE thing to follow is a single block's outline flashing on then fading over
~340ms total while its neighbors visibly don't; the 220ms tick cadence keeps successive flashes
distinct events a viewer can count, not a continuous shimmer.
