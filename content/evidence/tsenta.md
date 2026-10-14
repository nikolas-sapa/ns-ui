---
source: https://tsenta.com
kind: site
cohort: yc-current
verdict: mixed
studied: 2026-10-14
context: [hero, nav, testimonials, features, pricing, cta, footer]
signals:
  gradient-blob: absent
  three-card-row: present
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: present
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
  real-product-screenshot: present
  artifact-not-dashboard: absent
  density-variation: present
  one-accent-discipline: present
  live-claim-control: absent
materials: [single-theme]
---
AI job-application agent, YC S26. Captured at 1440x900, full page 9326px, 14
tiles at 700px steps with 900ms settle, stitched to three strips (4200 + 4200 +
1600 = 10000px of coverage against a 9326px page). The last tile is the footer,
so the walk is complete. The page is a disciplined near-monochrome that avoids
almost every decorative tell in the vocabulary and also avoids every invention
signal in it, and then gates a third of its prose behind one 3493px scroll pin.
That combination is the finding.

**`scroll-reveal-blank` is present, and it is the largest structural decision on
the page.** A single `div.pin-spacer` sits at y1848 with `offsetHeight` 3493px,
holding a 793px sticky panel — 4.4 viewport-steps of scroll spent advancing one
panel through four states (`01 Find` / `02 Prep` / `03 Apply` / `04 Track`), each
with its own headline, body line and pair of product panels. Walked at 1440x900
in 700px steps, excluding nav/header/footer subtrees, **346 text nodes carrying
5,714 characters cross from under 8% opacity to visible**. A dwell control that
waits the same 14 x 900ms on an unscrolled page crosses **13** nodes, and all
thirteen are the simulated terminal feed inside the first state replaying itself
(`14:16:32`, `stripe.com/jobs`, `Senior Frontend Engineer`, `MATCH`,
`↓ which puts you here:`, `1 new match · Stripe · Senio`). So 333 nodes and
roughly 5,700 characters are gated on scroll position rather than elapsed time,
nine times railway-com's 38 nodes / 564 characters at the same threshold. The
standing count agrees: 46 text nodes sit under 8% opacity at rest and 50 do after
the walk, because the pin reveals one state while re-hiding the last.

One mitigation, measured, because it changes who is harmed: with JavaScript
disabled the page still yields 9,513 characters against 11,088 with it (85.8%)
at a document height of 8456px against 9326px. The copy is in the HTML; it is the
opacity that is scroll-driven. That is a materially better failure mode than
railway-com, where 53% of the text existed only under JS — an agent or a print
render recovers nearly all of this page's text, while a sighted visitor who does
not scroll the pin sees one state of four. The vocabulary cannot currently
distinguish those two defects and scores both under one signal.

**`three-card-row` is present on pricing, not on the 4-up the measurement
advertises.** At y6938 sit three equal 357px cards, each carrying fill, border
and radius (`FBR|FBR|FBR`): Starter $19 / Pro $39, flagged "Most popular" and
inverted to a black fill / Power $99, each with a price, a billing line, one line
of copy, an application quota (600 / 1,500 / 4,500 per 30-day cycle) and its own
CTA. That is the template figure verbatim, and it matches the precedent set by
databuddy (Free / $9.99 / $49.99) and clerk-com. The signal does **not** fire on
the 4-up the probe reports at y637 — four equal 228px cards, each `FBR`. Those
are the job-match cards (Rocket Companies / Stripe / Vercel / Notion at 71% /
60% / 64% / 58%) inside the embedded product dashboard, confirmed in strip0 under
a "Top job matches" label with a "Browse Jobs" link beside it. The scoping rule
that keeps pills out of `badge-pill-spam` when they sit in an embedded product
screenshot applies to card rows by the same logic, and the row is four cards
rather than three in any case. Worth recording as a vocabulary gap: the scope
note is written only against `badge-pill-spam`, so a rater reading the row table
without opening the strip would score this page's product UI.

**`generic-sans-default` is present, and the face count is misleading.** Four
families ship — DM Sans, Century Gothic, Inter, Geist Mono — and the computed
`body` font-family leads with DM Sans. But no node in the 14-entry type ladder
renders in DM Sans. Inter carries the 60px display (`font-weight: 400`,
`letter-spacing: -1.2px`), the 16px subhead, and all six 14px nav items; the
document root class is `inter_a12de46-module__…variable`. Century Gothic appears
only at 16px/600 on the `tsenta` and `Dashboard` labels **inside** the dashboard
clone at y558, and Geist Mono only inside the MCP/CLI transcript at y6396-6486.
Present on the same reading applied to Linear and railway-com: the body face is
Inter, and here so is the display. Body tracking runs `0.1px` at 16px — 0.6% of
the em, effectively normal — so there is no per-size compensation table either.

The craft side:

**`asymmetric-split` present: nothing on the page is centred.** All ten headings
measure `text-align: start`, and so do all fourteen type-ladder nodes. The hero
h1 is an 800px block at x=144 in a 1440 frame, leaving ~500px of the container
vacant to its right; the subhead below it is 640px at the same x. The FAQ at
y7730 pins a 360px 48px heading block at x=168 against a six-row accordion in the
right column. The pinned stage section runs two unequal panels per state, the
left one roughly 560px of dark terminal or résumé-diff against ~230px of stacked
right-hand cards. The dominant content left edge is x=168 (42 elements), with the
hero one step out at x=144 — asymmetric by vacancy, the same mechanism
railway-com uses, with no centred hero to excuse.

**`type-scale-high-contrast` present at 4.5:1.** The ladder is 72 / 60 / 48 / 40
/ 36 / 32 / 28 / 16 / 14px. The closing CTA at y8534 sets 72px over a 16px
eyebrow in the same viewport — 4.5:1, identical to linear-app, which is present.
The hero is the lower bound at 60/16 = 3.75:1, above anthropic-com's 3.8:1-ish
present and well above railway-com's 3.4:1 absent and stripe-com's 3.0:1 absent.
Seven distinct display steps between 28px and 72px is real granularity rather
than one jump.

**`real-product-screenshot` present five times over, and the definition strains
the same way it did on clerk-com.** The hero surface at y543 is
`div.ts-dashboard-clone` — a live DOM re-creation, not a raster capture: a
13-item left rail, an org switcher, a `Search by title, company…` field, the
four match cards, and a five-row applications table with Position / Resume /
Cover Letter / Status / Applied columns carrying named rows (Blue Origin ·
Software Development Engineer II / Linkbee / Atlassian · Senior Frontend Engineer
/ Dremio / Astronomer · Member of Technical Staff) against per-row states
(Submitted / Tailoring résumé / Needs you / Queued) and timestamps. Four more
surfaces follow in the 2x2 at y5597: a web dashboard with pastel match chips, an
iMessage thread ("Found one: Senior Frontend at Stripe, 94% match. Apply?" →
"yes" → "✓ Submitted. You're applicant #4 of 312."), a Chrome extension bar
("Tsenta detected this job. Auto-fill ready · 6 fields detected"), and a
`claude-code` CLI transcript. The content is specific and checkable; the
presentation is a framed panel. `artifact-not-dashboard` is absent by the
construction rule, and here the rule costs nothing — the page is dashboard-shaped
throughout and shows no deliverable.

**`density-variation` present.** The dashboard band y543-1212 runs a five-column
table at 9-12px with status chips, a `47` counter and four match rings in 669px.
The closing CTA band y8456-9000 spends ~540px on one 72px line and one 110x36
button. The stage panels in between carry 10-11px Geist Mono log output. Three
distinct densities, measured.

**`one-accent-discipline` present, and the pixel histogram is actively
misleading here, which is worth more than the signal value.** The probe reports
`satPct: 72.6` with 65.26% of pixels in hue bucket 0, which reads as a page
drowning in one hue. It is not. Sampling the field directly across all three
strips at seven points returns **rgb(253, 252, 252)** at every one. Under the
instrument's HSL saturation formula, `(mx-mn)/(255-|mx+mn-255|)`, that pixel
scores `1/5 = 0.20` — clearing the 0.18 gate by 0.02 — and its hue computes to
exactly 0°, so the entire background field counts as fully saturated red. A pure
grey `rgb(252,252,252)` would score 0 and be excluded; one unit of red bias flips
it. The 65.26% is the page's warm off-white, not a background wash, not an accent
and not the product pastels. **`one-accent-discipline` cannot be read off
`satPct`/`hueBuckets` on any light page and must come from the DOM colour
census.** That census, over every visible element with ≥28 units of channel
spread, finds exactly one non-neutral family in marketing chrome: a coral /
vermilion, `rgb(255, 71, 4)` at full strength on "+1 new", "+3 new" and
"MATCH 92%", and `rgba(217, 95, 25, 0.12-0.30)` as highlight washes and the
active-stage rail outlines and connector lines. Everything else non-neutral sits
inside a simulated product surface — the four pastel match fills
(`rgb(254,243,199)` / `rgb(209,250,229)` / `rgb(255,228,225)` / lavender), the
dark-green brand mark `rgb(21,54,43)`, status greens, ambers and
`rgb(30,64,175)`, and the iOS `rgb(4,71,255)` send bubble — or is a third-party
mark (the YC square at `rgb(251,101,30)`, the eleven greyscale employer logos).
Primary CTAs are flat `rgb(0,0,0)`. By the same exemption modal-com used for its
region-label scale, one accent.

Near-misses, in the order they nearly went the other way:

**`hero-mockup-float` absent, and this is the closest call on the page.** The
probe surfaces a `div` at 1150x669@y544 with `matrix(0.88, 0, 0, 0.88, 0, 0)` and
`box-shadow: rgba(0,0,0,0.4) 0px 0px 1.143px 0px, rgba(0,0,0,0.04) 0px 2px 4px
0px`, which reads as a scaled, shadowed, floating panel. Resolving the two
elements separately settles it. The object the visitor sees is the wrapper
`div.ts-dashboard-clone`: `box-shadow: none`, `transform: none`,
`border-radius: 18px`, a 1px hairline border, `overflow: hidden`, offset
1152x669, left edge **x=144 — the same optical edge as the h1** — spanning 1152
of the 1200px container (96%). The transform and shadow belong to the inner
`.ts-dashboard-clone__card`, authored at 1307x760 and scaled 0.88 to fit that
slot, which clips it. So the scale is a fit, the 0.4-alpha shadow is a 1.143px
edge definition rather than a lift, and the UI is cropped at the frame rather
than shown whole and hovering. That is railway-com's absent profile (shadow none,
transform none, cropped) rather than openhack's present one ("a flat rounded
rectangle floated under a centred hero") — and there is no centred hero here to
float it under. No tilt, no perspective, no bezel anywhere on the page.

**`badge-pill-spam` absent at one decorative pill.** Scanning every element above
y900 with ≥8px radius and a fill or border returns 22 hits, of which 17 are
`inProd: true` inside the dashboard clone (the `Apply` buttons, `Open Tracker`,
`Submit all`, the All / In flight / Needs you / Failed / Skipped filter chips,
`Submitted`, the `47` counter, the search field) and are excluded by scope. The
five in marketing chrome are all `<a>` elements: `Log in` 67x36, `Sign up` 85x36,
`Get started` 110x36, `See how it works` 142x36 — navigation and conversion
controls — and one actual badge, `Backed by Y Combinator` at 197x33@y153. One
decorative pill against a threshold of three.

**`generic-line-icon-set` absent on uniformity, not on glyph identity.** The page
carries 26 SVGs. Thirteen are inside the dashboard clone, two are footer social
marks, five are the platform brand marks in the "Also available on" row at y462
(iMessage / WhatsApp / Claude / Codex / Extension). That leaves four candidates:
13x13 single-path marks at y5763 (x2) and y6241 (x2), the eyebrow glyphs for
`01 — web` / `02 — imessage` / `03 — chrome` / `04 — mcp / cli`. They do restate
their labels, but their `stroke-width` measures 2px, 2px, 1.5px and 0px (filled)
— three values across four marks, so "one stroke" fails — and they sit inline
beside a numbered label at 13px rather than stacked above a feature heading. No
icon appears above any heading anywhere on 9326px, and each of those four
quadrants carries a real product capture rather than a glyph standing in for
absent content. Absent, narrowly.

**`emoji-as-icon` absent; the raw count of eleven is entirely explained.** One
U+2709 and ten U+2713. Three of the checks render in Geist Mono inside the CLI
transcript (`[tsenta-mcp ✓]`, `✓ submitted via greenhouse · 8s`,
`✓ tracker updated · alex_morgan_stripe_v6.pdf`) — captured terminal output by
the stated rule. Seven more are 9px Inter inside the pinned stage panels, serving
as diff-accept markers on the green `+` lines of the résumé rewrite
(`+ Shipped distributed React + TS surfaces…`), and one is 12px Inter inside the
iMessage bubble (`✓ Submitted. You're applicant #4 of 312.`) — message content.
The single U+2709 is 12px Inter at y2537 inside the `03 · REACH — Pinged on every
channel you use` panel, which is the one instance genuinely used as a channel
icon, and it too sits inside a simulated product surface. Not one of the eleven
is a marketing feature icon.

**`custom-type-pairing` absent despite four shipped families**, settled from the
ladder rather than the face list, as above: Inter sets both the 60px display and
the 16px body, and the three other faces never leave a simulated product surface.
There is no second voice in the marketing chrome, which is what the signal names.

**`typewriter-headline` absent.** `heroTextStable: true` and zero `setInterval`
calls. The pinned stage panel does advance through four states, but on scroll
position, not a timer, and the thirteen nodes the dwell control recovers are a
simulated log replaying a process rather than a headline or product panel cycling
phrases.

**`single-optical-anchor` absent.** The first viewport carries two competing
masses: the 60px black headline block at y153-400, and the dashboard clone
starting at y543, which occupies 356 of the remaining 357px of the fold at
1152px wide and holds every saturated pixel on the screen. That is the
hero-copy-plus-screenshot figure, scored absent on openhack for the same reason,
not modal-com's "headline plus one 104x36 pill".

**`testimonial-card-row` absent, not unresolved.** There is no quote section on
9326px. The only social proof is an eleven-mark employer logo wall at y1452-1532
(JPMorgan, Intel, Netflix, Roblox, Cisco, Nvidia, Waymo, HP, Raytheon, Adobe,
Stripe, Airbnb) rendered greyscale, plus a three-mark ATS row at y2126.

**`editorial-grid-break` absent.** Nothing lives outside the content column. The
container is 1200px at x=120; the dominant text left edge is x=168, the hero and
the dashboard share x=144, and the stage rail spans the container rather than the
margin.

**`live-claim-control` absent.** The page's only control set with real state is
the Monthly / Quarterly / Annual pricing toggle (three `<button>`s with
`aria-selected`), which re-prices the three tiers. It changes a number the page
quotes; it does not let a visitor test the central claim that an agent finds and
submits applications. The reference case for this signal is silica's "Press and
hold to apply load" above a force chart, and nothing here is that.

`gradient-blob`, `gradient-fill-cta` and `indigo-violet-accent` are absent on
zero declarations, not on "no visible gradient": the probe finds 0 large
gradients, 0 button gradients and 0 gradient-filled text, the primary CTAs are
flat `rgb(0,0,0)`, and the DOM colour census returns no indigo or violet bucket
in either marketing chrome or product UI — the one blue-violet on the page is the
pale lavender `rgb(232,232,248)` match-card fill inside the dashboard.
`glass-card-overuse` absent at zero `backdrop-filter` surfaces, confirmed twice.
`stock-photo-generic` absent at zero photographs: all 14 `<img>` elements are
logos (eleven employer SVGs, three ATS webp marks). `centered-hero-stack` absent
at 0 of 14 ladder nodes and 0 of 10 headings centred. `symmetric-everything`
absent on the same measurement. Single theme: zero `prefers-color-scheme` rules
and zero dark-mode class hooks.

**On the capture, since two of the brief's failure modes were live candidates
here.** The inner-scroll probe had flagged
`section.ts-section>div.ts-container>div.pin-spacer>div` at scrollHeight 1019 /
clientHeight 793. Re-measured, the `pin-spacer` itself reports
scrollHeight == clientHeight == 3493, so the 226px delta is the sticky panel's
own content overflowing its clip by 226px, not a page living inside a child
element: `documentElement.scrollHeight` is 9326 before and after the walk, and
the walk's last tile is the footer. All four pinned states were captured — strip0
holds `01 Find` twice and `02 Prep` and `03 Apply`, strip1 holds `04 Track`
twice — so no state is missing and no fine re-walk was needed.

**Why `mixed` and not `exemplar` at net −2.** The corpus has exactly two files at
this net, dropbox-2014 (exemplar) and squarespace-2014 (mixed), with identical
2-slop / 4-craft profiles, so the net decides nothing here. This page's five
craft signals are all of the avoid-a-defect kind — not centred, not symmetric,
one accent, real screenshots, a wide type ladder, varied density. Every signal in
the vocabulary that marks invention rather than restraint is absent:
`editorial-grid-break`, `custom-type-pairing`, `artifact-not-dashboard`,
`live-claim-control` and `single-optical-anchor`. Against that it runs the pricing
triplet verbatim, sets display and body in the same Inter, and spends 3493px of
scroll hiding 5,700 characters from anyone who does not drive the pin. A page
that avoids every ornament and invents nothing, with one real robustness defect,
is the definition of `mixed`. It is also not remotely near `slop`: the floor for
that verdict is net +4 and this is −2, six slop signals short of openhack.
