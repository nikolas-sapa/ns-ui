---
source: https://vizleads.lovable.app/
kind: site
cohort: ai-builder
verdict: mixed
studied: 2026-10-18
context: [hero, nav, features, testimonials, cta, footer, integrations]
signals:
  gradient-blob: present
  three-card-row: present
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: present
  symmetric-everything: present
  badge-pill-spam: absent
  generic-line-icon-set: absent
  testimonial-card-row: absent
  indigo-violet-accent: present
  gradient-fill-cta: absent
  scroll-reveal-blank: present
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: present
  hero-mockup-float: unresolved
  asymmetric-split: absent
  single-optical-anchor: unresolved
  type-scale-high-contrast: present
  editorial-grid-break: absent
  custom-type-pairing: absent
  real-product-surface: present
  shows-deliverable: absent
  density-variation: present
  one-accent-discipline: absent
  live-claim-control: present
materials: [single-theme]
---

Rated by two independent blind raters on 2026-10-18, neither reading the other's draft. Both reached `mixed`. They agreed on 24 of 26 signals; the 2 splits `hero-mockup-float` (A present, B absent), `single-optical-anchor` (A absent, B present) are recorded `unresolved`, which never counts toward a rule. Both write-ups follow in full.

**Rater A.**

## Capture

1440x900. Walk `vizleads-A`: 5 tiles, `clamped: false`, `coverage: 1.123`,
`docH_before` 2911, `docH_after` 3269. The fourth and fifth landings came up
short of the asked offset (2100 -> 2011, 2800 -> 2369) because the page grew
under the walker, and the stitcher stitched to the settled height: one strip,
3269px vs page 3269px, no drift. Last strip ends in the footer ("© 2026
VizLeads · How it works · Contact").

The 358px of growth is **not** the job table loading. At `networkidle` plus
8s with no scroll, `scrollHeight` is still 2911 and the 20 table rows are
already rendered. The growth is the `section#contact` block, which stays an
empty shell until the viewport reaches the page bottom, then mounts. That is
recorded under `scroll-reveal-blank` below.

Page height 3269 CSS px: hero with product panel, a source marquee, a 3-up
"how it works", a one-quote testimonial, a closing CTA, a contact form,
footer. A thin page. Mobile (390x844) reflows to 3557px and is otherwise clean.

Stack: Vite bundle on Lovable (`/assets/index-aGg1g0As.js`, `/~flock.js`, the
"Edit with Lovable" badge), Inter from Google Fonts, data from a Supabase
project (`rpc/get_public_job_preview`, `feedbacks_with_profiles`). Page
wrapper `#0a0a0c` over body `rgb(12,12,14)`, dark only. With JS disabled the body renders 0 characters.

## Slop signals present (8), with the measurement

**`gradient-blob`.** `div.absolute.top-32.left-1/2`, 600x400px,
`rounded-full`, `background-color: rgba(99,102,241,0.08)`, `filter:
blur(120px)`, behind the hero stack. Faint on the `#0a0a0c` page wrapper but legible as
an indigo cast in the hero crop, and it is the blob construction exactly: a
blurred coloured disc with no content. Near-miss, see below.

**`three-card-row`.** The "how it works" band is three equal panels, 174px
tall each, one container with 1px dividers: `01 Search across sources` /
`02 Save & get alerts` / `03 Find the decision maker`, an 18px heading and
one 14px sentence each. Numbered rather than iconed, still the module.

**`generic-sans-default`.** Inter at 400-700 for every display and body node.
`ladder.cjs` reports `bigFamilies: ["Inter"]`, `smallFamilies: ["Inter",
"ui-monospace"]`; the monospace is the 11px `vizleads.app/search` URL chip and
the `01/02/03` indices. No display face, no second family.

**`symmetric-everything`.** Hero stack, marquee, 3-up, testimonial heading,
closing CTA, contact form: every section is centred on one axis. The only
left-aligned block on the page is the single testimonial card, which sits
at the left of an otherwise empty 3-column grid (a one-item grid, not a
composition decision).

**`indigo-violet-accent`.** The headline's second line "Free forever." is
`linear-gradient(to right, rgb(129,140,248), rgb(192,132,252))` clipped to
text at 64px; the logo mark is `linear-gradient(rgb(99,102,241),
rgb(147,51,234))`; the `01 02 03` indices are `rgb(129,140,248)`; the blob
is indigo-500. The archetypal hue, in marketing chrome, in three forms.

**`scroll-reveal-blank`.** Walk vs dwell, two fresh loads, 3s pre-wait, then
6 steps at 900ms settle (7236ms walk, 7227ms dwell), census of every text
node with effective opacity multiplied up the ancestor chain, nav/footer
excluded. Walk: 137 nodes at t0, 0 hidden; 140 after; **3 nodes, 86
characters, newly visible**: "Get in touch", "Questions, custom needs,
partnerships — we read every message.", "Send message". Dwell (scrolled to
0 every step): 137 -> 137, **0 newly visible**, `scrollHeight` 2911
throughout. A separate 8s no-scroll dwell also never mounts it. The gate is
the scroll. This is lazy *mounting* rather than opacity gating (the nodes do
not exist until scrolled to), which is a stricter version of the defect the
signal names: an agent, a print or a no-scroll prefetch gets an empty
`<section id="contact">`, and the nav's "Contact" link points at it. The
count is small, the same order as provenmetal's 5-node closing band, which
the corpus scores present.

**`centered-hero-stack`** (recorded fact, expected rule-ineligible). Emerald
eyebrow pill, two-line 64px H1, 16px subhead, CTA row, panel, all centred.

**`hero-mockup-float`** (recorded fact, expected rule-ineligible). A 768x632
`rounded-2xl` window with traffic-light dots, URL chip and a "live" dot,
`box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4)`, directly under the CTA row.
It is a live surface, not a fake one (see `real-product-surface`), and is
recorded here on the databuddy precedent: a framed, floating app window in
the hero fires this signal even when the window is live.

## Slop signals absent, and what settled each

- `glass-card-overuse`: one `backdrop-filter` surface in the document (the
  hero panel, `blur(8px)`). Threshold 3+.
- `badge-pill-spam`: one decorative pill above the fold ("100% Free ·
  Unlimited searches · No credit card", 28px, emerald). The page has two in
  total; the second ("Free forever · No credit card · No limits") is at
  y=2363 over the closing CTA. Threshold 3+ above the fold.
- `emoji-as-icon`: a tree-walk over every text node finds 3 symbol glyphs,
  all U+2713, all in one 12px Inter line of fine print under the panel ("✓
  Unlimited job searches · ✓ Unlimited lead searches · ✓ Free forever"). A
  font glyph inside a sentence, not an icon. All iconography is Lucide SVG.
- `generic-line-icon-set`: Lucide is the only set (search, map-pin,
  arrow-right, lock, sparkles, star, building2 at 12-16px), but none of it
  heads a feature item. The 3-up is numbered, not iconed. Every Lucide mark is
  an affordance (field glyph, button arrow, lock on the unlock button) or a
  rating star. Nothing to duplicate a heading.
- `testimonial-card-row`: one quote card ("loved it", Santhosh Maisa, a
  real Google avatar). The `feedbacks_with_profiles?limit=3` request returns
  1 row. One card is not a row of 3+.
- `gradient-fill-cta`: every button is a flat fill (`#fff` primary CTAs,
  flat `rgb(99,102,241)` Search and Send message). Zero gradient buttons.
- `typewriter-headline`: static H1.
- `stock-photo-generic`: the only raster in the document is a 96px Google
  avatar shown at 28px.

## Craft signals present (4)

**`real-product-surface`.** The hero panel is the product's own search screen
wired to its backend. Page load fires `POST rpc/get_public_job_preview`
`{"_query":null,"_location":null,"_limit":30}` and renders the response as
the table; typing "product designer" and clicking Search fires the same RPC
with `"_query":"product designer","_limit":40` and re-renders. The rows carry
real outbound listings (`adzuna.in/details/5593191738?...`,
`in.indeed.com/job/erpnext-developer-...`). It is a cached preview (all 30
rows share one `created_at`, `2026-07-15T12:22:15.872189+00:00`, and the
panel says "sign in to fetch live across 4 sources"), but the surface is the
product's real results screen, not an invented one, and not a doorway: the
result table is what the product sells.

**`live-claim-control`.** The page labels the control itself ("Live preview
· sign in to run real searches & save them"), and it lets a visitor falsify
the headline "Search any job." I did: "product designer" returned **0
rows**, and the panel printed "No matches yet. Try a broader query." / "0
preview rows · sign in to fetch live across 4 sources". The control let the
page's central claim fail in front of the rater.

**`type-scale-high-contrast`.** `ladder.cjs`: **4.0:1** (64px H1 over 16px
body), clear of the 3.75 threshold and of the five-file tie at exactly 3.75.
The ladder is stepped, not flat: 64 / 40 / 30 / 18 / 16 / 14 / 12. What
settles it past the threshold: the 64px H1 is the only text above 40px, and
the step to the 14-16px body is a single 4x drop with no mid-size crowding.
Near-miss, see below.

**`density-variation`.** The hero panel stacks 20 rows at 46px with 11px
uppercase column heads and 14px cells inside 632px; the 3-up gives each
18px heading a 174px panel; the closing CTA is one 40px line and one button
in about 500px of empty band; the testimonial band is one card in a 3-column
grid with two empty columns. Tight, then open, then nearly empty. Near-miss,
see below.

## Craft signals absent, and the near-misses

- **`shows-deliverable`, absent.** Procedure: name the entry that could have
  embarrassed the vendor. There is none on the rendered surface, and the
  reason is measurable. The preview RPC returns 30 rows: 13 Adzuna, 7
  TheirStack, **10 "google"**. Every Google row has company `Unknown`, and
  most are search-results pages, not jobs: "74751 Erpnext Job Vacancies In
  July 2026" (naukri.com), "1000+ Erpnext jobs in India" (linkedin.com/jobs),
  "Erpnext Jobs, Employment" (freelancer.in). The table renders exactly the
  20 non-Google rows. Of those, 3 are legible; rows 4-20 carry `filter:
  blur(4px)` behind "Unlock 17+ more matches". So the entries that would cut
  against the product, junk SERP pages from a source the marquee advertises
  ("Powered by Google Jobs"), are the ones not rendered, and the three that
  are legible are clean postings. Nothing the reader can read could embarrass
  the vendor. The product's stated deliverable ("reveals the HR lead or hiring
  manager") is not shown at all. The 0-row search result above does count
  against the vendor, but it exists only when the visitor types a query; it
  is the control's answer, credited under `live-claim-control`, not an entry
  in the scored artefact as the page presents it.
- **`single-optical-anchor`, absent** (rule-ineligible, undefined; honest
  call). What I counted: the opening viewport holds three stacked masses on
  one axis, the white 64px H1 with its violet second line, the white 266x44
  CTA, and the top 410px of the dark panel. None dominates; the panel is
  dark-on-dark (`rgba(15,15,18,0.8)` on the `#0a0a0c` wrapper) with 3 legible rows,
  and the brightest areas are the H1 and the white button. This is not "one
  mass dominates because there is only one mass": there are three, competing
  in the centred-stack order, the same reading as deepmark, stripe-2014,
  heroku-2014 and openhack, all absent. A rater who reads the 768x632 panel
  as the anchor would call it present.
- **`one-accent-discipline`, absent.** Chromatic census of marketing chrome
  (outside the panel, chroma >= 60): indigo-violet on the logo, the blob, the
  "Free forever." gradient and the `01/02/03` indices; **emerald** on both
  eyebrow pills (`rgb(110,231,183)` text, `rgba(16,185,129,0.08)` fill,
  `rgba(16,185,129,0.2)` border), the pill dot and the closing pill's
  sparkles icon; amber `rgb(251,191,36)` on the five stars. The Google "G"
  colours are a third-party mark and excluded. Emerald is not confined to
  status: it is the eyebrow over the H1 and over the closing H2, the two most
  prominent decorative positions on the page, directly above the violet
  gradient. Two accent hues in the hero. A rater who reads emerald as a
  semantic "free" colour rather than an accent would call this present.
- `asymmetric-split`: no section is split; every block is centred.
- `editorial-grid-break`: nothing leaves the content column. The marquee is
  a `mask-fade` track 984px wide inside the 1024px `max-w-5xl` column.
- `custom-type-pairing`: Inter only.

## Near-misses, all in one place

Each of these is one rater decision from the other value. The net below moves
by one per flip.

| signal | my call | the other reading | net if flipped |
|---|---|---|---|
| `gradient-blob` | present (8% alpha, 120px blur) | too faint to be a stance | +3 |
| `scroll-reveal-blank` | present (3 nodes, 86 chars, contact form) | too small to matter | +3 |
| `single-optical-anchor` | absent (three masses) | the panel is the anchor | +3 |
| `one-accent-discipline` | absent (emerald eyebrows) | emerald is status colour | +3 |
| `type-scale-high-contrast` | present (4.0:1) | a default Tailwind step | +5 |
| `density-variation` | present (panel vs empty bands) | the dense block is mostly blur | +5 |
| `shows-deliverable` | absent (junk rows not rendered) | the 0-row search counts | +3 |

## Verdict

Net **+4**: 8 slop present, 4 craft present. Verdict **`mixed`**, because I
cannot write the separation prose the verdict rules require.

Net +4 is necessary, not sufficient. To call `slop` I would have to say, in
terms a second rater can check, what separates this page from deepmark and
stripe-2014 at +3. I tried, and the attempt fails on three checkable grounds.

1. **The margin over stripe-2014 is one rule-ineligible signal.** The two
   pages share `gradient-blob`, `three-card-row`, `indigo-violet-accent`,
   `hero-mockup-float`, `real-product-surface` and `density-variation`. Strike
   the three signals the vocabulary expects to fail eligibility
   (`centered-hero-stack`, `hero-mockup-float`, `single-optical-anchor`) and
   recount: vizleads 6 slop - 4 craft = **+2**, stripe-2014 5 - 3 = **+2**,
   deepmark 5 - 4 = **+1**. On the eligible signals this page ties
   stripe-2014. Its extra point comes from `centered-hero-stack`, a pre-AI
   convention that ran 5/7 in the 2014 cohort. (The same recount puts
   openhack, a `slop` file, at +2 too, so it does not separate the classes
   in either direction; it only shows that +4 here buys nothing over +3
   there.)
2. **The +4 sits on contested values.** Four of the eight-versus-four calls
   (blob, scroll gate, anchor, accent) are each one flip from +3, and the
   table above shows five of seven plausible flips land at +3. A slop verdict
   that any single reasonable re-read moves out of range is the contested
   slop the brief says not to write.
3. **The page's strongest content is the opposite of the slop hallmark.** The
   corpus's slop pages float invented UI; this one floats a live search that
   hit its backend and returned zero rows to the rater's query in its own
   words. stripe-2014 is `mixed` with a real product surface under template
   chrome. That is the same shape: a stock AI-builder landing template
   (gradient second line, emerald eyebrow, centred stack, numbered 3-up, a
   blurred-out results table) over a product that actually runs.

Thin-page caveat, stated as the rules ask: 3269px, no pricing, no FAQ, no
docs, no comparison. Many signals had nowhere to fire in either column, so
neither the slop count nor the craft count is a measure of discipline. What
the page does ship is close to the default template for its builder, and the
craft it earns is almost entirely the one embedded widget: three of the four
craft values (`real-product-surface`, `live-claim-control`,
`density-variation`) rest on the hero panel.

**Rater B.**

**First study of a page built in Lovable.** Every value below was set from the
capture and the DOM before any other rater's draft was opened; none was.

## Capture

1440x900 viewport, 700px steps, 900ms settle, animations disabled in the
screenshot itself. `docH_before` 2911, settled 3269: the page grows 358px
during the walk because the contact section mounts on scroll (see
`scroll-reveal-blank`). 5
tiles, `clamped: false`, coverage 1.123, one strip at 1440x3269; the stitcher
reports stitched height equals settled page height. Last strip ends in the
footer (`© 2026 VizLeads · How it works · Contact · Edit with Lovable`). Section
map by measured offset: hero 0-1233, powered-by strip 1233-1380, `#how`
1380-1874, testimonials 1874-2267, CTA 2267-2661, `#contact` 2661-2822, footer
2822-2911. No inner scroller (`html`, `body` and the top `div` all report
2911). Body `innerText` is 1405 characters after a one-row search; the hero
panel alone is 1733 characters in its default 20-row state.

The page is a dark-mode, single-page landing page for a job/lead search
tool. `html` carries class `dark` and `body` background is `rgb(12, 12, 14)`.

## Slop signals that are present

**`gradient-blob`.** One 600x400 element at y=128, `bg-indigo-500/[0.08]` with
`filter: blur(120px)`, centred behind the headline. It is a soft glow rather
than a saturated multicolour blob, but it is the signal's shape: a decorative
blurred fill with no content. Scored present on the element, not on how loud it
is.

**`three-card-row`.** `#how` holds exactly three equal cards at 276px each:
`01 Search across sources` / `02 Save & get alerts` / `03 Find the decision
maker`, at y 1635-1746, each with a 3-line description. Uniform weight, whole
of the section.

**`generic-sans-default`.** Inter only, weights 400/500/600/700, loaded from
Google Fonts. `document.fonts` lists Inter and nothing else; the only second
family in any computed style is `ui-monospace`, used on one 11px fake-URL
label (`vizleads.app/search`) inside the product panel. No display face, no
pairing, no letter contribution.

**`symmetric-everything`.** Every text block is centre-aligned on x=720:
headline (centre 720), subhead (432-1008, centre 720), H2 at 208-1232 (centre
720), feature row centred, CTA centred. Measured off-centre text blocks: the
single testimonial card (left 208, right 536), which is an accidental
left-alignment inside a centred section rather than a designed split, and the
column headers inside the product panel (excluded by scope). Nothing else
breaks the axis.

**`indigo-violet-accent`.** The headline's second line `Free forever.` is
`linear-gradient(to right, rgb(129,140,248), rgb(192,132,252))` in
`bg-clip-text`; the logo mark is `from-indigo-500 to-purple-600`
(`rgb(99,102,241)` to `rgb(147,51,234)`), repeated in the footer. Card numerals
are `rgb(129,140,248)`. This is the archetypal hue, in the logo, the headline
and the numerals.

**`scroll-reveal-blank`, at the smallest count in the corpus.** Measured with
the walker's own cadence (6 steps, 900ms settle) against a dwell control that
holds step count and wall clock and scrolls to (0,0) instead. Nav, header,
footer and dialog subtrees excluded. Walk: 101 text keys at rest, 107 after,
`scrollHeight` 2911 → 3269. **6 cross**: `Get in touch`, `Questions, custom
needs, partnerships — we read every message.`, `Send message`, and the three
form placeholders `Your name`, `you@example.com`, `What are you working on?`,
149 characters in all. Dwell: 101 → 101, height 2911 → 2911, **0 cross**. These
nodes do not fade in from low opacity; they are not in the DOM until the
viewport nears them. Stepping the scroll by hand, they are absent at y=1000 and
y=1500 and present at y=1800, and `#contact` grows from 161px (its own
`py-20` padding, i.e. an empty band) to 519px. The hero's `anim-fade-up`
sequence, by contrast, is gated on time (0.7s, delays 0.08/0.16/0.24s), and
the dwell recovers all of it, so it is not counted. Present by the procedure,
which sets no minimum count. Flagged: one section of seven and 149 characters,
against financial-datasets' 26 nodes / 1082 characters and tsenta's 346 nodes.
An agent or no-JS reader that does not scroll gets a 161px blank where the
contact form should be, which is the defect the signal names, at small scale.

**`centered-hero-stack`.** Pill at 129, headline at 181, subhead at 329, CTA at
405, panel at 489, caption at 1152: six centred elements on one vertical axis.
Recorded as a fact, expected ineligible as a rule.

## Slop signals that are absent, with what nearly fired

- **`glass-card-overuse`.** Exactly one `backdrop-filter` surface: the 768x632
  panel at y=489, `rgba(15,15,18,0.8)` with `blur(8px)`. The threshold is 3+,
  so one does not fire. The panel is a product surface, which scope would
  exclude anyway.
- **`badge-pill-spam`.** One decorative pill above the fold, the emerald
  `100% Free · Unlimited searches · No credit card` at y=129, height 28,
  `rounded-full`. The second `Free forever · No credit card · No limits` sits
  at y=2363, below the fold. The four white-on-dark source chips (`Adzuna`,
  `TheirStack`) that look like badges at 10px are inside the product panel and
  are excluded by scope. Two marketing pills total, below the 3+ threshold.
- **`emoji-as-icon`.** A codepoint census over every text node in the body
  finds exactly three characters above U+2000: three `✓` (U+2713) in the
  caption under the panel, `Unlimited job searches / Unlimited lead searches /
  Free forever`. Their computed family is Inter, not a colour-emoji font, and
  they render in the grey caption colour. Same rule as heroku-2014's terminal
  checks: a typographic glyph is not an icon. The stars in the testimonial are
  SVG, and the Google mark in the CTA is an inline SVG path.
- **`generic-line-icon-set`.** Feature cards carry no icons at all: `01`, `02`,
  `03` as 11px numerals and text. There is no second uniform set to judge. The
  nav, CTA and footer carry 16px and 14px SVGs, but they are action glyphs
  (`arrow-right` on Start free, the Google mark, the `arrow-up-right` link
  marker) attached to their own buttons, not a decorative set standing in for
  headings.
- **`testimonial-card-row`.** One card, not three. `"loved it"`, five SVG
  stars, 28px Google avatar, `Santhosh Maisa`, at 208-536 x 2086-2205. The
  copy is two words and the section is 393px tall for it. Below threshold by
  card count; also not a row.
- **`gradient-fill-cta`.** Both primary buttons are flat: the white
  `Sign up free with Google` (`bg-white`, `text-zinc-900`) and the indigo
  `Search` / `Send message` (`bg-indigo-500`), all single-colour fills. The
  logo mark and the headline text are the only gradients.
- **`typewriter-headline`.** No cycling text. The hero headline is static; the
  only looping animation is a 2s `pulse` on two 6px status dots.
- **`stock-photo-generic`.** No photography. One raster image on the page: a
  28x28 Google account avatar in the single testimonial. The `Powered by`
  strip is a text marquee (16 items, 30s linear `marquee` animation, parent
  `overflow: hidden`) of platform names, not imagery. No stock, no scrim-over-
  stock.
- **`hero-mockup-float`.** The panel is inline in the hero's flow at y=489, a
  flat `rounded-2xl` bordered card. No perspective, rotation, or floating
  device frame.

## Craft signals that are present

**`type-scale-high-contrast`, 4.0:1.** `ladder.cjs` reports the largest prose
node at 64px Inter 600 (`Search any job. Any lead.`) against body computed
16px: ratio 4.0, above the 3.75 cut. The 40px H2 and 30px section heads give
2.5:1 and 1.9:1, so the page has one real jump and not a ladder.

**`real-product-surface`.** The hero panel is a faithful live rebuild of the
product's search screen, not a screenshot and not an invented UI. Evidence:
two real inputs (`Role e.g. product designer`, `Location e.g. Bangalore`) and a
`Search` button; pressing Enter in the role field issues a live POST to
`https://uvoplbkarmszmgbyfahb.supabase.co/rest/v1/rpc/get_public_job_preview`
with body `{"_query":"designer","_location":null,"_limit":40}` and returns real
job rows (one: `Interior Sales Designer · Kingdom International Consultants ·
Singapore · TheirStack`) which replace the table in the DOM. The default view
is 30 rows fetched by the same call, across `adzuna` and `theirstack` sources.
After a query the panel's footer reads `1 preview rows · sign in to fetch live
across 4 sources`. The fake `vizleads.app/search` URL bar and `live` dot are
chrome around a surface that really answers queries from the product's job
store. Named limit, and the reason this is not certain: the RPC is literally a
public *preview* index, and the signed-in search screen it claims to rebuild is
behind Google OAuth, so faithfulness to the real screen cannot be checked from
outside. The table's columns (role, company, location, source chip) and its
data are the product's own; the layout match is inferred. Contrast with the
doorway exclusion: `Unlock 17+ more matches`, `Start free` and `Sign up free
with Google` all leave the page for
`accounts.google.com/v3/signin/identifier?...redirect_uri=https://oauth.lovable.app/callback`,
which is a doorway and would fail on its own; the table above it is the
surface and carries it.

**`live-claim-control`.** The role field is a visitor-editable control over the
page's central claim. I typed three queries: `designer` (1 row, Singapore,
TheirStack), `zzzqqqxxvv` (0 rows, empty state), `nurse` (0 rows, empty
state). The control falsifies `Search any job. Any lead.` on the second and
third. It is narrower than databuddy's five tabs or financial-datasets' 30
buttons: there is one input, no result-count control, and the row click that
promises `One click on any job reveals the HR lead or hiring manager` does
nothing visible when clicked (panel text 1733 → 1719 chars, no request), so
the decision-maker claim has no control. Present on the search input alone,
and it is the second contestable value: the panel's own footer, `Live preview ·
sign in to run real searches & save them`, discloses that the box searches a
preview index rather than the four-source fan-out, so a 0 can be excused as
preview scope. I keep it present because the visitor chooses the input and the
product answers from its own store, which is the falsifiable part. If this and
`shows-deliverable` both went against me, net would be +2; still `mixed`.

**`density-variation`.** Section heights measured: 1233 / 147 / 495 / 393 /
395 / 161 / 89. The hero is 8.4x the powered-by strip and 7.7x the contact
section; padding runs `py-24` against `py-10` against `py-8`. The page does
change rhythm section to section: the hero carries a 20-row table at 46px per
row, while the testimonial section spends 393px on two words. Only seven
sections, so the variation has few places to show.

**`single-optical-anchor`.** Rule-ineligible and undefined; honest call is
present, weakly. The anchor is the 768x632 product panel, the only non-text mass
on the page and about 19% of its settled 3269px height, with the headline
directly above it. It is present partly because "one mass dominates
because there is only one mass": the page has no second image, chart, card
cluster or video, so the test does not discriminate here. Recorded present
with that caveat.

## Craft signals that are absent, and the near-misses

- **`shows-deliverable`, absent, and the closest call on the page.** The
  artefact is the job table (30 rows fetched, 460px clip, `overflow: hidden`).
  The procedure is to name the entry that could have embarrassed the vendor,
  and the legibility clause decides it. Rows 4-20 carry `filter: blur(4px)`
  and `user-select: none` beneath the `Unlock 17+ more matches` overlay, so the
  entries that would count against the vendor are in the DOM but are not
  legible at page size: a title whose dash renders as UTF-8 mojibake
  (`ERPNext Developer â...` row 7), an off-topic `Python developer` row in an
  otherwise all-ERPNext list, and near-duplicate titles against the card copy
  `Deduped, normalized, ranked.` all sit in the blurred block. The legible
  rows are 1-3: `Senior ERPNext Developer needed, ERPNext complete
  implementation` / `Infinexus online Pvt Ltd` / `Bangalore, Karnataka` /
  `Adzuna`; `ERPNext Developer` / `Vidyarjan Consulting Pvt Ltd` / `Delhi` /
  `TheirStack`; `ERP Next Development/Implementation` / `ALIQAN Technologies` /
  `Delhi, India` / `Adzuna`. Three consistent, real jobs; nothing against the
  vendor. The one unflattering output the product does produce legibly is the
  empty state (`No matches yet. Try a broader query.` at 14px for `nurse` or
  `zzzqqqxxvv`), but it exists only after the visitor types. I credit it once,
  to `live-claim-control`, which is the signal for a visitor falsifying a
  claim, rather than scoring the same behaviour on two signals. A second rater
  who reads "a simulated demo that shows the product erring passes" as
  covering visitor-elicited errors will score this present; net moves from +1
  to 0 and the verdict does not change. Provenance tokens are therefore not
  recorded (they appear only on `shows-deliverable: present` files), though
  for the record the rows are live: an RPC to the vendor's Supabase returning
  `job_url`s that resolve to `adzuna.in/details/5593191738` and
  `in.indeed.com/job/erpnext-developer-43838e0c569762f4`.
- **`asymmetric-split`.** The only off-axis element is the testimonial card,
  left-aligned at 208 in a centred section, which reads as a card placed in a
  flex row rather than a split composition. The product panel is centred.
  Absent.
- **`editorial-grid-break`.** Nothing crosses the container. The widest text
  column is the 1024px `max-w-5xl` H2; the panel breaks out to 768px inside a
  narrower hero column but stays inside the centred 5xl grid. No image bleed,
  no column offset, no oversized type running off the measure.
- **`custom-type-pairing`.** Inter for all 167 text nodes except one monospace
  label. A system stack in `bodyFont` behind a single loaded family. Absent.
- **`one-accent-discipline`.** Accents in marketing chrome only (the
  panel's emerald Adzuna and violet TheirStack chips are excluded by scope):
  indigo-to-violet (logo mark, `Free forever.` gradient, `01/02/03` numerals
  at `rgb(129,140,248)`, `Send message` at `rgb(99,102,241)`), emerald (both
  pills, text `rgb(110,231,183)` on `rgba(16,185,129,0.1)`, and the pulsing
  pill dot), and amber (five stars, `rgb(251,191,36)`). Three hue families,
  and the headline itself spans two hues. Absent.

## Verdict: mixed, net +2

Slop present, 7: `gradient-blob`, `three-card-row`, `generic-sans-default`,
`symmetric-everything`, `indigo-violet-accent`, `scroll-reveal-blank`,
`centered-hero-stack`.
Craft present, 5: `single-optical-anchor`, `type-scale-high-contrast`,
`real-product-surface`, `density-variation`, `live-claim-control`. Net
7 − 5 = +2, inside the mixed band (-6..+3).

Sensitivity, because three scored values are close: `scroll-reveal-blank` (6
nodes, present by procedure), `shows-deliverable` (absent on legibility) and
`live-claim-control` (present despite a disclosed preview scope). Every
combination of the three lands between net 0 and +3, all `mixed`. Reaching +4
takes the reading least favourable to the page on all three at once *and*
dropping the rule-ineligible `single-optical-anchor`; even then the comparison
below is what a `slop` call would have to beat, and it does not.

**Why not `slop`.** Net +2 is two below the +4 gate, which the run brief makes
necessary. Beyond the count, the slop seven are almost all template furniture at
its weakest form: the blob is `bg-indigo-500/[0.08]` under a 120px blur, the
gradient is on type and a 28px logo rather than on any button, the marketing
pill count is two, the `backdrop-filter` count is one, the scroll gate covers
149 characters. `three-card-row` is the only slop value that fires at full
strength. And `centered-hero-stack` is recorded but expected to be ineligible
as a rule.

**Why not `exemplar`.** Net +2 is nowhere near the -8..-2 band. The page is
also thin in a way that makes its craft count generous: 3269px, seven sections,
1405 characters of body text after a one-row search, one testimonial of
two words, an inert `Your name` / `you@example.com` contact form with no
action. One surface, the product panel, carries three of the five craft values,
and on that surface the page fails its own claims: `Search any job` returns
`No matches yet` for `nurse`, and `One click on any job reveals the HR lead or
hiring manager` is not wired to a row click. The two craft values outside the
panel (`type-scale-high-contrast` at 4.0:1, `density-variation`) are the two
cheapest available on any page with a big H1 and uneven section padding.

**The comparison the band requires.** The +3 mixed files are deepmark
(7 slop, 4 craft) and stripe-2014 (6 slop, 3 craft); this page is 7 slop, 5
craft. Same slop count as deepmark, one more than stripe-2014, and one or two
more craft signals than either (a live product surface over the vendor's own
job store, a visitor-drivable search). The two slop files, heroku-2014 (7/2)
and openhack (6/2), each have two craft signals, both including
`real-product-surface` and neither `live-claim-control`; this page has five,
and the visitor-drivable search over live data is the one the slop files lack.
A second rater can check that by typing `nurse` into the hero box. Nothing in
the slop column here is a kind of slop the +3 files do not also carry. Closest mixed file in profile is databuddy (6 slop, 5 craft,
net +1): one apart, the same shape of live product surface over builder
furniture. databuddy earns `shows-deliverable` from unflattering numbers in its
default state; this page blurs the rows that would have earned it.

## Materials

`single-theme`: `html.dark` is forced and the body is a fixed `rgb(12,12,14)`;
no light-theme rules. No stock imagery (one 28x28 Google avatar), no
illustration, no webgl, no video. No provenance tokens, since
`shows-deliverable` is absent.
