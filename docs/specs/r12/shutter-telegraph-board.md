# shutter-telegraph-board

**tier:** core

**product surface it replaces:** ambient loader / decorative multi-stage status
indicator — the same bucket as `status-glyph-cadence`, but for a card that wants a
distinct, grid-based visual identity instead of a dot ring.

**the real mechanic:** the Admiralty shutter telegraph (Murray's six-shutter
telegraph, England, 1795-1816). A board of six louvred shutters, each independently
flipped between edge-on (near-invisible, reads as open sky/background) and face-on
(a large opaque black square), read from hilltop to hilltop through a telescope. Each
of the 63 possible open/closed combinations of the six shutters encoded a number or
common phrase from a codebook.

**one-sentence mechanic description:** six shutters flip open or closed in a rippling
cascade to form a new symbol on the board every couple of seconds.

**rendering approach:** DOM/CSS grid, 2 columns x 3 rows inside the card, geometry
sized from `min(width,height) / 4` per cell (square shutters with margin). Each
shutter is a `div` with `transform: perspective(...) rotateY(...)` (or `scaleX`)
animated between open and closed. No canvas needed. Colours via `getComputedStyle` +
`MutationObserver`, no literals.

**REAL NUMBERS:**
- Per-shutter flip duration: **320ms**, ease-in-out.
- Cascade stagger within one symbol change: **60ms** between adjacent shutters
  (reads left-to-right, top-to-bottom as a visible wave, not a simultaneous snap).
- Symbol dwell (fully settled, before the next symbol starts forming): **1.7s**.
- Full beat per symbol (stagger + dwell): ~1.7s + (5 x 60ms) = **~2.0s**.
- Sequence: an unbounded 8-symbol loop, ~16s per full cycle, then repeats.
- Open-shutter edge line: 1px, `--foreground` at 25% opacity (NOT `--border` — at
  ~1.1:1 in light theme `--border` would be invisible here, and this line is load-bearing
  for reading which cells are "open").

**the resting loop:**
- t0: a symbol fully settled, some mix of open/closed shutters.
- t2.5s: at least one full symbol change (cascade + dwell, ~2.0s beat) has
  completed since t0 — different open/closed pattern.
- t5s: two symbol changes visible — a third distinct pattern from both prior frames.

**the reduced-motion freeze frame:** `STATIC_TIME` pinned to symbol index 4 in the
8-symbol sequence — chosen because it has 3 open / 3 closed shutters (a checkerboard-
adjacent pattern), the maximum structural contrast of any symbol in the set, unlike
the all-open or all-closed symbols elsewhere in the sequence which read as a blank
board.

**interaction:** none — ambient only.

**light vs dark theme:** closed shutter = solid `--foreground` fill. Open shutter =
background showing through, edged with the low-opacity foreground line described
above (never `--border` as a fill or stroke, per the token rules). Check at card scale
in light theme first — the open/closed contrast is a straight foreground-vs-background
fill swap so it should hold in both themes without separate logic, but verify the
25%-opacity edge line stays visible (not washed out) against a light background.

**kill criteria:** if the flip cascade reads as a generic accordion/skeleton-loader
sweep with no telegraph identity (i.e. a reviewer can't tell it apart from a loading
skeleton at a glance), kill. If six shutters compress unreadably below ~100px card
height, kill — this component needs a minimum card size to keep its identity.

**legibility:** the one thing to follow is the staggered flip-wave crossing the 2x3
grid as a new symbol forms; cadence is a new symbol roughly every 2.0s, each
individual shutter's flip taking 320ms with the cascade's 60ms stagger making
departure (edge-on to face-on, or reverse) and arrival visibly sequential rather than
a simultaneous blink.
