---
source: https://glowcase.app/
kind: site
cohort: ai-builder
verdict: mixed
studied: 2026-10-18
context: [hero, nav, testimonials, features, stats, pricing, cta, footer]
signals:
  gradient-blob: present
  three-card-row: present
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: absent
  symmetric-everything: absent
  badge-pill-spam: absent
  generic-line-icon-set: present
  testimonial-card-row: absent
  indigo-violet-accent: absent
  gradient-fill-cta: absent
  scroll-reveal-blank: absent
  typewriter-headline: absent
  stock-photo-generic: present
  centered-hero-stack: absent
  hero-mockup-float: present
  asymmetric-split: absent
  single-optical-anchor: absent
  type-scale-high-contrast: absent
  editorial-grid-break: absent
  custom-type-pairing: absent
  real-product-surface: unresolved
  shows-deliverable: absent
  density-variation: present
  one-accent-discipline: absent
  live-claim-control: absent
materials: [single-theme, stock-photo]
---

**Sampling: random draw.** One of eight drawn with seed 20261018 from the thirty remaining gallery sites (pre-stated exclusions only: unreachable, blank, sign-in wall). Not chosen on any signal.

Rated by two independent blind raters on 2026-10-18, neither reading the other's draft. Both reached `mixed`. They agreed on 25 of 26 signals; the 1 split `real-product-surface` (A present, B absent) are recorded `unresolved`, which never counts toward a rule. Both write-ups follow in full.

**Rater A.**

**Capture.** 1440x900 viewport, `window` scroller (no inner scroller), 13 tiles,
`docH_before` 9020 = `docH_after` 9020, `clamped: false`, `coverage: 1`. Stitched to
3 strips totalling 9020px against a 9020px page (`s5strips/glowcase-A-strip0..2`);
the last strip ends in the footer (logo, Product / Resources / Company columns,
"© 2026 Glowcase", "Glowcase is a product of Warmly Labs LLC."). DOM: zero `<video>`,
zero `<canvas>`, one 1px Stripe `<iframe>`, 16 `<img>`. Single theme: body and H1
compute identically under `prefers-color-scheme: light` and `dark`, no toggle.
Probes and crops: `~/scratch/antislop/s5work/glowcase-A/`.

Page, top to bottom: a left/right hero (60px Manrope H1 "Let prospects discover /
what matters to them.", second line crimson over a gold highlighter bar; a 578x520
photo of four laughing coworkers on the right with a stylised browser card floated
over its left edge); a five-mark logo strip; a centred Instrument Serif H2 over a
stylised "Product tour · Editing" editor; three alternating text/panel feature bands
(guided opening, Ask Glowcase chat, discovery recap); a dark four-step "how it works"
band; a 2x2 grid of photo use-case cards; a stats band plus three numbered cards;
three "Example demos" cards; a pricing teaser; a crimson CTA band; footer.

### Slop present (5)

**`gradient-blob`.** Four `rounded-full` discs under `filter: blur()`: in the hero
`bg-gold/35` 420x420 at (1148,-27) and `bg-lilac/30` 380x380 at (-160,357), both
`blur(64px)`; in the closing CTA band `bg-gold/40` 256x256 and `bg-lilac/40` 288x288,
both `blur(40px)`, over a 1280x410 `linear-gradient(135deg, #dd385b, #f66c6d)` card.
They paint (the prilo-ai check): hiding all four changes 11.5% of the hero viewport's
pixels by a channel delta of 8 or more, and 8.2% of the CTA viewport.

**`three-card-row`.** Two literal three-ups, neither a carousel. "Shorten sales cycles /
Improve win rates / Create more pipeline" is a static grid of three equal cards
(`grid-template-columns: 402.656px 402.672px 402.656px`), each a coloured `01/02/03`
chip, an 18px head and one sentence. "Example demos" is three equal 397x300 cards
(`397.328px 397.328px 397.344px`). The stats band above them is also three columns,
but inside one dark panel, so it is not counted as cards.

**`generic-line-icon-set`.** 32 inline SVGs, every one a Lucide glyph
(`class="lucide lucide-…"`) at `stroke-width: 2`. Six sit in marketing chrome, all
14px, all crimson, each beside a label it restates: `sparkles` on "Interactive product
demos" (y157) and again on "Adaptive discovery" (y3529), `compass` on "Adaptive
demos", `message-circle` on "Ask Glowcase", `git-branch` on "Branching paths",
`calendar-days` on "Talk to us". The rest are inside the stylised product panels and
out of scope. Literal definition met (one set, uniform size and stroke, carrying
nothing the label does not); see near-misses for why it is the softest slop call.

**`stock-photo-generic`.** Seven photographs, all generic stock: the hero
`hero-team-CMYuSj-c.jpg` (1280x1600, four coworkers laughing at an off-frame screen;
alt "A product marketing team reacting to an interactive demo on screen", but no
demo is visible in the frame), under a `from-ink/45` to-top scrim; four use-case
photos (a woman at a monitor, a sales pair at a sticky-note glass wall, a woman
smiling at a laptop, a presenter before an audience); and the "how it works" photo
of a woman sketching at a desk. None shows Glowcase or anything specific to this
company. Each could front any B2B SaaS page.

**`hero-mockup-float`.** A stylised browser card, 360x202 at (722,451), radius 20px,
`box-shadow: 0 18px 50px -20px rgba(38,32,28,.28)`, overhangs the hero photo's left
edge (photo at x762) by 40px. Its content is grey placeholder bars, a pink circle
cursor and a "Start here / Buyers click through the flow… / 2 of 6 / Back / Next"
tooltip that drops below the photo. A second floated chip, "Published Glowcase"
172x45, overhangs the photo's right edge. No tilt (`transform: none`). An invented
UI floated over a photograph is the case the signal records.

### Craft present (2)

**`real-product-surface`.** Present on one genuine capture, and only one. The third
"Example demos" card (labelled "Real demo · Glowcase") shows `example-glowcase.jpg`,
a 1200x632 screenshot of the Glowcase app itself: sidebar Dashboard / Interactive
Demos / Lead Intelligence / Engagement Analytics / Plan, "Welcome, Avery.", four
counters, a "9 days left in your trial" banner and the account
`averywarmly@gmail.com`. It renders at 353x144, `object-fit: cover`,
`object-position: 50% 0%`. The first card's `example-warmly-cards-adaptive.jpg` is
also genuine: the full file carries the same "Make Someone's Card / Click here to
start the card creator. / Back / 1 of 4 / Next" tooltip that the live player shows at
`/d/make-someone-feel-special-with-a-custom-warmly-card-gh0a` (opened and screenshotted
this session), but the top-anchored crop hides that tooltip on the page, so only the
customer's screen shows. Everything page-authored is stylised: the hero card and the
"Product tour · Editing" editor are grey placeholder bars, and the "Ask Glowcase"
panel is a light bubble chat where the live panel (opened on the same demo) is a dark
input reading "Ask a question about what you're seeing." This is the most
contestable craft call; see near-misses.

**`density-variation`.** Measured two ways over the stitched page, by section. Ink
(pixels more than 60 summed RGB units from the band's modal background) runs from
2.9% ("Talk to us") and 3.0% (footer) through 4.7-7.7% (the four feature bands) to
22.1% (stats band) and 23.4% (example demos), with photo bands at 28-33% and the CTA
band at 61.5%. Text nodes per 1000px of height run from 7.0 (CTA band) and 11.6
("Talk to us") to 37.3 (use cases) and 40.4 (the dark four-column "how it works").
About a 6x spread on both measures. The four consecutive feature bands are uniform
(4.7-7.7% ink, 18-28 nodes/1000px), so the variation comes from the dark band, the
stats band and the card grids: real, but not large.

### Near-misses, each with what settled it

- **`indigo-violet-accent` → absent.** The palette declares `--lilac: #b897f0`, hue
  263°, and paints it as the two blooms above, the "Customer success" card fill
  (608x319 at 30% alpha), the third example card (397x300 at 30%) and three small
  badges ("3" 48px, "03" 40px, a 55x16 bar). Literally "the hue, in a fill". Absent on
  the databuddy and linear-app reasoning: lilac is one of four rotating pastel tints
  (`--sky` 199°, `--gold` 41°, `--mint` 155°, `--lilac` 263°), never on a CTA, link
  or text, and it renders pale. In the hero outside the photo, pixels at chroma ≥25
  are 71.5% hue 0-60° (gold), 28.4% crimson and 0.1% violet; page-wide, violet at
  chroma ≥25 is 0.1% of samples and the lilac washes (chroma 15-25) 1.35%. The accent
  is crimson `#dd385b`. A literal reader scores present: net +4.
- **`generic-line-icon-set` → present, softest slop call.** The glyphs are 14px
  eyebrow decorations inside pills, not a feature-card icon grid; the page's actual
  feature cards use numbered chips and photographs. Present on the literal definition,
  as referable-dev (17px list bullets) and permit-guide-ai (Lucide at uniform 2px)
  were. A feature-grid reading gives absent: net +2.
- **`real-product-surface` → present, softest craft call.** The one capture of
  Glowcase is an empty-state trial dashboard (all four counters `0`, a "Build with AI
  / Build automatically / Start manually" banner), rendered at 353x144 where its
  labels come to about 3px (0.294 scale on ~11px source text). A rater who reads an
  empty dashboard under "the doorway is not the surface" (the product has not answered
  yet), or who will not credit a capture nobody can read, scores absent: net +4. Held
  present because the definition carries no size or emptiness clause, the capture is
  inside the product rather than an auth gate or install step, and stripe-2014's
  Checkout passes with empty fields.
- **`generic-sans-default` → absent.** One face, Manrope 400-800, carries display and
  body (`document.fonts` loads Manrope, Instrument Serif 400, Work Sans 400/600/700).
  Absent on dipole-labs' ruling that Manrope is not the neo-grotesque default the
  signal names, and the display sizes carry a tracking ladder: -2.1px at 60px (-3.5%),
  -1.44px at 48 (-3%), -0.6px at 30 and -0.4px at 20 (-2%), eyebrows +1.98px at 11px;
  body at `normal`. A rater who scores any single free Google sans carrying everything
  as present gets net +4.
- **`type-scale-high-contrast` → absent at exactly 3.75:1.** `ladder.cjs`: largest
  lettered node 60px (the H1 and the Instrument Serif H2) over a 16px body, ratio
  3.75, on the threshold. The threshold rules out, it does not rule in, and the five
  corpus files at 3.75 split. Absent because the top of the ladder is not set apart:
  the H1 ties a mid-page H2 at 60px and stands 1.25x over eight 48px section heads,
  so the page runs one uniform heading-to-body step (48/16 = 3.0) rather than a
  display moment. Present gives net +2.
- **`custom-type-pairing` → absent.** Manrope sets 11 of 12 headings at 30px or above
  (60, 48, 30px at 800) and all body copy (14-18px at 400). Instrument Serif sets
  exactly one node, the centred H2 "Teach Glowcase about your product…" at 60px. Work
  Sans appears only between y1238 and y2077, the same `#product` section (its 18px
  lede, a 24px H3 and the editor mock's labels). A serif used once and a third face
  scoped to one section is a section override, not two faces each with a job; on
  dipole-labs' test there are crossings everywhere (Manrope does both jobs). A rater
  who counts serif display plus sans body gets net +2.
- **`asymmetric-split` → absent.** Every marketing split is near 50/50 by
  `grid-template-columns`: hero 606/578 (1.05:1), "Your demo shouldn't be the same…"
  and "Let buyers ask…" 596/596, "Your demo shouldn't just show…" 568/624, use cases
  608/608. The sides alternate, which reads as rhythm, but no column is given more
  room than the other (prilo-ai's "five exact 50/50s" ruling). The 192/750/208 split
  is inside the editor mock, out of scope.
- **`badge-pill-spam` → absent.** Above the fold, marketing chrome holds two pills: the
  "Interactive product demos" eyebrow (263x31) and the floated "Published Glowcase"
  chip (172x45). The "glowcase.app/d/product-tour", "Back" and "Next" pills are inside
  the floated card. 2 < 3. Page-wide there are four eyebrow pills (Interactive product
  demos, Adaptive demos, Ask Glowcase, Adaptive discovery); the decided rule counts
  above the fold only.
- **`symmetric-everything` and `centered-hero-stack` → absent.** 9 of 12 headings at
  30px or above are left-aligned (at x100 or x744); the three centred ones are the
  serif H2, the pricing teaser and the CTA band. The H1 computes `text-align: start`
  at x100 inside the 606/578 grid.
- **`scroll-reveal-blank` → absent, three ways.** 242 text nodes; 0 under 8% effective
  opacity (ancestor-multiplied) at rest, 0 revealed by a 14-step 700px walk (7.7s),
  0 under 8% after a matched 7.7s dwell. Two transformed elements page-wide.
- **`typewriter-headline` → absent.** H1 text identical across 8 samples over 12s.
- **`glass-card-overuse` → absent.** One `backdrop-filter` surface, the sticky header
  (`blur(8px)`).
- **`gradient-fill-cta` → absent.** Every primary button ("Build your first demo" x2,
  "Start free trial") is flat `#dd385b` with `background-image: none`. The gradient is
  the CTA band's 1280x410 card, not a button; its own button is flat cream.
- **`emoji-as-icon` → absent.** Zero `Extended_Pictographic` characters in 242 text
  nodes.
- **`testimonial-card-row` → absent.** No quotes anywhere. Social proof is a five-mark
  strip, "Powering product demos for": Warmly Cards, Scientifically, Warmly Fit, Oli,
  SATPrep. Recorded as fact, not scored: two of the five are Warmly Labs products, the
  footer names Warmly Labs LLC as Glowcase's maker, and two of the three "Example
  demos" are of those same two products.
- **`shows-deliverable` → absent; no entry could embarrass the vendor.** Searched: the
  Sales card's "Step completion" funnel (92 / 78 / 64 / 61 / 44%, 10px, legible) is
  ordinary drop-off and is the capability the card sells, excluded on referable-dev's
  funnel ruling; the Ask Glowcase answer ("Yes. You can configure the agent's brand
  voice and guardrails.") and the discovery recap only flatter; the stats band (19
  days faster, 6% higher win rate, 3.2x conversion, "Source: 2026 interactive demo
  industry research.") is an unnamed industry aggregate that can only flatter;
  "Adaptive Demos are a Business capability" is a tier gate, the "Enterprise only"
  case the vocabulary excludes, and vendor prose besides. The nearest real concession
  is inside the Warmly Fit thumbnail, its coach's "It's a stretch… Consider shifting
  your objective", but that is the sister product's output, not Glowcase's, and it
  renders at about 3px.
- **`one-accent-discipline` → absent.** Crimson `#dd385b` takes CTAs, eyebrows and the
  H1's second line (92 elements compute it as text colour), but gold `#f8bd40` takes text too: the stats
  band's three 48px numerals ("19 days", "6%", "3.2×") and the hero's 606x12
  highlighter bar. Sky, lilac and mint rotate through step badges and card fills. At
  least two accents with text roles.
- **`single-optical-anchor` → absent (rule-ineligible, recorded honestly).** Counted in
  the hero, the only place an anchor could sit: four masses compete, the 578x520
  photo (saturated orange and red clothing), the 60px headline with its crimson half
  and gold bar, the floated 360x202 card with its tooltip, and the "Published
  Glowcase" chip. No one mass dominates, and it is not a one-mass page.
- **`editorial-grid-break` → absent.** All content sits in the 1240px container
  (x100-1340). The only overhangs are the floated card and chip (already
  `hero-mockup-float`) and the CTA band at x80-1360, a 20px inset band, not a break.
- **`live-claim-control` → absent.** Every product panel is static markup. "See one in
  action" anchors to `#sample-demo`, the three thumbnails, whose "View demo" links
  leave the page (the Glowcase one is behind a lead form). No on-page control can test
  the claim.

### Verdict: `mixed`, net +3

Slop present 5 (`gradient-blob`, `three-card-row`, `generic-line-icon-set`,
`stock-photo-generic`, `hero-mockup-float`) against craft present 2
(`real-product-surface`, `density-variation`): 5 − 2 = **+3**, the top of the mixed
band, level with deepmark and stripe-2014.

It does not reach the `slop` gate, and its slop set gives no grounds to write a
separation from those two files even if one flip pushed it there. Every slop signal
present here is present in one of them: four of five in **stripe-2014** (its set
minus `indigo-violet-accent` and `gradient-fill-cta`, plus `stock-photo-generic`), and
three of five in **deepmark** (`generic-line-icon-set`, `stock-photo-generic`,
`hero-mockup-float`), which additionally carries `generic-sans-default`,
`symmetric-everything`, `badge-pill-spam` and `centered-hero-stack`, all measured
absent here. Glowcase's craft is stripe-2014's minus `asymmetric-split`. The page's
template tells are the soft-palette ones (two blurred bloom pairs, Lucide eyebrows,
stock people, a floated wireframe card), not the axis-locked, gradient-button,
scroll-gated set that marks openhack and heroku-2014.

Sensitivity, so a second rater can see where it moves. Three flagged calls each move
net one step toward slop (`indigo-violet-accent` present, `real-product-surface`
absent, `generic-sans-default` present: each +4), and three move it one step toward
exemplar (`generic-line-icon-set` absent, `type-scale-high-contrast` present,
`custom-type-pairing` present: each +2). At +4 the slop set would still be a near
subset of stripe-2014's, so the separation the `slop` verdict requires could not be
written on any single flip. Page height 9020px, so this is not a thin page scoring
well for lack of places to fire.

**Rater B.**

**Rater B.** Blind: no other rater's draft or capture was opened.

Glowcase sells AI-assisted interactive product demos ("a product of Warmly Labs
LLC"). One page, cream single theme, rose primary. Thirteen sections and a
footer: a two-column hero (headline left, photo right with a floating browser
card), a five-mark customer strip, a centred serif "Teach Glowcase" section with
a page-authored three-pane editor, three alternating 50:50 feature bands (Guided
opening, Ask Glowcase, Discovery recap), a dark four-step "How it works" band, a
2x2 use-case grid of photos with overlay panels, a stats band plus a 01/02/03
row, three "Example demos" cards, a "Talk to us" strip, a pricing summary box,
and a rose closing CTA panel. Not thin: 9020px, so most slop signals had
somewhere to fire. Values below come from computed style, network responses,
image metadata and DOM walks; the strips were used to orient, not to measure.

## Capture

- 1440x900, `shoot-tiles.cjs`: 13 tiles, `clamped: false`, `coverage: 1`,
  `docH_before` 9020 = `docH_after` 9020, scroller `window` (the only inner
  candidate is `html` at 9020/900).
- `stitch.py`: 3 strips, 4400 + 4200 + 420 = 9020px against a 9020px page, zero
  drift. The last strip ends in the footer (Product / Resources / Company columns,
  "© 2026 Glowcase", "Glowcase is a product of Warmly Labs LLC.").
- No `<video>`, no `<canvas>`; the only `<iframe>` is Stripe's 1px telemetry
  frame. All 16 `<img>` are accounted for below.
- The hero visibly moves, so its animations were read rather than trusted to the
  walker: `document.getAnimations()` returns 5, `glow-rise` (hero text, one
  iteration), `glow-float` (the hero browser card, infinite) and three
  `glow-pulse-ring` cursors. None hides text after load (see
  `scroll-reveal-blank`).

## Slop signals present (5)

**`gradient-blob`.** Four blurred discs, all `rounded-full`,
`pointer-events-none`, absolutely positioned: 420x420 `blur(64px)` gold at 35%
alpha off the hero's top right (x1148, y-27); 380x380 `blur(64px)` lilac at 30%
off the hero's left (x-160, y357); and inside the closing CTA panel a 256x256
`blur(40px)` gold/40 (x16, y8120) and a 288x288 `blur(40px)` lilac/40 (x1112,
y8386). The hero's left blob renders faint (pixel samples `rgb(234,218,238)`,
chroma 19-20, hue ~290) but is visible as a lavender haze in the strip; the
top-right gold glow is plainly visible. The template ornament, at both ends of
the page.

**`three-card-row`.** Literal three-ups of equal cards, measured off the grid
children: the `01 / 02 / 03` row (Shorten sales cycles / Improve win rates /
Create more pipeline) is three 403x192 cards at x100, x519 and x937, y6467, each
a numbered chip, a heading and one line; the stats band directly above it is
three 413x206 cells; "Example demos" is three 397x300 cards at y6987. The
01/02/03 row restates the three stats above it in prose, the filler form of the
pattern.

**`generic-line-icon-set`.** Outside the page-authored mockups (excluded by
scope), the page's marketing-chrome icons are one set: five Lucide glyphs, all
14x14, `stroke-width` 2 (Lucide's default, unaltered), all `#dd385b`, each inside
a 31px eyebrow pill beside its label: `sparkles` / "INTERACTIVE PRODUCT DEMOS",
`compass` / "ADAPTIVE DEMOS", `message-circle` / "ASK GLOWCASE", `sparkles` /
"ADAPTIVE DISCOVERY", `calendar-days` / "TALK TO US". Uniform stroke and size,
and none carries anything its label does not. The weakest of the five present
calls; see near-misses.

**`stock-photo-generic`.** Six photographs, none of the vendor's product, team
or customers: the hero `hero-team-CMYuSj-c.jpg` (1280x1600, shown 578x520; four
people laughing at a laptop), `story-craft` (a woman sketching at a desk, shown
384x176) and four `use-*` squares (900x900, shown 317x317: a woman at a
monitor, two people at a sticky-note wall, a woman at a laptop, a presenter to a
room). Each could belong to any B2B company. The hero carries a bolted-on scrim,
`linear-gradient(to top, ink/45 0%, transparent 50%)`, over the photo's lower
half where the floating card sits.

Provenance, recorded because the vocabulary has no token for it: none of these
is licensed stock. The hero JPEG carries a C2PA manifest (`claim_generator_info`
"OpenAI Media Service API", `softwareAgent` `gpt-image`, `digitalSourceType`
`trainedAlgorithmicMedia`, `c2pa.created` 2026-09-11); the other five carry XMP
`Iptc4xmpExt:DigitalSourceType` = `trainedAlgorithmicMedia`. They are
machine-generated photographs in the stock role. I scored the signal on the
decision it names (interchangeable imagery), not on the licence, and listed the
material as `stock-photo` as the nearest descriptive token. **Vocabulary gap:**
there is no material for generated photography, and the ai-builder cohort will
keep producing it.

**`hero-mockup-float`.** The hero card is `glow-float absolute -left-10 bottom-4
w-[74%]`: absolutely positioned, overhanging the photo's left edge by 40px, on
an infinite float animation. Its content is a stylised window: traffic-light
dots, `glowcase.app/product-tour`, grey placeholder bars (`bg-foreground/25`,
`bg-cream/25`), a pulsing cursor ring, and a tooltip "Start here / Buyers click
through the flow at their own pace, one guided step at a time. / 2 of 5 / Back /
Next". The tooltip's shape is faithful to the real player (checked on the live
`/d/train-for-a-marathon-with-warmly-fit-ai-coaching-3tnb` demo: "Phase Plan /
... / Back / 1 of 6 / Next: Daily coaching"), but it sits on placeholder bars, so
the window as a whole is an invented UI floating in the hero.

## Craft signals present (1)

**`density-variation`.** Text characters per 100px of section height, over the
13 top-level sections: logo strip 36, closing CTA 38, Talk to us 54, hero 63,
Example demos 81, Teach/editor 89, Adaptive and Ask bands 93 each, How it works
105, use-case grid 105, stats + 01/02/03 109, pricing box 110, Discovery band
160. A 4.4x spread, and it reads as pacing in the strip: a near-empty logo strip
after the hero, a 1257px editor section, a dense dark four-step band, then a
sparse "Talk to us" strip and an airy CTA panel. Soft, as this signal always is
(no procedure exists); held present on the spread and the alternation, the
corpus's usual basis.

## Near-misses, and what settled each

- **`generic-line-icon-set` (present, weakest).** The page avoided the
  feature-icon grid entirely: the steps and the 01/02/03 row use numbers, the
  features use mockups. The five glyphs are 14px eyebrow ornaments across 9020px.
  The definition is satisfied literally (one set, uniform stroke and size,
  nothing beyond the label), and referable-dev counted four 14px Lucide checks on
  the same reading, so present. Flip: net +3.
- **`real-product-surface` (absent, the strongest counter-case).** One genuine
  capture of Glowcase's own UI exists: `example-glowcase.jpg`, natural 1200x632,
  the real builder dashboard (sidebar Dashboard / Interactive Demos / Lead
  Intelligence / Engagement Analytics / Plan, "Welcome, Avery.", "9 days left in
  your trial"). It is shown as a 353x144 `object-cover` thumbnail inside a link
  card, its text at roughly 3-4px, and it is the empty state: Total demos 0,
  Published 0, Leads captured 0, Total views 0, under a "Turn your screenshots
  into an interactive demo" prompt. The product has not answered yet, which is
  the doorway rule, and it is thumbnail-scale (50,832px², 0.4% of page area; the
  standard-machines scale-and-role reasoning). The other two thumbnails are
  genuine too (`example-warmly-fit.jpg` matches the live demo's step-1 screen),
  but they show the customers' apps with no Glowcase player chrome: a demo's
  input, not Glowcase's surface. Every at-scale product depiction (the hero card,
  the "Product tour · Editing" editor with an invented `acme.app/workspaces` bar
  chart, the four step cards, the use-case overlays) is page-authored over
  placeholder bars. The Guided opening / Ask Glowcase / Discovery recap panels
  carry plausible text but could not be checked against the product: the one
  Glowcase-made live demo is gated behind a five-field lead form ("Before We
  Begin"), and the pricing box puts adaptive features on the Business tier.
  Flip: net +3.
- **`shows-deliverable` (absent).** Named candidates, none of which could
  embarrass the vendor. The Discovery recap (14px, legible) lists only interest:
  "Explored trusted-content grounding and response validation across two
  sessions. Asked about Salesforce/HubSpot integrations, brand-voice controls,
  independent workflow building, and workflow pricing." The Ask Glowcase panel
  answers its own question: "Yes. You can configure the agent's brand voice and
  guardrails." The stats band ("19 days FASTER", "6% HIGHER WIN RATE", "3.2× DEAL
  CONVERSION", "Source: 2026 interactive demo industry research") is an industry
  aggregate, absent by precedent. The closest is the Sales card's "Step
  completion" funnel at 10px (92% / 78% / 64% / 61% / 44%), which shows
  prospects abandoning a demo; but the card sells exactly that view ("then see
  what they chose, asked, and viewed"), so drop-off display is the capability,
  excluded as databuddy's error card and stripe-com's disputes were. The pricing
  line "Adaptive Demos are a Business capability" is a tier gate in prose, not
  an entry in an artefact.
- **`indigo-violet-accent` (absent).** Lilac `#b897f0` (HSL 262) is a declared
  token used as a category tint: the hero's left blob, the CTA panel's second
  blob, step marker 3, chip "03", the Customer success card and the third
  example card at 30%. It is one of four rotating category colours (sky
  `#72c7ee`, gold `#f7bd40`, lilac, a green), never on type and never on a
  control. Hero viewport below the nav: 17.8% of pixels chromatic (chroma ≥ 24),
  of which orange 56.8%, red 28.8%, yellow 12.9%, indigo/violet 0%. The accent is
  `--primary-brand` `#dd385b`, HSL 347. Same reading as databuddy's re-study: a
  violet that is one of several rotating markers is not the accent.
- **`symmetric-everything` (absent), by the corpus alignment count.** 28 of 32
  h1-h3 and 207 of 234 text leaves are start- or left-aligned; centred are the
  logo label, the serif "Teach" heading, the pricing box and the closing CTA.
  The counter-case is column geometry, the gap prilo-ai recorded: every split is
  even (hero 606/578, 51:49; Adaptive 596/596; Discovery 568/624) and every grid
  is equal-column (3-up, 4-up, 2x2). Flip: net +5.
- **`gradient-fill-cta` (absent).** Every button is flat: `#dd385b` on the
  primaries, cream on the secondaries. The closing CTA panel is a two-stop
  `linear-gradient(135deg, #dd385b, #f66c6d)` 1280x410 container, but the
  buttons on it are flat cream. A gradient card is not a gradient button.
- **`badge-pill-spam` (absent).** Above the 900px fold, two decorative pills: the
  "INTERACTIVE PRODUCT DEMOS" eyebrow (263x31) and the "Published Glowcase" chip
  on the photo. The "Back" pill is inside the mockup. Four more eyebrow pills sit
  below the fold, where the threshold does not look.
- **`generic-sans-default` (absent).** Manrope, served from Google Fonts in one
  `css2` request with Instrument Serif and Work Sans. Manrope is not the
  neo-grotesque default (dipole-labs' ruling on the same face), and the display
  is tracked per size: 60px at -2.1px (-0.035em), 48px at -1.44px (-0.03em), 30px
  at -0.6px, uppercase labels at +1.6 to +1.98px.
- **`custom-type-pairing` (absent).** Manrope carries the H1, eleven of twelve
  H2s, the stat figures and all body copy outside one section. Instrument Serif
  sets exactly one node (the centred 60px "Teach Glowcase about your product.
  Then let buyers explore it."); Work Sans appears only inside that same section
  (its two 18px paragraphs, a 24px H3 and every mockup label). The extra faces
  are assigned by section, not by role: one section speaks in a second voice and
  the rest of the page never does. Not a pairing.
- **`type-scale-high-contrast` (absent) at exactly the cut.** `ladder.cjs`:
  `ratio 3.75` (60/16), `ratioSub 3.33` (18px hero subhead). The top is flat: H1
  60, serif heading 60, then 48px on eight H2s and three stat figures, 30, 24.
  The H1 is 1.25x the next tier: the databuddy and decent-com shape, both absent.
- **`one-accent-discipline` (absent).** Rose `#dd385b` does the interactive and
  emphasis work (16 fills, 14 text runs including "what matters to them.", 75
  SVG stroke nodes). Gold `#f7bd40` is a second accent on display type: all three
  48px stat figures and the bar under the H1's rose line. Sky, lilac and a green
  code the steps and cards on top.
- **`scroll-reveal-blank` (absent).** Walk (600px steps, 900ms settle) against a
  dwell control of identical duration: at rest 170 eligible text nodes, 22,469
  characters, 0 under 8% opacity; after the walk 0 crossed, 0 stuck, 0 newly
  mounted; the dwell likewise 0. `loading="lazy"` on the eight below-fold images
  withholds no text.
- **`typewriter-headline` (absent).** Eight snapshots of every text node over 14s
  at rest: 0 changed. The H1 is identical at 3, 6 and 9s.
- **`live-claim-control` (absent).** The page has 34 interactive elements and
  all are `<a>` links: no button, input, select or tab. "See one in action" is an
  anchor to `#sample-demo` (it scrolls to the example cards at y6755); the cards
  open `/d/` pages. The claim can be tested, on another page, and the
  Glowcase-made demo only after a lead form.
- **`single-optical-anchor` (absent, rule-ineligible).** What I counted: the
  hero is two near-equal masses, the 606x527 headline column and the 578x520
  photo, with the floating card's pulsing cursor as a third focus. Below the fold
  every section repeats a heading-plus-panel pair, and two late masses (the dark
  step band, the rose CTA panel) compete. No one mass dominates, and this is not
  a one-mass page where dominance would be automatic.
- **`asymmetric-split` and `editorial-grid-break` (absent).** Splits measured
  above, all within 48-52%. Everything sits in the 1280px container (x80-1360);
  the only overhang is the floating hero card's 40px, which is the mockup float,
  not a break in the type grid.
- **`glass-card-overuse`, `emoji-as-icon`, `centered-hero-stack`,
  `testimonial-card-row` (absent).** One `backdrop-filter` on the page, the
  sticky header's `blur(8px)`. No pictographic glyph outside the footer's "©".
  The hero is two columns, H1 `text-align: start` at x100. Social proof is a
  five-mark logo strip with no quote cards (`testimonials` is in `context` for
  the strip alone).

## Verdict: mixed, net +4 (5 slop, 1 craft)

Net +4 meets the necessary floor. I cannot write the separation the rule
requires, so the verdict is `mixed`.

A slop call needs a difference from deepmark (+3: 7 slop, 4 craft) and
stripe-2014 (+3: 6 slop, 3 craft) that a second rater can check. The only one
available is craft: deepmark keeps a role-assigned pair (Space Grotesk / Geist),
an asymmetric split, one accent and density; stripe-2014 keeps an asymmetric
split, a real product capture and density; Glowcase keeps density only, and its
type pair, splits, accent and capture are each measured absent above. On the
slop side, though, the page is lighter than both anchors, not heavier: 5 slop
signals against their 6 and 7. Slop is a density, and this page's template
density sits below the two files that define the top of `mixed`. It declines
glass, pill spam, gradient buttons, scroll gating, a testimonial row, a
typewriter, the centred hero and the indigo palette; its display type is tracked
per size; its accent is a rose on cream, not the AI violet.

The +4 also rests on two calls recorded as near-misses, either of which flips it
to +3: `generic-line-icon-set` on five 14px eyebrow glyphs, and
`real-product-surface` withheld from a genuine but thumbnail-sized, empty-state
dashboard capture. A slop verdict that one marginal flip undoes is the contested
slop the brief warns against. The flips the other way (`symmetric-everything` by
column geometry, or `density-variation` withdrawn as soft) give +5, but neither
changes the comparison: the slop count would still be at or below stripe-2014's.

Measurably, the page is a competent template carrying four archetypal moves
(blobs, three-ups, generated stand-in photography, a floating fake window) plus
an icon habit, and almost none of the decisions that earn craft. That is a
`mixed` with little craft, not a `slop` with dense tells.
