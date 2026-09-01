# blind-recoil — mobile menu sheet as a spring roller blind with a gravity pawl

## 1. Surface replaced + real process

**Surface:** the mobile / narrow-width **menu sheet** that drops from a
landing page's header, plus its trigger.

**Real process:** the **self-acting spring roller blind** (Stewart Hartshorn,
1864 — the mechanism in most roller shades still sold). A coiled flat spring
lives inside the roller tube. At one end cap a small pivoted **gravity pawl**
rides a shaped race: pull the blind down and release, the pawl falls into a
notch and locks it there; give a short extra tug **downward** and the pawl
swings clear of the race, releasing the spring so the blind retracts fast and
slaps the bracket. Two properties make it worth stealing: spring torque is
**position-dependent** (the further out, the harder it pulls back), and the
blind can only rest at **discrete notches** — so partial-open is a real,
mechanically-defined state, not a slider value.

## 2. Nearest existing slug — why this is not a restyle

Nearest: **`drawer-counterweight`**, **`nav-site-condense`**, and the
`curtain-*` family.

`drawer-counterweight` hangs its panel on a **counterweight** — a mass moving
opposite the drag, which makes the panel *neutrally buoyant at every
position* and able to rest anywhere it is released. A spring roller is the
exact inverse: stored energy rises with extension, so the sheet always wants
to retract and gets heavier to hold the further you pull, and it can rest
**only** at pawl notches. That produces an interaction neither the drawer nor
any curtain has: **to close it you must first pull it further open.**
`nav-site-condense` already owns the plain `<dialog>` mobile sheet, which is
why this spec keeps its `<dialog>` (proven a11y) and replaces only the motion
law; the curtains are hoisted by lines from above with no stored energy, no
detents, and no release gesture.

## 3. The mechanic — numbers

Geometry from `S = min(hostW, hostH)`; extension `E = min(hostH − headerH,
0.86 * hostH)`.

- **Detents** at `x = 0.34E, 0.68E, 1.00E`, matching the sheet's three content
  bands (primary nav / secondary links / CTA + footer). Notches are drawn on
  a 3px `--border` race inside the end-cap window.
- **End-cap window:** `16 x 16` px at the header's trailing edge (`13 x 13`
  below `S = 400`). Contains the race, three notches, and the pawl — a 7px
  arm on a 2px pivot.
- **Roller radius** `R = 9 px`; hem travel maps to roller rotation as
  `θ = travel / (2πR)` revolutions.

**Ambient creep (the unconditional resting loop).** A tensioned spring blind
genuinely creeps: fabric relaxes and the roller unwinds a millimetre or two
until the pawl re-seats with a tick. Modelled exactly:

```
creep rate      0.62 px/s              // hem bar drifts down
creep travel    4.00 px                // then the pawl re-seats
re-seat         90 ms, up 4.00 px, 0.7 px overshoot, k=620 c=30 m=1
cycle           6.45 s + 0.09 s = 6.54 s, unbounded, never resets
pawl rotation   4.00 px / (2π*9) = 0.0707 rev = 25.5 deg per cycle
```

**Pull (pointer drag).** The hem tracks the pointer with a position-dependent
lag `x_lag = 0.055 * E * (x/E)` — 0 px at the top, 0.055E at full extension.
That lag *is* the rising spring torque, felt rather than drawn.

**Seat on release.** If `|x − nearestDetent| < 0.06E` **and** release velocity
`> −140 px/s`, the pawl seats: hem moves to the detent over 160 ms on
`k = 520, c = 40, m = 1` with a 1.1 px overshoot, and the pawl rotates **34°**
into the notch over the same window.

**Release and retract.** Drag **down** past the current detent by `> 18 px`
and release (or press Close, or press Escape — all three run the identical
path): the pawl swings **62° clear** of the race over 90 ms, then the sheet
retracts under a real second-order law, not an ease curve:

```
x'' = -14.7 * x - 2.6 * x'        (fractions of E; zeta = 0.34)
```

Full-extension retract reaches x=0 in **~410 ms**, rebounds **4.2% of E** off
the bracket, and settles by 780 ms. One bounce, exactly like a real blind.

**Fabric.** The sheet is `--background` with a 2px-period cross-hatch weave at
`--foreground @ 0.045` — a static texture that translates *with* the sheet, so
it reads as material rather than as a moving pattern.

**Perceptual budget (explicit):** at rest the only moving things are a
`hostW x 3px` hem rule creeping at **0.62 px/s** and a 7px pawl arm rotating
at **3.9 °/s**, inside a 16x16 window. Both are far below the ~1-2 px/s
peripheral motion-detection floor for a thin low-contrast line, so the header
reads as **still** — while still being **measurably** different frame to
frame, which is exactly what the gate needs and what nav chrome next to body
copy demands. Moving area at rest is **0.31%** of the header, peak per-frame
luminance change **0.06 L**. The hem sits in a reserved 12px band below the
header and page content starts 16px below that band's **maximum** creep
extent, so no reflow is possible at any creep phase.

## 4. t = 0 / 2.5 / 5 s, zero input (sheet closed)

- **t=0:** hem at creep 0.00 px; pawl at 0.0°; race notch 1 empty.
- **t=2.5:** hem at **1.55 px**; pawl at **9.9°**. The pawl arm's tip has moved
  1.2 px inside the 16px window.
- **t=5:** hem at **3.10 px**; pawl at **19.8°**. Tip moved 2.4 px from t=0.

All three frames differ by whole pixels in both the hem rule's y and the
pawl's tip, and the cycle (6.54 s) is long enough that no two of the three
sample points ever alias onto each other. Driven by a single always-running
rAF loop with no autoplay, hover, scroll, or open-state gating.

## 5. Reduced-motion freeze frame

**Sheet rendered open at detent 2 (`x = 0.68E`), pawl seated, ambient creep
phase frozen at `t = 4.90 s`** (hem creep 3.04 px, pawl 19.4°).

Chosen because it is the only frame that shows all four parts of the
mechanism at once: the sheet extended over the page, the pawl **inside** a
notch, the two un-reached notches still empty on the race, and two of the
three content bands revealed with the third still rolled. A closed header
(t=0) shows a bare rule and a 16px window and explains nothing; a fully
extended sheet hides the detent story entirely because notch 3 is the last
one and there is nothing left un-reached.

Every quantity is a constant (`0.68E`, notch 2, `3.04 px`, `19.4°`), so the
frame is byte-stable across runs. Under reduced motion, open/close are
**instant** — no travel, no retract, no bounce — while the frozen creep phase
keeps the resting frame identical to the animated one's t=4.9 s.

## 6. Hue carried by luminance, both themes

| element | token | light | dark |
|---|---|---|---|
| sheet fill | `--background` | opaque | opaque |
| fabric weave | `--foreground` @ 0.045 | 0.045 | 0.060 |
| hem bar (3px) | `--foreground` @ 0.55 | 0.55 | 0.62 |
| race + notches | `--border` | 1px / 3px stroke only | same |
| pawl arm | `--ns-muted` | 1.0 | 1.0 |
| pawl **seated** marker | `--foreground` @ 0.70 | 0.70 | 0.78 |
| end-cap ring | `--border` | 1px stroke only | same |
| link labels | `--foreground` | 1.0 | 1.0 |

Seated vs clear is carried by **the pawl's angle plus a filled 3px dot at the
pivot**, a shape difference — never by a tone change, because `--border` is a
~1.1:1 separator in light theme and cannot carry a state distinction on its
own. Light theme is checked first: the fabric weave at 0.045 over a light
`--background` is the faintest mark in the component and is allowed to
disappear; the sheet's readability rests on its opaque fill and its 1px
`--border` bottom edge, not the weave. `--ns-accent` appears **only** on
`:focus-visible` rings and the sheet's CTA button — never on hem, pawl, race,
fabric, or notch.

## 7. Accessibility

**Structure.** Trigger: `<button aria-expanded aria-controls="blind-sheet">`.
Sheet: a native **`<dialog>`** opened with `showModal()` — the free, correct
focus trap and Escape handling, reusing the pattern `nav-site-condense`
already proved in this repo. This one **is** modal (unlike a mega-menu), so
trapping is right.

**Partial extension and the tab ring — the load-bearing detail.** At detent 1
the sheet shows band 1 only. Bands 2 and 3 are physically below the hem and
must not be reachable: unrevealed bands carry **`inert` + `aria-hidden="true"`**
and are removed from the tab ring entirely. Seating a new detent removes
`inert` from exactly the newly revealed band. Without this, a keyboard user
tabs to a link hidden behind a rolled blind — the defining a11y bug of any
partially-revealed panel.

**Keyboard users are never forced into a partial reveal.** Activating the
trigger by keyboard opens straight to **detent 3 (full)**. Dragging is a
pointer affordance; the detents exist for thumbs.

**The position control.** The hem bar carries a focusable
`role="slider" aria-label="Menu extent" aria-valuemin="1" aria-valuemax="3"
aria-valuenow aria-valuetext="Primary links | Secondary links | Everything"`.
`ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight` step one detent, `Home` → 1,
`End` → 3, `PageUp`/`PageDown` → 3/1. The menu is **fully usable without ever
focusing it** — it is an enhancement, not a required step.

**Escape.** Handled once, at the dialog. The native `cancel` event is
`preventDefault`ed so the pawl-release + retract runs, then `close()` fires on
`animationend`; under reduced motion `close()` is called synchronously.
Focus returns to the trigger in both paths. Escape when the sheet is shut is
**not** consumed by this component.

**Focus order.** Trigger → (open) Close button → hem slider → revealed band 1
links in DOM order → band 2 → band 3 → CTA → wraps to Close (native dialog
trap). Visual order matches DOM order top-to-bottom.

**aria-live.** One `aria-live="polite" aria-atomic="true"` region, announcing
**only detent changes**: e.g. "Menu extended to secondary links. 8 of 14 items
shown." Throttled to one announcement per 400 ms so a fast drag through two
detents announces once. The ambient creep and the pawl's rotation are
**never** announced — they carry no information. Opening and closing are
already carried by `aria-expanded` and the dialog boundary and get no extra
announcement.

**What a screen reader hears, end to end.** "Menu, button, collapsed" →
activate → "Menu, dialog" → "Close menu, button" → "Menu extent, slider,
Everything" → "Product, link" ... → Escape → "Menu, button, collapsed". The
mechanism is silent throughout.

**Gate descriptor.** `openBy: "button[data-blind-trigger]"`,
`expect: "[data-blind-marker]"` — a dedicated 8x8 `<rect>` inside band 1, at a
point the rolled sheet genuinely occludes and the extended sheet genuinely
clears. Not the hem bar and not the end cap: both render identically open and
shut, which is the exact trap `docs/review-workflow.md` records the
`curtain-*` components falling into.

**Contrast.** Link labels `--foreground` on the opaque `--background` sheet
(>= 12:1 both themes). Focus ring 2px `--ns-accent` at 2px offset; band
padding is 10px so a ring on the first link never clips under the hem bar.

## 8. Behaviour in a short /preview card viewport

At 400x260: `headerH = 44`, `E = min(216, 224) = 216`. Detents land at
**73 / 147 / 216 px**, so all three bands still exist with two links per band
— the mechanism is not degraded to a binary open/shut. The end-cap window
drops to 13x13 and `R` to 7px, which raises creep rotation to **32.7° per
cycle** (`4.0 / (2π*7)`), making the pawl *more* legible at card scale, not
less. `showModal()` inside the preview iframe covers the card, which is the
same behaviour the `curtain-*` components already ship.

The ambient creep runs identically whether the sheet is open or shut, so the
card's t=0/2.5/5 gate passes in the **closed** resting state that
`/preview/<name>` screenshots — no `autoplay` dependency. Below 300 px wide
the sheet drops to two detents (`0.5E, 1.0E`) and two bands; the race renders
two notches and the pawl law is unchanged.

## 9. Addendum — GAP-MAP §3.5 exposure, and the rename

`GAP-MAP.md` §3.5 names the **small mechanism metaphor** (ratchet, escapement,
**pawl**, detent, gear train, flywheel, governor, cam, capstan, crank) as the
single most-rejected shape in this registry's history: 15 of the 59 removals
came out of one "slop/duplicate" commit and almost all were this shape
(`barrel-bolt`, `torsion-latch`, `dashpot-latch`, `cog-rail`, `feeler-gap`,
`slack-reel`). This component uses a pawl, so it must clear that filter
explicitly rather than by assertion.

**The slug was renamed `blind-pawl` → `blind-recoil`** so the name leads with
the sheet's behaviour rather than with a part on §3.5's list.

**Why it is not the rejected shape.** Every removed component in that commit
was *a mechanism drawn beside a small control* — a bolt on a button, a latch on
a toggle — where the metaphor was decoration attached to something that
already worked without it. Here the roller blind **is the sheet**: it occupies
the viewport, it is the entire open/close motion, and the mechanism determines
behaviour the component could not otherwise have (position-dependent torque,
three real detents, close-by-pulling-further-open). Delete the pawl and you do
not get a cleaner mobile menu; you get a different, worse one that can no
longer rest anywhere but fully open or fully shut. The 16x16 end-cap window is
the smallest part of the component, not its subject.

**The countervailing evidence.** `GAP-MAP.md` #9 names "a mobile sheet that is
a component rather than a page" as one of exactly two missing pieces in site
nav, and the registry has none. This answers a twice-named open gap; the
removed §3.5 components answered nothing.
