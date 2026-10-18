---
source: https://aviern.com/
kind: site
cohort: yc-current
verdict: mixed
studied: 2026-10-16
context: [hero, nav, features, stats, team, cta, footer]
signals:
  gradient-blob: absent
  three-card-row: present
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: absent
  symmetric-everything: absent
  badge-pill-spam: absent
  generic-line-icon-set: absent
  testimonial-card-row: absent
  indigo-violet-accent: absent
  gradient-fill-cta: absent
  scroll-reveal-blank: present
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: absent
  hero-mockup-float: absent
  asymmetric-split: present
  single-optical-anchor: absent
  type-scale-high-contrast: present
  editorial-grid-break: absent
  custom-type-pairing: absent
  real-product-surface: present
  shows-deliverable: present
  density-variation: present
  one-accent-discipline: present
  live-claim-control: absent
materials: [single-theme, video-hero, video-embed, illustration]
---

Unmanned cargo airplanes, YC F26. Full re-study of the redesigned page, rated blind
before the old evidence file was opened. The page now sells an aircraft that has not
flown (the A1000, first flight "Q4 2027") through CGI, and backs it with two short
clips of a retrofitted aircraft that has.

**Capture.** 1440x900. Reused the walk shot 2026-10-16 14:28 at
`~/scratch/antislop/s5/aviern`: window scroller, 10 tiles at a 700px step,
`clamped: false`, `coverage: 1`, docH 6947 before and after. Re-confirmed live the
same day: `ladder.cjs` walked `realH 6947`, no inner scroller. Stitched to two strips,
1440x4400 and 1440x2547, total 6947 against page 6947, zero drift. The last strip
ends in the footer (`footer.site-footer` y6761-6948: wordmark, six nav links,
`hello@aviern.com`, "© 2026 Aviern", "Privacy"). One stitch artefact, checked: the
Flying-today spec values ("5 hours / 500 mi / Autonomous") read top-clipped in strip 1
at y≈5098; raw tile 07 shows them whole, so it is the 86px fixed nav cut at the seam,
not the page. Tile 07 is 37KB because the band is flat colour, not a blank paint.
Animated content was read off the DOM and the media files, because the walker freezes
animation: the hero is an 8.0s CGI loop of four shots (robot-arm loading, apron,
top-down taxi, runway takeoff; `renders/airport-sequence`), and both `flight/` clips
were decoded frame by frame (the AV1 sources Chrome plays, and the H.264 fallbacks,
which agree). Sections, from the DOM: hero (y0, 900), figures strip (y900, 262), A1000
(y1162, 1390), timeline (y2552, 612), use cases (y3164, 1168), Flying today (y4332,
918), team (y5249, 852), contact (y6101, 660), footer.

**Slop signals present (2).**

`three-card-row`. "Where it flies." is three `article.use-card` at x56, x509, x963,
each 421px wide, each a 421x527 render, a 26px `h3` ("Commercial cargo", "Defence
life support", "Humanitarian aid"), one sentence and a "Discuss a ..." link. Equal
width, equal structure, equal weight: literally three. The renders are the company's
own CGI rather than icons, which makes it a better-dressed three-up, not a different
pattern.

`scroll-reveal-blank`. Walk vs dwell control at equal elapsed time (16 steps of 450px
at 400ms plus 1.5s settle; the dwell waits the same without scrolling). Of 96
text-bearing elements, 9 sit at effective opacity 0 at load, the same 9 in both runs:
the three timeline milestones' date ("Q1 2027", "Q2 2027", "Q4 2027"), 24px title and
description. After the walk all 9 read opacity 1; after the dwell all 9 still read 0.
The gate is scroll, not time. Served CSS:
`.milestone{opacity:0;transition:opacity .7s,transform .7s;transform:translateY(18px)}`.
The section that carries the company's whole schedule is the one an agent, a print or
a no-scroll prefetch gets blank.

**Craft signals present (6; 5 in the blind pass, see `shows-deliverable` below).**

`asymmetric-split`. Three of the five section intros pin the `h2` at x56 (w277-460)
and set a 420px paragraph at x964, leaving ~500px empty between them ("Aviern A1000"
y1262, "Where it flies." y3267, "Flying today." y4432). The hero copy is a 560px column
at x56 over a full-bleed video; the first-flight panel splits label / 72px "Q4 2027" /
copy / link unequally; the "And more." and "Build Aviern with us." rows set the
heading left and the link at the right margin. All 24 headings compute
`text-align: start`.

`type-scale-high-contrast`. `ladder.cjs`: largest prose text node 88px ("Unmanned
cargo airplanes.") over `body` 16px = **5.5:1**, above the 3.75 cut. The raw maximum
is the 150px figure "1,000" (9.4:1); then 77px "Aviern A1000", 72px "Q4 2027", 66px
contact heading, against 13-16px running text. One family, Archivo, at both ends.

`real-product-surface`. Present on the two Flying-today clips, with caveats stated so
a second rater can disagree. `flight/p1-tol` (7.9s, 10fps, 1280x720) is genuine
footage of a grey single-fin pusher UAV taking off from cracked tarmac, flying a
circuit and landing; the backgrounds carry incidental real-world detail (tower cranes,
parked cars, haze) that no render on this page has. `flight/on-station` (8.69s,
23.976fps) is real aerial chase footage of a white aircraft over desert. Alt texts:
"Our current aircraft taking off and landing on its own from an unprepared strip",
"Our current aircraft flying autonomously over open terrain"; section copy: "Our
current aircraft takes off, flies, and lands itself. It is the proving ground for the
autonomy stack that will fly the A1000." Precedent points one way: silica scored
absent because every surface was CG and no footage of real hardware existed;
the-subvocal-company scored present on a camera capture of a lab harness rather than
the shipping product. This is the subvocal case. Caveats: (1) the autonomy, which is
the claim, is invisible on camera; a remote-piloted aircraft would look identical.
(2) The captured airframe is the retrofit, not the A1000, which appears only as CGI
renders (every alt text begins "Rendered ... concept") and a CAD side view
(`div.aircraft-drawing`, `aria-label` "Aviern A1000 side view, from the CAD model").
(3) The two clips appear to show two different airframes (grey pusher vs white
high-wing) under copy that says "Our current aircraft", singular. The signal asks only
whether the surface is the real product in use, and the retrofit flying is the
autonomy product in use.

`density-variation`. The figures strip spends a 262px navy band on one number and
three words; the A1000 spec ledger packs six label/value pairs (13px labels, 26px
values, hairline rules) into 1328x255; the timeline, the 4-up team grid and the 3-cell
Flying-today ledger sit between bands that carry a single 66-88px line over an image.
Modest, but the page has more than one texture.

`one-accent-discipline`. Every chrome colour is in one hue family, oklch hue 244-249,
read as RGB chroma: the accent is sky blue `rgb(114,185,241)` (chroma 127) on the
active figure unit; the team initials `rgb(69,126,164)` (chroma 95) are the same hue
darker; the navy bands `rgb(7,47,81)` (chroma 74) are surface; ink `rgb(22,35,46)`;
every other chrome colour is chroma 38 or less. The orange robot arm in two renders is
image content, not chrome.

`shows-deliverable`, **present, revised after the blind pass** (the blind call was
absent; its reasoning is kept in the first bullet below so the change can be audited).
The entry that could have embarrassed the vendor: in the on-station clip (y4567,
x736), **a dark-crowned shrub beside the track left unmasked in 45 of the 49
segmentation-overlay frames while every canopy around it is masked green**, visible at
normal playback for most of 2s at about 37x50 CSS px. What moved the call is one
measurement, run after the old file raised the argument and checked independently:
the trees that drop out of the mask at frame 159 have the same tone as the persistent
shrub (revealed pixels mean RGB 72/68/59, luma 68; the shrub's dark pixels 66/65/54,
luma 64; bare soil luma 115), and the overlay masks those trees in 48 of 49 frames.
So the model does class this kind of tree as canopy, and the persistent shrub is a
miss, not an excluded class. That removes the blind pass's class-semantics objection.
Its other objection, that nothing labels the overlay as Aviern's, is a provenance
objection, and the vocabulary is explicit that provenance neither earns nor forfeits
this signal; by the page's own framing the clip is "Our current aircraft flying
autonomously" in a section about "the proving ground for the autonomy stack". Part A:
the content shows the product's perception missing an obstacle beside the strip, on a
page whose A1000 ledger claims "Takeoff and landing: Unprepared strips". Part B: a
captured artefact of the product's output, readable at page size. Frame 159's dropout
does NOT carry it: 41.7ms, invisible as a defect at playback. A second rater who holds
a 37x50px unflagged miss in ambient B-roll below legibility reads this absent, and the
verdict does not move either way.

**Near-misses.**

- `shows-deliverable`, blind-pass reasoning (absent), kept for audit. The on-station
  clip cuts hard at frame 126 (5.255s) into 49 frames (2.04s, out after frame 174,
  7.299s) of top-down footage of different terrain (dark soil, large canopies, a
  Y-shaped track; the shots either side are pale desert) carrying a segmentation
  overlay: green masks on canopy, orange on the track. Same span in the AV1 file Chrome
  plays (209 frames) and the H.264 fallback (206). Two defects, measured on decoded
  frames:
  - **Frame 159 (6.632s), a one-frame dropout.** Masks on about six trees in the
    lower-left vanish and return: 65,587 px are masked in frames 158 and 160 and not
    in 159, 12.7% of the mask area and 3.4% of the frame. In the page's 648x365 player
    that is a region about 170x100 CSS px for 41.7ms, once per 8.69s loop. **Not
    visible as a defect at normal playback**; at most a flicker if you are watching
    that corner.
  - **A persistent miss.** A dark-crowned shrub left of the track stays unmasked in 45
    of the 49 overlay frames (masked only in isolated single frames 130, 134, 162 and
    164) while every canopy around it is green. About 110x150 source px, roughly 37x50
    CSS px in the player, on screen for most of 2s. **Visible at normal playback** to
    anyone looking at it.

  Why the blind pass called it absent (superseded above). **Nothing ties the overlay to Aviern's software.** No label,
  legend, class name, UI chrome or caption: the figcaption is "On station"; the alt
  text describes flight, not perception; the section copy never mentions perception,
  segmentation or terrain; the served HTML contains none of
  segment/percept/vision/terrain/detect/obstacle/camera/sensor; the file metadata
  (`creation_time 2026-09-10`, Apple `Core Media Video` handler, libx264) carries no
  provenance. The footage is a different place from the clips either side of it. And
  even granting attribution, the overlay's classes are unstated, so the persistent
  shrub reads as a miss only if green means "all vegetation" rather than one canopy
  class; the only unambiguous error, frame 159, is invisible at playback. The
  procedure asks for an entry that could have embarrassed the vendor; this one can
  only embarrass a vendor who has claimed the overlay, in front of a viewer who decodes
  frames or assumes the class set. A rater who accepts the page's implicit framing
  ("our current aircraft", "proving ground for the autonomy stack") could reach present
  on the persistent shrub, never on frame 159. Nothing else qualifies: the timeline's
  "First flight Q4 2027" and "on a retrofitted aircraft in 2027" are candid but are
  marketing prose, failing Part B as the subvocal FAQ did; both spec ledgers ("1,000
  mi / 1,000 lb / $1,000", "5 hours / 500 mi / Autonomous") can only flatter; the
  takeoff clip lands cleanly.
- `typewriter-headline`, absent. The figures strip is the largest type on the page
  (150px "1,000") and it runs on a timer. On entering view the number resets from the
  server-rendered "1,000" to 0 and counts back up in ~1.2s (the walker froze it at
  "973", so a still misreports the page's central number). Then the emphasised unit
  cycles miles → pounds → dollars → all three, about 2.2s each, an 8.8s period,
  indefinitely (sampled 20s). Absent because no phrase is ever replaced or hidden:
  `textContent` is constant, all three units always render, only their colour changes,
  and the `aria-label` reads "1,000 miles. 1,000 pounds. 1,000 dollars." The device is
  a cousin of the rotating word; a rater who scores emphasis cycling as phrase cycling
  would flip this.
- `single-optical-anchor`, absent (honest call; rule-ineligible). The opening viewport
  is an 88px headline over a loop that cuts every ~2s between four CGI shots, one of
  them a robot arm with no aircraft in it, so no one mass holds the frame. Below the
  fold the 150px figure out-scales the headline 1.7x. Candidates counted: the hero
  aircraft, the 150px figure, the 1328x504 CAD drawing, the 72px "Q4 2027" panel. The
  CAD drawing is the "one mass because there is only one mass" case, but only within
  its own section. The poster frame alone (aircraft on runway under the headline)
  would read as one anchor.
- `generic-sans-default`, absent on face identity. Archivo 400/500/600 is the only
  family loaded; it is not the era default (Inter, Geist, system) and the corpus holds
  non-default grotesques absent (standard-machines, sentient-os). Weak on optical
  system: every heading is weight 400 at `letter-spacing: normal` up to 88px; the only
  tracking is -5.25px (-0.035em) on the 150px figure.
- `stock-photo-generic`, absent. Every image is the company's own CGI of its own
  marked airframe (N6951, "Aviern A1000 EXPERIMENTAL") or real flight footage. Two
  scrims are bolted on, the shape of trigger (b): hero `linear-gradient` 51% → 27% →
  10% → 46% dark, contact band 84% → 42% navy over a render. Own renders are not stock.
- `glass-card-overuse`, absent. The served CSS declares `backdrop-filter: blur(4px)`
  twice; zero elements render with one at 1440, at the top or with the nav in its
  scrolled `nav-solid` state.
- `badge-pill-spam`, absent: one pill above the fold, the YC badge image (123x44).
- `generic-line-icon-set`, absent: the only glyph is lucide `arrow-up-right` as a link
  affordance; there is no feature icon set.
- `indigo-violet-accent`, absent: the navy is HSV hue ≈208°, the accent ≈206°, both
  blue, nowhere near indigo.
- Not a signal, recorded: the team section is four 308px squares carrying initials
  ("KA", "AS", "OA", "HA") instead of photographs. `materials`: the CGI stills
  (`cargo-campus.webp`, `cargo-loading.webp`, the contact render) and the CAD drawing
  are filed under `illustration` for want of a render slot; no `prefers-color-scheme`
  rule in the CSS, so `single-theme`; no canvas, so no `webgl`.

**Verdict: mixed.** Net = 2 slop − 6 craft = **−4** (−3 in the blind pass, mixed
there too); page height 6947px over eight sections, so not a thin page flattered by
vacancy. −4 sits inside both the mixed range (−5..+3) and the exemplar range
(−8..−2). The only corpus file at −4 is github-2014, mixed, with the identical 2/6
profile; at −3, one exemplar (modal-com) against three mixed (cursor-com,
neuron-industries, tsenta). Not rounded up to exemplar: four of the six craft signals
are typographic and layout restraint; the two substantive ones both rest on the
same two unlabelled 8-second loops, one of them on a ~37x50px region of 2 seconds,
and the central claim (autonomy) cannot be seen in either; the flagship product
exists on the page only as CGI and a CAD drawing; and the schedule is blank to
anything that does not scroll.

**Drift from the 2026-10-13 study**

Opened only after the front-matter and the prose above were written. The old file
rated the hero viewport of a 9706px page and left the rest "walked but not read band
by band", so most changes below cannot be attributed purely to the redesign: the old
page's below-fold content is unknown. Verdict unchanged: `mixed` → `mixed`.

| signal | 2026-10-13 | now | cause |
|---|---|---|---|
| `three-card-row` | unresolved | present | old capture never read below the fold; the use-case row is on today's page; whether it existed then is unknowable |
| `generic-sans-default` | present | absent | **page changed.** The 2026-10-08 snapshot loads `Archivo:wght@500;600;700` **and** `Inter:wght@400;500;600`, so Inter body was a corpus-standard `present`; today only Archivo loads |
| `generic-line-icon-set` | unresolved | absent | old rating unread below the fold; now read |
| `testimonial-card-row` | unresolved | absent | same |
| `scroll-reveal-blank` | absent | present | **old value unsupported**: `absent` was given on a hero-only capture with no walk-vs-dwell run. The 9 gated milestones are on today's page; whether the 10-13 page gated anything is unknowable |
| `stock-photo-generic` | present | absent | **page changed.** The caption "Stock aviation reference · A1000 imagery forthcoming" and the stock still are gone; every image is now own CGI or own footage |
| `density-variation` | absent | present | old read only the hero; today's page has a ledger, a timeline and a single-figure band. Mostly page changed, partly old capture scope |
| `real-product-surface` | absent | present | page changed, **with a caveat about the ruling's premise** (below). Basis differs from the reverted 10-16 re-pass: that one rested on the overlay as a software surface; this rests on the genuine flight footage |
| `shows-deliverable` | absent | present | same entry as the reverted 10-16 re-pass (the persistent shrub), reached independently after a blind `absent`; the re-pass's frame-159 argument was checked by tone measurement and holds. Page changed or old capture missed it: see below |
| `context` | [hero, nav] | + features, stats, team, cta, footer | old capture scope |
| `materials` | single-theme, stock-photo | single-theme, video-hero, video-embed, illustration | page changed (stock gone, CGI hero video); `video-embed` possibly old capture scope |

Unchanged values with a changed basis. `type-scale-high-contrast` stays present, but
the old basis ("roughly 56px against 16px body", 3.5:1) is **below today's 3.75
cut**, so on the old prose the old value would not survive the v4 procedure; today's
88/16 = 5.5:1 clears it. `single-optical-anchor` stays absent for a different reason
(then a broken hero image, now a cutting 4-shot loop). `asymmetric-split` and
`one-accent-discipline` stay present on new evidence. The broken-image defect the old
file recorded is gone; hero video and poster load.

**The orchestrator ruling's archive premise does not hold as stated.** The ruling
reverted the 10-16 flips partly because "the only nearby archive snapshot,
`20261008155414`, has no `<video>` element and no `.mp4`". Re-fetched today
(`https://web.archive.org/web/20261008155414/https://aviern.com/`, 35,354 bytes), its
raw HTML carries three `<video>` figures: two captioned "On station over the line."
(`/hero-1080.mp4` + `.av1.mp4`, `aria-label` "The aircraft on station over a pipeline
right-of-way") and one "Autonomous take-off and landing." (`/p1-tol.mp4` + `.av1.mp4`,
"The aircraft taking off unassisted from an unprepared strip"). That snapshot is an
earlier pipeline-inspection version of the site (deliverable panels "Encroachments",
"Leaks", "Subsidence and clearance", `deliver-row/leak/lidar/rgb.webp`), not the 10-13
cargo page. So flight footage, including an "On station" clip, was on aviern.com five
days before the study, and today's `on-station` file carries `creation_time
2026-09-10`. Whether the 10-13 cargo page carried it below its unread fold cannot be
settled: the archived `hero-1080.mp4` was never captured (the Wayback fetch returns
its not-archived page) and the live server now 404s it. The ruling's conclusion, that
the 10-13 file should describe only what its capture showed, still stands; its
evidence that the clips did not exist then does not. Circumstantially, an
"On station over the line" clip on a page selling vegetation and encroachment
detection is the likeliest origin of today's segmentation overlay, which would tie the
overlay to Aviern's own earlier inspection product. Not verified, and not used for any
value above.

**Superseded study (2026-10-13, verdict `mixed`).** Everything below describes the page as it was before the redesign that forced the re-study above, and is kept as the record of that page. Its signal values, which the front-matter no longer carries:

```
gradient-blob: absent
three-card-row: unresolved
glass-card-overuse: absent
emoji-as-icon: absent
generic-sans-default: present
symmetric-everything: absent
badge-pill-spam: absent
generic-line-icon-set: unresolved
testimonial-card-row: unresolved
indigo-violet-accent: absent
gradient-fill-cta: absent
scroll-reveal-blank: absent
typewriter-headline: absent
stock-photo-generic: present
centered-hero-stack: absent
hero-mockup-float: absent
asymmetric-split: present
single-optical-anchor: absent
type-scale-high-contrast: present
editorial-grid-break: absent
custom-type-pairing: absent
real-product-surface: absent
shows-deliverable: absent
density-variation: absent
one-accent-discipline: present
live-claim-control: absent
```

**The first page in the corpus to fire `stock-photo-generic`, and it
declares itself.** Bottom-right of the hero, in grey at roughly 11px:
"Stock aviation reference · A1000 imagery forthcoming". The company builds
unmanned cargo aircraft and has no photograph of its own aircraft, so the
hero is licensed aviation stock standing in for a product that does not
photograph yet.

That is the honest version of the pattern the signal names, and it is why
the signal survived 25 files at zero without being wrong: the corpus had
sampled exemplars who commissioned their imagery and controls who shot
their own customers. A pre-product company reaching for interchangeable
stock is the actual population, and this is one.

The capture also records a defect: the hero image fails to load, leaving a
broken-image glyph at top left and a grey vertical gradient where the
photograph should be. White type sits over it at roughly 56px against 16px
body, left-aligned, two underlined text CTAs and no solid button, so there
is no optical anchor. One hue (white on grey) is held throughout.

Below-fold signals are unresolved: 9706px of document that the viewport
capture does not reach, walked but not read band by band.

**v4 change 3b surface re-pass**

Re-rated 2026-10-16 from the live page against the widened
`real-product-surface` wording and the settled `shows-deliverable` axis.
Values decided before this prose: `real-product-surface: present` (flipped
from absent), `shows-deliverable: present` (flipped from absent). Both rest
on the same 2 seconds of one video, so a rater who discounts that clip
should read both back to absent together.

*Capture.* `shoot-tiles.cjs`: 10 tiles, scroller `window`, `clamped: false`,
`coverage: 1`, `docH_before` 6947 = `docH_after` 6947, walkHeight 6947.
Stitched to 2 strips (1440x4400, 1440x2547), 6947px against 6947px page.
The last strip ends in the footer: logo, nav, `hello@aviern.com`, `© 2026
Aviern`, `Privacy` (DOM y6811 to y6905). Two pixel defects, both read off
the DOM instead: the hero counter was caught mid-tick as "973" (DOM:
`1,000`), and a tile seam near y5050 clips the "Flying today" stat label
row (DOM: `Endurance` / `Range` / `Takeoff to landing`). All four page
videos, plus the AV1 variant the browser actually plays, were downloaded
and stepped with ffmpeg; all are `autoplay loop muted`, no controls.

*Candidate surfaces, top to bottom.*
- y0, 1440x900, raster video `renders/airport-sequence.av1.mp4`, alt
  "Rendered A1000 concept: robotic cargo loading, taxi out, runway entry,
  and takeoff". CGI of an aircraft that has not flown. Not a capture, not
  software.
- y1405, 1328x504, `div.aircraft-drawing` with CSS `mask-image:
  url(/a1000/side.svg)`, aria-label "Aviern A1000 side view, from the CAD
  model". Line drawing of hardware. Not software.
- y3376, three 421x527 tiles: `cargo-campus.webp`, `forest-takeoff.mp4`,
  `cargo-loading.webp`, every alt beginning "Rendered". Renders.
- y4567 x56, 648x365, video `flight/p1-tol.av1.mp4` (7.9s), alt "Our
  current aircraft taking off and landing on its own from an unprepared
  strip". Genuine ground-camera footage of the current (non-A1000) aircraft
  on a real airfield. Hardware; no screen or overlay in any frame.
- y4567 x736, 648x365, video `flight/on-station.av1.mp4` (8.688s, 209
  frames at 23.976fps), alt "Our current aircraft flying autonomously over
  open terrain", caption `On station`. Frames 126 to 174 (5.26s to 7.26s,
  49 frames) cut to a nadir camera view with a semantic segmentation
  overlay: green masks on shrubs, orange masks on dirt tracks. The only
  software-produced surface on the page.
- y6101, 1440x660, `renders/runway.webp`, alt "Rendered A1000 concept
  holding on a runway". Render.

*Is the overlay genuine, and whose?* Genuine model output, on internal
evidence: the masks flicker frame to frame the way per-frame inference
does and a designed graphic does not. Green coverage of the frame swings
0.238 to 0.299 across the 49 overlay frames, and at frame 159 (t≈6.63s) a
cluster of about six dark shrubs masked in frames 157, 158, 160 and 161
drops out of the mask for one frame and returns. Identical in the H.264
and AV1 encodings. Attribution is by context, not label: it sits under
"Flying today." and "Our current aircraft takes off, flies, and lands
itself. It is the proving ground for the autonomy stack that will fly the
A1000.", in a clip whose alt claims the aircraft as theirs. External
corroboration is weak and not verified live: a search-engine snippet of an
earlier aviern.com ("Autonomous pipeline & infrastructure inspection")
described "onboard perception that flags leaks, encroachments, and
vegetation risk", which is what these masks classify. The live page and
the YC listing are both cargo now. No public app, docs or demo exist to
check faithfulness against.

**Q1 `real-product-surface`: present, flipped from absent.** The old value
was right under the old format-keyed name and the hardware rule: renders,
a CAD drawing and flight footage are not a software surface. The widened
signal credits a genuine capture of the real product, and the hardware
clause asks for any software surface before calling absence a category
fact. There is one: 2 seconds of the autonomy stack's perception output
captured over real terrain, carrying the inference artefacts a stylised or
invented overlay would not. Caveats, stated so a second rater can
disagree: it is an unlabelled engineering visualisation with no legend and
no operator chrome, it is 2s of an 8.7s loop in a 648px tile, and
authorship rests on page context. Everything else the page shows of the
A1000 is concept render.

**The entry that could have embarrassed the vendor.** In the on-station
clip (y4567, x736), across the 5.26s to 7.26s overlay span: a dark shrub at
the top of the left-hand vegetation cluster stays unmasked in every sampled
overlay frame where it is in view, while the lighter shrubs touching it
are masked green. That it is a miss rather than an excluded class is shown
by frame 159, where shrubs of the same dark texture, masked by the model
in the neighbouring frames, lose their masks for one frame. The product's
own perception output, shown missing and dropping the vegetation it is
meant to classify.

Searched and rejected: the counter `1,000` `miles.` `pounds.` `dollars.`
(y956) and the A1000 spec grid (y1975 to y2135: `1,000 mi`, `1,000 lb`,
`$1,000`, `None — autonomous`, `Unprepared strips`, `Automated`) are
design targets for an unbuilt aircraft with no "planned" or "target"
qualifier, every value a win. `First flight` `Q4 2027` with "Autonomous
flight and customer demonstrations come first, on a retrofitted aircraft
in 2027." (y2307) admits the A1000 has not flown, but the page repeats the
date as its milestone three times (card y2336, timeline y2850, og
description "The Aviern A1000 unmanned cargo aircraft. First flight Q4
2027.") and it is roadmap prose, not output, so it fails both the
selling-point test and Part B. The "Flying today" stats (y5081: `5 hours`,
`500 mi`, `Autonomous`) are a different aircraft's figures and each can
only flatter. The p1-tol clip shows a clean takeoff and landing.

**Q2 `shows-deliverable`: present, flipped from absent.** Part B: a
captured artefact of the product's output, readable as an image at page
size. Part A: its content carries the product erring, unframed by the page
and not hidden. Same class as `silica`'s `2.0 g` against `1.5 g` and
`the-subvocal-company`'s on-camera misdecode, at lower legibility: the
persistent miss is visible at playback for about 2s at roughly 35px in the
tile; the one-frame dropout lasts 42ms and is only certain frame-stepped.
If a second rater holds the miss below legibility, this reads absent and
the spec grid confirms it.

*Drift from the earlier prose.* Most of it no longer matches the live
page. The hero is no longer licensed stock: it is the CGI video above, and
the caption "Stock aviation reference · A1000 imagery forthcoming" is gone
(zero matches in rendered DOM text; renders are named as such only in alt
text). The broken-image glyph and grey gradient are gone; video and poster
load. Headline is 88px against a 19px subhead, not ~56px against 16px.
Document height is 6947px, not 9706px, and the below-fold content is now a
CAD drawing, spec grid, timeline, use-case renders, flight footage, team
and contact. A "Backed by Y Combinator" badge sits at y388. Still true:
left-aligned white headline, two underlined text CTAs ("Meet the A1000",
"Talk to Aviern") and no solid button. The `stock-photo-generic: present`
value and the `stock-photo` material rest on the vanished caption and need
their own re-check; not changed here, outside this pass.

**Orchestrator ruling on the re-pass above — both values restored to `absent`,
and the section above kept as a dated drift record.** Same rule as
`decent-com`: a re-pass re-interprets the page as studied, and a redesign
triggers a full re-study rather than a flip.

Both flips rest on one 2-second segmentation overlay in the on-station clip,
and that clip is new since this page was studied. The evidence:
- This file's 2026-10-13 prose never mentions a video, footage, segmentation
  or a "Flying today" section.
- It does record a caption reading "Stock aviation reference · A1000 imagery
  forthcoming" — the studied page saying it had no real footage yet.
- The only nearby archive snapshot, `20261008155414`, has no `<video>` element
  and no `.mp4`.
- The page has since gone from 9706px to 6947px, and its hero is now a CGI
  video.

So the overlay belongs to the redesign. The studied page had neither a product
surface nor a deliverable, and both values revert to what it showed.

**Queued: a full re-study of aviern.** The re-pass above is the first look at
the redesign, and it found the strongest candidate on this page so far: a real
perception overlay that visibly misses a shrub. If that holds up, a re-study
should take both signals to `present`. `stock-photo-generic` and the
`stock-photo` material, which rested on the vanished caption, belong to that
same re-study.

**Correction to the orchestrator ruling in the superseded study above.** That
ruling reverted both 3b flips on the premise that the Wayback snapshot
`20261008155414` "has no `<video>` element and no `.mp4`". **That evidence was
invalid.** It came from grepping the snapshot's raw HTML, and the page is
client-rendered (Next.js): the same raw HTML also lacks every visible string on
the page, `1,000` and `A1000` included, so absence there proves nothing. The
2026-10-16 re-study rendered the snapshot and found three videos on an earlier
pipeline-inspection version of the site ("On station over the line.",
"Autonomous take-off and landing."). So flight footage was on aviern.com five
days before the study. What the 2026-10-13 page itself carried below the fold
is unknown: that study's capture never read below the fold. No value rests on
the withdrawn evidence. The re-study above rates the live page from its own
capture, and the rule the ruling applied (a redesign triggers a re-study, not a
flip) stands on its own.

**Note on `shows-deliverable`:** the re-study's blind call was `absent`. It
moved to `present` after opening the old file, on its own measurement rather
than the old file's assertion: the dropped trees average luma 68 and the missed
shrub 64, against bare soil at 115, and the model masks those trees in 48 of 49
frames, so the shrub is a genuine miss. That shrub stays unmasked in 45 of 49
frames at about 37x50 CSS px, visible at normal playback. Both the blind and
the final reasoning are in the draft above. Reverting to the blind value moves
net from −4 to −3; the verdict stays `mixed`.
