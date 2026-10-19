---
source: https://onlytraction.com/
kind: site
cohort: ai-builder
verdict: mixed
studied: 2026-10-19
context: [nav, hero, stats, features, cta, faq, footer, pricing]
signals:
  gradient-blob: absent
  three-card-row: present
  glass-card-overuse: absent
  emoji-as-icon: present
  generic-sans-default: present
  symmetric-everything: absent
  badge-pill-spam: absent
  generic-line-icon-set: absent
  testimonial-card-row: absent
  indigo-violet-accent: present
  gradient-fill-cta: absent
  scroll-reveal-blank: absent
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: absent
  hero-mockup-float: absent
  asymmetric-split: absent
  single-optical-anchor: present
  type-scale-high-contrast: present
  editorial-grid-break: absent
  custom-type-pairing: present
  real-product-surface: present
  shows-deliverable: absent
  density-variation: present
  one-accent-discipline: absent
  live-claim-control: absent
materials: [single-theme]
---

**Sampling: random draw.** One of twelve drawn with seed 20261019 from the twenty-two gallery sites left after the first draw (same pre-stated exclusions). `gunsvzombies`, drawn first, returned 404 (project deleted) and was replaced from the same seed by `openmark`. Not chosen on any signal.

Rated by two independent blind raters on 2026-10-19, neither reading the other's draft. Both reached `mixed`. They agreed on 26 of 26 signals. Both write-ups follow in full.

**Rater A.**

New-page blind rating, rater A. There is no prior study, so there is no drift section.

**Capture.** 1440x900 viewport. `docH` 11168 before and after the walk, scroller `window`, 16 tiles, `clamped: false`, `coverage: 1`, last landing 10268 (= 11168 - 900). Stitched to 3 strips (4400 + 4200 + 2568 = 11168), stitcher drift 0. The last strip ends in the footer, the coral band "Traction · Find your one working channel. · © 2026 Traction. All rights reserved." at y11088-11168. Tiles are in `~/scratch/antislop/s5/onlytraction-A/`, strips in `s5strips/onlytraction-A-strip0..2.png`, probes in `s5work/onlytraction/raterA/`. The hero animates (19 `bm-chip` elements on a 10s `bmChip` loop plus one `bmTag` label), so it was read in the DOM as well as in the strip. Exact values below come from the DOM, not from pixels.

The page is neo-brutalist. Cream `rgb(250,249,246)` ground, ink `rgb(26,26,26)`, 0px radius on 323 of 343 block elements (8px on the 12 FAQ triggers, full-round on 8), 3px ink borders, hard offset shadows (`6px 6px 0 #1A1A1A`; coral `5px` on the step cards; `#A37AE6` on the AI cards), halftone dot textures on the dark bands. It is a Vite SPA: one 2.67MB `index-*.js` carries both the landing page and the logged-in app, which is what made the product checks below possible.

## Slop signals present (4)

**`three-card-row`.** "Three steps. On repeat." sets three cards at y1245, x168 / 544 / 920. Each is 352x229 with the same cream fill, the same 3px ink border and the same 5px coral offset shadow, headed `01 Map`, `02 Test`, `03 Double down` with a trailing arrow. It is the page's only 3-up: the AI co-pilot band is a 2x2 of 540px cards, and the stats band is four figures.

**`emoji-as-icon`, one instance in chrome.** The AI band's eyebrow, `✨ AI CO-PILOT PRO`, 170x32 at (635, 2704), violet fill, 11px Inter. CDP `CSS.getPlatformFontsForNode` returns Inter 15 glyphs and **Apple Color Emoji 1 glyph**. Sparkles stands in an icon slot and says "AI", which the label beside it already says. One instance is enough on toolsapp-work's precedent. The page's other 93 emoji text nodes all sit inside product depictions and are scoped out:
- the hero board's 19 channel chips (the app's own channel icons, see `real-product-surface`);
- `✨ Sharpen / ⚡ Autofill / 🎯 Suggest` (the bundle has the app's own `{icon:'✨',label:'Sharpen'}` array);
- `🚀 Growing` (the app's growth-verdict generator emits 🚀 / 📈 / ➖);
- the extension panel's directory favicons (🅿️ 🔴 🛡️ 🅕 🌀 ⚒️) and the event row's 📍 💰.

The 40 `✓` (U+2713, Inter, 14px, coral) are list bullets. The `★` (U+2605) on "Lifetime access" and "Inner Ring ★" is a text dingbat. Neither is emoji.

**`generic-sans-default`.** Body is Inter 16px, with `letter-spacing: normal` on every sampled `p`. Inter is a loaded webfont (CDP `Inter-Regular`, `isCustomFont: true`) and carries 691 of 756 visible text-bearing elements, against Fraunces 62 and ui-monospace 3. Inter body at default tracking under a chosen display serif is present on the financial-datasets / railway-com / sakura-name-sparkle reading.

**`indigo-violet-accent`.** `rgb(163,122,230)` / `#A37AE6`: hue 263°, chroma 108. It fills the "Unlock Pro — one payment, yours for life" button (54px tall, 3px cream border, a primary-weight CTA), the -1° highlight block behind "with a co-pilot." (361x66), the eyebrow and four `PRO` tags. It also colours the AI cards' 6px offset shadows, and `rgb(133,86,204)` (hue 264°) is the text colour on 5 nodes. The violet is confined to the AI band (y2589-3828, 1239px, 11% of the page), a secondary accent coding "AI / Pro". The signal is the hue in any fill, and here it fills a CTA.

## Craft signals present (5)

**`single-optical-anchor`: rule-ineligible and undefined; my honest call is present.** The anchor counted is the -2° coral block on "guessing" (323x95), inside the 72px Fraunces H1 (564x235 at x168). This is **not** a case of one mass dominating because it is the only mass. There is a second mass, the hero board (492x480 at x780), but it is drawn in 2px dashed rings at 20% and 35% ink alpha with 10-11px chips, so the headline dominates by contrast. The coral CTA (66px tall) and the bullseye's coral centre are subordinate echoes. I scored the hero. Page-wide the same device returns once per band (rotated highlight blocks on "with a co-pilot." and "everywhere.", both -1°).

**`type-scale-high-contrast`.** `ladder.cjs` gives a ratio of **4.5** (72px over 16px body), with `ratioSub` 3.6 against the 20px subhead. That clears 3.75. The ladder runs 72 / 48 / 36 / 30 / 24 / 18 / 16 / 14 / 12 / 11 / 10 / 9. On sufficiency: the H1 is a real display setting (Fraunces 700 at optical size 48, CDP `Fraunces-Regular_opsz480000_wght2BC0000`), and the section H2s hold at 48px (3:1).

**`custom-type-pairing`.** Fraunces is loaded as a variable face (`100 900`). It sets all 62 display nodes at weight 700 with the optical-size axis in use (opsz 48 on the H1, 18 on the small serif): the H1, the H2s, the feature H3s, the step numerals, the 48px stat figures, the panel figures (`$12,940`, `57 / 187`), the wordmark and the 18px FAQ questions. Inter sets UI and body. Each face has one job. Fraunces with Inter is a common pairing. It is scored present the way permit-guide-ai's Plus Jakarta with Inter was, and here the serif also carries the numerals and uses its opsz axis.

**`real-product-surface`: present on a bundle comparison. This is the most contestable craft call.** The hero board rebuilds the app's real Bullseye board. I checked it against the app code shipped in the same bundle:
- The landing component draws three concentric rings, `2px dashed rgba(26,26,26,.2)` and `.35`, with inner fill `rgba(255,107,53,0.08)` and a coral centre. The app's board component (copy: `Drag channels between rings. Inner ring = your top 3 to test.`) is an `aspect-square max-w-[700px]` field with `border-dashed border-ink/20`, `/30` and `border-coral/50` rings around a `rounded-full bg-coral border-2 border-ink` centre.
- App chips render `{icon} {name}` with `shadow-[2px_2px_0_#1A1A1A]`, and so do the hero's.
- 18 of the hero's 19 icons match the app's channel catalogue (`Gu`) exactly. The exception is Tradeshows: 🎟️ in the hero, 🎪 in the app, where 🎪 is also Unconventional PR's icon.
- Doorway rule: it shows channels sorted onto rings with three inner bets. That is the product in use, not a sign-in or install step.

The panels further down are page-authored in the app's design tokens and use the app's labels (`Fill all fields`, `✓ Stripe connected`, To do / Skipped, Inner ring). Two of them diverge from the app, so the call does **not** rest on the panels:
- The growth panel's `🚀 Growing — keep pouring in` is not a string the app's generator can emit (`🚀 Growing fast (+N%/wk)`, `📈 Growing (+N%/wk)`, `➖ Flat — time to try a new channel`).
- The "Narrow 19 channels" panel draws the board as three labelled rows, which the concentric app board is not. That panel is stylised.

The "Add to Chrome" button under the extension panel links to a Web Store listing titled "Traction Time Tracker" ("time tracker for founders — splits your week into Product vs Marketing time", v0.1.1, updated June 4, 2026). That describes a different function from the directory side panel the page shows, and I could not check the panel against a capture. Invented data (`Project: SeoTalos`, `$12,940`) is not this signal's question.

**`density-variation`.** Text characters per 100px of section height: FAQ 37, stats band 62, plan card 63, "One board" intro 64, founder letter 91, hero 97, How it works 118, AI band 133, 04 growth 139, 01 board 145, Get listed 145, 03 playbooks 167, 02 tactics 190. That is a 5.1x spread, against glowcase's 4.4x `present`. The panels set 9-11px UI against 48px headings, and sparse centred intros alternate with dense split bands. Caveat: the four `01`-`04` feature bands are one template (number, label, `BEST FOR:` tag, 36px H3, paragraph, five `✓` bullets, 520px panel), all 570-659px tall and all 139-190 chars/100px.

## Near-misses

- **`hero-mockup-float` → absent.** The hero's right half is a product rebuild, but it has no frame: no window chrome, border, shadow or tilt, and the rings are drawn on the hero's own cream ground. Reading it as a floating mockup raises net by 1.
- **`generic-line-icon-set` → absent.** There are 14 visible SVGs. 12 are Lucide `chevron-down` at 16px, stroke 2, on the FAQ triggers. They hide on expand (`group-aria-expanded/accordion-trigger:hidden`), so they carry disclosure state the heading does not; that is sentient-os's FAQ-expander ruling. The other two are an 18px glyph on the Chrome button and the 446x80 growth line. There is no feature icon set: the step cards and AI cards use numerals. The 40 `✓` are text bullets. Reading them as an icon set raises net by 1.
- **`symmetric-everything` → absent.** `symmetry.cjs` finds 6 of 8 h1/h2 centred, **0.75**, under the 0.85 cut. The two left-aligned headings are the hero H1 and "Then get listed everywhere."
- **`asymmetric-split` → absent.** In the hero the text column is 564px (`lg:max-w-[55%]`) against a 492px board column, 1.15:1. The five body splits are exactly 520/520, alternating sides. Alternating sides is not asymmetry, and precedent holds a 1.05:1 hero absent.
- **`badge-pill-spam` → absent.** Above the fold there is one decorative tag ("THE BULLSEYE METHOD, AS SOFTWARE", square, ink fill), and the hero board's chips are product surface. Below the fold the page labels heavily: about 14 square tags (HOW IT WORKS, INSIDE THE APP, four `BEST FOR:`, AI CO-PILOT, five `PRO`, GET LISTED, the "Lifetime access" sticker). They are below the fold and none is a pill.
- **`one-accent-discipline` → absent.** Coral `rgb(255,107,53)` is the primary accent (25 fills, 70 text nodes). Violet is a second accent in chrome (see above), and lime `rgb(200,245,0)` fills the rotated "★ Lifetime access" sticker. Green and red (`WON` / `KILLED`, `dofollow`) are data colour inside panels and are scoped out.
- **`shows-deliverable` → absent.** Naming the entry that could have embarrassed the vendor, the only candidate is `Cold email niche newsletters · KILLED · Result: 0`. It is excluded: the band's own bullet sells "Win, kill, or continue verdict on every test", so catching a dead experiment is the pitch (the papaya / linear-app rule), and the failure belongs to the user's experiment, not to Traction. Everything else flatters: `62% · on track for Dec`, `🚀 Growing`, `✓ real` twice, `57 / 187`, `4 / 44 done`. The app's own code has a `failed` submission status with `Skipped — missing: …` messages, and the extension panel shows none of them. The FAQ "What about CAPTCHAs, accounts, and submissions that fail?" is closed-accordion prose outside the artefact. The stats band (19 / 900+ / 44 / 1,500+) is vendor-aggregate.
- **`scroll-reveal-blank` → absent, on a clean dwell control.** On a fresh load with no scrolling, 300 lettered strings are visible at 8s and 299 at 20s. On a second fresh load, a scroll walk in 450px steps (11.5s) sees 300. Only one string is seen solely while scrolling, `✨ Mapped by AI · 3 inner bets`, and that is the hero board's timed `bmTag` keyframe, not a scroll gate. The panels' `animate-[slideUp_0.5s_ease-out_both]` runs on load and finishes without any scroll. A first control was contaminated by a pre-walk and was discarded.
- **`typewriter-headline` → absent.** The H1 is static. The hero board loops chips into rings every 10s and fades one fixed label in and out. That is motion, not cycling phrases.
- **`emoji-as-icon` itself** rests on one chrome instance. If the hero board were ruled marketing illustration instead of product surface, its 19 emoji would join that instance. The value is the same either way.
- **The rest.** `gradient-blob` absent: all 8 `radial-gradient`s are halftone dot textures (1.5-2px dots). `glass-card-overuse` absent: one `backdrop-filter`, on the sticky nav (`blur(8px)`). `editorial-grid-break` absent: everything sits in the 1104px box (x168-1272); the only rotations are three word-scale highlight blocks (-2°, -1°, -1°) and the sticker, and the only overhang is one animated hero chip 4px past the container. `live-claim-control` absent: there are zero `input` / `select` / `textarea` elements, the AI card's "Generate" is a `div`, and the DR checker lives off-page at `/free-dr-checker`. `testimonial-card-row` absent: there are no testimonials, only a "Drop a 30-second testimonial" request band (senja.io) and a founder letter.
- **Context.** The "Everything you need to find traction" card is a plan summary ("★ Lifetime access", "Unlimited lifetime access per website") with no price, so it is recorded as `cta`, not `pricing`.

## Verdict: `mixed`, net -1

4 slop present (`three-card-row`, `emoji-as-icon`, `generic-sans-default`, `indigo-violet-accent`) minus 5 craft present (`single-optical-anchor`, `type-scale-high-contrast`, `custom-type-pairing`, `real-product-surface`, `density-variation`) gives **-1**, inside the mixed band (-6..+3).

The verdict does not depend on the judgement calls. With the two most contestable craft values absent (`single-optical-anchor`, which is rule-ineligible, and `real-product-surface`, which rests on a bundle comparison), net is +1. Flip both slop near-misses (`hero-mockup-float`, `generic-line-icon-set`) to present as well and net is +3. That is level with deepmark and stripe-2014 and never reaches +4, so `slop` is out of reach on any reading I could defend. It is not `exemplar` either: there is no asymmetric split, no grid break, no deliverable that could cost the vendor and no live control. At 11168px tall the signals had room to fire, so this is not a thin page scoring well by default.

What the page is: template furniture (a 3-step card row, an Inter body, an AI section that switches to violet under a sparkles eyebrow) in a committed brutalist skin, over a real type system (Fraunces with its opsz axis against Inter) and a hero that rebuilds the actual product board. Nothing measured here depends on the page coming from an AI site builder, and the bundle carries no generator mark.

**Rater B.**

Rater B, blind. I did not open any other rater's draft or capture.

**Capture.** Viewport 1440x900, walked cold on 2026-10-19 into
`~/scratch/antislop/s5/onlytraction-B`: 16 tiles, `clamped: false`,
`coverage: 1`, scroller `window`, no inner scroller, `docH_before` =
`docH_after` = 11168. Stitched to three strips (1440x4400, 1440x4200,
1440x2568), 0px drift against the page. The last strip ends in the footer:
"Find your one working channel.", the five-column directory/guide link bank,
the badge row, then the orange bar with "© 2026 Traction. All rights
reserved." Not a thin page: 11168px, 12 `<section>`s before the FAQ.

**Known silent failure hit: animated hero.** The walker disables animation, and
the strip shows the hero bullseye with all 19 channel chips stacked at the
centre (only "Existing Platforms" legible). In the DOM they are
`.bm-chip absolute` elements on `animation: bmChip … infinite`. The page's own
`prefers-reduced-motion` rule sets them to `transform: translate(var(--ex),
var(--ey)); opacity: 1`, which is a clean definition of rest. With animation
running, 19 chips are visible at opacity 1 at 0, 1.5, 5.5 and 11.5s, placed
around a ring measured at x830-1222, y204-597, chips spanning y205-590. Every
hero reading below is from that at-rest state (screenshot
`s5work/onlytraction/hero-rest-11s.png`), not from the strip. A second,
hidden chip set (the sub-`lg` variant) is in the DOM at size 0 and is ignored.

**The page.** A paid founder tool: a Bullseye-framework board plus directory
auto-submission, on a single Vite bundle (`/assets/index-CRcJzuR-.js`,
2,666,948 bytes, 16 `/app/*` routes). The idiom is retro print: cream
`rgb(250,249,246)` paper, 3px ink rules, halftone dot fields, square corners,
hard 3-8px offset shadows, orange `rgb(255,107,53)` as the lead hue, Fraunces
display over Inter body.

### Slop signals present (4)

**`three-card-row`.** "Three steps. On repeat." is three cards, 352x229 each,
at x168, 544 and 920, same 3px border and offset shadow, h3s all at y1277
(01 Map / 02 Test / 03 Double down). A step sequence, but the form is the
signal's form and nothing breaks the three.

**`emoji-as-icon`.** In marketing chrome, emoji serve as icons in three
places. (1) The 19 hero chips each lead with an emoji glyph in front of the
channel name: 🎤 Speaking, 🦠 Viral, 📍 Offline Events, 🤝 Biz Dev,
✍️ Content, 🎪 Unconventional PR, 👥 Community, 🎟️ Tradeshows, 📰 PR,
🛠️ Eng. as Marketing, 🔍 SEM, 🏪 Existing Platforms, 🌱 SEO, 📧 Email,
🎯 Targeting Blogs, 📱 Social Ads, 🔗 Affiliate, 💼 Sales, 📺 Offline Ads.
(2) The ✨ on the hero's "MAPPED BY AI · 3 INNER BETS" tag (y473). (3) The ✨ on
the "AI Co-pilot · Pro" section eyebrow (y2704). Computed font on each parent
is `Inter, system-ui, sans-serif`, so the glyph falls through to the system
colour-emoji face. This is not monospace terminal output.
Emoji inside the product mocks are out of scope and are not counted: ✨ ⚡ 🎯
on the Sharpen/Autofill/Suggest buttons (y3173), 📍 💰 in the event row
(y3506), 🚀 in the Stripe widget (y5204), and 🅿️ 🔴 🛡️ 🌀 ⚒️ on the directory
rows (y6056-6350).
The scope question is settled below under near-misses.

**`generic-sans-default`.** Body computes to `Inter, system-ui, sans-serif`
at 16px, `letter-spacing: normal`. Every sampled paragraph (20, 18, 15, 15,
15, 14px) is Inter at normal tracking. `document.fonts` loaded only Fraunces
100-900 and Inter 400/500/600/700. I follow corpus precedent: railway-com and
linear-app are `present` on an Inter body, and deepmark on a Geist body, even
though each also has a separate display face. railway-com's prose names the
absence of a per-size tracking table as the deciding detail, and there is none
here either.

**`indigo-violet-accent`.** A second chrome hue: `rgb(163,122,230)` (#A37AE6,
hue ≈263°, chroma 108) and its text tone `rgb(133,86,204)` (hue ≈264°). Where it
appears in chrome:
- the "✨ AI Co-pilot · Pro" eyebrow (y2704);
- the rotated highlight on `with a co-pilot.` inside the section H2 (y2748,
  `-rotate-1`);
- the offset shadows on all four AI feature cards;
- their 01-04 numerals and four "Pro" tags;
- the primary button "Unlock Pro — one payment, yours for life" (y3659);
- the hero's "MAPPED BY AI" tag (y473).
Three more uses sit inside the cards' mini-UIs (a "Generate" button, a
"Community" chip and a "Conference" tag) and are not counted. A violet primary
CTA and a violet heading highlight are chrome by any reading.

### Craft signals present (5)

**`single-optical-anchor`.** This signal is rule-ineligible and undefined, so
it is recorded as my call. The anchor I counted is the H1 block, "Stop
guessing which marketing works.", in Fraunces 72px. It fills a 564x234 box at
x168-732, y198-432, and an orange block behind "guessing" puts the page's most
saturated mass inside it.

The first viewport also holds two secondary masses. The bullseye diagram
fills about 470x400 at right, but it is drawn in dashed grey rings and 19
chips of 10-11px text. The black stats band starts at y716 and carries four
48px orange numerals. Neither competes with the H1 on weight. So this is not
"one mass dominates because there is only one mass": there are three, and one
wins. I hold it softly (see near-misses).

**`type-scale-high-contrast`.** `ladder.cjs` gives ratio 4.5: the largest
lettered node is 72px (H1, Fraunces) and body is 16px. That clears the 3.75
cut. All section H2s are 48px and the block H3s 36px.

**`custom-type-pairing`.** Two faces, each assigned a role. Fraunces (serif,
variable 100-900) carries every h1/h2/h3 from 24 to 72px plus the 48px stat
numerals. Inter carries all body copy, the 11-12px uppercase eyebrows and the
16px FAQ question h3s. This is the same construction deepmark and railway-com
hold `present`. The only mono text is "Auto-submitting / 4 / 44 done" inside
the extension mock, which is out of scope.

**`real-product-surface`.** This is the softest craft call, and I am
recording the instrument used. Five product visuals appear, all page-authored
JSX with no screenshots: the page has 8 `<img>` (two extension icons and three
badges, each badge duplicated once hidden), with zero `<canvas>`, `<video>` or
`<iframe>`. The five are:
- the Board card, y2148, 520x282, three ring rows of channel chips, "3 of 19
  channels in play", "Project: SeoTalos →";
- the Tactics library plus experiment cards, y3908;
- a Platforms playbook card, y4574;
- a Stripe growth widget, y5175, showing "$12,940", "MRR $1,240", "Customers
  38", "Signups 512" and "62% · on track for Dec";
- the extension side panel, y5846, 448x588. It has a Submissions/Tracker tab
  pair, "Your list 57 / 187" and "To do 121 / Skipped 9 / Done 57", plus a
  Product Hunt card with "Fill all fields" and rows for G2 DR 91, GoodFirms DR
  86, F6S DR 82, AlternativeTo DR 79 and StackShare DR 79.

Faithfulness was checked the way the referable-dev rater did it, from the
bundle. Every mocked feature has a real route: `/app/board`,
`/app/experiments`, `/app/growth`, `/app/playbooks`, `/app/submit`,
`/app/tactics`, `/app/ai` and `/app/events`. App components also carry the
mocks' own language:
- "Fill all fields" appears 3 times: the mock, a real disabled side-panel
  button with a `[Name, Ozhiaki]` field grid, and onboarding copy ("press Fill
  all fields in the side panel");
- "Stripe connected" is also the `/app/growth` status label;
- the side-panel copy promises "To do / Skipped / Done, in sync with your
  Traction dashboard".

Against that, strings like "keep pouring in", "SeoTalos" and "Outer Ring"
appear once each, so the mock instances are composed for the page. The verdict
is a rebuild in the product's own design system and vocabulary, not an
invented glassy UI and not a doorway. It is weaker than referable-dev's
key-for-key nav match, so it is held softly.

**`density-variation`.** The first twelve sections measure 631, 178, 739, 356,
600, 1239, 659, 570, 623, 885, 1112 and 832px. Formats vary as much as size:
- a 4-up stats strip of eight text nodes;
- a 3-card row and a 2x2 AI grid;
- five text/visual blocks, one single centred feature card and a nine-line
  founder letter;
- a 12-question FAQ stack;
- a 33-link footer bank.
The five 520:520 blocks repeat one rhythm, but the page around them does not.

### Near-misses, and what settled each

- **`emoji-as-icon` scope (the call most worth checking).** Is the hero
  bullseye an embedded product surface, which SCOPE would exclude? The emoji
  are the product's own channel icons: the app's channel model is
  `Gu=[{key:'viral', name:'Viral Marketing', icon:'🦠', …}]`. But the hero is
  a separate hand-authored array (`{label:'Viral', icon:'🦠', ring:'outer'}`),
  rendered as a looping `role="img"` illustration whose aria-label reads "The
  19 traction channels being sorted onto the Bullseye board…". It has no app
  frame, no app chrome and no window, so I read it as hero illustration,
  meaning marketing chrome. Even on the opposite reading, the ✨ on the "AI
  Co-pilot" eyebrow at y2704 is unambiguous chrome. A rater who excludes the
  hero and holds that one sparkle is not an icon practice gets `absent`, net −2.
- **`badge-pill-spam` absent.** Two decorative labels sit above the fold in
  chrome. One is the eyebrow "THE BULLSEYE METHOD, AS SOFTWARE" (11px Inter
  uppercase on `rgb(26,26,26)`). The other is "✨ MAPPED BY AI · 3 INNER BETS"
  (violet fill, 3px offset shadow). That is under the threshold of 3. I did not
  count the 19 hero chips: each is a datum in the diagram, a channel placed in
  the ring that ranks it, not a badge repeating something the copy says. If
  they count, the value is present at 21 and the net is 0. The page's other
  eyebrows ("How it works", "Inside the app", "Get listed", four "Best for: …"
  strips) are all below the fold.
- **`asymmetric-split` absent, measured.** The hero row is 564:492 (1.15:1).
  All five feature blocks are exactly 520:520, mirrored by `flex-row-reverse`
  into a zigzag. Every split is equal or near-equal tracks, which is
  toolsapp-work's reason for `absent`. Present would give net −2.
- **`editorial-grid-break` absent.** Every content rail is `max-w-6xl` at x144,
  1152px wide. The full-bleed ink bands are section backgrounds, not content
  leaving the column. The "★ Lifetime access" sticker overhangs its card by
  19px at right (sticker x869-1051, card x408-1032) and by 29px at top, but it
  stays inside the rail. Two tilted highlights ("guessing", "with a co-pilot.")
  are ornament inside the line. This matches glowcase and referable-dev
  ("everything sits in the container").
- **`one-accent-discipline` absent.** There are three chromatic families on
  chrome:
  - orange `rgb(255,107,53)` (hue ≈16°, chroma 202) is the clear lead: CTAs,
    stat numerals, ✓ bullets, eyebrows and the hero block;
  - violet, as above, including a primary CTA;
  - lime `rgb(200,245,0)` (hue ≈71°, chroma 245) on the "★ Lifetime access"
    sticker.
  A case can be made that violet is a deliberate feature-tier colour for the
  AI line. The lime sticker sits outside that case, and railway-com went
  `absent` on two chrome accents. Present would give net −2.
- **`shows-deliverable` absent, procedure run.** The question is which entry
  inside an artefact could have embarrassed the vendor. The strongest
  candidate is the experiment card "Cold email niche newsletters — KILLED".
  Its hypothesis was "Pitching 20 newsletters will yield 3 features driving
  500+ visits", with "Result: 0", channel Targeting Blogs, set beside "Product
  Hunt launch — WON, Result: 412". It is excluded under WHOSE FAILURE COUNTS:
  the block's own bullet sells "Win, kill, or continue verdict on every test".
  Catching the dead experiment is the pitch, as with papaya's and linear-app's
  customer failures.

  Nothing else in any artefact can embarrass. The extension panel shows no
  failed submission row, though the FAQ says failures are "surfaced in your
  status panel". The Stripe widget is "62% · on track". "Skipped 9" is a user
  choice. The real concessions are in FAQ prose, not in an artefact:
  - "It's built for solo use… We deliberately didn't add collaboration
    features";
  - "We can't afford to bundle unlimited OpenAI calls at $49 lifetime".
  Present would give net −2.
- **`single-optical-anchor` (soft).** A rater who weighs the busy
  20-object diagram and the four-numeral band as co-equal gets `absent`, net 0.
- **`real-product-surface` (soft).** Without a signed-in side-by-side, a rater
  can hold the mocks as page compositions and score `absent`, net 0.
- **`symmetric-everything` absent.** `symmetry.cjs` finds 6 of 8 h1/h2
  centred, share 0.75, under the 0.85 cut. The two left-aligned headings are
  the hero H1 and "Then get listed everywhere."
- **`scroll-reveal-blank` absent, three ways.** At rest, 0 of 439 text nodes
  sit under 8% opacity. After a 6s dwell with no scroll, 0 are hidden and 0
  appeared. Across a 450px-step scroll walk, 0 of 436 nodes crossed from <0.08
  to ≥0.9 opacity. The `animate-[slideUp_0.5s…both]` classes run on load, not
  on scroll.
- **`typewriter-headline` absent.** The H1 is static. The hero chips loop
  (keyframes fade them at 92-100% and restart), but no phrase is substituted,
  and the chip labels never change.
- **`hero-mockup-float` absent.** The hero visual is a diagram with
  `role="img"`, not a device or app window, and it has no perspective or
  float.
- **`glass-card-overuse` absent.** One `backdrop-filter` on the page:
  `blur(8px)` on the sticky header. The threshold is 3.
- **`gradient-blob` and `gradient-fill-cta` absent.** All 8 gradient
  backgrounds are 1.5-2px `radial-gradient(circle…)` halftone dot fields, a
  print texture. Every button is a flat fill.
- **`testimonial-card-row` absent.** No testimonial section exists. That slot
  holds a recruitment band, "Drop a 30-second testimonial. We'll thank you.",
  with three incentive bullets and one button.
- **`generic-line-icon-set` absent.** The only line icons are 12 lucide
  chevrons on the FAQ accordion, which are control glyphs, not a feature-icon
  set.
- **`live-claim-control` absent.** "Check Your DR" goes off-page to
  `/free-dr-checker`. Nothing on the page lets a visitor falsify its own
  numbers (19 / 900+ / 44 / 1,500+).
- **`stock-photo-generic` and `centered-hero-stack` absent.** There are zero
  photographs, and the H1 computes `text-align: start` at x168.
- **Materials.** Under `prefers-color-scheme: dark` the body stays
  `rgb(250,249,246)` and the H1 `rgb(26,26,26)`, so the page is `single-theme`.
  No provenance tokens are recorded, because `shows-deliverable` is absent.

A copy inconsistency, which is not a signal: the AI section says "On our
keys… no token top-ups", while two FAQ answers say the AI features "need your
own OpenAI API key".

### Verdict

**mixed, net −1** (4 slop present, 5 craft present). Slop needs at least +4
and this page is five points short. The plausible flips land between +2 and
−4:
- slop-ward, all three together: pills +1, surface −1 craft, anchor −1 craft;
- craft-ward, each one: emoji, split, accent or deliverable, −2 apiece.

No single flip, and no combination I would defend, reaches +4. It does not
round to exemplar either. Exemplars run −2 to −8, and getting here would take
both the split and accent flips together, plus reading violet as a tier colour
past a lime sticker. Net −1 puts it among the mid-band mixed files: dachly,
puzzlesbox, grep-ai, osseus and basecamp-2014 are all −1.

**What separates it from the +3 mixed files (deepmark, stripe-2014).** Those
two carry 6 slop signals each. deepmark also has badge spam, stock photos, a
centred hero and a floating mockup. stripe-2014 also has a gradient field,
gradient CTAs, a floating device mockup and a line-icon set. This page's 4
slop signals are the quieter kind: an Inter body, a violet second accent,
emoji channel icons and one 3-up step row. It runs none of the
glass/gradient/centred-stack/stock/scroll-gate template. Against that sit a
72px Fraunces display at 4.5:1, a two-face type system and five rebuilt
product panels.

Two decisions miss, and a reader can see both. One is a second and third
chrome hue. The other is an artefact set that never shows the product itself
failing: no failed submission row, though the FAQ promises one.
