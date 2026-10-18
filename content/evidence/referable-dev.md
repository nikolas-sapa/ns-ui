---
source: https://referable.dev/
kind: site
cohort: ai-builder
verdict: mixed
studied: 2026-10-18
context: [hero, nav, features, dashboard, stats, cta, footer]
signals:
  gradient-blob: present
  three-card-row: absent
  glass-card-overuse: present
  emoji-as-icon: absent
  generic-sans-default: absent
  symmetric-everything: absent
  badge-pill-spam: absent
  generic-line-icon-set: present
  testimonial-card-row: absent
  indigo-violet-accent: present
  gradient-fill-cta: absent
  scroll-reveal-blank: present
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: present
  hero-mockup-float: unresolved
  asymmetric-split: present
  single-optical-anchor: unresolved
  type-scale-high-contrast: present
  editorial-grid-break: absent
  custom-type-pairing: absent
  real-product-surface: present
  shows-deliverable: absent
  density-variation: unresolved
  one-accent-discipline: absent
  live-claim-control: absent
materials: [dual-theme]
---

Rated by two independent blind raters on 2026-10-18, neither reading the other's draft. Both reached `mixed`. They agreed on 23 of 26 signals; the 3 splits `hero-mockup-float` (A present, B absent), `single-optical-anchor` (A present, B absent), `density-variation` (A absent, B present) are recorded `unresolved`, which never counts toward a rule. Both write-ups follow in full.

**Rater A.**

New page, rater A, studied 2026-10-18. Referral programs for apps built on
Lovable, and itself built and hosted through Lovable: the served HTML carries a
redirect script for `refer-magic-flow.lovable.app`, and the marketing page and
the product dashboard are one SPA build (`index-BLdZxUMl.js`, `App-C58xUQri.js`,
`styles-EXPfmJpQ.css` are served identically by `referable.dev` and
`app.referable.dev/auth`). That provenance is context, not evidence; every value
below rests on a measurement.

**Capture.** Viewport 1440x900. Page height 4445px (`docH_before` 4445 =
`docH_after` 4445), scroller `window`, 7 tiles, `clamped: false`, `coverage: 1`,
landings exact to 3500 then clamped at 3545. Stitched to 2 strips, 4400 + 45 =
4445px against a 4445px page, zero drift. The last strip ends in the footer
(four columns Product / Platform / Company, "© 2026 Referable. All rights
reserved.", "Made with Referable ..."). No `<video>`, `<iframe>` or `<canvas>`;
seven `<img>`, all the Referable logo or the Lovable heart mark at 14-32px.
Server-rendered `html.dark`, so the walk shows the dark theme; the header toggle
switches to a full light theme (body `oklch(0.982 0.002 85)`, saved to
`localStorage['referable:theme']`), hence `dual-theme`.

Seven sections: centred hero (873px), two image/copy splits (631, 691), an
interactive dashboard demo (1093), a three-figure stat band (241), a closing CTA
card (450), footer (401). No testimonials, no photography, no pricing on the
homepage. A thin page: several signals have nowhere to fire, and that cuts both
ways.

**Slop signals present (7)**

- `gradient-blob`. `.landing-glow`, 1200x720 at y65, four stacked
  `radial-gradient`s (stops `oklch(0.6 0.2 256)` #0c7cf4, `oklch(0.56 0.21 286)`
  #7055e7, `oklch(0.6 0.24 318)` #b83bda, and a fourth) under `filter: blur(64px)`
  at opacity 0.5, over a 4%-white 1px grid. Repeated at 720x380 behind the
  closing CTA (y3611).
- `glass-card-overuse`, exactly at the decided threshold. Three `backdrop-filter`
  surfaces, all over translucent fills: the sticky header (1440x65, `blur(12px)`,
  fill alpha 0.8), the hero eyebrow pill (233x34, `blur(8px)`, alpha 0.8) and the
  hero prompt composer (672x154, `blur(2px)`, alpha 0.95). Present by count. By
  visible frosting it would be 2 at most, and absent: see near-misses.
- `generic-line-icon-set`. Lucide throughout (`class="lucide lucide-*"`, viewBox
  0 0 24 24, `stroke=currentColor`). Two three-item feature lists at 17x17 in
  accent blue: plug / "Connect the Referable MCP", message-square / "Describe your
  referral offer", sparkles / "Launch without building the backend"; link /
  "A unique referral link", gift / "Rewards ... update automatically",
  shield-check / "Fully embedded in your Lovable app". Plus four 14px checks on
  the hero's "No code / Free / No credit card required / Works with your existing
  app" row. One set, one size per list, each glyph restating its line.
- `indigo-violet-accent`. The flat accent is a blue, `oklch(0.57 0.22 263)` =
  #2b6af6, HSL hue 221, which alone would be absent (link blue, as in the
  corpus's #2456D7 ruling). But every display gradient terminates in violet:
  `linear-gradient(to right, #2b6af6, oklch(0.72 0.19 300) = #b884ff, HSL 265)`
  fills the hero's third line "in one prompt. For free." (72px, the largest text
  on the page) and all three 48px stat figures; the glow's second stop is #7055e7
  (HSL 251, 12° from #6366f1). Measured on the hero viewport below the nav: 34.7%
  of pixels are chromatic (chroma ≥ 24), and of those 35.8% fall in HSL 235-270
  and 24.7% in 270-300, so 60.5% indigo-violet against 39.2% blue.
- `scroll-reveal-blank`. 17 `.reveal` containers; at rest the 11 below the fold
  sit at opacity 0, `translateY(18px)`. Dwell control, 12s with no scroll: 918
  visible characters in 35 text nodes (`checkVisibility` with opacity). Walk at
  400px steps, 400ms settle: 3181 characters in 150 nodes. The dwell recovers
  none of the 2263 gated characters (71% of the page's text, including the whole
  dashboard demo), so the gate is scroll, not time. Scrolling back to the top
  re-hides them (918 again): the observer toggles both ways.
- `centered-hero-stack`. Pill, three-line H1 (768px wide at x336, centre 720),
  subhead, prompt composer, CTA pair, check row, all on x=720.
- `hero-mockup-float`. The composer is a stylised UI, not a control: static text
  "Using Referable, create a referral program: ...", a green "Referable MCP
  connected" status chip, and a 40px send disc that is a link to
  `app.referable.dev/auth` (`aria-label="Get started"`). It sits over the glow
  with a 1px border, `backdrop-filter: blur(2px)` and a blue-tinted lift shadow
  `0 18px 48px -24px oklab(0.57 ... / 0.18)`. No tilt. Present on the corpus
  convention that a UI panel lifted over the hero field floats with or without
  tilt (databuddy). It depicts Lovable's composer, not Referable's own product.

**Craft signals present (4)**

- `asymmetric-split`. Both feature sections are two-column grids at
  `602.8px 493.2px` (y1019, visual left) and `493.2px 602.8px` (y1650, visual
  right), 55/45, alternating. Unequal masses, copy against a UI rendering. On the
  corpus precedent this counts (financial-datasets holds present at 575/637).
- `single-optical-anchor`, rule-ineligible and undefined; my honest call. I
  counted six masses in the first viewport and measured their optical weight as
  summed luminance difference from each box's surrounding ring: H1 69.8%,
  composer panel 14.5%, CTA pair 7.0%, subhead 5.5%, check row 1.8%, pill 1.4%.
  The headline outweighs the next mass 4.8 to 1, so one mass dominates, but not
  because it is the only one: the composer is a real second mass and simply
  loses on contrast (mean delta 12.7 against the H1's 36.3). Below the fold no
  single anchor holds (each split pairs a 54px H2 with an equal-width visual; the
  stat band is three equal figures). Scored on the hero.
- `type-scale-high-contrast`. `ladder.cjs`: largest text node 72px (H1, Camera
  Plain 600, leading 1.05) over body 16px = 4.5:1, clear of 3.75. Against the
  18px subhead, 4.0:1. Ladder 72 / 53.6 / 48 / 36 / 25 / 19 / 18 / 16, a real
  display step, not a flat stack.
- `real-product-surface`. The "Interactive demo" (1152x760 at y2513) is a live
  rebuild of the dashboard, not a picture of one. Eight sidebar entries switch
  eight working panels (Overview, Programs, Referrers, Referrals, Rewards,
  Analytics, Connectors, Settings), a recharts area chart, tables "Showing 5
  sample records". Faithfulness from the bundle: the preview component's nav
  array (`bH`) reproduces the live app's sidebar array (`pU`) label for label and
  key for key (Overview, Programs, Referrers, Referrals, Rewards, Analytics, plus
  Connectors and Settings in both), both render through the same shadcn `Button`,
  and the page subtitles ("Follow every introduction ...", "The people helping
  your app grow.", "A clear view of every reward ...") each occur twice in
  `App-C58xUQri.js`, once in the real route and once in the preview. Sample data,
  labelled "SAMPLE WORKSPACE"; a faithful rebuild with invented data is present
  here. Limit: the real dashboard is behind auth, so no pixel comparison.

**Absent, with what settled each**

- `shows-deliverable`: no entry could embarrass the vendor. I read all eight
  demo panels. Every KPI delta is positive (+18.4%, +12.6%, +2.1%, +8.2% vs last
  month), the revenue line rises, the funnel (3,256 / 824 / 178 / 164) is ordinary
  drop-off, and the only non-green states are pipeline stages (`Waiting for
  purchase`, `Signed up`, `Pending`, `Ready`) or a user choice (Partner Program
  `Paused`). The product sells Safe Links against coupon-site leakage; no row
  shows a leaked, blocked, reversed or failed referral or payout. The figures are
  carefully composed (program revenue 12,640 + 8,750 + 3,450 = 24,840, the
  headline revenue; customers 96 + 54 + 28 = 178), which is provenance and does
  not earn the signal. The stat band ("2 min", "$0", "100% of referrals tracked
  end-to-end") is vendor claim. The referral widget's three referrals are Joined
  / Paid / $10 earned. So no provenance tokens are recorded.
- `generic-sans-default`: one face, Camera Plain Variable, self-hosted
  (`CameraPlainVariable-BhPypTEq.woff2`; name table "LovableLabsIncorporated
  Camera Plain Variable", © 2021 Dinamo). A licensed foundry grotesque, not Inter,
  Geist or a system stack, so absent on the corpus's face-identity reading
  (Archivo, ltSuperior absent). DM Sans and Nunito are requested from Google
  Fonts but no landing node renders them (`document.fonts` reports them
  unloaded); the stylesheet scopes them to product-preview classes.
- `custom-type-pairing`: absent for the same reason; one family at every size.
- `symmetric-everything`: two of five marketing headings start-aligned in
  unequal splits; three centred (hero, demo intro, CTA).
- `badge-pill-spam`: one decorative pill above the fold ("Works natively inside
  Lovable"); the green "Referable MCP connected" chip is inside the composer
  mock; the rest are buttons. The check row has no pill chrome. One or two, not
  three.
- `three-card-row`: the stat band is a `272px x3` grid with no card chrome (bare
  `<p>` pairs). The 4-up KPI cards and three program cards are inside the demo
  and out of scope.
- `gradient-fill-cta`: all three primary CTAs are flat `oklch(0.57 0.22 263)`,
  `background-image: none`. The gradient is on text, not buttons.
- `typewriter-headline`: H1, composer text and the Lovable chat mock are
  identical across 3.5-6s samples; the stylesheet's keyframes are `caret-blink`,
  `landing-reveal`, `pulse`, accordion and spinners, none cycling copy.
- `emoji-as-icon`: no emoji codepoints in any text node. The "⌄" (U+2304) in the
  chat mock's "Acme ⌄" is a dropdown glyph inside a UI rendering.
- `one-accent-discipline`: two hues share the emphasis job. Flat blue #2b6af6
  marks CTAs, eyebrows ("Built for existing Lovable apps"), icons and the send
  disc; a blue-to-violet ramp ending at #b884ff marks the H1's emphasised line
  and the stat figures; the logo mark is blue-to-purple; green
  `oklch(0.77 0.15 150)` marks status in marketing chrome too (the hero chip).
- `density-variation`: held absent on SCOPE. Leaf density does swing: the demo
  holds 91 text leaves at 7-11px in 760px, the stat band 6 leaves and 75
  characters in 241px. But all of that density is the dashboard clone's, which
  the page is showing, not deciding. Outside it every band sets 13-18px text on
  the same `py-16 sm:py-20` rhythm; characters per 100px run 26 (CTA) to 94
  (footer), with no ledger, table, small print or code anywhere in chrome.
- `editorial-grid-break`: everything sits in the 1152px `max-w-6xl` container
  at x144. The "REWARD EARNED" toast overhanging the widget's right edge by 73px
  is the floating-notification convention, not a break.
- `live-claim-control`: the central claim is "in one prompt"; the composer is
  not an input and its button routes to sign-in. The demo lets a visitor browse
  sample data; nothing lets them test the claim.
- `testimonial-card-row`, `stock-photo-generic`: no such sections.

**Near-misses, each a value that could go the other way**

- `glass-card-overuse` (present): exactly three, and the third is `blur(2px)`
  under a 95%-opaque fill, which no viewer can see. A visible-frosting reading
  gives 2 and absent, net +2.
- `hero-mockup-float` (present): the floated panel is a chat composer, not a
  product screen or device. A rater who reserves the signal for product
  mockups gets absent, net +2.
- `generic-line-icon-set` (present): the glyphs are 17px list bullets, not
  feature-card heads. Literal definition met; absent on a feature-card reading.
- `single-optical-anchor` (present): undefined. Measured at 69.8% of hero
  optical weight, but a page-level reading finds no anchor below the fold.
  Absent gives net +4.
- `asymmetric-split` (present): 55/45 is the mildest asymmetry the corpus
  credits. A rater requiring a strong split gets absent, net +4.
- `real-product-surface` (present): faithfulness rests on bundle structure and
  shared copy, not a side-by-side with the signed-in app. Absent gives +4.
- `density-variation` (absent): present if the demo's density counts as a page
  decision (the databuddy reading), net +2.
- `generic-sans-default` (absent): the face is the AI builder's own licensed
  brand face, re-served by a Lovable-built site. If Lovable ships it as a
  generated-project default it would be that platform's default sans. Not
  checkable: `lovable.dev` returned a Cloudflare challenge (403). Absent on face
  identity.

**Verdict: `mixed`, net +3** (7 slop, 4 craft).

That sits exactly with deepmark and stripe-2014, the top of the mixed range,
and below openhack (+4). The closest file is stripe-2014: both carry
`gradient-blob`, `indigo-violet-accent`, `generic-line-icon-set` and
`hero-mockup-float` on the slop side and `asymmetric-split` plus
`real-product-surface` on the craft side. So the AI-palette tell this page
plainly has (60.5% of hero chroma in indigo-violet, a four-stop blurred glow,
gradient display text) is not what separates slop from mixed in this corpus;
stripe-2014 has it at +3 too.

Could it be slop? Three single flips reach +4 (`single-optical-anchor`,
`asymmetric-split` or `real-product-surface` to absent). Even at +4 I would not
write `slop`, for a reason a second rater can check: three of the seven slop
presents stand on the edge of their definitions (a glass count of three whose
third surface is invisible, a "mockup" that is a composer, line icons that are
bullets), and the craft count would still be 3 against 2 for both slop files,
whose craft is only `real-product-surface` and `one-accent-discipline`. I cannot
name a property that separates this page from the +3 files, so the verdict is
`mixed`. The spread of plausible nets is +2 to +4 and it centres on +3.

What is measurably true: the page leads with the 2025-26 AI-builder vocabulary
(prompt-box hero, blue-violet glow, gradient headline, scroll-gated reveals on
71% of its text) and backs it with one genuinely good decision, a working
eight-panel rebuild of the real dashboard, but lets that rebuild flatter
without exception, so it shows the surface and never the deliverable.

**Rater B.**

Rater B, blind and independent. New page, no prior study, no drift section.

**Capture.** 1440x900, page height 4445px (docH 4445 before and after the walk),
window scroller (no inner-scroll candidate taller than the document), 7 tiles,
`clamped: false`, `coverage: 1`. Every landing within 8px of its ask; the last asked
4200 and landed 3545, which is max scroll (4445 − 900). Stitched to two strips,
1440x4400 and 1440x45, total 4445 against a 4445 page, stitcher reports OK. The
first strip carries the footer columns and the `© 2026 Referable` line; the 45px
second strip is the foot of the footer's navy field. Exact values below are read from
the DOM with Playwright, not pixels. A thin page: 4445px against a corpus median near
7200, seven bands (hero, chat split, widget split, dashboard demo, stats strip, CTA
card, footer). Testimonials, pricing, photography and a logo wall do not exist here,
so several slop signals are absent by vacancy, not by decision. At 390px wide the page
runs 6125px with zero horizontal overflow.

The build: one Vite/TanStack app serves both `referable.dev` and
`app.referable.dev` (same `styles-EXPfmJpQ.css` hash on both hosts). The root shell
still links Google Fonts for DM Sans and Nunito; all 17 of those faces report
`unloaded` and no text node uses them. Template residue, not a type decision.

**Slop signals present (6)**

- `gradient-blob`. `.landing-glow`, 1200x720 behind the hero, is five stacked
  radial gradients at OKLCH hue 256, 286, 318, 300 and 268 (chroma 0.20 to 0.24,
  alpha 0.75 to 0.95), `filter: blur(64px)`, `opacity: 0.5`. In the strip it reads as
  a blue bloom upper left, violet upper right, magenta bottom centre. The same five
  stops repeat inside the 1024x338 CTA card at y3628. Not a borderline call.
- `glass-card-overuse`, exactly at the threshold, by the decided count. Three
  `backdrop-filter` surfaces: the sticky header (1440x65, `blur(12px)` over
  `bg/0.8`), the hero eyebrow pill "Works natively inside Lovable" (233x34,
  `blur(8px)` over `card/0.8`) and the hero composer card (672x154, `blur(2px)` over
  `card/0.95`). The composer's blur is near invisible at 95% fill; acyclic's
  precedent counts surfaces regardless of what the blur visibly does, and three is
  three.
- `generic-line-icon-set`. Both feature lists carry one Lucide set at 17x17,
  `stroke-width: 2`, `currentColor` = primary blue, each glyph restating its label:
  `plug-2` / "Connect the Referable MCP", `message-square` / "Describe your referral
  offer", `sparkles` / "Launch without building the backend", `link-2` / "A unique
  referral link for every user", `gift` / "Rewards and referral status update
  automatically", `shield-check` / "Fully embedded in your Lovable app". The hero's
  four 14x14 `check` glyphs before "No code / Free / No credit card required / Works
  with your existing app" are the same set and the same emptiness. Lucide's default
  stroke, unaltered.
- `indigo-violet-accent`. The flat accent is not indigo: `--primary`
  `oklch(0.57 0.22 263)` renders `#2b6af6`, HSL hue 221, a blue. The signal fires on
  the gradient type and the bloom. The H1's third line "in one prompt. For free." is
  72px `background-clip: text` over `linear-gradient(to right, oklch(0.57 0.22 263),
  oklch(0.72 0.19 300))`, `#2b6af6` to `#b884ff` (HSL 265, violet). The same gradient
  fills the three 48px stat figures; each sits in a 272px-wide `<p>`, so a short
  figure like "$0" renders from mid-gradient, which is indigo. Add the glow's 286 /
  300 / 318 stops. Resend-com (violet gradient on a heading) and databuddy's
  background bloom are the precedents.
- `scroll-reveal-blank`, settled by the control. Instrument: every element with its
  own text node of 2+ characters, effective opacity taken as the product over all
  ancestors (150 nodes). After a 6s settle at the top, 115 sit under 8%. A walk in
  600px steps (5662ms) took that to 100, 73, 9, 9, 0, 0: all 115 recovered. A dwell
  page waiting the same 5662ms without scrolling recovered 0 of 115. The gate is
  scroll. Mechanism: 17 `.reveal` wrappers. With JavaScript off, 103 of 143 text
  nodes stay hidden. Credit where due: under `prefers-reduced-motion: reduce` the
  count is 0 of 143, so the reduced-motion path is handled.
- `centered-hero-stack`. Pill, three-line H1, 18px subhead, composer card
  (x384 to 1056), CTA pair and check row all sit centred on x=720.

**Craft signals present (4)**

- `asymmetric-split`. Bands 2 and 3 are authored
  `lg:grid-cols-[1.1fr_.9fr]` and `[.9fr_1.1fr]`: 603px against 493px with a 56px
  gap, 1.22:1, sides swapping. Mildest asymmetry I would credit (corpus precedents I
  found run 1.3:1 and 40/60; 50:50 is absent). Flagged below.
- `type-scale-high-contrast`. `ladder.cjs`: largest letter-bearing node 72px (the H1)
  over 16px body computed = **4.5:1**, clear of 3.75. Ladder 72, 53.6, 48, 36, 25,
  19, 18, 16; H1 tracked to −1.8px. At exactly 4.5 the corpus has dipole-labs,
  linear-app and tsenta present; the one 4.5 absent (cursor-com) was decided on the
  retired hero-subhead denominator.
- `real-product-surface`. The "Interactive demo / Explore the sample workspace"
  block (1152x760 at y2531) is live DOM: sidebar, 4 metric tiles, an SVG revenue
  line, a funnel, an activity list, and 8 clickable views (Overview, Programs,
  Referrers, Referrals, Rewards, Analytics, Connectors, Settings), each swapping
  content. Faithfulness, not just liveness: the landing route chunk
  (`routes-YO9SFjgk.js`, 520 bytes) imports `App-C58xUQri.js`, the same chunk the
  authenticated routes render (`/programs` is literally `jsx(App, {view:"programs"})`).
  Inside it the preview's subtitle map and the app's own `page-title-row` header
  carry the same strings, each occurring exactly twice in the 624,241-byte chunk
  ("Create and manage the ways people share your app.", "The people helping your app
  grow.", "Follow every introduction, from first visit to reward.", and the rest).
  Shared view keys, shared copy, shared nav. Limit stated: I did not see the logged-in
  app; faithfulness is inferred from shared source, not a visual diff. The page's
  three other UI depictions fail on their own: the hero composer and the band-2 chat
  card depict Lovable's composer, not Referable, and the band-3 referral widget is a
  stylised rendering.
- `density-variation`. DOM text per band (characters per 100k px², median font size):
  hero 31.9 / 14px, chat split 49.3 / 13px, widget split 59.9 / 12px, demo 44.8 /
  **9px** (623 of its 705 characters at 13px or under, minimum 7px), stats strip
  19.0 / 48px, CTA 15.4 / 16px, footer 61.0 / 14px. A dense 7 to 13px passage set
  between a 48px three-figure strip and a one-line CTA. Pixel ink was useless here:
  the glow field alone puts the hero at 22.8% and the CTA at 18.3% (>40 levels off
  ground). Flagged below on scope.

**Near-misses**

- `hero-mockup-float` → absent. The hero's only UI is the composer card: flat
  (`transform: none`), one soft shadow (`0 18px 48px -24px` primary at 18% alpha), no
  device frame, no tilt. It fakes an input (zero `<input>`/`<textarea>` on the page)
  but reads as a prompt box, not a floated mockup. The page's actual floated mockup,
  the band-2 chat card with a prompt bubble rotated 1.5° under three stacked shadows,
  sits at y1083, outside the hero. A second rater counting the composer as a mockup
  would add +1.
- `glass-card-overuse` → present on exactly 3, one of them a 2px blur at 95% fill.
  If that surface is discounted the value is absent. Decided rule followed.
- `asymmetric-split` → present at 1.22:1. A rater holding a 1.3:1 floor would mark
  it absent.
- `density-variation` → present, but every dense passage lives inside a mock or the
  demo. Marketing chrome on its own repeats one triplet three times (15px blue
  eyebrow, 53.6px heading, 16px paragraph, three icon bullets). I counted it the way
  databuddy's page-authored bento was counted: the density is the page's decision to
  place that block, not the product's internal choice. A strict reading of the SCOPE
  block would mark it absent.
- `one-accent-discipline` → absent. Blue `#2b6af6` does all interactive work (7
  fills, 53 text runs), but the display type's accent line and all three stat figures
  end in violet `#b884ff`, and the bloom adds magenta (hue 318). That is the same
  violet that fires `indigo-violet-accent`; crediting one accent while recording a
  second accent hue would contradict it. Status greens (`oklch(0.72 0.17 150)`,
  "Connected", "$10 earned") sit inside the simulated composer, chat and widget and
  were excluded by scope.
- `symmetric-everything` → absent. Hero, demo heading, stats and CTA are centred on
  x=720 (4 of 7 bands); the two 1.1/.9 splits and the 4-column footer break it.
- `three-card-row` → absent. The stats strip is three 272px cells with no fill,
  border, radius or shadow. The four-up metric tiles are inside the demo.
- `badge-pill-spam` → absent. Decorative pills above the fold: "Works natively
  inside Lovable" and "Referable MCP connected" (inside the composer mock). Two at
  most; the rest are nav and CTA buttons. Section eyebrows are bare text.
- `generic-sans-default` → absent. One face for all 155 text elements, "Camera
  Plain", a variable 100 to 900 woff2 self-hosted from `/assets/`, not a Google or
  system default. Tracking is set at display size (−1.8px at 72px).
- `typewriter-headline` → absent. H1, composer text and band-2 prompt sampled 16
  times over 12s from load: one state.
- `shows-deliverable` → absent. I clicked all 8 demo views looking for the entry
  that could embarrass the vendor and found none. Overview: every delta positive
  (+18.4%, +12.6%, +2.1%, +8.2%), the revenue line ends at its maximum. Programs:
  "Partner Program ... Paused" is the customer's choice, not the product failing.
  Referrals and Rewards: "Waiting for purchase", "Signed up", "Pending" are pipeline
  states. Settings and Connectors: "Lovable and Tremendous connected". The stats
  strip's "100% of referrals tracked end-to-end" is a claim at ceiling, the opposite
  of a refusal. (Aside for hole 8, not scored: "Conversion rate 14.8%" reconciles with
  neither funnel ratio, 178/3,256 = 5.5% or 178/824 = 21.6%.)
- `live-claim-control` → absent. The central claim is "in one prompt"; the composer
  has no input and the demo browses fixed sample data.
- `single-optical-anchor` → absent (rule-ineligible, honest call). In the hero I
  counted three competing masses: the three-line 72px H1 whose last line is the
  page's most saturated object, the 672x154 composer, and the five-blob glow field.
  Page-wide, each band brings its own equal-weight visual (two ~450px mocks, then the
  1152x760 demo). Not a case of one mass dominating because it is the only one.
- `editorial-grid-break` → absent. The tilted prompt bubble (x190) and the "Reward
  earned" toast (to x1297) overhang their mock cards but stay inside the
  1152px container (x144 to 1296). Decorative overlap, no break of the page grid.

**Verdict: mixed. Net +2** (6 slop present − 4 craft present).

The slop side is real and specific: a five-blob blurred bloom, the blue-to-violet
gradient line in the H1, glass by count, a stock Lucide bullet set, centring, and
115 of 150 text nodes held behind scroll. Against it the page ships a faithful,
operable rebuild of its own product with eight views, a 4.5:1 type scale, and a
reduced-motion path that un-gates everything.

Sensitivity, so a second rater can see where it could move: my four flagged calls
(`hero-mockup-float`, `glass-card-overuse`, `asymmetric-split`, `density-variation`)
span net +1 to +5. Even at +4 or +5 I could not write a checkable separation from the
+3 mixed files. Stripe-2014 already carries the same bloom, indigo, icon set and
float; what this page adds over it is scroll-gating and glass-by-count, and against
that it carries a genuinely live product surface. A difference of two soft signals is
not a line another rater can verify. So `mixed` on the measured +2, and it would stay
`mixed` at the top of that range.
