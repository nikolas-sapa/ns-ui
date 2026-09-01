# quoin-lockup

- **slug:** quoin-lockup
- **tier:** core (card-scale DOM + canvas)
- **surface:** bento grid / feature grid layout primitive

## 1. Surface it replaces + the real process
Bento grid. Borrowed from **letterpress lockup on the imposing stone**. A form of type is placed
inside a steel **chase**; every empty area is filled with wooden or metal **furniture** in discrete
pica sizes, plus thin reglets. **Quoins** — pairs of opposing wedges (Hempel, Wickersham) — are
placed against two adjacent sides and expanded with a quoin key, each quoin carrying roughly one
pica of travel. The pressman **planes down** the form (a planer block tapped flat with a mallet) and
then tests the lockup by lifting the chase at one corner: if pressure is short, the form **pies** —
individual sorts drop out of plane and the form is dead. Wooden furniture is hygroscopic, so a
locked form relaxes and has to be re-keyed.

## 2. Nearest existing slug + why this is not a restyle
Nearest: `grid-bento-ascii` (a 2x2 on a content/seam track grid where activating a tile re-spans it
across every track) and `grid-bento-dense` (activating promotes a tile to a 2x2 slot and everything
re-packs via `grid-auto-flow: dense`, FLIP-animated). Both existing bentos are **re-assignment**
problems: the interesting event is which cells a tile occupies, and the gutters are inert space.
Here nothing is ever re-assigned — the gutters are physical objects with real discrete widths and
the only variable is **pressure**, supplied by four quoins with finite wedge travel, so promoting a
tile takes width out of the surrounding furniture and the whole form gets tighter or looser rather
than repacked. And when pressure falls below the lift threshold a tile visibly **pies** out of
plane, a failure mode neither existing bento has any equivalent of.

## 3. One-sentence mechanic
A bento grid locked in a chase by four expanding quoins whose pressure slowly relaxes until tiles
sink out of plane, then is re-keyed quoin by quoin and planed flush again, forever.

## 4. Rendering approach
DOM tiles (real buttons/links, real text) inside a CSS grid whose gutter track sizes are driven by
the pressure model; the chase rail, furniture butt joints, quoin wedges, key and planer block are one
SVG layer behind and around the tiles. Tile pieing is `transform: translateZ` proxied as
`scale` + `rotate` plus a canvas/CSS contact shadow — no layout thrash, and text stays real DOM.
`M = min(width, height)` governs every length.

## 5. Real numbers
- **Chase:** the component bounds inset by `0.055*M`; inner steel rail stroke `0.012*M`.
- **Tiles:** 5, in a fixed arrangement on a 3x3 base — one 2x2 hero, two 1x2, two 1x1. Below
  `M = 320px` the arrangement drops to 3 tiles on a 2x2 base.
- **Furniture:** base unit `u = 0.0125*M` ("one pica"). Legal gutter widths are quantised to
  `{2u, 3u, 4u, 6u, 8u}` — never a continuous value. Each gutter is drawn as a run of furniture with
  a visible butt joint every `0.11*M` and a 1px end-grain line at each joint.
- **Quoins:** 4 — two on the right edge, two at the foot (the standard two-orthogonal-directions
  lockup). Each is a pair of opposing 14-degree wedges sliding against each other, travel range
  `0 .. 1.0u`. The key socket is a small square that rotates 90 degrees per turn.
- **Pressure:** `P = 1 - S/(4u)` clamped to [0,1], where `S` is total slack (furniture width minus
  required width).
- **Lift threshold:** `P >= 0.62`.
- **Pieing:** each tile has a fixed seeded hold `H_i = P + 0.10 * jitter(i)`, so the same tile always
  loosens first. If `H_i < 0.62` the tile sinks by `(0.62 - H_i)/0.62 * 0.028*M`, rendered as
  `scale(0.978)` plus a 0.9-degree tilt about a per-tile axis and a contact shadow — which breaks the
  tile's baseline against the shared rule its neighbours still sit on. That broken baseline is what
  makes it legible at card scale.
- **Idle creep:** `P` decays at **0.055/s**.
- **Re-key:** when the loosest tile has sunk 55% of its full pie depth, the key swings onto the
  nearest quoin, rotates 90 degrees over **320ms**, and `P` steps **+0.19** over 180ms
  (critically damped). The next quoin follows **640ms** later, in the fixed order right-top,
  foot-right, right-bottom, foot-left, until `P >= 0.93`. Then decay resumes.
- **Cycle:** `P` falls 0.93 -> 0.62 in **5.6s**; the re-key sequence runs **2.6s**. Period ~**8.2s**,
  unbounded, never terminating.
- **Planer:** every third re-key cycle (every ~24.6s) a planer block sweeps left to right across the
  form in **700ms**, zeroing each tile's sink as it passes — tiles pop flush in sequence, 90ms apart.
  This is the component's striking moment.

## 6. Unconditional resting loop
- **t = 0s:** `P = 0.88`; all five tiles flush; gutters at nominal; quoin wedges near closed.
- **t = 2.5s:** `P = 0.74`; the two seeded-loosest tiles have begun to sink — the right column's
  baseline is visibly broken against the left column's and both sunken tiles have grown contact
  shadows; every gutter is ~0.4u wider than at t0.
- **t = 5s:** `P` has crossed 0.62 and the re-key sequence is mid-run — one key rotated ~60 degrees,
  two tiles snapped back flush, the far tile still low; the right-hand gutters have visibly narrowed
  while the left-hand ones have not yet.

## 7. Reduced-motion freeze frame
`STATIC_TIME = 6.3s`. Mid re-key: two quoins already keyed with their wedge pairs visibly overlapped
at ~0.8u travel and two still open, one tile still pied with its contact shadow while three are
flush, and the key sitting in a socket. That single frame carries the chase, the furniture butt
joints, the wedge-pair geometry, a pressure gradient across the form, and the failure mode at once.
**Not t0** — a fully locked, fully flush form is indistinguishable from a static bordered bento grid,
which is the automatic Filter-2 reject.

## 8. Scroll behaviour
None. The component never reads scroll. It is card-native by construction: all geometry from
`M = min(width, height)`, tile count steps down below `M = 320px`, and the pie/plane cycle is the
whole read at any size.

## 9. Hue -> luminance, both themes
- Tile faces (the printing surface): `mix(bg, fg, 0.10)` light / `mix(bg, fg, 0.16)` dark.
- Furniture: `mix(bg, fg, 0.40)` in **both** themes — held mid-value deliberately so it reads as a
  different material from both the tiles and the chase in either theme.
- Chase rail: `--foreground` at 0.72 alpha in light, full in dark.
- Pie depth is carried by two independent value cues so it survives either theme: (a) a contact
  shadow darkening toward `--foreground` in light and toward `--background` in dark — in both cases
  a *loss of local contrast* under the tile; and (b) a loss of edge contrast on the sunken tile's
  top edge against the furniture.
- Quoin wedges get a 2-stop value split across their two faces so the direction of travel is
  readable without hue.
- `--border` is used **only** for the furniture butt joints and the tile hairlines — a legitimate
  separator use, never as a fill.
- `--ns-accent` appears only on focus rings and on the tiles' own action buttons. It never touches
  the pie, the planer sweep or the re-key — the climactic moments.
Tokens via `getComputedStyle` + `MutationObserver` on documentElement's class; no literal fallbacks.

## 10. Interaction
Hover or focus a tile: the furniture surrounding it steps down one legal size and the two adjacent
quoins take up the difference — the tile grows by `2u` and **nothing re-packs**. Tiles are real
buttons/links with accessible names; arrow keys move between them, Enter activates. Focus ring uses
`--ns-accent` (legitimate interaction chrome). The creep/re-key loop keeps running during
interaction.

## 11. Kill criteria
- Do the arithmetic before building: at `M = 340px`, `u = 4.25px`, so a 1u gutter change is 4px —
  near the perceptual floor. The **pie-and-plane cycle must carry the read**; the gutter width change
  is a secondary cue. If the builder finds themselves relying on gutter width alone, the concept is
  dead.
- If the pie tilt reads as a generic hover-lift, kill.
- If anything ever changes which cell a tile occupies, the spec has been violated — nothing
  re-packs, ever. That is the line separating this from `grid-bento-dense`.
