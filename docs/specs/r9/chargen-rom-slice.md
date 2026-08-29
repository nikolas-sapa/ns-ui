# chargen-rom-slice

**tier:** core

**product surface it replaces:** loader / status glyph moment (a small area that needs to show
"content is being composed", not a full loading bar).

**the real mechanic, with source:** 1970s-80s CRT text-mode terminals (VT100-class, Commodore,
Apple II) store each glyph as an 8x8 or 8x16 bitmap in a character-generator ROM. The video
controller doesn't fetch a whole glyph at once — it reads the ROM one scanline row at a time, in
sync with the CRT's horizontal beam, and that single row of bits gets shifted out across the
screen before the beam drops to the next row and the ROM is addressed again for the next slice.
A glyph is only ever "whole" for an instant, once per frame; every other instant it is a stack of
independently-fetched horizontal slices.

**one-sentence mechanic description:** each glyph in a short text string is built top-to-bottom
from horizontal ROM slices arriving on a scanline sweep, so at any instant most on-screen glyphs
are partially assembled — a clean row of bits sitting above a gap where the next slice hasn't
been fetched yet — before the sweep completes and the whole string briefly reads clean.

**rendering approach:** 2D canvas (or DOM with clip-path bands — canvas preferred for pixel-exact
slicing). Grid: derive cell height from the container's smaller dimension,
`cellPx = clamp(round(minDim / 20), 8, 16)` px square-ish cells, glyphs drawn from a fixed 8-row
bitmap pattern per character (a small embedded 5x8 or 8x8 bitmap font subset covering the demo
string, not the system font — the ROM-slice read must be able to reveal partial rows, which
needs bitmap control a vector font glyph doesn't give).

**REAL NUMBERS:** sweep rate: one scanline row revealed every 35ms (≈28 rows/s — a deliberately
slow, visualized sweep per the round 9 decoupling rule, not a literal hardware refresh rate).
Glyph height 8 rows → one glyph fully assembles every 280ms; a 6-character string assembles
left-to-right, staggered 60ms per character start, so the whole string completes roughly every
580ms. Full-clean hold: 500ms once assembled before the sweep resets to row 0 and rebuilds. Cell
size 8-16px per the geometry rule above.

**the resting loop:** t0 — string mid-sweep, roughly half the glyphs show only their top 3-5
rows with a hard-edged gap below. t2.5s — several sweep cycles in (~580ms period), a different
phase of the same rebuild, string momentarily fully clean during a hold. t5s — mid-sweep again,
different phase from t0 (not perfectly periodic-looking because the 60ms per-character stagger
drifts the visible pattern against the ~580ms full cycle).

**the reduced-motion freeze frame:** freeze at the moment 3 of 6 rows are revealed (mid-sweep,
NOT the clean 180ms hold and NOT t0's empty state) — the frame that most legibly shows the
mechanic itself: some glyphs whole, the current one half-built with a visible slice edge, later
ones still empty.

**interaction:** none required; if added, a hover/focus on the string may restart the sweep from
row 0 once, but must not tie sweep position to pointer motion — the mechanic is a fetch cadence,
not a wipe-reveal effect.

**light vs dark:** each revealed row is drawn at full `--foreground` on `--background` (1-bit,
no anti-aliasing, matching real character-ROM output) so contrast is identical in both themes;
the unrevealed gap below the sweep line is simply absent pixels (background shows through), which
reads correctly in both themes without any separate token.

**kill criteria:** if the per-row reveal is too fast to distinguish from a generic fade/wipe
(i.e. an observer can't tell it's discrete horizontal slices, not a mask animation), this is a
restyle of an existing text-reveal component and should die.

**legibility:** the ONE thing to follow is a single glyph's hard-edged horizontal seam moving
down through its 8 rows; at 35ms/row (~280ms per glyph) and a 500ms hold before reset, the eye
gets a full quarter-second to track one glyph's build and read the clean string, well clear of
the 130ms overflow-chip-mux failure this round's notes call out.
