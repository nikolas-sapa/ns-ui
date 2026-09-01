> **CUT — do not build.** GAP-MAP.md gap #1 states that `footer-ascii-rule` "is a back-to-top scroll instrument with a sitemap attached, not a footer block", and that what is missing is the footer band itself. A second back-to-top instrument answers the surface the gap map says is already over-answered.
>
> Spec retained in full below only so the orchestrator can overrule with the
> full argument in hand. See `INDEX-nav.md`.

# log-heave — back-to-top and scroll-speed affordance as a ship's chip log

## 1. Surface replaced + real process

**Surface:** the **back-to-top control** and its neighbouring scroll
affordance, sitting as persistent page furniture at the viewport's trailing
edge (and repeated in the footer).

**Real process:** the **common log** (chip log / hand log) — how ships measured
speed from the 16th century into the 20th, and the origin of the word "knot".
A weighted wooden quadrant, the **chip**, is thrown astern; it stays put in the
water while the ship moves away. The knotted **log-line** pays off a hand-held
reel while a second sailor turns a **sand glass**. When the glass runs out the
line is nipped and the knots that ran out are counted — that count *is* the
speed. Then a pin is tripped so the chip lies flat, and the line is **hauled
back in**. Three real constraints make it worth stealing:

1. It can measure **speed and nothing else** — a chip log is structurally
   incapable of reporting position, which is precisely why ships needed dead
   reckoning on top of it.
2. The measurement is **periodic and destructive**: you get one number per
   glass, and you must haul in to take another.
3. The line begins with a **stray line** — an unmarked length that gets the
   chip clear of the ship's wake before the first knot counts.

## 2. Nearest existing slug — why this is not a restyle

Nearest: **`footer-ascii-rule`**, **`scroll-caliper`**, **`toc-minimap-mercury`**.

All three are **position** instruments. `footer-ascii-rule` runs an
aria-hidden vertical rail that continuously reads scroll position;
`scroll-caliper` closes spring-damped jaws over the active section's *extent*
in px and percent; `toc-minimap-mercury` climbs a rail in proportion to
progress. `log-heave` reads **speed**, latched **once per glass**, and cannot
report position at all — so the two instruments would give completely
different readings on the same page and neither substitutes for the other.
Its resting behaviour (a sand glass draining and being turned, forever) has no
analogue in any of the three.

The one thing it shares with `footer-ascii-rule` is that its flight to the top
is a real spring that **yields the instant the user touches the wheel**. That
is a correctness requirement this repo already established and every
scroll-to-top must honour; it is not the component's idea.

## 3. The mechanic — numbers

Geometry from `S = min(hostW, hostH)`.

**Parts.** Reel (16px circle, 4 spokes, hub 5px) → stray line → knotted line →
chip. Sand glass beside the reel. Latched reading in Geist Mono beside the
glass. The whole assembly is `168 x 40` px at `S >= 520`, `128 x 36` below.

**The glass — the unconditional resting loop.** A real **14-second glass** (a
genuine half-log glass, used with 24-ft knot spacing):

```
bulbs           two 12x9 px, joined by a 3px neck  (10x7 below S=520)
drain           lower column h = 9 * (t_g / 14) px, upper h = 9 * (1 - t_g/14)
fall stream     1px line through the neck, always drawn,
                3px-period stipple translating at 22 px/s
flip            at t_g = 14: rotate 180 deg over 380 ms, cubic-bezier(.3,.7,.3,1)
cycle           14.38 s, unbounded, never resets to a special case
```

**Chip yaw (ambient).** The 7x7 quadrant at the line's end rotates `±9°` on a
**3.70 s** period and dips `±1.1 px` on a **2.30 s** period. 14.38, 3.70 and
2.30 are mutually incommensurate, so the resting state never repeats.

**Payout maps to scroll speed.**

```
knots           clamp(round(|scrollVelocity| / 240), 0, 6)
line length     26 px stray line + 18 px per knot     (13 px below hostW 420)
smoothing       tau = 320 ms low-pass on line length
knot ticks      2px marks, drawn only past the stray line
```

So a 1,440 px/s scroll runs 6 knots = 134 px of line. Ticks appear as the
line passes them — the line is not a bar that grows, it is a line with marks
on it that arrive.

**The reading.** At each glass flip, the knot count *at that instant* is
latched and printed as `4 kn`. It therefore changes **at most once every
14.38 s** — a number beside body copy that nags is a defect, and the real
mechanism already solves it.

**Haul in (the back-to-top).** Activating the control:
1. trips the chip — the quadrant rotates 90° flat over **120 ms**;
2. winds the reel at `Ω = 5.4 rad/s`, pack radius `R = 5 + 6*(1 − payout/max)`;
3. scrolls the page to top on a spring `k = 118, c = 21, m = 1` (**ζ = 0.97**,
   deliberately just short of critical so it **never overshoots past the top**
   — a back-to-top that bounces past zero is wrong).
   A 12,000 px document takes **~1.5 s**.
4. **Any** wheel, touch, or scroll-key input cancels the spring within one
   frame and the line pays back out.

**Perceptual budget (explicit):** at rest the moving elements are the sand
columns (12px wide, ≤ 0.64 px/s of column growth), the neck stipple (1x7 px at
22 px/s), and the chip's 7x7 yaw — total **~180 px²**, i.e. **2.7%** of a
168x40 instrument and a rounding error against the page. Peak per-frame
luminance change on any pixel is **0.08 L**. The latched reading, the only
text in the assembly, changes once per 14.38 s and never mid-sentence. The
instrument is pinned in a 48px gutter with **28 px** of clearance to the
nearest body-copy measure, and nothing in it ever grows past its 168px box —
line length is clamped to `min(134, 0.42 * hostW)`.

## 4. t = 0 / 2.5 / 5 s, zero input

- **t=0:** lower sand column **0.00 px**, upper 9.00 px; neck stipple phase 0;
  chip yaw **0.0°**, dip 0.00 px.
- **t=2.5:** lower column **1.61 px**, upper 7.39 px; stipple has translated
  **55 px** (18.3 periods); chip yaw `9*sin(2π*2.5/3.7)` = **+3.4°**, dip
  `1.1*sin(2π*2.5/2.3)` = **+0.65 px**.
- **t=5:** lower column **3.21 px**, upper 5.79 px; stipple at **110 px**;
  chip yaw **−6.4°**, dip **−1.03 px**.

Three unambiguously different rasterised frames: the sand columns differ by
1.6 px steps, the chip's 7px quadrant is at three different angles, and the
stipple is at three different phases. One always-running rAF loop; no
autoplay, hover, focus, or scroll gating.

## 5. Reduced-motion freeze frame

**`STATIC_TIME = 9.40 s`** of the 14.38 s glass cycle, with a **4-knot**
payout latched.

At 9.40 s: the lower bulb holds **6.04 px** of sand and the upper **2.96 px**,
so **both bulbs are visibly partly full** — the frame reads as a *glass in
use*, not as a full box or an empty one. The fall stream is mid-run through
the neck. The line is paid out **98 px**, showing the 26 px stray line and
**four** knot ticks — the stray-line/knot distinction, which is the log's most
specific detail, is only legible when at least two knots are past the stray
line. The chip is yawed **+6.2°** and dipped **+0.7 px**, off-axis, so it reads
as floating rather than as a static decoration.

t=0 is the worst possible frozen frame here: a full upper bulb, no payout, no
knot ticks, a chip square-on — a picture of an instrument that has never been
used, which explains nothing.

All values are constants, so the frame is byte-stable. Under reduced motion,
the haul is `scrollTo({ top: 0, behavior: 'auto' })` — instant, no spring —
while focus movement and the live-region announcement (§7) still happen.

## 6. Hue carried by luminance, both themes

| element | token | light | dark |
|---|---|---|---|
| glass outline | `--border` | 1px stroke only | 1px stroke only |
| sand column | `--foreground` @ 0.46 | 0.46 | 0.54 |
| fall stipple | `--foreground` @ 0.70 | 0.70 | 0.78 |
| reel hub + spokes | `--ns-muted` | 1.0 | 1.0 |
| wound line pack | `--foreground` @ 0.30 | 0.30 | 0.36 |
| stray line | `--foreground` @ 0.28, dashed 2-3 | 0.28 | 0.34 |
| knotted line | `--foreground` @ 0.55, solid | 0.55 | 0.62 |
| knot ticks | `--foreground` @ 0.75 | 0.75 | 0.82 |
| chip quadrant | `--foreground` @ 0.62 | 0.62 | 0.70 |
| latched reading | `--ns-muted` | 1.0 | 1.0 |

No hue anywhere. The stray line and the counted line are distinguished by
**dash pattern**, not tone — a structural difference that survives at any
contrast and in forced-colours mode, which matters because the whole
distinction is the log's point. Sand level is a filled area against a 1px
outline, so it reads even where `--foreground @ 0.46` is faint. Light theme is
checked first: the stray line at 0.28 alpha on a light `--background` is the
faintest mark in the component and is backed up by its dash pattern.
`--ns-accent` appears **only** on the button's `:focus-visible` ring — never
on sand, line, knot, chip, reel or glass.

## 7. Accessibility

**Structure.** One real `<button type="button">Back to top</button>`. The
reel, line, knots, chip, glass and latched reading are a single
`<svg aria-hidden="true" focusable="false">`, `pointer-events: none`.

**The reading is deliberately not exposed.** The knot count measures the
user's own scrolling. It is ornament, not information, and announcing it would
be noise — so the whole instrument, reading included, is `aria-hidden`, and the
button's accessible name is exactly "Back to top". No `aria-describedby`
mentioning knots, glasses, or speed.

**Focus must move on completion — the load-bearing detail.** A back-to-top
that scrolls the viewport without moving focus leaves a keyboard user's tab
position at the bottom of the document: the next Tab press jumps them back
down. On completion (or immediately, under reduced motion) focus moves to the
page's `<h1 tabindex="-1">` — the same target the skip link uses.

**aria-live.** One `role="status"` (`aria-live="polite"`) message, fired once
per completed haul: *"Returned to top of page."* Nothing else is announced:
not the glass, not the flip, not the payout, not the latch. Because focus also
moves, this message is throttled to one per 800 ms so a double-press does not
double-announce.

**Escape.** Escape **cancels an in-flight haul**, stopping the spring where it
is and leaving focus where it is. "Stop the motion" is the correct meaning of
Escape for a scroll animation and is what motion-sensitive users reach for
first. Escape when no haul is running is a **no-op and is not consumed**.

**Keyboard.** `Enter` / `Space` activate. No arrow-key bindings at all — the
page keeps `ArrowUp`/`ArrowDown`/`PageUp`/`PageDown`/`Home`/`End`, and pressing
any of them during a haul cancels it (same path as the wheel).

**Visibility and the tab ring.** The control mounts hidden and reveals once
`scrollY > 1.2 * innerHeight`. While hidden it is `inert` **and**
`aria-hidden="true"` **and** `display:none` — all three, so it cannot be
tabbed to, cannot be found by a screen reader's virtual cursor, and does not
occupy layout above the fold. It is announced only when it is genuinely
available.

**What a screen reader hears, end to end.** "Back to top, button" → Enter →
"Returned to top of page." → the virtual cursor is now on the `<h1>`. The
instrument is silent in both motion modes.

**Contrast.** The button label is `--foreground` on `--background` (>= 12:1
both themes). Focus ring 2px `--ns-accent` at 2px offset; the button carries
10px padding so the ring never clips against the instrument's box.

## 8. Behaviour in a short /preview card viewport

At 400x260: `S = 260`, so the assembly drops to `128 x 36`, the glass to
`10 x 7` bulbs, the reel to 13px, and knot spacing to **13 px** so four knots
still fit inside `min(134, 168) = 134` px of line. The chip stays 7x7 — it is
the smallest element that must remain a recognisable quadrant, so it is
floored rather than scaled.

The demo renders the instrument **visible at rest** (the `alwaysVisible` prop),
because the resting loop lives in the glass and the gate screenshots
`/preview/<name>` with no scroll — a scroll-gated reveal would hand the gate a
dead frame, which is exactly the failure `docs/showpiece-recipe.md` records.
The card body is its own scroll container, so wheel or drag inside the card
drives payout and the haul spring against the card's scrollTop, and the whole
mechanism is exercisable without a full page.

Below `hostW = 300` the line is clamped to 78 px (stray line + 4 knots at
13 px) and the latched reading moves under the glass instead of beside it. The
glass, chip and stipple are unchanged, so t=0/2.5/5 still differs at the
narrowest card size.
