---
source: https://acyclic.dev
kind: site
cohort: yc-current
verdict: mixed
studied: 2026-10-16
context: [hero, docs, cta, footer]
signals:
  gradient-blob: absent
  three-card-row: absent
  glass-card-overuse: present
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
  stock-photo-generic: absent
  centered-hero-stack: present
  hero-mockup-float: absent
  asymmetric-split: absent
  single-optical-anchor: present
  type-scale-high-contrast: absent
  editorial-grid-break: absent
  custom-type-pairing: absent
  real-product-surface: absent
  shows-deliverable: absent
  density-variation: absent
  one-accent-discipline: present
  live-claim-control: absent
materials: [dual-theme]
---
A small, restrained page, and not a stub: a centred logo hero, a three-step
CLI quickstart, a two-column "Talk to us" section with a contact form, and a
footer. Three slop signals (system sans, centred hero, a blur count that sits
exactly on its threshold) against two craft signals that are both restraint by
omission. Thin: 2545px, 57 text leaves, no features, pricing, testimonials or
imagery, so most slop signals have nowhere to fire and their absents partly
record missing sections, not decisions.

**Capture.** Viewport 1440x900. Reused the s5 walk at
`~/scratch/antislop/s5/acyclic`: 4 tiles, `clamped: false`, `coverage: 1`,
scroller `window`, `docH_before` = `docH_after` = 2545, no inner scroller.
Re-stitched today: one strip, 1440x2545, 0px drift against the page. The strip
ends in the footer (y2486-2545, "© 2026 Acyclic Labs" with CLI / Agents / Blog /
About / GitHub). Sections from the DOM: hero `<section>` y0-772, `#get-started`
y772-1740, `#talk` y1740-2486, `<footer>` y2486-2545. Every value below is read
from computed style or canvas pixels, not from the strip.

The hero canvas (`<canvas aria-hidden>`, 1440x772, `pointer-events: none`,
`z-index: -10`) is a 2D context and is blank at rest: 0 painted pixels after 6s
idle. Swept with the Playwright mouse it paints a teal directed tree from the
pointer, node dots and arrowhead leaves, in roughly `rgb(48,128,120)` at alpha
about 0.25 (5583 painted pixels mid-sweep, chroma 80), and clears to 0 painted
pixels within 3s of the pointer stopping. It carries no labels, data or product
state. It is an "acyclic graph fans out" motif, not a view of anything.

**Slop signals present (3)**

- `generic-sans-default`. `document.fonts` holds 0 loaded faces and no
  `@font-face` is declared. All 49 prose leaves set in the stack
  `Inter, Roboto, "Helvetica Neue", "Arial Nova", "Nimbus Sans", Arial,
  sans-serif` at weights 300/400/500/600; the 8 command leaves in
  `ui-monospace, SFMono-Regular, Menlo, ...`. Inter appears only where the
  visitor already has it installed.
- `centered-hero-stack`. All 8 hero text leaves are `text-align: center` on
  x=720: the logo lockup (mark plus "Acyclic" 34px/600 and "Labs" 34px/300,
  y256), the H1 subhead (19.2px/400, x440 w560), the "Funded by Y Combinator"
  pill (x630 w180), and the Sign in / Install the CLI / GitHub row (y503).
- `glass-card-overuse`, exactly at the threshold. Three elements carry
  `backdrop-filter: blur(8px)` over a translucent fill
  `oklab(0.88 0.001 0.030 / 0.4)`: the YC pill (180x32 at 630,423), the Sign in
  link (87x44 at 573,503) and the contact-form card (456x553 at 752,1837). The
  decided rule counts surfaces, so 3 is present. What the blur does differs per
  surface: the pill and the button sit over the hero canvas and do soften the
  tree lines passing beneath them (a pointer sweep across the pill shows the
  lines fading out under its fill), while the form card sits 1065px below the
  canvas on flat cream and blurs nothing. At rest none of the three reads as
  glass.

**Craft signals present (2)**

- `one-accent-discipline`. Every text colour is a warm neutral: six values at
  oklch chroma 0.010 to 0.026, hues 44 to 92. The primary CTA "Request a
  conversation" fills `oklch(0.13 0.01 44)`, near-black; Sign in is the
  translucent beige above. The only chromatic marks are the YC square
  (`#fb651e`, 16x16, a third-party logo) and the canvas teal, which exists only
  while the pointer moves. Zero authored accents at rest, one in use: present
  under either reading of the zero-accent ruling. The dark scheme keeps the same
  discipline (black field, grey type, the same YC square).
- `single-optical-anchor`, the contested call, recorded as I read it. The
  anchor counted is the hero logo lockup (384x110 SVG mark plus the 34px
  wordmark). The hero band y0-772 carries 0.99% ink (pixels more than 60 summed
  RGB levels off the `rgb(240,233,214)` field, sampled every second pixel). By
  ink the lockup does NOT dominate: it holds 36.4% of hero ink against 35.9% for
  the subhead line, 15.6% for the button row and 12.1% for the pill. It
  dominates by size and weight (34px/600 near-black against 19.2px/400 in
  `oklch(0.43 0.022 60)`). And yes, this is "one mass dominates because there is
  only one mass": nothing else occupies the 772px band. Page-wide there is no
  single anchor; each lower section leads with its own 38.4px H2 and the form
  card is a second mass of equal width.

**Near-misses**

- `symmetric-everything`, absent on alignment counts, the corpus method
  (edotenv, deepmark, osseus). 47 of 57 text leaves are `start`-aligned; the 10
  centred ones are the 8 hero leaves plus two button labels. 6 of 7 headings
  are `start`. The counter-case is real: `#talk` splits into two 456px columns
  at x232 and x752 with a 64px gap, mirrored exactly about x=720. That is one
  balanced two-up, not every section centred. Flipping it gives net +2.
- `asymmetric-split`, absent: the only split is that 456/456, 50:50 by width.
  The content differs (prose against a form); the proportion does not.
- `density-variation`, absent. Ink by band: hero 0.99%, get-started 3.41%,
  talk 6.46%, footer 4.88%, a 6.5x swing, and get-started does carry the
  textures osseus lacked (four code blocks, 12.8px small print). But the swing
  is an empty logo hero against two ordinarily filled sections, the dipole-labs
  shape ("two sections cannot establish a rhythm to play against"), and the
  quickstart's three steps repeat one identical triplet (16px/600 label, 14.9px
  prose, 14.9px mono command). Nothing compresses against a rhythm the page set
  up.
- `real-product-surface`, absent: the settled doorway case. The commands are
  real (`npm install -g @acyclic-labs/cli`,
  `acyclic swarm login --site https://acyclic.dev`,
  `acyclic swarm run --task "fix the flaky test in tests/api" --dir . --watch`,
  `acyclic swarm pull <swarm-id> --apply`, plus a
  `curl -fsSL https://acyclic.dev/install.sh | sh` line) and none shows output.
  No `--watch` stream, dashboard or patch appears. Media census: 0 img, 0 video,
  0 iframe; 5 SVG (logo, YC square, a 16px arrow, the GitHub mark twice); 1
  canvas, whose tree is decorative (above). The page shows only the door to the
  product.
- `shows-deliverable`, absent. No artefact of the product's work exists, so
  there is nowhere to name an embarrassing entry. The honest narrowings are all
  prose: "We're onboarding teams gradually, starting with those that already
  run agents in volume." (y2124), "One login lasts 90 days." (y1210),
  "`--dir .` uploads your working files (no history, no secrets)" (y1335), and
  the "read it first" link to `/install.sh` (y1125). Real candour, outside any
  artefact.
- `live-claim-control`, absent. The canvas responds to the pointer but tests
  nothing; Copy copies the npm line; the form submits. Nothing lets a visitor
  check "exponentially faster".
- `type-scale-high-contrast`, absent: `ladder.cjs` gives 38.4 / 16 = 2.4:1,
  well under 3.75. The largest text is a section H2, not the hero; the H1 is
  19.2px.
- `badge-pill-spam`, absent: one pill above the fold. `emoji-as-icon`, absent:
  the three list markers are U+2192 set in Inter, `aria-hidden`, a text glyph.
  `generic-line-icon-set`, absent: no icon set exists, only a download arrow,
  the GitHub mark and the YC logo.
- `scroll-reveal-blank`, absent: 0 of 57 text leaves under 8% effective opacity
  at rest, measured over the whole document including every below-fold node,
  0 running CSS animations, `docH` 2545 before and after the walk. Nothing is
  hidden, so there is nothing for scroll to gate and the dwell control is moot.
  `typewriter-headline`, absent: `innerText` identical (1982 characters) at 2s,
  8s and 14s.
- `materials`. `dual-theme`: under `prefers-color-scheme: dark` the root gains
  class `dark`, the body goes to `oklch(0 0 none)` and H2 to
  `oklch(0.9128 0 none)`, a full theme, not a fallback. The canvas is a 2D
  context, so not `webgl`; it is left out of `illustration` because it paints
  nothing at rest (anthropic-com's 2D canvases set the same precedent).
  Recording `illustration` would also be defensible; no rule reads materials.
- `context`. `docs` for the quickstart (install line, three commands, links to
  `/cli` and `/guides/mcp`), `cta` for the Talk to us form. No `nav`: the hero
  carries three links and no navigation bar.

**Verdict: mixed, net +1** (3 slop, 2 craft). Inside the mixed band (-5..+3)
and three points short of the +4 floor for slop. Nothing here is a template
stamped out: no cards, no icon grid, no gradient, no testimonials, no scroll
theatre, one pill. The slop count is a system sans, a centred logo hero and
three CSS blur declarations of which one renders over nothing. It is not an
exemplar either: both craft presents are restraints that cost nothing on a page
this small, the type ratio is 2.4:1, and the product never answers on the page.
If `single-optical-anchor` is read as absent (the call of both other raters,
below), net is +2, the old figure; the verdict does not move.

**Drift from the 2026-10-13 study**

The premise that the page was redesigned after the study does not hold, and
that changes the cause of every flip. Two captures from 2026-10-13 exist on
disk. `~/scratch/antislop/shots/acyclic.png` (born 2026-10-13 14:08:38,
probe3's 1440x900 viewport shot) is byte-identical (sha1 `9cba3517`) to today's
first walk tile `s5/acyclic/acyclic-00.png`. And
`~/scratch/antislop/blind/acyclic-static-full.png` (born 2026-10-13 14:39:08,
1440x2545) is pixel-identical to today's stitched strip (PIL
`ImageChops.difference` bounding box `None`). The full page, quickstart, Talk to
us form and footer included, already existed on the study date. The old prose
itself mentions "a GET STARTED rule" at the bottom of the frame: the 900px
viewport cuts at y900 and the "Get started" label sits at y869. The original
rating was made from the first viewport only and read the fold as the end of
the page. The 10-13 re-pass's own drift note ("the page is no longer a stub")
attributes to a redesign what was a capture miss.

| signal | 2026-10-13 | now | cause |
|---|---|---|---|
| `glass-card-overuse` | absent | present | old rating wrong. The third blur surface, the form card at y1837, sits below the 900px frame, and the pill and button were not counted. Page unchanged. |
| `symmetric-everything` | present | absent | old rating wrong. Every leaf in the first viewport is centred; 47 of the page's 57 are `start`. Capture miss. |
| `scroll-reveal-blank` | unresolved | absent | old rating wrong in the capture sense: the below-fold sections existed and were readable; measured now at 0 hidden text nodes. |
| `single-optical-anchor` | absent | present | rater difference on an undefined signal. The hero is the same pixels both times, so neither a page change nor a capture miss. |
| `context` | [hero] | [hero, docs, cta, footer] | old rating wrong, capture miss. |
| `materials` | [single-theme] | [dual-theme] | undetermined: no 10-13 dark-scheme capture exists. The light render is pixel-identical, so an old miss is most likely, but it is not provable. |
| verdict | mixed (+2) | mixed (+1) | unchanged. |

Unchanged values with changed grounds: `type-scale-high-contrast` stays absent,
but the old "one size" reading was wrong (the 38.4px H2s and 12.8px small print
were below the fold) and the ratio is 2.4:1. The old "roughly 450px of empty
cream" below the hero controls measures 322px (button bottom y547 to the label
at y869). `real-product-surface` and `shows-deliverable` agree with the 10-13
re-pass, including its check of the command grammar against the shipped binary.

A blind re-rate also ran on 2026-10-13 on the full page
(`~/scratch/antislop/blind-rerate.md`, 2 slop / 3 craft / net -1, read only
after this file's front-matter was written). It agrees on the blur count and the
page shape. Two corrections to it: it held `glass-card-overuse` absent because
"all three sit on a flat solid cream ground with nothing behind to blur", which
is true at rest and false for the pill and button once the canvas paints; and it
scored `real-product-screenshot` present on the commands, which the doorway
ruling has since closed. It differs from this file on `density-variation`
(present there) and agrees with the old file on `single-optical-anchor` absent,
which leaves this file the minority on that signal.

**Superseded study (2026-10-13, verdict `mixed`).** Everything below describes the page as it was before the redesign that forced the re-study above, and is kept as the record of that page. Its signal values, which the front-matter no longer carries:

```
gradient-blob: absent
three-card-row: absent
glass-card-overuse: absent
emoji-as-icon: absent
generic-sans-default: present
symmetric-everything: present
badge-pill-spam: absent
generic-line-icon-set: absent
testimonial-card-row: absent
indigo-violet-accent: absent
gradient-fill-cta: absent
scroll-reveal-blank: unresolved
typewriter-headline: absent
stock-photo-generic: absent
centered-hero-stack: present
hero-mockup-float: absent
asymmetric-split: absent
single-optical-anchor: absent
type-scale-high-contrast: absent
editorial-grid-break: absent
custom-type-pairing: absent
real-product-surface: absent
shows-deliverable: absent
density-variation: absent
one-accent-discipline: present
live-claim-control: absent
```

A stub, and worth recording as a distinct shape from slop. Centered stack
on a cream field: a hand-drawn arrow-and-node mark, "AcyclicLabs" at
roughly 34px, one line of body at 17px, a Y Combinator pill, then a
"Sign in" button beside "Install the CLI" and a GitHub mark. Roughly 450px
of empty cream below it before a "GET STARTED" rule.

This is `centered-hero-stack` and `symmetric-everything` with a near-empty
slop count and a near-empty craft count. It is not a template stamped out;
it is a page nobody has built yet. The distinction matters for the
vocabulary: a low slop count is not evidence of craft, and the net measure
reads a stub and an exemplar as closer than they are.

Typeface is a system sans at one size with no display face, and the mark
is the only drawn element on the page.

**v4 change 3b surface re-pass**

Decided first: `real-product-surface: absent` (confirmed), `shows-deliverable:
absent` (confirmed). Neither value flips.

Capture (s5, 2026-10-16): 4 tiles, `clamped: false`, `coverage: 1`,
`docH_before` = `docH_after` = 2545, scroller `window`, stitched 1440x2545
matches page height. Last strip ends in a footer: "© 2026 Acyclic Labs" with
CLI / Agents / Blog / About / GitHub links at y≈2507. Text and positions read
from the DOM.

Candidate surfaces:
- y=0–772, `<canvas aria-hidden="true">` behind the hero. Blank in the strip
  and blank at idle (0 painted pixels); it only draws on pointer movement, and
  only when `(hover: hover)` matches and reduced motion is off. Driven with
  the mouse, it paints a teal branching tree of arrows (3 roots, 2-3 random
  children per level, arrowhead leaves) that fades after ~1.3s. The bundle
  (`nodes/12.CyNLA_kU.js`) generates it from `Math.random()` angles and
  lengths: no labels, no data, no product state. Decorative illustration of
  "fan out", not a product view.
- y=225, SVG wordmark (arrow-and-node mark plus "AcyclicLabs"). Logo.
- y=1049, `npm install -g @acyclic-labs/cli` in a DOM code box with a live
  "Copy" button; y=1242 `acyclic swarm login --site https://acyclic.dev`;
  y=1391 `acyclic swarm run --task "fix the flaky test in tests/api" --dir . --watch`;
  y=1515 `acyclic swarm pull <swarm-id> --apply`. Faithfulness checked
  independently of the site: `@acyclic-labs/cli@0.0.6` on npm is a shim over
  per-platform binaries; `strings` on `@acyclic-labs/cli-linux-x64@0.0.6`
  contains `swarm login`, `--site`, `--task`, `--dir`, `--watch`, `--apply`,
  `--patch`, `pull`. The commands are real. They also match `/cli`.

Q1 verdict, absent. The only genuine product material is the command grammar,
and it shows what the user types into their own shell: no prompt, no output,
no `--watch` stream, no swarm page, no merged patch. That is install
documentation, not a capture or rebuild of anything the product renders. The
product's own surfaces (the `--watch` progress stream, the dashboard at
`/dashboard/swarms`, the patch) appear nowhere on the page, the
`browserbase-com` shape. The canvas is the one drawn depiction and it is a
random decorative tree.

Embarrassing entry: none. Searched the commands, the example task (input
only, no result shown), and every line of copy. Closest candidates, none
counting: "macOS and Linux." (y=1106) is a platform limit, true per the four
`darwin`/`linux` binary packages, but it is install-requirement copy, not
scored output. "One login lasts 90 days." (y=1210) is a token policy.
"keep only the results you verified." (y=2024) implies discarded results
but is a capability claim repeated as a selling point. "We're onboarding
teams gradually, starting with those that already run agents in volume."
(y=2124) is a gate dressed as exclusivity. "(read it first)" (y=1125)
invites scrutiny of `install.sh` but is not product output.

Q2 verdict, absent. No artefact of the product's work on a job exists on the
page, in any medium: no patch, no PR, no swarm trace, no agent output, demo
or otherwise. With nothing scored, there is no entry that could count against
the vendor.

Drift from the prose above (2026-10-13), recorded not re-rated: the page is
no longer a stub. Below the hero now sit "GET STARTED" / "Run your first
agent swarm." (y=869–1641, three numbered CLI steps), a "TALK TO US" /
"Scale agent swarms to tasks that are too big for one agent." section with a
contact form (y=1837–2370, plus an off-screen honeypot "Website" field), and
a footer. The gap below the hero buttons is ~225px, not ~450px. Type is no
longer one size: h1 19.206px/400, h2 38.412px/600, h3 16px/600, small copy
12.804px, all `Inter, Roboto, …`; "AcyclicLabs" is the SVG wordmark, not
text. The mark is no longer the only drawn element: the pointer-driven
canvas tree also draws. Other signals were not re-rated here.
