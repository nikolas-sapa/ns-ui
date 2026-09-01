# justify-river — section-scale type background

## 1. Surface + real technique

**Surface:** section-scale generative background — a full-width band of justified type sitting
behind a section header / feature intro.

**Technique:** **Knuth–Plass line breaking** (TeX's total-fit algorithm) — glue with natural,
stretch and shrink widths; adjustment ratio `r`; badness `b = 100·|r|³`; fitness classes and
adjacent-class demerits — and the typographic defect it produces, the **river**: a chain of
interword spaces on consecutive lines that line up vertically into a visible white channel.

## 2. Nearest existing slug + why this is not a restyle

**Nearest: `hero-text-ring-funnel`.** Secondary: `background-text-branch-canopy`, `press-register`.

Both `hero-text-ring-funnel` and `background-text-branch-canopy` place readable text **along a
geometry that is given in advance** — concentric perspective rings, L-system limbs — and the type
is a drawing material for that shape. Nothing is drawn here but an ordinary justified paragraph in
a rectangle: the geometry is **emergent**, produced by the line breaker's own glue distribution,
and it changes because the measure changes, not because a shape is being traced.

Second, and more decisive: the inked subject is **negative space**. A river is the *absence* of
ink; it has to be shown by modulating the paper, never by drawing a stroke. No component in the
registry inks an absence — `press-register` and `carbon-ply-fade` both add ink; `empty-state-
mezzotint` removes ink from a solid plate but the plate is the subject, not the removal path.

## 3. Mechanic

**Corpus.** ~1,100 words of neutral placeholder text shipped as a constant. Word widths measured
once with `measureText` after `document.fonts.ready` into a `Float32Array`, so layout never
depends on fetched content or on a font that has not loaded.

**Measure breathes** (two incommensurate periods, so it never repeats):
```
M(t) = M0 * (1 + 0.085*sin(2πt/17.0) + 0.031*sin(2πt/5.3)),   M0 = 0.86*w
```

**Glue.** Natural **0.333em**, stretch **0.166em**, shrink **0.111em** — TeX's `\fontdimen` 2/3/4
defaults for a normal space.
`r = (needed − natural) / (stretch if needed>natural else shrink)`;
`b = min(10000, round(100·|r|³))`.

**Break.** Real Knuth–Plass dynamic programming over the word list.
`demerits = (10 + b)² + 3000·[fitness class of this line differs from the previous by > 1]`,
five fitness classes as in TeX (tight `r < −0.5`, decent, loose, very loose `r > 1`).
Cost measured target ~4ms over 1,100 words with ~34 active breakpoints. **Recompute at most every
240ms**, never per frame, and cross-dissolve the old line set into the new over **260ms** so the
paragraph never jump-cuts.

**River detection — the payload.** For each interword gap record centre `xc` and width `gw`. Link a
gap on line *i* to a gap on line *i+1* when
`|xc(i) − xc(i+1)| < 0.62 · (gw(i) + gw(i+1)) / 2`.
Chains of **≥ 3 lines** are rivers. Each river is traced as a ribbon through the chain's gap
centres (quadratic through points), width = the **minimum** `gw` along the chain — but **the
ribbon itself is never painted.** A river is already paper and has no ink to modulate (see the
defect note in §6). The cue is carried on the river's **banks**: words within `0.62 * gw` either
side of the ribbon are drawn **one ladder stop up** from the body text, so the channel reads as a
pale gap between two darker banks. Identical in both themes, no direction inversion.

**Aliveness.** Because `M(t)` breathes ±8.5% and the DP's fitness-class penalty makes it
hysteretic, rivers continuously nucleate, extend by a line, and snap. Measured targets: **2–6 live
rivers at any instant, mean river lifetime ≈ 4.4s**, and the break set changes on roughly 60% of
the 240ms recomputes.

**The type itself.** Drawn per word with `fillText` at its justified x — the glue widths you see
are literally the algorithm's output. Ink is `--foreground` at **ladder stop 2** (§6) — this is
background, not content. Canvas is `aria-hidden`; the real section heading is DOM above it.

## 4. t=0 / 2.5s / 5s, zero input

- **t=0** — `M = M0`; 3 rivers, longest 4 lines; mean badness ≈ 95.
- **t=2.5s** — `M = M0·(1 + 0.085·sin(0.924) + 0.031·sin(2.963)) = M0·1.0685`, a 6.9% wider
  measure; ~4 of the 38 lines have rebroken; one river has grown to 6 lines and one has snapped.
- **t=5s** — `M = M0·(1 + 0.085·sin(1.848) + 0.031·sin(5.927)) = M0·1.0711` — almost the same
  measure as t=2.5s, but a **different breakpoint set**, because the adjacent-fitness-class
  penalty makes the DP hysteretic. The river map is visibly unrelated to t=2.5s despite a nearly
  identical column width, which is the clearest possible demonstration that this is a real
  algorithm and not a width animation.

## 5. Reduced-motion freeze frame

`STATIC_TIME = 11.4`.

`M(11.4) = M0·(1 + 0.085·sin(4.213) + 0.031·sin(13.514)) = M0·0.953` — the **narrowest measure of
the first cycle**. A narrow measure against a fixed 0.333em natural space forces the largest
adjustment ratios, so mean badness rises to a measured target of **≈ 340 (vs ≈ 95 at M0)**, and
that is exactly when rivers are **longest and widest** — the frame in which the component's
subject is most visible. t=0 is the low-badness case where rivers are short and narrow and the
band reads as plain grey type. Computed from the constant; byte-stable.

## 6. Hue → luminance, both themes

Weights are **not derived here.** They are taken from the six-stop ladder in
`INDEX-ascii.md` §4, which solves canvas alpha for target contrast ratios
`C = [1.35, 1.80, 2.60, 4.00, 7.00, 16.0]` in **encoded sRGB**, because `ctx.globalAlpha`
composites in the encoded space rather than in linear light.

| stop | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---:|---:|---:|---:|---:|---:|
| target C | 1.35 | 1.80 | 2.60 | 4.00 | 7.00 | 16.0 |
| light α | 0.144 | 0.267 | 0.407 | 0.552 | 0.716 | 0.929 |
| dark α | 0.134 | 0.221 | 0.324 | 0.449 | 0.633 | 0.974 |

All washes below are `--foreground` over `--background` at a ladder alpha. **`--ns-muted` is not
used as a wash anywhere in this spec any more:** it is a different token with its own luminance
(measured 8.45:1 in light, 6.12:1 in dark at full strength), so `--ns-muted` at an alpha lands on
an uncontrolled ratio that differs between themes. Where the intent is "a lighter version of the
ink", the correct expression is `--foreground` at a stop.

### Defect found by this pass — the old river cue was unrealizable in **both** themes

The previous §6 rendered a river as a change in the **paper**: "+0.10 L whiter than white paper"
in light, "−0.12 L darker than dark paper" in dark. Neither is achievable, and the ladder solve is
what surfaced it:

- Light `--background` is `#ffffff`, Y = 1.0. There is **nothing lighter**; the ceiling is
  literally 1.000:1.
- Dark `--background` is `#0a0a0a`, Y = 0.00304. Pure black against it is **1.06:1** — below
  `--border`'s 1.19:1, i.e. invisible.

A river is already paper, so there is no ink to add or remove inside it. **The fix, and it is
how a typographer actually sees a river: carry the cue on the river's banks, not on the river.**
Within `0.62 * gapWidth` either side of the ribbon, the bounding words step **up one ladder stop**;
the channel itself is left untouched. The river reads as a pale gap between two darker banks,
which works identically in both themes and needs no direction inversion at all.

This changes how the payload is drawn, not the mechanic: detection, the 0.62 linking rule, the
≥ 3-line chain threshold, `M(t)`, the DP and `STATIC_TIME = 11.4` are all untouched.

| element | stop | light α | dark α | was | measured before |
|---|---:|---:|---:|---|---|
| body type (background prose) | 2 | 0.267 | 0.221 | `--ns-muted` 0.44 / 0.38 | 2.15:1 vs 1.81:1 (1.19x) |
| river bank (one stop up) | 3 | 0.407 | 0.324 | — (cue was on the paper) | unrealizable |
| hovered river bank (two stops up) | 4 | 0.552 | 0.449 | — | unrealizable |
| river channel | — | no ink | no ink | ±0.10–0.19 L on paper | unrealizable |

**Calibration note.** The body type was close to right — 2.15:1 light against 1.81:1 dark, a 1.19x
spread, both landing on stop 2 — so the type ink is a small correction. The river cue is a real
rewrite, and it is the one place in this set where the pass found something that would not have
worked at all rather than something that would have looked slightly off.

`--border` is never used; at 1.19:1 in light theme it could not draw a bank. `--ns-accent`
appears nowhere in the band.

## 7. Interaction

Minimal and optional: hovering a river steps its **banks** from stop 3 to **stop 4** (light α
0.407 → 0.552, dark α 0.324 → 0.449) over 220ms ease-out-cubic, and prints that river's chain
length as a stop-2 `--foreground` numeral at its head. Luminance-only by construction — and per
the §6 defect note the cue is carried by the banks, never by the channel, which has no ink to
modulate in either theme.
Default `interactive` may ship `false`; the component is fully alive without a pointer.

If shipped, the follower is lead-compensated:

```
velY = velY + (rawVelY - velY) * (1 - exp(-dt/VEL_TAU));   // VEL_TAU = 0.06
leadY = clamp(velY * POINTER_TAU, -LEAD_MAX, LEAD_MAX);    // POINTER_TAU = 0.012, LEAD_MAX = 24
ptrY += (tgtY + leadY - ptrY) * (1 - exp(-dt / POINTER_TAU));
```

## Host checklist
DPR cap 2.0 (text draw — 1.5 visibly softens small type). `ResizeObserver` on the host re-derives
`M0` and re-runs the DP. Pause on `IntersectionObserver` threshold 0 and `visibilitychange` —
including the 240ms recompute timer, which must be an rAF-driven accumulator, not a `setInterval`,
or it keeps running while offscreen. Tokens via `useLayoutEffect` + `MutationObserver` on
`documentElement` class; rAF start, resize callback and IO resume all early-return before the first
token read. Canvas `w-full h-full`. Verified at dsf 1 and 2, both themes.
