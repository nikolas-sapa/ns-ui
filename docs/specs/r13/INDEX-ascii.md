# INDEX-ascii — round 13 ASCII / glyph-grid slice

Scout: ascii surfaces. **Six specs delivered, not ten.** The kill ratio and the
reason for it are in §3; that finding is part of the deliverable.

---

## 1. Ranked

| # | Slug | Surface (GAP-MAP gap) | One-line justification |
|---|---|---|---|
| 1 | `ascii-thermal-history` | **footer signature block** (gap #1, 1 shipped) | Per-element temperature state that persists across lines with a 22 ms cooling constant — the only ASCII component in the registry whose cells carry stateful, causal, column-local memory instead of a stateless per-cell lookup, and it lands on the emptiest landing surface. |
| 2 | `ascii-double-height` | **testimonial band** (2 shipped) | VT100 DECDHL/DECDWL: three different cell metrics coexisting in one grid at one instant, where promoting a line *changes what fits* — no component here has rows with different cell sizes. |
| 3 | `ascii-charset-shift` | **feature grid / comparison table** (gap #5, 6 shipped) | SCS `ESC ( 0` remaps the same bytes to box-drawing, so the table's rules and junctions *are* the prose in its cells — the grid earns being a grid, which GAP-MAP §4 names as the exact miss. |
| 4 | `ascii-figlet-smush` | **CTA closing band** (**0 shipped**) | FIGfont controlled smushing: a published discrete rule table where `/`+`\` resolves to the character `Y` — character-level merge-on-collision, which nothing here does, pointed at the only landing surface with zero components. |
| 5 | `ascii-chain-slew` | **logo wall** (gap, 1 shipped) | IBM 1403 chain printer: a page that prints in alphabetical order, with **zero translation anywhere in the component** — glyph identity, not position, is the ordering key. |
| 6 | `ascii-glyph-match` | **gallery / media tile** (12 shipped) | Structure-based ASCII (Xu/Zhang/Wong 2010): the glyph is chosen by rasterized *shape* match, so selection is non-monotone and the alphabet is discovered from the resolved font rather than authored. **Read its ownership note before ranking — see §6.** |

Ranking rationale: 1–3 are technique-first and clear the non-restyle bar on a
mechanism no sibling has (thermal state, mixed cell metrics, charset remap). 4 is
equally clean on mechanism but sits on a smaller surface. 5 is ranked below them
because it shares an *ordering principle* with `convert-matrix-return` in this same
round — see the tie-break test written into its §2, and cut it if the orchestrator
would rather keep one. 6 has the strongest mechanism in the set on its own merits
and would otherwise rank 1; it is placed last **only** because it is the one spec
here not aimed at an empty landing surface, and because its ownership needs a
decision before it is worth building (§6).

---

## 2. What all ~73 existing ASCII slugs share

One sentence, and it holds for every one of them: **each simulates or samples a
scalar field, maps that scalar through a monotone density ramp string to pick one
glyph per cell of a single uniform lattice, and keeps 85–97% of cells empty.**

Unpacked, the five invariants that make them one family:

1. **One scalar per cell.** The cell→glyph function is a 1-D map. `background-ascii-
   plasma`, `hero-ascii-terrain`, `kamacite-etch`, `rosensweig-crest`,
   `background-ascii-caustics`, `ascii-engraving-contour` differ only in what
   produces the scalar.
2. **A monotone ramp string,** almost always `" .:-=+*#%@"`, indexed by
   `floor(v * (ramp.length - 1))`. The alphabet is authored and ordered by
   darkness, so a diagonal edge stair-steps through it.
3. **One uniform lattice** for the whole canvas, cell size set once per resize from
   `measureText("MMMMMMMMMM") / 10`, and every cell the same size forever.
4. **Sparsity as the aesthetic:** a gamma or a threshold pushes the field's floor to
   the space glyph so the grid stays mostly bare paper.
5. **One glyph per cell, drawn once,** with alpha as the only sub-ramp modulation.

The family's *own* internal differentiators are already spent: two-state cells
(`divider-petscii-vu`), sub-cell addressing at 2x4 (`loader-braille`,
`empty-state-braille-orbit`), 2x3 (`divider-teletext-mosaic`, `divider-mosaic-split`),
2x2 (`hero-404-quadrant-occlusion`) and 3-stripe (`cursor-subpixel-fringe`);
subtractive build (`empty-state-mezzotint`); error diffusion (`loader-ascii-diffuse-
fill`); blue noise (`nav-blue-noise-scrim`); ordered Bayer (`background-ascii-dither`
plus the six-member dithered chart family); glyph-as-geometry (`hero-beam-glyph`,
`hero-recursive-type`, `hero-glyph-silhouette-pack`, `background-text-branch-canopy`).

So the honest statement of the bar: **"which field" is dead, and "which glyph grid"
is nearly dead.** What is left is a component whose *cells behave differently* —
carrying state, carrying different metrics, or being re-interpreted rather than
re-valued. All five survivors are one of those three.

---

## 3. Killed, and by what

Thirty candidates were generated; twenty-four died. Ten reached full draft. The
specific slug that killed each:

| Killed concept | Killed by |
|---|---|
| Riemersma / Hilbert-curve error diffusion | `docs/specs/r13/hero-hilbert-diffuse.md` — same algorithm, same 16-entry exponential queue. |
| line-printer overstrike (multi-glyph composite per cell) | `core/nav-overstrike-typewriter` — already composites 1–3 `fillText` passes into one cell, explicitly as typewriter overstrike. My core claim ("nothing composites >1 glyph per cell") was simply false. |
| 9-pin NLQ double-strike at half-dot offset | `core/progress-nlq-overstrike` — the identical mechanic, two lattices a half pitch apart, already named as its signature. |
| xerographic generation loss / feedback resample | `loud/photostat-reverse` (five compounding generations of line-art loss) + `core/toner-fuse-streak`. |
| carbonless multipart form (three plies) | `core/slug-field-mirror` — a "carbon copy" duplicate sheet offset beneath a receipt. |
| Hollerith 12-row punched card | `core/jacquard-card-chain` + `core/sorter-pocket-route` + `core/punch-figure` + `core/punch-patch`. Punched-card territory is four deep. |
| daisywheel / Selectric typeball seek order | `docs/specs/r13/hero-typeball-tilt.md`. |
| Atkinson dithering | `core/loader-ascii-diffuse-fill`. Same loop shape, different kernel weights; error non-conservation is real but visually adjacent, and the concept could not name what a viewer sees that FS does not. |
| Knuth dot diffusion (class matrix) | Same test, same failure. Its design goal was to *look like* error diffusion; a mechanic whose stated virtue is being indistinguishable cannot be a component's identity. |
| Unicode box-drawing junction weight algebra | `core/diagram-ascii-flow` already resolves a cell's glyph from a 4-direction neighbour tuple per frame, and `core/container-box-drawing` already upgrades a border to double-line weight. Adding weight to the tuple extends an existing resolver. |
| plotter pen-lift / single-stroke vector type | `loud/hero-beam-glyph` (Hershey single-stroke, dwell-based brightness). |
| dot gain / ink spread | `core/card-dot-gain-screen`. |
| clustered-dot ordered dither (spiral matrix) | `loud/background-halftone-rosette` + the dithered chart family, which GAP-MAP §5 lists as **explicitly closed**. |
| 8-level punched paper tape | Folded into the punched-card kill above; strictly weaker. |
| half-line-feed vertical two-plane offset | Folded into the NLQ kill; the offset axis is the same one `progress-nlq-overstrike` owns. |
| ribbon exhaustion / re-ink reversal | Not a rendering technique — a global density drift with no per-cell consequence. Too thin to carry a component. |
| mimeograph stencil counter fill-in | Overlaps the photostat/toner kill on the same "reproduction degrades" axis. |
| refreshable braille display pin travel | Restyle risk against `loader-braille` and `empty-state-braille-orbit`; the discriminator was hardware framing, not a different image. |
| variable-width / proportional cell packing | No real technique behind it; invented, which is the `footing-course` failure mode. |
| bitmap-font fractional-scale shimmer | `docs/specs/r13/hero-stem-snap.md` (TrueType grid-fitting) owns stem quantization. |
| incommensurate two-lattice rescreening moiré | `loud/background-halftone-rosette` owns same-ink moiré between two screens. |
| terminal damage-region partial repaint | `core/chargen-rom-slice` (row-at-a-time chargen ROM fetch). |
| CJK double-width cell packing | Folded into `ascii-double-height`, which is the same "mixed cell widths" mechanic with a real control sequence behind it. |
| greenbar fanfold perforation crossing | Adjacent to `core/banner-tear-stub` (perforated tear) and to the punched-card feed kill; the fold alone is not a rendering technique. |

None of the five survivors appears in GAP-MAP §6's 59-slug removed ledger or its
23 quarantined r10–r12 slugs, and none touches an explicitly-closed category
(dithered charts, preloader/curtain, 404, knot geometry, rotating-word slot). No
r10/r11/r12 spec is cited as a positive model anywhere in this slice.

---

## 4. Shared luminance ladder — the numbers every spec references

Every spec's §6 refers to this table. It exists because "invert cleanly" is not an
answer, and because the same alpha in the two themes does **not** give the same
perceived weight.

**Token luminances** (sRGB relative luminance `Y`, computed from the hex in
`app/globals.css`):

| token | light hex | Y | dark hex | Y |
|---|---|---|---|---|
| `--background` | `#ffffff` | 1.0000 | `#0a0a0a` | 0.00304 |
| `--foreground` | `#171717` | 0.00860 | `#ededed` | 0.84690 |
| `--ns-muted` | `#4d4d4d` | 0.07423 | `#8f8f8f` | 0.27461 |
| `--border` | `#ebebeb` | 0.83081 | `#2e2e2e` | — |

`--border` against `--background` in light theme is **1.19:1** (corrected — see
§4.2). That is the measured reason it is invisible as a fill or stroke, and why
every spec here uses a `--foreground` wash at stop 1 (1.35:1) where a hairline is
needed instead.

**The ladder.** Pick six target contrast ratios against the page —
`C = [1.35, 1.80, 2.60, 4.00, 7.00, 16.0]` — and solve for the canvas alpha that
hits each, **in encoded sRGB space**, because `ctx.globalAlpha` composites in the
encoded space, not in linear light. Solving in linear light (the intuitive way) is
wrong by up to 0.13 alpha at the middle stops.

Light: `result_encoded = 255 - a * 232`. Dark: `result_encoded = 10 + a * 227`.

| stop | target C | light α | dark α |
|---|---|---|---|
| 1 | 1.35 | **0.144** | **0.134** |
| 2 | 1.80 | **0.267** | **0.221** |
| 3 | 2.60 | **0.407** | **0.324** |
| 4 | 4.00 | **0.551** | **0.450** |
| 5 | 7.00 | **0.715** | **0.633** |
| 6 | 16.0 | **0.955** | **0.973** |

Read the table's shape, not just its values: the light column is **higher at every
stop below the top**, and the gap is widest in the middle (0.551 vs 0.450 at C=4).
A ramp tuned on dark and reused in light lands roughly one stop too pale at the
bottom and washes its low end into the paper — which is the specific failure the
brief flags for glyph grids. Three specs additionally run **theme-asymmetric**
ladders (`ascii-double-height`, `ascii-charset-shift`, `ascii-figlet-smush`) for
reasons stated in each: large ink areas crush on white, and thin strokes collapse on
white, in opposite directions.

`--ns-accent` appears in none of the six, on any resting or climactic frame.

**Every value above round-trips.** Feed `a` back through the forward formula and it
returns its target C to three decimals. Any future edit to this table must pass that
round-trip — see §4.2 for what happens when it is skipped.

### 4.1 Scope of the ladder — it governs `--foreground` over `--background`, nothing else

Confirmed, and I am glad scout-hero raised it: **the ladder is only valid when the
ink is `--foreground` and the paper is `--background`.** A `--ns-muted` wash is
outside it and cannot be reasoned about against a contrast target at all. The
numbers:

| `--ns-muted` wash alpha | light C | dark C | spread |
|---|---|---|---|
| 0.4 | 1.99 | 1.89 | 5% |
| 0.6 | 3.03 | 2.86 | 6% |
| 0.8 | 4.91 | 4.26 | 15% |
| **1.0 (ceiling)** | **8.45** | **6.12** | **38%** |

Two consequences, both hard:

1. **The ceiling is theme-dependent** — 8.45:1 light vs 6.12:1 dark. The two curves
   track within ~6% below α 0.6 and then diverge, which is exactly why the defect
   hides: a builder tunes a mid-strength wash, it looks fine in both themes, and it
   only breaks when someone later strengthens it.
2. **Dark theme cannot reach stop 5 at all.** 6.12 < 7.00, so no alpha over
   `--ns-muted` hits C=7.0 in dark theme, and nothing reaches stop 6 in either
   theme. A spec asking for a "strong muted wash" is asking for a value that does
   not exist.

**Rule: wherever the intent is "a lighter version of the ink," use `--foreground` at
a lower stop, never `--ns-muted` at an alpha.** `--ns-muted` is legitimate at *full
strength* as a distinct second ink (that is what `empty-state-mezzotint` and
`empty-state-braille-orbit` do — muted base at fixed alpha, foreground overlay on
top), and illegitimate as a variable-strength wash. One of my own specs had this
defect: `ascii-figlet-smush` ran its light-theme decay tail through `--ns-muted` at
α 0.715. Corrected in place, with the reason recorded in the spec.

I support making this round-wide. It explains a defect class the project has been
treating as individual component bugs.

### 4.2 Corrections — two cells were wrong, both mine

scout-hero's independent solve is right on both disputed cells. Corrected above.

| cell | I published | correct | what mine actually delivered |
|---|---|---|---|
| `--border` vs light `--background` | 1.26:1 | **1.19:1** | — |
| light stop 6 (target C=16.0) | α 0.929 | **α 0.955** | 14.85:1 |

Three smaller rounding fixes applied at the same time: light stop 4 `0.552 → 0.551`,
light stop 5 `0.716 → 0.715`, dark stop 4 `0.449 → 0.450`, dark stop 6
`0.974 → 0.973`.

**Why the two solves differed — it is not a colour-space disagreement.** My
luminance values and my encode step are identical to scout-hero's to five decimals,
which is precisely why we agreed on five of six light stops and on all six dark
stops. Both errors are downstream of that, in the light column only:

- **`--border`:** I omitted the `+0.05` offset on the *darker* term, computing
  `1.05 / 0.83077` = 1.264 instead of `1.05 / (0.83077 + 0.05)` = 1.192. A
  reconstructible, nameable slip.
- **light stop 6:** an arithmetic slip in the final inversion
  `a = (255 − e) / 232`. I had the encoded target right (33.5) and the division
  wrong. I cannot reconstruct how 221.5/232 became 0.929 from the record, and I am
  not going to invent a cause — the honest statement is that the light column's
  inversion has a different form from the dark column's (`(e − 10) / 227`), I ran it
  by hand six times, and slipped on the one stop where the subtraction is smallest.

**The durable fix is the check, not the number.** Neither error would have survived
a round-trip: substitute `a` back into the forward formula and compare against the
target C. I had not run it. It is now run for all twelve cells (all pass to three
decimals) and stated above as a requirement for any future edit. That check is worth
more to the round than the two corrected values, because both wrong values looked
entirely plausible — which is how they got published and cited.

### 4.3 Unrealizable cues — the check the ladder was missing

scout-hero's `justify-river` finding names a category the ladder could not previously
express, and it should be a first-class check. A cue is **unrealizable**, not
miscalibrated, when it asks for contrast in a direction its substrate has none left
in. No alpha exists; retuning cannot fix it; the cue has to move to a different
element.

**The check, before choosing any stop:** identify the cue's substrate and direction,
then compute the headroom ceiling
`C_max = (Y_lighter + 0.05) / (Y_darker + 0.05)` for the extreme the cue is heading
toward. If the target C exceeds `C_max`, stop — the ladder has no answer.

Measured headroom for the four substrates in this token set:

| substrate | direction | ceiling | usable? |
|---|---|---|---|
| `--foreground` ink on paper | darken (light) / brighten (dark) | 17.93:1 / 16.91:1 | yes — the whole ladder fits |
| paper toward pure white, **light theme** | lighten | **1.000:1** | **no — zero headroom** |
| paper toward pure black, **dark theme** | darken | **1.061:1** | **no — below stop 1** |
| `--ns-muted` wash | either | 8.45:1 / 6.12:1 | partial — stops 1–4 only (see §4.1) |

So a cue carried by making paper *more* paper is unrealizable in **both** themes:
light theme has literally nothing above `#ffffff`, and dark theme's entire remaining
range (1.06:1) sits below stop 1. `justify-river`'s fix — carry the cue on the
river's **banks**, which are ink and have the full 17.93:1 to spend — is the general
remedy: **when the substrate is paper, move the cue to the adjacent ink.** A river,
a gutter, a gap, a knockout and a hole are all paper, and none of them can carry a
value cue on their own.

## 5. Honest note on count

The brief asked for 10 and authorised fewer. Six is what clears the bar. Three
things drove the ratio, in order of size: 73 sibling ASCII slugs plus ~40 more in
the print/reproduction cluster that do **not** carry the `ascii` tag and were
invisible to a tag-based enumeration; one of my strongest concepts landing on a
technique a sibling scout specced in the same round; and the GAP-MAP finding that
"which glyph grid" is nearly as closed as "which field."

**Process finding worth carrying into the next round:** my first enumeration used
the `ascii` tag and found 87 items. That missed roughly 40 print/reproduction slugs
carrying no `ascii` tag — `nav-overstrike-typewriter`, `progress-nlq-overstrike`,
`photostat-reverse`, `toner-fuse-streak`, `slug-field-mirror`, `punch-figure`,
`sorter-pocket-route`, `card-dot-gain-screen` and more — which killed six concepts
on a second pass after they were already drafted. A tag-based enumeration is not
sufficient for a mechanic family this diffuse; a description-level keyword sweep
over all 534 registry items is. That miss cost two rounds of rework.

The remedy applied, per the team lead's redirect: five of six point the technique at
an **empty landing surface** — footer (1 shipped), testimonial (2), feature grid (6),
CTA closing band (0), logo wall (1) — rather than adding a sixteenth ASCII hero or a
fifteenth ASCII background. `ascii-glyph-match` is the exception, at gallery (12),
and it is the exception on purpose: forcing shape-matched glyph rendering onto a
marquee or a footer to hit an empty bucket would be answering the *category* by
invention, which is the documented `footing-course` / `gel-wash` failure mode. Its
honest surface is a media tile, so that is where it is aimed.

---

## 6. `ascii-glyph-match` — ownership, and why it nearly vanished

This needs an explicit decision from the orchestrator, because the concept was
specced twice in round 13 and withdrawn twice, and briefly existed nowhere.

Sequence, plainly:

1. I drafted `ascii-glyph-match.md` and wrote it to disk.
2. I then saw `docs/specs/r13/hero-glyph-correlate.md` — scout-hero's spec for the
   same Xu/Zhang/Wong shape-correlation mechanic, aimed at a hero wordmark —
   concluded scout-hero owned it, and **deliberately deleted my file**. It was not
   lost to the API error that ended my first run; I removed it on purpose.
3. scout-hero independently read my file before I deleted it and withdrew
   `hero-glyph-correlate.md` on the thinner-bucket rule.
4. Both scouts yielded to the other. Neither spec was on disk.

It is restored here on my side for one reason only: scout-hero aimed it at a **hero
wordmark** (48 shipped, the registry's most crowded bucket) and I aim it at a
**gallery / media tile** (12 shipped). Same technique, thinner bucket, and the
nearest existing slug — `gallery-ascii-gradient-orientation` — sits on my surface,
which makes the non-restyle argument tighter and testable against a real neighbour
rather than a distant one.

**If the orchestrator prefers the hero framing, restore scout-hero's version and
delete mine. Ship exactly one.** The mechanism is worth building either way; two
specs for it is the only outcome that would be wrong.
