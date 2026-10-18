---
source: https://toppic.app/
kind: site
cohort: ai-builder
verdict: slop
studied: 2026-10-18
context: [hero, nav, features, stats, testimonials, cta, footer]
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
  gradient-fill-cta: absent
  scroll-reveal-blank: present
  typewriter-headline: absent
  stock-photo-generic: present
  centered-hero-stack: present
  hero-mockup-float: absent
  asymmetric-split: present
  single-optical-anchor: unresolved
  type-scale-high-contrast: present
  editorial-grid-break: absent
  custom-type-pairing: absent
  real-product-surface: absent
  shows-deliverable: absent
  density-variation: absent
  one-accent-discipline: absent
  live-claim-control: absent
materials: [single-theme, stock-photo]
---

**Sampling: random draw.** One of eight drawn with seed 20261018 from the thirty remaining gallery sites (pre-stated exclusions only: unreachable, blank, sign-in wall). Not chosen on any signal.

Rated by two independent blind raters on 2026-10-18, neither reading the other's draft. Both reached `slop`. They agreed on 24 of 26 signals; the 2 splits `gradient-blob` (A present, B absent), `single-optical-anchor` (A absent, B present) are recorded `unresolved`, which never counts toward a rule. Both write-ups follow in full.

**Rater A.**

Rater A, blind. New page, no prior study, so no drift section. No other rater's draft was
read.

**Capture.** 1440x900 viewport. Page height 8296px, window scroller (the only candidate was
`html.light` at 8296). 12 tiles, `clamped: false`, `coverage: 1`, last landing 7396 (the
browser's docH-900 clamp, expected). Stitched to 2 strips, 8296px against 8296px, no drift.
The last strip ends in the footer (Plataforma / Ayuda / Legal columns, copyright, "Hecho
con ... para fotógrafos de todo el mundo"). Tiles in `~/scratch/antislop/s5/toppic-A/`,
strips `s5strips/toppic-A-strip{0,1}.png`, probes in `s5work/toppic-A/`. One capture
artefact to know about: "Toppic en números" is a JS count-up, so the strip shows mid-run
values (25 / 302 / 323 / 13.183); every figure reads `0` at rest before scrolling and
settles at 27 / 332 / 355 / 14.497 in the DOM after a walk. The page is a Vite + React SPA
on Supabase (`featured_contests` REST call), Tailwind/shadcn class names throughout, one
forced light theme (`html.light`, no toggle; an emulated dark `colorScheme` still paints
the body `rgb(255,255,255)`).

Bands, in order: full-bleed photo hero (900px); "Cómo funciona" three steps (665); dark
"Aprieta el botón" band holding one 256px round button (779); "Concursos activos ahora",
a bento of three live contests (1082); coral "Toppic en números", four figures (562);
"MEJORES FOTOS", a 4x2 photo grid (1069); blog teaser, three cards (658); "Han confiado en
toppic", three quote cards (670); organiser logo wall, four logos (435); dark organiser
CTA (506); coral "Únete a la comunidad" CTA (604); footer (366).

## Slop signals present (10)

**`gradient-blob`.** Six `rounded-full blur-3xl` discs (`filter: blur(64px)`), all
`bg-primary` coral, none carrying text, data or imagery. Scored on what paints, per the
prilo-ai precedent. Two do not paint measurably (the "Cómo funciona" pair: 384px, 5% fill,
under an `opacity-30` parent). Four do. In the dark band, two 256px discs at 30% and 20%
fill under an `opacity-20` parent move the `rgb(17,24,39)` field (chroma 22) to
`rgb(28,27,42)` at both disc centres, R +11: two warm halos either side of the button
(9x9-averaged pixels on tile 02 at page (488,1888) and (952,2022), against (100,1700) and
(1380,2250)). In the contests band, two 448px solid-coral discs under an `opacity-[0.04]`
parent, parked at `-top-32 -right-32` and `-bottom-32 -left-32`, paint `rgb(253,248,248)`
(chroma 5) against `rgb(255,255,255)` (chroma 0) at a white reference in the same band,
and show in the strip as a banded pink wash at the band's top right. Faint, but a shape
with an edge rather than a uniform field, which is the line prilo-ai's chroma-2 field did
not cross. Crops: `s5work/toppic-A/crop-blob-dark.png`, `crop-blob-concursos.png`.

**`three-card-row`.** The blog teaser is `grid-template-columns: 346.656px 346.672px
346.656px`: three 347x286 cards at x176 / 547 / 917, white, 1px `rgb(226,232,240)`, 12px
radius, each a thumbnail, a category pill, a 16px/700 title and a two-line excerpt. "Cómo
funciona" is the same module without card chrome (`298.656px` x3: three 299x236 columns,
each a 128px gradient ring, a number badge, a 20px H3 and one sentence), vizleads' shape.
The quote triplet is scored separately below; the signal stands on the blog row alone.

**`glass-card-overuse`.** Five `backdrop-filter` surfaces against the decided 3+: the fixed
header (1440x65, `blur(4px)`, `rgba(255,255,255,.95)` once scrolled), the three step discs
(120x120, `blur(8px)`, `rgba(255,255,255,.95)`, inset 4px inside each gradient ring) and
the `DESTACADO` pill (111x29, `blur(4px)` on solid coral). Present by the decided count. It
is a CSS fact rather than a visual one, the databuddy / prilo-ai shape: at 95% white the
discs frost nothing visible and the pill is opaque. Dropping the pill (it sits on a
live-data card) still leaves four.

**`generic-sans-default`.** 126 of 126 visible text leaves compute `ui-sans-serif,
system-ui, sans-serif, "Apple Color Emoji", ...`, Tailwind's default stack.
`document.fonts` holds 0 faces and the network log has 0 font responses. The 72px/900
display and the 16px body are one OS face (SF Pro on the capture Mac); `ladder.cjs` reports
`bigFamilies` and `smallFamilies` both `["ui-sans-serif"]`. Same finding as prilo-ai and
acyclic. The wordmark is a PNG (`toppic-logo-new-*.png`, 1099x263), not type.

**`symmetric-everything`.** 11 of 12 visible H1/H2 compute `text-align: center`, each over a
centred subhead, over an even grid or a single centred object: hero, steps (3 x 299), the
one-button band, the four-figure band, the photo grid (4 x 280), blog (3 x 347), quotes
(3 x 357), logo wall (4 x 250), both CTA bands. The one exception is real: "Concursos
activos ahora" is start-aligned at x160 against an end-aligned deck, over a 2:1 bento
(credited under `asymmetric-split`). By text leaf the count is 78 start/left, 50 centre, 1
right, but the start-aligned leaves are card interiors (contest, blog and quote cards), nav
and footer links. Present on the deepmark precedent, which holds `symmetric-everything` and
`asymmetric-split` together for the same reason.

**`generic-line-icon-set`.** One set: every SVG on the page is `lucide` (34 at rest plus the
three step glyphs that mount on scroll), `stroke-width="2"` on all but the 80px radar pin
(2.5), sizes in fixed tiers (12, 16, 20, 24, 32, 40, 48px). Each restates its label:
`map-pin` over "Estás en un lugar", `camera` over "Haces una foto y participas", `users`
over "Creas memoria colectiva"; `trophy` / `users` / `camera` / `thumbs-up` (24px, white)
over "Concursos organizados" / "Participantes" / "Fotografías compartidas" / "Votos
emitidos". None carries anything its heading does not.

**`testimonial-card-row`.** "Han confiado en toppic" is three quote cards and a "Ver todos
los casos de éxito" link: `357.328px 357.328px 357.344px`, three 357x331 cards at y5902,
identical white fill, 1px `rgb(226,232,240)` border, 16px radius, a 28px `lucide-quote` at
30% coral, the quote, a rule, a 40px logo or placeholder `lucide-user`, name and role. Not a
carousel: no element in the section has `scrollWidth > clientWidth`, nothing is
transformed. The organiser logo wall below is its own `<section>` with its own H2, so the
quote section is the cards and nothing else.

**`scroll-reveal-blank`.** Measured with the dwell control. After a 6s settle, 88 of 130
visible text leaves sit at effective (ancestor-multiplied) opacity < 0.08: every step,
every contest card, all four statistics (which also read `0`), the photo band, every blog
card, every quote and both CTA bands. Dwell: 9.9s without scrolling recovers 0 of 88.
Walk: 700px steps with 700ms pauses over the same elapsed time recovers 70 to opacity
>= 0.5. The gate is scroll, not time. Of the 18 not recovered, 8 are hover-only
photographer captions in the photo grid (not this signal) and the rest are the header
blocks of the steps and photo bands, which read hidden again at the walk's end
(reveal-on-entry that re-hides on exit). They are not counted, so 70 is a floor. What a reader
who does not scroll gets below the hero: the button band's three lines, three band
headings with their one-line subheads ("Toppic en números", "Han confiado en",
"Organizadores que ya utilizan"), two "Ver todos" links and the footer. No step, contest,
figure, photo, article or quote.

**`stock-photo-generic`.** Both clauses. (1) "MEJORES FOTOS", captioned "Descubre las
fotografías más extraordinarias seleccionadas por nuestra comunidad", is eight 280x280
tiles: five hot-linked Unsplash images (`photo-1493225457124`, `photo-1618160702438`,
`photo-1493397212122`, `photo-1470229722913`, `photo-1606216794074`) and three bundled
assets named like stock (`gallery-friends-party`, `gallery-festival-fun`,
`gallery-epic-sport`). On hover each is credited to a person ("Elena Rivera", "Carlos
Mendoza", "Marina Costa", "Luis Hernández", "Ana Martínez", "pepeto", "Diana Suárez",
"Javier Acosta"), with generic alt text ("Deliciosa gastronomía", "Arquitectura urbana").
Two of the three blog thumbnails are Unsplash too (`photo-1512941937669`,
`photo-1583422409516`). Stock that could belong to any company, presented as this
product's output. (2) The hero is `/hero-mobile-photography.jpg`, 1920x1280, hands holding
a phone over a blurred night street, under a full-bleed `linear-gradient(rgba(0,0,0,.7),
rgba(0,0,0,.5), rgba(0,0,0,.8))` scrim so the white 72px H1 survives. I did not establish
the hero's source; the photo band carries the signal without it. Recorded as fact for
hole 8, not scored here: the community's "best photos" are not the community's.

**`centered-hero-stack`.** H1 896px wide at x272 (centre 720), 30px H2 subhead 768px at
x336 (centre 720), one 242x56 CTA at x599 (centre 720), then a centred row of the
"Instalar APP" card and a "Mejor experiencia en la APP" note. Every hero element sits on
x=720.

## Craft signals present (2)

**`type-scale-high-contrast`.** `ladder.cjs`: ratio 4.5, the 72px H1 ("Participa en
concursos / de fotografía reales", weight 900, `letter-spacing: -1.8px`) over 16px body;
ratioSub 2.4 against the 30px hero subhead. Clears 3.75. Necessary, not sufficient, and the
ladder under it is stock (72 / 60 / 48 / 36 / 30 / 20 / 16, Tailwind's steps), so this is
scored for comparability with permit-guide-ai, which carries the same 72/16 hero and reads
`present`, not because the scale reads as a decision.

**`asymmetric-split`.** One band. "Concursos activos ahora": the 60px heading is
start-aligned in a 371px block at x160 while the deck ("Participa hoy y compite por premios
reales con tu fotografía.") is end-aligned at the right edge; below it,
`grid-template-columns: 360px 360px 360px` with the featured contest spanning two columns
and two rows (740x560) beside two stacked 360x270 cards. 740:360 is 2.06:1. It is the only
band on the page not built as centred-header-over-even-grid.

## Absent, with the reading that settled each

- `emoji-as-icon`: one emoji on the page, U+2764 U+FE0F at 12px inside the footer sentence
  "Hecho con ❤️ para fotógrafos de todo el mundo", rendered from the stack's Apple Color
  Emoji fallback. A word in a colophon, not an icon slot. Every icon slot, including the
  trophy before "MEJORES FOTOS", is a lucide SVG (`lucide-trophy`, `rgb(234,179,8)`).
- `badge-pill-spam`: zero decorative pills in the first 900px. The two rounded-full nav
  items ("Abrir App", "Iniciar Sesión") are controls; the eyebrows ("SIMPLE Y EFECTIVO",
  "EN DIRECTO") are bare uppercase text, no fill, no radius. The page's four pills
  (`DESTACADO`, three blog categories) are all below the fold.
- `indigo-violet-accent`: the accent is coral `rgb(229,97,97)`. Violet occurs once, the
  third step ring, `linear-gradient(to right bottom, rgb(168,85,247), rgb(236,72,153))`, a
  4px band round a 128px disc, one of three colour-coded rings. No button, link, heading,
  band or glow carries it.
- `gradient-fill-cta`: every primary fill is flat `rgb(229,97,97)`, `background-image: none`
  (the hero CTA's inner `div`, "Ver todos los concursos", "VER TODAS", "Abrir App").
- `typewriter-headline`: 12 samples of the H1 over 8.4s return one string.
- `hero-mockup-float`: no UI mockup. The phone in the hero is a prop in a photograph, its
  screen a blurred camera viewfinder.
- `single-optical-anchor` (rule-ineligible, undefined; honest call): absent. What I
  counted: in the hero the 72px/900 H1 dominates, but it is the only mass there (the
  photograph is a field under a 50-80% black scrim; the rest is a centred stack below the
  H1), so it dominates because there is only one mass. Page-wide nothing anchors: every
  band re-opens on its own 48-60px H2, and the 256px glowing button in band three is a
  second focal object as strong as the H1.
- `editorial-grid-break`: nothing leaves the 1120px container except full-bleed band
  backgrounds and the hero photo.
- `custom-type-pairing`: one family, the OS stack, no web font.
- `real-product-surface`: absent, a near-miss (below).
- `shows-deliverable`: absent. Naming the entry that could have embarrassed the vendor: I
  cannot. The product's output is a contest's result (submitted photos, votes, a winner,
  the "álbum del lugar" the steps promise), and the page shows none of it; its "best
  photos" are Unsplash. "Toppic en números" (27 contests, 332 participants, 355 photos,
  14.497 votes) is a vendor aggregate, absent by precedent however modest the figures. The
  quote cards are testimony, not artefact.
- `density-variation`: bands measure 665, 779, 1082, 562, 1069, 658, 670, 435, 506 and
  604px and share one rhythm, eyebrow, centred heading, subhead, a row of equal units. The
  densest unit is a card with a two-line excerpt; there is no table, list, spec or log for
  the near-empty button band to read against (permit-guide-ai's reading).
- `one-accent-discipline`: absent, a near-miss. Coral carries the brand (33 text colours,
  14 fills, 31 SVG strokes, both coral bands), but three other hues each do a job of their
  own: blue-500 to cyan-500 rings step 1, purple-500 to pink-500 rings step 3, yellow-500
  marks the "MEJORES FOTOS" trophy (orange-500 to red-500 on step 2 is arguably the coral
  family). The radar button's crimson `rgb(223,26,71)` is the red family and not counted.
  railway-com's shape (hues with separate jobs), not permit-guide-ai's (one accent through
  a ramp that ends in it).
- `live-claim-control`: the 256px button ("Aprieta el botón y descubre concursos de
  fotografía cerca de ti") is a geolocation link, not an on-page control. With geolocation
  granted (41.3833, 2.1767) it navigates to `/contests`, which lists contests with km chips
  (0.3 km Barcelona, 85.2 km Girona); without permission nothing happens. The answer lives
  on another page: decent-com's `/quote` precedent, absent.

## Near-misses

- `real-product-surface` (absent; present takes net to +7). The contests bento is live
  product data: `GET rest/v1/featured_contests?...&order=display_order.asc` and covers from
  the Supabase `contest-images` bucket ("Barri Gòtic de Barcelona", "RIDER 468 ANDORRA
  2026", "Machinas en el aeródromo", prize "Tarjeta regalo Amazon 20€"). But it is the home
  page's own featured-contest teaser, not a product screen: the real browse screen at
  `/contests` carries an `ACTIVO` status pill, distance chips, a LISTA / MAPA toggle and
  "FILTROS DE BÚSQUEDA", none of which appear here, and nothing shows the product in use
  (entering, voting, a ranking). Real content in marketing chrome is not a faithful rebuild
  of the product. A rater who counts any live-data listing as the surface flips it.
- `one-accent-discipline` (absent; present gives +7): a rater counting only flat fills and
  text colour sees coral alone, since the off-hues live only in 4px gradient rings and one
  40px icon.
- `glass-card-overuse` (present): five by count, but nothing visibly frosts. Discount the
  three 95%-white step discs as not surfaces and the count is two, absent (+7).
- `gradient-blob` (present): the painted evidence is faint (chroma 5 on white; R +11 on the
  dark band). The contests-band wash is easy to miss in the downscaled strip; the dark-band
  halos are plain at full size.
- `symmetric-everything` (present): the one asymmetric band is real; a rater reading
  "everything" literally flips it (+7).
- `testimonial-card-row` (present): a rater who reads the quote cards and the logo wall as
  one social-proof block breaks the "whole section" clause (+7).
- `indigo-violet-accent` (absent): the purple-to-pink ring is violet in a fill; a rater
  applying "the hue, in any fill" literally scores present (+9).
- `shows-deliverable`: the featured card's "Tarjeta regalo Amazon 20€" is the one entry that
  narrows "compite por premios reales". Rejected: a listing attribute in a vendor-curated
  slot (`display_order`), not the product's output.
- `type-scale-high-contrast` (present): clears 3.75 at 4.5, but the ladder is stock; a rater
  leaning on "not sufficient" flips it to absent (+9).

## Verdict: `slop`, net +8

Slop present 10 (gradient-blob, three-card-row, glass-card-overuse, generic-sans-default,
symmetric-everything, generic-line-icon-set, testimonial-card-row, scroll-reveal-blank,
stock-photo-generic, centered-hero-stack). Craft present 2 (type-scale-high-contrast,
asymmetric-split). Net 10 - 2 = +8. Page height 8296px over twelve bands; this is not a
thin page whose score comes from signals having nowhere to fire.

What separates it from the +3 mixed files (deepmark, stripe-2014), in terms a second rater
can check:

1. **Three slop signals that neither +3 file has, each on an instrument reading.**
   `scroll-reveal-blank` (88/130 text leaves under 0.08 opacity at rest; dwell recovers 0,
   walk recovers 70), `testimonial-card-row` (three identical 357x331 cards, no track, no
   overflow) and `glass-card-overuse` (five `backdrop-filter` surfaces). deepmark's two
   card signals failed on measurement as carousels; this page's do not.
2. **The craft that holds both +3 files in `mixed` is missing.** Both carry
   `density-variation`; this page has no table, list or spec anywhere. deepmark carries
   `custom-type-pairing` (Space Grotesk / Geist) and `one-accent-discipline`; this page
   loads zero font faces and runs three extra hues. stripe-2014 carries
   `real-product-surface` (Checkout is the product); no product screen appears here at all.
   This page's two craft values are the cheapest in the vocabulary: a threshold the default
   Tailwind ladder clears, and one bento band.
3. **The margin survives the contested calls.** Seven values above are genuine near-misses
   against the verdict (four slop: glass, blob, symmetric, testimonial; three craft:
   real-product-surface, one-accent, single-optical-anchor). Each flip moves net by one, so
   any four of them leave +4; it takes five to reach +3. The six slop values on hard
   readings (`generic-sans-default` at 0 font faces, `scroll-reveal-blank`,
   `stock-photo-generic` on Unsplash URLs, `three-card-row`, `generic-line-icon-set`,
   `centered-hero-stack`) already outnumber the most craft any reading gives the page (5).

The profile sits with permit-guide-ai (the same Tailwind/shadcn kit: a lucide set,
blur-3xl discs, a 72/16 hero, a three-card quote row, a stock hero under a scrim), not with
the mixed band.

**Rater B.**

**Rater B.** New page, rated blind (no other rater's draft opened).

Spanish geolocated photo-contest platform. A Lovable build: the bundle carries
`lovable-preview-auth` handlers and the OG image sits under
`gpt-engineer-file-uploads/`; the stack is Vite + Tailwind + shadcn tokens
(`bg-background`, `text-primary-foreground`) + framer-motion + Supabase. Builder
origin is context, not a signal: every value below is scored on what is measurably
on the page.

**Capture.** Viewport 1440x900, DPR 1. Walked fresh into
`~/scratch/antislop/s5/toppic-B`: 12 tiles, `clamped: false`, `coverage: 1`,
scroller `window`, `docH_before` = `docH_after` = 8296, no inner scroller (`html`
sh 8296 / ch 900). The last landing stopped at 7396 (max scroll). Stitched to 2
strips, 1440x4400 and 1440x3896, 8296px against an 8296px page, 0 drift. The last
strip ends in the footer (Plataforma / Ayuda / Legal columns, `© TOPPIC. Todos los
derechos reservados.` at y≈8228). Sections from the DOM: hero y0-900 (photo),
"Cómo funciona" 900-1565, "Aprieta el botón" (gray-900) 1565-2344, "Concursos
activos ahora" 2344-3426, "Toppic en números" (coral) 3426-3988, "Mejores fotos"
3988-5057, blog teaser 5057-5715, testimonials 5715-6385, logo wall 6385-6820,
organiser CTA (gray-950) 6820-7326, "Únete" (coral) 7326-7930, `<footer>`
7930-8296. Not thin: eleven bands, so most signals had somewhere to fire. The
blog teaser (three article cards) has no context slot short of `blog-index`, which
names a page type, so it is left out of `context`. Mobile not studied.

The walker freezes animations, so the strips show the stat band mid-count (25 /
302 / 323 / 13.183). The DOM values are bundle constants, not a fetch:
`wd={contests:27,participants:332,photos:355,votes:14497}`, counted up by
`requestAnimationFrame` and also emitted as a JSON-LD `Dataset` ("Métricas
actualizadas") whose `dateModified` is `new Date()`, the visitor's clock. Recorded
as fact; it bears on no signal below except `shows-deliverable`.

## Slop signals present (9)

**`three-card-row`.** The blog teaser is three equal `ARTICLE` cards, 347x286 each,
in a `grid md:grid-cols-3` of `346.656px 346.672px 346.656px`, white, 1px border,
12px radius, each an image, a coral category pill, a 16px/700 title and a two-line
excerpt, forming the section's whole content above a "Ver todos los artículos"
link. "Cómo funciona" is the same module without boxes: three equal 299px columns
(`298.656px 298.672px 298.656px`), each a 129px icon disc, a 20px/700 H3 and one
line, centred ("Estás en un lugar" / "Haces una foto y participas" / "Creas memoria
colectiva"), the vizleads numbered-step shape. The testimonial triplet is scored
separately below and is not needed here.

**`glass-card-overuse`, by the decided count, not by appearance.** Five
`backdrop-filter` surfaces: the fixed header (1440x65, `blur(4px)`, transparent at
the top of the page), the three step discs (121x121 each, `blur(8px)` over
`rgba(255,255,255,0.95)`) and the "Destacado" pill on the featured contest (111x29,
`blur(4px)` over opaque `rgb(229,97,97)`). The decided rule counts surfaces (3+),
so present. None of them reads as glass: the discs are 95% opaque white over a
near-white band and the pill is opaque.

**`generic-sans-default`.** 129 of 129 visible text leaves compute Tailwind's
default `font-sans` verbatim: `ui-sans-serif, system-ui, sans-serif, "Apple Color
Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"`. `document.fonts`
holds 0 faces and the network log has 0 font responses. Every role, the 72px/900
H1 included, is whatever the visitor's OS UI face is (SF Pro on this host).

**`symmetric-everything`.** 9 of the 10 section H2s compute `text-align: center`
("Cómo funciona", "Aprieta el botón", "Toppic en números", "Mejores fotos", "Mejora
tu fotografía", "Han confiado en", "Organizadores que ya utilizan", "¿Organizas un
evento o concurso?", "Únete a la comunidad"), each over a centred dek and an even
grid: steps 3x299, stats 4-up, gallery 4x295, blog 3x347, testimonials 3x357,
logos 4x250, organiser bullets 3-up centred with two centred buttons, footer
3x405. Outside cards, nav and footer, 41 of 50 text leaves are centred. The one
exception is the contests band (left H2, right-aligned dek, 2:1 bento), see
`asymmetric-split`. Method caveat in near-misses: the page-wide leaf count runs the
other way.

**`generic-line-icon-set`.** 35 visible SVGs, every one `lucide lucide-*` at
`stroke-width` 2 (the radar pin alone at 2.5). The stat band's four 24px glyphs
restate their labels: `trophy` over "Concursos organizados", `users` over
"Participantes", `camera` over "Fotografías compartidas", `thumbs-up` over "Votos
emitidos". The step discs do the same at 48px: `map-pin` on "Estás en un lugar",
`camera` on "Haces una foto", `users` on "Creas memoria colectiva". One set, one
stroke, nothing the label lacks.

**`testimonial-card-row`.** "Han confiado en toppic" is three `FIGURE` cards, each
357x331, white, 1px border, 16px radius, in `357.328px 357.328px 357.344px`, each a
faded coral `quote` glyph, a quote, a rule and an attribution (Ayuntamiento de
Gelsa; Marc García, Ganador; The Distinguished Gentleman's Ride). No track, no
clip: a static grid. The section holds nothing else but a "Ver todos los casos de
éxito" link.

**`scroll-reveal-blank`.** framer-motion `whileInView` with inline `opacity: 0;
transform: translateY(20px|50px)`. Measured as text nodes containing a letter with
a non-zero box, effective opacity (product of ancestors) under 0.08:
- t≈1s after DOMContentLoaded, at y=0: 72 of 113.
- Dwell control, no scroll, about 10s later (after networkidle): 72 of 113. The
  dwell recovered none.
- After a 700px-step walk (600ms per step): 14 of 113. Eight of the 14 are the
  gallery's photographer captions, which are hover-gated (`translate-y-full
  group-hover`) and excluded; the other six ("Simple y efectivo", "Inspiración",
  "VER TODAS", ...) each went 0 → 1 on `scrollIntoView` plus 2s.
So 64 text nodes are scroll-gated, every section head below the hero among them.
Under `reducedMotion: 'reduce'`, 34 of 47 `h2/h3/p` still compute opacity 0 after
3s at y=0. The stat numerals also sit at "0" until scrolled to (no letters, not
counted).

**`stock-photo-generic`.** Two places. The hero field is
`/hero-mobile-photography.jpg` (1920x1280, alt "Fotografía móvil - persona usando
smartphone"), a hand holding a phone over bokeh, under a bolted-on scrim
`linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.5), rgba(0,0,0,0.8))` without which
the white type has nothing to sit on. And "Mejores fotos", captioned "Descubre las
fotografías más extraordinarias seleccionadas por nuestra comunidad": 8 tiles,
five hotlinked from `images.unsplash.com` (`photo-1493225457124`,
`photo-1618160702438`, `photo-1493397212122`, `photo-1470229722913`,
`photo-1606216794074`) and three bundled `gallery-*.jpg` assets. The bundle
fixture `Lm` credits them to "Elena Rivera", "Carlos Mendoza", "Marina Costa",
"Luis Hernández", "Ana Martínez", "pepeto", "Diana Suárez", "Javier Acosta", with
`i.pravatar.cc` avatars and like counts 251-412. Stock that could belong to any
company, presented as the community's best work.

**`centered-hero-stack`.** H1 (896px wide, centred), 30px subhead, coral "Explorar
concursos" button, then the white "Instalar APP" card and "Mejor experiencia en la
APP", all on x=720 over the full-bleed photo. Rule-ineligible, counted as recorded.

## Craft signals present (3)

**`type-scale-high-contrast`.** `ladder.cjs`: 72px H1 ("Participa en concursos /
de fotografía reales", weight 900, tracking -1.8px) over a 16px body = 4.50:1,
above the 3.75 floor. Next sizes: 60px ("Concursos / activos ahora", the stat
numerals), then 48px/900 section H2s, against 30px (hero subhead, 2.4:1) and 16px
text. Above the floor by 0.75, a clear display step; a 72px/900 H1 is also what a
Tailwind `text-7xl font-black` hands any page, so it is a measured fact, not a
signature.

**`asymmetric-split`, on one band of eleven.** The contests band breaks the page's
axis: H2 "Concursos activos ahora" left at x160 (371px wide, 60px/900) against a
right-aligned dek, over a `lg:grid-cols-3` bento (`360px 360px 360px`) whose
featured card spans two columns and two rows (740x560) beside a stack of two
360x270 cards. A 740:360 split, 67/33, with the featured tile carrying the band.
Recorded with its context: every other band is centred or evenly divided.

**`single-optical-anchor` (rule-ineligible, undefined; honest call).** I counted
the H1 block as the anchor: two lines of 72px/900 white, 896px wide, over a scrim
that holds the photo to 50-80% black. The second-brightest mass is the white
211x80 "Instalar APP" card, about a ninth of the H1's area. This IS a case of "one
mass dominates because there is only one large mass": the centred stack offers
nothing else of size. Recorded present on that basis, and flagged.

## Near-misses

- **`real-product-surface`, absent, and the call most likely to split raters.**
  The contest bento is real product data: a runtime fetch of
  `rest/v1/featured_contests?select=*,contests(id,title,organizer,location,image_url,status,prize,...)`
  from the product's Supabase, card images from its `contest-images` bucket
  ("Barri Gòtic de Barcelona", "RIDER 468 ANDORRA 2026", "Machinas en el
  aeródromo"). The surface is not the product's: the app's own listing at
  `/contests` renders different cards (an `ACTIVO` status pill, a distance chip,
  a Lista/Mapa toggle, a filter bar) that appear nowhere on this page. Real data
  in a marketing bento is the inverse of "a faithful rebuild populated with
  invented data". Nothing else on the page shows the product in use: no upload,
  voting, contest page or map. Present gives −1.
- **`live-claim-control`, absent: the doorway.** "Aprieta el botón y descubre
  concursos de fotografía cerca de ti" is a 256x256 button that requests
  geolocation and navigates to `/contests`. With a Sydney geolocation the listing
  puts the nearest contest at `17118.4 km` (Girona), which does falsify "cerca de
  ti", but on another route, after leaving the page. vizleads' control answered
  in place. Present gives −1.
- **`symmetric-everything`, method-dependent.** Page-wide, 78 leaves are `start`,
  50 centred, 1 end. But the start ones sit in cards (29), the footer (16), the nav
  (5) and the hover captions (8). By the section-head method (zingy-cannoli,
  permit-guide-ai) it is present; by the raw leaf count (acyclic) absent. Absent
  gives −1.
- **`testimonial-card-row`.** The logo wall ("Organizadores que ya utilizan
  toppic", four 250x144 logos) follows as a separate `<section>` with its own H2,
  and two of its four organisations are the testimonial authors. A rater who reads
  the two sections as one social-proof block gets "not the whole section" and
  absent (−1).
- **`glass-card-overuse`.** Present only by surface count; a visible-frosting
  reading gives absent (−1).
- **`gradient-blob`, absent: declared, barely painted.** Six `rounded-full
  blur-3xl bg-primary` blobs (two 384px in "Cómo funciona", two 256px in the
  radar band, two 448px in the contests band), each inside a parent at opacity
  0.30, 0.20 or 0.04. Hiding all six: at the radar blob centres the gray-900 field
  moves from `rgb(17,24,39)` to `rgb(28,27,42)` and `rgb(24,26,41)` (≤11 levels on
  one channel); the contests corner goes from white to `rgb(253,248,248)`, chroma
  5; "Cómo funciona" to chroma 2. Faint warm smudges, no blob shape at page size.
  The "Únete" band's circles are thin outline rings, not fills. Present gives +1.
- **`asymmetric-split`.** One band, and a featured-tile bento is a stock pattern.
  A rater who wants a heading/body column split, or more than one band, gets
  absent (+1).
- **`emoji-as-icon`, absent.** One pictograph on the page: U+2764 U+FE0F in the
  footer sign-off "Hecho con ❤️ para fotógrafos de todo el mundo", which the
  default stack renders from Apple Color Emoji. It stands in for a word inside a
  sentence; it labels nothing. Every icon is a Lucide SVG, the gold trophy beside
  "MEJORES FOTOS" included. Present gives +1.
- **`indigo-violet-accent`, absent.** The only violet is `rgb(168,85,247)` →
  `rgb(236,72,153)` (purple-500 → pink-500) on one of the three step discs, set
  beside blue-500 → cyan-500 and orange-500 → red-500. The dark bands are gray-900
  `rgb(17,24,39)` and gray-950 `rgb(3,7,18)`, chroma 22 and 15. The lead hue is
  coral `rgb(229,97,97)` (66 uses: nav and section CTAs, eyebrows, the stat and
  "Únete" bands).
- **`one-accent-discipline`, absent, not close.** Above chroma 120: coral
  `rgb(229,97,97)`, crimson `#df1a47` on the radar button, red-500, orange-500,
  yellow-500 `rgb(234,179,8)` (the trophy), cyan-500, blue-500, purple-500 and
  pink-500. Discounting the step discs as decoration still leaves the gold trophy
  as a second hue in chrome.
- **`gradient-fill-cta`, absent.** No `a` or `button` carries a background
  gradient; every CTA is flat coral, flat white or outlined.
- **`badge-pill-spam`, absent.** Above the fold the only pills are "Abrir App" and
  "Iniciar Sesión", both controls. The page's decorative pills (01/02/03 step
  numbers, "Destacado", three blog category tags) are all below y=1190.
- **`density-variation`, absent.** Ink per band (pixels more than 40 summed levels
  off the band's modal colour, every second pixel): text bands run 1.8% (footer),
  1.9% (radar), 3.0% (testimonials), 4.0% (steps), 4.3% (stats), 5.4% (Únete),
  6.3% (organiser CTA); the spikes are photographs: hero 28.4%, contests 42.9%,
  gallery 49.2%, blog 21.9%, logos 11.5%. The swing is image bands alternating with
  sparse centred stacks, each at `py-20`/`py-28`/`py-32`; no dense passage is set
  against the rhythm.
- **`shows-deliverable`, absent. Candidates named and rejected:** the stat band
  (27 contests, 332 participants, 355 photos, 14,497 votes) is small and might
  read as modest, but it is a vendor-aggregate statistic, and a hard-coded one, so
  absent by the railway-com precedent. The gallery is the obvious deliverable for
  a photo-contest product and every entry flatters (stock images, 251-412 likes).
  The contest cards state prizes ("Tarjeta regalo Amazon 20€"), the offer, not a
  failure or a refusal. Testimonials are prose. No entry in any artefact could
  count against the vendor.
- **`editorial-grid-break`, absent.** All content stays in `max-w-5xl`/`max-w-6xl`
  containers; only the hero photo and band fills bleed, which is every page. The
  featured tile spans grid tracks; it does not leave the grid.
- **`custom-type-pairing`, absent.** One stack, no faces (see
  `generic-sans-default`). Weight (900 against 400-700) and negative tracking on
  display sizes are the only typographic decisions.
- **`hero-mockup-float`, absent.** No device or UI in the hero, only the photo.
- **`typewriter-headline`, absent.** H1 identical in six samples over 9s.
- `materials`: `single-theme` (emulating `prefers-color-scheme: dark` leaves
  `html.light` and a white body; no toggle in the nav), `stock-photo` (Unsplash
  hotlinks, the hero field). The contest banners are organiser uploads served from
  the product's bucket; no material token fits them. No provenance tokens: they
  are recorded only on `shows-deliverable: present` files.

## Verdict: slop, net +6

9 slop present, 3 craft present. Net +6, above openhack (+4) and heroku-2014 (+5).

**What separates it from the +3 mixed files, checkably (diff the front-matters,
re-run the measurements):**

- **On rule-eligible signals only**, striking `centered-hero-stack`,
  `hero-mockup-float` and `single-optical-anchor` as vizleads did: toppic 8 slop −
  2 craft = **+6**; deepmark 5 − 4 = **+1**; stripe-2014 5 − 3 = **+2**. The gap
  is four counts or more, not one.
- **Against deepmark (7 slop, 4 craft):** they share five slop values
  (`generic-sans-default`, `symmetric-everything`, `generic-line-icon-set`,
  `stock-photo-generic`, `centered-hero-stack`). Toppic adds four deepmark lacks:
  `three-card-row` (3x347 blog cards), `glass-card-overuse` (5 surfaces),
  `testimonial-card-row` (3x357 figures) and `scroll-reveal-blank` (64 gated text
  nodes, 0 recovered by dwell). deepmark's craft carries three page-wide system
  decisions, `custom-type-pairing`, `one-accent-discipline` and
  `density-variation`; toppic fails all three by instrument (one default stack
  with 0 faces; nine colours in seven hue families above chroma 120; text bands inside 1.8-6.3% ink).
- **Against stripe-2014 (6 slop, 3 craft):** the craft counts are equal, the
  content is not. stripe-2014 keeps `real-product-surface` (the Checkout form)
  and `density-variation`; toppic has no product UI anywhere in 8296px, and its
  craft is a 72px H1, one bento band, and a rule-ineligible anchor that dominates
  because the stack holds one mass. On slop, toppic carries 9 against 6, and its
  extra values include the robustness defect neither +3 file has
  (`scroll-reveal-blank`, which persists under reduced motion for 34 of 47
  headings and paragraphs).

**Robustness, so a second rater can locate a disagreement.** Five calls could go
the page's way: `real-product-surface` and `live-claim-control` to present, and
`symmetric-everything`, `testimonial-card-row`, `glass-card-overuse` to absent.
Any one leaves +5; any two leave +4 (still `slop`, at the floor); any three give
+3 and the verdict should then be `mixed`. Three calls could go the other way
(`gradient-blob` from markup, `asymmetric-split` withdrawn, `emoji-as-icon` on the
heart), up to +9. The two I hold most firmly are the ones the decided rules settle
(`glass-card-overuse` by count, `three-card-row` on the bordered blog cards); the
two most exposed are `symmetric-everything` (method) and `real-product-surface`
(live data, marketing surface).

What the page does well, so the verdict is not read as a judgement on the product:
the contest bento is live product data with organiser-uploaded banners, the
testimonials name real organisations that reappear in the logo wall, and the
locator button sends a visitor to an honest distance-sorted listing. None of that
reaches the marketing chrome as a surface or a deliverable; the community gallery,
the one place a deliverable belonged, is Unsplash stock under invented names.
