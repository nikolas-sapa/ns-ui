# lumitype-disc — hero / kinetic type

## 1. Surface + real technique

**Surface:** full-bleed hero, 1–3 headline lines plus a visible mechanism at the left third.

**Technique:** **second-generation phototypesetting** — the Lumitype/Photon 200 (Higonnet &
Moyroud, 1949) and its descendants. A glass disc carrying ~1,400 *negative* glyph images spins
continuously at 8 rev/s. A xenon flash tube fires for ~4µs at the exact instant the wanted glyph
crosses the optical axis. The image passes a **turret of zoom lenses** — which is why phototype
scales one master optically to every point size instead of cutting a size-specific punch — and a
moving mirror does the escapement onto photographic paper. Consequence: characters are exposed
**when the disc offers them**, not in string order, and the machine's speed limit is how often
the wanted glyph comes round.

## 2. Nearest existing slug + why this is not a restyle

**Nearest: `hero-letterpress-lockup`.** Secondary: `photostat-reverse`.

`hero-letterpress-lockup` is metal: physical sorts arriving on sprung composing rails, and its
stated identity is a **terminal event** — the quoin tightens, letter-spacing compresses, the form
locks. Nothing here is physical and nothing ever locks. Glyphs arrive **out of order** because a
spinning disc's angular position decides, one master glyph is exposed at four different sizes
from the same image via the lens turret, and the ending is a paper transport and a re-expose, not
a clamp. The two components do not share a mechanism, a timing model, or a terminal state.

`photostat-reverse` is generational copy degradation — each pass a little softer and thicker than
the last, across a whole field. Every glyph here is a **first-generation** exposure; the artifacts
are xenon flash halation and escapement lag, which are per-character and per-instant, not
cumulative.

## 3. Mechanic

**Disc.** `K = 96` slots on one track at radius `0.30*min(w,h)`, drawn as a real ring of glyphs
at the left third. Each distinct character in the headline is assigned slot
`θ_c = 2π * rank(c)/96`, `rank` from a **mulberry32-seeded shuffle** re-seeded each full cycle —
so the disc is never alphabetical and the exposure order changes every cycle.
`ω = 8 rev/s` → 125ms per revolution → one slot crosses the axis (the 3 o'clock ray) every
**1.30ms**. All 96 slots draw at **ladder stop 2** (§6); the slot on the axis draws at stop 6.

**Escapement carriage.** Sits at the current fill x. Moves at **340 px/s** with a first-order lag
`τ = 34ms`. It can serve a **window of the next 4 unexposed positions**; a flash fires only when a
slot crossing the axis matches a character inside that window. Measured target: **1.9–2.6s per
line** for a 16-character line, and the observable is that characters land in scrambled order —
never left to right.

**Escapement error, never corrected.** A flash fired mid-move lands at the *lagged* carriage x, so
letterfit is off by up to **3.1px**. This is phototype's notorious spacing and it must be left in.

**Flash + halation, per exposure.**
- At fire: the glyph and a gaussian halo of `σ = 0.9 * capHeight` are drawn **two ladder stops
  above** the glyph's settled weight (§6), capped at stop 6.
- Over **140ms** the halo decays to nothing (ease-out-cubic) and the glyph settles back down the
  two stops to stop 6.
- Repeated letters inside the window expose **simultaneously** on one flash — a visible tell that
  the disc, not the string, is in charge.

**Lens turret.** `sizes = [0.62, 0.81, 1.00, 1.34]` x base cap height. The turret indexes on a
**4.2s** cycle; every line exposed under index *i* is set at that size, so the hero's lines are at
genuinely different optical scales from a single master, and the set changes each cycle.

**Loop, unbounded.** All lines exposed → hold **2.4s** → paper transport: the whole block wipes
upward over **620ms** with a 1px/frame shear → fresh seeded disc + new turret index → repeat.
Full cycle ≈ **9–11s**. The disc never stops spinning, including during the hold and the wipe, so
the component is alive at rest in every phase.

## 4. t=0 / 2.5s / 5s, zero input

- **t=0** — disc spinning; line 1 about 40% exposed in scrambled order; two live flash halos.
- **t=2.5s** — line 1 complete at turret size 1.00; line 2 mid-exposure at 0.62; the disc has
  turned 20 full revolutions and its seeded slot layout is visibly at a different phase.
- **t=5s** — all three lines exposed at three different optical sizes, the 2.4s hold nearly over,
  disc still spinning with no on-axis slot matching anything. Different content, different
  scales, different disc phase from both earlier frames.

## 5. Reduced-motion freeze frame

`STATIC_TIME = 3.85`.

At 3.85s: lines 1 and 2 are **fully exposed at two different turret sizes** (so optical scaling
is legible as a fact, not a claim), line 3 is ~55% exposed with **two live flash halos** at
different decay stages, the carriage is mid-travel with its 3.1px escapement error visible in the
last-placed glyph, and the on-axis slot carries one of line 3's remaining characters — the
mechanism caught mid-explanation. t=0 is a near-empty page; the completed hold is a static
headline that explains nothing about the machine. Computed from the constant; byte-stable.

## 6. Hue → luminance, both themes

This is photographic paper, so the themes are a **positive and a negative of the same coverage
field** — not a re-hue and not a swap of two colours:

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

The sheet stays a **positive in light and a negative in dark** — that framing is unchanged and is
not a re-hue. What the ladder adds is that "more exposure" is **one direction in both themes: up
the ladder.** On a negative that renders brighter, on a positive it renders darker; both are a
higher contrast ratio against the sheet, so both are the same ladder move. The old ±luminance
pair is withdrawn in favour of that single rule.

| element | stop | light α | dark α | was (light / dark) | measured before |
|---|---:|---:|---:|---|---|
| settled exposed glyph | 6 | 0.929 | 0.974 | `--foreground` @ 1.0 | unchanged |
| on-axis disc slot | 6 | 0.929 | 0.974 | `--foreground` @ 1.0 | unchanged |
| flash halo, at fire | **+2 stops** from the glyph's current stop, capped at 6 | — | — | −0.26 L / +0.30 L | direction-split |
| disc glyphs, off-axis | 2 | 0.267 | 0.221 | `--ns-muted` 0.34 / 0.22 | **1.77:1 vs 1.33:1** |

**Calibration notes.**

- **Off-axis disc glyphs — and the correction is on the *dark* side, which is the opposite of the
  ladder's general warning.** `--ns-muted` @ 0.22 measured **1.33:1** in dark, essentially at
  `--border`'s 1.19:1 invisibility level: the 96-slot ring would have been a faint smudge in dark
  theme while reading correctly at 1.77:1 in light. My own §6 prose had asserted the reverse
  ("light theme is the hard case and gets the larger off-axis alpha"). It was right that light
  needed more alpha and wrong about which theme was failing. **This is the case that justifies the
  whole pass:** the general rule ("light lands a stop pale") is a tendency, not a law, and only a
  solved table catches the values that break it.
- **The flash halo unifies.** Expressing it as "+2 ladder stops, capped at stop 6" replaces two
  theme-specific luminance deltas with one rule, and makes the halo's weight relative to whatever
  the glyph currently sits at rather than absolute.

`--border` is never used as a fill or stroke. `--ns-accent` appears only on the hero CTA / focus
rings — never on a flash, which is the component's climactic moment.

## 7. Interaction

**Pointer X sets disc speed:** `ω = 8 * (0.35 + 1.5 * ptrXnorm)` rev/s → **2.8 to 14.8 rev/s**.
Slow, and you watch the carriage wait for a glyph to come round; fast, and halos overlap into a
continuous bloom because exposures arrive inside each other's 140ms decay. Rate only — no
brightness change, no halo added by the pointer, no accent anywhere.

Lead-compensated follower, advanced in the rAF loop:

```
velX = velX + (rawVelX - velX) * (1 - exp(-dt/VEL_TAU));   // VEL_TAU = 0.06
leadX = clamp(velX * POINTER_TAU, -LEAD_MAX, LEAD_MAX);    // POINTER_TAU = 0.012, LEAD_MAX = 24
ptrX += (tgtX + leadX - ptrX) * (1 - exp(-dt / POINTER_TAU));
```

## Host checklist
DPR cap 2.0. `ResizeObserver` on the host re-measures cap height and disc radius from the smaller
dimension. Pause on `IntersectionObserver` threshold 0 and `visibilitychange`. Tokens via
`useLayoutEffect` + `MutationObserver` on `documentElement` class; rAF start, resize callback and
IO resume all early-return before the first token read. Canvas `w-full h-full`. The headline also
exists as real accessible DOM text with the canvas `aria-hidden`, so the scrambled exposure order
is never what a screen reader gets. Verified at dsf 1 and 2, both themes.
