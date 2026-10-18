---
source: https://cursor.com
kind: site
cohort: agent-tools
context: [hero, nav, features, testimonials, cta, footer]
verdict: mixed
studied: 2026-10-10
materials: [dual-theme, illustration]
signals:
  gradient-blob: absent
  three-card-row: present
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: absent
  symmetric-everything: absent
  badge-pill-spam: absent
  generic-line-icon-set: absent
  testimonial-card-row: absent
  indigo-violet-accent: absent
  gradient-fill-cta: absent
  scroll-reveal-blank: absent
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: absent
  hero-mockup-float: present
  asymmetric-split: present
  single-optical-anchor: absent
  type-scale-high-contrast: absent
  editorial-grid-break: absent
  custom-type-pairing: present
  real-product-surface: present
  shows-deliverable: absent
  density-variation: present
  one-accent-discipline: present
  live-claim-control: absent
---
Captured at 1440x900 light and dark; full page 8175px. A cookie-consent card covers
roughly (890,755) to (1420,885) in both captures.

Recorded as mixed, and it is the most interesting site in the cohort for that reason:
the typography and the dark theme are better than almost anything else here, and the
page still ships two of the canonical slop patterns.

Typeface, settled by downloading the webfonts and reading their name tables rather
than inferring from letterforms: the primary face is **Cursor Gothic** (roman and
italic), bespoke. The site also self-hosts the full Lato family and EB Garamond.
Nothing in the document names a family — every face is content-hashed under
/marketing-static/_next/static/media/ — so letterform guessing would have called this
one wrong in either direction. The pairing is visible in the site's own chrome, not
merely provisioned: section three sets a copyable install snippet
(curl https://cursor.com/install -fsS | bash) in a monospace face inside a #f2f1ed
filled field with a copy button, beside Cursor Gothic body copy.

The theme pair is the single best mechanism on the page. Light field is #f7f7f4,
dark field is #14120b — both *warm*. The dark theme is a temperature counterpart, not
an inversion to cold black, so the two renders look like the same brand rather than a
palette and its negative. The button pair inverts together: in light, primary is a
#26251e near-black pill and secondary a #e6e5e0 grey pill; in dark, primary becomes a
#edecec near-white pill and secondary a #26241e dark pill with a hairline. Both
members flip, so the primary/secondary hierarchy survives the theme change — the
common failure is inverting the field and leaving one button's fill fixed, which
collapses the pair. The painted backdrop is the same painting in both themes,
darkened and desaturated in dark rather than swapped. A dark capture differs from
light across 99.7% of pixels; this is a designed second theme, recorded as
`materials: dual-theme` rather than as a signal.

Where it fails. The hero composites two application windows over a 19th-century
romantic landscape oil painting: a "Cursor Desktop" window from x=180 to x=1260 with
macOS traffic lights, and a second "Cursor CLI" window overlapping it from x=860 to
x=1337 at a nearer z-depth, both with drop shadows, floating on an unrelated painted
image. Axis-aligned rather than tilted in perspective, which is the better version of
the move, but it is still a mockup float: the interface is pictured on decorative art
rather than placed on the page. Consequence for the signal above it —
single-optical-anchor is absent, because the painting, two overlapping windows and
the headline each claim attention and none dominates.

"Stay on the frontier" is a true three-card row and should be recorded without
softening: three cards at roughly 427px with ~11px gaps, each with a 1px #e4e3dd
border, ~6px radius, internal padding, a 17px heading, 15px body, an orange link, and
a visual panel below. Card chrome is unambiguously present. The row also ships
visibly broken: the third card ("Develop enduring software") puts its "Explore
enterprise" link at y=391 where the other two sit at y=220 and y=234, and its visual
panel from (960,420) to (1355,640) is an empty grey rectangle. Three cards, one of
them hollow, live on the homepage.

The headline is the cohort's outlier in the other direction: "Cursor is your coding
agent for building ambitious software." measures roughly 33px cap-derived on 33px
leading, against 15px body and nav. That is a 2.2:1 display-to-body ratio, so
type-scale-high-contrast is absent — about half the ratio of every other exemplar
here. There is no subhead at all; the headline goes straight to two buttons. The page
is betting on the product image carrying the hero, which is consistent with the
mockup float and explains why both read as the same decision.

What it does well besides the theme. Testimonials are six quotes in a 3x2 lattice
divided by 1px rules — no fill, no radius, no shadow, so no card — with attribution
as name plus role at ~11px beneath each quote (Diana Hu, Jensen Huang, Andrej
Karpathy, Patrick Collison, shadcn, Greg Brockman). Changelog and "Recent highlights"
are both four-column rows separated by hairline top rules rather than tiles. One
accent and one only: #f54e00 orange on every inline link ("Explore models",
"Learn about cloud agents", "Explore enterprise", "See what's new in Cursor"), and
nowhere else — the buttons stay achromatic. Every chromatic value other than that
orange is inside a real product capture (green diff counts, a mint CLI plan line, a
#d0a467 "Build" badge), not in the site's own palette.

Real product capture throughout, with real content rather than lorem: actual file
paths, +135/-21 diff counts, a model picker listing named models, a Slack thread with
a "View PR" button. The logo wall is eight customer marks in one monochrome row.

**v4 hole-7 deliverable re-pass**

Re-studied 2026-10-16. Value confirmed `absent`; no flip.

Capture: reused `~/scratch/antislop/s5/cursor-com`, 12 tiles, `clamped: false`,
`coverage: 1`, `docH_before` 8175 = `docH_after` 8175 (no drift), stitched to two
strips totalling 8175px. The last strip ends in the footer (Product / Resources /
Company / Legal / Connect columns, `© 2026 Anysphere, Inc.` and
`SOC 2 | ISO27001 | ISO42001 | AIUC-1 Certified` at y≈8130). The cookie card sits at
x≈893-1419 in every tile and covers parts of the hero CLI, the third frontier card,
the sixth testimonial and two highlight cards, so all text below was read from the
DOM with Playwright, not off pixels. Every product surface on this page is a
page-authored HTML demo ("This element contains an interactive demo for sighted
users..."), not a screenshot, and the demos cycle state, so the DOM was also read for
states the walk did not freeze. The only VIDEO element is the 22x24 nav logo; the
cloud-agent "walkthrough" with a play button is a still (`cursor-wallpaper.png`,
y=2502), so no load-bearing video was missed.

Candidates weighed, all inside product surfaces (page-authored HTML):
- Hero Cursor Desktop, y≈400-1020. Sidebar `Ready for Review 5`, every row ticked:
  `Plan Mission Control ... +20 -3` (y≈534), `Bioinformatics Tools ... +135 -21`
  (y≈687), `feature-prd.md +68` (y≈609). Alternate state in the DOM:
  `app/page.tsx +52 -0`, `app/globals.css +18 -0`, and `Done. Fonts preload in the
  head, critical CSS is inlined, ... 280ms first paint.`
- Hero Cursor CLI, x≈860-1337, y≈680-1040. Three one-line diff previews sit in its
  overflow region, scrolled out of view (DOM only): `bio/sequence_alignment.py`
  `+GAP_OPEN` `-10`, `bio/fasta.py` `-def`, `bio/translate.py` `+def` `+3` `-1`.
  Visible tail: ``Your existing `nw_align` function is unchanged.`` and `Want me to
  create a quick test to verify everything works?` (y≈917).
- "Agents turn ideas into code", y 1382-2097: a plan with `3 Tasks`, all unchecked,
  and a `Questions` card. Asking before building is the sold behaviour.
- "Works autonomously", y 2187-2902: `Worked for 14m 22s`, `Done! Here's a
  walkthrough of the dashboard.`, `Built the interactive dashboard ... Deployed to
  staging via Vercel.` (y≈2711).
- "In every tool", y 2991-3676: Slack reply `I added direct linking for changelog
  entries and updated the Node.js version constraints across the project for better
  maintainability.` above `View PR` (y≈3352); CLI `Started 3 agents` with
  `Health` / `Deployments` / `Incidents` rows and `GPT-5.6 Sol Extra High Fast · 8% ·
  5 files edited`.
- "Hand work to AI teammates", y 3766-4451: Grok Bot inbox, `Expense Manager ...
  report filed. 9 receipts, nothing outstanding.` (y≈4263), `Talent Scout ... 3
  intros drafted in your voice, held for your ok.` (y≈4208), `Account Manager ...
  globex note held in drafts.`; DOM-only row `Offsite crew ... that leaves the
  pipeline. i'd spin up a dedicated agent.`
- Frontier row, y≈5300-5872: model picker `Auto Suggested / Grok 4.7 / GPT-5.6 Sol /
  Fable 5.1 Max / Opus 5.5 / Gemini 3.1 Pro / Composer 2.5 ✓`; phone `All Repos`,
  four visible rows each `Working` (`Fix sign-in redirect on iOS`, `Add rate limits
  to public routes`, `Cache repository search results`, `Investigate flaky CI
  shard`), plus two clipped by the phone frame (DOM only): `Retry failed billing
  webhooks`, `Polish usage chart loading state`, also `Working`. The third card's
  panel is a photo of monitors, unreadable.

Searched the page's own canvas too: logo wall (y≈1180), testimonials (y 4684-5150),
`Trusted by over half of the Fortune 500` (y≈5500), changelog (y≈6091), Recent
highlights (y≈7100) including the title `A technical report on Composer 2`, and the
footer certifications. None is an artefact of the product's output. The Fortune 500
line is a vendor-aggregate odometer; the report is a link title, not shown content;
the certifications are a list that can only grow.

Entry that could have embarrassed Cursor: none. Every outcome the product emits is
the flattering one (`Done.`, `Ready for Review 5`, `Done!`, `Deployed to staging`,
`nothing outstanding`, six `Working` and no `Failed`). The diffs were checked line by
line, as asked. Counts (`+20 -3`, `+135 -21`, `+68`, `+52 -0`, `+18 -0`, `+3 -1`) are
size, not quality; a deletion count is not an error. The only readable diff lines are
`+GAP_OPEN`, `-def` and `+def`; the removed `def` is the agent's announced FASTA fix
and agrees with its own summary. No hunk is rejected or reverted, and no test, lint or
build line fails. The model picker lists competitors' models because breadth is the
claim ("Choose between every cutting-edge model"); it flatters by being larger.

Near-misses, rejected:
- `Want me to create a quick test to verify everything works?` admits the CLI agent
  reported done untested. It narrows no claim: the hero claims nothing about testing,
  and the section that does ("build, test, and demo features end to end") shows its
  own agent finishing `Done!` with a walkthrough. Read as offered initiative, it is
  something the page would keep, not cut.
- Unrequested scope: the Slack agent also `updated the Node.js version constraints
  across the project`, and the CLI agent adds an ORF finder and reverse complement
  "since that's often needed". Both are authored as bonuses. A sceptic could call it
  overreach, but nothing shown is declined, wrong, failed or costed.
- Bug titles in `All Repos` (`Investigate flaky CI shard`, `Retry failed billing
  webhooks`) are the jobs handed to the product, not its results. Its own status on
  every one is `Working`.
- `held for your ok` / `held in drafts` is approval gating sold as a feature, which
  the definition excludes.

Verdict: absent, unchanged. The medium qualifies under Part B (readable,
page-authored HTML renderings of product output), so this is not an "only chrome"
or "only marketing graphic" call. It fails on stance: every value is the flattering
one, matching the browserbase-com (`Done` / `Uploading`, no `Failed`) and sentient-os
(every demo card a win) precedents.

Studied-page check: same page, minor drift. docH is 8175, as studied. Hero
composition, the three-card row, six named testimonials, Slack thread with `View PR`,
install snippet, model picker and the eight-logo wall all match the prose. The
studied third-card defect reproduces on an unscrolled load: `Explore enterprise` at
y=5610 against `Explore models` at y=5439, the same 171px gap as the prose's y=391
vs y=220. It aligns once the lazy photo loads during the walk. Drift found: the
changelog's lead entry `Oct 13, 2026 Origin App Marketplace` postdates the study
(feed update); demo timestamps are relative (`11:34 AM` in the capture, `11:55 AM`
on re-read) and the CLI agent rows cycle (`Building health metrics panel` in the
capture, `Moving to cloud` on re-read). Changelog cells read rgb(242,241,237) on an
rgb(247,247,244) body, a faint fill the prose describes as hairline rules; this does
not bear on this signal. The Grok Bot section is not mentioned in the prose. With
docH unchanged, it is read as unmentioned rather than added. Wayback was offline
(429, then "Temporarily Offline"), so this could not be confirmed against a snapshot.
The point is moot because nothing in that section is credited.
