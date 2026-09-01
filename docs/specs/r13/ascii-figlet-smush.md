# ascii-figlet-smush — letterform collision resolved by rule

**Collection:** loud · **Surface:** CTA closing band (GAP-MAP open gap — closing
CTA band, **0 shipped**)

## 1. Surface + the real technique

**Surface replaced:** the **closing CTA band** — the full-width block at the foot of
a landing page carrying one large call-to-action line above the button. GAP-MAP
records zero components on this surface.

A banner headline is the right register for it, and figlet is what a banner headline
actually is. The button and its label are ordinary DOM beneath the band; the band
itself is the type.

**Real technique:** **FIGlet controlled smushing.** A FIGfont declares a `Layout`
bitmask of six rules that fire when two adjacent sub-characters would collide as
horizontal spacing goes to zero (figfont spec v2, 1994):

1. **EQUAL** — two identical sub-characters smush to that character.
2. **UNDERSCORE** — `_` is replaced by any of `| / \ [ ] { } ( ) < >`.
3. **HIERARCHY** — six classes, `|` < `/\` < `[]` < `{}` < `()` < `<>`; the higher
   class wins.
4. **OPPOSITE PAIR** — `[]` → `|`, `{}` → `|`, `()` → `|`.
5. **BIG X** — `/`+`\` → `|`, `\`+`/` → `Y`, `>`+`<` → `X`.
6. **HARDBLANK** — two hardblanks smush to one.

A pair with no legal smush **blocks** further overlap for that pair — which is why a
real figlet word compresses unevenly.

## 2. Nearest existing slug + why this is not a restyle

**Nearest:** `loud/text-ligature-melt` — "headline whose glyphs liquefy near the
cursor; an SVG gooey filter fuses neighbours into temporary ligatures that spring
apart on leave." Secondary: `core/hero-ascii-wordmark` and `loud/hero-recursive-type`.

`text-ligature-melt` is a **continuous raster effect on rendered glyph outlines** — a
blur-threshold gooey filter, pointer-driven, with no rule table and nothing discrete
happening. Here the merge is a **discrete published rule table over sub-character
cells**: `/` and `\` become the character `Y`, a codepoint that belongs to neither
neighbour. It is unbounded self-animation with no pointer involvement at all. The
two produce categorically different images — one is two letters melting into a
blob, the other is two letters resolving into a third letter.

Against `hero-ascii-wordmark` and `hero-recursive-type`: both treat a letterform as
a **bitmap** and vary what fills the lit cells. Here a letter is a stack of 6 rows
of drawing sub-characters and the mechanic lives entirely at the **seam between two
letters** — a location neither of those components has.

## 3. Mechanic — numbers

- **FIGfont:** a hand-authored 6-row "standard"-style figfont covering A–Z, 0–9,
  space, `!`, `.`, `-`, built **only** from the sub-characters
  `_ | / \ ( ) [ ] { } < > =` so every one of the six rules has something to fire
  on. Glyph widths 4–8 sub-columns. Hand-drawn, not a traced copy of a distributed
  figfont file.
- **Cell:** `cellH = 13px`, `cellW` measured (GeistMono 13px → 7.80px).
- **Grid at 720x480:** 92 sub-columns x 36 rows. The headline occupies 6 rows,
  centred vertically.
- **Smush pressure:** `s(t) = 1.5 + 1.5 * sin(2*pi*t / 6.4)`, range `[0, 3]`, period
  **6.4 s**. `s` is the number of sub-columns of overlap *attempted* between
  adjacent letters. Unconditional, no input, unbounded.
- **Per frame:** lay the headline out with `floor(s)` columns of attempted overlap
  and resolve every collision through rules 1–6 **in order**. A pair with no legal
  smush blocks further overlap for that pair only, so different letter pairs lock at
  different `s` — **the word breathes unevenly**, and that unevenness is the visible
  signature of real controlled smushing.
- **Sub-pixel:** `frac(s)` drives a `±0.5 * cellW` horizontal ease on each letter's
  origin so compression is smooth rather than a 7.8 px jump. The **characters** only
  ever change on integer `s`.
- **Fill ratio:** 6 rows x 92 columns = 552 cells. A 9-character headline at `s=1.5`
  occupies 61 columns x 6 rows with 41% of those cells inked → **15% of the panel
  grid lit, 85% empty**.
- **Ink, two states.** Original letterform strokes at C=7.0. A sub-character that is
  the **product of a smush this frame** lifts to C=16.0 for **220 ms** after it
  first appears, then decays to the base stop over a further **300 ms**. That decay
  is what makes each merge legible as an event rather than a state.

## 4. t=0s / 2.5s / 5s, no input

Seeded at t = 1.6 s of the 6.4 s period.

- **t=0s:** `s = 3.0` (peak) — the word is maximally compressed, 7 smush products
  lit, 3 letter pairs locked at their rule limit.
- **t=2.5s (phase 4.1 s):** `s = 0.62` — the word has expanded, no smushes active,
  every letter clearly separate.
- **t=5s (phase 0.2 s):** `s = 1.79` and rising, 4 fresh smush products flashing at
  the top stop.

## 5. Reduced-motion freeze frame

**Period phase 5.05 s, `s = 2.41` rising.** At `s = 2.41` the headline has 5 pairs
smushed, 2 pairs locked at their rule limit, and 2 pairs still separate — the
maximum number of *distinct seam states* in a single frame, which is the mechanic.

The peak (`s = 3.0`) is uniformly smushed and reads as one solid word; the trough is
plain spaced-out figlet text indistinguishable from a static banner. Both are worse
frames than the one chosen.

Byte-stable: `s` is a pure function of phase and the rule resolution is a pure
function of `floor(s)` and the authored figfont. No RNG.

## 6. Hue → luminance, both themes

Round-13 shared contrast ladder (see `INDEX-ascii.md`):

| stop | C | light α | dark α |
|---|---|---|---|
| 1 | 1.35 | 0.144 | 0.134 |
| 2 | 1.80 | 0.267 | 0.221 |
| 3 | 2.60 | 0.407 | 0.324 |
| 4 | 4.00 | 0.551 | 0.450 |
| 5 | 7.00 | 0.715 | 0.633 |
| 6 | 16.0 | 0.955 | 0.973 |

**Light theme is the hard case, specifically because the alphabet is thin strokes.**
The figfont's sub-character set is `| / \ ( ) [ ]` — at 13 px in light theme a `|`
drawn at α 0.715 has an effective stroke under one device pixel at dsf 1, and the
measured contrast collapses toward C≈3.0 instead of the intended 7.0. The headline
goes grey and mushy while dark theme looks correct. Therefore run light theme **one
stop hotter across the board**:

- **light:** base strokes at C=16.0 (α 0.955); smush flash decays to C=7.0
  (α 0.715) — **`--foreground` at a lower alpha, never `--ns-muted`**
- **dark:** base strokes at C=7.0 (α 0.633); smush flash at C=16.0 (α 0.973)

An earlier draft of this spec had the light-theme decay tail running through
`--ns-muted` at α 0.715. That is wrong and is corrected here: a `--ns-muted` wash has
a **theme-dependent ceiling** (8.45:1 light, 6.12:1 dark) so no single alpha over it
hits a shared contrast target, and at α 1.0 the two themes diverge by 38%. See
`INDEX-ascii.md` §4.1. Wherever the intent is "a lighter version of the ink," use
`--foreground` at a lower stop.

Check light theme first, not last — a build tuned on dark will ship an illegible
light headline. The smush flash is `--foreground` luminance only; `--ns-accent` must
not appear anywhere, and this is precisely the component where reaching for it on
the climactic moment would be tempting.

## 7. Font handling

**This is the most advance-width-sensitive component in the round-13 ASCII set,**
because a figlet letterform's shape depends on sub-characters landing in exact
columns.

- **Metric assumption:** GeistMono advance = `0.600 * fontSize` (±0.002), measured
  post `document.fonts.ready` via `ctx.measureText("MMMMMMMMMM").width / 10`, and
  every sub-character drawn at `x = col * cellW + cellW / 2` with
  `textAlign: "center"` — so a wrong advance shifts a stroke **within** its cell
  instead of accumulating a lean across 92 columns.
- **Fallback with a different advance:** Consolas at 0.550 → `cellW = 7.15`, 100
  columns instead of 92, headline 8% narrower in px. Harmless.
- **The real hazard is a non-monospace fallback,** where `|` and `/` have different
  advances and the letterforms shear. Assert at mount:
  `Math.abs(measureText("|").width - measureText("M").width) < 0.5`. If it fails,
  fall back to **drawing the sub-characters as vector line segments** in the same
  cells — the figfont resolution and the six smushing rules are unchanged, only the
  rasterization differs. Name this fallback path explicitly in the component; it is
  the one that keeps the mechanic intact when the type does not cooperate.
