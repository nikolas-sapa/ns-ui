# slate-gauge — testimonial wall as a slated roof

**Collection:** core · **Surface:** testimonial wall / wall-of-love

## 1. Surface and the real process

Replaces the testimonial wall — the grid of quote cards.

Borrowed process: **slate roofing (double-lap slating)**. Slates are hung on battens so
each course laps the two below it. Only the **margin** — the exposed strip, called the
*gauge* — is ever visible, and it is computed, not chosen: `gauge = (length − lap − 25 mm) / 2`.
Courses are commonly *diminishing*, larger slates at the eaves shrinking toward the ridge.
Slates are head-nailed or centre-nailed; a centre-nailed slate can lift at the tail in wind
and clatter back down. Side laps are broken by offsetting each course half a slate.

## 2. Nearest existing slug and why this is not a restyle

Nearest: `testimonial-wall-reflow` (core), `pancake-lap` (loud), `grazing-light` (core).

`testimonial-wall-reflow` shows every card whole and animates the **layout** when one
grows; slate-gauge never shows a whole quote at rest — occlusion to the gauge margin
is the point, so the wall's geometry never changes and what moves is one slate about
its nail. `grazing-light` uses raking light to **reveal hidden relief** and snaps its bearing
to the pointer; here the light never reveals text, never tracks the pointer, and only
lengthens the cast shadow between two physically overlapping plates. `pancake-lap`
shares the word "lap" and nothing else: its pans ride over rims on open water, this is a
fixed hung lattice.

## 3. Mechanic

Geometry (reference at a 1200 px wide wall; all lengths scale from `min(w, h)`):

| Course | Slate height | Gauge (exposed) |
|---|---|---|
| 1 (eaves) | 132 px | 40.0 px |
| 2 | 120 px | 34.0 px |
| 3 | 110 px | 29.0 px |
| 4 | 101 px | 24.5 px |
| 5 (ridge) | 94 px | 21.0 px |

- Diminishing ratio 0.915 per course. Lap fixed at 44 px. Head allowance 8 px.
  `gauge = (h − 44 − 8) / 2`, exactly as a slater computes it.
- Slate width 168 px; each course is offset laterally by 84 px (half a slate) to break the
  side lap.
- **Lift on read:** the slate rotates about its nail line (18 px below its head) to −34° over
  260 ms, spring stiffness 210 / damping 19, one 3° overshoot. Tail rises 62 px. The
  courses below do not move; the lifted slate is drawn above them and its full quote is
  legible on the now-exposed face.
- **Return:** 340 ms with two decaying clatters — −34° -> +2° (210 ms) -> −0.6° (120 ms)
  -> 0° (70 ms).
- **Idle gust, unconditional:** a gust field 190 px wide crosses the wall left to right every
  4.80 s at 260 px/s. A deterministic 3-in-17 subset of slates is centre-nailed; any
  centre-nailed slate whose tail is inside the gust lifts 2.5-5 px and clatters back over
  180 ms with two bounces. Something is always ticking somewhere on the wall.
- **Idle light, unconditional:** the light azimuth swings ±14° over 22.0 s, so every
  slate's tail shadow on the course below lengthens, shortens and changes side
  continuously. This is a whole-wall breathing that is visible even between gusts.
  The light never changes any slate's own face luminance — only its cast shadow.
- **Riven face:** each slate carries a deterministic 1-D fracture profile seeded from its
  index, ±0.03 L banding at 3-9 px spacing. Byte-stable, never animated.

## 4. Alive at rest (no input)

- **t = 0.0 s** — azimuth +14°, all tail shadows at maximum and falling left; gust
  offscreen at x = −190.
- **t = 2.5 s** — gust crossing column 3, two centre-nailed slates lifted ~4 px mid-clatter
  with their shadows momentarily detached; azimuth +3°, shadows nearly symmetric.
- **t = 5.0 s** — the gust has exited right and a fresh one is entering left; azimuth −9°,
  every shadow on the wall now falls to the right. The whole wall's shadow structure has
  inverted between t=0 and t=5.

The shadow swing is a 22 s period at ±0.12 L on shadow pixels only — slow and
low-contrast enough to sit under readable margin text without pulling the eye.

## 5. Reduced-motion freeze frame

**Freeze at t = 7.40 s.** Azimuth −6° (clearly directional, not the ambiguous symmetric
zero), the gust centred on column 2 with one slate held at its maximum 5 px tail lift and
its shadow detached from the course below, and one slate held fully lifted at −34°
showing a complete quote.

Why: every state the component has — lapped at rest, gust-lifted, fully read — is in
one frame, plus the lap structure itself. t=0 has no lift and shadows at their extreme,
where a cast shadow reads as a flat CSS drop shadow and the physical lap is lost.

## 6. Hue carried by luminance, both themes

Slate is a dark stone in both themes; the page is not.

| | Light theme | Dark theme |
|---|---|---|
| slate face | L 0.34 | L 0.52 |
| exposed margin (sky-lit) | +0.06 | +0.05 |
| tail shadow on course below | −0.12 | −0.10 |
| riven texture | ±0.03 | ±0.03 |

The **shadow magnitude is 0.10-0.12 in both**, so the relief cue is identical strength;
only the base offset moves, and the wall reads as an object against its ground either
way. Quote text on the face is `--foreground` in light theme and `--background` in dark
(ink is darker than slate in both, no glow inversion). `--border` is unused. `--ns-accent`
appears only on the read-button focus ring.

## 7. Accessibility

- Each slate is a `<button aria-expanded>` wrapping an `<article>`. The quote text is in
  the DOM **at all times** — occluded with CSS clipping, never `display:none` — so
  screen readers, Ctrl-F and text selection get every quote whether or not it is lifted.
- Tab order is reading order: course 1 left-to-right, then course 2, and so on. Not
  visual-stacking order.
- Enter and Space lift and hold; Escape and blur return. Only one slate is lifted at a
  time — lifting a second returns the first, and both `aria-expanded` values update in
  the same commit.
- No `aria-live`: nothing numeric changes, and `aria-expanded` already carries it.
- Minimum hit target: the gauge margin is 21 px at the ridge course, below 44 px, so
  each slate's hit area is padded to 44 px tall via a transparent overlay that does not
  change the drawn lap. State this explicitly in the build.

## 8. Placeholder copy

- quote: `Placeholder testimonial sentence one. Placeholder testimonial sentence two.`
- attribution: `Name Placeholder`, `Role Placeholder, Company Placeholder`
- section heading: `Section heading placeholder`

Do **not** ship a fabricated quote, a real-sounding company, a job title that implies a
real customer, or a star rating.
