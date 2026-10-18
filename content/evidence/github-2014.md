---
source: https://web.archive.org/web/20150101044830/https://github.com/
kind: site
cohort: pre-ai-2015
context: [hero, features, auth, footer]
verdict: mixed
studied: 2026-10-11
materials: [single-theme, illustration, origin-captured, anchored]
signals:
  gradient-blob: absent
  three-card-row: absent
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: absent
  symmetric-everything: absent
  badge-pill-spam: absent
  generic-line-icon-set: present
  testimonial-card-row: absent
  indigo-violet-accent: absent
  gradient-fill-cta: present
  scroll-reveal-blank: absent
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: absent
  hero-mockup-float: absent
  asymmetric-split: present
  single-optical-anchor: present
  type-scale-high-contrast: present
  editorial-grid-break: absent
  custom-type-pairing: absent
  real-product-surface: present
  shows-deliverable: present
  density-variation: present
  one-accent-discipline: absent
  live-claim-control: absent
---
Capture year 2014 (Jan 2015 snapshot). The only page in the cohort that
puts a working form in the hero instead of a button.

Asymmetric split at the top: headline left at roughly 44px against 15px
body, signup fields right — username, email, password, and a green submit.
The optical anchor is the green button and nothing else competes with it.
Hero sits on a near-black field with a faint tiled octicon pattern at very
low contrast, the one decorative element.

Immediately under it an entirely different band: a pale blue sky-and-clouds
illustration promoting GitHub Enterprise, with its own ghost-outline CTA.
Two unrelated visual systems stacked with no transition.

Features are four items in a 2x2, each under a blue line icon from one set
at one weight — the identical-icon pattern, just four up instead of three.

Lower, two large unretouched screenshots of the desktop client at near
full width, showing real commit history and a real diff with green and red
gutters. No device frame, no tilt. Readable at 1:1.

Accent discipline fails: green submit, blue links, blue icons, plus the
Enterprise band's own palette.
**v3 re-pass.** `gradient-fill-cta` is present and measured: the green "Sign up for
GitHub" submit runs #84d768 at its top edge to #66b74a at its bottom. Same finding as
`stripe-2014` and `dropbox-2014` — a gradient-filled primary button was ordinary in
2014, which the eligibility test will have to absorb. No indigo-violet anywhere, no
scroll-gated bands (the page renders complete to the footer).

**v4 hole-7 deliverable re-pass**

`shows-deliverable` flips `absent` to `present`. The entry is a commit titled
`Sorry VB users` in the GitHub for Windows screenshot, a screenshot the reused
capture never rendered.

Capture. Snapshot landed on `20150101044830` (the `/web/2014/` URL redirects to
1 Jan 2015, the same snapshot the prose describes). The reused s5 walk reads 5
tiles, `clamped: false`, `coverage: 1`, docH 3161 before and after, last strip
ends in the footer. It is incomplete: `gh-windows-app.png` (1956x1067, archived,
HTTP 200) had not loaded when the walk ran, so the page measured 534px short, and
`ghfm.png` painted only down to the `Exclude jQuery from index and help` row,
white below. A verification walk into `~/scratch/antislop/s5h7/github-2014`
(stitched with `NS_SESSION=s5h7`, s5 left untouched) reads 6 tiles,
`clamped: false`, `coverage: 1`, docH 3695 before and after, footer at y≈3645,
both screenshots fully painted. Coordinates below are from that walk.

Candidates weighed:
- Hero signup form, y 126-601, page canvas. Site chrome, not an output. The
  password rule and `Upgraded plans start at $7/mo.` are form/pricing copy, no
  refusal.
- Enterprise band, y 601-930, page canvas. Illustration plus slogan, no artefact.
- 2x2 features, y≈930-1720, page canvas. Copy under icons, no artefact.
- GitHub for Mac screenshot (`ghfm.png`), y 2171-2824, product capture,
  `github/mac.github.com` on `gh-pages`, `223 commits`. The diff the prose
  records is PR `Merge pull request #36 from github/requires-10-8`, body
  `Requires 10.8`, red line `OS X 10.7 or later` (y≈2496) replaced by green
  `OS X 10.8 or later` (y≈2534). That is GitHub dropping OS X 10.7 from its own
  client, but it narrows nothing the page leaves broad: the page's own download
  line at y≈1995 already says `OS X 10.9 or later.`, stricter than the diff. The
  red gutter is a deletion, not a failure. The rest of the log is routine
  (`THE FUTURE`, `Add "removed" badge for release notes`, a typo in
  `Change branches popover decription`, which is a staffer's spelling, not the
  product erring). No conflict, no revert, no error state. On its own this shot
  would stay absent.
- GitHub for Windows screenshot (`gh-windows-app.png`), y 2864-3400, product
  capture, repo `octokit.net` on `master`. Octokit.net is GitHub's own official
  .NET API client, and every author shown (Phil Haack, Brendan Forster, Paul
  Betts) was GitHub staff, so this log is the vendor's own work. The featured
  commit, whose diff fills the right pane, is
  `Merge pull request #481 from octokit/sort-is-actually-case-sensitive`
  (y≈2926) with body `searching for issues hits a case-sensitive field`
  (y≈2965): a fix for GitHub's client sending wrong values to GitHub's own search
  API, with a `[SuppressMessage("Microsoft.Globalization", "CA1308:NormalizeStringsToUppercase")]`
  added to silence the analyser. The list under it carries
  `bugfix - the State value when searching for i…` (y≈3128),
  `More jacked up tests` (y≈3197), and `Sorry VB users` (y≈3301), plus four
  `Fix up …` commits.

The entry: `Sorry VB users` (y≈3301, Paul Betts, `14 days ago`). It is a
vendor-authored apology for a change that cost a class of the vendor's own
users, left in the homepage's hero product shot when any clean slice of the log
would have done. The featured #481 bugfix and `bugfix - the State value…`
corroborate: the artefact shows GitHub's own code erring and being fixed. Under
the stated test (a demo that shows the product or vendor erring or costing
passes, provenance neither earns nor forfeits) this is the railway-com shape, a
real log the vendor did not scrub, and the inverse of browserbase-com's ledger
with no `Failed` row. Medium: a readable artefact inside a product screenshot
counts. Legibility: the asset is @2x shown at 0.5 scale, so commit titles are
about 9px at 1x, small but readable, crisp at 2x. Not placeholder.

Studied-page check: unchanged. The original prose records "two large
unretouched screenshots of the desktop client", so the Windows shot was on the
studied page and this corrects a capture miss, not a redesign (the stripe-2014
case). One limit: both shots carry platform classes (`show-mac show-linux` /
`hide-mac`); the live 2014 page showed each visitor one block by OS, and the
archive renders both because the switch does not apply. The Windows shot is
what the page served Windows visitors; it is page content either way.

**`source` pinned to snapshot `20150101044830`**, the one this file's hole-7 re-pass
landed on. `/web/2014/` resolves to the nearest capture and can move as the
archive adds captures; a pin means every later rater reads the same bytes.
