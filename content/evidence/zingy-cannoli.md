---
source: https://zingy-cannoli-9cacce.netlify.app/
kind: site
cohort: ai-builder
verdict: slop
studied: 2026-10-18
context: [hero, nav, pricing, features, testimonials, cta, footer]
signals:
  gradient-blob: present
  three-card-row: unresolved
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: present
  symmetric-everything: present
  badge-pill-spam: absent
  generic-line-icon-set: present
  testimonial-card-row: present
  indigo-violet-accent: present
  gradient-fill-cta: present
  scroll-reveal-blank: present
  typewriter-headline: absent
  stock-photo-generic: present
  centered-hero-stack: present
  hero-mockup-float: unresolved
  asymmetric-split: absent
  single-optical-anchor: unresolved
  type-scale-high-contrast: unresolved
  editorial-grid-break: absent
  custom-type-pairing: absent
  real-product-surface: absent
  shows-deliverable: absent
  density-variation: unresolved
  one-accent-discipline: absent
  live-claim-control: absent
materials: [single-theme, stock-photo, webgl]
---

**Sampling: screen-selected.** One of the five top-ranked of about forty showcase-gallery sites by a mechanical pre-screen. The screen ranked on, among others, `gradient-blob`, `three-card-row`, `glass-card-overuse`, `generic-sans-default` and `indigo-violet-accent`, so this file's values for those five are not independent of how it was chosen.

Rated by two independent blind raters on 2026-10-18, neither reading the other's draft. Both reached `slop`. They agreed on 21 of 26 signals; the 5 splits `three-card-row` (A present, B absent), `hero-mockup-float` (A present, B absent), `single-optical-anchor` (A absent, B present), `type-scale-high-contrast` (A absent, B present), `density-variation` (A absent, B present) are recorded `unresolved`, which never counts toward a rule. Both write-ups follow in full.

**Rater A.**

Rater A, new page, rated blind (no other rater's draft opened).

**Capture.** 1440x900 viewport. `shoot-tiles.cjs` into `s5/zingy-cannoli-A`: 10 tiles,
`clamped: false`, `coverage: 1`, scroller `window`, `docH_before` 6864 =
`docH_after` 6864, no inner scroller (`innerCands` only `html`, sh 6864). Stitched to
two strips, 1440x4400 and 1440x2464, 6864px against a 6864px page, `OK`. The last
strip ends in the footer (four columns, `© 2026 AIBuilder. All rights reserved.`).
One capture artefact: the fixed header (66px, `backdrop-filter: blur(10px)` once
scrolled) overlays the top of each later tile, so the stitched strip clips the top
~40px of the three pricing cards. A live screenshot at scrollY 4950 shows them whole
("Free" / "Pro" under a `Most Popular` band / "Business"); values below are read from
the DOM, not from the strip.

What the page is: a Vite + React single-page app (`<div id="root"></div>`, one
`index-RyBzXzi3.js` bundle, the stock Vite favicon `/vite.svg` still in place) for a
product named "AIBuilder". Title `AIBuilder - AI-Powered Website Creation`, no meta
description. With JavaScript off, `document.body.innerText` is 0 characters. Seven
sections: hero, a features grid, "How AIBuilder Works", "Stunning Templates for Every
Need", "What Our Clients Say", pricing, a closing CTA band; then the footer. 692 words.
Every footer link except the three in-page anchors is `href="#"`, including the four
social icons, Documentation, API, Careers and Privacy Policy.

## Slop signals present (12)

**`gradient-blob`.** The closing CTA band (y5930, 1440x540) carries two literal blobs:
a 128px `rounded-full` disc `rgba(0,240,255,.2)` and a 192px disc `rgba(67,56,202,.2)`,
both under `filter: blur(64px)` (Tailwind `blur-3xl`), over a full-bleed
`linear-gradient(to right bottom, #312e81, #0a192f, #134e4a)` at 0.8 opacity. Behind
"How AIBuilder Works" (1280x1172 at y1820) and pricing (1280x1136 at y4794) sit soft
`radial-gradient(rgba(49,46,129,.3), transparent)` washes with no edge. Same mechanism
as databuddy's blurred hero ribbon and railway-com's closing radial wash.

**`three-card-row`.** Pricing is `grid-template-columns: 362.656px 362.672px 362.656px`:
three equal 363x716 cards at x144 / x539 / x933, each with border and 16px radius,
Free / $29 Pro (2px `#00f0ff` border, `Most Popular` band) / $79 Business, each with
price, one-line description, CTA and an eight-row checklist. Pricing tiers count, per
tsenta, databuddy and clerk-com. The features grid does NOT fire: it is
`270px 270px 270px 270px`, a 4x2. Templates and testimonials are 2x2.

**`generic-sans-default`.** One family on the whole page: the CSS sets
`html{font-family:Inter,sans-serif}` and `body{font-family:Inter,sans-serif}`, loaded
from Google Fonts at weights 300-700. The ladder reports `bigFamilies: ["Inter"]`,
`smallFamilies: ["Inter"]`. Inter carries 60px display through 14px card copy.

**`symmetric-everything`.** All seven H1/H2 elements compute `text-align: center`, each
over a centred 20px subhead (the identical `max-w-4xl mx-auto text-center mb-16`
header block in five sections). The grids are 4x2, 2x2, 2x2 and 3-up, all centred in
`max-w-6xl`/`max-w-7xl`. The how-it-works timeline zig-zags four `md:w-1/2` cards about
a 2px centred spine, mirror-wise. The CTA band is a centred stack. The footer is four
equal columns. Left-aligned text exists only inside cards.

**`generic-line-icon-set`.** The eight feature cards each open with a 24x24 SVG,
`stroke="currentColor" stroke-width="2" fill="none"` (lucide; the bundle carries 25
`lucide` references), in the same 48px tinted square. Each restates its H3: a bolt over
"Lightning Fast", `<>` over "Clean Code Generation", two figures over "User-Centric
Design", a grid over "Responsive by Default". The four timeline icons are the same
set at 32x32, same stroke.

**`testimonial-card-row`.** The social-proof section is four quote cards and nothing
else (no logo wall, no figures): 564x186 each, identical `#112240` fill, 1px `#233554`
border, 12px radius, 24px padding, 48px avatar, name, role, five `#facc15` stars, a 14px
quote. Two rows of two at y4332 and y4542. Not a carousel. databuddy's regular 3x3 grid
set the precedent that a grid of equal quote cards counts. The avatars are Pexels
stock portraits (`pexels-photo-3796217`, `-2379005`, `-1987301`, `-2128807`), so the
four named customers are not evidenced as real; recorded as fact, not scored here.

**`indigo-violet-accent`.** The hue is in the primary conversion button: both
`.btn-gradient` CTAs end on `#4f46e5` (indigo-600), with `background-size: 200%` and
a 3s `gradient-animation` sweeping the indigo half across the button. It is also the
step-1 timeline icon (`#6366f1 → #4338ca`, 56px), the step-4 icon (`#4338ca → #00b7ff`),
the top stop of the timeline spine (`#6366f1`), the 192px blob (`#4338ca`), both radial
washes and the CTA band's first stop (`#312e81`). Cyan `#00f0ff` is the lead accent;
indigo is the second hue, and the signal reads the hue in any fill.

**`gradient-fill-cta`.** "Get Started Free" (205x52 at y558) and "Start Building for
Free" (251x52 at y6284) both compute
`background-image: linear-gradient(270deg, rgb(0,240,255), rgb(79,70,229))`, animated.
The two primary buttons of the page; the secondary buttons are outlined.

**`scroll-reveal-blank`.** Measured with the dwell control. 32 wrapper elements carry
inline `opacity: 0; transform: translateY(20px)` (the bundle has 5 `whileInView`
references and 4 `IntersectionObserver`). Of 158 text-owning nodes, 110 sit at
effective (ancestor-multiplied) opacity < 0.08 at rest. A 14-step scroll walk brings
all 110 to ≥ 0.5. A 7-second dwell with no scroll recovers 0 of 110; all 110 are still
hidden afterwards. The gate is scroll, not time. Everything below the hero, including
every price and every pricing row, is withheld from a reader that does not scroll
(the hero's 264 characters are the only text not gated). No-JS gets nothing at all,
which is the SPA, not this signal.

**`stock-photo-generic`.** The "templates" section shows no templates. Its four 542x305
cards are Pexels photographs at `w=1200`: a shopping cart and bag ("E-Commerce"), a man
in front of code screens ("Portfolio"), a team laughing around a laptop ("Business"),
a hand holding a phone ("Blog"). Each sits under two stacked scrims
(`linear-gradient(to top, rgba(10,25,47,.9), rgba(10,25,47,.5), transparent)` plus a
60%-opacity one) so the 30px white H3 survives. Both clauses fire: stock that could
belong to any company, and a scrim bolted over it for the type.

**`centered-hero-stack`.** 60px H1 (672px wide, x384-1056, centre 720), 24px subhead
(672px), two pill CTAs side by side, three green-dot trust lines, a bouncing down-arrow,
all on the vertical axis, inside a `max-w-3xl mx-auto text-center` panel.

**`hero-mockup-float`.** The hero background is a 1440x900 three.js canvas (bundle:
42 `WebGLRenderer`, 1 `IcosahedronGeometry`): a particle field around a
perspective-tilted wireframe browser window (header bar, two content blocks with the
X-crossed placeholder convention, footer bar) that drifts between frames (the outer
frame's skew differs between screenshots 3.5s apart). In the hero it sits behind the
headline, softened by the text panel's `backdrop-filter: blur(4px)`; the nav button
"See AI Building Websites" opens it full-screen in a modal titled "Watch AI Build Your
Website", with rotating icosahedra. An invented, floating depiction of the product's
output in the hero. This is the weakest slop call; see near-misses.

## Slop signals absent (4)

`glass-card-overuse`: two rendered `backdrop-filter` surfaces (the scrolled header,
`blur(10px)`; the hero text panel, `blur(4px)`) plus a third on the mobile menu, which
computes `display: none` at 1440. No card uses it. `emoji-as-icon`: zero codepoints
above U+2500 in `innerText`; stars and checks are inline SVG. `badge-pill-spam`: zero
decorative pills above the fold. The three trust lines are an 8px dot plus text with no
fill or border; the two pill shapes are the CTAs; `Most Popular` is one full-width band
at y5048. `typewriter-headline`: H1 sampled 8 times at 1s intervals, one distinct value.

## Craft signals present (0)

None. Each was checked:

- `asymmetric-split`: no unequal two-column split anywhere. Every grid is equal-column;
  the timeline cards are `md:w-1/2` mirrored.
- `single-optical-anchor` (rule-ineligible; honest call): absent. In the hero, four
  masses compete: the gradient H1 words, the animated gradient CTA, the solid `#00f0ff`
  nav button (top right, the most saturated fill above the fold), and the wireframe
  behind the text. Below the hero no section has an anchor: each is a header block
  over equal cards. Not a case of "one mass dominates because there is only one".
- `type-scale-high-contrast`: `ladder.cjs` gives `ratio 3.75` (60/16), `ratioSub 2.5`
  (24px subhead). At the cut, not below it, so the ladder decides, and it is flat at the
  top: H1 60px, the close-out's "Web Presence?" also 60px, its first line 48px, six
  section H2s at 36px. The H1 is 1.25x the next tier and shares its size with the
  close-out: the databuddy / decent-com / neuron-industries shape, all absent.
- `editorial-grid-break`: nothing leaves the centred `max-w-7xl` column. The full-bleed
  CTA band is a background, not a break.
- `custom-type-pairing`: one family (above).
- `real-product-surface`: no product UI anywhere on 6864px. The page has 8 images, all
  `images.pexels.com`, and one canvas drawing a stylised wireframe. No builder, no
  prompt box, no generated site. The modal's "Experience the future of web development
  in real-time" is the same looping wireframe. Zero `input`, `form` or `textarea`, so
  not even a doorway.
- `shows-deliverable`: no entry could embarrass the vendor. The only refusal-shaped
  content is the pricing ✗ rows (Free lacks "Advanced AI features", "Custom domain",
  "Priority support"; Pro lacks "Analytics dashboard"): upsell differentiators, the
  "Enterprise only" case the vocabulary excludes. The page's own inconsistencies are
  not refusals either: the hero promises "Custom domain options" while Free marks it
  ✗, Free lists "AIBuilder branding" with a ✓, and "Free for personal use" sits beside
  "All plans include a 14-day free trial". No deliverable (a site AIBuilder built) is
  shown; the one figure on the page is a testimonial's "increased my online sales by
  40%".
- `density-variation`: characters per vertical pixel by section run hero 0.29,
  features 1.07, how-it-works 0.46, templates 0.50, testimonials 1.29, pricing 0.72,
  CTA 0.47, footer 0.73: a 4.4x swing. It is one texture at different packings. Every
  content section has `padding: 96px 0`, the same centred 36px H2 + 20px subhead
  header, and the same unit (a `#112240` card, 1px `#233554` border, 12-16px radius)
  repeated 8, 4, 4, 4 or 3 times. Nothing compresses or opens against that rhythm: no
  ledger, table, code, single-figure band or prose passage (the dipole-labs reading).
- `one-accent-discipline`: at least four chromatic families on chrome. Cyan `#00f0ff`
  (nav and Pro buttons, `Most Popular`, highlighted heading words, step numerals),
  indigo `#4f46e5`/`#6366f1`/`#4338ca` (CTA gradients, timeline icons, spine, blob),
  teal `#14b8a6`/`#64ffda` (step-2 icon, the heading gradient's end stop), green
  `#4ade80` (six trust dots), plus `#facc15` stars.
- `live-claim-control`: the central claim ("Our AI understands your vision and builds
  ... websites in minutes") has nothing the visitor can enter. The one interactive
  demo is a modal animation that runs the same regardless of input.

## Near-misses

- `hero-mockup-float` (present): a wireframe of a browser page, not a product UI, and
  blurred behind the text at rest. Held present because it is a perspective-tilted,
  drifting browser frame standing in for the product's output in the hero, which is
  the convention the signal records. A second rater could fairly call it absent.
- `testimonial-card-row` (present): 2x2, not a single row. Held on databuddy's grid
  precedent and the definition's terms (count ≥ 3, equal weight, whole section).
- `gradient-fill-cta` (present): two stops, not three. stripe-2014's two-tone button is
  present, and here the gradient is also animated.
- `indigo-violet-accent` (present): indigo is the second hue, not the lead. It is in
  the primary button fill and five other fills.
- `glass-card-overuse` (absent): three `backdrop-filter` declarations, two rendered at
  1440, none on a card.
- `type-scale-high-contrast` (absent): exactly 3.75:1, decided by the flat top of the
  ladder per precedent.
- `density-variation` (absent): a measured 4.4x character-density swing, read as card
  packing rather than a change of texture.

## Verdict: `slop`, net +12 (12 slop, 0 craft)

Net +12 is above every file in the corpus (slop anchors heroku-2014 +5, openhack +4).
What separates it from the two +3 mixed files, in checkable terms:

1. **Zero craft against their 3-4.** deepmark keeps four (Space Grotesk / Geist
   pairing, one accent, density, an asymmetric split); stripe-2014 keeps three
   (a real Checkout capture, an asymmetric split, density). Here the CSS declares one
   family, the page carries no product surface (8 of 8 images are Pexels, the one canvas
   is a wireframe), and its chrome runs four accent hues. Every craft absence above
   rests on a DOM value, not a reading.
2. **Twelve slop against their 7 and 6**, and the extra signals are not soft. The
   page holds 110 of 158 text nodes at opacity < 0.08 until scrolled with a dwell
   control recovering 0, a robustness defect neither +3 file has; it fires both halves
   of the AI palette on its primary button (`#00f0ff → #4f46e5`, animated); and its
   "templates" are stock photographs under scrims.
3. **It survives the least favourable reading.** Flip every near-miss toward the page
   (`hero-mockup-float`, `testimonial-card-row`, `gradient-fill-cta` and
   `indigo-violet-accent` to absent; `type-scale-high-contrast`, `density-variation` and
   `single-optical-anchor` to present): 8 slop, 3 craft, net +5. That still equals
   heroku-2014 and clears both +3 files. No single contested call carries the verdict.

Not a thin page: 6864px, seven sections including pricing, testimonials and a templates
showcase, so the craft signals had sections to fire in and did not. That it is
probably builder-generated is not part of the verdict; the measurements are.

**Rater B.**

Captured 2026-10-18 at 1440x900. `docH` 6864 before and after the walk, 10 tiles, `clamped: false`, `coverage` 1.0, stitched 6864px against a 6864px page, last strip ends in a footer (four link columns, "© 2026 AIBuilder. All rights reserved."). No inner scroller: `html` is the only candidate. One canvas, `data-engine="three.js r160"`, 1440x900 in the hero, painting a starfield over `rgb(10,25,47)`; 4.3% of sampled hero pixels are bright. `prefers-reduced-motion: reduce` does not remove the scroll gates (see `scroll-reveal-blank`).

**The page.** A dark-navy, cyan-accented product site for "AIBuilder", a website builder. Hero, 8-card feature grid, a 4-step timeline, 4 template cards, 4 testimonials, 3 pricing tiers, a closing CTA, footer. Seven sections in 6864px; section heights run 900, 920, 1172, 1030, 772, 1136, 540.

**`gradient-blob` present.** Two `blur(64px)` circles sit in the closing CTA: `bg-accent/20` at 128x128 (y6065) and `bg-primary-700/20` at 192x192 (y6098), plus three radial-gradient fields (`radial-gradient(rgba(49,46,129,0.3), transparent)` at y1820 and y4794, and a `linear-gradient(to bottom right, rgb(49,46,129), rgb(10,25,47), rgb(19,78,74))` field over the CTA's 1440x540). The hero carries a radial vignette over the canvas. Soft-edged ornamental colour fields with no content role.

**`generic-sans-default` present.** Every text element resolves to `Inter, sans-serif`: 286 of 286 visible text nodes, one family, loaded from Google Fonts at weights 300-700. There is no second face anywhere, including the logotype.

**`symmetric-everything` present.** Every section headline is centred on the same vertical axis: H1 60px, four H2s at 36px, the CTA H2 at 48px, all `text-center`. The grids all mirror: features 4x2, templates 2x2 (544px cards at x160/x736), testimonials 2x2 (564px cards at x144/x732), pricing 3x363px at x144/x539/x933. The "How AIBuilder Works" timeline is a literal mirror: odd steps at `md:w-1/2 md:pr-10 md:ml-auto md:text-right`, even steps at `md:w-1/2 md:pl-10`, around a 2px gradient spine.

**`generic-line-icon-set` present.** 64 SVGs, all lucide with `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="2"`. 8 at 24px in the feature chips, 4 at 32px on the timeline, 20 at 16px as testimonial stars, 4 pricing check/X marks, 3 nav arrows. One set, uniform stroke and size, carrying nothing the heading does not: the "AI-Powered Design" card's wand glyph adds no information to "AI-Powered Design".

**`testimonial-card-row` present.** Four equal-weight quote cards, each 564x186, in a 2x2 grid, forming the whole social-proof section: Sarah Johnson (Founder, DesignCraft), Michael Chen (Marketing Director, TechNova), Elena Martinez (Freelance Photographer, ElenaShots), David Wilson (Small Business Owner, Wilson Crafts). All four carry five gold stars, a Pexels portrait, and a one-paragraph quote. No carousel, no track, no clip.

**`indigo-violet-accent` present.** The primary CTA gradient runs `linear-gradient(270deg, #00f0ff, #4f46e5)`; the CTA field's radials are `rgba(67,56,202,...)` (indigo-700) and `rgba(49,46,129,...)` (indigo-900); the timeline nodes include indigo `#4338ca`, `#312e81`. The AI-palette hue is shipped as a second accent alongside cyan.

**`gradient-fill-cta` present.** `.btn-gradient` is `linear-gradient(270deg,#00f0ff,#4f46e5)`, `background-size:200% 200%`, animated 3s infinite, on both "Get Started Free" (205x52) and "Start Building for Free". This is not a flat fill with a border: the fill itself is a two-stop gradient, and the same class is used at both ends of the page.

**`scroll-reveal-blank` present.** Framer Motion `whileInView` with inline `opacity: 0; transform: translateY(20px)`. At rest, without scrolling, 29 text-bearing blocks sit at opacity 0, including all 8 feature cards, all 4 timeline steps, all 4 template cards, all 4 testimonials, all 3 pricing cards, and every section headline. A dwell control that waited 5s without scrolling recovered none of them (the `low` set stayed at opacity 0), so the gate is scroll, not time. With `reducedMotion: 'reduce'` the same 15 sampled cards still read `opacity: 0`.

**`stock-photo-generic` present.** Four `images.pexels.com` photos at the template cards (5632402, 6963944, 3182812, 5082579), each a generic office/clinic/desk scene with the category name set on top of it: a card that could belong to any builder's template gallery. Four more Pexels portraits at 48px in the testimonials. No alt text on any of the eight (`alt=""` on the template images, names only on the portraits).

`centered-hero-stack` present: `min-h-screen flex items-center justify-center`, an H1 on two lines, a centred subhead, two centred buttons, three centred trust items. `hero-mockup-float` absent: nothing floats as a device or dashboard; the hero is typography over a canvas.

**Craft, such as it is.** `type-scale-high-contrast` present at the threshold: `ladder.cjs` reads the largest text node at 60px against a 16px body, exactly 3.75:1, with a ladder of 14/16/18/20/24/30/36/48/60. At the cut, so present on the procedure, and the page does have a display headline rather than a 30px one. `density-variation` present weakly: section heights 540 to 1172, and the pattern does change between full-bleed hero, card grid, spine timeline, image grid, quote grid, table-style pricing. `single-optical-anchor` present, with the caveat in the rules: the hero's glowing panel (a 736x472 `backdrop-blur-sm` box behind the 60px headline, over the starfield) is the one mass; the rest of the page is a field of equal 20px cards. One mass dominates because there is only one mass, which is the "only one mass" case the procedure flags, and I am recording the honest call as the rules ask.

Everything else craft is absent. No asymmetry, no grid break, no second typeface, no product surface at all (the "Templates" are stock photos, not screens the builder produced), no deliverable artefact, no control that lets the visitor falsify a claim, and no accent discipline: cyan `#00f0ff`, indigo `#4f46e5`/`#4338ca`, teal `#14b8a6`, green `#4ade80`, plus a three-stop gradient on every highlighted word.

**Near misses.** `badge-pill-spam`: the hero and closing CTA each end in three pill-shaped trust items, but they are 8px green dots beside text with no background or border, and the only true pills above the fold are the two hero buttons and the nav CTA, which are controls, not decorative labels. Absent. `glass-card-overuse`: one `backdrop-filter` surface (the hero panel, `blur(4px)`), well under three. `three-card-row`: the features are 4-up and the templates 2-up; the pricing tier row is a commercial table, not a feature row, and the pricing cards differ in weight (the Pro card is `border-2 border-accent shadow-glow`). `emoji-as-icon`: zero pictographic code points in body text; the check marks are lucide SVG. `centered-hero-stack` and `hero-mockup-float` fire as expected at pre-AI rates; the hero mockup shape is absent. `materials`: single-theme (dark only, no light-mode switch found), Pexels stock, three.js canvas. Not `illustration`; not `dual-theme`.

**Verdict: slop. Net +7** (10 slop present, 3 craft present). The rule demands a comparison that a second rater can check. deepmark (+3, mixed) carries 7 slop signals but 4 craft ones, including `custom-type-pairing` and `asymmetric-split`. stripe-2014 (+3) carries 5 slop against 4 craft, including `real-product-surface`. openhack (+4) carries 6 slop against 2 craft but has `real-product-surface`. This page carries 10 slop signals, several of the archetypal kind in one place (`testimonial-card-row`, `gradient-fill-cta`, `indigo-violet-accent`, `scroll-reveal-blank`, `stock-photo-generic`), and its only craft is a display scale exactly at the 3.75 cut, weakly varying section heights, and a hero that is the only mass on the page. There is no product surface and no deliverable anywhere in 6864px: the testimonials are Pexels portraits with invented names, and the "templates" are stock photography. The two +4 slop files (openhack, heroku-2014) each keep a real product artefact; the gap here is that this one has none and still runs the full template. That is the separability I can defend: 10 slop against 3 craft, with the craft being scale and rhythm rather than content.
