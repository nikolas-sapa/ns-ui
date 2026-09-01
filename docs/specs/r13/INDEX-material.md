# INDEX-material — r13 material & surface slice

Scout: `scout-material`. Slice: material/surface treatments at landing-page block
scale — feature cards, callouts, quote blocks, badge/seal marks, image frames,
card hover/reveal at section scale, "how it works" step blocks, stat/number
blocks. Families: paper, metal, glass/ceramic, textile, coating.

**9 specs, not 10.** ~24 candidates were considered; 15 were killed. The tenth
survivor (`deckle-drain`) was cut late for a reason recorded in the kill list
below, and I did not backfill it with a weaker concept.

Re-ranked and re-scoped against `docs/specs/r13/GAP-MAP.md` after the first pass.
Two changes that matter: `peel-flow` moved from "section feature banner" to the
**closing CTA band** (gap #2, the only bucket in the repo at zero) because it is
both the highest-value block and my strongest mechanic, and `dandy-watermark` was
scoped from a standalone badge onto **that same band's trust row** so the two
compose into one block rather than adding to the 23-slug decorative bucket.

Every spec names a real, existing material process with the physical parameter
that drives it, an unforced unbounded resting loop, a non-t0 freeze frame, five
luminance stops spanning near-black to near-white in **both** themes, and a
named worst frame for text legibility rather than an assumption.

## Ranking

Re-ranked after `docs/specs/r13/GAP-MAP.md`. Primary weight is **which block the
material builds**, not how good the mechanic is on its own — GAP-MAP's targeting
note is explicit that decorative/texture (23) and ambient background (54) are the
two most crowded non-hero buckets, so a material treatment that is only a surface
lands in the wrong place. Every entry below is scoped to a block. Mechanic-strength
order, which is different, is given underneath.

| # | slug | block it builds | GAP-MAP bucket | family | one-line justification |
|---|---|---|---|---|---|
| 1 | `peel-flow` | closing CTA band | **gap #2, count 0** | coating | The highest-value empty bucket in the repo, built out of Orchard's levelling equation — a lambda^4 low-pass filter you can watch run, short texture gone in ~1 s while 1 mm texture survives minutes in the same patch. WebGL, the smallest mechanic family. |
| 2 | `cockle-swell` | pull-quote / testimonial | **gap #4, count 2** | paper | GAP-MAP names the hole as "any quote surface where the *reading* is the mechanic"; the 5:1 CD/MD hygroexpansivity ratio makes the sheet move directionally under the quote as you read it. |
| 3 | `damask-float` | feature grid | **gap #5, count 6 (2 real)** | textile | GAP-MAP asks for "a grid where the *cells* carry the mechanic"; one cloth spans the grid, and the hover reversal (satin flips, figure becomes ground) propagates as a front no other slug can produce. |
| 4 | `spangle-freeze` | large feature card / section masthead | gap #5 bucket | metal | The cleanest monochrome argument available: one metal, one colour, patchwork purely from per-grain crystallographic orientation. WebGL, four unbounded mechanisms. |
| 5 | `frit-sinter` | stat / KPI row | **runner-up #12**, all 3 existing are app-register | glass | A landing-page KPI block rather than a dashboard one; Frenkel necking on a belt kiln, and the numeral's legibility is real scattering opacity in transmission. |
| 6 | `dandy-watermark` | trust seal on the closing band | gap #2 furniture | paper | Composes with #1 into the same block. Beer-Lambert transmission with no light source and no normal at all — the deliberate optical opposite of `grazing-light`. |
| 7 | `wire-skim` | "how it works" step block | no bucket; nearest gap #5 | metal | The steps *are* the EDM passes, with real offsets and Ra values, and the numeral is an actual through-aperture rather than shaded type. |
| 8 | `wrinkle-cure` | feature card | gap #5 bucket | coating | Two real numbers (lambda ~218 um, eps_c 0.52%) driving a Swift-Hohenberg field under a sweeping IR bar; a finish that is sold *for* its defect. |
| 9 | `plate-throw` | image frame / matte | furniture for feature + gallery | metal | The only spec here whose aliveness is a **dynamic equilibrium** rather than material crossing the frame, and dog-boning means the physics singles out exactly the geometry a frame is. |

**Mechanic strength, ordered independently** (use this if the round needs to cut on
craft rather than on block coverage): `peel-flow`, `spangle-freeze`, `frit-sinter`,
`wire-skim`, `damask-float`, `cockle-swell`, `plate-throw`, `wrinkle-cure`,
`dandy-watermark`.

## Never-rebuild audit

All 9 checked against GAP-MAP section 6 (59 removals) and the "explicitly closed"
list. No collisions. The four worth recording because they are in the same
territory:

- **`light-table`** (cut 2026-08-10) was the registry's other backlit surface.
  `dandy-watermark` is not it — a light table is a viewing instrument you place
  transparencies on; this is a running paper web whose mark is the material's own
  caliper. Recorded in that spec's item 2.
- **`vacuum-filtration-cake-build`** was **built and quarantined in r10 owner
  review**, not merely specced. That strengthens rather than weakens the kills of
  `cast-wall` and `deckle-drain` below: the constant-pressure Darcy cake law has
  already been tried on this repo and cut.
- **`auger-flighting-spoil`** was quarantined in r12. Two of my specs originally
  cited its steady-state-turnover pattern as a positive model; both citations are
  removed and now point at the `seam-gild` / `starch-shear` lesson in
  `showpiece-recipe.md` instead.
- **Closed axes** — liquid-metal hero, lens/magnifier, knot geometry — none of the
  9 touches any of them.

## Structural notes for the orchestrator

- **Three specs use a moving web/band** (`peel-flow`, `frit-sinter`,
  `spangle-freeze`). This is deliberate and is the fix for the "process that
  finishes and stops" auto-reject: a monotonic process becomes unbounded when the
  process zone is **spatial** rather than temporal. They are not
  interchangeable — one is a wavelength-selective filter, one is particle
  necking with 15% shrinkage, one is stochastic nucleation to impingement. But if
  the round wants fewer, cut in that order from the bottom of the ranking.
- **A moving band is not sufficient on its own.** `spangle-freeze` needed a second
  fix: its tessellation is permanent once impinged, so the band alone would have
  left the mature two-thirds of the panel a still image sliding — green on the
  gate, dead to the eye. Its spec now carries interfacial alloy growth for that
  region plus a decisive check (crop the upper third, compare t=0 vs t=5s, and if
  it differs only by translation the component fails). Any builder adding a moving
  band to a monotonic process should apply the same test.
- **`wire-skim`'s 20.9 s cycle is longer than the gate's 5 s window**, so the
  graded screenshots only ever see the rough pass. Its spec names two acceptable
  answers and prefers shortening the rough pass to 4.2 s; the orchestrator should
  decide that before the builder starts.
- **`plate-throw` is the counterweight**: dynamic equilibrium, no band, no
  indexing. `cockle-swell` and `dandy-watermark` are quasi-periodic-field and
  scrolling-field respectively. `wire-skim` is an indexed production run.
- **Cross-scout collision, surfaced not hidden:** `hero-verso-showthrough`
  (scout-hero) uses a **paper formation field read in transmitted light**, and so
  does my `dandy-watermark`. They differ correctly — verso-showthrough is a
  *static* sheet with a *moving* light and mirrored verso ink; dandy-watermark is
  a *moving web* under *fixed* illumination with a caliper modulation from a roll
  — but two paper-transmission components in one round is an owner call, not
  mine. This is also why I killed `deckle-drain`: it would have been the third.
- **`grazing-light` is the nearest slug for more of this slice than is obvious**
  (blind-embossed feature-grid card revealed by a raking light). The set is
  diversified **optically**, not just by material: transmission (`dandy-watermark`),
  geometric distortion of flat ink (`cockle-swell`), scattering opacity
  (`frit-sinter`), planar reflectance anisotropy (`damask-float`,
  `spangle-freeze`), gloss/matte lobe width (`peel-flow`), an actual hole
  (`wire-skim`), no type at all (`plate-throw`). Only `wrinkle-cure` uses relief,
  and it inverts the relationship — fixed light, moving relief.

## Killed, and why

**Killed on an existing slug (a restyle):**

- `peen-blast` (shot peening) — `peen-coverage` already is exactly this, including
  the coverage bitmap saturating past nominal 100%.
- `craze-net` (glaze crazing) — `craze-rule` and `crack-polygon-order` hold
  fracture-tessellation. Nothing left to add.
- `shock-shatter` (thermal shock / Prince Rupert's drop) — `rupert-snap`.
- `mesh-mark` (screen-print mesh imprint / ink film thickness) —
  `screen-flood-stroke` owns the screen-printing stroke cycle.
- `blister-lift` (coating blistering) — `glaze-crawl-heal` is bubbles bursting
  through a melt that then heals or crawls away. Same mechanic, different material.
- `crater-marangoni` (silicone-contamination cratering) — same collision as above.
- `alligator-check` (coating alligatoring) — `crack-polygon-order`.
- `brush-grain` (brushed metal grain) — `weld-pool` already carries brushed
  streaks in a far better environment model.
- `weave-moire` (moire from two overlaid weaves) — `dial-moire`,
  `background-halftone-rosette`, `lenticule-swing`.
- `resist-crackle` (batik wax resist crackle + dye ingress) — `confirm-hold-wax`
  plus `dye-whorl` between them cover both halves.
- `card-chain` (jacquard control mechanism) — `jacquard-card-chain`. (The *cloth*
  survived as `damask-float`; the mechanism did not.)
- `foxing-bloom` (paper foxing) — too close to `ring-stain`'s pinned-contact-line
  deposition, and its identity is genuinely a hue (foxing is brown). Both
  auto-rejects.

**Killed on a component that was built and then cut:**

- `cast-wall` (slip casting, wall thickness `t^(1/2)`) — this is the
  constant-pressure Darcy cake law, which is `vacuum-filtration-cake-build`. That
  component was **built and quarantined in r10 owner review**, so it is on the
  never-rebuild ledger, not merely a spec someone wrote.
- `deckle-drain` (handmade sheet formation, drainage through the deckle) — killed
  for two reasons together: its drainage kinetics are the same quarantined Darcy
  cake law, and its live texture would have been a **third** paper formation field
  in this round after `cockle-swell` and scout-hero's `hero-verso-showthrough`.
  This is the one I would have shipped as #10 and I would rather deliver nine.

**Killed on the monochrome filter (identity is a hue):**

- `anodise-band`, `patina-creep`, `temper-run` — anodising interference colour,
  copper patina, and steel tempering colours are all *only* their hue. Steel
  tempering was already dropped on this filter in a previous round; adding it back
  would be a documented regression.

**Killed on aliveness (finishes and stops, and could not be rescued):**

- `felt-shrink` (wet felting) — irreversible densification that saturates. The
  only rescue was a continuous fulling line, which would have been a **fourth**
  moving band in the set for the weakest concept in it.
- `laid-chainline` (laid paper wire marks) — a static texture. Subsumed into
  `dandy-watermark`, where the chain lines earn their place by scrolling with a
  web that has an actual mechanic.
- `tip-in-curl` (a plate tipped into a book block, curling at its free edges) —
  its mechanic is hygroscopic curl, which is `cockle-swell` at a different scale,
  and its gesture is `sticker-peel`. Self-duplication plus a slug collision.
- `calender-nip` (supercalender gloss/caliper passes) — a genuine pass structure,
  but `wire-skim` already occupies "step block whose steps are process passes" and
  does it with better numbers, and `roller-break-reduce` holds roll-stand
  reduction.
