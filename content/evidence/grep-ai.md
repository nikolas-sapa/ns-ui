---
source: https://grep.ai
kind: site
cohort: yc-current
context: [hero, features, pricing, testimonials, footer]
verdict: mixed
studied: 2026-10-13
materials: [dual-theme, illustration]
signals:
  gradient-blob: absent
  three-card-row: present
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: absent
  symmetric-everything: absent
  badge-pill-spam: present
  generic-line-icon-set: present
  testimonial-card-row: present
  indigo-violet-accent: present
  gradient-fill-cta: absent
  scroll-reveal-blank: absent
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: absent
  hero-mockup-float: present
  asymmetric-split: present
  single-optical-anchor: absent
  type-scale-high-contrast: absent
  editorial-grid-break: present
  custom-type-pairing: present
  real-product-screenshot: present
  artifact-not-dashboard: absent
  density-variation: present
  one-accent-discipline: present
  live-claim-control: absent
---
**Re-rated from a corrected capture. The first rating of this file was
wrong, and wrong because of the capture, not the judgment.**

`document.documentElement.scrollHeight` on grep.ai is **900**. The real
content lives in `div.grep-public-main` at a `scrollHeight` of **17890**.
So a viewport shot, `--full-page`, and a `window.scrollTo` walker all
return the same first 900px — 5% of the page — with no error and no
missing-content signature. The original rating called this page `exemplar`
on one screen of twenty, and the screen it got is genuinely good, which is
why nothing looked wrong.

A blind second rater found this independently and captured the page through
the inner scroller. This file is rebuilt from a 22-tile capture of
`div.grep-public-main` (`~/scratch/antislop/shoot-inner.cjs`).

## What the first 900px hides

A priced before/after comparison, run on 100 alerts: $2.89 against $0.25,
51 min against ~3 min, 826 tool calls against ~30, under a stated 91%
figure. A failure-mode table with four named production failures carrying
shares of incidents (context blindness 31.6%, rogue actions 30.3%, silent
degradation 24.9%, memory corruption 8.1%) each paired with the specific
mechanism that addresses it. A six-vendor capability grid across OpenAI,
Claude, AWS, Google, Microsoft and Grep, dated "Capability snapshot
September 17, 2026".

Two disclosures in that material run against the page's own interest and
are worth recording as mechanism: the cost comparison states "This
evaluation used a Claude agent baseline, not Codex. Savings vary by
workload", and the failure table is headed "Industry research, not Grep
incident rates", explaining that the shares come from an external catalog
of 591 documented incidents and "are industry examples, not measurements
of failures on Grep".

## Why `mixed` rather than `exemplar`

The page is `railway-com`'s shape: a substantial template count carried by
a substantial craft count. Monospace display throughout paired with a sans
body, one violet accent, a visible dot grid with the nav boxed outside it,
real product panels rather than drawn impressions, and section densities
that swing from an almost empty hero to a seven-row vendor grid.

Against that: a three-up agent-gallery row, decorative section labels, a
uniform violet check-glyph set running down the comparison tables, a
testimonial row, and a floated product panel in the hero.

`artifact-not-dashboard` is scored **absent** here only under the
mutual-exclusivity convention `railway-com` set, where a real screenshot
takes priority. The blind rater scored it `present` on this page and flagged
the inconsistency deliberately: the two signals are not currently separable
by rule, and the convention structurally starves the signal the spec calls
its strongest discriminator, because a page honest enough to show its
deliverable is usually also honest enough to show its UI. That is recorded
in the v4 candidates and is unresolved, not settled.
