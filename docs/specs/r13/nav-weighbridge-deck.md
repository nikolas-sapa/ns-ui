# weighbridge-deck — consent strip as a legal-for-trade weighbridge

> **Scope tripwire.** Every category name, weight figure, unit and button
> label in this spec is an obvious placeholder (`ANALYTICS`, `1,240 u`).
> The builder must ship placeholders. Real consent copy, real category
> definitions and any legal wording are owner decisions and must be surfaced,
> not written.

## 1. Surface replaced + real process

**Surface:** the bottom-pinned **cookie / consent strip** on a landing page.

**Real process:** a **road weighbridge** — a certified, legal-for-trade truck
scale. The steel deck rests on load cells; a vehicle drives on and the
indicator's reading **hunts**, because the deck rings on its cells and the
world vibrates. Legal-for-trade indicators therefore run a **motion-detection
filter**: under OIML/NTEP rules the instrument refuses to certify a weight
until the reading has held inside a tolerance band for a set dwell. Only when
"no motion" latches does the printer issue a **weight ticket** and the exit
barrier lift. The property worth stealing: **the machine will not commit a
number that is still moving**, and it says so out loud with a motion lamp.

## 2. Nearest existing slug — why this is not a restyle

Nearest: **`consent-scope-redact`**, **`gauge-capacity-waterline`**,
**`stepper-needle`**.

`consent-scope-redact` makes a **text-level** claim: toggling a scope sweeps a
felt-pen bar over exactly the tokens of a sentence that the scope withholds —
its idea is "show the sentence you lose", and it has no measurement, no
settling, and no commit gate. `weighbridge-deck` has no sentence and no
redaction; its claim is **measurement integrity** — the commit control is
gated on the reading being stable, so the strip physically cannot be rushed.
`gauge-capacity-waterline` reads a static level against fixed Plimsoll marks
with no settle law and no commit. `stepper-needle` is the closest on physics
(an inertial needle swinging to committed values) but it is a numeric *input*
whose needle reports a value the user typed; here the causality is inverted —
the reading **gates** whether a commit is allowed at all.

## 3. The mechanic — numbers

Geometry from `S = min(hostW, hostH)`. Strip height
`H = clamp(64, 0.26 * S, 96)` px, pinned bottom, full width, 1px `--border`
top edge.

**Parts.** Left: a side-elevation of the deck — a 3px plate on four 5px load
cells, `min(180, 0.22 hostW)` wide. Centre: the scope chips. Right: the
indicator (5 mono digits + unit), the motion lamp, and the ticket button.

**The reading.** `reading(t) = load(t) + n(t)`, displayed as
`round(reading / 2) * 2` — a 2-unit display division, as a real scale steps.

```
n(t) = 3.4*sin(2*pi*t/3.30)
     + 2.1*sin(2*pi*t/7.90 + 0.60)
     + 1.5*sin(2*pi*t/17.00 + 2.00)
```

Three mutually incommensurate periods, so the resting flicker never repeats.
Mean interval between displayed-digit changes at rest: **2.1 s**.

**Motion lamp.** A 6x6 px square, filled `--foreground @ 0.50` whenever
`|dn/dt| > 3.6 u/s` (or a load change is settling), empty otherwise. At rest
it trips for 180-420 ms roughly every **5.4 s**.

**Deck deflection.** The plate's y offset is `0.5 + 0.5 * n/7` px — sub-pixel
at rest, up to **2.6 px** during a load change. The load cells compress
proportionally (5px → 4.2px minimum).

**Load change.** Toggling a scope chip steps `load` by that item's placeholder
weight. The reading responds second-order and **rings**:

```
x'' = -22 * (x - target) - 2.1 * x'      (zeta = 0.22)
```

First overshoot **+38%** at t = 0.34 s, second at −14%, inside band by ~1.5 s.

**No-motion filter (the gate).** The ticket button is armed only when
`|reading − mean(reading over trailing 900 ms)| <= 2 u` **continuously for
1.20 s**. Typical time from toggle to armed: **1.9 s**.

**Symmetry requirement — non-negotiable.** "Accept all" and "Reject all" must
settle in the **same 1.9 s**. The settle law is a function of `|Δload|` only
through the ring envelope, and the arming dwell is a fixed 1.20 s, so a
larger reject-all step must not be allowed to take longer. Any asymmetry here
turns the mechanism into a dark pattern and is a build failure. The builder
must measure both paths and assert equality within 60 ms.

**Pre-arm.** Pressing the ticket button while the reading is still moving does
**not** reject the press — it queues the commit, which fires the instant
no-motion latches. The user is never blocked; they are only briefly shown the
machine.

**Barrier.** A 1px boom at the strip's trailing edge lifts 0 → 72° over 420 ms
`cubic-bezier(.2,.7,.2,1)` on commit, then the strip slides down over 260 ms.

**Perceptual budget (explicit):** at rest the moving elements are **one** mono
digit (11px tall, ~66 px²), a 6x6 lamp, and a sub-pixel deck deflection —
**~110 px²**, i.e. **0.2%** of a 960x80 strip. The four leading digits, every
label, and every chip are static. Peak per-frame luminance change on any pixel
is **0.12 L** (the lamp), and the lamp is 6x6 and sits 24 px from the nearest
text baseline. Nothing in the strip reflows at rest: the deck deflection is
drawn inside a fixed 3px band with 2px of headroom, so strip height is
constant.

## 4. t = 0 / 2.5 / 5 s, zero input

Evaluating `n(t)` and the 2-unit division:

- **t=0:** `n = 0 + 1.186 + 1.364 = +2.55` → indicator reads **+2 u**; lamp
  **lit** (`dn/dt` at t=0 is 6.47 u/s, over the 3.6 threshold); deck at
  +0.68 px.
- **t=2.5:** `n = −3.40 + 1.105 + 0.325 = −1.97` → indicator reads **−2 u**;
  lamp **dark**; deck at +0.36 px.
- **t=5:** `n = −0.324 − 2.081 − 0.962 = −3.37` → indicator reads **−4 u**;
  lamp **dark**; deck at +0.26 px.

Three different digit strings and two different lamp states, with zero input,
zero hover, no autoplay. One always-running rAF loop.

## 5. Reduced-motion freeze frame

**`STATIC_TIME = 1.05 s`** into a canned "accept ANALYTICS" transaction
(`Δload = +1,240 u` placeholder).

At 1.05 s the reading is **still ringing**, sitting 11% above target on the
second overshoot; the **motion lamp is lit**; the ticket button is rendered in
its `aria-disabled` waiting state with its helper line visible; the barrier is
**down**; the deck is deflected **2.4 px** with two load cells visibly
compressed to 4.4 px. This is the only frame in which the *gate itself* is on
screen — an unsettled number, a lit lamp, and a commit that is refusing — and
that gate is the whole component. The resting frame shows a still number, a
dark lamp and an armed button, which is indistinguishable from an ordinary
consent bar.

All quantities at 1.05 s are constants, so the frame is byte-stable across
runs. Under reduced motion, load changes jump instantly to target, the ring is
skipped, and the arming dwell drops to 0 — the gate stays *semantically*
present (`aria-disabled` for one frame) without any motion.

## 6. Hue carried by luminance, both themes

| element | token | light | dark |
|---|---|---|---|
| deck plate | `--foreground` @ 0.42 | 0.42 | 0.50 |
| load cells | `--ns-muted` | 1.0 | 1.0 |
| indicator digits | `--foreground` | 1.0 | 1.0 |
| trailing (noisy) digit | `--foreground` @ 0.62 | 0.62 | 0.68 |
| motion lamp, lit | `--foreground` @ 0.50 fill | 0.50 | 0.58 |
| motion lamp, dark | `--border` 1px outline, no fill | — | — |
| tolerance band marks | `--border` | 1px stroke only | 1px stroke only |
| barrier boom | `--foreground` @ 0.55 | 0.55 | 0.62 |
| strip top edge | `--border` | 1px stroke only | 1px stroke only |

There is no hue and no red/green "accepted/rejected" pairing anywhere. A
chip's on/off state is carried by **switch-thumb position plus a 2px filled
track segment**, and additionally by its label weight (500 → 620) — geometry
and weight, never tone. The motion lamp's two states differ by **fill vs
outline**, a shape difference, not a brightness difference, because
`--border` in light theme is a ~1.1:1 separator and could not carry the
distinction alone. Light theme is verified first for exactly that reason.
`--ns-accent` appears **only** on `:focus-visible` rings and on the primary
ticket button's fill — never on the deck, digits, lamp, boom, or band marks.

## 7. Accessibility

**Not a dialog.** The strip is
`<section role="region" aria-labelledby="wb-heading">` at the end of `<body>`,
**non-blocking** — it does not trap focus and does not cover content (the page
reserves `H` px of bottom padding while it is present). Modal consent walls
are both hostile and an a11y liability; this is a strip, not a wall.

**First-render focus.** On first paint, focus moves once to the strip's
`<h2 id="wb-heading" tabindex="-1">` — the standard pattern for a non-modal
notice that must not be missed. It does **not** steal focus again on
subsequent renders.

**Escape.** Escape while focus is inside the strip **collapses** it to a small
persistent "Cookie choices" button in the footer and returns focus to the
element that had it before the strip appeared. Escape **never** silently
accepts or rejects anything, and the collapsed button reopens the strip in the
same state. Escape outside the strip is not consumed.

**Chips.** Each scope is
`<button role="switch" aria-checked="true|false" aria-describedby="wb-w-N">`
with a visible text label; `wb-w-N` is the visible weight text ("1,240 u"), so
the weight is part of the accessible description rather than a decorative
number. `role="switch"` + `aria-checked` is exactly what
`scripts/verify.ts`'s ARIA audit asserts. The mandatory `SESSION` scope is
`aria-disabled="true"` with `aria-describedby` explaining that it cannot be
turned off — never a `disabled` attribute, so it stays readable and
discoverable by keyboard.

**The ticket button while waiting.** `aria-disabled="true"` and **still
focusable** — never the `disabled` attribute. A control that leaves the tab
ring for 1.9 s in the middle of an interaction is a real bug: a keyboard user
who tabs to it during the settle would land somewhere else. Activating it
while `aria-disabled` **queues** the commit (the pre-arm above) and announces
"Queued — waiting for the reading to settle."

**Focus order.** Heading → each scope switch in visual left-to-right order →
Reject all → Accept all → Save choices. Reject and Accept are **adjacent, the
same size, and the same visual weight**; the ticket button is the only one
carrying `--ns-accent`. No focus trap, no arrow-key hijack, so page scroll
keys keep working while the strip is present.

**aria-live.** One `role="status"` (`aria-live="polite" aria-atomic="true"`)
line, which announces **only two things**:
1. the pre-arm queue message above, and
2. the certified result: *"Weight certified. 2 of 4 categories accepted."*

It **never** announces the hunting reading, the lamp, or the deck. A live
region that read out a flickering number would be unusable, and the number is
ornament until it certifies.

**What a screen reader hears, end to end.** "Cookie choices, heading, level 2"
→ "Analytics, switch, on, 1,240 u" → Space → (silence while the deck rings;
the lamp is not announced) → "Weight certified. 3 of 4 categories accepted." →
Tab → "Save choices, button".

**Contrast.** Digits and labels are `--foreground` on `--background`
(>= 12:1 both themes); the trailing digit at 0.62 alpha is checked at >= 4.6:1
in both themes because it is real text, not ornament. Focus ring 2px
`--ns-accent` at 2px offset; chip padding is 10px so rings never clip.

**Gate descriptor.** No `openBy` — the strip is visible at rest and the gate's
default screenshot is the resting frame, which is where the aliveness lives.

## 8. Behaviour in a short /preview card viewport

At 400x260: `H = clamp(64, 67.6, 96) = 68` px. The strip reflows to **two
rows** — chips on row 1, indicator + lamp + buttons on row 2 — and the
indicator drops from 5 digits to **4**, keeping the noisy trailing digit
(otherwise the resting loop would be cropped out of the card, which is the
exact "gate sees a dead frame" failure `docs/showpiece-recipe.md` records).

The deck elevation compresses to `min(180, 88) = 88` px with **two** load
cells instead of four; a two-cell weighbridge is a real (portable axle-pad)
scale, so the reduction is honest rather than a crop. The barrier boom is
omitted below `hostW = 340` — it is decorative confirmation and the ticket
text carries the same information.

Because the resting loop lives entirely in the indicator digit, the lamp and
the deck, and none of those depends on interaction, the card's t=0/2.5/5 gate
passes at 400x260 with no `autoplay` flag and no pointer input.

## 9. Addendum — GAP-MAP §3.5 exposure

§3.5 names the small mechanism metaphor as the most-rejected shape in the
registry, and this component draws a deck on load cells. The defence is
structural, not rhetorical: **the mechanism here is behavioural, not a
drawing.** The component's claim is the no-motion filter — a commit control
that refuses a number which is still moving — and that claim survives intact
with the deck elevation deleted entirely. The deck, the cells and the boom are
illustration; the indicator, the motion lamp and the arming dwell are the
component. Every removed §3.5 slug was the inverse: a drawing whose deletion
would have cost nothing.

**Build instruction:** if the deck elevation reads as a badge at card scale,
cut it before cutting anything else. The indicator, lamp and dwell must not be
touched — they carry both the mechanism and the resting loop.
