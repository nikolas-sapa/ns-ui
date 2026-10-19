---
source: https://aastudioweb.fr/
kind: site
cohort: ai-builder
verdict: mixed
studied: 2026-10-19
context: [nav, hero, team, pricing, cta, footer, features]
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
  indigo-violet-accent: absent
  gradient-fill-cta: absent
  scroll-reveal-blank: absent
  typewriter-headline: absent
  stock-photo-generic: present
  centered-hero-stack: absent
  hero-mockup-float: absent
  asymmetric-split: present
  single-optical-anchor: absent
  type-scale-high-contrast: present
  editorial-grid-break: absent
  custom-type-pairing: present
  real-product-surface: absent
  shows-deliverable: absent
  density-variation: unresolved
  one-accent-discipline: absent
  live-claim-control: absent
materials: [single-theme, stock-photo, illustration]
---

**Sampling: random draw.** One of twelve drawn with seed 20261019 from the twenty-two gallery sites left after the first draw (same pre-stated exclusions). `gunsvzombies`, drawn first, returned 404 (project deleted) and was replaced from the same seed by `openmark`. Not chosen on any signal.

Rated by two independent blind raters on 2026-10-19, neither reading the other's draft. Both reached `mixed`. They agreed on 25 of 26 signals; the 1 split `density-variation` (A absent, B present) are recorded `unresolved`, which never counts toward a rule. Both write-ups follow in full.

**Rater A.**

Rater A, blind. New page, no prior study, so no drift section. No other rater's draft was opened.

**Capture facts.** Viewport 1440x900. `shoot-tiles.cjs` into `s5/aastudioweb-A`:
`docH_before` 7601 = `docH_after` 7601, scroller `window` (the only inner
candidate is `html` at 7601), 11 tiles, every landing exact (asked 0..6300,
landed the same; the last asked 7000 and landed 6701 = 7601 - 900, the max
scroll), `clamped: false`, `coverage: 1`, `reachedPx` 7601. `stitch.py`: 2
strips (1440x4400, 1440x3201), stitched 7601px against a 7601px page, `OK`.
The last strip ends in the footer (`© 2026 AA Studio, tous droits réservés`,
y7520). Page height 7601px: not a thin page.

Three things repeat or are missing in the strips, each checked in the DOM:
- The cookie banner (`fixed bottom-0`, 69px, `backdrop-filter: blur(4px)`)
  and a right rail of three 56px round buttons (`fixed right-5 top-1/2`)
  appear in every tile. Both are fixed elements, not duplicated content.
- The marquee band (`je me déplace · j'écoute · j'explique · je fais · vous
  gardez la main · sans jargon · sans bullshit`) is 12 copies of one string on
  `aaMarquee 90s`, which the walker froze.
- **Three of the six images had not painted when the walk passed them**, so
  strip 1 shows the cards for `votre site web`, `formule all inclusive` and
  `audit digital` with blank image areas. They are real images that load
  slowly, not missing ones: `votre-site.png` is 2,322,361 bytes (curl: TTFB
  0.87s, total 19.0s), `ecosysteme.png` 1,697,388 bytes, `maquette-aa-audit`
  170,533 bytes, all `loading="lazy"`, all HTTP 200. The portrait (a
  2,234,552-byte PNG served at a `.jpg` URL) is half-decoded in tile 0. I
  fetched all six directly and looked at each. The DOM places them at 640x274
  (y2636 x2, y3974 x2, y4876) and the portrait at 260x347 (y568). I rated
  the images from those fetches, not from the strips.

**What the page is.** A one-person web and social-media studio in Deauville
("aa · L'EFFET DOPAMINE", Audrey). It is a marketing page; the product is a
service. From the top: an orange (`rgb(233,78,27)`) 24px frame around a white
sheet; a sticky nav; a left-aligned hero (mono eyebrow, Anton H1 at 72px in
orange, a lime highlighter on `ça vous saoule`, Anton subline at 32px, two
hard-shadow CTAs); then a portrait beside a lede and a 2x2 credentials grid;
the marquee; `MA MÉTHODE.` (an 80px head over a solid orange band, 64px
statement left, two paragraphs right); `MES PRESTATIONS.` (two coaching cards
at 350 €, three offer cards, two add-on cards); `CONTACT.` (a dark block with
`ON PREND / UN CAFÉ ?` at 112px); footer.

## Slop signals present (2)

**`generic-sans-default`.** `document.fonts` loads Anton 400, Inter 400/500/700
and JetBrains Mono 400/500. `body` computes to `Inter, sans-serif` at 16px. Of
5,447 visible characters (marquee counted once, fixed banner and rail
excluded), **Inter sets 4,114 (75.5%), every one under 24px**: every paragraph,
list item, nav link and footer line. Anton sets 577 (every h1-h4), Mono 756.
A display face was chosen, but the text face is the default neo-grotesque.
Scored to match corpus precedent: permit-guide-ai (Inter body under Plus
Jakarta display) and deepmark (Geist body under Space Grotesk display) are both
`present` here with `custom-type-pairing` also `present`. A near-miss; see
below.

**`stock-photo-generic`.** The prestations section heads four offer cards with
photographs, each cropped to 640x274 (21:9). None shows the vendor's work, a
client of hers, or her at work:
- `maquette-aa-declic-web` (1280x640): a woman, seen from behind, holds a
  laptop in front of Mont-Saint-Michel. The screen reads `Heor dllesye
  Antian`, pseudo-text.
- `maquette-aa-declic-reseaux` (1280x640): a woman, seen from behind, on a
  beach with a phone, a row of coloured parasols behind her.
- `votre-site.png` (1672x941): a woman at a desk with a laptop showing
  `Handmade Homeware Collection`, a phone, swatches and sticky notes.
- `maquette-aa-audit` (1536x1024): a macro of a brown eye, for "audit
  digital".

The last two carry C2PA manifests: `c2pa.created`, softwareAgent `gpt-image`,
digitalSourceType `trainedAlgorithmicMedia`, dated 2026-06-23. The first two
have no manifest (stripped JPEGs), but they render invented pseudo-UI on their
screens. These are generated photographs filling the stock role. As on
glowcase, I scored the decision the signal names (interchangeable imagery),
not the licence, and recorded `stock-photo` as the nearest material. No scrim:
type always sits below the images on white, never over them.

## Craft signals present (3)

**`asymmetric-split`.** The hero's lower band is `md:grid-cols-[0.6fr_1.8fr]`,
computed `289px 866.984px`: **1 : 3.0**. The portrait column sits beside the
lede and the credentials grid. This is the only unequal split on the page,
and the call rests on that one band (see near-misses).

**`type-scale-high-contrast`.** `ladder.cjs`: largest lettered node `on prend`
/ `un café ?`, Anton 112px, over body 16px = **7.0:1**. The rest clear the
3.75 gate on their own: the hero H1 is 72/16 = 4.5, and the three 80px section
heads are 5.0. The display step is set, not inherited: Anton at line-height
0.95, letter-spacing -0.01em, uppercase. Ladder: 112 / 80 / 72 / 64 / 48 /
32 / 30.4 / 20 / 18 / 16 / 14 / 12 / 10. Most body copy renders at 14px (45
Inter leaves), so the step against what a reader actually reads is steeper
than the ratio says. The threshold is necessary, not sufficient. This page
clears it by 1.9x. That is unlike the five files that sit at exactly 3.75, and
unlike glowcase, whose H1 tied its H2s.

**`custom-type-pairing`.** Three loaded faces, each with one job and almost no
crossings:
- **Anton:** all 16 headings h1-h4 (30.4-112px), the prices, the two hero CTA
  labels (20px), the option-row labels (17.6px), and the footer `AA`.
- **Inter:** every paragraph, list item and nav link (12-20px), plus the `aa`
  wordmark (20px/900).
- **JetBrains Mono:** the eyebrows (`section`, `mes produits signature`), card
  meta, number discs, the secondary buttons (`en savoir plus` 11px/700, `on en
  parle` 12px), the contact field labels, and the `06`/`07` numerals at 40px.

No heading is in Inter, and no paragraph is in Anton. Same structure as
permit-guide-ai and deepmark.

## Near-misses

- **`generic-sans-default` present, the softest slop call.** It rests on
  precedent that counts a default body face even under a chosen display face.
  A rater who reads the signal as "the page runs on the default sans" would
  score it absent here: Anton and Mono carry every heading, label and button,
  and the page's typographic voice is not Inter's. Absent gives net -2.
- **`stock-photo-generic` present.** The strongest counter: the first two
  scenes are localised to the vendor's market (Mont-Saint-Michel; parasols of
  the kind on Deauville's beach), and the stand-in woman's hair matches the
  portrait's. That makes them less "any company" than glowcase's office
  stock. The desk scene and the eye macro have no such tie, and none of the
  four shows anything of the vendor. Absent gives net -2.
- **`asymmetric-split` present on one band.** Every other multi-column band is
  equal or close to it:
  - prestations: 642/642, three times;
  - méthode: 12 columns, a 5-column heading, 1 empty column, a 6-column copy
    block (477/582px of text, 1:1.2);
  - contact: `1.2fr 1fr` (628/524);
  - footer: 4 x 303.

  A rater who wants the split to organise the page, not one band, scores
  absent: net 0.
- **`type-scale-high-contrast` present, though the hero H1 is not the top.**
  The 72px H1 is smaller than the three 80px section heads and the 112px
  contact head. Held present because every heading tier clears the gate, and
  the 112px head is a genuine display moment, 1.4x over the next tier.
- **`one-accent-discipline` absent.** Two accents each do jobs:
  - **Orange `rgb(233,78,27)`:** 62 elements in the colour census. The frame,
    H1, section heads, primary CTAs, prices and number discs.
  - **Lime `rgb(215,242,90)`:** 18 elements. Highlighter fills on 13 spans
    (hard-stop `linear-gradient`s at 50%/60%), the hero's secondary CTA fill,
    the contact section's **primary** CTA fill (`on en parle`), the second line
    of the 112px head, the `on se parle ?` eyebrow, and one option row's hard
    shadow.

  Plus pink `rgb(242,166,162)` once (the `· site web · écosystème · audit
  digital` tag) and the cookie button `rgb(203,75,11)`. Lime fills a primary
  CTA, so it is not a highlight colour subordinate to the orange.
- **`density-variation` absent.** Characters per vertical px by band: hero
  1.01, méthode 0.60, coaching cards 0.82, offer cards 0.68, compléments 0.56,
  contact 0.36, footer 0.95. A 2.8x swing, but there is no dense register: no
  table, spec or comparison, and the longest list is 8 inclusions at a 30px
  pitch. It is one texture (Anton head, 14px paragraph, short arrow list) at
  different packings, which is toolsapp-work's reading.
- **`single-optical-anchor` absent** (rule-ineligible; honest call). Candidate
  anchor: the H1, 72px orange over two lines, about 740px wide. It does not
  dominate the first viewport, because other masses compete:
  - the 424px lime highlighter block on its second line;
  - a 32px Anton subline with a second highlighter;
  - two saturated 227x70 and 230x70 CTAs with 2px borders and hard offset
    shadows, 100px below;
  - the top of the portrait at y568;
  - the orange frame.

  Page-wide, the largest mass is the 112px head at y6581, and the 80px orange
  section heads, larger than the H1, recur three times. Not the "only one
  mass" case: many loud masses, none in charge.
- **`three-card-row` absent.** The three credential cells (`mon job` / `ma
  légitimité` / `mes expériences cocasses`, each 433x187) sit 2+1 in a
  two-column grid. Every card row on the page is 2-up.
- **`badge-pill-spam` absent.** Zero pills above y900. The page's only
  `rounded-full` elements are five 32px number discs (y2947-5186) and the two
  contact CTAs (y7002). The pink tag at y3846 has radius 0.
- **`glass-card-overuse` absent.** Two `backdrop-filter` surfaces: the sticky
  header (`blur(8px)`, white at 0.92) and the cookie banner (`blur(4px)`).
  2 < 3.
- **`generic-line-icon-set` absent.** 11 visible SVGs, all lucide: 8
  `arrow-up-right` on CTAs (14-20px, stroke 2) and the rail's `share-2`,
  `heart` and `bookmark` (20px, stroke 2.2). No icon accompanies a heading or
  a feature. The arrows are affordance glyphs.
- **`emoji-as-icon` absent.** The only symbol hits are seven U+2192 `→` set in
  Inter, coloured orange, as list bullets. A typographic arrow, not an emoji.
- **`scroll-reveal-blank` absent.** 206 text nodes. Below-fold text under 8%
  effective opacity (the product of ancestor opacities): 0 at load, 0 after a
  further 6s dwell with no scroll, 0 after a 700px-step walk. Zero transforms
  on below-fold text. The only running animation is the marquee.
- **`typewriter-headline` absent.** The marquee is a fixed phrase ticking
  sideways in its own band below the hero. The headline does not cycle.
- **`shows-deliverable` absent.** For a web studio the deliverable is a site
  she built or a coaching output, and neither appears. The priced cards
  publish 350 € HT, 350 €, `à partir de 790 €` and `29 € / mois`, and leave
  three offers `sur devis`. **No entry could have embarrassed the vendor**:
  - no refusal, and no row declining or narrowing a claim;
  - `vous le faites en autonomie` sells "no lock-in";
  - `l'outil le plus adapté à votre besoin (Wix, WordPress, vibe coding)` is a
    promise of advice;
  - `sur devis` is the opposite of a refusal: it withholds the price.

  No provenance tokens recorded.
- **`real-product-surface` absent.** No site of hers is captured or rebuilt.
  The only screens on the page are generated pseudo-UI inside the stock
  scenes. `/ réalisations` is one click away in the nav, and scoring is at
  rest.
- **`indigo-violet-accent` absent.** Accent hues: orange ~15°, lime ~70°, pink
  ~3°. The `body` default ink `rgb(14,24,47)` (hue ~222°, very dark) sets text
  on 6 elements and is not an accent.
- **`centered-hero-stack` absent and `symmetric-everything` absent.**
  `symmetry.cjs`: basis h1-h2, n=6, **0 centred, share 0**. The H1 is
  `text-align: start` at x122, and the CTAs sit left.
- `gradient-blob`, `gradient-fill-cta`, `hero-mockup-float`,
  `editorial-grid-break`, `testimonial-card-row`, `live-claim-control`:
  absent.
  - Of the page's 13 gradients, 12 are hard-stop highlighters behind text,
    and one is the dark placeholder behind the portrait.
  - Every CTA is a flat fill.
  - The hero holds a portrait, not a mockup.
  - Nothing crosses the 1308px content container. The marquee runs between
    rules inside the sheet, and the orange frame is a page border, not a
    break.
  - There is no social-proof section and no control.

**Facts with no slot in the vocabulary**, recorded so they are not lost:
- **The portrait captioned `Audrey, l'artisane du web` is machine-generated.**
  Its C2PA manifest reads `c2pa.created`, `gpt-image`,
  `trainedAlgorithmicMedia`, 2026-06-22. The page presents a generated portrait
  as the owner. Whether a photo of her was the input is not in the manifest
  strings I extracted (no ingredient assertion found). I did not score it
  under `stock-photo-generic`: it is captioned as the vendor, not
  interchangeable. It is why `commissioned-photo` is not in `materials`.
- `ecosysteme.png` (also `gpt-image`, 2026-06-23) is a flat illustration of
  linked UI cards on a blue-to-orange field, hence `illustration`.
- The credentials grid is `gap-px` on `rgb(20,20,20)` with three children. It
  leaves a solid black 433x187 rectangle in the fourth slot (visible in strip
  0).
- The two coaching offers are priced `350 € HT` and `350 €`.
- The footer anchors `#story` and `#works` match no id on the page. The ids
  present are `create`, `methode-intro`, `prestations` and `contact`.
- The three rail buttons are all `aria-label="action"`.
- No `prefers-color-scheme` rule and no toggle (`single-theme`). No
  `prefers-reduced-motion` rule, so the marquee always runs.
- At 390px wide, there is no horizontal page scroll and the H1 renders at
  32px.

## Verdict: `mixed`, net -1 (2 slop present, 3 craft present)

Net -1 is far from the +4 that `slop` requires, so no separation argument is
owed. For the record against the +3 mixed anchors: deepmark carries 7 slop
against 4 craft, stripe-2014 5 against 4. This page carries 2 slop signals,
both soft (precedent-driven Inter body; generated stock that is partly
localised).

The verdict holds across every near-miss:
- Flip all three contestable crafts (`asymmetric-split`,
  `type-scale-high-contrast`, `custom-type-pairing`) to absent: net +2.
- Flip both slop calls to absent and credit `density-variation`: net -4.
- Every reading lands between -4 and +2: `mixed`.

The page had room for template slop and none fired: zero centred section
heads, zero pills above the fold, zero gradient CTAs, two blur surfaces, no
icon set, no testimonial row, no reveal gating. Its visual decisions (Anton
and mono, the hard offset shadows, the orange frame, highlighter marks) are
specific and consistent, if loud. Its weaknesses are elsewhere: imagery that
is all machine-generated, including the owner's portrait; no work of hers
shown; three slow lazy images that leave blank boxes on a normal scroll.
Those are not density of template signals, and the vocabulary scores only
one of them.

**Rater B.**

Rater B, blind. New page, no prior study, so no drift section. No other rater's draft was read.

**What the page is.** A one-person web studio in Deauville ("aa · studio web pour artisans en Normandie", `lang="fr"`): Audrey makes sites and runs social media for artisans. Built on Lovable:
- the lazy card images are served from `/__l5e/assets-v1/<uuid>/`;
- the shadcn toast region (`aria-label="Notifications (F8)"`) is mounted;
- Tailwind classes throughout, in one `#root` SPA.

The styling is neo-brutalist: a 24px orange `#E94E1B` frame around the whole page, 2px black rules, hard offset shadows on buttons, and lime `#D7F25A` highlighter bands behind words.

## 1. Capture

- 1440x900 viewport. Page height 7601px, window scroller (the only candidate is `html`, sh 7601 / ch 900).
- 11 tiles, `clamped: false`, `coverage: 1`. The last landing is 6701, the browser's docH-900 clamp, as expected.
- Stitched to 2 strips (1440x4400, 1440x3201): 7601px against 7601px, no drift. The last strip ends in the footer: the AA® mark, "/ MENU", the "/ ZONE" town list, "/ CONTACT", and "© 2026 AA STUDIO, TOUS DROITS RÉSERVÉS".
- Tiles are in `~/scratch/antislop/s5/aastudioweb-B/`, strips in `s5strips/aastudioweb-B-strip{0,1}.png`, probes in `s5work/aastudioweb/`.
- **Capture artefact, and it matters for reading the strips.** All six `<img>` wells are blank or show their placeholder in the strips:
  - the 260x347 portrait shows its `linear-gradient(135deg, rgb(15,42,34), rgb(20,20,20))` placeholder;
  - the five 640x274 card wells are white.

  The markup is not at fault: every `src` returns 200 (`votre-site.png` is 2.3MB and `ecosysteme.png` 1.7MB, both PNG). The host is slow, though: one 2.2MB asset took over 60s through curl. In a separate run the two coaching images did paint in place at y≈2636 (`look-2500.png`), and a hero shot taken after 20s of settling shows the portrait. The other three still had `naturalWidth 0` after a full walk plus 15s. I fetched all six assets directly and rated the imagery from them. A visitor on a normal connection probably sees them; one on a slow connection sees blank wells.
- Two fixed elements recur in every tile: the cookie bar (`fixed bottom-0`, 69px) and a dock on the right edge of three 56px round buttons (Lucide share / heart / bookmark, each `aria-label="action"`). Their repetition across tiles is not duplicated content.
- One forced light theme. With `colorScheme: 'dark'` emulated, body still computes `rgb(243,240,237)`. No toggle.

Bands, in order (DOM `section` ids):
1. `#create`, y=103, 1191px: the hero (eyebrow, H1, subhead, two CTAs). Then a portrait + bio block with a 2-column hairline grid of three cells ("MON JOB 01", "MA LÉGITIMITÉ 02", "MES EXPÉRIENCES COCASSES 03"). Then a marquee strip on a 90s loop.
2. `#methode-intro`, 768px: the "SECTION / MA MÉTHODE." title band, then an orange statement band.
3. `#prestations`, 4109px (54% of the page): seven numbered offer cards. 01/02 (coaching) sit side by side, 03/04 side by side, 05 alone, and 06/07 are small "COMPLÉMENTS" cards.
4. `#contact`, 1077px: a title band, then a dark `rgb(42,42,46)` CTA block with "ON PREND UN CAFÉ ?" at 112px.
5. `footer`, 327px.

## 2. Slop signals present (2)

**`generic-sans-default`: present.** `getComputedStyle(document.body).fontFamily` is `Inter, sans-serif` at 16px. Inter carries every prose and UI node: the bio, all card copy and lists, the contact paragraph, the footer and the nav. The "aa" logo is Inter 900 at `-0.08em`. Anton is used only for display and JetBrains Mono only for labels. This is the same reading as sakura-name-sparkle, permit-guide-ai and deepmark: an Inter or Geist body counts as present even when the display face is a deliberate choice. The pairing gets its credit separately, under `custom-type-pairing`.

**`stock-photo-generic`: present, on the any-company arm.** I fetched the five card images directly. None of them shows Audrey's work.

- `maquette-aa-declic-reseaux` (1280x640), "coaching réseaux sociaux": a woman seen from behind on a beach, holding a phone, with blurred coloured umbrellas behind her.
- `votre-site.png` (1672x941), "votre site web": an overhead desk flat-lay with a laptop, a phone, swatches and sticky notes. The laptop shows an invented "Handmade Homeware Collection" site under an "H" logo, and that is not a client of this studio.
- `maquette-aa-audit` (1536x1024), "audit digital": a macro shot of a brown eye, the stock metaphor for an audit.
- `ecosysteme.png`, "FORMULE ALL INCLUSIVE": a generated vector illustration of app cards wired to a browser window on a blue-to-orange field.
- `maquette-aa-declic-web`, "coaching site web": a red-haired woman from behind with a laptop, Mont-Saint-Michel in the background. The laptop screen reads "Herdlleslye Antian", the illegible text image generators produce.

Every filename starts with `maquette-` ("mock-up"). The eye, the beach and the desk would serve any marketing agency in any country. The Mont-Saint-Michel frame is the one nod to place, and it too shows an invented site, not a real one. The scrim arm does not fire, because no type sits on any image. This matches permit-guide-ai's reading of any-company imagery that is possibly generated.

## 3. Craft signals present (4)

**`type-scale-high-contrast`: present.** `ladder.cjs` gives a ratio of **7.0:1**: 112px ("on prend" / "un café ?", Anton) over a 16px body. The sizes below it form a real scale, not one outlier:

| size | face | use |
|---|---|---|
| 112px | Anton | "on prend" / "un café ?" |
| 80px | Anton | section titles ("ma méthode", "mes prestations", "contact") |
| 72px | Anton | H1 |
| 64px | Anton | H2/H3 ("JE VIENS, J'ÉCOUTE, JE DÉMYSTIFIE.", "2H30 POUR DÉCOINCER VOTRE PROJET.", "PUIS ON CONSTRUIT ENSEMBLE.") |
| 48px | Anton | "COMPLÉMENTS." |
| 16/14px | Inter | body |
| 10px | JetBrains Mono, tracked 0.3em | micro-labels ("MON JOB", "01") |

The hero alone is 72/16 = 4.5:1. Both ratios clear the 3.75 threshold. The threshold is necessary, not sufficient. What settles it is that the same jumps (10 → 14/16 → 48–112) are kept across every band.

**`custom-type-pairing`: present.** Three faces, each with one job. `ladder.cjs` reports bigFamilies `["Anton"]` and smallFamilies `Inter, Anton, JetBrains Mono`.
- Anton (condensed uppercase) sets every display size from 48 to 112px and the button labels.
- Inter sets all prose.
- JetBrains Mono, tracked 0.25–0.3em, sets every eyebrow, index numeral and contact key ("tel /", "mail /", "lieu /").

Each face is assigned by role, with no overlap. Same reading as deepmark (Space Grotesk display / Geist body) and sakura-name-sparkle.

**`asymmetric-split`: present, on one section.** I measured every two-column container at least 700px wide whose columns sit side by side:

| block | left / right width | ratio |
|---|---|---|
| portrait / bio, `#create` | 260 / 867px | **3.33:1** |
| méthode band | 477 / 582px | 1.22 |
| contact block | 628 / 524px | 1.20 |
| coaching pair | 642 / 642px | 1.00 |
| complements pair | 642 / 642px | 1.00 |

The hero also leans left: the H1 spans x=122–865 of 1440, leaving about 40% of the first viewport empty on the right. Only the bio block is clearly unequal (see near-misses).

**`density-variation`: present, modestly.** Text characters per 1000px of band height:

| band | chars / 1000px |
|---|---|
| `#create` | 1583 |
| `#methode-intro` | 497 |
| `#prestations` | 619 |
| `#contact` | 309 |
| footer | 899 |

That is a 5.1x swing across five bands, and the textures differ as well as the fill:
- The bio packs three numbered cells, 10px mono labels and 14px copy into a hairline grid.
- Each "SECTION / <TITLE>." band spends about 300px on two words at 80px.
- The orange méthode band carries one 64px statement and one paragraph.
- The offer cards are full lists at 14px.
- The dark CTA spends 677px on one 112px line, a paragraph and three contact rows.

The corpus bar is "modest, but the page has more than one texture", and this page meets it. It is not dipole-labs' two-band case: here the sparse title bands alternate with dense blocks four times.

## 4. Absent, with the measurement

- `gradient-blob`: 13 elements carry a `linear-gradient`.
  - Twelve are hard-stop highlighter bands (`rgb(215,242,90) 50%, transparent 50%` and `transparent 60%, rgb(215,242,90) 60%`): flat colour bars drawn behind words.
  - The thirteenth is the portrait's 135° placeholder, `rgb(15,42,34)` to `rgb(20,20,20)` (chroma 27 at most, near-black), which the image covers once it loads.

  No radial, blurred or decorative blob anywhere.
- `three-card-row`: the offers are laid out 2+2+1+2. The three "PUIS ON CONSTRUIT ENSEMBLE" offers (03/04/05, "trois manières") form a 2-up plus an orphan, not a row. The bio grid is 2x2 with three cells filled.
- `glass-card-overuse`: 2 `backdrop-filter` surfaces, the sticky header (`blur(8px)`) and the cookie bar (`blur(4px)`). Below the threshold of 3.
- `emoji-as-icon`: the only `Extended_Pictographic` match is the "®" in JetBrains Mono after the AA wordmark. That is a trademark sign, not an emoji. The list bullets are U+2192 "→" text glyphs in orange.
- `symmetric-everything`: `symmetry.cjs` on basis h1-h2, n=6: **0 centred, share 0.00**. Every heading computes `text-align: start`.
- `badge-pill-spam`: zero pills above y=900. The only rounded-full text elements on the whole page are:
  - five 32px index circles ("01" to "05") in the offer cards;
  - the two contact buttons at y≈7000.

  The one decorative chip ("· SITE WEB · ÉCOSYSTÈME · AUDIT DIGITAL", pink `rgb(242,166,162)`) is at y≈3800, well below the fold.
- `generic-line-icon-set`: 12 SVGs, all Lucide: share/heart/bookmark (20px, stroke 2.2) in the floating dock, a menu glyph, and `arrow-up-right` on the CTAs. None stands for a feature beside a heading. They are controls, not a row of feature icons.
- `testimonial-card-row`: the page has no testimonials section.
- `indigo-violet-accent`: by element count the colours are:
  - white;
  - `rgb(20,20,20)`;
  - orange `rgb(233,78,27)` (70 fg / 18 bg);
  - lime `rgb(215,242,90)`;
  - a single pink chip.

  `rgb(14,24,47)` is the inherited body text colour on 8 nodes. It is navy, not indigo, and is never used as a fill. The `theme-color` meta `#1c2e5a` is never painted.
- `gradient-fill-cta`: the CTAs are flat orange or lime with hard black offset shadows.
- `scroll-reveal-blank`: zero text nodes under 8% effective opacity at rest, after a 12s dwell without scrolling, or at any of 17 scroll stops (450px apart). Nothing is gated, so there is nothing to compare.
- `typewriter-headline`: the H1 is static. The page's one animation is the `aaMarquee` strip (90s, 17486px track, "JE ME DÉPLACE · J'ÉCOUTE · …"), a marquee, not a headline cycling phrases.
- `centered-hero-stack`: the H1 computes `text-align: start`, left edge at x=122.
- `hero-mockup-float`: no device or UI mock in the hero.
- `editorial-grid-break`: every block sits in the one framed column (sections are 1388px inside the 24px frame). No element breaks out of a column or overlaps one. The marquee runs edge to edge inside the frame, not across it.
- `real-product-surface`: the product is websites, and the home page shows none the studio built. The nav links to "/ RÉALISATIONS" and the footer to "Créations" and "Travaux", but no work appears here. The only site UIs on the page are generated laptop screens ("Handmade Homeware Collection", "Herdlleslye Antian"). That is invented UI, so it fails.
- `shows-deliverable`: **no entry could embarrass the vendor.** There is no deliverable artefact, for the reason above. The price list is commercial substance, so I ran the refusal test on it:
  - four prices are stated: 350 € HT, 350 €, "À PARTIR DE 790 €" and 29 € / MOIS;
  - three of the seven offers say "SUR DEVIS", which withholds a price rather than refusing anything;
  - no row says what the studio will not do.

  Two candidates, both excluded:
  - "nom de domaine inclus (1 an)" in the 790 € list: a standard term that could not count against the vendor.
  - The coaching card's "l'outil le plus adapté à votre besoin (Wix, WordPress, vibe coding)", together with "la possibilité, pas l'obligation, que je m'occupe de la suite". This is a real concession, since it steers clients toward doing the work themselves, but it is offer prose, not an entry in an artefact.
- `one-accent-discipline`: two accents, each used across the page.
  - Orange `#E94E1B` paints the frame, the H1, the section titles, the prices, the index circles and the primary CTA.
  - Lime `#D7F25A` paints 12 highlighter bands, the secondary CTA, the "UN CAFÉ ?" line and the contact eyebrow.

  On top of those there is one pink chip and a second orange, `rgb(203,75,11)`, on the cookie button.
- `live-claim-control`: no control tests a claim. The CTAs are links, and the dock buttons are labelled only "action".
- `single-optical-anchor` (rule-ineligible, undefined; my honest call): **absent**. In the first viewport the 72px orange H1 is the largest mass, but it does not stand alone:
  - its orange is shared by the 24px page frame, the eyebrow, the primary CTA and the 20px orange intro paragraph below;
  - its lime highlight is the same lime as the secondary CTA;
  - the two shadowed CTA blocks (227x70 and 230x70) are near-equal heavy masses of their own.

  Several saturated masses compete. This is not "one mass dominates because there is only one mass"; no single mass wins.

## 5. Near-misses

- `asymmetric-split`: rests on one section, the portrait/bio block at 3.33:1, which is also the stock "photo beside bio" layout. Every other two-column block is between 1.0 and 1.22. Flip: net −1.
- `density-variation`: modest. Half the page height (`#prestations`, 4109px) repeats one card texture. Flip: net −1.
- `stock-photo-generic`: the Mont-Saint-Michel image is regionally specific, and the portrait may be a real photograph. But four of the five card images have no tie to the vendor at all, and the eye macro is the textbook stock metaphor. Flip: net −3.
- `generic-sans-default`: Anton for display and Mono for labels are deliberate choices, but Inter carries every prose node, and the precedent scores the body. Flip: net −3.
- `shows-deliverable`: "(1 an)" and the Wix/WordPress/vibe-coding concession were the only candidates. Neither is an embarrassing entry inside an artefact.
- `gradient-blob` / `one-accent-discipline`: the highlighter bands are technically `linear-gradient`s, but they look flat. They count toward the second accent, not as a blob.
- **A defect, recorded but not scored:** the bio grid (`grid gap-px md:grid-cols-2`, background `rgb(20,20,20)` to draw the hairlines) has three children in two columns. Its empty fourth cell exposes the grid background as a solid 434x188 black rectangle beside "MES EXPÉRIENCES COCASSES". In the strip it reads like a deliberate colour block. It is not one.

## 6. Verdict: mixed, net −2

Net = 2 slop present − 4 craft present = **−2**. Every flip in the near-misses keeps the page between −3 and 0, inside the `mixed` range (−6 to +3). It is nowhere near the `slop` bar of net ≥ +4.

−2 also touches the `exemplar` range, and I am not calling it exemplar:
- The craft it earns is typographic and compositional only: scale, pairing, one unequal split, texture.
- The substantive pair is absent: no real product surface, no deliverable.
- The imagery is generated any-company stock with invented site screens.
- Two loud accents run in parallel.
- The page carries template residue: an orphan grid cell painting a black block, a share dock of three buttons each labelled `aria-label="action"`, and a shadcn cookie bar in a second orange.

This is a confident, styled page for a one-person studio. Its type system does real work, and its content shows none of the studio's actual work. That is the common `mixed` shape, and I am not rounding it in either direction. The page is 7601px tall, so this is not a thin page scoring well because the signals had nowhere to fire.
