# lantern-dial — section progress as an elevator indicator and hall lantern

## 1. Surface replaced + real process

**Surface:** the **anchor / section progress indicator** on a long landing
page — the persistent rail that shows which section you are in and lets you
jump to another.

**Real process:** the pre-digital **passenger-elevator lobby position
indicator** and its **hall lantern** (Otis and contemporaries, 1920s-1960s).
The dial is a semicircle of floor numbers with a counterweighted pointer,
driven from the machine room by a **selector** — a miniature model of the
shaft with a carriage on a lead screw, geared to the hoist motor. Three real
properties are the reason to steal it:

1. The pointer moves **continuously and can sit between floors**; it is
   mechanically incapable of stepping.
2. It **lags** the car, because it is driven through a gear train, so it
   smooths a jerky ride into a readable sweep.
3. The **hall lantern lights before the car arrives** — up or down, on the
   approach, so waiting passengers know which way it is going *before* the
   doors open. The indicator anticipates; it does not merely report.

## 2. Nearest existing slug — why this is not a restyle

Nearest: **`toc-minimap-mercury`**, **`scroll-caliper`**, **`storey-pole`**,
**`decatron-step-ring`**.

`toc-minimap-mercury` is a **linear fill** whose idea is liquid surface
tension — a gooey blob climbing a rail and absorbing ticks. `scroll-caliper`
measures the active section's **extent** with vernier jaws. Neither
anticipates anything: both are strict functions of the present scroll value.
`lantern-dial`'s signature is the opposite — the lantern is driven by
`velocity * lookahead`, so it commits to a direction **before** the pointer
gets there, and can be wrong and correct itself, which no existing slug does.

`storey-pole` shares the building but not the instrument: it is an
architectural **cross-section** you pick a floor from, drawn at real relative
heights, and it is static. `decatron-step-ring` is the sharpest contrast —
a glow spot **stepping** between ten discrete cathodes, structurally unable to
be between stations, where this pointer is almost always between floors.

## 3. The mechanic — numbers

Geometry from `S = min(hostW, hostH)`.

- **Dial:** arc radius `R = clamp(28, 0.16 * S, 44)` px, sweep **152°**
  (`−76°` to `+76°` from vertical). Floor marks at even angular spacing:
  `Δ = 152 / (floors − 1)` degrees. 1px `--border` arc, 3px marks.
- **Pointer:** 1px needle from hub to `R − 3`, with a **3px counterweight
  tail** on the opposite side (real indicator needles are counterweighted, and
  the tail is what makes the rotation legible at card scale).
- **Scroll mapping:** `θ = −76 + 152 * p`, where `p` is document scroll
  progress, passed through the **selector's gear lag** — a first-order lag,
  `tau = 165 ms`. The lag is real and is why a jerky trackpad scroll produces
  a smooth pointer.
- **Hall lantern:** two 9x7 px arrows above the dial.
  `lookahead = scrollVelocity * 0.42 s`; if `p + lookahead` crosses the next
  floor boundary, the matching arrow fades in over **140 ms**, and out over
  **320 ms**, with a **620 ms minimum lit time** so it can never strobe. The
  minimum lit time is both a real anti-flicker requirement and the perceptual
  budget's guarantee.
- **Hall call:** activating a floor link scrolls to that section on a spring
  `k = 96, c = 19.5, m = 1` (**ζ = 0.995**, no overshoot). The pointer sweeps
  every intervening floor because it is driven from real scroll position — it
  is not animated separately, which is the honest part.

**Ambient loops (unconditional):**

```
selector thread   9x9 px window showing a 3-thread lead screw,
                  3 px thread pitch, translating at 3.70 px/s, forever.
                  (An old Otis machine-room MG set idles all day.)
re-level          pointer drifts off its floor mark by up to 0.90 deg
                  over 3.90 s, then corrects over 210 ms with a
                  0.20 deg overshoot.  Cycle 4.11 s.
in-service pilot  3x3 px dot, alpha 0.34 + 0.18*(0.5+0.5*sin(2*pi*t/2.70))
```

3.70 px/s on a 3 px pitch, 4.11 s and 2.70 s are mutually incommensurate, so
the resting state never repeats.

**Perceptual budget (explicit):** at rest the moving elements are a 9x9 px
thread window, a needle tip travelling **≤ 0.9°** (0.7 px of arc at `R = 44`),
and a 3x3 px pilot dot — total **~95 px²**, i.e. **0.9%** of a 120x100
instrument. Peak per-frame luminance change is **0.09 L**, and it is confined
to the 3x3 pilot. **The floor labels — the only text — never move, fade, or
reflow**; the current floor is marked by weight and a filled arc mark, both
static properties. The instrument lives in a fixed 120px gutter with **24 px**
of clearance to the nearest body measure, and the lantern's 620 ms floor means
no arrow can flicker beside reading text.

## 4. t = 0 / 2.5 / 5 s, zero input

- **t=0:** thread phase **0.00** of its 3px pitch; pointer re-level offset
  **0.00°**; pilot alpha **0.340**; both arrows dark.
- **t=2.5:** thread has translated **9.25 px** → phase **0.25**; re-level
  offset **+0.577°** (needle tip 0.44 px off its mark at `R = 44`); pilot
  alpha **0.389**.
- **t=5:** thread at **18.50 px** → phase **0.50**; the 4.11 s re-level cycle
  has wrapped, so the offset is **+0.205°** — a *third* value, not a repeat of
  either earlier sample; pilot alpha **0.358**.

The three thread phases (0.00 / 0.25 / 0.50) alone guarantee three distinct
rasterised frames in a 9x9 window. One always-running rAF loop; nothing gated
on hover, scroll, focus, or `autoplay`.

## 5. Reduced-motion freeze frame

**`STATIC_TIME = 1.15 s`** into a canned 3.4 s floor-2 → floor-3 travel, with
the ambient thread phase pinned at 0.62 and the pilot at alpha 0.44.

At 1.15 s the pointer sits **62% of the way between the floor-2 and floor-3
marks** — visibly *between* two marks, which is the one thing a stepped
indicator can never show — and the **up arrow is lit while the pointer has not
yet arrived**, which is the lantern's whole premise. The selector thread is
mid-pitch and the pilot is above its floor. Every claim the component makes is
on screen at once.

t=0 is the worst frozen frame available: the pointer parked exactly on a mark
with both arrows dark, which is indistinguishable from a printed dial.

All quantities are constants (`62%`, `up`, `0.62`, `0.44`), so the frame is
byte-stable across runs. Under reduced motion, hall calls jump instantly, the
pointer is placed at the destination with no sweep, the lantern does not
animate, and focus still moves per §7.

## 6. Hue carried by luminance, both themes

| element | token | light | dark |
|---|---|---|---|
| dial arc | `--border` | 1px stroke only | 1px stroke only |
| floor marks | `--ns-muted` | 1.0 | 1.0 |
| current floor mark | `--foreground` @ 0.85, **filled** | 0.85 | 0.90 |
| pointer needle | `--foreground` @ 0.78 | 0.78 | 0.85 |
| counterweight tail | `--foreground` @ 0.50 | 0.50 | 0.58 |
| lantern arrow, dark | `--border` outline, no fill | — | — |
| lantern arrow, lit | `--foreground` @ 0.72, **filled** | 0.72 | 0.80 |
| selector thread | `--foreground` @ 0.26 | 0.26 | 0.32 |
| pilot dot | `--foreground` @ 0.34-0.52 | as given | +0.06 |
| floor labels | `--ns-muted` / `--foreground` | — | — |

No hue anywhere. Both binary states in the component — arrow lit/dark and
floor current/not — are carried by **outline vs fill**, a shape difference,
because `--border` is a ~1.1:1 separator in light theme and cannot carry a
state distinction on tone alone. The current floor label is additionally
distinguished by **font weight (500 → 620)**, so the current-section signal
survives for low-vision users, in forced-colours mode, and in a greyscale
print. Light theme is verified first: the selector thread at 0.26 alpha is the
faintest mark and is allowed to be quiet — the pointer, not the thread, is the
component's readable signal. `--ns-accent` appears **only** on
`:focus-visible` rings of the floor links.

## 7. Accessibility

**Structure.** `<nav aria-label="Sections">` > `<ol>` > `<li>` > `<a href="#id">`,
one per section, with **visible text labels** laid out along the arc (the arc
positions the labels; it does not replace them). The dial, pointer, lantern,
selector window and pilot are one
`<svg aria-hidden="true" focusable="false">`, `pointer-events: none`.

**Current section.** The active link carries **`aria-current="location"`** —
the correct token for "current position within a page or environment"
(`aria-current="page"` would be wrong; the page has not changed). It is
updated from the same scroll observer that drives the pointer.

**Focus order.** Document order = arc order top-to-bottom = visual order. The
nav is a landmark, **not** a `role="toolbar"` and not a tablist, so
**Tab/Shift-Tab step through every floor link and arrow keys are left alone**.
That is a deliberate refusal: a section rail that captures `ArrowUp` /
`ArrowDown` breaks the primary way keyboard users scroll a landing page, and
this component sits on a page whose entire purpose is to be scrolled.

**Escape.** Escape **cancels an in-flight hall call**, stopping the scroll
spring where it is and leaving focus where it is — "stop the motion" is the
right meaning of Escape for a scroll animation. When no call is in flight,
Escape is a **no-op and is not consumed**. There is nothing to trap and no
dialog, so there is no focus trap.

**Activation.** `Enter` on a link runs the hall call. On arrival (or
immediately, under reduced motion) focus moves to the destination section's
`<h2 tabindex="-1">`. This is required, not optional: scrolling without moving
focus leaves a keyboard user's tab position in the previous section, so their
next Tab press throws them backwards up the page.

**aria-live: none, and this is the deliberate call.** Two candidate live
regions were considered and both rejected:
- *Announcing the current section as the user scrolls* — rejected. The user
  took no action aimed at this component, and a polite region firing on every
  section boundary during a long scroll is relentless and drowns out the page.
  `aria-current` already carries the state for anyone who navigates to the rail.
- *Announcing hall-call arrival* — unnecessary. Focus moves to the destination
  heading, which the screen reader announces naturally and more usefully than
  a synthetic string would.

The lantern, pointer, thread and pilot carry **zero** information and are
never announced in either motion mode.

**What a screen reader hears, end to end.** "Sections, navigation, list, 6
items" → "Pricing, link, current location, 3 of 6" → Enter → "Pricing,
heading level 2". The instrument is silent throughout.

**Contrast.** Floor labels are `--ns-muted` (>= 4.6:1 both themes, checked,
since they are real text at body scale) and `--foreground` at weight 620 when
current. Focus ring 2px `--ns-accent` at 2px offset; each label carries 6px of
padding so a ring never clips against the dial arc.

**Forced colours.** In `forced-colors: active` the arc and marks render in
`CanvasText`, the lit arrow and current mark in `Highlight`, and the fill/
outline distinction is preserved — the mechanism survives as pure geometry.

## 8. Behaviour in a short /preview card viewport

At 400x260: `S = 260`, so `R = clamp(28, 41.6, 44) = 42` px and the dial plus
four floor labels fits a 120px gutter down the card's trailing edge, with the
card body as its own scroll container. Wheel or drag inside the card drives
`p`, `scrollVelocity`, the lag, and the lantern exactly as page scroll would,
so the anticipation behaviour is exercisable inside the card and not only on a
full page.

Section count is capped for the card: at `hostH < 320` only **4** floors are
rendered on the arc (first, current, next, last) with the elided floors
collapsed into a single unlabelled 2px mark — a real indicator on a service
elevator does exactly this for express zones. The `<ol>` in the DOM still
contains **every** section link, so nothing is removed from the tab ring or
from a screen reader; only the arc's labelling is abbreviated.

Below `hostW = 300` the labels reduce to numerals with the full section name
carried in each link's `aria-label`, so the accessible name is never lost.
`R` floors at 28 px. The selector window, re-level cycle and pilot are
independent of size and run unchanged, so the card's t=0/2.5/5 gate passes
with zero interaction and without the `autoplay` flag.

## 9. Addendum — signalling quarantines and the §3.5 filter

**Disambiguation from the r10-r12 quarantines.** Four cut components sit near
signalling lamps and arms: `semaphore-arm-cast`, `semaphore-arm-tension`,
`flag-hoist-run` and `fresnel-flash-group` (the last is a lighthouse flash
group). Two of those are the same mechanic tried twice and cut twice, which is
a standing warning against anything that encodes meaning in a flashing or
gesturing signal. This component is **not** in that family: a hall lantern is a
two-state direction arrow attached to a position readout, its lit state is
carried by **fill vs outline** rather than by flashing, and it has a hard
**620 ms minimum lit time** precisely so it can never read as a signal lamp
blinking beside body copy. A lighthouse-characteristic concept was separately
killed in this slice for exactly the reason those four were cut.

**GAP-MAP §3.5 exposure — the selector window is the exposed part.** §3.5
names gear trains and lead screws among the most-rejected shapes. The 9x9 px
selector window in §3 is a lead screw in a box, and it is the one element here
that could read as a mechanism badge. It survives on the grounds that it is the
**actual drive** for the pointer rather than an ornament beside it — the dial's
lag (`tau = 165 ms`) is the selector's gear train, so the window explains a
behaviour the user can see. **Named build risk, and the fix if the owner reads
it as a badge:** delete the selector window and carry the resting loop on the
needle instead — a real mechanical indicator needle quivers, so `±1.5°` at
`0.8 Hz` (1.1 px of tip travel at `R = 44`) plus the existing re-level cycle
and in-service pilot keeps t=0/2.5/5 distinct without any gear drawing. The
builder should prototype both and put the window's fate in the review notes
rather than defending it silently.
