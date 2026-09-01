# rocker-blot — waitlist capture as a rocker blotter

**Collection:** core · **Surface:** waitlist capture with a real payoff — gap-map gap #6 (1 of 53 form slugs is a landing capture)

## 1. Surface and the real process

Replaces the email-capture moment: one field, one button, and whatever stands in for
social proof beside it.

Borrowed process: the **rocker blotter** over a hotel or shop register. A curved wooden
holder carrying a sheet of blotting paper is rocked once across fresh iron-gall or
fountain ink; capillary action lifts the surplus. What stays on the blotter is a
**mirrored, partial** impression of the writing, and successive blottings overlay into a
palimpsest — which is precisely why used blotting paper was a period security problem.
How much ink transfers depends on how long the stroke has been sitting. The sheet is
changed when it saturates.

## 2. Nearest existing slug and why this is not a restyle

Nearest: `signature-consent` (core) and `streaming-ink-dry` (core).

**Removed-ledger note:** `pneumatic-carrier-dispatch` (r11) was built on the carrier-tube
idea and cut in owner review, which independently confirms the kill of the Lamson-tube
capture concept recorded in `INDEX-convert.md`.

Both of those are about the ink that **stays** — one embosses a captured signature, the
other dries text as it arrives. The entire mechanic here is **subtraction and transfer to a
second surface**: uptake is a function of stroke age, and the residue is mirrored,
accumulates, and is itself the display. Nothing in the registry moves ink off one surface
onto another, and nothing else has a display whose content is the wastage of a
previous interaction.

## 3. Mechanic

**The readable text is never touched.** The email `<input>` is plain DOM and its
rendered characters are never re-drawn, lightened, or rasterized over. The ink model
applies to (a) a drawn *ruled entry stroke* beneath the input, whose length equals the
submitted string's measured width, and (b) an offscreen one-shot raster of the
submitted string used only to build the mirrored ghost.

**Uptake law:** `uptake = 0.62 * exp(−age_seconds / 1.4)`, floored at 0.04. A
just-submitted stroke gives up ~60% of its density; a 3 s-old stroke gives up ~9%.

**Blot sweep on submit**, 520 ms:
- contact arc 46 px wide, travelling 380 px
- rocking rotation ±11°, with the contact point leading the geometric centre by 9 px
- behind the arc the ruled entry stroke is drawn at `(1 − uptake)` density; ahead of it,
  full. The moving boundary is the component's single most explanatory moment.

**Ghost composite:** the mirrored raster lands on the blotter sheet advanced 28 px
down from the previous ghost with ±6 px jitter, at `alpha = uptake * 0.7`, mirrored
horizontally, with a capillary blur starting at 1.4 px.

**Fibre model (unconditional, runs whether or not anyone submits):**
- blur grows toward 3.1 px with `tau = 26 s`
- alpha decays 4% per minute
- 40 deterministic paper fibres pull 0.5 px feathers out of ghost edges at 1.6 px/s until
  each reaches 9 px
- the sheet is **seeded at mount** with 6 pre-existing ghosts at simulated ages
  0.4 s / 3 s / 9 s / 22 s / 60 s / 140 s, so the surface is never empty on first paint and
  is always mid-process

**Sheet change:** when total ink coverage passes 34% of the sheet area the sheet slides
out left over 700 ms and a fresh one slides in. Bounded memory, unbounded loop.

**Rocker idle:** parked at the side of the sheet, the rocker never fully stops — ±3° on a
2.90 s period with a 1 px translation.

Geometry from `min(w, h)`: sweep length `0.62 * w` capped at `2.4 * min(w,h)`; ghost
pitch `0.055 * min(w,h)` floored at 16 px.

### 3b. The payoff — what submitting actually produces

`GAP-MAP.md` gap #6 is specific: the waitlist moment is missing because submitting
produces a toast instead of a real payoff. This component's payoff is the blotter itself,
and it is made of three durable things, none of which is a toast:

1. **A queue position that is physically located.** The submitted entry's ghost lands at a
   fixed vertical index on the sheet — ghost *n* sits at `y = 28n px`. Your position in the
   queue is where your ghost sits in the stack, readable by eye. It is also DOM text
   (`aria-live`), because a screen reader cannot count ghosts.
2. **A durable session artefact.** Your ghost is drawn at a higher contrast than the
   seeded ones (`alpha = uptake * 0.7 * 1.35`, capped at 0.62) and carries a 1 px
   underline; it stays that way for the session, so returning to the section shows you
   your own mark rather than a cleared form.
3. **A referral state that is the same mechanic.** If the consumer supplies a referral
   handler, a second, deliberately *drier* blot (uptake floor 0.04, so a faint ghost) is
   laid for each referral, and the sheet's saturation toward the 34% sheet-change
   threshold is the shared progress. Nothing new is invented for this state; it is the
   uptake law at a different age.

The form does not clear on success. The field goes read-only with its value intact, the
button becomes a disabled "Placeholder submitted state", and the queue position sits
beside it as text.

## 4. Alive at rest (no input)

- **t = 0.0 s** — 6 seeded ghosts; the youngest crisp at 1.4 px blur; rocker at +3°.
- **t = 2.5 s** — youngest ghost's feathers have grown ~4 px and its blur is 1.9 px, so its
  edge is measurably softer; rocker at −2.4°.
- **t = 5.0 s** — youngest ghost blur 2.3 px, feathers ~8 px, visibly softer than at t=0;
  rocker at +1.1°.

All idle change is edge softening at ≤ 0.05 alpha per second, on a surface that sits
beside the form rather than under its label — it cannot distract from reading the field.

## 5. Reduced-motion freeze frame

**Freeze at t = 1.90 s of a submitted blot** — the rocker 63% across its sweep at −7°,
contact arc mid-field, the ruled entry stroke *lifted (pale) behind it and full ahead of it*,
and a fresh mirrored ghost landing at 0.44 alpha over five older ghosts at blurs 1.9 /
2.3 / 2.7 / 2.9 / 3.1 px.

Why: the before/after boundary under the rocker is the only thing that explains
subtraction in a still frame, and the ghost stack behind it explains accumulation. t=0
has a parked rocker, no lifted region and no new ghost — nothing that says "this thing
takes ink away".

Byte-stability: seeded ages, fibre positions and jitter are all fixed-seed; the frozen
clock produces the same bytes on every mount.

## 6. Hue carried by luminance, both themes

**Ink must stay darker than paper in both themes — no glow inversion.**

- **Light theme:** register paper is `--background`; ink is `--foreground` at ≤ 0.86 alpha;
  ghosts are the same ink at 0.05-0.44 alpha.
- **Dark theme:** the register paper is drawn as an `--ns-muted` panel at `+0.24 L` above
  `--background`, and ink is drawn as `--background` — i.e. still darker than its paper.
  Ghosts are the same, 0.05-0.44 alpha.
- Blotter felt backing: `−0.04 L` in light, `+0.04 L` in dark. Equal magnitude, flipped sign.
- Rocker body: a 0.10 L step from the felt in both themes, with a 1 px specular line on
  the curved face at `±0.08 L`.
- `--ns-accent`: submit button fill and all focus rings only. Never on the ink, the rocker
  highlight, or a ghost.

## 7. Accessibility

- A real `<form>` with `<label for>` on `<input type="email" autocomplete="email"
  required>`, an error `<p id="...">` wired through `aria-describedby`, and
  `aria-invalid` toggled on validation failure.
- Tab order: input -> submit button. The canvas is `aria-hidden="true"` and carries no
  information that is not also in DOM text.
- `aria-live="polite"` announces the result once on submit, including the payoff:
  `"Placeholder confirmation message. Position PLACEHOLDER in the queue."` It never
  fires during typing or during the sweep.
- The queue position and any referral state are **DOM text**, never only a ghost. A
  screen reader user gets the payoff in full without the canvas.
- On success the input becomes `readonly` (not `disabled`, so it stays focusable and its
  value stays selectable and copyable) and the button becomes `disabled` with an
  accessible name describing the completed state.
- The input is re-enabled the moment the request settles, **not** when the 520 ms
  animation ends. The sweep is feedback, never a gate.
- Keyboard submit (Enter in the field) produces the identical sweep as a click.

## 8. Placeholder copy

- label: `Email address`
- button: `Join the list`
- confirmation: `Placeholder confirmation message.`
- error: `Placeholder validation message.`

No signup counts, no "join N others", no launch dates, no incentives.
