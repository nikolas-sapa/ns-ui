---
source: https://freesubtitlemaker.lovable.app/
kind: site
cohort: ai-builder
verdict: slop
studied: 2026-10-19
context: [hero, nav, features, cta, faq, footer]
signals:
  gradient-blob: present
  three-card-row: present
  glass-card-overuse: present
  emoji-as-icon: absent
  generic-sans-default: present
  symmetric-everything: present
  badge-pill-spam: absent
  generic-line-icon-set: present
  testimonial-card-row: absent
  indigo-violet-accent: present
  gradient-fill-cta: absent
  scroll-reveal-blank: absent
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: present
  hero-mockup-float: absent
  asymmetric-split: absent
  single-optical-anchor: absent
  type-scale-high-contrast: unresolved
  editorial-grid-break: absent
  custom-type-pairing: present
  real-product-surface: absent
  shows-deliverable: absent
  density-variation: unresolved
  one-accent-discipline: absent
  live-claim-control: unresolved
materials: [dual-theme]
---

**Sampling: random draw.** One of twelve drawn with seed 20261019 from the twenty-two gallery sites left after the first draw (same pre-stated exclusions). `gunsvzombies`, drawn first, returned 404 (project deleted) and was replaced from the same seed by `openmark`. Not chosen on any signal.

Rated by two independent blind raters on 2026-10-19, neither reading the other's draft. Both reached `slop`. They agreed on 23 of 26 signals; the 3 splits `type-scale-high-contrast` (A absent, B present), `density-variation` (A absent, B present), `live-claim-control` (A present, B absent) are recorded `unresolved`, which never counts toward a rule. Both write-ups follow in full.

**Process note.** Rater A's first attempt stopped after writing front-matter only (`mixed`, net +6). The rerun saw that stub, its own earlier work and never rater B's, re-measured the four values where they differed, and reached `slop`. The two raters shared one probe folder (since fixed); rater B reported seeing two foreign filenames and the opening lines of two scripts, no values, and used only its own measurements.

**Rater A.**

**Rater A, blind.** New page, no prior study, so no drift section. Probes and
raw output: `~/scratch/antislop/s5work/freesubtitlemaker/` (`probe.cjs`,
`probe2.cjs`, `probe3.cjs`, `probe4.cjs`, `dom*.json`, `bundle/`).

## Evidence

### Capture facts

- Viewport 1440x900. Settled page height 4169px (`docH_before` = `docH_after`
  = 4169), scroller `window`, 6 tiles, `clamped: false`, `coverage: 1`. Last
  landing asked 3500, landed 3269 (the scroll maximum).
- Stitched to 1 strip, 1440x4169, equal to the page height (stitcher: 0 drift).
- The strip ends in the footer: "Free Subtitle Maker — Generate subtitles
  online, free forever. No login required.", `Home` / `FAQ`, and the keyword
  line "Video to SRT · MP4 to SRT · Free Subtitle Generator · Generate
  Subtitles Online".
- The "Edit with Lovable" badge appears at the same viewport position in every
  tile. It is one fixed `<a>` in the DOM (builder chrome), not duplicated
  content.
- Dark by default (`html.dark`, body `rgb(11,15,24)`, chroma 13). The nav toggle
  switches to light: class cleared, body `lab(98.8 …)`. Verified by clicking,
  so `dual-theme`.
- No `img`, `picture`, `video`, `canvas` or `iframe` anywhere in the DOM.
  Network on load: the document, the Google Fonts CSS (Inter 400-700, Sora
  500-800), and one analytics POST.
- At 390px: 6820px tall, `scrollWidth` 390, so no horizontal overflow. The H1
  drops to 36px.
- Six bands: hero (935px), feature grid, "How it works", downloads, an install
  CTA band, FAQ, plus the footer. Not a thin page. Every signal had room to fire.

### Slop signals present (8)

**`gradient-blob`.** Five `rounded-full` divs with `filter: blur(64px)`, all
animated (`blob-float`, `aurora-shift`):
- hero: `bg-primary/25` 419px at x-119 y11; `bg-fuchsia-500/20` 305px at
  x1104 y176; `bg-sky-500/20` 288px at x518 y712;
- downloads band: `bg-primary/20` 314px at x-66 y2189; `bg-fuchsia-500/15`
  288px at x830 y2702.

There are also two radial glows (`--gradient-hero`, primary at 0.2 alpha), one
behind the hero (1440x935) and one behind the CTA band. These are the
blurred, coloured shapes on the strip's top corners and mid-page.

**`three-card-row`.** The feature grid is six equal cards, 352px wide in three
columns (x168 / 544 / 920), rows 210px and 190px tall. The downloads grid
repeats the same three columns with five 352x242 cards (3 + 2). "How it works"
is a 4-up of 226x206 cards. Each of the three grids is a centred H2 over
equal-weight cards.

**`glass-card-overuse`.** 19 surfaces compute a `backdrop-filter`:
- the sticky header, `blur(16px)`;
- two pills, `blur(8px)`;
- 16 `.glass` cards, `blur(20px) saturate(1.4)`: 6 features, 4 steps, 5
  platforms, and the 1104x292 CTA band.

Excluding the header and the pills still leaves 16, against a threshold of 3.

**`generic-sans-default`.** Body computes `Inter, ui-sans-serif, system-ui,
sans-serif` at 16px: the Shadcn/Lovable starter stack, verbatim. Inter carries
317 of 390 elements in a computed font-family census. That covers all body
copy, card descriptions, labels and buttons. Sora takes the headings (below).
Scored on the permit-guide-ai precedent, the same starter with Plus Jakarta
Sans headings over an Inter body, where the distinct heading face "did not
rescue an Inter body" (sakura-name-sparkle repeats that reading).

**`symmetric-everything`.** `symmetry.cjs`: basis `h1-h2`, n=6, centred 6,
**share 1.00** (cut 0.85). The six headings are the H1, "Everything you need
to caption video", "How it works", "Download Free Subtitle Maker", "Install
Free Subtitle Maker on Any Device" and "Frequently asked questions". Below the
hero, every band is a centred header over a symmetric grid or column.

**`generic-line-icon-set`.** All 37 SVGs are Lucide (`lucide lucide-*`
classes), every one at `stroke-width="2"`. There are 15 card icons (6
features, 4 steps, 5 platforms), all at 20px, each inside an identical 48px
gradient tile. Each glyph restates its heading:
- `upload` over "Upload Video"; `film` over both "Video Export" and "Export
  Video";
- `languages` over "Subtitle Translation"; `pencil` over "Edit Captions";
- `monitor`, `apple`, `smartphone`, `tablet` and `globe` over Windows, macOS,
  Android, iPhone & iPad and Web App;
- `sparkles` appears six times: both pills, the hero CTA, the "Auto Subtitle
  Generator" tile, the "Step 2" tile, and the CTA band's Install Now.

One set, uniform stroke and size, and nothing the heading doesn't already say.

**`indigo-violet-accent`.** The page has one gradient, `--gradient-primary:
linear-gradient(135deg, rgb(94,146,255), rgb(174,132,242))`, which is hue
221° to **263°** (violet), chroma 110 at the violet stop. It fills 19
elements: the logo mark, the wordmark's "Maker", the 60px headline span
"Professional Video Captions" (589x150px, two of the H1's three lines), all
15 icon tiles, and the RECOMMENDED badge. The two fuchsia blobs are
`rgb(225,40,250)`, hue **293°**. The flat accent, `--primary`
`rgb(107,154,255)`, is 221°. That still sits inside the 210-300° bucket
several corpus raters used. On the corpus precedent "indigo is the second
hue, not the lead", the violet does not have to lead to count. Here it fills
half of the largest text on the page.

**`centered-hero-stack`.** Every hero element is centred on x=720:
- pill x604-836;
- H1 x336-1104;
- subhead;
- dashed dropzone x384-1056;
- the select + button row x384-1056;
- the privacy note;
- "View Demo" x654-786.

### Craft signals present (2)

**`custom-type-pairing`.** Two faces with one job each:
- Sora (Google, 500-800) is on all 26 `h1`-`h3` (60 / 36 / 30 / 18 / 16px),
  the wordmark, the headline span, the dropzone's "Drag & drop your video
  here", and the six FAQ triggers.
- Inter is on every body, label and button node.
- No heading is in Inter (`interHeads: 0`).

The Sora headings carry a uniform -0.02em tracking (-1.2px at 60px, -0.72px
at 36px, -0.36px at 18px). This is scored on the permit-guide-ai and deepmark
precedent: both are `present` on a display/body role split, alongside
`generic-sans-default` also present. The caveat goes in the verdict. Both
faces are stock picks, so this credit records a role split, not a typographic
idea.

**`live-claim-control`.** The central claim is the H1, "Generate & Edit
Professional Video Captions in Seconds", with the subhead "all free, right in
your browser". The hero carries the control that tests it: a dropzone over
`input[type=file]` (`accept=".mp4,.mov,.avi,.mkv,video/*"`), a language select
(7 options), and a 436x48 "Generate Subtitles" button. The control is wired.
The route chunk `index-CEyw9IuI.js`:
1. uploads the file to the Supabase storage bucket `video-uploads` under a
   random UUID;
2. POSTs `{path, mimeType, fileName, language}` to a server function;
3. stores the returned `srt` and navigates to `/result`.

The failure path toasts "Could not generate subtitles". With no file
selected, the button opens the file picker (`a.current?.click()`), confirmed
live: no request, no toast, no state change. The claim can fail in front of
the visitor: a timeout, an error toast, a bad transcript. **I did not run it
with a video.** An upload sends a file to a third-party bucket, and the
signal is defined to be resolvable from the visible, labelled affordance.
This is the by-construction tool-page credit the vocabulary warns about. See
the verdict.

### Slop signals absent, with the measurement

- `emoji-as-icon`: 0 text nodes in the emoji ranges. All icons are Lucide SVG.
- `badge-pill-spam`: 1 decorative pill above the fold, "Free forever · No
  login required" (232x30, y161). The others are "Available everywhere"
  (y3103) and RECOMMENDED (y2419). The fixed "Edit with Lovable" badge is
  builder chrome. Counting it still gives 2 above the fold, under 3.
- `testimonial-card-row`: there is no testimonial or social-proof section.
- `gradient-fill-cta`: the primary button is `bg-primary`, flat
  `rgb(107,154,255)`, with `background-image: none` and `::before`/`::after`
  `content: none`. The "Download for macOS" and both "Install Now" buttons are
  the same flat fill. The gradient sits on tiles, text and a badge, never on
  a control.
- `scroll-reveal-blank`: 81 lettered text nodes; 0 under 8% effective opacity
  at load; 0 crossed during a 300px-step scroll walk; the dwell control (same
  elapsed time, no scroll) also 0. Only the blobs animate.
- `typewriter-headline`: the H1's `innerText` is identical at load and 6s later.
- `stock-photo-generic`: no raster media at all.
- `hero-mockup-float`: no mockup, device frame or fake window.

## Near-misses and verdict

### Near-misses

- **`real-product-surface` absent, could be present.** This is the strongest
  objection. The tool really is in the hero, but at rest it shows the doorway:
  an empty dropzone, a select and a button. The product's answer (the SRT,
  the caption editor with live preview, the style presets the feature cards
  describe) lives on `/result`, and none of it appears on this page, not
  even as a still. luna-vos was credited because its answer renders on the
  same surface three seconds after the click. Here the answer is a navigation
  away, which puts it with acyclic's real-but-unanswered CLI under "the
  product has not answered yet". Flip: net +5.
- **`type-scale-high-contrast` absent at exactly the cut.** `ladder.cjs`:
  ratio **3.75** (60/16), `ratioSub` 3.33 (60/18). The ladder is
  60 / 36 / 30 / 18 / 16. The H1 is Tailwind's stock `sm:text-6xl`.
  databuddy, decent-com and neuron-industries all sit at the same 3.75 with a
  60px H1, and all now read absent ("a conventional ratio rather than a
  deliberate jump"). Flip: +5.
- **`indigo-violet-accent` present, could be absent.** A rater who reads only
  the lead hue sees a 221° blue accent and scores absent. Held present because
  the 263° stop fills the largest text and all 15 icon tiles, and the 293°
  blobs repeat it. Flip: +5.
- **`generic-sans-default` present, could be absent.** Sora takes every
  heading. Held on permit-guide-ai, whose structure is identical. Flip: +5.
- **`one-accent-discipline` absent, could be present.** There are four hue
  positions: 199° (sky blob), 221° (primary), 263° (gradient stop) and 293°
  (fuchsia blobs). Two of them sit inside every icon tile. A rater who reads
  blue-to-violet as one brand gradient and the blobs as a background field
  scores present. Flip: +5.
- **`live-claim-control` present, could be absent.** It is un-run, and a rater
  could treat a tool's own input as a doorway here too. Flip: +7.
- **`gradient-fill-cta` absent, could be present.** The gradient is on 19
  elements and none of them is a button. Measured flat, no pseudo-element.
  Flip: +7.
- **`single-optical-anchor` absent (rule-ineligible, honest call).** The hero
  has two masses of near-equal area: the H1 block at 768x225 (172,800 px²)
  and the dashed dropzone at 672x224 (150,528 px²), with the 436x48 primary
  button between them. Below the hero, no band has a dominant mass: each is a
  heading over equal cards. "One mass dominates because there is only one
  mass" does not apply. I counted the H1 and the dropzone as rivals, not
  either one as an anchor.
- **`density-variation` absent.**
  - Band padding is 80 / 80 / 80 / 64 / 80px.
  - All 15 grid cards are padded 24px.
  - Every band is a centred 36px H2 with a 16-18px subhead over cards.
  - The FAQ narrows to a 720px column of six 56px accordion rows. That is the
    one change, and it is no denser.
  
  Flip: +5.
- **`shows-deliverable` absent.** No artefact appears at rest: no sample SRT,
  no captioned frame, no before/after, no output in any form. FAQ answers are
  excluded by procedure. Entry that could embarrass the vendor: none.
  Recorded for hole 8, not scored: all four native-app buttons ("Download for
  Windows", "Download for macOS" under a RECOMMENDED badge, "Download APK",
  "Download on App Store") link to `https://freesubtitlemaker.lovable.app`,
  the page itself. That is the inverse of an embarrassing entry: a claim with
  nothing behind it.

### Verdict: `slop`, net +6 (8 slop, 2 craft)

Net +6 clears the +4 floor by two. Below is the separation from the +3
`mixed` anchors, in terms a second rater can check.

- **stripe-2014**, +3: 6 slop, 3 craft (`asymmetric-split`,
  `real-product-surface`, `density-variation`).
- **deepmark**, +3 per the brief: its front-matter now computes +2, with 6
  slop and 4 craft (`asymmetric-split`, `custom-type-pairing`,
  `density-variation`, `one-accent-discipline`).

1. **Heavier slop.** 8 present against 6 and 6. Seven of the eight rest on an
   instrument: the blur-filter census, card geometry, the `backdrop-filter`
   count (19), `symmetry.cjs` (1.00), the Lucide census, the hue arithmetic,
   and the hero x-positions. The eighth (`generic-sans-default`) rests on
   recorded precedent.
2. **No layout or content craft.** Seven craft signals score a layout or
   content decision: `asymmetric-split`, `single-optical-anchor`,
   `editorial-grid-break`, `density-variation`, `one-accent-discipline`,
   `real-product-surface` and `shows-deliverable`.
   - stripe-2014 holds 3 of them; deepmark holds 3.
   - This page holds **0**.
   - Both anchors carry `asymmetric-split` and `density-variation`. Here they
     measure as 1.00 centred and a fixed 80px band / 24px card rhythm.

   The two craft values this page does earn are both weak:
   - a role split between two starter faces, with the Inter stack copied
     verbatim;
   - a control that exists because the tool sits in the hero, the
     by-construction tool-page credit the vocabulary says no rater has read
     toward a better verdict.
3. **Robust to marginal flips.** Getting to +3 takes **three** of the
   contested flips toward craft at once. The candidates are
   `indigo-violet-accent`, `generic-sans-default`,
   `type-scale-high-contrast`, `real-product-surface` and
   `one-accent-discipline`, and each one runs against a recorded precedent
   (permit-guide-ai, the 3.75 trio, the doorway clause, "indigo as second
   hue"). glowcase, `mixed` at +4, failed exactly these tests: its slop count
   (5) sat below both anchors, and one flip undid it. Neither holds here.
4. **Template twin of a corpus slop file.** permit-guide-ai (`slop`, +6, same
   cohort, same builder) shares 6 of its 9 slop values with this page:
   `three-card-row`, `glass-card-overuse`, `generic-sans-default`,
   `symmetric-everything`, `generic-line-icon-set` and
   `centered-hero-stack`. It also has the same `custom-type-pairing`
   structure. The two differ only in which three further archetypes fire:
   here `gradient-blob` and `indigo-violet-accent`; there
   `testimonial-card-row`, `gradient-fill-cta` and `stock-photo-generic`.

Measurably, this is the AI-builder landing template run end to end:
- animated blur blobs;
- a blue-to-violet gradient on the headline and every icon tile;
- 16 glass cards in three equal grids;
- a Lucide glyph per heading;
- 6 of 6 headings centred.

What sets it apart is a working upload control. The page claims native apps
on four platforms, and those buttons lead back to itself. The flip that
moves it most (`real-product-surface`) still leaves +5.

**Note on the earlier stub.** A previous attempt left a front-matter-only file
here (`verdict: mixed` at the same net +6, `gradient-fill-cta` and
`type-scale-high-contrast` present, `generic-sans-default` and
`live-claim-control` absent, materials `[single-theme, dual-theme]`). I rated
it from scratch and replaced it. The four values that moved were each
re-measured above: flat button with no pseudo-element; 3.75 absent on the
trio precedent; Inter stack on precedent; control wired in the bundle.
Materials drop `single-theme`, because the toggle was verified to switch.

**Rater B.**

**Rater B, blind first study.** No other rater's draft was opened.

Process note: the brief puts probe scratch in `s5work/<slug>/` with no rater
suffix, so both raters' scripts landed in `s5work/freesubtitlemaker/`, and some
of my probe outputs were overwritten mid-session by same-named files. On
noticing foreign files I saw two filenames and the opening lines of two scripts
(a light-theme probe and a dwell control: method only, no values or calls) and
read nothing further. Every number in this file comes from my own runs as
printed to my session. Captures are separate (`s5/freesubtitlemaker-B/`).

## Capture facts

1440x900 viewport. `docH_before` 4169 = `docH_after` 4169, `walkHeight`
4169, 6 tiles, `clamped: false`, `coverage: 1`, reached 4169. The last landing
was asked 3500 and landed 3269, which is `docH - 900`, so the final tile is the
clamped bottom frame and the stitcher gives it only its new 169px band. Stitched
height 4169 equals the page height with no drift, one strip. The last visible
section is the FAQ, then a footer at y4029-4169 carrying "Free Subtitle Maker —
Generate subtitles online, free forever. No login required.", Home, FAQ, and a
four-link keyword line.

No child scroller: `innerCands` reports only `html.dark` at 900, and the ladder
agrees (`innerScroller: null`). Nothing is load-gated: the walk's
`docH_before` and `docH_after` are identical, and a 9s idle read finds the
same content as the walk.

The page is a marketing landing page for a browser-based subtitle generator
built in Lovable (an "Edit with Lovable" badge is pinned to the right edge,
which is builder chrome rather than page content, and its one `system-ui` 12px
node is the only third-party type on the page). It is 4169px tall: nav, a hero
with a dropzone, a six-card feature grid, a four-step "How it works" row, a five-card download
grid, an install CTA panel, a six-item FAQ accordion, and a footer.

Dark by default (`html.dark`, body `#0b0f18`), including under
`prefers-color-scheme: light`. The header's "Toggle dark mode" button removes
the class and repaints the body `#fafcff` with a `#3a70ee` primary, so the page
ships two themes: `dual-theme`. Every value below is read from the default dark
theme. No images, video, canvas or iframe anywhere, so no image material is
recorded.

## Slop signals present (8)

**`gradient-blob`, present.** Five `div` elements carry `filter: blur(64px)`,
`border-radius: 9999px` and 15-25% alpha fills, sized 288 to 392px:
`#6c9bff` (hue 221) 392x392 at y56, `#e128fa` (hue 293) 312x312 at y161,
`#00a5f5` (hue 200) 288x288 at y712 in the hero, then two more at y2230 and
y2702 behind the download and CTA bands. Three are classed `animate-blob` and
two `animate-aurora`, so they drift. This is the archetype: a dark field,
three blurred coloured discs behind the hero, repeated at two lower bands. A
sixth, non-blurred instance is a `radial-gradient(120% 120% at 50% 0%,
lab(63.59 9.61 -63.90 / 0.2) 0%, transparent 60%)` on the hero `section`
itself and on the CTA panel's inner div (1102x290 at y3055), which is the same
motif at a larger radius. The five blurred discs settle the signal on their
own.

**`three-card-row`, present.** Two literal 3-ups, both static grids, neither
a carousel. The feature band is `grid-template-columns: 352px 352px 352px`
(x168, x544, x920) in two rows of three: Auto Subtitle Generator / Caption
Editor / Subtitle Translation at y1204, and SRT & VTT Export / Video Export /
Viral Caption Styles at y1438. Every card is 352px wide, 21.6px radius, one
20px icon, an 18px head and a 14px sentence. The "How it works" row is a
4-up (`226px 226px 226px 226px` at x232), which is the same module with one
more column, and the download band is a 3-up plus two. The glowcase precedent
counted two literal three-ups as present; this page has two, plus their 4-up
and 3-up variants.

**`glass-card-overuse`, present, far past the threshold of 3.** Nineteen
elements compute a `backdrop-filter`: 15 `.glass` cards carrying
`blur(20px) saturate(1.4)` over `oklab(0.21 -0.0026 -0.0249 / 0.6)` (six
feature cards at 352x210 and 352x190, four step cards at 226x206, five download
cards at 352x242, one CTA panel 1104x292), plus the sticky header
`blur(16px)`, and two eyebrow pills at `blur(8px)`. Six times the threshold,
and the blur does work on the two lower bands because the blobs sit behind
them.

**`generic-sans-default`, present.** Body computes to
`Inter, ui-sans-serif, system-ui, sans-serif` at 16px; headings compute to
`Sora`. Both are the Lovable/Shadcn starter's two families, and `document.fonts`
shows both loaded (Sora 500/600/700 loaded, Inter 400-700 loaded). Inter is
also the fallback stack the template hands you, and it is not a neutral here:
it is the visible default sans. Under the corpus's definition this fires
regardless of whether the pairing is deliberate, which is why the file also
records `custom-type-pairing` present; see the near-misses for the tension.

**`symmetric-everything`, present. `symmetry.cjs`: `basis: h1-h2`, `n: 6`,
`centred: 6`, `share: 1`.** All six h1/h2 headings are centred on the page
axis: the H1 (x336 w768 cx720), "Everything you need to caption video"
(x168 w1104 cx720), "How it works" (x232 w976 cx720), "Download Free Subtitle
Maker" (cx720), "Install Free Subtitle Maker on Any Device" (x217 w1006
cx720) and "Frequently asked questions" (x336 w768 cx720). 1.0 clears the
0.85 cut with nothing near the 0.80 highest-absent margin. Every section is a
centred head over a symmetric grid, and every content container (896, 1152,
1024 and 768px) is `mx-auto` on the same x720 axis.

**`generic-line-icon-set`, present.** Thirty-six inline SVGs (plus two in the
Lovable badge), every one `viewBox="0 0 24 24"`, `stroke-width="2"`,
`fill="none"`: a uniform Lucide set at 20px in the six feature cards, four step
cards and five download cards (each glyph centred on a 48x48 blue-to-violet
gradient tile), 16px in the buttons and FAQ chevrons, 14px in the eyebrow
pills, 28px once in the dropzone. The six feature glyphs are
`transcribe` (262,7,8,0), `editor` (141,9,6,8,7,6,9,7), `translate`
(8,13,7,6,16,8), `download` (8,41,13), `video` (0,7,8,8,9,8,9,10) and a
90-length single path for "Viral Caption Styles". Each says only what the
heading beside it already says ("Upload Video" beside an upload glyph,
"Export Video" beside a download glyph). Nothing in the set carries
information the adjacent heading does not.

**`indigo-violet-accent`, present.** One gradient,
`linear-gradient(135deg, #5e92ff, #ae84f2)`, running hue 221 to hue 263
(blue through indigo to violet), is the fill of **19 elements**: the 15 icon
tiles (48x48, in every feature, step and download card), the 36x36 logo mark,
the brand word "Maker" (`background-clip: text`), the H1's middle line
"Professional Video Captions" (589x150 of gradient text) and the RECOMMENDED
chip. It is the page's brand treatment, not a stray decoration. The flat
primary fill is `#6b9aff` (hue 221; `#3a70ee` in light), and the hero blobs add
`#e128fa` (hue 293). The blue-to-violet gradient on the headline and every icon
tile is the archetype this signal was split out to record. I first weighed
"the accent is the blue, the violet is decor"; the 19-element census rules
that out, because the violet sits on the logo, the H1 and every icon.

**`centered-hero-stack`, present.** The hero is `mx-auto max-w-4xl px-4 pb-16
pt-16 text-center` (x272 w896 cx720): a centred 30px eyebrow pill, a three-line
60px centred H1 at cx720, an 18px centred dek, a 672x224 dropzone at x384
(also centred), and a row of a 224x48 language combobox plus a 436x48 primary
button below it. Every mass in the first viewport is on the x720 axis. This
signal is expected to fail eligibility and is recorded, not counted toward a
rule.

## Slop signals absent (8)

**`emoji-as-icon`.** Zero emoji. The icon census returns 38 `<svg>` elements
and no character in the emoji ranges in any icon position; the checkmark and
download marks are stroke paths, not glyphs.

**`badge-pill-spam`.** Two decorative pills exist above the fold, not three:
"Free forever · No login required" (232x30 at y161) and nothing else until
y2419's "RECOMMENDED" and y3103's "Available everywhere". The nav's pill-shaped
links are 36px translucent-bordered controls, not badges. At two, below the 3
threshold; this would go present if the RECOMMENDED chip were counted, but it
is 1500px below the fold.

**`testimonial-card-row`.** No testimonials, no logos, no quotes, no reviews
section. The word "review" appears once, inside "preview". Absent by the
absence of the section, not by a call.

**`gradient-fill-cta`.** Every button fill in the page is flat: `#6b9aff`
(primary), `#121824` (secondary), `transparent` (tertiary), one `#3a70ee` in
light. No button carries a `background-image` gradient. Of the 21 gradient
`background-image` values on the page, 19 are the blue-to-violet fill on icon
tiles, the logo, text spans and one chip, and 2 are radial washes. None is a
button.

**`scroll-reveal-blank`, absent after a dwell control.** At 9s idle, 69 of 69
text-bearing nodes have effective opacity (ancestor product) of 1.00; zero
nodes are under 0.08. A 12s dwell with no scroll recovers nothing further (69
of 69 still visible), and a 14-step scroll walk leaves zero low-opacity text at
every step. Nothing is gated. The hero's `animate-blob`/`animate-aurora` move
the discs, not text, and are not gated on scroll. `docH_before` = `docH_after`
confirms the fourth failure mode is not present.

**`typewriter-headline`.** The H1 is static "Generate & Edit Professional Video
Captions in Seconds" across three line boxes (225px = 3 x 75px), with a
gradient span on line two. No cycling phrase, no timer.

**`stock-photo-generic`.** No photographs at all: `img: []`, `video: []`,
`canvas: 0`, `iframe: []`, `picture: 0`. The only imagery is the 39 line icons
and the blurred colour fields.

**`hero-mockup-float`.** No mockup, no screenshot, no floating card. The hero's
one object is the file dropzone, which is a real `<input type="file">`
(`accept=".mp4,.mov,.avi,.mkv,video/*"`, visually hidden) with a visible
bordered target, not a picture of one. Not a floated UI.

## Craft signals present (3)

**`type-scale-high-contrast`, present. `ladder.cjs`: `ratio 3.75`, `maxFs 60`,
`bodyFs 16`, `ratioSub 3.33` (18px hero dek).** At, not under, the cut. The
vocabulary calls 3.75 necessary not sufficient and records five files at
exactly 3.75:1 with opposite calls, so the ladder decides. This page's ladder
is 60 / 36 / 30 / 18 / 16 / 14 / 12: the H1 is 1.67x the next tier (the four
36px h2s), and 3.75x body. That is a two-tier display scale with a wide gap,
not the flat six-near-equal-display-moments shape that read absent on databuddy
(60 / 60 / 48x3 / 36 / 30) and decent-com (60 / 52 / 48x4 / 44 / 40), nor
neuron-industries (60 / 57.6 section heads). The 60px H1 also carries its own
negative tracking (-1.2px) and a 1.25 line-height, so the step is set. Worth
recording against the precedent: the page is a one-h1 page, and four of its
six headings are the 36px tier, which is a consistent rather than a competing
set of display moments.

**`custom-type-pairing`, present.** Two families, each with a job, assigned by
role: Sora carries every display and heading node (60px H1, 36px H2s, 30px CTA
head, 18px H3s and card titles, 18px nav brand), Inter carries every piece of
prose (18px hero dek, 16px dropzone title, 16px button labels, 14px card
bodies, 14px footer, 12px eyebrow, 10px chip). The exceptions are 8 nodes:
Sora at 16px in the dropzone's nested divs (inherited, not authored), and one
`system-ui` 12px node in the Lovable badge, which is a third-party badge, not
the page's type. This is the deepmark / permit-guide-ai shape (display face
for every head, body face for every paragraph, no third face). The registered
tension with `generic-sans-default` is real and the corpus records both:
permit-guide-ai scored `custom-type-pairing: present` with Plus Jakarta
Sans/Inter while also scoring `generic-sans-default: present`, on the same
grounds (Inter is the template default). Both values are set here for the same
reason.

**`density-variation`, present.** Section heights and internal densities vary
by a factor of four: hero 935px (two masses, a dropzone and a button row),
feature band 708px (six 210/190px cards), "How it works" 330px (four 226x206
cards), download band 632px (five 242px cards plus a head), CTA panel 420px
(one 1104x292 panel with two buttons), FAQ 618px (six 56px rows, 720px wide),
footer 140px. The measurement that settles it is the gap between the sparse
hero (two objects in 935px) and the dense feature grid (six cards in 424px),
both on the same axis; the page alternates a large empty hero, a packed card grid, a narrow
step strip, a wide download grid, a single panel, and a narrow FAQ column
(768px) in that order.

## Craft signals absent (7)

**`asymmetric-split`.** There is no split anywhere. The hero is a single
centred column; the features are a symmetric 3-up; the steps a symmetric 4-up;
the download a symmetric 3-up plus 2; the FAQ a single 720px column; the CTA
one centred panel. Every block's horizontal centre is x720 on a 1440 page.

**`single-optical-anchor`: absent, honest call, rule-ineligible and undefined.**
What I counted as the anchor candidates in the first viewport: the three-line
60px headline block (768x225 at y215, the largest type mass, with its middle
line in saturated violet-blue), the 672x224 dropzone card at y556 (the largest
bordered object, with the primary blue button inside it), and the two
competing blob fields (the 392px blue disc at left and the 312px magenta disc
at right). No one mass dominates: the headline is the largest area of ink, but
the dropzone sits directly under it in the same column at roughly equal visual
weight because the card edge and the blue button hold the eye, and the blobs
frame both. This is not the "one mass because there is only one mass" case; the
page has three masses in the first viewport and they are all on the axis.

**`editorial-grid-break`.** Nothing breaks the grid. All content is inside
one of four centred containers (max-w-4xl 896px at x272, max-w-6xl 1152px at
x144, max-w-5xl 1024px at x208, max-w-3xl 768px at x336), each a plain
`mx-auto` with 24px gutters. No overhang, no offset column, no full-bleed
element except the section backgrounds, which is not a grid break.

**`real-product-surface`.** Absent. What the hero offers is a file dropzone, a
language combobox and a "Generate Subtitles" button: the doorway to the
product, not the product in use. The corpus's "the doorway is not the surface"
ruling covers this exactly (acyclic's genuine CLI commands, dropbox-2014's
sign-up form, browserbase-com). Nothing on the page shows the editor, the
timeline, the caption preview, the SRT output or the exported file. The
feature card "Caption Editor" describes "a live video preview" but no preview
is rendered anywhere on the page. The page is 4169px of marketing chrome with
no product screen in it.

**`shows-deliverable`.** Absent. There is no artefact at all to name an
embarrassing entry in. No sample SRT, no caption preview, no side-by-side
before/after, no exported file, no cost or refusal. The FAQ's "Do you store my
videos?" answer ("No. Uploads are stored only temporarily ... deleted
automatically right after your subtitles are generated.") is a policy
statement in prose, and the procedure requires the entry inside the artefact.
The one entry-shaped claim that could count against the vendor, "maximum 200
MB" and "MP4, MOV, AVI, MKV", is a limit, not a deliverable. Nothing on the
page could have shown the product failing. (A fact for hole 8, not scored by
any signal: all four "Download for Windows / macOS / APK / App Store" links
resolve to `https://freesubtitlemaker.lovable.app`, the page itself.)

**`one-accent-discipline`.** Absent. Four hue families above chroma 100 in
marketing chrome: blue `#6b9aff` (221, primary fill), violet `#ae84f2` (263,
the gradient's far stop on 19 elements), magenta `#e128fa` (293, chroma 210)
and cyan `#00a5f5` (200, chroma 245), over a near-black field `#0b0f18`. The
headline alone spans two hues. Contested: a rater who reads the three blurred
discs (15-25% alpha) as a background field rather than accents, the `osseus`
question in the COLOUR block, is left with one blue-to-violet gradient plus its
blue endpoint as a flat fill, and could call that one accent system. That
flips this to present and moves net from +5 to +4. I score absent because the
magenta and cyan discs are saturated, authored colours, not tints of the
primary, and the headline gradient is itself two hue families.

**`live-claim-control`.** Absent. The only interactive control is the
language combobox and the file dropzone, and "View Demo" is an anchor to
`#how-it-works` (the four-step strip), not a control that tests anything. The
page's central claim is "captions in seconds, free forever"; nothing on the
page lets a visitor falsify the timing claim without uploading their own video,
which is the product gate, not a control. There is no sample-video demo, no
pre-filled example, no "try it on this clip" affordance.

## The near-misses

Every value that could plausibly have gone the other way. Net is slop present
minus craft present, so flipping a slop signal to absent or a craft signal to
present lowers it, and the reverse raises it. From +5:

| signal | my call | the other reading | net if flipped |
|---|---|---|---|
| `one-accent-discipline` | absent | the blurred discs are a background field; one blue-to-violet accent system remains | +4 |
| `indigo-violet-accent` | present | the accent is the blue `#6b9aff`; the violet is decoration (weak: the violet fills 19 elements) | +4 |
| `generic-sans-default` | present | Sora is a chosen display face, so the page is not on a default sans (against permit-guide-ai's precedent) | +4 |
| `single-optical-anchor` | absent | the 60px headline dominates the first viewport (rule-ineligible either way) | +4 |
| `type-scale-high-contrast` | present | 3.75 is the gate, not a pass; one 60px moment over four 36px heads is ordinary | +6 |
| `custom-type-pairing` | present | Sora/Inter is the starter's pairing, already charged by `generic-sans-default` | +6 |
| `density-variation` | present | every band is centred cards at one rhythm; only section height varies | +6 |
| `badge-pill-spam` | absent | count RECOMMENDED and "Available everywhere" with the hero pill despite the fold | +6 |

No single flip takes the net below +4. Two downward flips together reach +3,
but every such pair includes at least one weak call: `single-optical-anchor`
(undefined and rule-ineligible), `generic-sans-default` absent (permit-guide-ai
scored the same Inter body present) or `indigo-violet-accent` absent
(contradicted by the 19-element census).

Not in the table because I see no honest argument for the other value:
`glass-card-overuse` (19 surfaces against a threshold of 3), `gradient-blob`
(five 64px-blurred discs), `symmetric-everything` (1.0 against a 0.85 cut),
`three-card-row`, `generic-line-icon-set`, `asymmetric-split` (no split exists),
`real-product-surface` and `shows-deliverable` (nothing to score).

**How the colour calls moved during rating, recorded so it can be audited.** My
first pass saw the blue-to-violet gradient only on the H1 and the brand word,
and treated "the accent is the blue, the violet and magenta are decoration" as
a single re-read that would flip `indigo-violet-accent` to absent and
`one-accent-discipline` to present together, taking net to +3. On that basis
my first draft was `mixed`. A census of every `background-image` then showed
the same gradient filling 19 elements, including all 15 icon tiles and the logo
mark. The violet is the page's brand treatment, so the decoration reading fails
for `indigo-violet-accent`. It still works for `one-accent-discipline` alone,
because the discs can be read as field, and that reading moves net only to +4.

Settled calls:

- **`indigo-violet-accent` vs `one-accent-discipline`.** Not the same question
  and not double-counting: the first asks whether the indigo-violet hue is
  present, the second whether the page holds to one accent.
- **`type-scale-high-contrast` at 3.75.** The vocabulary records five files at
  exactly 3.75 that split both ways, so the number cannot carry it. databuddy
  (60 / 60 / 48x3 / 36 / 30) and decent-com (60 / 52 / 48x4 / 44 / 40) read
  absent on a flat top with near-equal display moments. This page's top is one
  60px H1, then four 36px heads: the H1 is 1.67x the next tier and the only
  60px node. nxtcure-labs, also at 3.75, scored present. I put this page on
  that side, and record it as a weaker present than permit-guide-ai's 4.5.
  Flipping it would raise the net, not lower it.
- **`custom-type-pairing` alongside `generic-sans-default`.** Both fire, as on
  permit-guide-ai (Plus Jakarta Sans display / Inter body, both present).
  `generic-sans-default` is about the body sans being the template default;
  `custom-type-pairing` is about two faces with a strict role split.
- **`symmetric-everything` at 1.0.** `symmetry.cjs` counts six h1/h2 headings,
  nav and footer excluded, all centred. Strong present.
- **`scroll-reveal-blank`.** Absent on measurement: zero text under 8%
  effective opacity at rest, after a 12s no-scroll dwell, and at every step of
  a 400px-step scroll walk. Nothing is gated, by time or by scroll.
- **`real-product-surface` vs the dropzone.** The dropzone is a genuine file
  input. It is the doorway, and the doorway ruling (acyclic, dropbox-2014,
  browserbase-com) says a genuine input is still not the surface.

## Verdict: `slop`, net +5

Slop present 8 (`gradient-blob`, `three-card-row`, `glass-card-overuse`,
`generic-sans-default`, `symmetric-everything`, `generic-line-icon-set`,
`indigo-violet-accent`, `centered-hero-stack`) against craft present 3
(`type-scale-high-contrast`, `custom-type-pairing`, `density-variation`):
**8 − 3 = +5**, clearing the +4 necessary gate.

**What separates it from the +3 mixed files, in terms a second rater can
check.** Four separations, each from an instrument or a front-matter value:

1. **Layout stance, measured.** Both comparators score `asymmetric-split`
   present and `symmetric-everything` absent (deepmark 2 of 13 headings
   centred; stripe-2014's hero copy sits left). This page reads
   `symmetric-everything` **1.0** (6 of 6 on `symmetry.cjs`) and has **zero**
   splits: every block on the page is centred on x720. It holds none of the
   structural craft both comparators hold.
2. **Template surfaces neither comparator carries.** `glass-card-overuse` is
   absent on both deepmark and stripe-2014. Here it is **19**
   `backdrop-filter` surfaces, more than six times the threshold, covering
   every card on the page. `gradient-blob` is absent on deepmark; here it is
   five 64px-blurred discs, three of them in the hero.
3. **The margin survives striking rule-ineligible signals.** Strike
   `centered-hero-stack`, `hero-mockup-float` and `single-optical-anchor`, the
   recount vizleads used: this page 7 − 3 = **+4**, stripe-2014 5 − 3 = **+2**,
   deepmark 4 − 4 = **0** on its current front-matter. vizleads failed this
   test, because its margin over stripe-2014 was one ineligible signal. This
   page clears stripe-2014 by two on eligible signals alone.
4. **Nothing underneath.** stripe-2014's +3 sits over a real product surface
   (its Checkout form is the product). This page shows only the doorway, an
   upload box, and scores `real-product-surface`, `shows-deliverable` and
   `live-claim-control` all absent. Its three craft values are type and rhythm;
   none is a product, an artefact or a layout stance.

**Robustness.** No single reasonable re-read takes the net below +4 (table
above). The most reasonable one, the discs as field, lands at +4 overall and at
+3 on eligible signals, still one clear of stripe-2014's +2. The upward flips
(`type-scale-high-contrast` at exactly 3.75, `density-variation`,
`custom-type-pairing`) each take it to +6. The plausible range is +4 to +6, all
inside the slop band.

**Consistency check, not part of the required separation.** The page's profile
is close to permit-guide-ai (`slop`, +6): the same Lovable display/Inter type
split, symmetry present, centred hero, generic icon set, the same three cheap
craft values (type scale, pairing, one more). It differs by carrying
`gradient-blob`, `glass-card-overuse` and `indigo-violet-accent` where
permit-guide-ai carries `testimonial-card-row`, `gradient-fill-cta` and
`stock-photo-generic`.

**Brief discrepancy, for the orchestrator.** The brief's corpus table (slop
n=2, heroku-2014 +5 and openhack +4; deepmark +3) is stale against
`content/evidence/` today: openhack is `mixed`, heroku-2014 computes to +4,
deepmark to +2 after its 2026-10-18 re-pass, and there are five `slop` files
(heroku-2014, permit-guide-ai, prilo-ai, toppic, zingy-cannoli). None of that
changes this verdict: the separation above holds against deepmark at +2 or +3.

**Thin-page caveat, stated as the rules ask.** 4169px, no pricing, no
testimonials, no team, no docs, no stats. Many signals had nowhere to fire in
either column. The craft side is not inflated by that here, because the
page's three craft values do not depend on the missing sections. What the page
ships is close to the builder's default landing
template over a product it never shows: the hero offers an upload, and nothing
on the page shows what comes back.
