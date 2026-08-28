# lamination-fold-shear

- **slug:** `lamination-fold-shear`
- **tier:** core (card-scale canvas)

## product surface it replaces
A multi-stage stepper / pipeline-progress indicator (deploy stages, onboarding steps, build steps) — currently a row of dots or a numbered list.

## the real mechanic
Croissant/puff-pastry lamination: a butter block is enclosed in dough and passed through repeated "letter folds" (fold into thirds). Each fold multiplies the visible layer count by the fold factor — a standard 3x letter-fold sequence takes a dough from 1 layer to 3, 9, then 27 layers across three folds, and the butter sheet gets rolled progressively thinner on every pass (shear). Source: classic French pâtisserie lamination technique (croissant/puff-pastry "tourage").

## one-sentence mechanic description
A cross-section of dough bands visibly splits into three times as many, three times thinner bands at each of three fold events, then resets and folds again.

## rendering approach
2D canvas, side-view laminate stack. Band height derives from the container's smaller dimension: `bandUnit = minDim / 64`. Bands are drawn as alternating dough/butter luminance strips that literally subdivide (each band splits into 3 sub-bands at a fold event, not just redrawn thinner) so the split itself is the animation.

## real numbers
- 3 fold stages, layer count 1 → 3 → 9 → 27 (tripling each fold).
- Each fold event: 1400ms shear pass (skew + vertical compression + horizontal widen transform on the whole stack) + 900ms rest = 2300ms per fold.
- Butter-layer stroke width thins by 1/3 per fold: 4px → 1.33px → 0.44px, clamped to a 0.6px visibility floor at fold 3 (documented deviation from true physical thinning, kept for legibility).
- Full cycle: 3 folds (2300ms each = 6900ms) + 1500ms hold at 27 layers + 800ms reset wipe back to 1 layer = 9.2s, looped forever (a bakery repeats the batch).

## the resting loop
- t0: 3 thick bands mid-hold (post fold 1).
- 2.5s: fold 2's shear transform is actively animating (visible skew/compression).
- 5s: 9 bands settled from fold 2, or the transition into fold 3 — visibly more, thinner bands than t0 either way.

## reduced-motion freeze frame
Freeze at t=6.4s of the 9.2s loop: 27 layers, fold 3 just completed and relaxed (not mid-shear-blur) — the most information-dense, structured frame.

## interaction
None required (ambient). If used inside an actual stepper control, hover/focus on a step highlights that fold stage's band group in luminance only — never `--ns-accent` on the lamination bands themselves; accent is reserved for the stepper's own focus ring/button chrome, if any.

## light vs dark theme
Dough bands read as a near-`--background` luminance, butter bands as a mid-`--ns-muted` step, band separators as thin `--border` hairlines only between bands (never as a fill) — same value relationship inverted in dark, so light theme needs the dough/butter contrast checked first since both are close to `--background`.

## kill criteria
- If band-splitting past 27 layers becomes illegible (reads as barcode/scanline noise) — hard cap at 27, never render finer.
- If, once built, it reads as a restyle of `carbon-ply-fade` (read that component first: falloff-density stacked activity feed, not fold-count doubling) or of the fabric-shear family (`shear-billow`, fluid Kelvin-Helmholtz) — kill if the differentiator (literal band subdivision on a fold event, not falloff or fluid shear) doesn't hold up visually.

## legibility
The ONE thing to follow: band count literally multiplying at each fold instant (3 → 9 → 27). Cadence: one fold event every 2.3s — slow enough to count the bands each time before the next fold starts.
