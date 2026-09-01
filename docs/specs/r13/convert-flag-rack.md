# flag-rack — plan selector as a cash-register indicator rack

**Collection:** core · **Surface:** pricing plan selector + price reveal

## 1. Surface and the real process

Replaces the pricing-page plan selector and the price readout attached to it.

Borrowed process: the **indicator tablet rack** of a pre-electronic cash register
(National Cash Register, c. 1900-1950). The amount was shown by raising printed glass
or enamel **tablets** on a spring rack behind a glass window. Pressing a key tripped a
latch; a spring threw that denomination's tablet up into the window while the tablet
previously raised in the same column dropped back onto the stack. Every possible value
is physically present in the machine at all times, edge-on at the bottom of its column.
A pivoted flag above the window ("AMT", "NO SALE") swung on the drive shaft.

## 2. Nearest existing slug and why this is not a restyle

Nearest: `split-flap-board` (core) and `counter-carry-ripple` (core).

**Name disambiguation:** this is not related to `flag-hoist-run` or `semaphore-arm-cast`
(r12, both removed in owner review). "Flag" here is the cash-register trade term for a
printed indicator tablet, not a signal flag. If the name invites that confusion, rename to
`indicator-rack` — the mechanic is unaffected.

A split-flap cell **mutates in place**, rotating one hinged leaf through a glyph set, so
the values it is not showing do not exist on screen; a tablet rack is a **sort** — every
value is a separate plate permanently in frame, and changing the reading costs the
travel of two plates moving in opposite directions past each other. `counter-carry-ripple`
is about carries propagating between columns; there is no carry here at all, the columns
are mechanically independent and that independence is visible.

## 3. Mechanic

- **4 columns** (tens / units / cents / term), 10 tablets each. Down-stacked tablets sit
  at 3 px pitch, showing a 30 px tall band of plate edges at the foot of each column.
- Column width and lift derive from `min(w, h)`: lift = `0.19 * min(w,h)` floored at 44 px
  (spec figures below assume the 62 px reference lift).
- **Raise:** latch release 40 ms; spring lift 62 px in 210 ms, critically damped plus one
  overshoot of 4 px, settling over a further 90 ms.
- **Drop:** the outgoing tablet falls under gravity scaled so 62 px takes 178 ms, then a
  2 px bounce damping out in 70 ms.
- Raise and drop are offset by **25 ms** (the latch trips before the spring is freed), so
  the two plates visibly cross. This is the detail that makes the rack read as a rack.
- **Idle, unconditional and always running:**
  - *Glass reflection:* a 40 px wide shop-light band travels across the window at
    26 px/s on a 6.00 s period, veiling and un-veiling the printed tablet faces beneath.
  - *Flag pendulum:* the AMT flag above the window swings ±1.2° on a 3.40 s period,
    never damping (the drive shaft is turning even when idle).
  - *Rack tick:* a pawl on the drive shaft indexes every 1.60 s, shifting the whole rack
    laterally 0.5 px with a 120 ms settle.

  The reflection band is the perceptually load-bearing one; the flag and tick are
  supporting detail. Contrast change from the band is capped at 0.10 L so it never
  competes with the DOM price text that sits outside the window.

## 4. Alive at rest (no input)

- **t = 0.0 s** — flag at +1.2°, reflection band at x = 0 (just entering), rack settled.
- **t = 2.5 s** — flag at −0.9°, band at 65 px crossing the tens column so those figures
  are partly veiled while the neighbouring columns read clean; rack has ticked once.
- **t = 5.0 s** — band at 130 px on the far column, flag near +1.0°, rack has ticked
  three times. The three frames differ in which column is legible.

## 5. Reduced-motion freeze frame

**Freeze at t = 1.90 s of the 6.00 s glass cycle, with the rack held in a mid-change
state:** one tablet 41 px up and its predecessor 22 px down, crossing.

Why: that frame carries the reflection (proving there is glass), the flag at its +1.2°
extreme, the down-stacked plate edges, and the crossing pair that is the whole
mechanism. t=0 has every tablet seated and the band off-frame — indistinguishable
from a static price card, which is the automatic reject.

Byte-stability: the frozen frame is a pure function of the frozen clock and the selected
plan; no PRNG is consulted after mount.

## 6. Hue carried by luminance, both themes

- Tablets: `--background` plates with `--foreground` figures. Down-stacked plate edges
  are `--ns-muted` at 0.55 alpha in both themes.
- **Glass reflection:** `+0.10 L` in dark theme, `−0.08 L` in light theme. The direction
  flips because a reflection of a lit interior brightens a dark ground and darkens a pale
  one; the magnitude is matched so the cue reads the same strength either way.
- Raised tablet: 1 px `--foreground` drop shadow under its top edge in light theme;
  1 px lift highlight at `+0.12 L` in dark. Same relief, opposite carrier.
- `--border` is not used for any plate outline (it is a ~1.1:1 separator and would be
  invisible); plate outlines are `--ns-muted` at 0.40.
- `--ns-accent`: plan-radio focus rings and the recommended plan's CTA fill only.
  Never in the reflection band.

## 7. Accessibility

- The rack canvas is `aria-hidden="true"`. The price is real DOM text beside it.
- Plan choice is a `role="radiogroup"` of real radios with roving tabindex: Left/Up and
  Right/Down move and select, Home/End jump to the rails, Space re-affirms.
- Billing term is a second `role="radiogroup"` (monthly / annual).
- Focus order: plan radios -> term radios -> primary CTA -> secondary link.
- `aria-live="polite"` region announces **on commit only**, debounced 350 ms so
  arrow-traversal through three plans produces one announcement, not three:
  `"Plan B, PRICE PLACEHOLDER per month, billed annually."`
- The rack animation never gates interaction — a second selection made during a
  raise cancels it and re-targets; the DOM price updates immediately regardless.

## 8. Placeholder copy

- plans: `Plan A`, `Plan B`, `Plan C`
- price: `PRICE` with sample digit glyphs `00` on the tablets (the tablets must carry
  *some* numerals to be legible as tablets — use `0`-`9` as the plate alphabet, not an
  invented price)
- term: `Monthly` / `Annual`
- CTA: `Primary action`

Do not ship a price, a discount percentage, or a "most popular" claim.
