---
source: https://sentient-os.ai
kind: site
cohort: yc-current
verdict: mixed
studied: 2026-10-14
context: [hero, nav, testimonials, features, cta, footer, security, faq]
signals:
  gradient-blob: absent
  three-card-row: absent
  glass-card-overuse: present
  emoji-as-icon: absent
  generic-sans-default: absent
  symmetric-everything: absent
  badge-pill-spam: absent
  generic-line-icon-set: absent
  testimonial-card-row: absent
  indigo-violet-accent: present
  gradient-fill-cta: absent
  scroll-reveal-blank: present
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: absent
  hero-mockup-float: present
  asymmetric-split: present
  single-optical-anchor: present
  type-scale-high-contrast: absent
  editorial-grid-break: present
  custom-type-pairing: present
  real-product-screenshot: present
  artifact-not-dashboard: absent
  density-variation: present
  one-accent-discipline: absent
  live-claim-control: absent
materials: [single-theme, webgl, video-hero, illustration]
---
On-device personal AI, YC F26. Captured at 1440x900; full page 14803px, walked in
700px steps as 22 tiles stitched to four strips. The page is dark-native on
`rgb(0, 0, 0)` with 0 `prefers-color-scheme` rules.

**The capture itself is the first finding, and it is a new failure mode.** The first
pass died on a Playwright screenshot-stability timeout after six tiles and reported
a ~4200px page. The real height is 14803px — a 3.5x undercount, returned silently,
with no error and a plausible-looking tile set. The page only captures with
`animations: 'disabled'`: eight non-zero canvases, seven of them WebGL2
(893x893@y261, 753x523@y895, 1425x900@y2528, 662x388@y8182, 662x388@y9120,
1425x900@y11698, 1425x576@y13967), animate continuously enough that no frame ever
settles. Anything that walks this page without disabling animation gets a truncated
page and no indication it was truncated. The rule that caught it: the last tile was
not a footer.

A second artifact worth naming for the next reader: the nav is `position: fixed`,
1425x75, so it reprints at every tile boundary in the stitched strips. The five
"Sentient OS / Privacy at the Core / Download for macOS" bars visible down strip0
are one fixed element photographed five times, not five navs.

## Slop signals present (4)

**`glass-card-overuse` — 8 surfaces carrying `backdrop-filter`, threshold 3.** The
nav pill (394x58, `blur(12px)`, 5% white fill); the hero demo panel (809x752 at
y=765, `blur(8px)`, `rgba(30, 30, 30, 0.6)`); and six source chips in the vortex
band at y2929-3036 — Notes 43x24, Messages 41x29, Emails 36x31, Calendar 52x31,
Screenshots 47x32, Files 31x20 — each `blur(24px)` over
`lab(3.97 0.25 -3.49 / 0.75)`. Worth stating plainly because the count is carried
by small elements: six of the eight are 20-52px app chips rather than content cards,
and the signal's name says card. The threshold as decided counts translucent-blur
surfaces, and there are eight.

**`indigo-violet-accent` — the hue arrives twice, once alone.** The seven-stop conic
halo behind every primary CTA passes through `rgb(155, 72, 212)` and
`rgb(108, 92, 229)`. More to the point, the Double Tap key cap at y=7713 sets the
word "command" in
`linear-gradient(in oklab, rgb(187, 101, 255) 0%, rgb(115, 115, 255) 100%)`, clipped
to text — purple to indigo, standing on its own with no rainbow around it. That is
the archetypal palette in an isolated fill, so the signal is present on its own
terms and not only as two stops of a spectrum sweep.

**`scroll-reveal-blank` — 31 text nodes cross, 9 of them on a timer, so 22 net are
scroll-gated.** At rest, excluding nav, menu, dialog, header and footer subtrees,
253 eligible text elements render, 71 of them (4985 characters) under 8% effective
opacity. Walked at 1440x900 in 600px steps with a 900ms settle, 31 nodes carrying
690 characters cross from under 8% to visible; 40 stay under 8% both before and
after (design fade, not a reveal); 0 nodes mount that were absent at rest. The
crossings are structural section content: the eyebrow `01 · Sidekick`, the heading
`"Finish this for me"`, the body line `Sidekick uses your computer like you do`, and
the source-chip labels `Messages` / `Calendar` / `Screenshots`. A control dwelling
the same 26 steps at the same 900ms settle with `scrollTo(0, 0)` every step crosses
9 nodes carrying 242 characters, and every one of them belongs to the single
animated proactive-suggestion card (`OVERDUE · 3 DAYS · GMAIL`, `You ghosted Carl.`,
`Carl asked to meet Wednesday at 1 about the even`). So the gate on the section
headings is the scroll; the gate on that one card is elapsed time, and it is
correctly discounted. `hiddenText` falls 76 to 48 across the walk, the same
direction.

**`hero-mockup-float` — an 809x752 panel at y=765 occluding the 867x867 hero
sphere.** The panel measures `box-shadow: none` and `transform: none`, so there is no
drop shadow and no tilt; the lift is done instead by a 1px border at 10% white, a
17.45px radius and `backdrop-filter: blur(8px)` applied over the sphere behind it.
It starts 520px below the headline baseline and is cropped by the viewport's bottom
edge at 900px. Recorded as a fact rather than a verdict driver, per the vocabulary's
note that this signal fires on exemplars and slop alike.

## Craft signals present (6)

**`asymmetric-split` — the hero is 341px off the frame's centre axis.** The headline
"Hand off the work / you're already doing." sets at 55.4px Cabinet, x=58, w=641,
`text-align: start`, against an 867x867 sphere at x=545. Counting every
h1/h2/h3/p over 12 characters, 14 blocks centre within 24px of x=720 and 118 do not;
the off-axis offsets cluster at -341, -342, -464, -555, -575. The figure repeats at
y5928, where a 396px block ("Sentient's on-device / model reads your / local
sources.") sits at the left edge and a 527px block ("Your knowledge comes /
together overnight, ready to / help with the day ahead.") sits at x≈797, with the
sphere between them and nothing balancing either.

**`single-optical-anchor` — one object holding 58% of the opening viewport.** The
867x867 sphere-ring at x=545, y=274 covers 751,689 of the frame's 1,296,000 px².
Nothing else above the fold exceeds 200px in both dimensions except the 641px text
column, and only the top 135px of the demo panel is in frame. Each band below
repeats the pattern with a single object: a 1425x900 wireframe vortex at y2528, one
point-cloud sphere, one 1252px knowledge window, one 662px capture per feature
section.

**`editorial-grid-break` — the security section has no column, no row and no
alignment.** Three principle cards measure 466x289 at x=745 y=11287, 526x244 at
x=968 y=11355, and 513x205 at x=899 y=11542: three widths spanning 60px, three x
origins spanning 223px, three y origins spanning 255px, overlapping each other, all
18px radius with a 1px transparent border. The middle card ends at x=1494, 54px past
the 1440 frame. Behind them a chip render (`Security-module__chip`, 1067x694) starts
at x=-51. The heading block that governs the section sits at x=86, w=583, and none
of the three cards aligns to it. Across the whole page, text left edges land at
x=58, 86, 94, 118, 128, 399, 726, 750, 797, 822, 826, 968, 1067 and 1147 — there is
no content column to break out of, which is itself the composition.

**`custom-type-pairing` — two voices, split cleanly at 26px.** Cabinet carries every
display line and nothing else: 65px ("Personal AI. / Privacy at its core."), 60px
("Before you / make it yours."), 55.4px (hero), 48px (x11), 36px (x8), 28px, 26px
(x3). Satoshi carries body and chrome and nothing above 27px: 22.3px hero subhead,
21px, 18px (x28), 16px (x42), 15px (x17), 14px (x68), 11px (x31), plus the 27px
wordmark and 14px nav. Hero tracking is `-2.4948px` on Cabinet at 55.4px (-4.5% of
em) against `-0.31248px` on Satoshi at 22.3px (-1.4%), so the two faces are not
merely different families but set to different rules.

**`real-product-screenshot` — three screen recordings and a navigable document
pane.** `homescreendemo-1.mp4` (753x523@y895) shows a real Gmail thread — "Need the
proposal + meet", sender "Jesai Tarun", "14:18 (52 minutes ago)", the real
`mail.google.com/mail/u/1/#inbox/FMfcgzQhWnphHmFwPdQJSgzvZclFKJvg` URL — with the
agent's cursor moving in it. `job-application-demo.mp4` (662x388@y8182) fills a real
Software Engineer application form behind a Pied Piper page. `email-db1.mp4`
(662x388@y9120) drafts in a Gmail compose box. All three are `autoplay: false`,
`controls: false`, `muted: true`, `paused: true` at rest, behind explicit "Play
demo" / "Pause demo" buttons — the page does not loop video at you. The knowledge
pane at y6397-7100 is a three-column window (file tree / document / connected notes)
with twelve navigable file buttons (`README.md`, `Apple silicon.md`, `Mac setup.md`,
`Interface taste.md`, `writingstyle.md`, `Preferences`) and four real paragraphs of
prose in the centre column, footed "3 example files · Plain Markdown" and "Personal
details omitted".

**`density-variation` — a 100:1 range between bands, measured in characters.** Text
characters per 1000px band: y0-999 24642, y1000-1999 1471, y2000-2999 109,
y3000-3999 30, y4000-4999 0, y5000-5999 36, y6000-6999 1709, y7000-7999 605,
y8000-8999 303, y9000-9999 273, y10000-10999 1521, y11000-11999 620, y12000-12999
291, y13000-13999 4212, y14000-14999 273. Four consecutive bands from y2000 to
y5999 carry 109, 30, 0 and 36 characters — a 3900px stretch averaging 44 characters
per 1000px, which is the vortex and the sphere running almost wordless — against
4212 at the FAQ and 1709 at the knowledge pane.

## Near-misses: values that could have gone the other way

**`gradient-fill-cta` absent, and this is the closest call on the page.** Every
primary CTA renders a full-spectrum rainbow, and it is not the button. The button
measures `background-color: rgb(255, 255, 255)`, `background-image: none`. The
rainbow lives on a sibling `span.Btn-module__haloGlow`, 232x80 against the button's
200x48, offset 16px on every side, at `filter: blur(24px)` and `opacity: 0.8`,
carrying `conic-gradient(from 44.5775deg, rgb(253, 226, 163), rgb(255, 142, 60),
rgb(255, 70, 70), rgb(232, 56, 143), rgb(155, 72, 212), rgb(108, 92, 229),
rgb(74, 144, 226), rgb(253, 226, 163))`. Three instances: nav y=6, hero y=514,
footer y=14557. The signal names a gradient on the fill, the fill is flat white, so
the value is absent — but a second rater reading the strips will see a rainbow around
the CTA and should know the measurement that settled it. The same seven-stop ramp
appears as a `linear-gradient(96.18deg, …)` halo behind each of the three
section-tab graphics at y7663, y7668 and y7621.

**`gradient-blob` absent on zero chromatic CSS gradients above 41x46px.** The four
gradients at or near full width are all black vignette masks over canvases:
`radial-gradient(55% 50% at 50% 55%, rgba(0,0,0,0) 15%, rgba(0,0,0,0.45) 38%,
rgba(0,0,0,0.85) 65%, rgb(0,0,0) 88%)` at 1425x900@y2528, and three more linear
black-to-transparent ramps at y2528, y11698 and y13967. The only chromatic radial on
the page is a 41x46px cursor halo,
`radial-gradient(rgba(255,233,105,0.69) 0%, rgba(255,220,101,0.29) 48%,
rgba(0,0,0,0) 76%)` at y=7717. The large soft colour masses a reader will remember —
the rainbow sphere, the vortex, the footer field — are WebGL point clouds with
resolvable individual points and defined silhouettes, not edgeless washes. The
tension is real: at strip scale the morphing sphere at y4900-6400 reads as a soft
rainbow mass, and a rater who scored it from the image alone would call it a blob.
The measurement says the page paints it rather than CSS-gradienting it.

**`testimonial-card-row` absent on a track 5.7x its clip.** The reddit social-proof
band at y=1695 is `flex overflow-hidden … cursor-grab`, `clientWidth` 969,
`scrollWidth` 5490, 15 children. The four source images (`social/g1.png` through
`g4.png`, 282x168 each) repeat 14 times down the DOM in the loop order
g4,g1,g2,g3,g4,g4,g1,g2,g3,g4,g4,g1 — a marquee duplicating a four-card set, with
cards at x=1608, 1974, 2340 and beyond sitting outside the frame entirely. Per the
decided rule, slides in an overflow track are not cards in frame. There is no other
social-proof section to score: the band's left half is a stat block ("4,000+ Mac
users. And counting.", "4M agent-seconds worked", "30.8K proactive suggestions
delivered") and the right half is the marquee.

**`three-card-row` absent twice over.** The three section tabs at y7620-7664 are
319px each at x=133, 553, 973 and measure `background-color: rgba(0, 0, 0, 0)`,
`border-width: 0px`, `border-radius: 0px`, `box-shadow: none`,
`backdrop-filter: none` — three transparent columns with a 319x3 active-state bar at
y=7505, not three cards. The three privacy principles *are* cards (18px radius, 1px
border) but are not a row: 466/526/513px wide at three x origins and three y origins,
overlapping. The one genuine 3-up on the page is the six-chip source band, which is
six.

**`generic-line-icon-set` absent on uniformity, not on glyph identity.** 53 SVGs. The
two largest uniform groups are both functional: 19 at 14x14 inside the knowledge
window's file tree (y6502-6626, distinguishing file from folder), and 11 at 18x18
`stroke-width: 1.5` which are the `+` expanders on the 11 FAQ accordions. The three
privacy-card glyphs — the nearest thing to a decorative feature set — measure 28x25,
21x21 and 20x24 with no shared `stroke-width` attribute, a 55% size spread across
three icons. The six source chips use the real Notes, Messages, Mail, Calendar,
Screenshots and Files app marks at their own proportions and colours, and they carry
information the headings do not: which data the model reads.

**`one-accent-discipline` absent on three chromatically distinct chrome accents, not
one.** Pure green `rgb(51, 255, 102)` carries the 7-segment `03:00AM` clock and its
digit counters (n=59 border, n=49 colour, y2085-2373). A warm sand family carries
the offer line — `rgb(231, 215, 185)` through `rgb(213, 167, 84)` to
`rgb(255, 245, 216)`, a six-stop `linear-gradient(105deg, …)` clipped to the text
"Next 1,000 users: free for life." at y=600 — and recurs on the `README.md` chip and
the proactive-card eyebrows. Orange `rgb(226, 109, 69)` marks the active numbered use
case at y8382. Add the seven-stop conic halo and the full-spectrum sphere, and the
pixel histogram agrees: hue buckets at 3.69 / 1.37 / 0.16 / 0 / 0 / 0 / 3.21 / 1.57 /
3.15 / 0.9 / 0.82 / 1.97 percent — red-orange, cyan, blue and magenta all above 0.8%
of sampled pixels, on a page that is 69.5% `rgb(8, 8, 8)`.

**`type-scale-high-contrast` absent at 2.46:1 on the hero.** 55.4px Cabinet over the
22.3px Satoshi subhead directly beneath it. Below railway-com's 2.7:1, which was
already absent. The page's widest ratios come where the body is smallest, not where
the display is largest: 65/18 = 3.70 at the security heading, 60/16 = 3.75 at the
closing CTA, 36/12 = 3.00 at the teams card, against 36/15 = 2.40 on each of the
three feature sections and 36/14 = 2.57 at the knowledge pane. The hero governs and
the hero is 2.46.

**`badge-pill-spam` absent at zero decorative pills above the fold.** Four elements
in the first 900px satisfy pill geometry: the nav container (394x58, r=29.995px,
holding three nav links), and three CTAs — "Download for macOS" at y=22 and y=530
and "Windows waitlist" at y=530, all `border-radius: 9999px`. All four are navigation
or conversion. The "Backed by Y Combinator" line at y=207 measures
`background-color: rgba(0, 0, 0, 0)`, `border-radius: 0px`, `border-width: 0px` — it
is text and a logo mark, not a badge. So is "Scroll to know more" at y=818 and "Top
post of the month" at y=1861. Threshold is 3+ decorative; the count is 0.

**`artifact-not-dashboard` absent by construction, and the construction costs
something here.** The page shows at least three things that are deliverables rather
than UI: the `README.md` pane, which is four paragraphs of actual written knowledge
("Their interests connect Apple hardware, local AI, cognitive science, philosophy,
and product design…") with cross-links to `Apple Silicon and Local AI` and
`Mac Setup and Shortcuts`; and the proactive-suggestion cards, which carry real
numbers ("$30, two hours, gets in at 11 AM, right as your hotel check-in opens",
"It's going to renew tomorrow for $119", "the $1,500 everyone mentioned"). Those are
the overnight work product, which is the thing being sold. But each is framed in app
chrome inside a window, `real-product-screenshot` is present four times over, and the
two signals are mutually exclusive, so this records as absent. The tension is the
known-soft one; the values stand.

**`typewriter-headline` absent despite a page that never stops moving.** The probe
records `heroTextStable: true` and `setInterval` count 0; the hero headline does not
cycle. What blocks screenshot stabilisation is the WebGL, not the type. This is
worth separating because "the page animates" would otherwise have been read into this
signal and into `scroll-reveal-blank`, and only one of those is true.

**`emoji-as-icon` absent at a true zero** — the emoji scan returns an empty array,
with no U+2713-in-mono case to adjudicate.

**`generic-sans-default` absent.** Body is `satoshi`, 16px, not Inter and not a system
stack. Inter, Geist, IBM Plex Mono and Arimo are all loaded and all four appear only
inside the simulated app panels: Inter at 17px/5px/4px ("Sidekick", "Overdue",
"Gmail", "Reply & add to your calendar"), Geist at 17px/5px ("You're free Wednesday
at 1. I've d…"), IBM Plex Mono at 11px/10px ("README.md", "OVERDUE · 3 DAYS ·
GMAIL"), Arimo at 11px ("read the draft", "read the plan"). Twenty instances across
four families, every one of them mock chrome imitating the app it is standing in for.

**`stock-photo-generic` absent.** The entire raster inventory is
`hero/sphere-ring.svg`, `icons/cursor.svg`, and `social/g1-g4.png`, which are 282x168
screenshots of real reddit posts. There is no photography on the page, stock or
commissioned.

**`symmetric-everything` absent and `centered-hero-stack` absent** on the same
measurement: 118 of 132 text blocks sit off the centre axis, and the hero headline's
midpoint is 341px left of x=720.

**`live-claim-control` absent.** The page has thirty controls — three play/pause demo
buttons, three section tabs, eight numbered use-case selectors, twelve knowledge-file
buttons, eleven FAQ accordions, a "Copy Homebrew install command" button — and not
one of them lets a visitor test the central claim, which is that an on-device model
reads your life and drafts in your voice. Every control navigates prerecorded
content. Against silica's reference case ("Press and hold to apply load" over a live
force chart), a play button on an mp4 does not qualify.

## On seven font families

14 font faces resolve to 7 real families: satoshi, cabinet, digitalNumbers, Inter,
Geist, IBM Plex Mono, Arimo (`document.fonts.size` reports 40 FontFace entries
across weights). Seven families is not what `custom-type-pairing` names, and the
ladder settles it as a pairing rather than a pile. The two-voice split is strict:
Cabinet holds 26px and up with nothing below it, Satoshi holds 27px and down with
nothing above it, and the 27px overlap is the wordmark. The other five families are
not page voices at all — digitalNumbers sets one element, the `03:00AM` clock, and
the remaining four exist only to make the simulated Gmail, Finder and notification
chrome look like Gmail, Finder and notifications, which is a correctness decision
inside a screenshot rather than a typographic one about the page. A site whose
display and body voices are two faces set to two different tracking rules has a
pairing; the other five are props.

That said, the vocabulary cannot express the thing an observer would reasonably
flag: that seven loaded families is a lot of load for a page whose own voice is two,
and that nothing in the signal list distinguishes "two deliberate voices plus five
props" from "seven families because nobody was counting". `custom-type-pairing` is
binary and reads present either way. The distinguishing evidence here is the size
ladder, not the face count, and a rater working only from `faces` would have no way
to tell those apart. Recording it as a gap.

## Verdict

Net -2: four slop signals present against six craft. That lands in the overlap where
both verdicts are attested — dropbox-2014 is `exemplar` at -2, and `mixed` extends to
-5 — so the net does not decide it.

`mixed`, and three measurements are what keep it out of `exemplar`. Colour discipline
is absent, not marginal: a pure green clock, a six-stop sand gradient on the offer
line, an orange active marker, a seven-stop conic rainbow repeated behind three CTAs,
and a full-spectrum point-cloud sphere, on a page that is otherwise 69.5% near-black.
Eight translucent-blur surfaces against a threshold of three. And 22 net text nodes
gated behind scroll, including a section eyebrow, a section heading and a section's
opening body line — a real robustness defect, not a template tell, on a page that
otherwise degrades well.

What it does not have is the template: no centered hero stack, no three-card row, no
testimonial triplet, no uniform line-icon band, no gradient CTA fill, no stock photo,
no cycling headline. The hero is left-aligned and 341px off-axis, the type pairing is
real and strictly enforced, the product is shown working inside real third-party
applications under user-controlled playback, and the density range across the page
spans 100:1. This is a well-made page with an undisciplined palette and a scroll
gate, which is what `mixed` is for.
