---
source: https://permit-guide-ai.lovable.app/
kind: site
cohort: ai-builder
verdict: slop
studied: 2026-10-18
context: [hero, nav, features, testimonials, cta, footer]
signals:
  gradient-blob: unresolved
  three-card-row: present
  glass-card-overuse: present
  emoji-as-icon: absent
  generic-sans-default: present
  symmetric-everything: present
  badge-pill-spam: absent
  generic-line-icon-set: present
  testimonial-card-row: present
  indigo-violet-accent: absent
  gradient-fill-cta: present
  scroll-reveal-blank: absent
  typewriter-headline: absent
  stock-photo-generic: present
  centered-hero-stack: present
  hero-mockup-float: absent
  asymmetric-split: absent
  single-optical-anchor: unresolved
  type-scale-high-contrast: present
  editorial-grid-break: absent
  custom-type-pairing: present
  real-product-surface: absent
  shows-deliverable: absent
  density-variation: absent
  one-accent-discipline: present
  live-claim-control: absent
materials: [single-theme, stock-photo]
---

**Sampling: screen-selected.** One of the five top-ranked of about forty showcase-gallery sites by a mechanical pre-screen. The screen ranked on, among others, `gradient-blob`, `three-card-row`, `glass-card-overuse`, `generic-sans-default` and `indigo-violet-accent`, so this file's values for those five are not independent of how it was chosen.

Rated by two independent blind raters on 2026-10-18, neither reading the other's draft. Both reached `slop`. They agreed on 24 of 26 signals; the 2 splits `gradient-blob` (A absent, B present), `single-optical-anchor` (A absent, B present) are recorded `unresolved`, which never counts toward a rule. Both write-ups follow in full.

**Rater A.**

**Capture facts.** 1440x900 viewport, page height 3519px, 6 tiles and 1 strip.
`clamped: false`, `coverage: 1`, `docH_before` 3519 = `docH_after` 3519, stitched
height 3519 with no drift. The last two landings are the same frame (asked 2800
and 3500, both landed 2619) so tile 5 is a byte-identical duplicate of tile 4
(same md5) and the stitcher correctly gives it zero bands. The strip ends in the
footer: `© 2026 PermitPal`, `Privacy  Terms  Built with Lovable`, and a legal
disclaimer line at y=3440. Document is `html` height 3519, no child scroller.

**The page.** A landing page for a permit-research product ("PermitPal"),
built on Lovable. Nav (How it works / Features / Reviews / Sign in / Get
started), a centred hero with a search field, three trust cards, a three-step
band, a four-up feature row, three testimonials, a gradient CTA panel and a
footer. Five sections below the header; the four after the hero each carry 112px of vertical padding top and bottom.

**`three-card-row`, present, three times.** Hero cards at y=691 in a
`grid-cols-3` (`240px 240px 240px`, max-width 768) labelled Accurate / Fast /
US-focused. Steps at y=1288 (`394.656px` x3, 1232 container). Testimonials at
y=2534 (`394.656px` x3). The four-up feature grid at y=1943 is the only
non-triplet row on the page. The signal stands on the hero and step rows alone,
without the testimonial row that is scored separately below.

**`glass-card-overuse`, present, six surfaces.** Header `backdrop-blur-xl`
(blur 24px, 1440x65), the hero badge pill (blur 8px), the search form (blur 8px,
672x74), and all three hero cards (`backdrop-blur` divs, 240x126 each). Three of
the six are card fills, three are chrome; either way the count clears the 3+
threshold, and all six are marketing chrome, not product content.

**`generic-line-icon-set`, present.** 40 `svg.lucide` icons, a single set, uniform
2px stroke throughout (`strokeWidth: 2px` on every sampled path), sizes 20px (12),
16px (20), 24px (6) and 14px (2). Every one restates its adjacent heading: a
target for "Accurate", a zap for "Fast", a flag for "US-focused", a hammer /
sparkles / file-check for the three steps, a dollar for "Cost estimates". None
carries information the heading does not.

**`testimonial-card-row`, present.** Three quote cards, each 395x212 at y=2534,
equal weight (identical 1px border, identical white fill), forming the whole
social-proof section. Not a carousel: no transformed track, no `overflow-x`
scroller, no track wider than its clip. `4.9 average across 1,200+ projects` sits
above them as a vendor aggregate.

**`gradient-fill-cta`, present.** The primary button fill is
`linear-gradient(135deg, oklch(0.42 0.13 245) 0%, oklch(0.55 0.14 200) 50%,
oklch(0.65 0.16 165) 100%)`. Three stops, 135deg, on "Get started" in the nav
(89x32), "Get answers" in the hero (186x56), the CTA panel (848x268) and the
testimonial avatar chips.

**`stock-photo-generic`, present.** The hero background is
`/assets/hero-CPv9vnmS.jpg`, 1920x1080, an aerial of a US suburban cul-de-sac at
sunset with white blueprint outlines of houses drawn over half of it. It is
rendered at `opacity-[0.18]` under a full-bleed near-white gradient scrim
(`oklab(0.99 ... / 0.6)` to `oklch(0.99 0.005 230)`). It could belong to any
mortgage broker, home-inspection app or realtor; the blueprint overlay is the
only thing tying it to the topic, and it still says nothing about permits. Both
limbs of the signal fire: it is any-company imagery, and the H1 and subhead sit
directly on it (image box 1440x864 at y=65, H1 at y=223), which the page can
only survive by dropping the image to 18% and bolting a 60-85% white scrim over
it. The blueprint-on-photo composite reads as generated rather than licensed;
`stock-photo` in materials records the kind, not the source.

**`centered-hero-stack`, present.** H1 at x=232, w=976, text-align center;
subhead 672 centred; the form 672 centred; chip row centred; three cards centred
in a 768 max-width. One axis from the top of the page to the first fold.

**`generic-sans-default`, present.** Body computes to
`Inter, ui-sans-serif, system-ui, sans-serif` at 16px. Headings are
`"Plus Jakarta Sans"` (13 elements). Both are unprefixed defaults of the
Shadcn/Lovable starter; `Inter` is the fallback the template hands you.

**`symmetric-everything`, present.** 5 of 5 `h1/h2` compute to
`text-align: center`. Every section is a centred header over a symmetric grid
(3, 4, 3, 3 columns), content containers 1232px (768px in the hero), and
the CTA is a centred 848px panel. The header's logo-left / nav-centre /
auth-right is the only asymmetry on the page.

**Craft: `custom-type-pairing`, present.** Plus Jakarta Sans carries every
display size (72px H1, 48px H2, 48px step numerals, 20px H3) and every one of
those elements uses it exclusively; Inter carries every paragraph (20px subhead,
18px section subs, 14px card body, 12px footer). Two faces with a strict role
split, the same shape deepmark was scored `present` on (Space Grotesk display /
Geist body). No third face on the page.

**Craft: `type-scale-high-contrast`, present, 4.5:1.** `ladder.cjs`:
largest prose node 72px (`Get Local Permits &`, Plus Jakarta Sans, 700) over
body 16px = 4.5:1, above the 3.75 gate. H1 line-height 75.6px (1.05) and
letter-spacing -1.8px, so the display step is set, not inherited. Necessary,
not sufficient: the jump is carried by size and a single weight, with no
second axis (no optical sizing, no italic, no all-caps).

**Craft: `one-accent-discipline`, present.** One hue family: primary
`oklch(42% .13 245)` (blue) through accent `oklch(65% .16 165)` (teal-green),
both in the 245-165 ramp, and the gradient is the interpolation between them.
No violet: 245 is blue. No second accent anywhere; the neutral field is
`oklch(99% .005 230)` on a blue-grey `oklch(22% .04 250)` ink. The chip row is
neutral, the borders are neutral, the CTA panel is the same ramp.

**Near-misses.**

- `badge-pill-spam`, absent on measurement. Above the fold there is **one**
  decorative pill (`AI-powered · All 50 US states`, 212x30, at y=161). The five
  chips beneath the search (`Backyard deck`, `ADU in California`, `Food truck
  permit`, `EV charger`, `Kitchen remodel`) are `<button>` elements that fill
  the input, so they are affordances, not decoration. Count 1 < 3.
- `indigo-violet-accent`, absent. Hue 245 is blue; the accent is 165, green.
  No violet fill anywhere in the gradient audit.
- `hero-mockup-float`, absent: there is no product UI on the page at all.
  Nothing floats.
- `scroll-reveal-blank`, absent with a dwell control: a page reloaded and left
  idle for 11.2s shows 0 text nodes under 8% opacity, and the same page after a
  full 700px-step walk also shows 0. Nothing is gated.
- `gradient-blob`, absent. The only soft washes are inside the 18%-opacity hero
  photograph; there is no blob element in the DOM.
- `emoji-as-icon`, absent. No emoji in the page's text; every glyph is an
  inline lucide SVG.
- `real-product-surface`, absent. The one affordance that could reach the
  product is the hero search; submitting it (`backyard deck in Austin, TX`)
  navigates to `/auth?redirect=%2Fdashboard&q=...`. The doorway is not the
  surface, and there is no surface behind it on the page.
- `shows-deliverable`, absent. The only content that could count against the
  vendor is the testimonial row, and it flatters only: three 5-star quotes, a
  `4.9 average across 1,200+ projects` aggregate, no failed jurisdiction, no
  fee the page could not confirm, no refusal. The `Disclaimer:` line at y=3440
  is legal boilerplate, not an artefact.
- `single-optical-anchor`, absent (honest call, rule-ineligible). The anchor
  would be the H1, but it competes with a 672px form, a five-chip row and three
  cards in the same 864px fold; nothing dominates, and the eye lands on the
  gradient button first. "One mass dominates because there is only one mass"
  does not apply: there are five masses.
- `asymmetric-split`, absent. Every content section is a centred stack over a
  symmetric grid; the header's logo-left / nav-right split is a standard bar,
  not an unequal content split.
- `editorial-grid-break`, absent. No tile spans two columns, no image bleeds,
  no offset element; one 1232px container throughout.
- `density-variation`, absent. Section heights run 864 / 698 / 598 / 634 / 492;
  the four below the hero share an identical 112px pad top and bottom, and
  each is a centred header over a card grid. One rhythm.
- `live-claim-control`, absent. The search input would be the control, and it
  routes to sign-up rather than answering. The central claim ("Get Local
  Permits & Regulations in Seconds", "exactly which permits you need") is
  never falsifiable from the landing page.

**Verdict.** Net = 9 slop present - 3 craft present = **+6**. Above the +4
threshold.

What separates this from `deepmark` (+3) and `stripe-2014` (+3), in terms a
second rater can check against their front-matter. Both carry craft on
structural axes, not only on colour and type. deepmark scores
`asymmetric-split: present` and `density-variation: present` (plus
`custom-type-pairing`). stripe-2014 scores `asymmetric-split: present`,
`density-variation: present`, `real-product-surface: present` (the Checkout
form, which is the product it sells), and `centered-hero-stack: absent` with
`symmetric-everything: absent`: its prose has the hero copy "sits left".

This page has none of those. Its three craft signals are the cheap ones: one
hue ramp, one display/body face split, one measured type step, all of which a
builder theme supplies by default. Every structural craft signal is absent
(`asymmetric-split`, `single-optical-anchor`, `editorial-grid-break`,
`density-variation`), and so are both product signals (`real-product-surface`,
`shows-deliverable`). The two +3 files each hold at least two of those six; this
one holds zero.

Three checks a second rater can run on the live page:
1. **Symmetry.** All 5 of 5 `h1/h2` compute to `text-align: center`; the four
   sections below the hero carry an identical `112px/112px` pad; the only
   non-3-up grid is the four-up feature row. No content block sits off the
   page's centre axis.
2. **No product.** Submitting the hero form navigates to
   `/auth?redirect=%2Fdashboard&q=...`. There is no `<img>` on the page except
   the 18%-opacity stock hero, no canvas, video or iframe. Nothing shows the
   product answering.
3. **No deliverable.** The only artefact-like content is three 5-star quotes
   under `4.9 average across 1,200+ projects`, a vendor aggregate, which is
   absent by precedent. Nothing could embarrass the vendor.

The nearest corpus file is `openhack` (slop, +4): a centred template hero over
symmetric sections. This page runs more of the template (nine slop signals to
openhack's six) and lacks the one thing openhack is credited for, a real product
capture.

**Robustness of the call.** Seven of the nine slop values are geometric or
computed-style counts, not judgement: `three-card-row` (three `grid-cols-3`
rows), `glass-card-overuse` (six `backdrop-filter` surfaces),
`testimonial-card-row` (three equal 395x212 cards, no track),
`gradient-fill-cta` (three-stop 135deg fill on the primary button),
`symmetric-everything` (5/5 centred `h1/h2`), `generic-line-icon-set` (40 lucide
SVGs at uniform 2px stroke) and `centered-hero-stack` (H1, subhead, form, chips
and cards on one axis; rule-ineligible, but it counts toward net exactly as it
does in `openhack`). The two judgement calls are `generic-sans-default` (Inter
body is the default, though Plus Jakarta display was chosen) and
`stock-photo-generic` (any-company imagery, possibly generated). Flip both to
absent and net is 7 - 3 = **+4**, still at the threshold. On the craft side
every doubtful call was scored in the page's favour: `custom-type-pairing` and
`type-scale-high-contrast` are both choices a builder theme ships, and scoring
them `absent` would move net to +8. The call does not depend on any single
contestable value.

**Length caveat.** 3519px is short; several signals have little room to fire
(no docs, no pricing, no FAQ, no blog). I have not credited that: the slop
signals present are ones the page chose to ship in its five sections, and the
craft signals absent are of the kind a short page can still earn (a break in
the grid, one anchor mass, a real answer behind the search field).

**Rater B.**

PermitPal, a permit-lookup assistant. One page, 3519px at 1440 wide, 2126
characters of body text. Five bands and a footer: a centered search hero, a
3-step band, a 4-up feature grid, three testimonial cards, a gradient CTA
card. No pricing, docs, stats band or product screen. The only control on the
page, the hero search, routes to a sign-in form.

Ten slop signals present against four craft signals, net **+6**. Ten is the
highest slop count in the corpus (previous maximum 8, railway-com) and +6 is
above both existing `slop` files. The verdict is `slop`; the separation from
the +3 `mixed` files is in the verdict section, stated in front-matter terms.

The verdict does not rest on the builder. Lovable's injected chrome (a fixed
`ASIDE#lovable-badge` "Edit with Lovable", and the footer link "Built with
Lovable") is excluded from every signal below.

**Capture.** Viewport 1440x900. Walk `~/scratch/antislop/s5/permit-guide-ai-B`:
6 tiles, `clamped: false`, `coverage: 1`, scroller `window` (`html` 3519 over
900), `docH_before` = `docH_after` = 3519, no inner scroller. The walk asked
for 2800 and 3500 and landed at 2619 both times, so tiles 04 and 05 are
byte-identical (187711 bytes each); the stitcher took one band from them.
Stitched: one strip, 1440x3519, 0px drift. The strip ends in the footer
(y3351-3519: "© 2026 PermitPal", Privacy, Terms, Built with Lovable, and a
12px disclaimer). DOM sections: header 0-65, hero 65-929, `#how` 929-1627,
`#features` 1627-2225, `#testimonials` 2225-2859, CTA 2859-3351, footer
3351-3519. Media: 1 `img`, 0 video, 0 canvas, 0 iframe, 0 CSS `url()`
backgrounds. At 390x844 the page is 4368px and keeps the same single-column
centered stack. Values below are computed style, DOM counts, or interaction
results, not pixels.

## Slop signals present (10)

**`gradient-blob`.** Four decorative circles with `filter: blur(64px)`: two
448x448 (`h-[28rem] w-[28rem] rounded-full`) behind the hero, one
`bg-accent/25` at `-top-40 -right-32`, one `bg-primary/25` at
`-bottom-40 -left-32`; two 256x256 `bg-white/10` inside the CTA card. None
carries text, data or imagery. In the strip they are the teal bloom at the
hero's top right and the blue-grey wash at its left edge.

**`three-card-row`.** Two instances. Hero stat cards (Accurate / Local rules,
Fast / Seconds not days, US-focused / All 50 states), three equal boxes in one
row at y~745. `#how`: three equal cards (01 Describe your project, 02 AI
checks local rules, 03 Get your action plan), each icon tile + H3 + two-line
paragraph. The testimonial grid is a third, scored separately below.

**`glass-card-overuse`.** Six `backdrop-filter` surfaces against a threshold of
3: the sticky header (`blur(24px)`, `bg-background/70`), the hero badge
(`blur(8px)`, `bg-card/70`), the hero search form (`blur(8px)`,
`bg-card/95`), and the three hero stat cards (`blur(8px)` each). The Lovable
badge is not among them.

**`generic-sans-default`.** Body is `Inter, ui-sans-serif, system-ui,
sans-serif` (16px computed; 19 text nodes at 14px, 12 at 12px, 8 at 16px/600).
Display is `"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif`. Five
12px nodes fall through to `system-ui, -apple-system, "Segoe UI", Roboto`.

**`symmetric-everything`.** Every band is a centered heading and subhead over
an even grid: four H2s at 48px, all centered; card grids `grid-cols-3` (hero
stats, `#how`, testimonials at 395/395/395px) and `grid-cols-4` (features);
CTA card 848px centered in a 1440 page. The two tinted bands (`#how`,
`#testimonials`, both `secondary` at 40%) alternate with untinted ones. No
element sits off the vertical axis at 1440 or 390.

**`generic-line-icon-set`.** 40 Lucide SVGs, every one `stroke-width="2"`,
`stroke="currentColor"`. Per set, uniform size: hero stats 20px (`target`,
`zap`, `flag`) in 40px gradient tiles; `#how` 24px (`hammer`, `sparkles`,
`file-check-corner`) in 48px gradient tiles; features 20px
(`file-check-corner`, `dollar-sign`, `clock`, `building2`) in tinted tiles.
Each glyph restates its label: "Fast" gets `zap`, "Cost estimates" gets
`dollar-sign`, "Timelines" gets `clock`. `file-check-corner` and `sparkles`
each appear in two sets.

**`testimonial-card-row`.** The whole social-proof section is three
equal-weight cards: grid columns 394.656 / 394.672 / 394.656px, each 212px
tall, `overflow-x: visible`, `scrollWidth` = `clientWidth` = 1232, so not a
carousel. Each card: five 16px teal stars, a `quote` glyph, two lines of
quote, an initials disc (SM / MT / JK, 40px), name, role and city. Above them
"4.9 average across 1,200+ projects" with five 20px stars.

**`gradient-fill-cta`.** The primary buttons "Get started" (nav) and "Get
answers" (hero, 48-56px tall) are filled with `linear-gradient(135deg,
oklch(0.42 0.13 245) 0%, oklch(0.55 0.14 200) 50%, oklch(0.65 0.16 165)
100%)`, three stops. The same ramp fills the 848x268 CTA card, every icon
tile, the logo tile, and is clipped into the H1's second line
(`.text-gradient`). The CTA card's own button is flat (`oklch(0.96 0.015
220)`).

**`stock-photo-generic`.** `/assets/hero-CPv9vnmS.jpg`, 1920x1080, `alt=""`:
an aerial of a US subdivision at sunset with blueprint line art drawn into
the file over three houses. It names no city, office, form or permit and
would serve an insurer, an HOA or a mortgage lender equally. Both arms of the
definition hold. It is rendered at `opacity: 0.18` under a scrim
`linear-gradient(background/60, background/85, background)`, so its effective
contribution is about 7% at the top of the hero, about 3% at mid-height, and 0
at the bottom: the type could not sit on it, so a scrim was bolted over it.

**`centered-hero-stack`.** Badge (y161), H1 (72px, two lines, `text-center`),
subhead (`max-w-2xl mx-auto`), search form (`mx-auto`), five chips
(`justify-center`), three stat cards (centered grid). One column on the
vertical axis.

## Slop signals absent (6)

**`badge-pill-spam` absent, the closest slop call on the page.** Above the fold
there are six `rounded-full` elements: the "AI-powered · All 50 US states"
badge with a pinging dot (y161), and five chips at y597 (Backyard deck, ADU in
California, Food truck permit, EV charger, Kitchen remodel). The chips are
`<button>`s, and clicking "Kitchen remodel" sets the search input's value to
`Kitchen remodel` (read back with `inputValue`). They are example-query
controls, not decoration. Decorative pills above the fold: 1, against a
threshold of 3. A rater counting by shape would reach 6 and flip this.

**`indigo-violet-accent` absent.** The darkest chromatic stop is
`--primary: oklch(42% .13 245)`. OKLCH hue 245 is cerulean/sky (Tailwind
`sky-700` sits at hue 243); indigo is around 277 and violet higher. No
computed fill, text or border on the page has an OKLCH hue above 250.

**`emoji-as-icon` absent.** `\p{Extended_Pictographic}` over every leaf text
node: 0 matches. All glyphs are SVG.

**`scroll-reveal-blank` absent.** 69 text leaves. At 1.2s after
`domcontentloaded`, 68 are at computed opacity 1; the one hidden leaf is the
text of an inline `<script>`, not page copy. Dwell control (9s, no scroll): no
leaf changes state. Scroll walk (200px steps at 250ms, then 1.5s): no leaf
crosses from under 8% to visible. The H1 and badge carry `animate-fade-in`,
a time gate, and both read 1.0 in the dwell control.

**`typewriter-headline` absent.** No copy changes across 9s of dwell; no
cycling element in the DOM.

**`hero-mockup-float` absent.** No device, app window or dashboard anywhere on
the page.

## Craft signals present (4)

**`type-scale-high-contrast` present.** Largest text node with a letter:
"Get Local Permits &" / "Regulations in Seconds", Plus Jakarta Sans 700 at
72px, over body computed 16px: **4.5:1**, above the 3.75 gate. `ladder.cjs`
agrees (`ratio 4.5`, `bodyFs 16`, `ratioSub 3.6` against the 20px subhead).
The 48px H2s form a clear second tier. The 48px "01 02 03" counters are not
prose and do not change the ratio.

**`custom-type-pairing` present, on corpus precedent.** Two faces, each with
one job: Plus Jakarta Sans 600/700 on every heading and the wordmark (72, 48,
20, 18px) and Inter 400-700 on every body, label and button node (12-20px).
No heading is in Inter and no body node is in Plus Jakarta Sans. deepmark is
scored `present` on the same structure (Space Grotesk for display, Geist for
body, with `generic-sans-default` also present), so this page is scored to
match. I first leaned `absent` because both stacks are framework defaults;
the vocabulary carries no default-ness clause, and inventing one for a single
page would break comparability.

**`one-accent-discipline` present, a near-miss.** The tokens declare two hues,
`--primary oklch(42% .13 245)` and `--accent oklch(65% .16 165)`, but blue
never does a job on its own: it appears only as the first stop of the ramp,
in one 25%-opacity blob, and in `--ring`. Every flat chromatic use is the
teal end of that same ramp (stars, feature-icon strokes, the eyebrow glyph,
the pulse dot). Body ink `oklch(0.22 0.04 250)` and muted `oklch(0.5 0.03
245)` are near-neutral. So there is one accent, carried through a ramp that
ends in it. This differs from railway-com's `absent`, where violet and green
each carried separate jobs. A rater who counts the ramp's two ends as two
accents flips this, and the net rises to +7.

**`single-optical-anchor` present, recorded as a judgement (rule-ineligible).**
The anchor I counted is the 72px H1. In the first viewport it is the only
high-contrast mass: the photo sits at an effective 3-7%, the blobs are 25%
washes behind 64px blur, the badge and chips are 12px, and the form is one
bordered white box. So one mass dominates because nothing else on that screen
has comparable mass. The page's second strong mass, the 848x268 gradient CTA
card at y~2950, never shares a viewport with the H1. If this is excluded as
ineligible, the net is +7.

## Craft signals absent (6)

**`asymmetric-split` absent.** No band splits unevenly; every one is centered
heading over an even grid or a centered card. Same at 390px.

**`editorial-grid-break` absent.** Content stays in the `max-w-5xl` /
`max-w-6xl` container; nothing crosses a band edge or breaks the measure. The
blueprint art is inside the photo file.

**`real-product-surface` absent, by the doorway rule.** "Get answers" with
`backyard deck in Austin, TX` navigates to
`/auth?redirect=%2Fdashboard&q=backyard+deck+in+Austin%2C+TX`: email,
password, "Continue with Google". No checklist, fee range, timeline or agency
list appears on the marketing page. The sign-in gate is the doorway, not the
surface.

**`shows-deliverable` absent.** There is no artefact. Candidates, and why each
fails:
- "4.9 average across 1,200+ projects": a vendor aggregate, absent under the
  railway-com precedent; it can only flatter by being larger.
- The three testimonials: prose, not an artefact, and wholly favourable. None
  reports a missed permit, a wrong fee or a stale rule.
- The footer disclaimer ("not a substitute for professional legal,
  architectural, or engineering advice"): a liability line in prose, not an
  entry inside an artefact, so it is not scored as a refusal.
I cannot name an entry that could have embarrassed the vendor.

**`density-variation` absent.** Bands measure 864, 698, 598, 634 and 492px and
share one rhythm: centered heading, subhead, card row. The densest unit is a
card with a two-line paragraph; there is no table, list, spec or log for a
quiet band to read against.

**`live-claim-control` absent.** The only control returns nothing without an
account. The chips prefill the box; they do not test a claim.

## Near-misses

- `badge-pill-spam`: 1 decorative pill if chips are read as controls (my
  call), 6 if read by shape. Flip: net +7.
- `one-accent-discipline`: one ramp vs two declared tokens. Flip: net +7.
- `custom-type-pairing`: scored to deepmark's precedent against my first
  instinct. Flip: net +7.
- `single-optical-anchor`: rule-ineligible. Exclude or flip: net +7.
- `stock-photo-generic`: present on both arms, but effectively 3-7% visible.
  Flip: net +5.
- `gradient-blob`: 25% washes, not saturated shapes. Flip: net +5.

## Verdict: slop, net +6

Net = 10 slop present − 4 craft present = **+6**. The rule asks what separates
this page from the two +3 `mixed` files, deepmark and stripe-2014. Three
checks, each readable off the front-matter:

1. **Slop count.** 10 present. deepmark has 7, stripe-2014 has 6, and no file
   in the corpus has more than 8 (railway-com, which offsets with 7 craft to
   reach +1).
2. **What offsets it.** Six craft signals record a compositional or
   substantive decision: `asymmetric-split`, `editorial-grid-break`,
   `density-variation`, `real-product-surface`, `shows-deliverable`,
   `live-claim-control`. deepmark carries 2 of them (`asymmetric-split`,
   `density-variation`) and stripe-2014 carries 3 (the same two plus
   `real-product-surface`). This page carries **0**. Both existing slop files
   carry 1 (`real-product-surface`). Every craft signal this page does carry
   is typographic or chromatic: a 72px H1, two fonts by role, one hue family,
   and a hero anchor.
3. **What the slop set is.** The union of deepmark's and stripe-2014's present
   slop signals is 11. This page carries 8 of those 11 (missing only
   `badge-pill-spam`, `indigo-violet-accent` and `hero-mockup-float`), plus
   two that neither file has: `glass-card-overuse` (6 surfaces) and
   `testimonial-card-row` (3 cards).

So both +3 files earn back part of their slop with layout decisions, a split
and a change of density; this page has none, and on top of that carries more
slop than either. It is also above both slop files on net (+5, +4).

**How robust.** Getting down to +4 takes two of the downward near-misses
(`stock-photo-generic` and `gradient-blob`) flipping, and +4 still meets the
threshold. Reaching +3 takes a third present slop value to flip as well, and
the remaining candidates (`glass-card-overuse` at 6 against 3, two separate
three-card rows) are counts, not readings. The upward near-misses push the net
to +7 or higher. Dropping `centered-hero-stack`, which the vocabulary expects
to fail eligibility, still leaves +5.

**Thinness.** The page is thin (3519px, 2126 characters, no pricing, docs or
stats), but here that works against the slop count: ten slop signals fired
inside five bands. The craft signals that had nowhere to fire,
`real-product-surface`, `shows-deliverable` and `live-claim-control`, are
absent because the page shows no product, which per the vocabulary is the
finding, not a gap in the capture.

## Materials

`single-theme`: `color-scheme: normal`, no `prefers-color-scheme` rule, no
theme toggle in the DOM. The `dark:` utilities in the hero markup are
unreachable.

`stock-photo`: the one hero JPG. Not `commissioned-photo`: it shows nothing
specific to the product or its users.

Not `illustration`: the only drawn elements are the 40 Lucide UI glyphs and
three initials discs. No `webgl`, no video. No `origin-*`, `anchored` or
`disclosed`, because there is no deliverable to have provenance.

## Unresolved

None. The calls a second rater is most likely to split on are
`badge-pill-spam`, `one-accent-discipline` and `custom-type-pairing`. Each
is written above with the reading that decided it, and each one alone would
move the net to +7, not below +4.
