# matrix-return — logo wall as Linotype matrix circulation

**Collection:** loud · **Surface:** logo wall / trust wall

## 1. Surface and the real process

Replaces the logo cloud — the band of client or partner marks.

Borrowed process: the **Linotype matrix circulation**, specifically the *distributor bar*.
Brass matrices drop from a magazine, assemble into a line with space bands, the line is
cast into a slug, and the matrices are then lifted to the distributor. Each matrix carries
a unique **V-notch code** cut into its ears — seven teeth, a distinct combination per
character. Riding the distributor bar the matrix hangs by those ears; at the channel
whose bar profile matches its notch code the last support is lost and the matrix falls
into its own magazine channel. It is a purely mechanical sort: no reader, no memory,
no state anywhere except the shape of the object.

## 2. Nearest existing slug and why this is not a restyle

Nearest: `jacquard-card-chain` (core) and `logo-cloud-settle` (core).

The Jacquard chain is a **read** — a fixed needle bank samples a passing card and the
cards never leave the chain, so the mechanism is a scan line. matrix-return is a **sort
with no reader**, where the same objects continuously leave the assembly, ride a rail,
and are released at *different points along it* by the shape of their own notch, so the
resting state is a circulation with a spatial code rather than a sequence. `logo-cloud-settle`
plays once on viewport entry and then holds a settled grid forever; this has no settled
state at all and the population of each region is always changing.

## 3. Mechanic

- **N = 14 marks.** Each is assigned a 7-bit notch code from its index, Gray-coded so
  adjacent channels differ by exactly one tooth. Marks are abstract generated glyph-marks
  (same family as `logo-cloud-settle`'s) — the component ships no third-party logo.
- **Assembly line**, bottom of the frame: marks arrive left to right, one every 640 ms.
  Measure = `0.86 * container width`. When the summed widths pass `0.93 * measure`
  the line is full and casts.
- **Cast:** 220 ms hold, with a 60 ms flash at `+0.18 L` confined to the line, then the
  line rises 34 px over 300 ms and dissolves into the transit stream.
- **Distributor bar:** a 1 px rail at `0.22 * height`. Marks ride it left to right at 74 px/s.
  14 channel mouths are evenly spaced along it. A mark releases at the channel index
  given by the highest set-bit run of its code — deterministic, and visibly *not* uniform,
  which is the whole point.
- **Drop into channel:** 180 ms fall with a 2 px bounce.
- **Magazine escapement:** every 640 ms one mark is released from a channel chosen by
  a fixed 14-long sequence so no channel starves, sliding down at 300 px/s to rejoin
  assembly.
- **Conservation:** the loop is closed. Nothing is created or destroyed, so the wall can
  never empty or pile up, and steady state is roughly 7 in assembly, 4 in transit, 3 in the
  magazine. This is what makes it unbounded rather than a cycle that resets.
- Geometry from `min(w, h)`: mark size `0.075 * min(w,h)` floored at 14 px; bar height
  `0.22 * h`; channel pitch `width / 14`.

## 4. Alive at rest (no input)

- **t = 0.0 s** — 3 marks assembled, 4 spaced along the bar, magazine channels full and
  uneven.
- **t = 2.5 s** — 7 marks assembled, one line just cast and rising, the bar's leading mark
  about to release into channel 9.
- **t = 5.0 s** — a cast has completed and a new line is 2 marks in; the bar's population
  and every channel's fill height differ visibly from t=0.

There is no text in this component to compete with; it is a band under or over a real
DOM `<ul>` of names.

## 5. Reduced-motion freeze frame

**Freeze at t = 3.85 s.** A line of 9 marks assembled and mid-cast-flash; three marks
spaced at different points along the distributor bar; one mark 40% of the way down its
channel; the magazine showing uneven channel fills.

Why: all four stages of the circulation are visible at once, which is the only way a still
frame can communicate that this is a loop rather than a queue. t=0 has a full magazine,
an empty bar and a nearly empty line — it reads as something about to start, which is
exactly the wrong story.

Byte-stability: the escapement order is a fixed array, the notch codes are a pure
function of index, and nothing consults a PRNG after mount.

## 6. Hue carried by luminance, both themes

| | Light theme | Dark theme |
|---|---|---|
| matrix body | L 0.42 | L 0.58 |
| notch teeth (cut) | −0.10 | −0.10 |
| face glyph (knocked out) | L 0.88 | L 0.14 |
| cast flash | +0.18 | +0.18 |
| channel mouth gradient (6 px) | −0.06 | −0.06 |

The body/ground relationship flips (brass is darker than paper, lighter than a dark room)
but **every delta is identical in both themes**, so the notch code, the flash and the
channel mouths carry the same weight either way. The distributor bar is a 1 px
`--ns-muted` rail, not `--border` — `--border` at ~1.1:1 would be invisible as a stroke
and the bar is the component's spine. Zero `--ns-accent` in the canvas; it appears only
on the optional pause button's focus ring.

## 7. Accessibility

- Canvas is `aria-hidden="true"`. The wall is decorative.
- The real trust content is a DOM `<ul>` of names rendered over or under the canvas,
  in normal document order. If the component takes a `logos` prop each entry becomes
  an `<li>` with real text; if a mark is also a link it is a normal `<a>` with an accessible
  name from its text, not from the drawn glyph.
- One `<button aria-pressed>` "Pause motion" in DOM is the only tab stop the canvas
  contributes. It genuinely halts the rAF loop, it does not just slow it.
- No `aria-live` — nothing here is a value.
- Text over the canvas sits on a `bg-background/78 backdrop-blur` scrim; verify >= 4.5:1
  at the cast-flash frame, which is the brightest the field ever gets.

## 8. Placeholder copy

- heading: `Section heading placeholder`
- list: `Company One` … `Company Fourteen`

Never ship real wordmarks, and the generated marks must not resemble any real one.
