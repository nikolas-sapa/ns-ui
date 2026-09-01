# bundle-band — social-proof count as a ballot count table

**Collection:** core · **Surface:** social-proof counter (signups, customers, installs)

## 1. Surface and the real process

Replaces the big-number social-proof tile.

Borrowed process: the **bundling procedure at a UK parliamentary count**. Verified
ballots are counted into bundles of **25**, each bundle banded, and the bundles stacked
into columns of ten (250 each). The total is read off the table by eye — you can see
every candidate's standing across the room without a number being spoken. Bundles
pulled for verification that fail are **broken**: the band is cut and the 25 slips go back
into the loose pile to be re-counted.

## 2. Nearest existing slug and why this is not a restyle

Nearest: `counter-carry-ripple` (core) and `lug-cage-tally` (core).

Both of those animate a **reading** — digits moving, or a notch bar advancing. Here the
quantity has no digits in the mechanic at all: the count *is* volume, and the two events
the surface exists to show are the two an odometer structurally cannot — **banding**
(a discrete 25 arrives and is bound, which is where a count becomes a fact) and
**breaking** (a bundle fails verification, the band is cut, and the pile jumps backwards).
Throughput and error in the same picture; a rolling digit has neither.

## 3. Mechanic

- **Slip arrival:** a Poisson process at `lambda = 1.9 slips/s`, driven by a fixed-seed PRNG
  so the sequence is identical on every mount (required for the reduced-motion frame to
  be byte-stable). Each slip falls 40 px in 220 ms, lands with ±2.5° rotation jitter and a
  1 px settle.
- **Banding at 25:** a band sweeps around in 180 ms; the stack compresses 4 px over
  120 ms (banding squeezes the lift, which is why it is a visible event); the bundle
  translates to the top of the current column over 300 ms, ease-out.
- **Columns:** 10 bundles per column, filling left to right, 6 columns visible. When the
  sixth fills, the leftmost column slides out left over 400 ms and a DOM "carried away"
  figure increments. The window rolls; it never resets to empty, so the loop is unbounded.
- **Verification break:** every 14th bundle is pulled — it lifts 18 px, holds 400 ms, then
  either re-seats (85% by the same seeded PRNG) or the band is cut and its 25 slips splay
  outward over 260 ms back into the loose pile. This is what keeps the surface from
  being a metronome, and it is real procedure, not decoration.
- **Idle jitter (unconditional):** the top 6 loose slips carry independent ±0.35 px and
  ±0.4° draught motion on a 1.70 s incommensurate period. Slip arrival itself is
  unconditional too — there is no trigger and no autoplay descriptor involved, only the
  `IntersectionObserver` / `visibilitychange` performance pauses.
- Geometry from `min(w, h)`: slip width `0.16 * min(w,h)` floored at 26 px; bundle
  thickness `0.010 * min(w,h)` floored at 3 px; column pitch `width / 6`.

## 4. Alive at rest (no input)

- **t = 0.0 s** — 11 loose slips, 3 full columns and 4 bundles in the fourth.
- **t = 2.5 s** — ~16 loose after ~5 arrivals; the pile's silhouette is visibly taller and its
  top edge has a different jitter phase.
- **t = 5.0 s** — a band has fired: the loose pile has dropped back to a handful and the
  fourth column has grown by one bundle. Column heights differ from t=0 by a whole
  bundle.

Motion is confined to the pile and the bundle in flight; the DOM number beside it never
animates, so nothing moves under the text you are meant to read.

## 5. Reduced-motion freeze frame

**Freeze at t = 8.60 s.** 23 loose slips (two short of a band, so the threshold is legible
from the picture); one bundle mid-lift at 12 px for verification with its band visible; four
columns at heights 10 / 10 / 7 / 3.

Why: the near-threshold pile explains the 25, the lifted bundle explains verification, and
the uneven columns explain the fill order — the three facts the mechanic is made of. t=0
is a mostly bare table with a few slips: neither bundle nor column structure exists yet.

## 6. Hue carried by luminance, both themes

A stack read edge-on is carried entirely by edge contrast, which is theme-symmetric.

| | Light theme | Dark theme |
|---|---|---|
| slip face | `--background` + `--foreground` @0.06 | `--background` + `--foreground` @0.06 |
| slip bottom edge | `--foreground` @0.28 | `--foreground` @0.34 |
| slip outline | `--ns-muted` @0.45 | `--ns-muted` @0.45 |
| band (3 px strip) | −0.12 L | +0.12 L |
| verification lift shadow | 0.10 L | 0.10 L |

The band's sign flips (a rubber band is darker than white paper and lighter than a
dark-theme grey slip) but the magnitude is identical, so "banded" reads at the same
strength either way. `--border` is not used anywhere — it would vanish as a slip outline.
No `--ns-accent` in the canvas at all; only the optional pause button's focus ring.

## 7. Accessibility

- Canvas is `aria-hidden="true"`.
- **The number is DOM text, always.** It lives in a `role="status" aria-live="polite"`
  region updated **at most once every 4 s** and phrased as a whole sentence — an
  aria-live firing twice a second is abusive and this component's slip rate is ~2 Hz.
- **The animation is not the data.** The slip rate is decoupled from any real count
  passed in via prop. This must be stated in the component docblock and in the
  registry `useWhen`, because a viewer will otherwise read the pile as a live feed.
- One optional `<button aria-pressed>` "Pause motion", which genuinely stops the rAF
  loop. It is the only tab stop the component contributes.
- Focus order: surrounding heading (not focusable) -> pause button -> any CTA.

## 8. Placeholder copy

- label: `Placeholder metric label`
- value: `—` (the default prop is `count={undefined}`)
- carried-away line: `Placeholder secondary label`

Do **not** invent a customer count, a signup figure, a growth percentage, or a
"joined this week" number. The count is the consumer's to supply.
