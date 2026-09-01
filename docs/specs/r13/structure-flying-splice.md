# flying-splice

- **slug:** flying-splice
- **tier:** core (card-scale canvas band)
- **surface:** logo ribbon / marquee

## 1. Surface it replaces + the real process
Logo ribbon / marquee. Borrowed from the **flying paster (automatic splicer) on a web press**. Two
roll stands. The running roll unwinds and **visibly shrinks**, and because web speed is held
constant, its RPM climbs continuously as its radius falls. When its diameter reaches the splice
diameter, the standby roll — already prepared with a chevron pattern of splicing tape on its outer
wrap and tabbed down — is **spun up by a brush or belt until its surface speed matches the running
web**, typically to within 1-2%. A paster arm then presses the running web onto the new roll's taped
leading edge and a knife severs the expiring web. The splice is **diagonal** so it passes through
the nips progressively instead of as a full-width shock. The spent core is ejected and a fresh roll
is loaded.

## 2. Nearest existing slug + why this is not a restyle
Nearest: `ticker-tape-splice` ("quotes stream right-to-left at constant speed, new data visibly
splices in with a 1px seam that travels with the strip"), plus `marquee-ticker-glyph`,
`ticker-teleprinter` and `logo-cloud-settle`. ticker-tape-splice's splice is an event **on the
strip** and the component has no supply side at all — nothing exists off the strip, so "diagonal tab
instead of a 1px seam" would be a pure restyle and is explicitly rejected here. **This component's
primary subject is the two roll stands**: two rotating discs whose radii change over the whole
cycle, whose RPMs visibly differ and change to hold constant surface speed, with a paster arm and a
knife between them. The ribbon of marks is the *output* the rolls feed, and the splice happens
because a roll ran out, not because data arrived.

**Hard constraint:** the rolls must occupy at least **30% of the band width**. If the dominant
moving object ends up being a ribbon with a seam crossing it, the concept is dead — see kill criteria.

## 3. One-sentence mechanic
Two paper rolls feed a ribbon of marks at constant speed: the running roll shrinks and spins faster
until it is spent, the standby roll spins up to matched surface speed, and a paster and knife splice
the web across.

## 4. Rendering approach
2D canvas band. Two roll stands drawn as circles with a radial wrap modulation and a single-lamp
Lambert shade; the ribbon is a scrolling strip of seeded procedural marks; the paster arm, brush and
knife bar are `--foreground` silhouettes. `M = min(bandW, bandH)` for the mechanism, `W = bandW` for
the ribbon.

## 5. Real numbers
Worked at a representative band of `W = 3*M` so the numbers are checkable.
- **Web speed constant:** ribbon scrolls right-to-left at `v = 0.42*W/s`; a mark crosses in 2.4s.
  At `M = 340`, `W = 1020`, so `v = 428 px/s`.
- **Roll geometry:** `R_max = 0.19*M` (64.6px), `R_core = 0.052*M` (17.7px),
  `R_splice = 0.081*M` (27.5px, ~1.56x core). The radius change over a cycle is **64.6px -> 27.5px** —
  unmistakable at card scale.
- **Depletion:** `dr/dt = -v * t_paper / (2*pi*r)`, with `t_paper` chosen so `R_max -> R_splice`
  takes **22.0s**.
- **RPM is the mechanic:** `rev/s = v / (2*pi*r)`. At full roll `428/(2*pi*64.6) = 1.06 rev/s`; at
  splice diameter `428/(2*pi*27.5) = 2.48 rev/s`. The running roll **more than doubles its spin rate**
  over the cycle, unconditionally. Each roll carries 4 radial index lines and a visible wrap edge so
  the rotation reads rather than blurring.
- **Spin-up:** at `t = 22.0 - 3.4s` the standby roll accelerates from 0 to matched surface speed
  (1.06 rev/s at `R_max`) over **3.4s** on an ease-out, with a brush arm drawn against it.
- **Paster:** at `t = 22.0s` the arm swings 26 degrees in **180ms**. The chevron tape (two diagonal
  bands at +/-34 degrees from cross-web, each `0.03*W` wide) is transferred onto the ribbon at that
  instant and travels leftward at `v`, visible for 2.4s as it crosses.
- **Knife:** fires 90ms after paster contact, sweeping across in **120ms**. The expiring roll
  decelerates to 0 over 1.1s; its core drops out of frame over 400ms; 900ms later a fresh `R_max`
  roll rises into the vacated stand over 700ms.
- **Cycle:** **22.0s**, unbounded, never terminating.
- **Marks:** 9 seeded abstract marks (concentric arcs, bar clusters, a lattice), each `0.14*M` wide,
  spaced `0.155*W` apart, printed **on the web** — so a mark only exists downstream of the unwind
  point. Obvious placeholders; see scope note below.

## 6. Unconditional resting loop
- **t = 0s:** running roll at `r = 0.19*M`, 1.06 rev/s; standby roll static; ribbon mid-stream.
- **t = 2.5s:** the ribbon has advanced `1.05*W` (every mark replaced); the running roll's radius has
  fallen to `0.183*M`, its RPM is up ~4%, and its index lines are 2.7 revolutions further round.
- **t = 5s:** radius `0.176*M`, 1.14 rev/s, index lines 5.5 revolutions round, ribbon advanced
  `2.1*W`; the wrap edge on the running roll has visibly receded toward the core.
The 0-5s window is carried entirely by roll rotation, radius decay and ribbon scroll — the splice
event is a once-per-22s bonus, not the aliveness argument.

## 7. Reduced-motion freeze frame
`STATIC_TIME = 22.09s` — 90ms after paster contact. The arm is down on the new roll, **both rolls are
turning at matched surface speed at visibly different radii and therefore visibly different index-line
spacing**, the knife is mid-sweep, and the chevron tape band is just entering the ribbon. This is the
only instant where every part of the mechanism is simultaneously engaged. **Not t0**, which shows one
spinning disc beside a scrolling strip — a marquee with a wheel next to it.

## 8. Scroll behaviour
None. The component never reads scroll; all geometry from `M = min(bandW, bandH)`, and below
`M = 200px` the mark count drops from 9 to 6 and the index lines from 4 to 3 so the rolls stay
legible rather than becoming grey discs.

## 9. Hue -> luminance, both themes
- Ribbon (paper): `mix(bg, fg, 0.10)` light / `mix(bg, fg, 0.16)` dark.
- Marks: `--foreground` at 0.78 alpha in both, giving `deltaL >= 0.5` against the ribbon either way.
- Roll bodies read as cylinders by value alone: a radial wrap modulation of **+/-0.05 L** with period
  `0.004*M`, plus a single-lamp Lambert shade (azimuth 118 degrees) spanning **0.28 L** across the
  disc. No hue, no rim tint.
- Chevron splice tape: a **-0.14 L** band with a **+0.09 L** leading hairline — an adhesive band is
  duller than the paper and its edge catches light. Never accent, never a tint. This is the component's
  climactic moment and it is therefore the highest-risk place for the accent defect.
- Knife and paster arm: `--foreground` silhouettes with a single **+0.22 L** bevel line, the only
  specular in the component and a value, not a colour.
- `--ns-accent`: only a pause/play control's focus ring if one ships.
- `--border`: the band's top and bottom hairlines.
Tokens via `getComputedStyle` + `MutationObserver`; no literal fallbacks; no paint before the first
read on the rAF start, `ResizeObserver` and `IntersectionObserver` resume paths.

## 10. Interaction
None required. Any pause control is a real button with an accessible name. **No pointer highlight on
the web or the rolls at all** — a moving luminance blob on a rotating disc is exactly the
`edge-yield`/`granule-churn`/`shear-billow` defect waiting to happen.

## 11. Scope tripwire
The marks are procedurally generated placeholders. Do not put a real company's mark, a customer count,
or any trust claim on the ribbon — surface it to the owner instead of writing it.

## 12. Kill criteria
- **If the primary visual is still a ribbon with a seam crossing it, kill the concept.** The rolls
  must dominate; measure it (>= 30% of band width) rather than judging by eye.
- If the RPM change over a cycle is not visible — the index lines must be countable at both 1.06 and
  2.48 rev/s — reduce the index-line count rather than slowing the web.
- Must not ship in the same wave as `kiss-cut`: both are web ribbons, and the two must be judged
  side by side on whether the dominant object is a **pair of rolls** or a **peel front**.
