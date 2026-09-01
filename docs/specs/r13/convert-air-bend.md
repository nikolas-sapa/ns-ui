# air-bend — section CTA band as a press-brake air bend

**Collection:** loud · **Surface:** closing CTA band — gap-map gap #2 (count today: 0)

## 1. Surface and the real process

Replaces the full-width call-to-action band — the strip carrying one headline and one
button that separates the body of a landing page from its footer.

Borrowed process: **air bending on a press brake**. The punch pushes sheet into a
V-die but never bottoms it; the included angle is set purely by penetration depth. On
release the metal **springs back** by 1-4° (more for higher-strength material) because
part of the deformation was elastic, so the operator deliberately **over-bends by the
springback allowance**. The recovery is essentially instantaneous at release — which is
what separates metal from rubber to the eye. The die shoulders leave two witness marks
either side of the bend line.

## 2. Nearest existing slug and why this is not a restyle

Nearest: `roller-break-reduce` (core), `crimp-barrel-set` (core), `confirm-hold-ink` (core).

**Removed-ledger caveat:** `lamination-fold-shear` was built in r11 and cut in owner
review. No reason was recorded, but it was a sheet-folding mechanic, so the builder
should assume the failure mode was legibility at card scale and prove the 0.15 L step
across the bend line survives a 320 px-wide card before going further.

Nothing in the registry models **elastic recovery**. Every existing "spring" here is a
display easing applied to a position, whereas springback is a *material property of the
band itself* that is over-corrected before the fact — the press deliberately travels 4.6°
past the target and then loses exactly that on release, which is a different shape of curve
(near-instant recovery with almost no tail) and reads as metal rather than as a bouncy
transition. And the band is the **section**, not a control: the bend line is where the
page's two halves meet, so the fold is layout, not ornament.

## 3. Mechanic

- Band is `380 px` tall at full width (scaled: `0.32 * min(w,h)` floored at 180 px), drawn
  in shallow perspective (CSS `perspective: 1400px`, or the equivalent computed in the
  shader) with a horizontal bend line at **58% height**. The upper flange faces the viewer;
  the lower flange rakes away.
- **Rest angle: 172° included** — an 8° bend. This number is a legibility constraint, not a
  taste call: the CTA type lives on the upper flange and must never foreshorten. The
  bend is hard-capped at 26° total under any condition.
- **Press stroke on activation:**

  | Phase | Duration | Angle |
  |---|---|---|
  | descend | 260 ms, ease-in (hydraulic ram acceleration) | 172° -> 150° |
  | dwell | 90 ms | 150° |
  | release + springback | 140 ms, of which recovery is the **first 40 ms** | 150° -> 154.6° |
  | hold | 700 ms | 154.6° |
  | eject + new blank | 380 ms | 154.6° -> 172° |

  The 4.6° over-bend and its near-instant recovery are the component. Do not ease the
  recovery over the full 140 ms — the tail is what would make it read as rubber.
- **Witness marks:** two 1 px lines 22 px either side of the bend line at `−0.07 L`,
  permanent for the life of that blank and gone when the blank changes.
- **Idle production run (unconditional, always visible):** the brake never stops. In a
  120 px register at the band's edge, scrap blanks run at **one stroke every 2.40 s** —
  blank feeds 46 px in 300 ms, punch descends and returns in 490 ms, the part ejects
  and drops onto a stack that grows 3 px per part with a rolling window of 14. Stroke
  height derives from the smaller dimension: `0.09 * min(w,h)` floored at 18 px, so this
  is still legible at card scale.
- **Mill finish:** directional rolling grain, 0.5 px lines at 3 px spacing, `±0.025 L`; plus a
  broad specular band `0.22 * width` sweeping at **0.11 cycles/s**, continuously. When
  the band bends, the specular band's position shifts by the true change in surface
  normal — bending visibly moves the highlight, and that is the cue that sells the fold.

## 4. Alive at rest (no input)

- **t = 0.0 s** — idle punch at top of stroke, specular band 6% across, scrap stack 9 high.
- **t = 2.5 s** — one idle stroke has fired (stack 10), specular band at 34% and sitting on
  the bend line, so the highlight shows a hard break at the normal discontinuity.
- **t = 5.0 s** — two further strokes (stack 12), specular band at 61%, and the stack's
  rolling window has begun shedding its oldest part.

The only motion crossing the type is the specular band at 0.11 Hz — one traverse per
9 s, well under a reading cadence.

## 5. Reduced-motion freeze frame

**Freeze at t = 1.36 s.** The idle punch is at bottom of stroke with its scrap blank bent to
the full 150°; the main CTA band sits at its 172° rest with **both witness marks visible
from the previous part**; the specular band lies across the bend line so the normal
discontinuity shows as a hard break in the highlight; the scrap stack is 10 high.

Why: the frozen frame has to carry the fold (highlight break), the press (punch down,
blank bent), the history (witness marks, stack) and the rest angle simultaneously. t=0 is
a punch at the top of stroke over a flat blank with no bend anywhere — it reads as a
plain band with a stripe on it.

## 6. Hue carried by luminance, both themes

| | Light theme | Dark theme |
|---|---|---|
| sheet base | L 0.62 | L 0.44 |
| upper flange (near-frontal) | +0.06 | +0.06 |
| lower flange (raked) | −0.09 | −0.09 |
| specular band | +0.14 | +0.16 |
| rolling grain | ±0.025 | ±0.025 |
| witness marks | −0.07 | −0.07 |

Every delta is identical; only the base moves. The **0.15 L step across the bend line** is
what carries the fold in both themes, and it comes from Lambert on the true normals, not
from a painted gradient. `--border` unused.

**`--ns-accent` is forbidden in the specular band.** A metal highlight is the exact place
this project keeps smuggling accent in — `edge-yield`, `granule-churn` and `shear-billow`
all shipped that defect. Accent appears only on the DOM CTA fill and focus rings. Check
by sampling R/G/B across the canvas in both themes: equal within rounding everywhere.

## 7. Accessibility

- Canvas / shader is `aria-hidden="true"`. The CTA is a real `<button>` or `<a>`.
- The text block sits on the **upper flange**, which is kept near-frontal specifically so its
  type is not foreshortened, on a `bg-background/78 backdrop-blur` scrim.
- Focus order: headline (not focusable) -> primary CTA -> secondary link.
- Activation by keyboard produces the **identical** press stroke as a click. There is no
  hover-only behaviour, so nothing is invisible to a keyboard user.
- Navigation or submit is never gated on the 1.57 s stroke completing.
- No `aria-live` — nothing changes value.
- Verify >= 4.5:1 for the CTA text at the frame where the specular band is directly
  behind it, and at the fully-bent 150° frame where the flange is at its darkest.

## 8. Placeholder copy

- headline: `Headline placeholder goes here`
- primary button: `Primary action`
- secondary link: `Secondary action`

No prices, urgency claims, deadlines, or guarantees.
