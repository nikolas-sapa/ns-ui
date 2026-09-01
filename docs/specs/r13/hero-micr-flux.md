# micr-flux — hero / kinetic type

## 1. Surface + real technique

**Surface:** full-bleed hero. The headline is the top two-thirds; a live signal trace occupies
the bottom band, and the two are the same object.

**Technique:** **MICR magnetic-ink character recognition**, the E-13B font and read head
specified in ANSI X9.27 / ISO 1004 — the character set printed along the bottom of every cheque.
E-13B's glyphs are designed so that when swept past a magnetic read head, each produces a
**unique voltage waveform**: the head reads `dΦ/dx`, the *rate of change* of ink area under a
narrow aperture, so every vertical stem in a glyph produces a matched positive/negative doublet
and the *spacing pattern of those doublets* is the character's signature. The font's shapes exist
to make the waveform separable, not to be pretty.

## 2. Nearest existing slug + why this is not a restyle

**Nearest: `hero-oscilloscope`.** Secondary: `text-ekg-baseline`.

`hero-oscilloscope` draws a **synthetic** summed three-harmonic waveform into which the pointer
injects energy for a damped wave sim; the trace has no relationship to any type on the page, and
the headline is separate chrome. Here the waveform is **derived from the glyph outlines
themselves** by a real physical model (`dΦ/dx` of ink area through a finite aperture), so
changing a letter, the tracking, or the aperture width changes the trace deterministically and
visibly. Type and trace are one object; you can point at a stem and at its doublet.

`text-ekg-baseline` throws glyphs *up* a waveform — the wave drives the type. Here the type
drives the wave, which is the opposite causal direction and produces a completely different
image: the letters never move off their baseline.

## 3. Mechanic

**Headline raster.** The headline is rasterized once into an offscreen buffer at
`headlineFit = 0.86` of container width, `headlineY = 0.36`. From it build a **column prefix-sum
array** `P[x] = Σ_{x' ≤ x} inkArea(column x')`, one `Float32Array(bufferWidth)`. This makes the
flux exact and O(1) per sample.

**Read head.**
- Aperture width `A = 0.013*w` (default). Real E-13B: a ~0.33mm aperture against a 1.3mm
  character width — the same ratio.
- Sweep speed **320 px/s**, wrapping every `(w + 0.06*w)/320 ≈ 2.98s` at w = 900.
- Flux under the head at position `x`: `Φ(x) = (P[x + A/2] - P[x - A/2]) / A`.
- Output `V(x) = k * dΦ/dx`, evaluated as a central difference over `±1.5px`. `k` set so a
  full-cap-height stem yields `|V| = 0.80`.

**Trace.** Drawn as a continuous polyline in a band of height `0.22*h` at the foot of the hero,
autoscaled to ±1. The **whole sweep persists** — the trace fills left to right behind the head
and is only cleared on the wipe (below). Head position is marked by a 1px rule crossing *both*
the type and the trace, so the correspondence is unambiguous.

**Peak ticks.** Wherever `|V| > 0.55`, a 2px tick is stamped on the trace at **ladder stop 5** and
decays over 900ms (ease-out-quart) **down the ladder to stop 2**, not to zero (§6). A capital `H` produces two clean doublets; a `W` produces four
unevenly spaced ones. This is the readable signature.

**Aliveness, unconditional and unbounded.**
- **Tracking modulation:** `letterSpacing(t) = 0.012em * sin(2πt/13.3)`. This continuously
  changes the doublet spacing, so no two sweeps produce the same trace.
- **AGC drift:** head gain `g(t) = 1 + 0.09*sin(2πt/7.4)`, a real automatic-gain cycle.
- 13.3s and 7.4s and 2.98s are mutually incommensurate, so the composite period is effectively
  unbounded.
- Every 4 sweeps (11.9s) the trace clears with a 260ms left-to-right wipe and rebuilds.

**Reject condition (the mechanism's own failure mode, and free drama).** A real reader rejects a
document when a doublet pair falls outside spec. When `letterSpacing(t)` brings two stems within
**0.006em of the spec limit**, that character's trace segment thickens from 1.2px to 2.4px and a
hairline bracket appears under the character above it. At these constants this fires ~3 times per
13.3s cycle, at different characters each cycle.

## 4. t=0 / 2.5s / 5s, zero input

- **t=0** — head at x = 0, trace empty, tracking at nominal, no ticks.
- **t=2.5s** — head at 84% of sweep 1; ~46 peak ticks laid down; tracking at
  `0.012*sin(1.18) = +0.011em`, near widest, so doublets are well separated. One reject bracket
  live.
- **t=5s** — head is 68% through sweep 2, so a *different* stretch of the trace is live and the
  earlier stretch is redrawn at a different tracking phase (`0.012*sin(2.36) = +0.0085em`),
  visibly shifting where the doublets sit. Gain is 9% down from t=2.5 so the whole trace is
  shorter.

## 5. Reduced-motion freeze frame

`STATIC_TIME = 2.86`.

At 2.86s the head sits at **92% of the first sweep** — nearly the entire waveform is drawn, so
the full type↔trace correspondence is visible as a completed explanation, while the head rule is
still on screen and still obviously the cause of it. Tracking is at `sin(1.35) = 0.976` of
maximum, the **widest letter-spacing of the cycle**, which gives the most separable doublets and
the clearest one-stem-one-doublet reading. t=0 is an empty trace; a completed post-wipe frame has
no head rule and reads as a static graphic beside a static headline — neither explains the
mechanism. Computed from the constant, so frames are byte-stable.

## 6. Hue → luminance, both themes

Everything here is line work, so the cues are stroke weight, alpha and persistence — never hue.

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
| headline ink, trace | 6 | 0.929 | 0.974 | full `--foreground` | unchanged |
| peak ticks (fresh) | 5 | 0.716 | 0.633 | 0.66 / 0.50 | 5.75:1 vs 4.71:1 |
| head rule | 4 | 0.552 | 0.449 | `--ns-muted` 0.85 / 0.70 | **5.60:1 vs 3.51:1** |
| peak ticks (decayed floor) | 2 | 0.267 | 0.221 | — | — |
| baseline rule | 2 | 0.267 | 0.221 | `--ns-muted` 0.35 / 0.35 | 1.81:1 vs 1.70:1 |

**Calibration notes.**

- **Head rule — the largest correction in the whole set.** `--ns-muted` @ 0.85 light / 0.70 dark
  measured **5.60:1 against 3.51:1**, a **1.60x** spread: the marker line was more than half a
  stop heavier in light than in dark, and being on `--ns-muted` it could not be reasoned about
  against a target at all. Now stop 4 (4.00:1) in both.
- **Peak ticks** measured 5.75:1 light against 4.71:1 dark (1.22x). Now stop 5 in both, and their
  900ms decay is redefined as a decay **down the ladder from stop 5 to stop 2**, rather than an
  alpha fade to zero — so a decayed tick is still a specified weight instead of an arbitrary one.
- **Baseline rule was already right in shape** — 1.81:1 light against 1.70:1 dark is a 1.06x
  spread and both already sat on stop 2. Restated as `--foreground` at stop 2 for exactness and
  to get off `--ns-muted`; the visible change is negligible.
- **Stroke widths are unchanged and are not superseded by the ladder.** 1.2px dark / 1.6px light
  compensates for asymmetric bloom, which is a geometric effect the ladder does not model. Both
  compensations are live at once: the light trace is wider *and* on the same stop.

`--border` is never used to draw the trace or the baseline — measured **1.19:1** against
`--background` in light theme, below even stop 1. `--ns-accent` appears only on the hero CTA and
the aperture slider's focus ring, never in the trace and never on a peak.

## 7. Interaction

Two axes, both luminance-neutral:

- **Pointer X scrubs the head directly.** Releasing eases back to auto-sweep over 420ms
  (ease-in-out-cubic) from wherever the head was left, never a jump.
- **Pointer Y sets the aperture** `A` from `0.006*w` to `0.030*w`. This is the good one: as `A`
  exceeds the stem spacing, adjacent doublets **smear into a single hump** and the signature is
  destroyed in front of you — which is the actual engineering reason head aperture is specified
  in the standard.

Neither axis changes brightness, adds a halo, or touches accent.

Lead-compensated follower, advanced in the rAF loop:

```
velX = velX + (rawVelX - velX) * (1 - exp(-dt/VEL_TAU));   // VEL_TAU = 0.06
leadX = clamp(velX * POINTER_TAU, -LEAD_MAX, LEAD_MAX);    // POINTER_TAU = 0.012, LEAD_MAX = 24
ptrX += (tgtX + leadX - ptrX) * (1 - exp(-dt / POINTER_TAU));
```

Scrubbing is exactly the case where a plain exponential follower's `v*tau` error is visible: at
700px/s the head would sit 8.4px behind the cursor and the trace would appear to be drawn ahead
of the rule.

## Host checklist
DPR cap 2.0. `ResizeObserver` on the host re-rasterizes the headline and rebuilds the prefix
array. Pause on `IntersectionObserver` threshold 0 and `visibilitychange`. Tokens via
`useLayoutEffect` `getComputedStyle` + `MutationObserver` on `documentElement` class; rAF start,
resize callback and IO resume all early-return before the first token read. Canvas `w-full h-full`.
Headline also rendered as real, selectable, accessible DOM text (`aria-hidden` on the canvas).
Verified at dsf 1 and 2, both themes.
