> **CUT — do not build.** Two independent reasons, both from `GAP-MAP.md`:
> (1) gap #9 counts five real site navs already and names the missing pieces as a
> mega-menu and a mobile sheet, not a fourth scroll-condensed bar; (2) §3.5 — the
> transport zone is a mechanism drawn beside a control, the single most-rejected
> shape in this registry (15 of 59 removals), and the slug collides by name with
> `slack-reel`, one of the components cut in that commit.
>
> Spec retained in full below only so the orchestrator can overrule with the
> full argument in hand. See `INDEX-nav.md`.

# column-slack — scroll-condensed site nav as a vacuum-column tape transport

## 1. Surface replaced + real process

**Surface:** the full-width marketing site nav bar and its scroll-condensed
state.

**Real process:** the **IBM 727/729 magnetic tape drive's vacuum columns**.
The read/write head must start and stop tape in ~5 ms; the reels weigh
kilograms and cannot. So the tape path drops into two evacuated vertical
columns, each holding a free slack loop held down by air pressure. The head
takes tape from the loop instantly; the reel motors then refill the loop at
their own pace, commanded by a **two-port bang-bang servo**: a vacuum sensing
port near the top and one near the bottom of each column. Cross the upper
port and the reel spins up; cross the lower port and it reverses off. The
consequence, and the reason this is worth stealing: the loops **hunt
continuously between the ports even when no data is being read** — a 729 at
load point visibly breathes.

## 2. Nearest existing slug — why this is not a restyle

Nearest: **`nav-condense-rail`**, **`header-scroll-pill`**, **`capstan-slip`**.

Both existing nav bars are *position* machines: `nav-condense-rail` maps
`scrollY` to bar height over a distance measured from the bar's own extremes,
and `header-scroll-pill` latches on a `scrollY` threshold with hysteresis. In
both, scrolling back up necessarily re-expands the bar, because height is a
pure function of position. `column-slack` is a *rate* machine with an
integrator: bar height is the state of a buffer whose fill rate is
`(demand − reel capability)`, so a fast scroll **upward** condenses the bar
exactly as much as a fast scroll downward, and the bar re-expands when the
user goes *slow*, not when they return to the top. That is a different
observable behaviour, not a different skin. `capstan-slip` is a determinate
progress bar about pinch-roller *slip* — a friction claim at a single nip;
this is an *inertia-decoupling* claim across a buffer, and it is the reason
the two mechanisms exist in the same machine without being the same thing.

## 3. The mechanic — numbers

Geometry from `S = min(hostW, hostH)`.

- `H_max = clamp(64, 0.20 * S, 88)` px. `H_min = 0.62 * H_max`.
- **Transport zone:** a `96px` (`72px` under 480px wide) block at the bar's
  leading edge, holding supply reel, supply column window, take-up column
  window, take-up reel. The wordmark and links start after it.
- **Column window:** `22 x 34` px each (`18 x 26` under 480px). Loop position
  `p ∈ [0,1]`, `p=0` = loop at column top (empty), `p=1` = loop at bottom
  (full). Rest `p = 0.50`. **Upper port at 0.78, lower port at 0.22** —
  drawn as two 3px `--border` tick marks on each window's outer edge.

**Servo (per column), integrated at 60 Hz:**

```
demand d  = clamp(|scrollVelocity|, 0, 2400) px/s      // measured, EMA tau 90ms
D_ref     = 1400 px/s                                   // reel steady capability
C         = 0.42 s                                      // column capacity
dp/dt     = (d / D_ref - r) / C
if p > 0.78:  r -> 1.15  at dr/dt = +4.6 /s
if p < 0.22:  r -> 0.00  at dr/dt = -4.6 /s
else:         r -> d/D_ref  with tau = 240 ms
```

- **Bar height** is driven by a *heavily filtered* loop position:
  `p_f` = low-pass of `p`, `tau = 900 ms`, with a **deadband of ±0.06 around
  0.50**. `H = H_max − (H_max − H_min) * clamp((p_f − 0.22)/0.56, 0, 1)`.
  The deadband is why the idle hunt (below) produces **exactly zero** height
  change: the bar never twitches under a resting page.
- **Idle transport loop (unconditional):** with `d = 0` the drive is modelled
  in low-speed load-point transport — both reels turn together at
  **0.055 rev/s (3.3 rpm, 19.8 °/s)** with 3 hub spokes, and the loop apex
  carries an authentic **±0.4 px flutter at 2.7 Hz**. Supply and take-up
  match, so `p` holds at 0.50 and the bar does not move. The reels do.
- **Tape pack radii** read document progress honestly:
  `R_supply = 5 + 7*(1 − progress)`, `R_takeup = 5 + 7*progress`, both eased
  with `tau = 260 ms`. Hub circle 14px, pack ring stroked at `R`.
- **Spring on re-seat:** when `p` crosses back inside the ports after a burst,
  the loop apex overshoots by 1.6 px and settles on `k = 300, c = 24, m = 1`.

**Perceptual budget (explicit):** moving pixels = 2 windows (22x34) + 2 hubs
(28x28 bounding) = **2,304 px²**, i.e. **2.7%** of a 960x88 bar. Peak
per-frame luminance change on any pixel is **0.10 L**. The transport zone is
walled off from copy: the nearest nav link's box starts **20 px** after the
zone's trailing edge, and no moving element ever crosses that line. Bar
height itself is deadbanded so **content below the bar never reflows at
rest**, which is the real way nav furniture fights copy.

## 4. t = 0 / 2.5 / 5 s, zero input

- **t=0:** both hub spokes at 0°. Supply loop apex at `p=0.500`, flutter
  phase 0. Pack radii at the document's current progress.
- **t=2.5:** hubs have turned **49.5°** — with 3 spokes (120° symmetry) that
  is an unmistakable new orientation. Flutter has completed 6.75 cycles and
  sits at −0.28 px on the supply apex, +0.4 px on the take-up (the two
  columns are seeded with a 0.31-rad phase offset so they never breathe in
  unison).
- **t=5:** hubs at **99.0°**, still distinct from both 0° and 120°. Flutter at
  a third distinct phase. The two apexes are visibly at different heights.

Driven by one always-running rAF loop and one `infinite` CSS keyframe for the
flutter; nothing here is gated on scroll, hover, focus, or `autoplay`.

## 5. Reduced-motion freeze frame

Under `prefers-reduced-motion: reduce` the component renders a **canned 8.0 s
start-stop transaction frozen at `STATIC_TIME = 5.2 s`**, not the live
scroll-driven state (live state is not byte-stable).

At 5.2 s: the supply loop sits at `p = 0.79` — it has *just* tripped the
upper port, so the supply reel is drawn at full speed as a 3-tick motion arc
rather than sharp spokes; the take-up loop sits at `p = 0.31`, near its
lower port with its reel stopped and spokes crisp; the bar is at
`H_min + 3 px`. Chosen because the columns are **visibly asymmetric and in
opposite servo states** — the one thing the whole mechanism exists to do, and
the one thing that is invisible in the resting frame. t=0 shows two identical
half-full columns and explains nothing.

## 6. Hue carried by luminance, both themes

| element | token | light | dark |
|---|---|---|---|
| column wall | `--border` | 1px stroke only | 1px stroke only |
| port ticks | `--border` | 3px stroke | 3px stroke |
| tape ribbon / loop | `--foreground` @ 0.62 | 0.62 | 0.70 |
| tape pack ring | `--foreground` @ 0.30 | 0.30 | 0.36 |
| hub + spokes | `--ns-muted` | 1.0 | 1.0 |
| reel-spinning motion arc | `--foreground` @ 0.18 | 0.18 | 0.22 |
| bar background | `--background` | — | — |

No hue anywhere. Every state distinction — loop full vs empty, reel spinning
vs stopped, pack fat vs thin — is carried by **position and stroke density**,
not by any colour swap. Light theme is the harder case and is checked first:
`--foreground @ 0.18` on a light `--background` is the faintest mark in the
component, so the spinning-reel arc is additionally distinguished by *shape*
(a 3-tick arc vs 3 crisp radial spokes) and never by tone alone.
`--ns-accent` appears only on the CTA button in the bar and on focus rings —
never on tape, loop, hub, port, or window.

## 7. Accessibility

**Structure.** `<header>` > `<nav aria-label="Main">` > `<ul>` of links, plus
the menu `<button>` and CTA. The whole transport is one
`<svg aria-hidden="true" focusable="false">`, `pointer-events:none`.

**Focus order.** Skip link → wordmark link → nav links in DOM/visual order →
theme control → CTA → menu trigger (only when the trigger is the visible
control at narrow widths). The transport zone is not focusable and does not
appear in the tab ring.

**Keyboard.** Not a `role="toolbar"` and not a menubar — plain links, so Tab
and Shift-Tab step through them and **arrow keys stay with the page**. The
mobile menu trigger is `<button aria-expanded aria-controls>` opening a
native `<dialog>` (free focus trap + Escape-to-close, per `nav-site-condense`'s
proven pattern); Escape inside the dialog closes it and returns focus to the
trigger. Escape outside the dialog is a no-op — the nav must not eat it.

**aria-live.** One `aria-live="polite"` region, and **only** for the condensed
state, announced as "Navigation condensed" / "Navigation expanded", throttled
to at most one announcement per 1200 ms and suppressed entirely while the
deadband holds. Loop position, reel speed and pack radius are **never**
announced — they are ornament, not state. A screen reader hears: "Main,
navigation, list, 5 items", each link, "Menu, button, collapsed", and, only
on a real condense transition, the one polite string above.

**Focus ring.** 2px `--ns-accent`, 2px offset, on `:focus-visible`. The bar's
condensed height is `H_min = 0.62 * H_max >= 39 px`, which still clears a
2px ring plus its offset on a 20px-line link with 8px padding.

**Reduced motion.** Freeze per §5; height is pinned at the frozen value and
never animates, so no reflow is introduced for motion-sensitive users.

## 8. Behaviour in a short /preview card viewport

At 400x260: `S = 260`, `H_max = clamp(64, 52, 88) = 64`, `H_min = 40`. The
transport zone drops to 72px and the windows to 18x26; hub circles to 11px.
The card renders the bar pinned at the card's top over a short scrollable
placeholder column, so the mechanism has a real scroll source *inside the
card* — wheel or drag over the card body drives `d` exactly as page scroll
would. With no input the idle transport loop still runs (reels at 19.8 °/s,
flutter at 2.7 Hz), so the t=0/2.5/5 gate passes in the card with zero
interaction. Below 300px wide the nav links collapse to the menu trigger and
the transport zone shrinks to a **single** column window plus one reel —
losing a column is honest (a one-column transport is a simpler real drive),
and the servo runs unchanged on the remaining side.
