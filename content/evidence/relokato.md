---
source: https://relokato.com/
kind: site
cohort: ai-builder
verdict: mixed
studied: 2026-10-19
context: [hero, nav, features, pricing, cta, footer, faq]
signals:
  gradient-blob: absent
  three-card-row: unresolved
  glass-card-overuse: absent
  emoji-as-icon: present
  generic-sans-default: absent
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
  asymmetric-split: absent
  single-optical-anchor: absent
  type-scale-high-contrast: absent
  editorial-grid-break: absent
  custom-type-pairing: present
  real-product-surface: absent
  shows-deliverable: absent
  density-variation: unresolved
  one-accent-discipline: unresolved
  live-claim-control: absent
materials: [single-theme, stock-photo]
---

**Sampling: random draw.** One of twelve drawn with seed 20261019 from the twenty-two gallery sites left after the first draw (same pre-stated exclusions). `gunsvzombies`, drawn first, returned 404 (project deleted) and was replaced from the same seed by `openmark`. Not chosen on any signal.

Rated by two independent blind raters on 2026-10-19, neither reading the other's draft. Both reached `mixed`. They agreed on 23 of 26 signals; the 3 splits `three-card-row` (A absent, B present), `density-variation` (A present, B absent), `one-accent-discipline` (A present, B absent) are recorded `unresolved`, which never counts toward a rule. Both write-ups follow in full.

**Rater A.**

1440x900, full page 4063px, 6 tiles, `clamped: false`, `coverage` 1.0, stitched height 4063 equal to page height, last strip ends in the real footer (y3994-4063, `rgb(28,25,23)` bar with 11 links). Walk landed 0/700/1400/2100/2800/3163. The cookie banner (Termly) is `position: fixed` at y757 and is repeated across bands in the stitch; it is a third-party overlay, not page content, and is excluded from every score below. The page is a static marketing root for a relocation-planning product; the product itself lives at `/start` and `/demo`, both reached by click and out of scope.

**`emoji-as-icon` present.** Three privacy cards carry 🔒, ✓ and 🛡️ as their only icons (15px, Plus Jakarta Sans, `hp-zc-ico`), each beside a heading that already says the same thing ("No document uploads", "You tick it off yourself", "Nothing to leak"). The demand-ranking kicker is "🗳 LIVE DEMAND RANKING" at 10px. That is four decorative glyphs doing an icon set's job. The hero's country flags (7 buttons at y883, 8 more at y3154) are national identifiers carrying data, not icons, and are not counted; the ☰ at y0 is a hamburger and a platform control.

**`scroll-reveal-blank` present.** 13 elements carry `.hp-reveal`, CSS `opacity: 0; transform: translateY(14px)`, and only gain `.hp-visible` (`opacity: 1`) on scroll. A 14s load-and-dwell with no scrolling leaves all 13 at opacity 0; a scrolled walk turns all 13 to 1. The dwell did not recover them, so the gate is scroll, not time. The gated text includes whole sections: "HOW IT WORKS", "Three steps to a plan you can actually work from.", the 01/02/03 steps, "PRIVACY BY DESIGN" and all three cards, both FREE TOOL cards, and the closing CTA. A no-JS reader, a print, a prefetch or an agent that does not scroll gets 13 blank blocks spanning y1004 to y3884 of a 4,063px page. Note the reduced-motion rule is present and correct (`.hp-reveal` forced to `opacity: 1`) — the defect is the default path, not the reduced-motion one.

**`custom-type-pairing` present.** Three faces with three distinct jobs, all bound to tokens: `--font-display: Georgia, "Times New Roman", serif` sets the H1 at 50px/54px and every H2 at 22-36px (27 nodes); `--font-body: "Plus Jakarta Sans"` sets 200 nodes of copy; `--font-mono: "DM Mono"` sets 69 nodes, all small uppercase tracked labels — section kickers at 10px ("MOVING ABROAD, ORGANISED", "HOW IT WORKS", "PRIVACY BY DESIGN", "QUESTIONS, ANSWERED"), step numbers "01-03" at 11px, prices "$0 / $19/mo" labels, and the footer links. Georgia is a system face rather than a web font (27 of 358 visible nodes), and the other two are Google faces, which is the usual ai-builder shape; what lifts it above `generic-sans-default` is that the serif is doing the display work consistently across every heading, and the mono is a real third role rather than a stray. The H1 sets a colour change on its last word ("handled." in `rgb(15,118,110)`), but the family pairing stands on its own.

**`density-variation` present.** Measured as characters per 1,000px of section height: `hp-tools` 1,156, `hp-zc` 1,364, `hp-steps` 1,181, against `hp-priceline` 347 (a 124px band carrying "$0 FREE / $19/mo MONTHLY"), `dv-root` 279 (an 897px vote list of eight rows plus a Cloudflare Turnstile check), and `hp-footer-cta` 294. A 6.5x spread between the densest and thinnest sections, with the thin ones earned (a price band, a ranked list) rather than accidental.

**`one-accent-discipline` present.** One accent, teal `rgb(15,118,110)`, max-min RGB chroma 103, carried through 18 background fills, 17 text colours and 3 borders. The only other non-neutral is gold `rgb(200,150,62)` used twice, both times on the primary "Build my plan →" button (nav and closing CTA), which is a CTA colour rather than a second accent hue; the deep forest `rgb(29,61,47)` nav bar and `rgb(19,78,74)` closing CTA are tints of the same teal family, and the mint `rgb(93,191,148)` is the Nomad Mode pill's fill. Zero-to-one accent is present by the stated ruling; this page is a genuine one, not a zero.

Everything else absent, with the near-misses named:

- **`asymmetric-split` absent, and it is the closest call on the page.** The hero is two columns, `512px 512px`, gap 56px, inside a 1080px container (h1 x180 w512; photo x749 w510 y277, 89px lower). The 89px vertical offset is a deliberate stagger, but the columns are equal within 2px, and "asymmetric" has to mean the columns are not a mirror. Equal columns with one dropped is a stagger, not a split.
- **`real-product-surface` absent.** No product UI appears anywhere on the root: DOM census is 0 `iframe`, 0 `canvas`, 0 `video`, one `<img>` (the hero photograph), and 8 inline SVGs all 14x14 chevrons. The hero destination picker is eight routing buttons; the "FREE TOOL" cards are links to `/tools/visa-checker` and `/tools/cost-calculator`. Clicking a destination does reach a real three-step funnel at `/start?dest=portugal` which ends in a genuine shortlist (D8 Digital Nomad Visa, source "AIMA — Official D8 Info · reviewed 2026-09-08"; D2 Entrepreneur Visa, "Lei 23/2007, art. 60.º"). That surface is real and good, but it is behind a click and off the rated URL, so it cannot pass this signal; recorded here because a rater reading the page would find it.
- **`shows-deliverable` absent.** The signal needs an artefact whose content could count against the vendor. The root has a price line ($0 / $19/mo) and a disclaimer ("Relokato is a planning tool, not a law firm, tax practice or immigration representative"), and neither is a unit of output. The vote list is live and honest — the Supabase RPC `destination_vote_counts` returned `[{germany 1}, {japan 1}, {georgia 2}, {greece 1}]` and the bars are drawn at 100/50/50/50/0/0/0/0%, proportional to those counts — but a demand poll is aggregate adoption, which the corpus rules exclude however well built. The shortlist at `/start` would likely pass (two routes named, both sourced and dated, with "This is a starting list, not an eligibility decision"), and it is not on this URL.
- **`live-claim-control` absent.** The page's central claim is "Every requirement links to the official source it came from, with the date it was last reviewed." No control on the root lets a visitor test that claim. The vote list's claim ("We build destinations in order of demand") is testable via a vote, but a vote records a preference; it cannot falsify anything the page asserts. Drilled to check: clicking row 05 fired `POST /rest/v1/rpc/destination_vote_counts` with an empty body `{}` and the bars did not move (still 100/50/50/50/0/0/0/0%); the section's submit button is disabled ("Pick a destination →") behind a Cloudflare Turnstile check, so a vote cannot be completed without solving a human check. A control that cannot answer on the page is not a falsification affordance.
- **`stock-photo-generic` absent.** One photograph, `home-hero-lisbon-DzNJTQgc.jpg`, 1600x1200, rendered 510x383, alt "Rooftops of Lisbon in late-afternoon light, with the river and bridge beyond", captioned "LISBON, PORTUGAL". It is a specific place, named and caption-sited, no text over it and no scrim. It could be stock, but it is not interchangeable: the product is about moving to named cities and the picture names one.
- **`symmetric-everything` absent.** `symmetry.cjs` reads 0 of 7 h1/h2 headings centred, share 0.00. This is the strongest single number on the page: every heading is left-aligned at x180, including the closing CTA ("Ready to make / your move?").
- **`type-scale-high-contrast` absent.** `ladder.cjs` max 50px against 16px body = 3.13:1, below the 3.75 cut. Near-miss worth naming: the H1 at 50px is a real display size, but the body at 16px is too large to make the ratio.
- **`badge-pill-spam` absent.** One decorative pill above the fold: "Nomad Mode" (h21, radius 20px, `rgba(93,191,148,0.18)`) in the nav. The seven destination links below the fold are flat, not pills.
- **`generic-line-icon-set` absent.** 8 visible SVGs, all 14x14, `viewBox 0 0 24 24`, 2 paths, 2px stroke — but they are all the same right-chevron arrow inside the eight destination buttons, whose heading is "Where would you like to move?". An arrow indicating a choice is not an icon carrying a claim beside a heading.
- **`glass-card-overuse` absent.** 0 elements with `backdrop-filter`.
- **`gradient-blob` absent.** The only `background-image` on the page is the footer CTA's `radial-gradient(circle, rgba(94,234,212,0.05) 1px, transparent 1px)`, a 1px dot texture, not a blob.
- **`gradient-fill-cta` absent.** Both "Build my plan →" buttons read `background-image: none`, flat `rgb(200,150,62)`.
- **`indigo-violet-accent` absent.** Hue census is teal/forest/mint/gold only. No blue-violet anywhere.
- **`three-card-row` absent.** The privacy section is three equal cards, but the row is not the whole of a section the way the corpus defines it: it sits under a heading and a 60-word lede inside a 437px section, and the cards are three paragraphs of the same argument rather than three interchangeable feature tiles. The FREE TOOL band is two cards, not three.
- **`testimonial-card-row` absent.** There is no testimonials section, no testimonial text, no quote, no logo wall. Absent by absence of the section, not by measurement.
- **`centered-hero-stack` absent.** H1 x180, photo x749, CTA to the right. Nothing in the hero is on the axis.
- **`hero-mockup-float` absent.** No device, no UI, no floating card; one photograph.
- **`editorial-grid-break` absent.** 1080px container at x180 held on all 11 sections. The full-bleed colour bands (nav, price line, vote section, closing CTA) are blocks of a normal rhythm, not a broken grid; no element overhangs, offsets past the container, or sets type against a rule.
- **`single-optical-anchor` absent (rule-ineligible; honest call).** Two masses of near-equal weight compete in the hero: the 512px three-line 50px serif headline and the 510x383 photograph. The headline has the colour break on "handled." but the photograph has the only colour in the region and the larger area. The page does have a single *type* anchor (Georgia is the only display face, and it is used for the h1, every h2, the footer wordmark and the closing CTA), and a rater who reads the anchor as typographic would call present. I do not: the photograph is a second anchored object at equal width, which is exactly what the rule-ineligible signal cannot resolve. Stated so a second rater can disagree on stated grounds.
- **`generic-sans-default` absent.** Body copy is Plus Jakarta Sans, loaded from Google Fonts, and the mono is DM Mono; the display face is Georgia. Not the UA stack.
- **`typewriter-headline` absent.** H1 is static text, no timer, no cycling.

**Verdict: mixed, net −1** (2 slop present − 3 craft present).

The distribution: 2 slop (`emoji-as-icon`, `scroll-reveal-blank`) against 3 craft (`custom-type-pairing`, `density-variation`, `one-accent-discipline`), net **−1**. That sits inside the `mixed` band (−6..+3), four below the +3 mixed anchors (deepmark, stripe-2014) and five below the +4 floor for `slop`.

The comparison the rules demand: deepmark (+3, re-passed to +2) carries six slop signals — a centred hero stack, a floating mocked-up phone, a pill-spam section-label system, a generic icon set, a default sans, and interchangeable stock — against four craft. Relokato carries two slop signals and no template structure at all: no centred hero, no mockup, no pill row, no gradient, no violet, no testimonial row. What it has instead is a clearly authored editorial voice (serif display, small-caps mono kickers, left-aligned everything, one teal, one gold CTA), a specific photograph, and a live vote list whose bar widths check against its own API. Its two defects are narrow and localised: emoji standing in for icons in one section, and a scroll gate that hides 13 blocks including two whole sections from anything that does not scroll. Neither is a template tell; both are fixable in a day. This is not `slop`, and it is not close enough to `mixed` at the low end to be an `exemplar` either. 4,063px and 11 sections, so the thin-page caveat does not apply: the page has enough surface for signals to fire, and most of them did not.

A `slop` verdict would require net ≥ +4, which would mean six more slop signals than craft on this page. I could find no measurement that supports any of them; the closest are `three-card-row` (the privacy row is three cards but is not a section of three equal feature tiles), `asymmetric-split` (equal columns), and `real-product-surface` (the funnel behind the click). All three are stated above with their measurements so the calls can be checked.

**Rater B.**

A relocation-planning product's home page: cream paper, a dark green nav band,
Georgia display type, mono eyebrows, one Lisbon photograph, and no picture of
the product anywhere. Three slop signals against one craft signal, net **+2**.
The page avoids almost every loud tell (no gradients, no blur, no pills, no
centred stacks, no violet) and earns almost none of the expensive craft: it
never shows a plan, its type ramp is flat, and below the hero every band has
the same density. Rater B, blind.

**Capture.** Viewport 1440x900. Walk at `~/scratch/antislop/s5/relokato-B`:
6 tiles, `clamped: false`, `coverage: 1`, scroller `window`,
`docH_before` = `docH_after` = 4063, no inner scroller, last landing asked
3500 landed 3163 (bottom of page). Stitched with `NS_SESSION=s5`: one strip,
1440x4063, 0px drift ("0 slug(s) where stitched height != page height"). The
strip ends in the footer (y3994-4063, "© 2026 Relokato" and ten legal links).
The Termly consent banner (`position: fixed`, third-party) paints into every
tile; for ink measurement I shot a separate full-page reference with that one
fixed node removed (`~/scratch/antislop/s5work/relokato/clean.png`, 4063px,
same height). Bands from the DOM: nav y0-90, hero `.hp-h2` y90-864 (containing
the destination picker `.hqf` y508-786), steps `.hp-steps` y928-1277, privacy
`.hp-zc` y1277-1714, tools `.hp-tools` y1714-2034, price line y2034-2158,
disclaimer y2158-2252, FAQ y2252-2896, demand ranking `.dv-root` y2896-3793,
footer CTA y3793-3994, `<footer>` y3994-4063. Values below are computed style,
network responses or pixel counts, not read off the strip.

**Slop signals present (3)**

- `three-card-row`. The privacy section is three equal card containers in one
  row, `.hp-zc-card` x3, each 348x169, `background rgb(245,240,232)` on a
  white band, `border 1px rgb(212,204,190)`, `border-radius 12px`, each
  holding a 15px glyph, a title and a two-line paragraph. Real card chrome on
  all three, identical boxes, and the row is the whole body of its section.
  The steps section above it is three columns with `background
  rgba(0,0,0,0)`, `border-width 0px`, no radius, which is railway-com's
  absent shape and is not counted. The tools section is two cards, not three.
- `emoji-as-icon`. The three privacy cards' icons are emoji, each in a
  `<div class="hp-zc-ico" aria-hidden="true">`: 🔒, ✓ and 🛡️ at 15px, set in
  the body stack (`"Plus Jakarta Sans", system-ui, ...`), not an icon font and
  not captured output. Each duplicates its heading ("No document uploads",
  "You tick it off yourself", "Nothing to leak"). 🗳 also opens the 10px mono
  kicker "Live demand ranking". The 16 flag pairs (7 in the destination strip
  at y883, 8 in the ranking rows at 20px, plus 🇵🇹 etc.) are a weaker case
  because a flag distinguishes a country faster than its name does; the signal
  rests on the privacy row and the ballot box, not on the flags.
- `scroll-reveal-blank`. 13 elements carry `.hp-reveal`: the "HOW IT WORKS"
  kicker and its H2, all three step columns, the privacy head (kicker, H2,
  lede), all three privacy cards, both free-tool cards, and both halves of the
  footer CTA. Together they hold 1,722 of the 3,613 characters of `<main>`
  text, 48%. Dwell control: a fresh load left unscrolled for 14s has all 13 at
  computed `opacity: 0`. Walked at 500px steps they gain `hp-visible` and all
  13 compute `opacity: 1`. The dwell does not recover them, so the gate is
  scroll, not time. Nearly half the page's prose, including its whole privacy
  argument and the closing CTA headline, is blank to no-JS, print and any
  agent that reads without scrolling.

**Craft signals present (1)**

- `custom-type-pairing`. Three faces, each assigned one job in the CSS root
  (`--font-display: Georgia, "Times New Roman", serif`; `--font-body: "Plus
  Jakarta Sans", ...`; `--font-mono: "DM Mono", ...`) and used that way
  without overlap. All 7 h1/h2 compute Georgia (50, 36, 30, 28, 28, 27, 22px),
  the H1's first line italic. Body leaves are Plus Jakarta Sans (14 of the 27
  prose leaves over 20 characters), and every eyebrow, numeral and small label
  is DM Mono at 10-12px ("MOVING ABROAD, ORGANISED", "PRIVACY BY DESIGN",
  "FREE TOOL", "LISBON, PORTUGAL", 01/02/03, "$19/mo", both CTA labels).
  Scored on the corpus precedent (permit-guide-ai, deepmark): faces divided by
  role count, even when each face is a common default.

**Near-misses, and what settled each**

- `stock-photo-generic` absent, the closest call on the page. The only bitmap
  is `/assets/home-hero-lisbon-DzNJTQgc.jpg`, 1600x1200, no EXIF, rendered at
  510x383 in the hero's right half: golden-hour Lisbon rooftops, the castle
  and the 25 de Abril bridge. It has a specific `alt` ("Rooftops of Lisbon in
  late-afternoon light, with the river and bridge beyond") and a 10px mono
  caption "LISBON, PORTUGAL", and Portugal is the first destination in the
  picker beside it. osseus fired the first limb because its scenery "contains
  none of" the product's subject and could front a hedge fund without an edit;
  permit-guide-ai's photo "names no city". This one is the product's subject,
  a destination, named. The second limb is inverted: the H1 column (x180-692)
  and the image (x749-1259) never overlap, so no scrim exists. The case for
  present is that a Lisbon postcard could front any Portugal-facing business
  and shows nothing of Relokato. Flip: net +3.
- `one-accent-discipline` absent, on railway-com's ruling (one hue on the
  CTAs, a second on the eyebrows: two chrome accents). Here gold `#c8963e`
  fills both primary CTAs (`Build my plan →`, nav and footer) and nothing
  else; teal `#0f766e` (38 element-uses) takes the H1's second line
  "handled.", every eyebrow kicker, the in-text links, the ranking bars and
  the selected-row border, with tints `#134e4a` on "$0" and `#5eead4` on the
  footer CTA's "move?". A third hue, mint `#5dbf94`, fills the "Nomad Mode"
  nav pill. Gold never sets text, so a rater reading accents as emphasis on
  type gets present. Flip: net +1.
- `single-optical-anchor` absent (rule-ineligible, recorded by procedure).
  What I counted: the hero holds two masses of comparable footprint in a
  50/50 split. Left, a 512px column from y154 to y808 carrying the kicker, the
  50px two-line H1 (512x162), the lede and the 2x4 destination grid; right,
  the 510x383 photograph, the only full-colour area on the page. The H1 is the
  darkest type, the photograph the most saturated block, and neither
  subordinates the other. This is not "one mass because there is only one
  mass": there are two, and they tie. Flip: net +1.
- `density-variation` absent. Ink by band on the clean reference (pixels more
  than 60 summed RGB from the band's modal colour): hero 19.96%, steps 3.26%,
  privacy 4.95%, tools 3.59%, price line 2.75%, disclaimer 2.97%, FAQ 2.11%,
  ranking 3.66%, footer CTA 4.16%. The hero's figure is the photograph. Below
  it, nine bands sit between 2.11% and 4.95%, a 2.3x swing, each the same
  module (10px mono kicker, 27-30px Georgia H2, 13-14px body in a 1080px
  column). Band heights vary (94px to 897px) but density does not; acyclic was
  held absent on a 6.5x swing with the same argument. Flip: net +1.
- `type-scale-high-contrast` absent, measured. `ladder.cjs`: `ratio 3.13`,
  `maxFs 50`, `bodyFs 16`, `ratioSub 3.33` (15px lede). Below the 3.75 cut.
  The ramp under it is shallow too: 50, 36, 30, 28, 27, 22.
- `asymmetric-split` absent. The one split is the hero, 512px text against a
  510px image at x180 and x749 in the 1080px column, 50:50 by width. Same
  widths at 1920px (x420 and x989). Different content, same proportion.
- `live-claim-control` absent. The hero's "Where would you like to move?"
  grid is live, but clicking Portugal navigates to `/start?dest=portugal`
  ("QUESTION 2 OF 3, Which passport do you hold?"), another page. Scored at
  rest it is a doorway, and nothing on this page lets the visitor test the
  central claim that "Every requirement links to the official source it came
  from, with the date it was last reviewed." The demand-ranking vote is live
  too (below) but tests demand, not that claim.
- `real-product-surface` absent. The nearest thing is the demand ranking:
  8 rows of 824x46 (rank, flag, name, 4px bar, radio), backed by a real
  Supabase RPC (`/rest/v1/rpc/destination_vote_counts` returned georgia 2,
  germany 1, japan 1, greece 1), and clicking a row really enables
  `Vote for Georgia →` behind a Cloudflare Turnstile. It is a waitlist poll,
  not the planning product. No plan, step, deadline or source link appears;
  the two free-tool cards are text links to `/tools/*` with no preview.
- `shows-deliverable` absent. I cannot name an entry that could embarrass the
  vendor inside an artefact, because there is no artefact of the product's
  output. The ranking is a vendor-aggregate figure (it can only flatter by
  being larger; the counts are hidden, `.dv-count` empty, so even the
  near-empty 2/1/1/1 tally is shown only as bars at 100/50/50/50%). The page's
  most honest sentence, "Relokato is a planning tool, not a law firm, tax
  practice or immigration representative. Official requirements change —
  verify current details with the relevant authority or consulate before
  acting.", is a 94px disclaimer band, vendor prose and not an artefact.
- `badge-pill-spam` absent: one pill above the fold ("Nomad Mode", 97x21,
  radius 20px). Threshold 3.
- `generic-sans-default` absent on face identity: Plus Jakarta Sans and DM
  Mono are loaded from Google Fonts (both 200, 20 `FontFace` entries) and
  Georgia is the display face; none is Inter, Geist or a system stack, as
  dachly (Outfit), aviern (Archivo) and sentient-os (Satoshi). `body` computes
  the Tailwind system stack, but no rendered prose leaf uses it.
- `generic-line-icon-set` absent: 8 inline SVGs, all 24-unit, 14x14, 2 paths,
  all arrows inside the destination buttons. A control affordance, not a
  feature-icon row.
- `gradient-blob` absent: the only gradient is `.hp-footer-cta-texture`,
  `radial-gradient(circle, rgba(94,234,212,0.05) 1px, transparent 1px)`, a
  5%-alpha dot grid over 1440x201.
- `glass-card-overuse` absent: 0 elements with a `backdrop-filter`, 0 with a
  `filter`.
- `gradient-fill-cta` absent: both CTAs flat `rgb(200,150,62)`,
  `background-image: none`.
- `indigo-violet-accent` absent: rendered hues are teal (~175°) and gold
  (~38°). `--status-accent: #a78bfa` exists in the CSS root and is never used
  on this page.
- `symmetric-everything` absent by procedure: `symmetry.cjs`, h1-h2 basis,
  0 of 7 centred, share 0.
- `centered-hero-stack` absent: H1 `text-align: start` at x180, everything in
  the hero left-railed.
- `typewriter-headline` absent: 12 one-second samples of the hero's H1 and
  lede returned one distinct state.
- `testimonial-card-row` absent: no testimonials section exists.
- `hero-mockup-float` absent: no UI in the hero; the right half is a
  photograph.
- `editorial-grid-break` absent: every content block sits inside the 1080px
  column (FAQ 760px, ranking 824px); only the nav, footer and band
  backgrounds bleed.

**Materials.** `single-theme`: the stylesheet carries a full `.dark` token
block (`--background: #020618` and the `--ink-*` ramp) but no
`prefers-color-scheme` rule in either CSS file, no `.dark` class on load and
no toggle in the DOM; loaded with `colorScheme: 'dark'` the body still
computes `lab(100 0 0)`. The dark tokens are dead. `stock-photo` for the hero
JPEG as the nearest token (no credit, no EXIF, hashed filename; it may be
generated, which the list has no token for).

**Verdict: `mixed`, net +2.**

Slop present 3 (`three-card-row`, `emoji-as-icon`, `scroll-reveal-blank`)
against craft present 1 (`custom-type-pairing`). Net **+2**, inside the mixed
band (-6..+3) and two below the slop floor, so no separation prose is owed.

What the page is: a builder-assembled home page with a disciplined palette
and a real type system, whose slop is low-count and quiet (one card row, one
emoji set, one reveal system) and whose craft deficit is large. It is not
thin: 4063px, eleven bands, a working poll, a FAQ. So the craft absences are
not "nowhere to fire". A page selling a step-by-step plan had room to show
one, and a 50px H1 over 16px body had room to reach 3.75:1.

Sensitivity, stated so a second rater can check it. Each of the four calls I
flagged moves net by one: `stock-photo-generic` to present gives +3;
`one-accent-discipline`, `single-optical-anchor` or `density-variation` to
present each give +1. The only path to +4 is `stock-photo-generic` present
**and** `custom-type-pairing` absent together, and even then the comparison
with deepmark (+3, 7 slop) and stripe-2014 (+3, 6 slop) would run against
`slop`: this page's slop count tops out at 4, below both mixed anchors, so a
+4 here would come from missing craft, not from accumulated tells. I would
not write `slop` on that.

**Unresolved.** None.
