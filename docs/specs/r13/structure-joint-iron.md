# joint-iron

- **slug:** joint-iron
- **tier:** loud (full-width footer band)
- **surface:** footer

> Replaces `structure-dandy-roll` (a Fourdrinier-watermark footer), which was written and then
> killed on discovery that a concurrent scout had claimed the same process for a different surface
> (`material-dandy-watermark.md`, badge/seal, same transmitted-light caliper model). Two
> watermark components in one round is the split-idea failure the round brief warns about.

## 1. Surface it replaces + the real process
Footer. Borrowed from the **building-in machine** in edition binding. After a book is cased-in
(the case glued to the text block through the endpapers), it goes into a building-in machine: the
book is clamped between platens under pressure while **heated brass joint irons** — narrow rods
running the length of the spine on both sides — press into the hinge and set the **French groove**,
the channel between the spine and the boards. The joint has to be held under heat and pressure for a
real dwell (order of 20-40 seconds per book in a production machine) or the boards spring and the
groove never takes a set. Books index through the machine one station at a time; the machine runs
whether or not a book is in the station.

A footer is the hinge of the page: the place where the body of the document meets the case that
carries the wordmark, the sitemap and the legal line.

## 2. Nearest existing slug + why this is not a restyle
Nearest: `footer-ascii-rule` — the registry's only footer — "a sitemap footer whose back-to-top
control is a real instrument: an aria-hidden vertical rail beside it continuously reads actual
scroll position, and the button drives a real spring back to the top." That component's mechanic is
a scroll instrument bolted beside an otherwise ordinary DOM footer; the footer's own surface is
inert and it has no resting loop of its own. Here the footer's surface **is** the mechanic: a band
whose top edge is a live joint being set — a groove that deepens under a descending heated iron,
holds through a dwell, then springs back a measured fraction when the pressure releases — and the
station indexes on a fixed cadence forever. The second-nearest is `mull-hinge` (a tissue-strip hinge
whose shear and tearing report anchor health for a margin comment); that is a per-comment health
readout on a text anchor, not a page-scale surface, and its hinge is a *failure* indicator whereas
this one is a forming process that succeeds on a cycle.

## 3. One-sentence mechanic
The footer's top edge is a book joint being formed: a heated brass iron descends into the hinge,
presses a French groove for a real dwell, releases with a measured spring-back, and the station
indexes to the next book.

## 4. Rendering approach
2D canvas band. One height field along the band's width: `g(x)` = groove depth. A single-lamp
Lambert shade over `dg/dx` gives the groove's two facets. The iron, platen and the indexing station
marks are drawn objects; the wordmark, sitemap links and legal line are real DOM sitting on the
"case" below the joint. `M = min(bandW, bandH)`; `Hb` is the band height.

## 5. Real numbers
- **Groove geometry:** the French groove is a V channel with a **32-degree wall angle**, centred
  `0.14*Hb` below the band's top edge. Depth `g` ranges 0 (unformed) to **`g_max = 0.055*M`**
  (18.7px at `M = 340`). Each lit facet's width is `1.44 * g` (= `g / tan(32deg)` on each wall), so
  at `g_max` each facet is **26.9px wide** and the channel is 53.8px across.
  **Depth is never the only channel.** Because facet width is linear in `g`, and the facet's Lambert
  contrast falls as the shoulder rounds, a change in `g` shows up three ways at once: depth, facet
  width, and facet contrast. The arithmetic below depends on this.
- **Cycle = 7.4s, unbounded:**
  1. **Index, 0.85s** — the station shifts one book-width (`0.34*W`) to the left with a 3%
     overshoot damped in 140ms; the joint profile shifts with it, so the *previous* book's finished
     groove travels out of frame while an unformed one arrives.
  2. **Iron descent, 0.62s** — the brass iron comes down; groove depth follows a first-order
     approach with a **0.28s time constant**, reaching 0.89 `g_max` by the end of the descent.
  3. **Dwell, 3.6s** — pressure held. During the dwell the groove creeps the last 11% toward
     `g_max` on a **1.4s time constant**, and the case either side of the groove takes a **-0.6%
     compression** in thickness that is visible as the two board edges drawing very slightly together.
     This is the slow part and it is deliberately the longest phase: setting a joint is mostly waiting.
  4. **Release, 0.45s** — pressure off. The groove **springs back by 14%** of its set depth over
     170ms (boards are elastic; a real joint loses part of its set the instant the platen lifts) and
     then holds. This is the component's signature moment, and the numbers are checked here rather
     than assumed: at `M = 340`, 14% of `g_max = 18.7px` is only **2.6px of depth** — on its own that
     is at the perceptual floor and is precisely the kind of number that ships a dead component. It
     is legible because two other channels move with it:
     - **facet width** loses `1.44 * 2.6` = **3.8px on each wall**, so the channel narrows by 7.5px
       total — an 14% change in a 53.8px feature;
     - **facet contrast** drops from **+0.15 L to +0.115 L** on the bright wall (and the mirror on
       the dark wall) as the shoulder rounds — a 0.035 L step;
     - and all of it happens over **170ms**, which is short enough to read as an event rather than a
       drift.
     The builder must confirm all three move; depth alone is not the payoff.
  5. **Iron lift + dwell-out, 1.88s** — the iron rises, and while it is clear a **heat shimmer**
     runs along its underside for 700ms (see section 9 for how that is carried without hue).
- **Station cadence:** one book every 7.4s, three stations visible across the band at `0.34*W`
  spacing, each at a phase offset of 1/3 cycle — so at any instant one joint is being ironed, one is
  dwelling and one is springing back. **This is what makes the band alive at every timescale rather
  than only once per 7.4s.**
- **Iron temperature model:** the iron's own surface value oscillates on a **2.1s** cycle as its
  thermostat cycles (real joint irons are thermostatted and hunt), amplitude **+/-0.04 L**, running
  unconditionally whether or not the iron is down.
- **Board grain:** the case surface carries a static seeded cloth-grain texture at `+/-0.02 L`,
  feature size `0.006*M`, which the groove's shading distorts where it is deepest — so the groove
  reads as a deformation of a real material rather than a drawn line.

## 6. Unconditional resting loop
- **t = 0s:** station A dwelling at 0.94 `g_max`; station B mid-index; station C's iron descending
  at 0.4 of its travel. The three grooves are at three visibly different depths.
- **t = 2.5s:** A is mid-release with its groove having just sprung back 14% and its iron lifting
  with the shimmer running; B's iron is down and its groove is at 0.86 `g_max`; C is dwelling. Every
  station has changed phase and the thermostat has gone through 1.2 cycles.
- **t = 5s:** A has indexed out and its finished groove has travelled `0.34*W` to the left; B is
  dwelling; C is mid-release. The *spatial arrangement* of formed and unformed joints across the band
  is different from both earlier frames, not just the phase of one object.

## 7. Reduced-motion freeze frame
`STATIC_TIME = 2.62s`. At 2.62s station A is caught **mid-release**: the iron lifted just clear with
the shimmer band under it, the groove at its post-spring-back depth with the recovered 14% visible
as a shallower shoulder on the board side than on the spine side, while station B is at full
pressure and station C is unformed. That single frame carries the unformed joint, the joint under
pressure, and the finished joint side by side — the whole process legible at once. **Not t0**, where
all three stations happen to be in mid-phase and the band reads as a decorative grooved rule.

## 8. Scroll behaviour
None. The footer never reads scroll — that is `footer-ascii-rule`'s mechanic and duplicating it
would collapse the distinction. All geometry from `M = min(bandW, bandH)`; below `Hb = 88px` the
station count drops from 3 to 2 and the board-grain texture is dropped (it aliases) while the groove
and the iron are kept, because the groove is the component.

## 9. Hue -> luminance, both themes
- Case surface: `mix(bg, fg, 0.16)` light / `mix(bg, fg, 0.22)` dark. Held clearly off the page
  background in both themes so the groove has material to cut into.
- The groove is carried entirely by a two-facet Lambert term from one lamp at azimuth 118 degrees:
  the spine-side facet takes **+0.15 L** and the board-side facet **-0.17 L** relative to the case,
  in **both** themes. The signs do not swap — a groove lit from one side always brightens one wall
  and darkens the other, which is why this reads identically in light and dark without a re-hue.
- Depth is legible as the *width* of those two facets as well as their contrast, so a shallow
  groove and a deep one differ in two independent channels. This matters in light theme, where the
  darker facet has less headroom.
- **The heated iron is the trap and it is solved by value only.** A hot brass iron would normally be
  drawn with a warm tint; here it is a `--foreground` silhouette whose underside carries a
  **+0.11 L** band that ripples on the 700ms shimmer. `--ns-accent` must not touch it — the iron is
  the closest thing this component has to a climactic moment, which is exactly where the
  `edge-yield` / `granule-churn` / `shear-billow` accent defect keeps happening.
- Board-grain texture: `+/-0.02 L`.
- `--ns-accent`: only on the footer's real controls — a newsletter submit, a back-to-top button,
  focus rings.
- `--border`: only the hairline between the footer band and the page above, and the sitemap column
  rules. Never as a fill or as the groove.
Tokens read via `getComputedStyle(document.documentElement)` + `MutationObserver` on
documentElement's class, **no literal fallbacks**, and no paint before the first read — guard the
rAF start, the `ResizeObserver` callback and the `IntersectionObserver` resume path specifically.

## 10. Interaction
None on the joint. No pointer highlight, no hover peek, no press response on the band — the footer's
DOM controls behave as ordinary footer controls with accessible names, and Tab from a blurred body
reaches one within 12 presses. The forming cycle keeps running during interaction.

## 11. Canvas host
DPR cap 2 (a short band, low area cost). `ResizeObserver` on the band element, not `window.resize`.
Pause on `IntersectionObserver` threshold 0 and on `visibilitychange` — a footer is offscreen for
most of a page's life, so this is the single most valuable pause in the round. Adaptive scale ladder
gated on sustained wall-clock milliseconds over budget, never on frame count, never on a device
heuristic.

## 12. Kill criteria
- **The 14% spring-back is the component, and it is carried by facet width and contrast, not by
  depth.** 2.6px of depth at card scale is below the floor on its own — verify the 7.5px channel
  narrowing and the 0.035 L contrast step at `M = 340` in **both** themes and at dsf 1 and dsf 2. If
  the recovery is not visible, raise `g_max` (facet width scales with it) before touching the 14%,
  which is the physically meaningful number. If it still is not visible, kill — without it this is a
  grooved rule that pulses.
- If the three stations end up in visual lockstep (all three at the same phase), the phase offsets
  are wrong; the whole aliveness argument at t0/2.5s/5s depends on them differing.
- If the iron ever acquires a warm tint, an accent mix, or a glow, it has failed the standing check
  and must be reverted to value before it goes near the gate.
- If, once built, the read is "a footer with an animated top border", kill. The groove must read as
  a channel formed *into* a material with two lit facets and a compressing case, not as a stroke.
