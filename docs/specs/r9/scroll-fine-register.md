# scroll-fine-register

**tier:** core

**product surface it replaces:** divider / footer band with a subtle "content is streaming past"
motion cue.

**the real mechanic, with source:** hardware tilemap scrolling (NES/SNES-class PPUs) does not
move pixels directly — it moves through two cooperating registers. A coarse register steps the
visible window one whole tile (8px) at a time by swapping which tile is addressed; a fine
register sweeps 0-7 sub-pixel offsets within the current tile before the coarse register ticks
over. The visible effect is a smooth pixel-by-pixel scroll built from a sawtooth (the fine
register ramping 0→7 then snapping to 0) gating a stepped counter (the coarse register
incrementing once per sawtooth cycle).

**one-sentence mechanic description:** a strip of tile-sized glyphs scrolls by continuously, but
the motion is visibly built from a repeating 8-pixel sawtooth sweep with a small numeric readout
of the coarse tile index and fine sub-pixel offset ticking alongside it, so the two registers
driving the scroll are legible, not just the resulting motion.

**rendering approach:** DOM, a horizontal strip of monospace tile glyphs (each an 8-16px square
cell sized off the container: `cellPx = clamp(round(minDim / 24), 8, 16)`) inside an
`overflow-hidden` track, translated via a CSS custom property updated in a rAF loop; a small
adjacent numeric readout (`--foreground` text, tabular-nums) shows `coarse` and `fine` as plain
numbers.

**REAL NUMBERS:** fine register sweep: 0 to `cellPx - 1` over 480ms (a full tile scroll takes
480ms → ~1 tile every half second, i.e. legible per-step motion, not a blur). Coarse register
increments by 1 every 480ms, wrapping at the strip's tile count (looping the content). Strip
holds 24-40 tile glyphs depending on container width so the wrap is far off-screen and not
visible as a seam. Sub-pixel step granularity: 1px (matches an 8px cell, 8 discrete fine values
0-7).

**the resting loop:** t0 — fine register mid-sweep (e.g. value 3 of 0-7), content offset a
few px into the current tile, coarse counter at its current value. t2.5s — roughly 5 full
480ms cycles elapsed, coarse counter has advanced ~5, content has visibly scrolled several tile
widths, fine register at a different phase than t0. t5s — coarse counter roughly 10 higher than
t0, continuing to advance, never resetting except at the far-off strip wrap.

**the reduced-motion freeze frame:** freeze at fine = 0, coarse = a fixed mid-strip value (e.g.
12) — the one instant where a tile boundary is exactly aligned with the viewport edge, which is
the most structured, "just ticked over" frame and reads as a clean grid rather than a blurred
mid-sweep image.

**interaction:** none. Must not scrub the scroll with pointer drag — the mechanic is a fixed-rate
hardware register cadence, not a carousel; adding drag-to-scrub would misrepresent the mechanic
and invite exactly the kind of pointer-driven accent highlight the round 9 notes warn against.

**light vs dark:** tile glyphs and the coarse/fine readout are drawn in `--foreground` at full
opacity against `--background`; the current-tile cell (the one the fine register is sweeping
through) gets a `--border`-weight outline, never a fill, so it stays legible without introducing
a color read that would need re-checking per theme.

**kill criteria:** if the coarse/fine readout reads as decorative debug text rather than
something a viewer connects to the visible scroll motion (i.e. it could be deleted with zero
loss of legibility), the numeric readout should be cut and the component reconsidered — a plain
smooth-scroll marquee with no register readout is a restyle of nothing new.

**legibility:** the ONE thing to follow is the fine register's sawtooth — a single tile visibly
sliding left over 480ms before snapping back to a fresh tile at the front — paired with the
coarse counter incrementing once per sawtooth, so a viewer can tie the numeric tick directly to
the visual snap.
