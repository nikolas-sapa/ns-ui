---
source: https://dipolelabs.com/
kind: site
cohort: yc-current
verdict: mixed
studied: 2026-10-14
context: [nav, hero, footer]
signals:
  gradient-blob: absent
  three-card-row: absent
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: absent
  symmetric-everything: absent
  badge-pill-spam: absent
  generic-line-icon-set: absent
  testimonial-card-row: absent
  indigo-violet-accent: absent
  gradient-fill-cta: absent
  scroll-reveal-blank: absent
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: absent
  hero-mockup-float: absent
  asymmetric-split: present
  single-optical-anchor: present
  type-scale-high-contrast: present
  editorial-grid-break: absent
  custom-type-pairing: present
  real-product-screenshot: absent
  artifact-not-dashboard: absent
  density-variation: absent
  one-accent-discipline: present
  live-claim-control: absent
materials: [single-theme]
---
Captured at 1440x900; full page 1528px, the shortest in this batch by a factor
of eight. Three tiles at 700px steps, but scroll clamps at 628px so tiles 1 and
2 are the same frame: the stitched strip runs 2300px against a 1528px document,
and the nav band and the About section each appear twice in it. Those repeats are
the walk re-capturing the clamped bottom, not two About sections. The page is
nav, hero, one About band, footer. Twenty-one text nodes, 840 characters, and
every signal reading below has to be understood against that number.

**Zero of the sixteen slop signals are present, and the interesting question is
what fraction of that is restraint.** The partition is measurable, so here it is.

Three of the sixteen are absent because the page has no section that could carry
them: `three-card-row` (no feature grid; `rows` is empty and `border-radius` is
`0px` with `box-shadow: none` on every element on the page, so there are no card
surfaces at all), `testimonial-card-row` (no social-proof section exists), and
`generic-line-icon-set` (`svgCount` is 0; the page ships no icon set, so there is
nothing to be uniform). Those are honest `absent` values under the brief's rule
and they are absent by vacancy.

The other thirteen were structurally available to a nav-hero-about-footer page
and were declined:

- `gradient-blob`: all four bands are flat solid fills. The 1528px body is
  `rgb(250, 250, 247)`, the About section is `rgb(240, 245, 241)` at 1440x487
  from y900, the footer returns to `rgb(250, 250, 247)`. `bigGrad` and
  `gradText` are both empty.
- `centered-hero-stack`: the headline sets at `x=112` with `text-align: start`.
  Zero of 21 text nodes are centre-aligned as layout. Three report
  `text-align: center` and all three are button labels centring inside
  left-anchored chips at x=112, x=293 and x=539.
- `badge-pill-spam`: `pills` is empty and `border-radius` is `0px` on all three
  controls. "backed by Y Combinator" is set as 18px running prose inside the
  About paragraph rather than as a pill above the fold, which in this cohort is
  the less common of the two choices.
- `gradient-fill-cta`: the one filled button, GET IN TOUCH at 165x50, measures
  `background-color: rgb(31, 77, 58)`, `background-image: none`,
  `border-radius: 0px`, `box-shadow: none`. The other two controls are
  transparent with a 1px border and the same square corners.
- `indigo-violet-accent`: hue buckets covering 210-300 degrees read 0.00%. The
  single ink hue is 155 degrees.
- `scroll-reveal-blank`: `hiddenText` is 0 at rest and 0 after the scroll walk,
  `docH` is 1528 both times, `innerTextLen` is 840 both times, and `rowsAfter`
  is empty. Nothing mounts and nothing un-fades. This is the most common signal
  in the yc-current cohort and it does not fire here.
- `typewriter-headline`: `setInterval` count 0, `heroTextStable` true.
- `glass-card-overuse`: one `backdrop-filter` surface against a threshold of
  three, and it is the fixed nav at `blur(12px)` over
  `oklab(0.984266 -0.00107622 0.00381178 / 0.85)`.
- `stock-photo-generic` and `hero-mockup-float`: three images on the page and all
  three are the logo (171x36 at y22, a 147x112 data-URI mark at y217, 133x28 at
  y1444). No raster photography, no video, no canvas, and `transformed` is empty.
- `symmetric-everything`: the About band splits 363px against 789px, 32/68.
- `generic-sans-default` and `emoji-as-icon`: below.

So thirteen declined, three vacant. The restraint is real within the scope the
page sets itself.

**The type is the page's one piece of genuine work, and the ladder settles both
font signals against the declared `font-family`.** Two faces ship, Manrope and
IBM Plex Sans, with `Manrope, system-ui, sans-serif` declared on body at 16px.
What renders is a clean two-role division that the declaration does not describe:

| size | family | nodes | tracking | case |
|---|---|---|---|---|
| 72px | IBM Plex Sans | 2 | -1.44px | none |
| 36px | IBM Plex Sans | 1 | -0.72px | none |
| 20px | Manrope | 1 | normal | none |
| 18px | Manrope | 2 | normal | none |
| 14px | IBM Plex Sans | 14 | +1.12px | uppercase |
| 12px | IBM Plex Sans | 1 | +2.88px | uppercase |

Twenty-one of twenty-one nodes obey it with zero crossings. IBM Plex Sans carries
display and every label; Manrope carries every line of running prose and nothing
else. The dividing line is prose against label, not size, which is why the
declared body font looks like it contradicts the ladder and does not: Manrope is
genuinely the prose face, it just has three nodes to its name on an 840-character
page. `custom-type-pairing` is present on that division, and it is enforced by
more than family: the Plex nodes at 14px and below all run positive tracking and
uppercase, the Manrope nodes run normal tracking and sentence case, so the two
voices separate at a glance even where the letterforms are close.

`generic-sans-default` is absent. The `system-ui` fallback never resolves because
Manrope loads as a declared face, and neither shipped family is the neo-grotesque
default that this signal names. The hero is set in IBM Plex Sans at 72px with
`letter-spacing: -1.44px` and the two lines of one sentence weighted 600 then
300: "Scaling intelligence" semibold, "with light." light, both
`rgb(31, 77, 58)`, both at `x=112, w=1008`. A weight break mid-sentence at
display size is a decision, not a default.

`type-scale-high-contrast` is present at 4.5:1, 72px display against the 16px
declared body. Against the prose that actually sets, 72/18 is 4.0:1, and against
the hero subhead 72/20 is 3.6:1. The ladder is 72 / 36 / 20 / 18 / 14 / 12 with a
clean 2:1 at the top step and nothing between 36 and 20. Calibration: linear-app
reads present at 4.5:1, sona8, truemile and squarespace-2014 at 4:1, railway-com
absent at 3.4:1. At 4.5:1 against declared body this sits with the present group
on either denominator.

**`one-accent-discipline` is present on one hue, and the saturation figure needs
correcting.** The probe reports `satPct` 98.7% with 96.26% of it in a single hue
bucket, which reads like a full-bleed coloured field. It is not. That 96.26% is
the paper: `rgb(250, 250, 247)`, which computes to hue 60 degrees at 0.6% HSL
saturation, an off-white with a trace warm cast. The 2.3% in the next populated
bucket is the ink, `rgb(31, 77, 58)` at hue 155 degrees, carrying the logo, all
display type, the 12px eyebrow, the active nav item and the single filled button.
Secondary text is `rgb(74, 87, 85)` and `rgb(15, 27, 22)`, both near-neutral in
the same green family. One accent, no second. The pixel sample is first-viewport
only, which is why the About band's `rgb(240, 245, 241)` registers 0.12%: that
band starts at y900, exactly the sample's bottom edge.

`asymmetric-split` is present on the About band: a 363px heading column at x=112
against a 789px prose column at x=539, a 32/68 ratio, with the heading column
running empty from y1121 to the section's end at y1387, roughly 266px of
deliberate vacancy under a two-line head. The hero is asymmetric by the same
logic, a left-anchored block in a 1440 frame with the right half carrying no
glyphs. `single-optical-anchor` is present in both sections: in the hero the 72px
headline is the only element above 20px, a 3.6x drop to the next size, and the
logo mark above it is the same hue in the same column, reading as a lockup rather
than competition; in the About band the 36px head is the only element above 18px.

**Where the page fails, and it is the half that decides the verdict: five of ten
craft signals are absent, and three of those five are the ones that test whether
a page can substantiate anything.** `real-product-screenshot` is absent because
zero product imagery exists: `svgCount` 0, `canv` empty, `vids` empty, three
images all logo. `artifact-not-dashboard` is absent for the same reason and not
by the mutual-exclusion convention: the page shows neither its UI nor its
deliverable. A photonics company claiming to "move past the physical limits of
silicon" ships no die shot, no switching matrix, no insertion-loss curve, no
latency figure, no port count. `live-claim-control` is absent on three controls,
all navigation (GET IN TOUCH, SEE OPEN ROLES, MORE ABOUT US); nothing lets a
visitor falsify the central claim. `editorial-grid-break` is absent on a single
1216px column at x=112 with symmetric 112px margins and nothing living outside
it; the About band is full-bleed in background colour only, with its content
staying inside the column, and a full-bleed background is not a grid break.

`density-variation` is the closest call and lands absent. The bands do measure
different: hero y81-900 carries 4 nodes at roughly 0.26 characters per vertical
pixel, the About band y900-1387 carries 5 nodes at roughly 0.91, the footer
y1387-1528 carries 7 nodes at roughly 0.39. That is a 3.5x swing, and the About
prose is genuinely dense, 18px justified across a 789px measure. But the swing is
produced by having two content sections, one of which is a headline and one of
which is paragraphs. Every page with a hero and a paragraph produces it. The
signal names a page that compresses or opens against its own established rhythm,
and two sections cannot establish a rhythm to play against.

**Verdict: `mixed` at net -5, and the reasoning is the point of the file.** Net
-5 sits inside both published ranges, at the floor of `mixed` (-5 to +4) and
inside `exemplar` (-7 to -2), so the verdict has to be argued rather than
computed. The argument against `exemplar`: all five craft signals present
(`asymmetric-split`, `single-optical-anchor`, `type-scale-high-contrast`,
`custom-type-pairing`, `one-accent-discipline`) are satisfiable by a page
containing nothing but type on a flat field, and this page contains nothing but
type on a flat field. All five craft signals requiring content beyond type are
absent. `exemplar` in this corpus means a page doing a hard job without error:
vercel-com earns -7 across a full-length page with many sections each of which
could have gone wrong. This page does an easy job without error. It is a
well-set nameplate, and a second rater who wants `exemplar` has to argue that a
nameplate executed cleanly is a model to copy, which is a checkable claim and the
right place for the disagreement to sit.

Equally, the zero slop count must not be read as this page out-performing the
cohort. Thirteen of sixteen slop signals were declined by decision and that is
creditable, but the page had 840 characters and two sections in which to decline
them. The flattering net score is partly an artifact of surface area.

**Two vocabulary gaps, both exposed by the page length.**

First, no signal distinguishes restraint from absence of surface area. The
13-declined / 3-vacant partition above is the honest reading and it is entirely
in prose: a rater reading only the front matter sees sixteen `absent` values and
net -5 and cannot tell this page from a full-length page that declined the same
sixteen under real pressure. The partition is also rater-authored, not
vocabulary-derived, so two raters could draw it differently and both be inside
the rules. A page-extent or surface-area field in `materials` would carry the
fact without becoming stance-bearing.

Second, `real-product-screenshot` and `artifact-not-dashboard` both `absent`
cannot distinguish "offered no evidence" from "offered evidence badly". A page
that floats a gradient-washed fake dashboard scores the same pair of `absent`
values as this page, which shows nothing at all. On a hardware company making a
physics claim, "shows nothing" is the whole criticism, and the vocabulary has no
slot for it. This is the same hole railway-com recorded from the other side, a
device that proves the claim without being either a UI screenshot or a scored
artifact.
