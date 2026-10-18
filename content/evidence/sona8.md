---
source: https://sona8.com
kind: site
cohort: yc-current
verdict: mixed
studied: 2026-10-18
context: [nav, hero, features, testimonials, team, cta, footer]
signals:
  gradient-blob: absent
  three-card-row: absent
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: present
  symmetric-everything: absent
  badge-pill-spam: absent
  generic-line-icon-set: absent
  testimonial-card-row: absent
  indigo-violet-accent: present
  gradient-fill-cta: absent
  scroll-reveal-blank: present
  typewriter-headline: present
  stock-photo-generic: present
  centered-hero-stack: absent
  hero-mockup-float: absent
  asymmetric-split: present
  single-optical-anchor: absent
  type-scale-high-contrast: present
  editorial-grid-break: absent
  custom-type-pairing: present
  real-product-surface: present
  shows-deliverable: absent
  density-variation: absent
  one-accent-discipline: present
  live-claim-control: absent
materials: [single-theme, stock-photo, commissioned-photo, illustration, video-embed]
---

AI employee-interview platform, YC-backed. Full re-study of the rebuilt page, rated
blind before the old evidence file was opened. The page now leads with "Interview your
whole company in days." over two persona portraits, puts its only product footage in a
click-to-play 63s Tella embed, explains itself in an auto-advancing three-tab panel,
and closes on a violet CTA band and a navy footer.

**Capture.** 1440x900, window scroller. The 2026-10-16 walk at `~/scratch/antislop/s5/sona8`
read docH 6649; a fresh walk today read **6705** before and after, so the old tiles were
stale and the walk was re-shot into the same directory: 10 tiles at a 700px step,
`clamped: false`, `reachedPx` 6705, `coverage: 1`. `NS_SESSION=s5 stitch.py` gave 2 strips
(1440x4400, 1440x2305), **6705px against page 6705px, zero drift**. The last strip ends
in the navy footer (`© 2026 Sona8 · GDPR compliant · EU data residency · SOC 2
compliant, certification in progress`). A fixed cookie dialog ("One more cookie?",
x976-1416) overlays the right edge of every tile, so all text and every number below
was read from the DOM with Playwright, and section shots were retaken with that dialog
set to `display: none`. The walker disables animations, which matters twice here: the
strips show the scroll-gated headings already visible, and they show the claim photo
frozen mid-blur. Neither is what a reader gets; both were measured live instead.

Sections, page y: header 36 (sticky), hero 140-1039, logo bar 1039-1219, "See it in
action" 1219-1677, how-it-works tabs 1677-2333, signal network 2333-3131, testimonials
3131-3890, claim photo band with quote ticker 3890-4325, research 4325-4796, team
4796-5472, CTA band 5472-5914, footer 5915-6669.

**Slop signals present (5).**

- **`generic-sans-default`.** Body is `inter` at 16px, `letter-spacing: normal`; every
  paragraph sampled reads `inter 17px ls=normal` or `inter 20px ls=normal`, and Inter
  also carries the nav, every button, the 13px eyebrows (`ls=1.3px`), the team names
  (20px/600) and the footer. `document.fonts` holds Inter 400/400i/600/700 and
  Newsreader 400, nothing else. The display face is a serif and is scored separately
  under `custom-type-pairing`; the body face is the stock choice. Same reading, same
  shape, as financial-datasets (Literata over Inter, both values present).
- **`indigo-violet-accent`.** The one accent is `rgb(150, 119, 255)` (#9677FF): HSL hue
  **253.7°**, chroma 136. Its ink partner is `rgb(33, 31, 84)` (#211F54), hue **242.3°**,
  chroma 53, which colours the footer field, the CTA headline, the CTA button and the
  inactive tab labels. Colour census over visible elements: the violet appears as 315
  SVG strokes (network graph, dot grids), 12 backgrounds (both BOOK A DEMO buttons,
  active tab, active degree row, active testimonial row, the full-bleed CTA band, the
  GRACE and DANIEL name pills, the cookie ACCEPT ALL) and 13 foregrounds. Both
  chromatic colours on the page sit inside 240-255°.
- **`scroll-reveal-blank`, and the control settles it.** Instrument: every element
  with its own letter-bearing text node (220 of them), effective opacity taken as the
  product of ancestor opacities (0 for `display:none`/`visibility:hidden`), sampled
  after a 9s settle and then after each step. Walk: 700px steps, 900ms dwell each,
  9.48s elapsed. Control: same page, same settle, no scroll, sampled every 900ms for
  10.48s. Hidden at start (<0.08): 62 walk / 61 control. **Recovered to ≥0.5: 35 in
  the walk, 0 in the control.** The walk-only set is the "See Sona8 in a minute." H2,
  the Tella cookie notice under the poster, the network diagram's `CEO` label, the
  research statement "We test the method
  with researchers at MIT and TUM, and publish what we find.", all 30 text nodes of the
  five team cards, and the CTA H2 "Ready to prove your strategy?". Mechanism read off
  the nodes: `opacity: 0; filter: blur(10px)` at rest on the H2/P/LI, `opacity: 1;
  filter: none` after the walk. The 27 that stay hidden in both runs are the inactive
  tab panels, the four inactive testimonials and duplicate small-screen team labels,
  hidden by state rather than by scroll. So the gate is scroll, not time: the hero's
  own intro (`span.letter-reveal` per letter, `.load-fade` on the subcopy) is a load
  animation, visibly mid-blur at 300ms, and is fully resolved before the 9s settle.
- **`typewriter-headline`, on its second clause.** The H1 held one value
  ("Interview your whole company in days.") across 36 samples. The how-it-works panel
  does not. With the panel in view (scrollY 1700) and zero pointer input, 12 samples at
  2000ms saw `aria-selected` walk `Sona8 interviews your people` → `Every answer is
  coded` → `You read the Insights` → back to the first, and the panel's own 36px
  Newsreader H3 swap with it ("Sona8 interviews your people." / "Every answer is
  coded." / "You read the Insights.", each at opacity 1.00 while the other two read
  0.00, one sample catching the crossfade at 0.92/0.08). It holds when scrolled out of
  view (12 samples at scrollY 2400, tab fixed on `Every answer is coded`), so it is an
  in-view timer. The testimonial panel does the same, advancing Hackmann → Hartman →
  Butcher → Trummer → Berghoff at about 6s each, and the 1st/2nd/3rd-degree list
  rotates its highlight every 2s. Scored on neuron-industries' precedent: a panel
  cycling phrases on a timer, unprompted, while the headline stays put. See near-misses
  for why this is the value most open to dispute.
- **`stock-photo-generic`.** Three photographs carry no company and no surname: the
  hero's `portrait-grace` (alt "A woman in a blue cap, smiling, her chin tic[ked]...")
  and `portrait-daniel` (alt "A man with a beard in profile, looking u[p]..."), each
  684x375, captioned only by vertical pills `GRACE / SENIOR SALES MANAGER` and `DANIEL /
  VP MARKETING` and an invented quote; and the full-bleed `claim-banner` (alt "A woman
  with glasses, smiling at the camera", 1440x810 source) behind the quote ticker, whose
  speakers are roles, not people ("Shift lead", "COO", "Store manager"). These are
  persona illustrations that could sit on any HR-tech page. The real people on the page
  are elsewhere and are not counted: five named founders in the team row and five
  named, titled testimonial headshots.

**Craft signals present (5).**

- **`asymmetric-split`.** Every heading is `text-align: start`; nothing is centred. The
  hero opposes the 88px H1 block (x126, 624px wide, y236-513, plus "Listen & move
  forward." at y600) against a 500px column at x814 holding subcopy, both CTAs and the
  YC line, which ends at y534 while the left side runs to y641. The testimonial section
  splits 705 / 442 (61/39). The research section is asymmetric by vacancy: the left
  ~376px holds only the 13px `RESEARCH` eyebrow, the 42px statement starts at x502.
  The network section splits 679 / 509 (57/43). Two sections are exactly even, the
  video row (558 / 558) and the tab panel (484 / 484); see near-misses.
- **`type-scale-high-contrast`.** `getComputedStyle(h1).fontSize` = **88px** Newsreader
  400, `letter-spacing: -1.76px`, against body 16px: **5.50:1**. The H1 is split into
  one `span.letter-reveal` per letter, each computing 88px, and each is a text node with
  a letter, so it qualifies under the "at least one letter" rule. `ladder.cjs` reports
  **4.63:1** (74px, "Ready to prove your strategy?") because it drops any node whose
  direct text is under 3 characters (`if (direct.length < 3) return;`), which removes
  every letter of a per-letter-split headline. Both readings clear 3.75. The ladder
  under the hero is graded: 88, 74, 60, 44, 42, 36, 34, 31.68, 28, 22, 20, 17, 16, 13.
- **`custom-type-pairing`.** Two faces split by role. Newsreader carries every heading
  at or above 31.68px (88 H1, 74 CTA, 60 "Team", 44, 42 research statement, 36 tab
  H3s, 34 "Listen & move forward.", 31.68 testimonial quote), plus the footer tagline
  and the 22px cookie title. Inter carries 20px and below. One exception breaks the
  division: the network H2 "Organisations miss important signals because they cannot
  listen at scale." is Inter 600 at 28px. Same shape as financial-datasets and
  railway-com, both present; the licence (both open) is irrelevant.
- **`real-product-surface`, and it lives entirely behind a play button.** The poster
  in "See it in action" is the founder's face with `1:03`; clicking swaps in a Tella
  iframe (`tella.tv/video/sona8-transformation-e8ce`) at **558x314** inline. The
  stream is 1920x1080, 63.11s, pulled with ffmpeg from the signed HLS manifest and read
  as a 1fps contact sheet plus full-resolution frames. t≈3-21s is a screen recording
  of the dashboard with a live cursor: workspace `Madeleine Demo Org`, project "Moving
  to the central warehouse" (`Live · 8 to 22 Oct 2026`), header stats `18 of 19
  finished` / `Closes in 11 days` / `5 things recur`, tabs Overview / People /
  Diagnostic / Communications / Survey / Settings, a real loading state at t≈5-6s, then
  the Diagnostic view with theme bars at 89/89/83/72/56% ("Share of all 18 people") and quote cards per theme.
  t≈22-53s is the respondent-side interviewer in a phone frame (animated face, `Mute` /
  `Pause` / `I'm done`). A genuine capture of the product in use, so it passes; the
  demo-org data is judged on content under `shows-deliverable`, not here. At rest the
  page shows no product at all: the tab panel's three visuals are 9x4 dot grids (108
  SVG nodes each), and the network is a 330-node concept diagram.
- **`one-accent-discipline`.** One chromatic accent, #9677FF, used for every primary
  action, every active state and both diagrams; its only partner is #211F54, 11.4° away
  in hue and used as ink and as the footer field, not as a second call to action. The
  only other chromatic pixels are third-party marks (Y Combinator orange
  `rgb(242, 102, 37)` in the YC logo) and the cookie dialog's biscuit browns. Zero
  gradients anywhere (`background-image` census: 0).

**Near-misses.**

- **`shows-deliverable` absent, on legibility, and it is the closest call on the
  page.** Procedure run: the entry that could have embarrassed the vendor exists, and
  it is a good one. In the Tella video at t≈3-4s the dashboard's "Needs you" panel reads
  **"58 of 203 statements fit none of the 5 themes."** directly under the page's own
  tab heading "Every answer is coded.", beside "Madeleine has not started. Invited 11
  Oct, not opened." and the header's `1 not started` under `18 of 19 finished` (a page
  whose headline is "Interview your whole company"). That is the product's own coding
  leaving 29% of statements unplaced. But the entry must be legible at page size in
  CSS px as rendered: the iframe is 558px wide, a scale of 558/1920 = **0.29**, so that
  line (about 14px in the 1920 frame) renders at **≈4px**, and `18 of 19 finished`
  (about 18px) at ≈5px. The 1fps sheet shows no zoom segment: every dashboard frame
  keeps the sidebar, so nothing is ever enlarged. Basecamp-2014's 4px concession is the
  standing precedent for failing exactly this way. The panel is also on screen for
  about one second of 63. Everything else fails on stance: the hero and ticker quotes
  ("The night shift works around the same fault every week.") are problems the product
  surfaces, which is the pitch and excluded; the five testimonials are praise; the
  footer's "SOC 2 compliant, certification in progress" is a real narrowing but it is
  footer prose, not an artefact.
- **`typewriter-headline` present could be read absent.** The tab bar is labelled, so
  all three phrases are on screen at once as tab labels and the timer hides nothing a
  reader cannot reach; a typewriter headline hides its alternatives. The panel is also
  a how-it-works explainer illustrated with dot grids, not a panel showing the product,
  so "product panel" applies only by extension. Scored present because neuron-industries
  set the precedent on mechanism (an unprompted timer swapping a panel's text while the
  headline holds), and sona8 runs three such timers. Flipping it moves net to -1 and
  leaves the verdict where it is.
- **`stock-photo-generic` present rests on "could belong to any company", not on
  provenance.** I could not prove the three photos are licensed stock. What settles it
  is that the page itself treats them as anonymous: persona first names, roles with no
  employer, alt text that describes a generic person. The claim band adds a scroll
  effect where the photo sits under `blur(22px)` and focuses to `blur(0px)` as it
  enters, while its overlaid "Listen & move forward." (`p.focus-fade`) runs from
  `opacity: 1` to `opacity: 0; filter: blur(10px)`: measured at scrollY 3500, 3900 and
  4300 the image is at 4.7px, 0px, 0px of blur and the text is already at opacity 0. So
  the blur is a scrim that lifts as the text leaves, rather than one bolted on to keep
  type alive. That clause alone would not have fired; the any-company clause does.
- **`badge-pill-spam` absent.** The four vertical persona pills (24px wide, fully
  rounded) are the only pills in marketing chrome near the fold. Measured: `SENIOR
  SALES MANAGER` y786-959 and `VP MARKETING` y842-957 straddle the 900px fold;
  `GRACE` y963-1027 and `DANIEL` y961-1027 sit wholly below it. At most two above the
  fold, and they caption the photos rather than decorate them. The rounded CTAs are
  buttons; "Backed by Y Combinator" is an inline SVG mark, not a chip.
- **`asymmetric-split` present is not unanimous down the page.** The hero split is
  624 / 500 with a 64px gutter, close to even, and two sections are exactly 50/50. It
  holds on the hero's left-weighted mass plus the 61/39 testimonial and vacancy-split
  research sections; a stricter reader who demands the hero alone be strongly unequal
  would score it absent.
- **`real-product-surface` present depends on counting a click-to-play embed.** A
  still capture of this page shows no product UI anywhere. If embedded video behind a
  play button does not count as the page showing its product, this flips to absent
  and net goes to +1. Still mixed.
- **`density-variation` absent.** Ink per section (share of pixels >40 luminance from
  the band's mode, every 2nd px, x40-960 to stay left of the cookie dialog): video row
  1.9%, footer 3.1%, research 4.5%, CTA 5.5%, network 7.2%, testimonials 7.4%, logo
  bar 6.5%, tabs 10.6%, team 15.6%, hero 29.6%, claim band 61.5%. The high readings are
  all photographs (hero portraits, team headshots, claim photo). Every type-bearing
  section is one heading and one to three short paragraphs; there is no table, list,
  log or data passage. The 330-node network graph is dense ink but decorative density,
  not information.
- **`three-card-row` absent.** Equal-width same-row groups of 3+ wider than 600px: the
  tab bar (3x396, buttons, not cards), five stacked testimonials sharing one grid area,
  the 5-up team row (5x218), the footer's four link columns. No three-up card row. The
  team row is a five-up of equal cards; not this signal by count.
- **`testimonial-card-row` absent.** One featured quote (Newsreader 31.68px with a
  146px headshot) beside a five-row selector list that auto-advances. One quote is
  visible at a time.
- **`glass-card-overuse` absent.** One `backdrop-filter` surface, the sticky header
  (`blur(12px) saturate(1.5)`).
- **`emoji-as-icon` absent.** `\p{Extended_Pictographic}` over `innerText` matches only
  `©`. No feature icons at all: the top-level SVG census is two wordmarks, the YC mark,
  a 23px play glyph, three dot grids, the network graph and the cookie illustration,
  which is also why `generic-line-icon-set` is absent.
- **`single-optical-anchor` absent (rule-ineligible; honest call).** At 1440x900 the
  first viewport holds three masses: the 88px H1 block (624x277, the largest type), the
  500px subcopy-and-CTA column with the violet BOOK A DEMO, and the top 236px of the
  1368px portrait band, which is the largest area and the most saturated (the blue
  cap). The band is itself split into two equal halves by a rule at x720. No single
  mass dominates, and this is not the "one mass because there is only one" case.
- **`editorial-grid-break` absent.** The page draws its grid (1px frame rules at x36
  and x1404, section rules with crosshair ticks where they cross, `grid-rule` and
  `grid-box` classes) and keeps to it. The full-bleed bands (portraits, logo bar, claim
  photo) run frame to frame, which is the convention, and the tab box's rules
  overshoot by 12px as a display of the grid, not a break from it.
- **`live-claim-control` absent.** Nothing lets a visitor test "Interview your whole
  company in days."; the controls are tabs, a testimonial selector, a video play button
  and BOOK A DEMO.
- **`materials`.** No `prefers-color-scheme` rule among 233 readable CSS rules:
  `single-theme`. `stock-photo` for the three persona photos; `commissioned-photo` for
  the five team portraits shot on one grey backdrop; `illustration` for the dot grids,
  the network graph and the cookie character; `video-embed` for the Tella clip. No
  `video-hero` (the hero is two stills) and no `webgl` (0 canvas).

**Verdict: mixed.** Net = 5 slop − 5 craft = **0**, well inside the mixed band
(−6..+3) and four short of the +4 that is necessary for slop. The disputed values cut
both ways: `typewriter-headline` to absent gives −1, `real-product-surface` to absent
gives +1. What a second rater should take from the profile: the page's template tells
are motion and palette (a scroll-gated blur-in on four sections, three timers, a
violet accent over Inter), while its type is genuinely decided (88px Newsreader at
5.5:1, a clean serif/sans split). Its best evidence of honesty, the 58 unfitted
statements, is real and unreadable. Page height 6705px; not a thin page, so the low
counts are not an artefact of signals having nowhere to fire.

**Drift from the 2026-10-13 study**

The old file is a viewport-only study ("Viewport only; below-fold unresolved.") of a
Vite SPA that no longer exists, plus a 2026-10-16 deliverable re-pass and an
orchestrator ruling. Old net: 3 slop − 8 craft = **−5**. New net **0**. Verdict
**mixed → mixed**. Every change, with its cause:

- **`three-card-row` present → absent. Page changed, and the old basis is doubtful.**
  The old prose's "three-up explainer row" sat at the bottom edge of a viewport shot;
  the re-pass identifies the same position as the tab row "Sona8 interviews your
  people / Every answer is coded / You read the...". On the live page that row is a
  labelled tab bar (3x396 buttons) over one panel, which is not a card row. Whether the
  old row rendered as cards or as tabs cannot be checked; the old page is gone.
- **`generic-sans-default` absent → present. Page changed.** The Wayback HTML for the
  studied build (snapshot 20261009203413) loads Public Sans, IBM Plex Mono and Source
  Serif 4 from Google Fonts and no Inter. The live Next.js build sets every paragraph
  in Inter at default tracking. (The old CSS bundle returned an Internet Archive
  "Temporarily Offline" page, so which face carried the body is inferred from the
  font load, not read from a rule.)
- **`testimonial-card-row` unresolved → absent. Old capture never reached it.** Now
  measured: one featured quote plus a five-row auto-advancing selector.
- **`scroll-reveal-blank` unresolved → present. Old capture never reached it.** 35
  text nodes recovered by the walk, 0 by the dwell control.
- **`typewriter-headline` absent → present. Old capture never reached it; whether the
  old panel cycled is unrecorded.** The timers are on the how-it-works panel, the
  testimonial panel and the degree list, all below the old viewport. The old hero H1
  had no timer, and neither does the new one.
- **`stock-photo-generic` absent → present. Page changed.** The persona portraits
  (`portrait-grace`, `portrait-daniel`) and the `claim-banner` photo are new in the
  redesign. The old hero was a video card over a dotted halftone.
- **`hero-mockup-float` present → absent. Page changed.** The floated Tella card left
  the hero. Its replacement sits flush in its own section ("See it in action") as a
  558x314 poster on the grid, not floated over a field.
- **`editorial-grid-break` present → absent. Rater disagreement more than page
  change.** The old basis was the nav "in its own boxed cell outside that grid". The
  live page keeps a boxed nav cell, and it sits on the same frame rules (x36/x1404) and
  closes on the same horizontal rule as everything else, so I read it as part of the
  drawn grid. I cannot say whether the old nav cell was positioned differently.
- **`shows-deliverable` present → absent. Page changed.** The credited entry ("1 of 1
  conversations did not reach Current stage of AI adoption within the team.", 0-minute
  median against "About 15 minutes") was in the studied page's 103s video, which is
  gone. On the live page this study agrees with the re-pass's `absent`, **for a
  different reason**: the re-pass sampled the new video every 4s and wrote "All bad
  news is the client's; 18 of 19 flatters", missing the t≈3-4s "Needs you" panel,
  "58 of 203 statements fit none of the 5 themes.", which is the product's own coding
  coming up short. That entry fails on legibility (≈4px at the 558px embed), not on
  stance. **Flag for the orchestrator:** the ruling credited the studied page's entry
  from inside a click-to-play Tella card without recording its rendered size. If the
  legibility rule had been applied there, a dashboard line in a card of similar width
  would have rendered at a similar few px. That ruling is not mine to revisit, but the
  two pages are now being treated differently on one axis.
- **`density-variation` present → absent. Page changed, and the old value had little
  to stand on.** The old value came from one viewport. The live page measures 1.9-10.6%
  ink across its type-bearing sections, with the high readings all photographs.
- **`custom-type-pairing` present → present, basis changed.** Old: a serif called
  "high-contrast didone" over a sans; the studied build loaded Source Serif 4, which is
  not a didone. Live: Newsreader over Inter.
- **`type-scale-high-contrast` present → present, number changed.** Old ≈68/16, "close
  to 4:1"; live 88/16 = 5.50:1 (`ladder.cjs` says 4.63 because it drops the H1's
  one-letter spans).
- **`real-product-surface` present → present, basis changed.** Old: a floated video
  card whose poster was a product frame (Rheinfeld Automotive). Live: a click-to-play
  embed whose poster is the founder's face, with the product only in the recording.
  So a still of the live page shows no product; the old page's did.
- **`context`: [hero, nav, testimonials] → [nav, hero, features, testimonials, team,
  cta, footer].** The old study saw one viewport.
- **`materials`: [single-theme, video-hero] → [single-theme, stock-photo,
  commissioned-photo, illustration, video-embed]. Page changed:** the hero is now two
  stills and the video is an in-page embed; the photos and the dot-grid and network
  illustrations are new or were below the old fold.
- **Unchanged:** `gradient-blob`, `glass-card-overuse`, `emoji-as-icon`,
  `symmetric-everything`, `badge-pill-spam`, `generic-line-icon-set`,
  `gradient-fill-cta`, `centered-hero-stack`, `single-optical-anchor` and
  `live-claim-control` absent; `indigo-violet-accent`, `asymmetric-split` and
  `one-accent-discipline` present. The violet survived the rebuild.

**Vocabulary notes for the orchestrator.**
- `shows-deliverable` legibility has no stated rule for **video**: the rendered size of
  a click-to-play embed, whether the player's own fullscreen counts as "page size", and
  how long an entry must stay on screen (this one is visible for about 1s of 63).
- `typewriter-headline`'s "product panel" is undefined. An auto-advancing **labelled**
  tab set (every phrase on screen as a tab label) and a typewriter that hides its
  alternatives fire the same value under the neuron-industries precedent.
- `ladder.cjs` drops nodes with fewer than 3 direct characters, so a headline split
  into per-letter spans (common in letter-reveal intros) vanishes from the ladder. It
  did not change a value here, but on a page whose only display type is split that way
  it would report a false low ratio.
- `generic-sans-default` and `custom-type-pairing` co-fire on every serif-over-Inter
  page (financial-datasets, railway-com, now sona8) and cancel in the net. That may be
  right, but it means a serif display over stock Inter body is currently invisible to
  the verdict.

**Superseded study (2026-10-13, verdict `mixed`).** Everything below describes the page as it was before the redesign that forced the re-study above, and is kept as the record of that page. Its signal values, which the front-matter no longer carries:

```
gradient-blob: absent
three-card-row: present
glass-card-overuse: absent
emoji-as-icon: absent
generic-sans-default: absent
symmetric-everything: absent
badge-pill-spam: absent
generic-line-icon-set: absent
testimonial-card-row: unresolved
indigo-violet-accent: present
gradient-fill-cta: absent
scroll-reveal-blank: unresolved
typewriter-headline: absent
stock-photo-generic: absent
centered-hero-stack: absent
hero-mockup-float: present
asymmetric-split: present
single-optical-anchor: absent
type-scale-high-contrast: present
editorial-grid-break: present
custom-type-pairing: present
real-product-surface: present
shows-deliverable: present
density-variation: present
one-accent-discipline: present
live-claim-control: absent
```

Viewport only; below-fold unresolved.

"Good strategy starts with listening." sits top-left at roughly 68px in a
high-contrast didone serif against 16px sans body, close to 4:1 and two
voices used deliberately. A thin rule grid with visible crosshair marks at
the column intersections runs behind the content, and the nav sits in its
own boxed cell outside that grid, which is `editorial-grid-break`.

The right half floats a real product capture (a Rheinfeld Automotive
interview view with a sidebar, a transcript column and a participant
thumbnail) over a dotted violet halftone field, with a 1:43 runtime and a
"See how it works" label. `hero-mockup-float` and `real-product-screenshot`
both fire: it is a genuine screenshot, floated.

`indigo-violet-accent` is present on a flat violet CTA and the halftone,
with no gradient, which is the split v3 introduced working again. Below the
fold a ten-mark greyscale logo wall under "TRUSTED BY 20+ WINNING TEAMS",
then a three-up explainer row.

**v4 hole-7 deliverable re-pass**

Front-matter `shows-deliverable` left at `absent`: the live page is a
redesign of the studied one, so the studied-page rule forbids changing it.
Independent rating of the studied page is `present` (entry below); the live
page rates `absent`. Queued for the orchestrator to decide.

Capture (live, 2026-10-16): reused `~/scratch/antislop/s5/sona8`, 10 tiles,
`clamped: false`, coverage 1.0, `docH_before` = `docH_after` = 6649, stitched
to 2 strips at 6649px. The last strip ends in the footer ("© 2026 Sona8",
"SOC 2 compliant, certification in progress"). A cookie card overlays the
right edge of every tile; the DOM was read with Playwright to cover it.

Studied-page check: REDESIGNED. The original viewport shot
(`~/scratch/antislop/shots/sona8.png`, 2026-10-13 14:10) matches this file's
prose: "Good strategy starts with listening.", nav Home / Solutions / How it
works / Research, a floated Tella card showing Rheinfeld Automotive at 1:43,
"See how it works" 1:37, "TRUSTED BY 20+ WINNING TEAMS", and the tab row
"Sona8 interviews your people / Every answer is coded / You read the..." at
the fold. The Wayback snapshot 20261009203413 (bundle `index-BlzPeH7k.js`,
archived 20261009204102) is the same Vite SPA and carries all of it. No
capture exists between 2026-10-10 and 2026-10-16. The live page is now a
Next.js build with a replaced hero ("Interview your whole company in days."
over two portrait photos), "WORKING WITH 20+ ORGANISATIONS", a new video
("See Sona8 in a minute.", 1:03), a rewritten tab panel, and a new
"Ready to prove your strategy?" band.

Candidates on the STUDIED page:
- Hero video card, right half, y≈342-628 in the 2026-10-13 viewport shot.
  Inside a product capture: Tella `vid_cmud4jgae00110agm4x6bckh0`, 103.47s,
  Tella version 2026-09-22T20:58:46Z (before the studied date; the poster
  frame matches the shot). The walker cannot see it, so frames were pulled
  with ffmpeg. At ≈1:20-1:26 the product's own project page for "How is the
  AI transformation going for you?" reads "1 of 3 · day 1 of 14 · closes 6
  Oct", then under "How the conversations are going": "1 of 1 conversations
  did not reach Current stage of AI adoption within the team." and "The
  brief is fixed while the question is published. This is information for
  the next question — and, if it keeps happening, a reason to close early"
  (the cursor covers the last character). At ≈1:30 "How long calls run"
  reads "1 timed conversations · median 0 min · mean 0 min". The invitation
  screen earlier in the same video promises "About 15 minutes".
- "How Sona8 works" tab panel, below the fold after the logo wall, page
  canvas, y not measured (the page is gone). From the bundle: a transcript
  ("I could move budget between stores. Now anything over five thousand
  needs three signatures."), a CEO tree, and an insight card "Operating
  model 2027 / Insight", "38 of 41 asked, example", with bars "Approvals
  slower" 24 of 38, "Room to decide locally" 16, "Stopped asking" 9, "Not
  heard of it" 4. Every bad number is the client's. 38 of 41 is a
  participation figure that flatters by being larger, and it beats the
  vendor's own published "87.5% participation rate". Nothing counts
  against the vendor.
- "Organizations miss critical signals because they cannot listen at
  scale." degree diagram: a problem framing about organisations, no product
  output.

Entry that could have embarrassed the vendor (studied page): "1 of 1
conversations did not reach Current stage of AI adoption within the team."
The product's own dashboard says the only interview missed the theme it
was briefed on, beside a 0-minute median against a promised 15 minutes and
1 of 3 finished. A clean demo would have shown a full, on-brief interview.
Per the audit rule this is scored on what it says, not on being a staged
test; it is browserbase's missing `Failed` row, present. That makes the
studied page `present`.

Candidates on the LIVE page (none credited):
- Hero portraits y≈604-1057, page canvas, interview quotes: "“Give sales
  teams earlier visibility into product changes.”" (GRACE, SENIOR SALES
  MANAGER), "“We often hear what's changed from customers first.”" (DANIEL,
  VP MARKETING). The client's problems, not the vendor's.
- Video y 1219-1677, product capture, Tella `vid_cmv3cxred005t06kz7rgje8ce`,
  63.06s, sampled every 4s: "Moving to the central warehouse", "18 of 19
  finished", "Closes in 11 days", "5 things recur", employee statements
  such as "“Will I lose my job?”". All bad news is the client's; 18 of 19
  flatters.
- Tab panel y 1825 (h 380), page canvas: three dot grids, aria-labels "A
  grid of 36 people, seven of them in an interview", "A grid of 36 people;
  12 of them said something that belongs to the same theme", "The same 12
  of 36 people, counted together as one theme". "Ten agents code each
  statement, and a theme counts when six of them agree." is body copy
  selling a method, not an artefact.
- Degree diagram y 2277, testimonials y 3075, quote ticker y 3834
  ("“One week of interviews changed the order of our rollout.”"): flattering
  or about the client.
- Footer y 5859 "SOC 2 compliant, certification in progress": a concession
  in footer prose, not in an artefact (the deepmark exclusion).

**Orchestrator ruling on the re-pass above — `shows-deliverable` set to
`present` on the studied page.** The rule: a re-pass re-interprets the page as
studied. The studied page's hero video was on that page: its poster matches
the 2026-10-13 viewport shot, the file was last edited 2026-09-22, and the
Wayback snapshot `20261009203413` shows the old site. At about 1:20 the
product's own dashboard reports "1 of 1 conversations did not reach Current
stage of AI adoption within the team", with a median of 0 minutes against the
invite's "About 15 minutes". That is the product missing its own brief, which
is the entry the procedure asks for. The original study never saw it because
it rated the viewport only and the video plays on click. This is a capture-miss
correction, the stripe-2014 case, not a flip to a different page.

**Queued: a full re-study of sona8.** The live page is a redesign (new
framework, hero, video and tab panel), and on that page the re-pass found no
entry.

**Orchestrator correction to the 2026-10-16 hole-7 ruling in the superseded
study above.** That ruling credited the studied page with `shows-deliverable:
present`, on "1 of 1 conversations did not reach…" inside its click-to-play
hero video, **without checking how large that line rendered on the page**. The
legibility rule (an entry counts only if readable at page size, in CSS px) was
settled later the same day, on basecamp-2014, and was never applied back to
this file. The re-study above shows why it matters: the current page's
equivalent line, "58 of 203 statements fit none of the 5 themes.", renders at
about 4px in a 558px inline player and fails. So the old credit is unverified,
not established. It no longer carries any value, because the front-matter now
rates the redesigned page, but it should not be cited as a passing example.
