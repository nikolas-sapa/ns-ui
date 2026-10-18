---
source: https://luna-vos.lovable.app/
kind: site
cohort: ai-builder
verdict: mixed
studied: 2026-10-18
context: [hero, footer]
signals:
  gradient-blob: present
  three-card-row: absent
  glass-card-overuse: absent
  emoji-as-icon: present
  generic-sans-default: absent
  symmetric-everything: present
  badge-pill-spam: absent
  generic-line-icon-set: absent
  testimonial-card-row: absent
  indigo-violet-accent: absent
  gradient-fill-cta: present
  scroll-reveal-blank: absent
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: present
  hero-mockup-float: absent
  asymmetric-split: absent
  single-optical-anchor: absent
  type-scale-high-contrast: present
  editorial-grid-break: absent
  custom-type-pairing: present
  real-product-surface: present
  shows-deliverable: absent
  density-variation: absent
  one-accent-discipline: absent
  live-claim-control: present
materials: [single-theme]
---

**Sampling: random draw.** One of eight drawn with seed 20261018 from the thirty remaining gallery sites (pre-stated exclusions only: unreachable, blank, sign-in wall). Not chosen on any signal.

Rated by two independent blind raters on 2026-10-18, neither reading the other's draft. Both reached `mixed`. They agreed on 26 of 26 signals. Both write-ups follow in full.

**Rater A.**

Rater A, blind, 2026-10-18. Not a marketing page: the URL serves the product
itself, a one-screen prompt generator ("Luna Studio") built on Lovable, with
the builder's "Edit with Lovable" badge fixed bottom-right. Page `<title>`
"Luna Vos.com"; meta description "Luna Studio generates social media content
using OpenAI's gpt-4o-mini model."

**Capture.** 1440x900, `shoot-tiles.cjs` into `~/scratch/antislop/s5/luna-vos-A/`:
scroller `window`, docH 910 before and after, 2 tiles, `clamped: false`,
`coverage: 1`, landings 0 and 10 (10px of scroll range exists). `stitch.py`:
1 strip, 910px vs page 910px, OK. The strip ends in the page's `<footer>`,
"made with ✨ in Luna Studio" (12px DM Sans at y814). No inner scroller
(`innerCands: []`), zero `img`/`video`/`canvas`/`iframe`, so no hidden media
in the hero. The only running animation is Tailwind `animate-pulse` on the 8px
dot inside the pill. Interaction captures (same dir, `interact-*.png`): one
click on "Generate Prompt" grows the page to 1421px with two output cards; the
"Video Script" tab shows 3 selects (900px), and one click on "Generate Script"
grows it to 1541px with Hook / Scenes / Caption cards. A 390x844 viewport
reflows to 1697px.

**Thin-page caveat, stated as the rules ask.** At rest the page is 910px and
15 visible text nodes: a pill, a two-word lockup, a two-line subhead, two
tabs, six select labels, one button, one footer line. Most signals
(`three-card-row`, `testimonial-card-row`, `generic-line-icon-set`,
`stock-photo-generic`, `editorial-grid-break`, `asymmetric-split`,
`density-variation`) have nowhere to fire. The low counts on both sides are
partly a function of size, not of restraint or excess.

**Scope ruling, so a second rater can dispute it.** The SCOPE rule excludes
content inside an *embedded* product surface because it is "a thing the page
is showing, not a decision the page is making about itself". Here nothing is
embedded: the page is the running product, and the form card, its gradient
button and the tab control are the page's own styling decisions, so I score
them. What I exclude: model output generated per click (it is the product's
answer, not page chrome) and the Lovable badge (builder-injected, `system-ui`).
If a rater instead treats the 768x290 form card as an embedded surface,
`gradient-fill-cta` drops out (the button sits inside it) and net falls by 1.

## Slop signals present (5)

- **`gradient-blob`.** `body` `background-image` is three stacked
  `radial-gradient`s with no content role: `at 0% 0%` `rgba(255,230,153,0.4)`
  (yellow), `at 100% 0%` `rgba(252,156,172,0.35)` (pink), `at 50% 100%`
  `rgba(217,188,245,0.35)` (lavender), each fading to transparent at 50%, over
  the `#FFFCF0` field. Sampled off the strip: base cream (255,252,240) chroma
  15; top-left corner (255,243,205) chroma 50; top-right (254,219,217) chroma
  37; bottom-centre (242,230,242), a distinct lavender at chroma 12. Three
  soft-edged ornamental washes in three hues, the zingy-cannoli shape
  ("radial-gradient fields ... soft-edged ornamental colour fields"), though
  far fainter.
- **`emoji-as-icon`.** Four emoji do icon work at rest, all in DM Sans text
  runs that fall back to a colour emoji face (DM Sans has no emoji glyphs;
  they render in colour in the strip): U+1F5BC on the "Image Prompt" tab,
  U+1F3AC on the "Video Script" tab, U+2728 on the "Generate Prompt" button,
  U+2728 in the footer. A fifth (U+1F3AC) heads "Generate Script" on the
  second tab. These are control labels, not captured output.
- **`symmetric-everything`.** Every element's horizontal centre sits on x=720
  within 0.5px: pill (653 + 134/2), "Luna" span (336 + 768/2), "Studio"
  (609 + 221/2 = 719.5), subhead (496 + 448/2), tab control, form card
  (336 + 768/2), button (369 + 702/2), footer. Inside the card the selects are
  a 3x2 grid of equal 223px columns. No element is off-axis.
- **`gradient-fill-cta`.** The primary button (702x56, `rounded-full`) is
  `linear-gradient(135deg, rgb(250,66,97) 0%, rgb(250,121,56) 100%)`, coral
  (hue ~350°) to orange (hue ~21°), with a coral glow
  `rgba(250,66,97,0.15) 0 4px 20px -4px`. Same fill on "Generate Script".
- **`centered-hero-stack`.** Pill, 96px script "Luna", 72px "Studio", 18px
  two-line subhead, segmented tab control, form card: one centred column, top
  to bottom.

## Craft signals present (4)

- **`type-scale-high-contrast`.** `ladder.cjs`: ratio **6.0:1**, largest
  lettered node "Luna" at 96px Caveat 700 over 16px `body`. The grotesk alone,
  "Studio" at 72px Space Grotesk 700, is 4.5:1, so the call does not rest on
  the script face. The ladder is 96 / 72 / 18 / 16 / 14 / 12: a 4x jump from
  72 to 18 with no intermediate step. Display sizes are tracked tight
  (`-1.44px` on both, -0.015em and -0.02em) and set solid (line-height equal
  to font-size). Necessary, not sufficient; it clears the cut by a wide
  margin.
- **`custom-type-pairing`.** Three Google faces, each with one job and no
  crossover: Caveat 700 on one node, the 96px "Luna"; Space Grotesk 700 on the
  72px "Studio" and on the 18px `h3` output headings ("Image Prompt",
  "Negative Prompt"); DM Sans 400-700 on every label, control, body and footer
  node (12-18px). Scored on the deepmark / permit-guide-ai precedent (faces
  assigned by role, no default-ness clause).
- **`real-product-surface`.** The page is the product, live. The six selects
  (35 options, `hyperrealistic` through `over-the-shoulder`) and the button
  are wired to `POST nbjcpmrsjucbasdycskk.supabase.co/functions/v1/luna-generate`,
  which returned 200 with a generated Midjourney-format prompt. Not a capture,
  not a rebuild: the real surface, operated in place. See near-misses for the
  doorway objection.
- **`live-claim-control`.** The central claim is the subhead, "image prompts
  & video scripts in seconds." The visibly labelled "✨ Generate Prompt" button
  lets any visitor falsify it. I ran it once per tab: image prompt
  request-to-response **2,947 ms**, click-to-render **3,003 ms**; the video
  script also returned. The claim held in front of the rater, and could have
  failed (timeout, error, junk output).

## Near-misses

- **`real-product-surface` (present, could be absent).** The strongest
  objection to this rating. The doorway rule fails a surface "because the
  product has not answered yet", and at rest the page shows only a configured
  request with no answer, close in shape to acyclic's flag-complete CLI. What
  settled it for me: acyclic's command was a static picture of a request and
  "the product's own screens ... appear nowhere"; here the request is
  executable on the page and the product's own answer appears on the same
  surface three seconds later. A rater holding strictly to "at rest" scores it
  absent: net +2.
- **`custom-type-pairing` (present, could be absent).** Caveat carries one
  word and a rater can call it a logotype prop; Space Grotesk carries one node
  at rest. Even then, Space Grotesk display / DM Sans body is a role split.
  Net +2 if flipped.
- **`generic-sans-default` (absent, could be present).** Absent on the
  corpus's face-identity reading: no in-scope node renders Inter, Geist or a
  system stack (`system-ui` appears only on the Lovable badge). DM Sans
  carries 12 of 15 nodes, but labels are tracked +0.6px uppercase, the button
  +0.4px, display -1.44px: authored tracking, so absent on the railway
  discriminator too. A rater reading DM Sans as the builder's unconsidered
  default flips it: net +2.
- **`gradient-blob` (present, could be absent).** Peak wash chroma is 50
  against a 15-chroma base, far fainter than the blurred blobs elsewhere in
  the cohort. It is still three ornamental hue fields with no content role.
- **`single-optical-anchor` (absent; rule-ineligible, honest call).** What I
  counted: the lockup reads first by size and position, but the gradient
  button holds **37,940** chroma>=80 pixels against **3,316** for the coral
  "Luna", 4,786 dark-ink pixels for "Studio" and 5,475 for the dark active
  tab. Two masses in the same coral compete, top and bottom of the screen.
  Not a case of one mass dominating because it is the only mass.
- **`one-accent-discipline` (absent).** Coral-to-orange is one ramp (the
  permit-guide-ai reading), but mint carries a separate job. Tokens declare
  `--primary 350 95% 62%`, `--secondary 45 100% 65%`, `--accent 165 80% 55%`;
  the hero pill is filled `rgba(48,232,186,0.3)` (renders at about chroma 53,
  hue ~156°) around a coral pulse dot. After a click mint also fills the output
  tags and the scene numerals. Same shape as vizleads' emerald pill.
- **`indigo-violet-accent` (absent).** Hue census of chroma>=40 pixels (strip,
  badge masked): 0-30° 28.6%, 30-60° 51.8%, 330-360° 15.9%, 120-150° 3.2%,
  240-300° **0.0%**. The violet lives only in the neutrals: ink
  `rgb(32,23,48)` (hue 260, chroma 25), muted `rgb(97,87,117)`, border
  `rgb(221,215,234)`, and the chroma-12 lavender wash. Tinted neutrals, not an
  accent.
- **`badge-pill-spam` (absent).** One decorative pill above the fold, "powered
  by AI". The tab switcher is a functional segmented control; the
  `rounded-full` selects and button are controls. The four output tags
  (`midjourney`, `exclude`, `0-3s`, `ready to post`) exist only after a click,
  below the fold.
- **`glass-card-overuse` (absent).** One `backdrop-filter` surface, the tab
  switcher (`blur(8px)` on `bg-white/70`, 333x54); still one after generation.
- **`scroll-reveal-blank` (absent).** Six samples from 1.8s to 9.4s after
  load, no scrolling: 0 of 15 text nodes under 8% cumulative opacity at any
  sample, and only 10px of scroll range exists to gate anything behind.
- **`typewriter-headline` (absent).** Same six samples: the first four text
  nodes ("powered by AI", "Luna", "Studio", the subhead) unchanged.
- **`hero-mockup-float` (absent).** The card floats on a shadow
  (`rgba(32,23,48,0.12) 0 8px 32px -8px`), but it is the working tool, not a
  mockup of one.
- **`shows-deliverable` (absent).** At rest the page shows no output, no
  sample prompt, nothing that could count against the vendor, so there is no
  entry to name. The generated output exists only when a visitor asks; on the
  vizleads precedent that is the control's answer, credited under
  `live-claim-control`, not an artefact the page presents. Recorded, not
  scored: my one image run returned unscrubbed model output, a negative prompt
  containing "acnes" and "glans", and a `--v 6` parameter. No provenance
  tokens, since the signal is absent.
- **`density-variation` (absent).** One band. A header (6 text nodes over
  about 450px), then a form card (6 labels, 6 selects and a button in
  768x290): the hero-to-form step every form page has, with no established
  rhythm for a dense passage to read against. After generation the output
  adds paragraph cards of one texture.
- **Materials.** `single-theme`: one `.dark` rule in the stylesheet, no
  `prefers-color-scheme` media rule, no toggle; under emulated dark the body
  stays `rgb(255,252,240)`.

## Verdict: mixed, net +1

5 slop present (`gradient-blob`, `emoji-as-icon`, `symmetric-everything`,
`gradient-fill-cta`, `centered-hero-stack`) minus 4 craft present
(`type-scale-high-contrast`, `custom-type-pairing`, `real-product-surface`,
`live-claim-control`) = **+1**: two below the +3 mixed anchors (deepmark,
stripe-2014) and three below the `slop` floor.

The template tells are real and measured: a centred pastel-gradient stack, a
two-stop coral-to-orange gradient button, emoji on every control. Two of the
five (`centered-hero-stack`, `symmetric-everything`) are the pre-AI
conventions the vocabulary expects to fail eligibility. Against them, the page
does things the slop files do not: it is the working product, it answers its
own claim in three seconds on a visible control, and its type has an authored
system (three faces by role, 6:1 display contrast, tracked labels).

Every contested call broken the slop way at once (`real-product-surface`
absent, `custom-type-pairing` absent, `generic-sans-default` present, with
`gradient-blob` and `live-claim-control` held) reaches 6 slop and 2 craft,
**+4**. That needs three independent near-misses to fall the same way, and
the page would still carry the craft signal that most separates it from
heroku-2014 and openhack: neither lets a visitor run the product and watch it
answer. I do not round up. Thin-page caveat applies: 910px, 15 text nodes.

**Rater B.**

New page, rater B, studied 2026-10-18, rated blind (no other rater's draft
opened). "Luna Studio", an AI prompt generator for social posts, built and
hosted on Lovable. The page is not a marketing page about the tool: **the page
is the tool.** One screen: a "powered by AI" pill, a two-line H1 ("Luna" /
"Studio"), an 18px subhead, an Image Prompt / Video Script toggle, a card of
six labelled `<select>`s, a full-width "✨ Generate Prompt" button, and a
one-line footer. One `<h1>`, no other heading at rest, no nav, one link (the
Lovable badge).

**Capture.** `shoot-tiles.cjs` at 1440x900, 700px steps, 900ms settle:
`docH_before` 910, `docH_after` 910, scroller `window`, 2 tiles, `clamped:
false`, `coverage: 1`, `innerCands: []`. `stitch.py`: 1 strip, 1440x910 against
a 910px page, no drift. The strip ends in the footer, `made with ✨ in Luna
Studio` (FOOTER, 12px, y814). The fixed bottom-right "Edit with Lovable" badge
is platform chrome injected by the host and is not scored. Scroll range is 10px,
so the page is effectively a single viewport. To see the product answer I ran
the generator twice as a visitor would (one image prompt, one video script);
the page grows to 1375px and 1580px with output, captured separately in
`~/scratch/antislop/s5work/luna-vos-B/` (`after-image.png`, `after-video.png`).
The rating is of the page at rest unless a value says otherwise.

**Scope reading, stated first because three values depend on it.** SCOPE
exempts content inside an *embedded* product surface, "a thing the page is
showing". Nothing here is embedded: no screenshot, frame, window chrome or
simulated app. The tab toggle is the page's only navigation and the Generate
button its only call to action. So I score the tool's controls as the page's
own presentation decisions. A rater who instead exempts the card under SCOPE
loses `gradient-fill-cta` and most of `emoji-as-icon`; see near-misses.

## Slop present (5)

**`gradient-blob`.** `body` carries three stacked radial fields, all
`background-attachment: fixed`, over `rgb(255,252,240)`:
`radial-gradient(at 0% 0%, rgba(255,230,153,0.4) 0, transparent 50%)`,
`radial-gradient(at 100% 0%, rgba(252,156,172,0.35) 0, transparent 50%)`,
`radial-gradient(at 50% 100%, rgba(217,188,245,0.35) 0, transparent 50%)`.
Measured off the strip as max-min RGB chroma: paper `(255,252,240)` chroma 15;
top-left `(255,243,205)` chroma 50 (yellow); top-right `(254,218,216)` chroma
38 (pink); bottom centre `(242,230,242)` (lavender cast, chroma 12). A pastel
yellow / pink / lavender wash with no content in it. No `filter: blur` disc
exists; scored on zingy-cannoli's precedent, which counted bare
`radial-gradient` fields, and vizleads', which counted an 8%-alpha field; these
run at 35-40% alpha.

**`emoji-as-icon`.** Four emoji at rest, three distinct, each in the icon slot
before a UI label: `🖼` on the "Image Prompt" tab, `🎬` on "Video Script", `✨`
on the 702x56 "Generate Prompt" button, `✨` in the footer. Glyph font checked
with CDP `CSS.getPlatformFontsForNode`: every one of the three buttons and the
footer reports `DM Sans 9pt` for the label plus `Apple Color Emoji`,
`glyphCount: 1`. These are colour emoji standing in for icons in sans UI text,
not terminal or log output. The Video Script tab repeats the pattern ("🎬
Generate Script"). Noted because the vocabulary calls this signal its one
honest zero: no file in `content/evidence/` scores it present as of this
rating.

**`symmetric-everything`.** Every visible block centres on x=720 within half a
pixel: pill 653-787, H1 box 336-1104 with `text-align: center`, subhead
496-944, toggle 553-886, card 336-1104, footer 336-1104. The only grid is three
equal 223px select columns, twice. Nothing on the page sits off the axis.

**`gradient-fill-cta`.** `.luna-button`, the page's single primary action,
702x56: `background: linear-gradient(135deg, rgb(250,66,97) 0%, rgb(250,121,56)
100%)`, coral (hue 350°) to orange (hue 20°), with a coral glow
`0 4px 20px -4px rgba(250,66,97,0.15)` and a `translateY(-2px)` hover lift.

**`centered-hero-stack`.** Pill (y64) → H1 (y110-288) → subhead (y294) →
toggle (y390), one centred column, top to bottom.

## Craft present (4)

**`type-scale-high-contrast`, 6.0:1.** `ladder.cjs`: largest text node with a
letter is "Luna", 96px Caveat 700, over `body` 16px. "Studio" alone is 72px,
4.5:1. The next size down is the 18px subhead; nothing on the page at rest sits
between 18 and 72px. Clears the 3.75 cut by 2.25.

**`custom-type-pairing`.** Three Google faces, each with one job, no overlap:
Caveat 700 only on the four glyphs of "Luna" (`CaveatRoman-Bold`,
`glyphCount: 4`); Space Grotesk on "Studio" (72px) and on the output-card H3s
(18px); DM Sans on every label, select, button, subhead and the footer. Same
structure permit-guide-ai and deepmark were scored `present` on; the
vocabulary has no default-ness clause.

**`real-product-surface`.** The surface is the product itself, live. The six
selects arrive prefilled (`hyperrealistic`, `dark romantic`, `melancholic`,
`blue hour`, `rooftop at night`, `3/4 angle`); Generate issues `POST
https://nbjcpmrsjucbasdycskk.supabase.co/functions/v1/luna-generate` with a
prompt assembled from those values, and the JSON answer renders into the same
card. Not a stylised or invented UI: there is no other UI on the page.

**`live-claim-control`.** Central claim: "Bright, beautiful AI prompts for your
next post — image prompts & video scripts in seconds." The visible "✨ Generate
Prompt" control lets a visitor test both halves on the page. Measured
click-to-render: 5.6s (image prompt), 6.1s (video script). And it can fail in
front of the visitor: the video run's caption came back with the misspelt
hashtag `#nightthougts`. Same shape as vizleads' live preview, whose `0 rows`
was the claim failing on the page.

## Near-misses

- **Scope (the largest swing).** If the card is exempted as product surface,
  `gradient-fill-cta` goes absent and `emoji-as-icon` rests on one footer `✨`
  in "made with ✨", a phrase glyph rather than a control icon, which I would
  then score absent. Slop falls to 3, net -1. Still `mixed`.
- **`gradient-fill-cta`**: two stops, not three. Two hues 30° apart across a
  702px fill is a gradient fill, not a tint.
- **`gradient-blob`**: corner washes, not blurred discs. A rater requiring a
  disc would score absent.
- **`generic-sans-default` absent.** Body is DM Sans, display Space Grotesk,
  both requested from Google Fonts. The corpus reads this signal on face
  identity (Inter, Geist or a system stack present; Archivo absent, per
  referable-dev). DM Sans is not in that set. A rater reading "default" as "the
  stock Google pick an AI builder reaches for" would score present.
- **`custom-type-pairing`**: Caveat carries four glyphs, arguably a logotype.
  The Space Grotesk / DM Sans split holds without it, so the value does not
  move.
- **`real-product-surface` and the doorway clause.** At rest the product has
  not answered: the output panel exists only after a click. I read the
  prefilled configurator as the product's working screen, the stripe-2014
  Checkout case (the form IS the product), not a sign-in or install doorway.
- **`shows-deliverable` absent.** At rest there is no artefact: no sample
  prompt, no example output, nothing that could count against the vendor. The
  only embarrassing entry I found, `#nightthougts`, is stochastic run output
  behind a click, and it is `live-claim-control` doing its job; scoring it here
  as well would credit one control twice. A rater who scores run output would
  name that typo and score present (net 0, still `mixed`).
- **`single-optical-anchor` absent (rule-ineligible; honest call).** Two
  instruments crown two different masses. By colour, the Generate button holds
  37,884 of the page's 41,686 pixels with chroma >100 (91%); "Luna" holds
  3,229. By scale, the "Luna Studio" lockup is the largest type; the dark mass
  is split between the active tab pill (5,475 px with r+g+b <200) and "Studio"
  (4,786). Three masses, no single one dominating on both readings. Not a case
  of "one mass because only one mass".
- **`density-variation` absent.** Ink (r+g+b <600, every 2nd px): hero band
  y0-470 2.91%; form band y470-790 9.06%, but 1.05% with the button rows
  (y680-746) excluded. The only density spike is one gradient fill. Two bands,
  one texture.
- **`one-accent-discipline` absent.** Coral `#FA4261` (hue 350°, chroma 184)
  with its orange gradient partner `#FA7938`, plus mint `#30E8BA` (hue 165°,
  chroma 184) on the "powered by AI" pill at 30% alpha and, after generation,
  on the output chips and scene-number badges. Two hue families, neither a
  status colour.
- **`indigo-violet-accent` absent.** Ink `rgb(32,23,48)` is hue 262° but chroma
  25, a near-black used for "Studio", body text and the active tab. The
  lavender wash reads chroma 12. Neither is an accent.
- **`badge-pill-spam` absent.** One decorative pill above the fold ("powered by
  AI", 134x30, pulsing coral dot). The toggle and selects are `rounded-full`
  but functional. The "midjourney" / "exclude" / "ready to post" chips appear
  only after generation, inside product output.
- **`glass-card-overuse` absent.** One `backdrop-filter` surface (the toggle,
  `blur(8px)`, 333x54); none added by output.
- **`hero-mockup-float` absent.** The card has a soft shadow
  (`0 8px 32px -8px rgba(32,23,48,0.12)`) but no tilt or perspective, and it is
  the live product, not a mockup.
- **`scroll-reveal-blank` absent.** Scroll range is 10px. At 150ms after
  `domcontentloaded` every text node computes `opacity: 1`, `transform: none`.
  The only running animation is Tailwind `animate-pulse` on an 8px dot. A dwell
  control is moot.
- **`typewriter-headline` absent.** 12 samples of the first 200 characters of
  `innerText` over 12s: one distinct value.
- **`three-card-row` absent.** Output cards stack vertically, one column.

**Thin-page caveat.** 910px, one viewport, 15 text nodes in the ladder. Ten of
sixteen slop signals have nowhere to fire: no features, testimonials, images,
icon set or card rows. Two of the four craft values (`real-product-surface`,
`live-claim-control`) come from the same single fact, that the page is the
tool. Read the net as the profile of a page with almost no marketing surface,
not as restraint.

**Materials.** `single-theme`: emulating `prefers-color-scheme: dark` returns
the same `rgb(255,252,240)` body and `rgb(32,23,48)` text, no `.dark` class, no
theme control. No images, video, canvas or webgl. No provenance tokens, as
`shows-deliverable` is absent.

## Verdict

**`mixed`, net +1** (5 slop present − 4 craft present). Below the +4 that
`slop` requires, and two below deepmark and stripe-2014 at +3, so no
slop-separation argument is owed. The plausible range across the near-misses
is net -1 (SCOPE exempts the card) to +2 (`generic-sans-default` scored on
"stock pick"), all inside `mixed`. The page carries the AI-builder palette tells
(pastel radial wash, coral-orange gradient button, colour emoji as icons, a
fully centred stack) but has too little surface to accumulate density, and it
earns its craft by being a working tool rather than a description of one.

No drift section: new page, no prior study.
