# stem-snap — hero / type

## 1. Surface + real technique

**Surface:** full-bleed hero headline.

**Technique:** **TrueType grid-fitting (hinting)** — the stage of glyph rasterization where a
continuous outline is forced onto a discrete pixel grid. Three real mechanisms are reproduced:
the **StemSnapV array** (a font declares a small set of vertical stem widths and every stem is
pulled to the nearest one, then rounded to whole pixels), **blue zones / alignment zones**
(baseline, x-height and cap-height flatten to whole pixel lines, and round-letter *overshoot* is
suppressed entirely below the font's `blueScale` ppem), and **dropout control** (a stem that
would round to zero pixels is forced to exactly one).

## 2. Nearest existing slug + why this is not a restyle

**Nearest: `cursor-subpixel-fringe`** — whose own description says "as if a renderer were locally
re-hinting glyphs to the pixel grid", so this adjacency must be met head-on. Secondary:
`text-variable-weight`.

`cursor-subpixel-fringe` never touches an outline. It draws three fixed vertical luminance
slivers per cell standing in for an LCD's physical RGB stripes, and the pointer splays them
apart — a *display-hardware* model of the panel, on an abstract field, with no type in it. This
component has no subpixel slivers at all; it renders a real glyph outline at a continuously
varying ppem and quantizes it. The visible event is that **the outline moves continuously while
the rendered bitmap changes in whole-pixel steps**: stem widths jump 2→3px with nothing else
moving, and x-height locks to a line while the size sweeps past it. That discontinuity is the
entire subject and `cursor-subpixel-fringe` cannot produce it.

`text-variable-weight` maps cursor proximity to a continuous variable-font weight axis. Here
weight changes are **never** continuous — they are integer-pixel quantization artifacts, and the
only continuous quantity (ppem) is the one you cannot see directly.

## 3. Mechanic

**Display grid.** Pixel pitch derived from the smaller dimension:
`P = max(3, round(min(w,h)/120))` CSS px. At 900x520 → `P = 4px` → a **225 x 130 virtual
display**.

**ppem sweep, unconditional and incommensurate:**
```
ppem(t) = 26 + 12*sin(2πt/21.5) + 4*sin(2πt/6.7)     // range 10..42
```

**Unhinted pass.** Headline drawn at `capHeight = ppem * P` CSS px into an offscreen buffer at
**3x supersample**, box-downsampled to the display grid → continuous coverage 0..1 per display
pixel.

**Hinting pass, in interpreter order.**

1. **Blue zones / overshoot.** Zones at baseline `y=0`, x-height `y=0.52*capHeight`, cap-height
   `y=1.00`. Zone width **0.021 em** (real fonts sit near 21/1000). Any horizontal edge whose
   unhinted y lands inside a zone snaps to the zone's rounded pixel line. Below **ppem 17**
   (`blueScale` cutoff) overshoot is fully flattened — the top of a round `O` sits *exactly* on
   the flat top of `H`. Above 17 the 1.4% overshoot returns. That single threshold crossing fires
   **twice per 21.5s cycle** and is the most legible discrete event in the component.
2. **Stem snapping.** Per display-pixel row, a stem is a run of coverage ≥ 0.5 of raw width
   `wRaw`. The font declares `StemSnapV = {0.086, 0.122, 0.180} em` (thin / mid / thick). Pull
   `wRaw` to the nearest declared class, convert to pixels (`class * ppem`), then `round()`. Snap
   the stem's left edge to the nearest whole display pixel.
3. **Dropout control.** Any stem whose hinted width rounds to 0 is forced to exactly 1 pixel at
   **55% ink** — TrueType scan-converter dropout rule 4.

**Draw.** Each display pixel is a filled square of side `P * 0.94`, luminance = hinted coverage.

**Ghost.** The *unhinted* continuous-tone coverage is drawn beneath at 0.16 contrast, so the gap
between the smooth outline and the snapped bitmap is a permanent halo that **widens exactly when
a snap fires** and is widest at small ppem where relative quantization error is largest.

**Snap flash.** When any stem class changes its rounded pixel width, that stem's columns lift
**one ladder stop for 180ms** (see §6), ease-out-quart, capped at stop 6. At these constants **4–9 snap events fire per 21.5s
cycle**, at irregular intervals because the two sine terms are incommensurate.

## 4. t=0 / 2.5s / 5s, zero input

- **t=0** — `ppem = 26.0`. Thin stems 2px, mid 3px, thick 5px; overshoot on; ghost halo tight.
- **t=2.5s** — `ppem = 26 + 12·sin(0.731) + 4·sin(2.345) = 36.9`. Glyphs ~42% larger, thin stems
  now 3px, thick 7px, halo tighter still (large ppem = small relative error).
- **t=5s** — `ppem = 26 + 12·sin(1.462) + 4·sin(4.690) = 33.9`. Between 2.5s and 5s the thick
  class crossed 7→6px and the mid class 4→3px, each with a flash. Size, stem weight and halo
  width all differ from both earlier frames.

## 5. Reduced-motion freeze frame

`STATIC_TIME = 13.9`.

`ppem(13.9) = 26 + 12·sin(4.062) + 4·sin(13.03) = 19.8` — **just above the blueScale cutoff of
17**, so overshoot is present but small, and all three stem classes land on *distinct* pixel
widths (2 / 3 / 4px) and are separately resolvable in one frame. It is also near the small end of
the sweep, where the ghost halo is at its **widest**, so the difference between the continuous
outline and the grid-fit bitmap is at maximum visible amplitude. t=0 sits mid-sweep where the mid
and thick classes both round to the same width and the halo is thin — the mechanism is largely
invisible there. Computed from the constant, so frames are byte-stable.

## 6. Hue → luminance, both themes

Everything is coverage → luminance; no cue is hue-coded. But the *carrier of the snap event*
must swap between themes, and this is the light-theme trap:

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

| element | stop | light α | dark α | was (light / dark) | measured before |
|---|---:|---:|---:|---|---|
| hinted ink | 6 | 0.929 | 0.974 | `--foreground` | unchanged |
| ghost halo | **2 light / 1 dark** (deliberate) | 0.267 | 0.134 | `--ns-muted` 0.26 / 0.16 | **1.53:1 vs 1.20:1** |
| snap flash | **+1 stop**, capped at 6 | — | — | +0.16 L / +0.22 L | direction-split |
| virtual display frame | 1 | 0.144 | 0.134 | `--ns-muted` @ 0.30 | — |

**Calibration notes.**

- **The dark ghost halo was below the visibility floor.** `--ns-muted` @ 0.16 measured
  **1.20:1** — under `--border`'s own 1.19:1-ish invisibility level and beneath stop 1 (1.35:1).
  The permanent halo that is supposed to widen on every snap would have been effectively absent in
  dark theme. Now stop 1 (1.35:1), which is genuinely faint but genuinely present.
- **The ghost keeps a deliberate theme-asymmetric ladder — stop 2 in light, stop 1 in dark — and
  the reason is unchanged from the original §6:** light theme carries the snap event mainly on the
  ghost widening because a brightening flash on already-dark ink reads as almost nothing on a
  bright sheet, while dark theme carries it on the flash. The asymmetry is now *stated as a stop
  offset with a reason*, which is what three of the round's ascii specs also do, rather than as two
  unrelated alphas.
- **The snap flash unifies to "+1 ladder stop, capped at stop 6" in both themes**, replacing the
  +0.22 / +0.16 pair. Its dominance difference between themes is then carried entirely by the
  ghost's stop offset above, not by two separate flash magnitudes — one mechanism for the
  asymmetry instead of two.

`--border` is never used as a fill or stroke. `--ns-accent` appears only on the optional
"hinting on/off" control's focus ring, never on a snap, which is the climactic moment.

## 7. Interaction

**Pointer X applies a local ppem bias:** `±5 ppem` over a gaussian of `σ = 0.28*w` centred on the
pointer, so the headline is **grid-fit at two different sizes at once** and the seam between two
hinting solutions runs vertically through the type — stems change width mid-word. Luminance-only:
the pointer never brightens anything, it only changes which pixel grid the outline is fitted to.

Lead-compensated follower, advanced in the rAF loop:

```
velX = velX + (rawVelX - velX) * (1 - exp(-dt/VEL_TAU));   // VEL_TAU = 0.06
leadX = clamp(velX * POINTER_TAU, -LEAD_MAX, LEAD_MAX);    // POINTER_TAU = 0.012, LEAD_MAX = 24
ptrX += (tgtX + leadX - ptrX) * (1 - exp(-dt / POINTER_TAU));
```

## Host checklist
DPR cap 2.0. `ResizeObserver` on the host re-derives `P` and re-rasterizes. Pause on
`IntersectionObserver` threshold 0 and `visibilitychange`. Tokens via `useLayoutEffect` +
`MutationObserver` on `documentElement` class; rAF start, resize callback and IO resume all
early-return before the first token read. Canvas `w-full h-full`. Headline also present as real
accessible DOM text with the canvas `aria-hidden`. Verified at dsf 1 and 2, both themes — the
supersample buffer must be sized from the *backing store*, not CSS px, or the hinting is computed
at the wrong grid on Retina.
