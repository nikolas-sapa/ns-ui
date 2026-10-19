---
source: https://opsdesign.com.br/
kind: site
cohort: ai-builder
verdict: mixed
studied: 2026-10-19
context: [hero, nav, features, cta, footer]
signals:
  gradient-blob: absent
  three-card-row: absent
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: present
  symmetric-everything: absent
  badge-pill-spam: absent
  generic-line-icon-set: present
  testimonial-card-row: absent
  indigo-violet-accent: absent
  gradient-fill-cta: absent
  scroll-reveal-blank: present
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: present
  hero-mockup-float: absent
  asymmetric-split: absent
  single-optical-anchor: unresolved
  type-scale-high-contrast: present
  editorial-grid-break: absent
  custom-type-pairing: absent
  real-product-surface: absent
  shows-deliverable: absent
  density-variation: absent
  one-accent-discipline: present
  live-claim-control: absent
materials: [dual-theme, webgl]
---

**Sampling: random draw.** One of twelve drawn with seed 20261019 from the twenty-two gallery sites left after the first draw (same pre-stated exclusions). `gunsvzombies`, drawn first, returned 404 (project deleted) and was replaced from the same seed by `openmark`. Not chosen on any signal.

Rated by two independent blind raters on 2026-10-19, neither reading the other's draft. Both reached `mixed`. They agreed on 25 of 26 signals; the 1 split `single-optical-anchor` (A absent, B present) are recorded `unresolved`, which never counts toward a rule. Both write-ups follow in full.

**Rater A.**

**Sampling: new page, not in the corpus.** Rated blind: no other rater's draft in `s5drafts/` was opened, and no evidence file exists for this slug, so there is no drift section.

**Capture.** 1440x900 viewport, DPR 1. Page height 4990px, scroller `window` (the only inner candidate was `html.dark` at 4990/900, the document itself). 8 tiles, `clamped: false`, `coverage: 1`, `reachedPx` 4990; the last two landings both stop at 4090, the browser's docH-900 clamp and expected. Stitched to 2 strips, 4990px against 4990px, no drift. The last strip ends in the footer (newsletter block, `Feito por Lucas Ribeiro`). Tiles in `~/scratch/antislop/s5/opsdesign-A/`, strips `s5strips/opsdesign-A-strip{0,1}.png`, probes in `s5work/opsdesign/`.

One capture artefact to know about, and it is the opposite of the usual one: the walker disables animation, so the strips show every band at full opacity. Read live, the page hides 20 of its 40 letter-bearing text leaves behind an `IntersectionObserver` fade. That is scored under `scroll-reveal-blank` below, and every other signal is read from the DOM and from live screenshots at 1:1, not from the strips.

The page is a Lovable build (`twitter:site @lovable_dev`, OG image under `gpt-engineer-file-uploads/`): React + Tailwind + shadcn tokens (`bg-card`, `text-muted-foreground`, `ring-ring`), Radix for the language `combobox`, three.js r170 for seven canvases. Builder origin is context, not a signal.

Bands, in order: fixed glass header (57px); hero `#hero` 56-776 (Wireframe-sphere WebGL field, 88px centred H1); `#chaos` 776-1585 (left text, right 552px sphere); `#order` 1585-2394 (left sphere, right text); `#modules` 2394-3386 (three module cards in a 2-up grid, a heading and dek); `#flow` 3386-4195 (left text, right sphere); `#cta` 4195-4676 (centred closing block); footer 4676-4990 (newsletter + credit). Total 222 words of visible copy.

## Slop signals present (4)

**`generic-sans-default`.** Body computes `Inter, system-ui, -apple-system, sans-serif` at 16px; `ladder.cjs` reports `bigFamilies: ["Inter"]` and `smallFamilies: ["Inter"]`. Inter is loaded from Google Fonts at 400/500/600/700 (`document.fonts` status `loaded` for those four weights), so this is the correlation-studio / neuron-industries / vizleads reading: Inter serving every role, display and body, is the corpus's `present`. What makes it decisive here is the near-miss next door: the CSS declares **Outfit** at 300-700 and `h1` carries a `font-heading` class, yet `document.fonts` reports every Outfit face `unloaded` and the H1 computes `Inter, system-ui, sans-serif` at 88px/700. The page was built with a display face and ships without one; the only deliberate typographic move left is `letter-spacing: -2.2px` on the H1.

**`generic-line-icon-set`.** 13 SVGs at rest, every one a 24x24 lucide glyph at `stroke-width="2"`, `fill: none`, three size tiers (14, 16, 20px) and two strokes (`rgb(242,245,248)` in chrome, `rgb(0,242,255)` in cards). The seven that sit beside a label restate it and nothing more: `layout-grid` over "Panorama", `calculator` over "Calculadora de ROI de Design System", `book-open` over "Gestão avançada de ferramentas", three identical `chevron-right` glyphs after three "Abrir" links, `mail` over "Receba insights de DesignOps", `arrow-right` inside both "Acessar plataforma" buttons. The deepmark shape: one set, uniform stroke, carrying nothing the adjacent heading does not already say.

**`scroll-reveal-blank`.** Measured on effective opacity (the product of every ancestor's computed `opacity`) over letter-bearing text leaves, at 1440x900, load settled 5s:
- **At rest, no scroll:** 20 of 40 leaves at effective opacity 0. That is every leaf of `#order` (eyebrow "A VIRADA", H2, dek), all of `#modules` (H2, dek, three titles, three bodies, three "Abrir" links), all of `#flow` (eyebrow, H2, dek) and all of `#cta` (H2, dek, button label). Only the hero and `#chaos` render.
- **Dwell control:** 10 seconds with no scroll recovers 0 of 20. The gate is scroll, not time.
- **Walk:** a 700px-step walk at 900ms per step recovers all of them. The `#order` text goes 0 to 1 as its band enters.
- **Reduced motion:** with `reducedMotion: 'reduce'` emulated, 20 of 40 still compute 0 after a 6s settle. There is no reduced-motion fallback, so the robustness half of the signal applies too.
- **Not a re-hide case:** after scrolling to `#order`'s centre (3 recovered) and then back to the top, 17 remain at 0 and the 3 stay visible. The frames are one-shot on entry, not hide-on-exit.

What a reader who does not scroll gets: the hero and the problem band, 15 of 40 leaves. The modules, the result band and the closing CTA, including the page's only mid-page conversion button, are invisible until scrolled.

**`centered-hero-stack`.** H1 896px wide at x272 (centre 720), subhead 768px at x336 (centre 720), a 220x48 cyan CTA at x528 and a 151x48 "Ver recursos" at x761 forming a centred row on x=720, all over a centred WebGL sphere. Rule-ineligible as recorded, counted as recorded.

## Craft signals present (2)

**`type-scale-high-contrast`.** `ladder.cjs`: ratio **5.5**, the 88px/700 H1 ("Onde a criatividade encontra a escala.") over a 16px body, `ratioSub` 4.4 against the 20px hero subhead; `letter-spacing -2.2px`, `line-height 88px`. Clears the 3.75 floor by a wide margin. Necessary, not sufficient: the ladder below it is 88 / 48 / 24 / 20 / 18 / 16, which is a stock Tailwind ramp with the hero pushed one step past `text-7xl`, and all of it is Inter. Scored for comparability with toppic and permit-guide-ai, both of which carry the same reading, not because the scale is a designed system.

**`one-accent-discipline`.** Exactly one chromatic hue on the page. A census of every computed `color`, `backgroundColor` and `borderTopColor` above chroma 40 returns three entries, all the same hue: `rgb(0,242,255)` (chroma 255), `rgba(0,242,255,0.1)`, `rgba(0,242,255,0.2)`. Everything else is the neutral ramp, `rgb(11,14,20)` ground, `rgb(23,26,33)` cards, `rgb(35,41,52)` borders, `rgb(137,150,169)` muted text, `rgb(242,245,248)` ink. The cyan does four jobs (primary button fill, eyebrow labels, card icon strokes, link accents) and no second hue competes with it. Zero- and one-accent both count present; this is the one-accent case.

**`single-optical-anchor` (rule-ineligible and undefined; honest call).** **Absent.** What I counted as the anchor: the hero composite of the 1400x720 wireframe sphere and the 88px two-line H1, which is the page's one strong mass and clearly the entry point. It holds in the hero, but "one mass dominates because there is only one mass" applies on both ends: the hero has one object plus type, and the four bands below each re-open on an equal-weight 48px/700 H2 with a 552px sphere beside it. `#chaos`, `#order` and `#flow` are the same module three times with the sphere swapped (cube, torus, layered torus), so no single mass organises the page past the fold. Recorded absent and flagged, the way the procedure asks.

## Absent, with the reading that settled each

- `gradient-blob`: zero CSS gradients other than one 1px border accent. The three card frames carry a `::before` at `linear-gradient(135deg, rgba(0,242,255,0.18), rgba(35,41,52,0.6) 35%, ...)` painting a 562x253 edge glow, a hairline, not a blob. The hero and band objects that a strip-only rater could read as gradient washes are **three.js r170 meshes** (`data-engine="three.js r170"` on all seven canvases, WebGL context, no 2D context), line-art wireframes on the page ground, sharp-edged, no blur, no radial field. Recorded as the page's material, not as this signal.
- `three-card-row`: `#modules` holds three module cards in `grid-template-columns: 564px 564px` at x144 and x732, the third wrapping to row two at x144. A 2-up grid with a hanging third, not a row of three.
- `glass-card-overuse`: one `backdrop-filter` surface on the page, the fixed header (`blur(16px)` over `rgba(23,26,33,0.7)`). Two short of the decided 3+.
- `emoji-as-icon`: zero emoji codepoints anywhere in the DOM.
- `symmetric-everything`: `symmetry.cjs` reads 3 of 6 H1/H2 headings centred, share **0.5**, well under the 0.85 cut. The centred ones are the hero, `#modules` and `#cta`; `#chaos`, `#order` and `#flow` are all `text-align: start` in the left-or-right 552px column of a 1:1 split.
- `badge-pill-spam`: two decorative pills in the whole page, both below the fold (the `Abrir` chips inside module cards sit inside the product-card surface anyway, and are not counted). No pills above the fold; the hero's two controls are a filled primary and a text link.
- `testimonial-card-row`: there is no testimonials section. Absent, per the definition.
- `indigo-violet-accent`: the accent is cyan `rgb(0,242,255)`, hue 183. No violet anywhere (see the chroma census under `one-accent-discipline`).
- `gradient-fill-cta`: every button fill is flat `rgb(0,242,255)` with `background-image: none` (hero CTA, footer "Inscrever-se"), every other CTA is a transparent outline or text link.
- `typewriter-headline`: 12 samples of the H1 over 12s return one string.
- `stock-photo-generic`: zero `<img>` elements on the page. The only "imagery" is the seven WebGL wireframes and the SVG icon set. No photographs, therefore no stock.
- `hero-mockup-float`: no UI mockup in the hero or anywhere: the hero object is an abstract sphere, and the product surfaces (`/dashboard`, `/calculator`, `/tools-budget`) are linked, never pictured.
- `asymmetric-split`: the three split bands are `grid-template-columns: 552px 552px`, a hard 1:1, with the text block 552px and the canvas column 552px (497px painted inside it). The side flips between bands, which is a mirrored rhythm, not an asymmetric one. The sphere sits at 324px inside its 552px column in `#order`, but that is a centred object in an even column, not a 60:40 or 70:30 split.
- `editorial-grid-break`: everything sits inside `max-w-6xl` (1152px) with 128px vertical padding on every band. Nothing leaves the container; no full-bleed band, no overlapping element, no element crossing a grid track.
- `custom-type-pairing`: one face in use, Inter, at 400-700 (see `generic-sans-default`). Outfit is declared and never loaded. Weight and negative tracking are the only typographic decisions.
- `real-product-surface`: absent, and this is the page's most consequential miss. The three module cards link to `/dashboard`, `/calculator` and `/tools-budget`; all three 302 to `/login`, which is a sign-in form ("Boas-vindas", email, password, Google and Apple buttons). Under the doorway rule, a sign-in form is not the surface. No screen of the product appears anywhere in 4990px.
- `shows-deliverable`: absent. Naming the entry that could have embarrassed the vendor: I cannot, because no artefact is shown. The module copy promises "ROI mensurável", "projeção de gastos para os próximos 12 meses" and "relatórios executivos prontos para o C-Level", and none of it is rendered; there is no number on the page at all, not even a vendor-aggregate one, so the railway-com exclusion is not reached.
- `density-variation`: 222 words over 4990px, and every band is the same sparse module (eyebrow, one 48px sentence, one 20px dek) or the same card grid. There is no dense passage anywhere for the sparse bands to read against: no table, list, spec, log, pricing row or chart. This is the permit-guide-ai / toppic reading.
- `live-claim-control`: no control on the page lets a visitor test a claim. The `PT` combobox switches language; the theme button switches theme; the CTAs navigate to `/login`.

## Near-misses

- **`real-product-surface`** (absent; present gives net +1): a rater who counts the login screen as "the product's real surface" flips it. The doorway rule is explicit and settled at n=42 on acyclic's CLI and dropbox-2014's sign-up forms; the login page here shows a product that has "not answered yet".
- **`gradient-blob`** (absent; present gives +3 net): the sphere fields are large, organic and chromatic, and in the downscaled strip they read as a glowing wash behind the hero. Opening one tile at 1:1 shows a wireframe mesh with visible polygons and no gradient. A rater scoring from the strip alone would get this wrong; that is a capture-reading caution, not a close call on the DOM.
- **`symmetric-everything`** (absent at 0.5 against an 0.85 cut): the hero, modules and CTA are centred and the page's *feel* is very symmetric. But three of six headings are start-aligned and the split bands are mirrored rather than centred. The measurement is decisive and not close to the cut.
- **`asymmetric-split`** (absent): the alternation (text-left / text-right / text-left) is a real compositional decision at the band level. Under the decided reading, `asymmetric-split` wants unequal columns or a broken axis; 552/552 with a centred object inside each half is neither.
- **`single-optical-anchor`** (absent; present would give net 0): rule-ineligible, and the honest call is contested. If a rater counts the H1-plus-sphere as the page's anchor, the hero does dominate. I held absent because every band below re-states the same weight and the page has no second-scale hierarchy at all.
- **`type-scale-high-contrast`** (present, 5.5): the clearest craft value on the page, but its substance is stock: one Inter at two sizes with a tracking tweak. A rater leaning on "necessary, not sufficient" could withdraw it.
- **`centered-hero-stack`** vs `single-optical-anchor`: both are rule-ineligible recorded facts. A rater who reads "centred hero over a decorative object" as an anchor would hold both present; they are not contradictory.
- **`generic-sans-default`**: a rater who scores the declared-but-unloaded Outfit as a pairing gets `custom-type-pairing` present. `document.fonts` says unloaded and computed style says Inter, so the page ships one face. I did not give it the pairing.
- **`density-variation`**: the modules band is denser than the others (three cards with three sentence-length bodies), which is the nearest thing to variation. Against a page where every other band is four lines in 809px, one 992px band of cards does not make a rhythm.
- **`three-card-row`**: three module cards exist. The grid is 2-up and the third wraps; a rater who counts cards rather than columns would score present (net +4). The measured `grid-template-columns` settles it.

## Verdict: `mixed`, net +2

Slop present 4 (generic-sans-default, generic-line-icon-set, scroll-reveal-blank, centered-hero-stack). Craft present 2 (type-scale-high-contrast, one-accent-discipline); `single-optical-anchor` is recorded absent and rule-ineligible. Net 4 − 2 = **+2**; counting only rule-eligible signals (striking `centered-hero-stack` as vizleads and toppic did), 3 − 2 = **+1**. The page sits at the bottom of the mixed band, beside acyclic (+1), not near deepmark or stripe-2014 (+3).

The page is **thin, and that is doing work in the score**. 4990px and 222 words: six bands, five of which are the same eyebrow-plus-sentence module, and no pricing, testimonials, stats, FAQ, team or integration section exists for `badge-pill-spam`, `testimonial-card-row`, `stock-photo-generic` or `three-card-row` to fire on. This is the "thin page scores well partly because most signals have nowhere to fire" caveat the brief names, and it applies here in the direction of *not* rounding the page up: five of the twelve `absent` values (`badge-pill-spam`, `three-card-row`, `testimonial-card-row`, `stock-photo-generic`, `hero-mockup-float`) are absent for want of an object, not on a reading, and the remaining seven are measured and fail. The four present values are the ones that survive on a sparse page: the font stack, the icon set, the reveal gate and the centred hero. This is the "thin page scores well partly because most signals have nowhere to fire" caveat the brief names, and it applies here in the direction of *not* rounding the page up.

What keeps it out of `exemplar`: the craft is two cheap decisions (one accent, a stock-ramp type ratio), the rule-ineligible anchor was read absent, and the page carries a genuine robustness defect (`scroll-reveal-blank`, 20/40 leaves, no reduced-motion fallback) on top of the corpus's cheapest typographic default (`generic-sans-default`, with a display face declared and not loaded). An exemplar does not usually hide its own body copy from a no-scroll reader.

What keeps it out of `slop`: net +2 against a +4 threshold, and the page has real, measurable restraint, which is not common in this cohort. One chromatic hue above chroma 40 across the entire DOM, in both themes (light mode swaps `rgb(0,242,255)` for `rgb(0,124,133)`, the same single hue, on `rgb(248,250,252)`), is a genuine not-a-template signature; so is the decision to build the entire visual language out of seven WebGL meshes rather than a hero screenshot, stock photo or gradient wash. The three.js work is the page's strongest argument and it is not a vocabulary signal.

**Robustness, so a second rater can locate a disagreement.** Four calls could move: `generic-sans-default` to absent would be a rater refusing Inter, `scroll-reveal-blank` to absent would need a reading that ignores the 20/40 measurement, `generic-line-icon-set` to absent would be a rater reading the chrome glyphs as not a "feature icon set", and `single-optical-anchor` to present would be the anchor reading. Each moves net by one. To reach `slop` a rater needs +4: that means adding at least two present slop signals and withdrawing at least one craft value, and I cannot construct a defensible route to that on the DOM. To reach `exemplar` (−2 or lower) needs five craft values; the page has two. `mixed` is the honest answer.

**Materials.** `dual-theme` (defaults to `html.dark` with a working sun/moon button labelled "Ativar modo claro" that sets `html.light` and `localStorage['dot:theme']`; the light theme is fully designed, not a fallback), `webgl` (seven three.js r170 canvases: one 1400x720 hero field, three 497-552px band objects, three 256px card glyphs). No photographs, no video, no illustration in the token sense. No provenance tokens: `shows-deliverable` is absent, so nothing has provenance.

**Rater B.**

**Rater B.** New page, rated blind (no other rater's draft opened), first
study of the page.

DesignOps governance SaaS for Portuguese-speaking design teams, shipped on
the apex domain `opsdesign.com.br` but branded "DesignOps Kit" in the tab,
the header and the footer. One page, 4990px, a fixed 57px header, six
sections and a footer. The page is a marketing shell over three login-gated
product routes (`/dashboard`, `/calculator`, `/tools-budget`, all of which
redirect to `/login`), so the marketing chrome is the whole scored surface.
Not thin: hero, three alternating feature bands, a four-module grid, a CTA
and a newsletter footer all exist, so most signals had something to fire on.

**Capture.** Viewport 1440x900. Walked fresh into
`~/scratch/antislop/s5/opsdesign-B`: 8 tiles, `clamped: false`,
`coverage: 1`, scroller `window`, `docH_before` = `docH_after` = 4990, one
inner candidate (`html.dark`, sh 4990 / ch 900, which is the document, not a
child scroller). The 4200 and 4900 landings both stopped at 4090, max scroll,
so tiles 06 and 07 are the same frame (66,515 bytes each, byte-identical);
the stitcher drops the overlap. 2 strips, 1440x4400 and 1440x590, 4990px
against a 4990px page, 0 drift. The last strip ends in the footer (newsletter
band, "Feito por Lucas Ribeiro" at y≈4926, no legal line, no link columns),
and the fixed header is the only element pinned through the walk.

**Slop signals present (4)**

- `generic-sans-default`. Inter carries every role, body through display.
  Body computes `Inter, system-ui, -apple-system, sans-serif` at 16px; the
  88px/700 H1, all five 48px H2s and both in-card H3s compute
  `Inter, system-ui, sans-serif`. The page *declares* a second family and
  never uses it: it requests `fonts.googleapis.com/css2?family=Outfit:
  wght@300;400;500;600;700`, ships a `.font-heading { font-family: Inter,
  system-ui, sans-serif; }` rule, and `document.fonts.check('700 88px
  Outfit')` returns `false`, with the network log showing one font response
  total (an Inter `woff2`, v20, 4 weights). So a pair was intended and the
  build collapsed to the default stack. Recorded as one stack because one
  family reaches pixels.
- `generic-line-icon-set`. Thirteen Lucide glyphs, one set, `stroke-width=2`
  at a 24px viewBox, rendered at three sizes: 20px (the three module-card
  tiles, `lucide-layout-dashboard` on "Panorama", `lucide-calculator` on
  "Calculadora de ROI de Design System", `lucide-wallet` on "Gestão avançada
  de ferramentas"), 14-16px (nav and CTA arrow, chevrons, mail), 14px
  (sun). Each tile glyph restates the 20px/700 H3 beside it: a dashboard
  glyph on "Panorama", a calculator on "Calculadora", a wallet on "Gestão de
  ferramentas". Nothing the heading does not already say.
- `scroll-reveal-blank`. TEXT gated behind scroll, measured against a dwell
  control. On load, **20 of 32** text nodes across the sections and footer
  sit at cumulative opacity below 0.08: the entire "A VIRADA" band (eyebrow,
  H2, body), the modules H2 and subhead, all three module cards (titles,
  bodies, "Abrir" labels), the "O RESULTADO" band, and the final CTA block.
  Waiting the same 3.1s without scrolling reveals **0** of them; scrolling
  through the page reveals **all 20**. The gate is scroll, not time, so the
  value is present. Confirmed again under `prefers-reduced-motion: reduce`:
  20 hidden on load, 0 after scrolling, so the gate is applied with motion
  reduced too rather than being skipped.
- `centered-hero-stack`. The hero is `max-w-4xl mx-auto text-center` at
  x272, w896: an 88px/700 two-line H1, a 20px muted subhead centred under
  it, and a two-button row centred beneath both. One centred text stack over
  a full-bleed 1400x720 canvas.

**Craft signals present (3)**

- `type-scale-high-contrast`, by the ladder procedure: largest text node
  carrying a letter is the H1 at 88px against body 16px, **5.5:1**, above
  the 3.75 floor. Subhead ratio 4.4:1. The 48px H2s carry a second step,
  and the body-to-small step runs 18/14/12/10, so the ladder is 88 / 48 / 20
  / 18 / 14 / 12 / 10.
- `one-accent-discipline`. One hue family, cyan `rgb(0, 242, 255)`, and one
  only: every element above chroma 40 in the whole DOM is that cyan (40
  occurrences; nothing else clears the gate). It is carried by the primary
  CTAs (flat `rgb(0, 242, 255)` on "Acessar plataforma" x2 and "Inscrever-se"),
  the 10px uppercase eyebrows, the module icon tiles, the right-edge progress
  nav's active bar and the footer author link. Secondary text is a single
  muted grey `rgb(137, 150, 169)`; surfaces are two near-black tokens
  (`rgb(11,14,20)`, `rgb(23,26,33)`). The light theme swaps the cyan for
  `rgb(0,124,133)`, a darker step of the same hue, so the discipline holds
  across both themes.
- `single-optical-anchor`. Recorded, not rule-eligible, and stated as my
  honest call: the hero's 1400x720 WebGL wireframe sphere, rendered at 60%
  opacity behind the centred H1, is the single mass the first screen hangs
  on. It does dominate rather than merely being "the only thing there" —
  the H1 sits inside the sphere's silhouette. But it is a page-entry anchor
  only: each later band carries its own separate WebGL mass (a 552x552
  geodesic sphere, a 447x447 torus knot, a 447x447 ring form, plus three
  256x256 forms inside the module cards; 7 canvases in all), so page-wide
  there is no one dominant mass. I count the hero sphere and
  note the qualification.

**Near-misses**

- `density-variation`, absent. Section ink by band: hero 21.1%, chaos 7.5%,
  order 11.2%, modules 13.4%, flow 9.8%, CTA 15.7%, a 2.8x swing. Section
  heights are nearly identical (720 / 809 / 809 / 992 / 809 / 481) and the
  three feature bands repeat one form exactly: `grid md:grid-cols-2 gap-12`,
  `552px 552px`, `py-32` each, a 3-node text column against one graphic.
  The modules band is denser (11 text runs, 14 nodes) but the rhythm is
  sparse, sparse, dense, sparse, CTA, not a compressed/open alternation. The
  acyclic reading applies: a uniform band measure with one denser section
  cannot establish a rhythm to play against.
- `asymmetric-split`, absent. The bands alternate sides but split
  **552px / 552px**, equal columns, `md:grid-cols-2`; the modules grid is
  `564px 564px`. Nothing on the page sets a text column against a wider
  visual or a narrow column against a broad one. Alternation is not
  asymmetry.
- `three-card-row`, absent. The modules band is a 2-column grid holding
  three cards: 564x256 at x144 and x732 (row 1), 564x256 at x144 (row 2), a
  2+1 layout, not a row of three.
- `glass-card-overuse`, absent. One `backdrop-filter` surface in the whole
  DOM: the fixed header (`glass-header`, y0-57). Below the decided 3+
  threshold by two.
- `gradient-blob`, absent. Zero `background-image` gradients anywhere in the
  DOM and no authored blur disc. What reads as a glow in the hero is WebGL
  line geometry in a canvas.
- `badge-pill-spam`, absent. Above the fold: one rounded-full outlined
  "Acessar" (h32), and the 72px language combobox, which is a functional
  control. Below the 3+ decorative-pill threshold.
- `hero-mockup-float`, absent. No product UI floats in the hero; the hero
  carries only the 3D form.
- `real-product-surface`, absent, and the doorway rule decides it. The page
  offers an "Acessar plataforma" that resolves to `/login`, and `/dashboard`,
  `/calculator` and `/tools-budget` all resolve to the same login form
  ("Entre na sua conta para continuar", email + password). A sign-in form is
  the doorway, not the surface. Nothing in the marketing chrome shows the
  product running.
- `shows-deliverable`, absent. There is no artefact at all, let alone one
  with an entry that could embarrass the vendor.
- `live-claim-control`, absent. No calculator, slider or input in the
  marketing chrome; the one `<input>` is the newsletter email field.
- `editorial-grid-break`, absent. Everything sits inside one
  `container mx-auto px-4` at 1400px, with `max-w-6xl` bands and a
  `max-w-4xl` hero. No element leaves the grid, overlaps it, or breaks it.
- `custom-type-pairing`, absent. One family reaches pixels (Inter), and the
  Outfit declaration never resolves. See `generic-sans-default`.
- `symmetric-everything`, absent by procedure: `symmetry.cjs` reports 3 of 6
  h1/h2 section headings centred, **share 0.50**, against the 0.85 cut. Consistent
  with the layout: chaos, order and flow are left-aligned two-column bands.
- `emoji-as-icon`, absent: all glyphs are Lucide SVG; zero emoji in the DOM.
- `indigo-violet-accent`, absent. The accent hue is 183 degrees (cyan), not
  the 250-270 indigo-violet band.
- `gradient-fill-cta`, absent. All three primary buttons are flat fills
  (`background-image: none`); the only gradient-shaped thing on a button is a
  hover `box-shadow`, not a fill.
- `stock-photo-generic`, absent. Zero `<img>` elements; every visual is
  WebGL or inline SVG.
- `typewriter-headline`, absent. Static H1 and H2 text; no phrase cycling in
  the DOM or the animation list.
- `testimonial-card-row`, absent. No testimonials section; the page carries
  no social proof of any kind.

**Verdict.** Net = 4 slop present − 3 craft present = **+1**, inside the
`mixed` band (-6..+3), which holds the majority of the corpus; this one is a
marketing shell whose slop is the template furniture (a centred hero, one
icon per card, a default stack, a scroll gate) and whose craft is a real
accent decision and a real type ladder, but not enough of either to leave the
band. It cannot be `slop`: net +1 is three points below the floor, and the
distinguishing prose against deepmark and stripe-2014 (both +3) fails on the
counts alone, before content. It cannot be `exemplar` either: the page has no
product surface to show, its only conversion path beyond the newsletter is
the login gate, and the scroll gate hides 20 of its 32 text nodes on load.

**Page extent.** 4990px, six sections and a footer. The caveat about thin
pages does not apply: most signals had a section to fire on, and the values
above are measurements rather than vacancies.
