---
source: https://edotenv.com
kind: site
cohort: yc-current
verdict: exemplar
studied: 2026-10-14
context: [hero, nav, cta, footer]
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
  editorial-grid-break: present
  custom-type-pairing: absent
  real-product-screenshot: absent
  shows-deliverable: absent
  density-variation: absent
  one-accent-discipline: present
  live-claim-control: absent
materials: [single-theme]
---
Captured at 1440x900; full page 3098px; 5 tiles on a 700px walk at 900ms settle
with animations disabled, stitched to one 1440x3700 strip. Two stitch artifacts to
discount before reading it: maximum scroll on a 3098px page is 2198, so tiles 04
and 05 both clamped there and the strip's last ~602px (y3098-3700) is a duplicate
of the section-04 and footer band — the page has one "Working on RSI" section, not
two. And `HEADER.minimalHeader` (1302x80, `backdrop-filter: blur(12px)`) is sticky,
so it reappears at each tile seam and occludes the top line of the section-02 and
section-03 headings in the strip. Neither is a page defect.

**No slop signal is present. Zero of sixteen.** That number needs qualifying before
it is believed, and the qualification is below under restraint-versus-vacancy; the
measurements come first.

The page carries no raster or vector graphic of any kind: 0 `<img>`, 0 `<svg>`,
0 `<canvas>`, 0 `<video>`, 0 transformed elements. 1741 characters of innerText over
3098px. The entire visual system is one typeface in two widths, three greys, one
blue link, and four full-width hairline rules.

**The page is 0.018% chromatic.** Across the strip sampled at every row and every
second column (2,664,000 samples) exactly 471 pixels carry chroma above 40, and all
of them belong to one link. The palette is paper `#FBFAF7` (251,250,247), ink
`#20201D` (32,32,29), and a label grey `#75746D` (117,116,109). `gradient-blob` and
`gradient-fill-cta` have nothing to sit on: 0 large-area gradients, 0 button
gradients and 0 gradient text fills measured in the DOM, and the one primary CTA
("Get in touch", 119x35 at y22) is an outline pill on paper.

**The reported 95.5% single-hue saturation is the background, and it is an
instrumentation artifact.** `satPct: 95.5` with `hueBuckets[1] = 95.46` reads as a
page drowning in one hue. It is the paper. The probe's saturation term is
`(mx-mn)/(255-|mx+mn-255|)`, whose denominator collapses toward white: at L=0.976
the paper's 4/255 channel spread (251/250/247) computes to sat=0.333, clears the
0.18 gate, and hues to exactly 45.0°, which floors into bucket 1. Reproducing the
formula on `#FBFAF7` returns 95.46% in bucket 1 to the decimal. Above roughly L=0.9
this statistic should not be read as saturation at all. The honest figure for this
page is the 0.018% above.

**`indigo-violet-accent` is absent on hue, not on absence.** The one accent is
`rgb(36,86,215)` = `#2456D7` on the closing "Join the conversation" link, hue
223.2°. The archetypal AI indigo `#6366f1` sits at 238.7° and heroku-2014's violet
field at 251.6°, so this is 15.5° and 28.4° off them respectively — a link blue, not
the palette the signal names.

**`one-accent-discipline` is present on one accent, not on zero.** That single
223.2° blue is the only chromatic element on 3098px, used on exactly one link.
Under the decided zero-accent ruling it would be present either way, but it does not
need the ruling here.

**`symmetric-everything` and `centered-hero-stack` are absent on alignment counts.**
0 of 14 ladder nodes are centre-aligned (10 `start`, 4 `left`). The hero display
sets at x=69, w=461 in a 1440 frame — hard against the left margin with roughly
910px of vacancy to its right. Nothing on the page shares a centre axis.

**`scroll-reveal-blank` is absent on a before/after walk.** Text under 8% opacity
measures 0 nodes at rest and 0 after the full scroll walk; `docH` is 3098 both times
and `innerTextLen` is 1741 both times. Nothing mounts on scroll because everything
is already there. `typewriter-headline` is absent on `heroTextStable: true` with 0
`setInterval` registrations.

**`glass-card-overuse` and `badge-pill-spam` are both absent at exactly 1 against a
threshold of 3** — one translucent surface (the sticky header, blur(12px)) and one
pill (the nav CTA, outline). Recorded as near-misses rather than clean zeros,
because the page demonstrably reaches for both devices and then stops.

Now the craft side.

**`type-scale-high-contrast`: 8.70:1, and the altitude matters, so here is all of
it.** The display line "EdotEnv" sets at 139.2px against a computed `body`
font-size of 16px: **8.70:1 measured at nominal font-size**. The vocabulary states
no threshold and no altitude for this signal, so a second rater needs the alternates
to check the same thing: against the hero subhead (27.2px) the ratio is 5.12:1;
against the largest body paragraph (24.8px) 5.61:1; against the smallest (19.44px)
7.16:1. **Cap-height altitude collapses onto nominal here**, because one face (Geist)
carries both the display and the body, so cap-height/em is identical on both terms
and the ratio is unchanged at 8.70:1 — the altitude question only moves the number
when display and body are different faces. For scale: railway-com measured 2.7:1
against its subhead and 3.4:1 against 16px body and was scored absent. Every
altitude available on this page exceeds railway's highest by at least 1.5x.

**`generic-sans-default` is absent on a tracking table specified to exact em
percentages at seven sizes.** Geist carries display and body; Geist Mono carries
nav, section numbers and footer. The letter-spacing is not one global value:

| size | face | letter-spacing | % of em |
|---|---|---|---|
| 139.2px | Geist | -11.832px | -8.50% |
| 63.36px | Geist | -4.4352px | -7.00% |
| 27.2px | Geist | -1.088px | -4.00% |
| 24.8px | Geist | -0.62px | -2.50% |
| 19.44px | Geist | -0.34992px | -1.80% |
| 10.88px | Geist Mono | +1.088px | +10.00% |
| 10.56px | Geist Mono | +0.8448px | +8.00% |

Every one of those is an exact percentage, which means the tracking is authored per
step in a design system rather than eyeballed, and it tightens monotonically as size
climbs then opens to +8/+10% at caption size. This is precisely the discriminator
railway-com was scored `present` on for lacking: "there is no per-size tracking
table compensating for it; the 16px body runs at `letter-spacing: normal`." Here
there is one, at seven sizes. (The 16px wordmark at -4.50% and weight 650 sits off
the ramp because it is a logotype lockup, not text.)

**The conflation in this signal, flagged as instructed.** `generic-sans-default`
cannot currently distinguish three different pages: one that ships no webfont at
all, one that ships a deliberate neutral grotesque as a considered choice, and one
that reaches for the era's default sans without thinking. All three can read
`present`, for opposite reasons. Geist is a widely-used, default-feeling neutral
grotesque and on a face-identity reading this is `present`; on the railway
discriminator — does the page compensate for the face with its own optical system —
it is `absent`, and decisively so at seven authored steps. I have settled it
`absent` on the discriminator, because that is the reading the committed anchor
actually operationalises, and a signal that fires on both "no typography" and
"typography I disagree with" is not measuring anything. This is the same defect the
vocabulary already retired `dark-mode-afterthought` for, and it needs the same
split: face identity and tracking discipline are two different facts.

**`asymmetric-split` is present, and the page inverts which side is empty.** The
hero pins 461px of display at x=69 and leaves the right of the frame vacant. Every
body section does the opposite: a 684px content column at x=498 (ending 1182) with
the 429px to its left holding nothing but a 119px label block. Asymmetric by vacancy
rather than opposing mass, the same figure railway-com was scored on, run in both
directions down the page.

**`editorial-grid-break` is present on the margin label system.** Each section is
numbered with a Geist Mono eyebrow — "01 WHY MARKETS", "03 THE MISSION", "04 GET IN
TOUCH" — set at x=69 (number) and x=104 (label, w=57-84px), baseline-aligned to the
top of a heading that starts at x=498. They sit permanently outside the content
column and displace none of it, which is the anchor's operative test for this
signal. A second, weaker datum: section 03's heading sets at x=462 against x=498 for
sections 01, 02 and 04 — a 36px hang, visible in the strip, which may be deliberate
emphasis on the mission statement or may be an override left in. The signal does not
depend on it.

**`single-optical-anchor` is present at 3.90% ink.** The hero band (y60-760) carries
3.90% ink coverage, and one 139.2px, 461px-wide element accounts for most of it.
There is nothing else in the first viewport to look at.

The absents on the craft side are the real cost, and they are not close calls.

**`density-variation` is absent on a 0.80 percentage-point spread.** Ink coverage
measured per band at every second pixel: hero 3.90%, section 01 4.20%, section 02
4.09%, section 03 4.23%, section 04 4.70%. The page has one density and holds it for
3098px. Type size varies (139.2 / 63.36 / 27.2 / 24.8 / 19.44), information density
does not. For contrast, railway-com's instance moved from 17.9% to 68.7% ink across
a single 820px band.

**`custom-type-pairing` is absent on family, not on face count.** Two faces load,
Geist and Geist Mono, and the ladder shows Geist carrying both the display and the
body sizes with Geist Mono confined to 10.56-11.2px chrome. A sans and its own
monospace companion are one typeface family drawn in two widths — same designer,
same skeleton, same release — not two voices in dialogue. The signal names the
dialogue. railway-com earned it on IBM Plex Serif setting every display line against
Inter body: a serif argued against a sans, visible in one section. Geist against
Geist Mono is a role distinction inside one voice, and the roles here are genuinely
systematised (negative tracking on the sans, positive on the mono), but systematised
is not paired. Absent.

**`real-product-screenshot`, `artifact-not-dashboard` and `live-claim-control` are
all absent, which is the page's whole weakness in one line.** 0 images, so no
screenshot. No ledger, chart, comparison, benchmark or priced output, so no
deliverable. `dom.controls` measures 0, so nothing the visitor can touch to falsify
anything. The company's claim is that it builds "RL environments at scale from
financial market data that increase in difficulty"; the page ships 1741 characters
and not one environment, one benchmark figure, one chart or one number. The
mutual-exclusion convention between the first two signals never even gets tested
here, because neither has a candidate.

**Restraint, or absence of surface area? Both, and the ratio is measurable.** Six of
the sixteen slop signals require a surface this page does not have:
`three-card-row` (0 card surfaces, `dom.rows` empty), `testimonial-card-row` (no
social-proof section exists), `generic-line-icon-set` (`svgCount: 0`),
`stock-photo-generic` and `hero-mockup-float` (0 images, 0 transforms), and
`emoji-as-icon` (0 emoji). Those six are `absent` honestly — the page is 3098px and
fully read, with no hidden text and no scroll gate, so there is nothing to mark
`unresolved` — but they are uninformative, and about 38% of the slop vocabulary
therefore tells us nothing about this page. The remaining ten are informative and
all ten are absent, four of them against a measured near-miss where the page had the
device in hand and stopped short: one blur surface against a threshold of three, one
pill against three, a chromatic accent 15.5° off the indigo, and a webfont grotesque
with an exact-percentage tracking table at seven sizes. That is restraint with
evidence, not vacancy.

**Why `exemplar` and not `mixed` at net -5.** Net -5 is the overlap value: `mixed`
runs -5..+4 and `exemplar` -7..-2, so the score cannot decide this and the reasoning
has to. Three things decide it. First, no measured axis on this page is
template-shaped — 0/14 centred nodes, 0 gradients, 0.018% chromatic ink, 0 hidden
text and a hand-authored tracking ramp are each individually incompatible with a
generated page, and a template minimal page would ship Inter at `letter-spacing:
normal`, a centred hero and at least one gradient. Second, four of the five craft
presents are positive measurements of layout and type decisions (x-offsets, ink
coverage, an 8.70:1 scale, a margin column), not scores earned by something being
missing. Third, the page's genuine failure — that it shows and proves nothing — is
already charged against it by the three content-axis craft signals, and it still
nets -5 after paying that.

What a second rater should press on, because it is where I would expect a split:
whether the content axis deserves more weight than the vocabulary gives it. A page
that cannot be falsified anywhere, shows no product and offers no control is doing
less work than its typography suggests, and a rater who weights
`real-product-screenshot` / `artifact-not-dashboard` / `live-claim-control` more
heavily than four type-and-layout presents lands on `mixed`. I would not call that
reading wrong. What should not survive either reading is a verdict that treats this
page as template-shaped, because nothing measured supports that.

Single theme: 0 `prefers-color-scheme` rules and 0 dark-mode class hooks, so there
is no second theme to neglect.
