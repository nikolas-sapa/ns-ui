# spreader-bar — logo wall as a hanging mobile

**Collection:** loud · **Surface:** logo wall — gap-map gap #3 (count today: 1, and it stops)

## 1. Surface and the real process

Replaces the customer / partner logo wall. `GAP-MAP.md` gap #3: the registry has exactly
one (`logo-cloud-settle`), it plays once on viewport entry and then holds, and nothing
here "handles real logos of unequal optical weight."

Borrowed process: the **statics of a hanging mobile** (Calder, and the rigging trade's
*spreader bar*). Every arm is a first-class lever hung from a single point, and it hangs
level only when `w_left * d_left = w_right * d_right`. Build one and you discover the
mechanic that matters here: **you do not choose where a thing hangs, its weight does.**
Each hanger wire is also a torsional spring, so every arm is a torsional pendulum with a
period set by its own moment of inertia and wire stiffness; the periods are unrelated, the
arms couple through their parents' inertia, and air damping is so light (Q of order 100+)
that a mobile in a still room is still turning hours later. It has no rest state.

## 2. Nearest existing slug and why this is not a restyle

Nearest: `logo-cloud-settle` (core) and `pricing-scale` (core).

`logo-cloud-settle` drops tiles into a fixed grid with a stagger and a spring, then holds
a settled arrangement — its animation is an entrance, and the grid positions are chosen
by layout, not earned. Here the position is **computed from each mark's measured ink
coverage** and there is no settled state at all, because seven torsional pendulums at
mutually incommensurate periods never return to the same configuration. `pricing-scale`
is a single two-pan beam whose torque is an argument about two tiers; this is a four-level
tree of balances where the free rotation about every hanger — not the balance — is what
produces the motion.

## 3. Mechanic

**The tree.** 4 levels, 7 arms, 8 marks. Arms are 1 px horizontal rules; hangers are 1 px
verticals. Level heights are `0.19 * min(w,h)` apart, floored at 34 px.

**Balance (this is the optical-weight handling).** Each mark's weight `w` is its measured
ink coverage: rasterise the mark once at mount, sum alpha, normalise to the set's mean.
For every arm, solve `w_left * d_left = w_right * d_right` with `d_left + d_right` fixed at
the arm length. A visually heavy mark therefore hangs **closer to its fulcrum** and a
light one hangs further out — the layout is the equalisation, and it re-solves on a
`ResizeObserver` and whenever the `logos` prop changes. Arm lengths clamp `d` to
`[0.18, 0.82]` of the span so no mark ever sits on the fulcrum.

**Rotation.** Each arm is a torsional pendulum, `T = 2*pi*sqrt(I/kappa)`. Assign
deliberately incommensurate periods:

| Arm | Period (s) | Amplitude |
|---|---|---|
| root | 26.8 | ±16° |
| level 2 (×2) | 17.2, 21.5 | ±16° |
| level 3 (×4) | 7.3, 9.1, 11.6, 13.9 | ±16° |
| leaf marks (×8) | inherit + own spin, 5.9-8.7 | ±34° |

- **Coupling:** a child arm's angle changes its parent's moment of inertia; model as a
  ±4% modulation of the parent's instantaneous period. This is what stops the assembly
  reading as eight independent sine waves.
- **Damping:** `Q = 180`, i.e. amplitude decays with `tau ≈ 400 s`.
- **Draught (the reason it never dies):** a room air current — 1-D value noise at
  0.037 Hz — applies a torque impulse of up to 0.6% of peak to each arm every frame.
  Unforced, unbounded, and physically what actually keeps a mobile going. There is no
  reset and no cycle length.

**Foreshortening.** A mark rotated `theta` off frontal is drawn at `cos(theta)` width, so
marks continuously present and hide themselves and you read the wall in turn rather than
all at once. **Hard floor:** `theta` is capped at 34°, so width never drops below
`cos 34° = 0.83`. No mark is ever illegible — this is a legibility constraint, not a taste
call, and it is the specific failure that cut `sear-notch` and `blowdown-seat`.

**Shading.** A fixed overhead light gives each mark `±0.06 L` by its face angle. Hangers
and arms do not shade.

## 4. Alive at rest (no input)

Angles below are the root / level-2-left / one leaf, in degrees:

- **t = 0.0 s** — `+16.0 / +16.0 / +34.0`. Released from the composed still, so the
  assembly is at its widest spread.
- **t = 2.5 s** — `+14.6 / +11.9 / −12.7`. The leaf has crossed frontal and is
  foreshortening the other way; the root has barely moved.
- **t = 5.0 s** — `+10.6 / +2.4 / −30.1`. Level 2 is now near frontal while the leaf is at
  its far extreme — the tree is visibly *out of phase with itself*, which it will never not be.

Nothing translates. All motion is rotation at 7-27 s periods, which is slower than any
reading saccade and cannot pull the eye off adjacent copy.

## 5. Reduced-motion freeze frame

**Freeze at t = 14.6 s.** Root at `+19°`; level 2 at `−11°` and `+7°`; one leaf mark at its
`+34°` extreme so its foreshortening is obvious, with its sibling near frontal for
comparison; two arms visibly hanging with unequal `d` because their marks have
different ink coverage.

Why: the frame has to prove three things a still can otherwise not show — that the tree is
a tree, that the arm offsets are *earned* (unequal `d` on a level arm), and that the marks
rotate (one foreshortened, one frontal, side by side). t=0 has everything plumb and
frontal, which is a static grid of logos: the automatic reject in `showpiece-recipe.md`
Filter 2.

Byte-stability: ink coverages, periods, phases and the draught noise are all pure functions
of a fixed seed and the frozen clock. Nothing is sampled from `Math.random` or from
`performance.now` outside the frozen path.

## 6. Hue carried by luminance, both themes

| | Light theme | Dark theme |
|---|---|---|
| hanger wire (1 px) | `--ns-muted` @0.50 | `--ns-muted` @0.50 |
| arm (1 px) | `--ns-muted` @0.70 | `--ns-muted` @0.70 |
| mark | `--foreground` @0.82 | `--foreground` @0.82 |
| overhead face shading | ±0.06 L | ±0.06 L |
| fulcrum pivot dot (2 px) | `--foreground` @0.55 | `--foreground` @0.55 |

Every value is identical in both themes, because the whole component is line work and
flat marks on the page's own ground — there is nothing here whose identity is a
material, so there is nothing to invert. `--border` is not used: at ~1.1:1 in light theme a
1 px hanger drawn in it would be invisible, and the hangers are the structure.

Zero `--ns-accent` in the canvas. It appears only on the pause button's focus ring and
on any link in the DOM list beneath.

## 7. Accessibility

- Canvas is `aria-hidden="true"`. The wall is decorative; **the marks are never the only
  carrier of a name.**
- The real content is a DOM `<ul>` of company names in document order, rendered under
  the mobile (or visually hidden if the design calls for marks only). Each entry that links
  is an ordinary `<a>` whose accessible name comes from its text.
- One `<button aria-pressed>` "Pause motion" that genuinely halts the rAF loop. It is the
  only tab stop the canvas contributes. Focus order: preceding heading (not focusable) ->
  pause button -> list links in order.
- No `aria-live` — nothing here is a value.
- **Legibility contract:** the 34° cap keeps every mark at >= 0.83 of its frontal width at
  all times. Verify by measuring the narrowest drawn mark width over a 60 s window at a
  320 px card, at dsf 1 and dsf 2, in both themes.

## 8. Placeholder copy

- heading: `Section heading placeholder`
- list: `Company One` … `Company Eight`

Marks are abstract generated glyph-marks (the `logo-cloud-settle` family). Ship no real
wordmark, and no generated mark that resembles one. No customer counts, no
"trusted by N teams".
