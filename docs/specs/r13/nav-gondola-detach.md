# gondola-detach — floating CTA dock on a detachable-grip ropeway

## 1. Surface replaced + real process

**Surface:** the persistent floating CTA dock that rides above landing-page
content — one primary action plus 3-4 secondary links, pinned bottom-centre.

**Real process:** the **detachable-grip aerial gondola lift** (Doppelmayr
UNI-G / Leitner terminals, in service on hundreds of lifts). The haul rope
runs at a constant 6.0 m/s and **never stops**. Each cabin's spring-loaded
grip is forced open by a cam rail at the terminal entry; the cabin transfers
onto a tyre conveyor, decelerates to ~0.35 m/s across the loading platform,
then accelerates back to line speed and the cam releases the grip onto the
rope. The entire point of the mechanism is that the *carrier slows down
exactly where a human has to read/act, while the drive never pauses.* That
is the perceptual-budget answer built into the reference itself.

## 2. Nearest existing slug — why this is not a restyle

Nearest: **`passing-loop`** (funicular, two cars on one cable over a summit
pulley) and **`dock-shelf-lean`** (dock items leaning like books).

`passing-loop` is a *counterbalance* claim: its two cars are geometric
complements of each other, one cannot move without the other moving
oppositely, and it is a rollout controller — the mechanism exists to make
two shares sum to 1. `gondola-detach` asserts the opposite topology: a
single continuously-circulating loop where carriers are mechanically
*decoupled* from the drive, so carrier count, carrier spacing and carrier
speed are all independent of the rope. `dock-shelf-lean` never moves at
rest and never moves a carrier — it is a hover/focus posture system on a
static row. Neither has a drive that runs unconditionally.

## 3. The mechanic — numbers

Geometry derived from `S = min(hostW, hostH)`.

- Dock height `H = clamp(44, 0.16 * S, 56)` px. Radius `H/2`.
- **Haul rope:** 1px horizontal line at `y = 0.42H`. **Return rail:** 1px at
  `y = 0.86H`. Both span the dock's inner width `W`.
- **Rope lay:** the rope is drawn as a 1px stroke whose alpha is modulated
  by `0.35 + 0.25 * (0.5 + 0.5*sin(2π*(x - phase)/LAY))`, `LAY = 6px`.
  `phase += v_rope * dt` every frame. This is the unconditional loop: the
  rope surface translates even with zero carriers on screen.
- **Line speed:** `v_rope = clamp(26, 62 * (S / 260), 62)` px/s. On a
  960x120 dock that is 62 px/s; in a 400x260 preview card, 62 px/s; in a
  320x180 card, 43 px/s. Loop period stays inside 30-46 s at every size.
- **Carriers:** 5. Each is a 7px-tall vertical jaw glyph (two 1px strokes,
  gap `g`), never a text label. Copy never rides the rope.
- **Station:** the centre `L_s = min(0.44W, 420)` px of the rope.
- **Grip release** on station entry: jaw gap `g` eases `0 → 7px` over 380ms,
  `cubic-bezier(.32,.72,.2,1)`. Carrier speed then decays exponentially
  toward dwell speed with `tau = 260ms`.
- **Dwell speed:** `v_dwell = 0.42 * v_rope` (26 px/s at full size). Station
  crossing ≈ 16 s.
- **Re-grip** on station exit: speed rises `v_dwell → v_rope` over 520ms
  (same easing), then `g` closes `7 → 0` over 240ms with a 1px overshoot
  that settles on a spring `k = 340`, `c = 26`, `m = 1`.
- **Carrier spacing** on the rope is set by departure cadence, not by
  position: a carrier leaves the station every `T_dep = 8.2 s`. Because they
  are detached, spacing on the rope is uniform and spacing in the station is
  not — which is exactly what a real detachable lift looks like from below.
- Total circuit ≈ 40 s at 960px, 34 s at 400px.

**Perceptual budget (explicit):** at most **4.1%** of the dock's pixel area
is non-static at any frame (rope 1px x W + return 1px x W + 5 carriers x
7x3px, against `H >= 44`). Peak per-frame luminance change on any single
pixel is **0.09 L** (the lay stipple's alpha swing 0.35→0.60 on `--ns-muted`).
No moving element comes within **14 px** of any chip label's cap-height box:
the rope sits at `0.42H` and labels are vertically centred on `0.42H` too,
so the rope is drawn **behind** the chips and clipped by each chip's own
rounded rect with a 5px inset — the rope visibly passes *behind* the copy
and is never overdrawn on it.

## 4. t = 0 / 2.5 / 5 s, zero input

- **t=0:** lay phase 0. Carriers at rope-x 0.06W, 0.31W (entering station,
  jaw gap 4px), 0.50W (dwelling, jaws open), 0.74W (re-gripping), 0.93W (on
  the return rail).
- **t=2.5:** lay stipple has translated 155px (25.8 lay periods) — the whole
  rope surface has visibly crawled. The 0.06W carrier has advanced 155px.
  The dwelling carrier has advanced 65px and is now past dock centre. The
  re-gripping carrier has closed its jaws and is at line speed.
- **t=5:** lay phase +310px. The lead carrier has entered the station and its
  jaws are half open; the previously dwelling carrier is 130px further right
  and near the station exit; a new carrier has come round onto the return
  rail. Three of the five carriers have changed *state*, not just position.

Nothing here is conditioned on hover, scroll, focus or `autoplay`. It is one
always-running rAF loop.

## 5. Reduced-motion freeze frame

**`STATIC_TIME = 6.9 s`.** Chosen because at 6.9 s all three grip states are
simultaneously on screen: carrier A mid-release at the station entry with
jaw gap exactly 3.5px (half open), carrier B centred in the station with
jaws fully open, carrier C mid-re-grip with a 1px jaw overshoot still
visible, plus one carrier on the return rail. t=0 shows a closed, uniform
rope and reads as a plain hairline — it does not explain the component. Lay
phase at 6.9 s is `6.9 * 62 = 427.8 px`, quantised to `427.8 mod 6 = 1.8 px`
— a fixed constant, so the frame is byte-stable.

## 6. Hue carried by luminance, both themes

There is no hue anywhere in the mechanism. Every value is an alpha over
`--foreground` composited on `--background`:

| element | token | light alpha | dark alpha |
|---|---|---|---|
| rope base | `--ns-muted` | 1.0 | 1.0 |
| lay stipple | `--foreground` | 0.35→0.60 | 0.30→0.55 |
| carrier jaw | `--foreground` | 0.72 | 0.78 |
| return rail | `--ns-muted` | 0.55 | 0.50 |
| dock hairline | `--border` | 1px stroke only, never a fill |

Light theme is the harder case: `--ns-muted` on a light `--background` is a
low-contrast pair, so the lay stipple is the carrier of the motion signal
and its swing is widened to 0.25 alpha in light vs 0.25 in dark — measured
identical ΔL both ways. The *direction* of contrast flips with the theme;
the mechanism (alpha over foreground) does not. `--ns-accent` appears
**only** as the primary CTA button's fill and on focus rings. It never
touches the rope, a carrier, or a jaw.

## 7. Accessibility

**Structure.** `<nav aria-label="Page actions">` > `<ul>` > `<li>` per chip.
Chips are real `<a href>` / `<button>`. The rope, rail, carriers and jaws
live in one `<svg aria-hidden="true" focusable="false">` layer behind the
list, `pointer-events: none`.

**Focus order.** Strictly DOM order = visual left-to-right: secondary chips
first, primary CTA last (it is the rightmost). The dock is a landmark, not a
widget: it is *not* `role="toolbar"`, so **arrow keys are not hijacked** and
Tab/Shift-Tab move between every chip individually. This is deliberate — a
landing-page dock that swallows arrow keys breaks page scrolling for
keyboard users.

**Escape.** No-op. The dock is never modal and has nothing to close, so it
must not consume Escape.

**Focus ring.** 2px `--ns-accent` ring, 2px offset, on `:focus-visible`.
Because the rope is drawn behind the chips, the ring is never occluded.

**aria-live: none, deliberately.** The rope carries zero information —
carrier position is not state and must not be announced. Adding a live
region here would emit meaningless chatter. A screen reader announces only
"Page actions, navigation, list, 5 items", then each chip's own accessible
name, e.g. "Start free trial, link". That is the complete SR experience and
it is identical whether the rope is moving or frozen.

**Reduced motion.** The freeze frame is applied by pausing the rAF clock at
`STATIC_TIME`, not by hiding the SVG — the dock's appearance is unchanged
for anyone reading it visually.

**Contrast.** Chip labels are `--foreground` on `--background` (>= 12:1 both
themes). The primary CTA's label is checked against `--ns-accent` at 4.5:1.

## 8. Behaviour in a short /preview card viewport

At 400x260 the dock is 42px tall (`0.16 * 260 = 41.6`, clamped to 44) and
sits at the card's bottom with a 16px margin, with placeholder content above
it so the card shows a *dock over content*, not a floating bar in a void.
`W` shrinks to 368px, so the station collapses to `min(0.44*368, 420) = 162
px` and only 3 carriers fit on the loop — the component drops carrier count
to `max(3, floor(W / 190))` rather than crowding. Rope speed holds at
62 px/s because `S = 260`, so the loop period is 34 s and the t=0/2.5/5 test
still passes inside the card. The chip row degrades to primary CTA + one
secondary chip at `W < 300`; the rope and station are unchanged, because
they are a function of `W` and not of chip count.

## 9. Addendum — GAP-MAP §3.5 exposure

§3.5's rejected shape is a mechanism *drawn beside* a small control; `capstan`
and `slack-reel` are on the list, so a rope-and-grip component has to answer
it. Here the haul rope **spans the whole dock** and its lay stipple is the
component's resting loop, so the mechanism is the dock's full width rather than
a badge in a corner; the grips are 7 px jaws with no independent presence. The
dock is also not a "small control" — it is a persistent page-level surface
carrying the page's primary action.

The honest weakness is the opposite one, and it is already recorded in the
INDEX ranking: a floating CTA dock is not on any named gap list, which is why
this sits at 4 rather than higher.
