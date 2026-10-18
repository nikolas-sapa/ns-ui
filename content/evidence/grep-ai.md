---
source: https://grep.ai
kind: site
cohort: yc-current
context: [hero, features, pricing, testimonials, footer]
verdict: mixed
studied: 2026-10-13
materials: [dual-theme, illustration, anchored]
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
  real-product-surface: present
  shows-deliverable: present
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

**v4 change 3 re-score — `shows-deliverable` absent → present.** Re-rated from
a fresh walk through the inner scroller, with the capture verified *before*
anything was read: `scroller: [data-ns-scroller]` resolving to
`div.grep-public-main`, `walkHeight: 17890`, `clamped: false`, `coverage: 1.0`,
26 tiles, and tile 25 carrying the footer `© 2026 PARCHA LABS, INC.` — so
failure modes 3 and 4 are both discharged on this file rather than assumed.

**A priced before/after comparison at y4142-4810**, two labelled columns rather
than a hero stat. Left, eyebrow `Baseline / Claude agent`: `Model cost per
alert` **$2.89**, `Average across the 100-alert evaluation`, then `Time to
complete 51 min`, `Tool calls 826`, `Records researched 24`. Right, eyebrow
`AFTER / AGENTRUN`: **$0.25**, `~3 min`, `~30` tool calls, `2` records. Summary
at y4718: `91% lower model cost per alert in the reported comparison`. And a
footnote at y4796 that qualifies rather than inflates: `Reported AML
evaluation: costs are averages across 100 alerts; time, tool calls, and records
refer to one 24-record alert. This evaluation used a Claude agent baseline, not
Codex. Savings vary by workload.`

**A benchmark block at y13453-14030 the original pass missed entirely**, under
`We scored Grep against the tools your team already uses: ChatGPT, Claude, and
Perplexity. Same questions, same independent judges.` Each 58px figure carries
its provenance: `78.6%` DRACO (`Perplexity's 100-task benchmark, same
Gemini-2.5-Pro judge. +8.1pp over Perplexity`), `84.5%` DeepSearchQA
(`Google's 896 multi-step questions, independently reproduced by Kaggle. Ahead
of Perplexity (81.9%)`), `56.27/100` DeepResearch Bench. Then a 5-row
leaderboard with readable per-row values (`GREP AI 78.6%`, `Perplexity Deep
Research 70.5%`, `Claude Opus 4.6 59.8%`, `ChatGPT · OpenAI DR (o3) 52.1%`),
stamped `Feb 2026 · 100 tasks` and footed with the judge and rubric used.

Two more: a failure-mode table at y9603-10424 with proportional bars and
readable shares, and a six-vendor capability grid at y14533-15630 stamped
`Capability snapshot September 17, 2026` carrying per-cell qualifications
(`OpenAI only`, `Antigravity base`, `Step Functions`, `Unconfirmed`) instead of
bare ticks, with a cost row reading `$465-480` / `$513` / `$503` /
`Unconfirmed` / `$510` / `$90`.

**On the earlier measurement worry:** the 64px `$ 2.89` / `$ 0.25` and the 58px
`78.6` / `84.5` / `56.27` were flagged during the v4 change-1 work as figures
set at display size, which broke a naive display:body ratio. They are not
decorative. Decorative big-number marketing has a signature — a large figure
with no unit, no denominator, no named comparator and no disclaimer — and every
figure here carries all four.

For contrast, the content on this page that is *only* UI, and was the whole of
what the old convention could record: the hero workflow panel (y85-660), the
agent filesystem tree (`supplier-review-agent/`, `instructions.md`,
`skills/`, `tools.json`), the adjacent `Example workspace` panel whose rows are
placeholders (`Acme Holdings`, `Cedar Technologies`, `Northstar Trading`), and
the `Agent OS` circuit-chip SVG at y7384.

**Two corrections from the change-3 re-score, neither moving a signal.**

The failure-mode table at y9603-10424 has **five** rows, not four: the original
pass misses `Runaway execution 5.1%` at y10309. The five sum to exactly 100.0%,
so the undercount hid the fact that it is a complete partition rather than a
selection.

And a correction to a claim made *about* this page during the v4 change-1 work,
not in this file: the page does **not** lead with figures. The two largest
nodes are the 64px prices, but they sit at y4301 — fifth section, roughly 4.8
viewports and 24% into a 17890px page. The page opens at y213 with a 52px `h1`,
`Self-improving agents that help you scale.`, beside the hero panel over a
`Backed by Y Combinator` badge and a logo row. Largest type on the page is not
the first thing on it. This matters because that measurement feeds
`type-scale-high-contrast`, which this file scores `absent` and which holds:
64/52/44 display against 15/13/12 body is an ordinary editorial ramp.

**What makes the numbers credible is that the page grades them and demotes most
of them.** The AML comparison is labelled `Reported`; the vendor costs are
`Modeled, not benchmarked` and `Illustrative estimates, not a benchmark.`; the
failure shares are headed `Industry research, not Grep incident rates.` and
footed `This is a non-random sample; the shares shown are not production
failure rates.`; and y15554 cross-references that the modelled costs `are
separate from the measured AML evaluation in the savings section`. A page
inventing numbers does not build a taxonomy that downgrades three quarters of
its own output. The refusals are there too: Google's cost cell is left
`Unconfirmed / Preview pricing incomplete` rather than filled in, and all six
vendors get a tick on `Managed execution` and `Execution traces`, competitors
included. One benchmark line discloses the competitor's own score (81.9%), four
points off its own.

**`real-product-screenshot` stays `present`, flagged.** The page has **zero
raster product screenshots**: exactly three raster images above 150x100, all
618x618 case-study photography, and no raster CSS `background-image`. Every
product surface is a DOM/SVG rebuild (70 `img`, mostly logos and avatars; 296
`svg`). So the value holds only on the same convention `clerk-com` holds it on,
which makes this a **fourth** instance of the change-3b defect the proposal's
table does not list. Weaker than clerk's, too: clerk mounts its live component,
whereas grep's panels are page-authored replicas, one of which (`Example
workspace`) is populated with placeholders `Acme Holdings` / `Cedar
Technologies` / `Northstar Trading`.
