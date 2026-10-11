# Signal vocabulary v3 — the decided list

Date: 2026-10-11
Status: decided; session 2 builds against this file
Supersedes: the signal list in `2026-10-10-antislop-authority-design.md`
Reasoning: `2026-10-11-vocabulary-v2.md` (why each change was forced)

v1 was written before any site was studied. v2 recorded what 20 evidence
files invalidated. **This file is the list itself** — session 2 implements
from here and reads v2 only when it needs the argument behind a line.

## The structural change

v1 hand-assigned each signal to slop or craft and let every signal back a
rule. Two findings killed that:

- Several "slop" signals are pre-AI web conventions. `hero-mockup-float`
  ran 43% in 2014; `centered-hero-stack` 5/7. A rule against them convicts
  good pages and fails against the control cohort.
- Slop is a density. No single signal predicted a verdict; co-occurrence
  did.

**So rule-eligibility is computed, not declared.** A signal backs a rule
only if the build can show both:

1. its present-rate separates `exemplar` from `slop`, and
2. it is not already common in `pre-ai-2015` (threshold set in session 2).

A signal failing either stays in the vocabulary and is still recorded in
every evidence file. It simply emits no rule. One namespace, no third
class, and eligibility tracks evidence instead of someone's opinion in
October 2026.

## Slop signals (16)

| signal | notes |
|---|---|
| `gradient-blob` | |
| `three-card-row` | |
| `glass-card-overuse` | threshold: 3+ translucent-blur surfaces |
| `emoji-as-icon` | unchanged from v1; the one honest zero, and the baseline for judging other zeros |
| `generic-sans-default` | |
| `symmetric-everything` | |
| `badge-pill-spam` | threshold: 3+ decorative pills in marketing chrome above the fold. **Scope: excludes pills inside an embedded product screenshot** — without this it fires on product UI instead of marketing |
| `generic-line-icon-set` | renamed from `feature-icons-identical`. Defined on uniformity and informational emptiness (one set, uniform stroke and size, carrying nothing the heading doesn't), **not glyph identity** — no real site repeats a glyph, so the v1 definition read 0/20 |
| `testimonial-card-row` | renamed from `testimonial-card-triplet`. 3+ equal-weight quote cards as the whole social-proof section; exact count goes in prose |
| `indigo-violet-accent` | from splitting `purple-blue-gradient-cta`: the hue, in any fill |
| `gradient-fill-cta` | from the same split: multi-stop gradient on a primary button, any hue |
| `scroll-reveal-blank` | content gated behind scroll-triggered reveals. Both a template tell and a real robustness defect — no-JS, print, prefetch, reduced-motion and any agent reading the page all get nothing |
| `typewriter-headline` | headline or product panel cycling phrases on a timer |
| `stock-photo-generic` | renamed from `stock-photo-hero`, which was named at the wrong altitude (a material, not a decision). Fires on stock that could belong to any company, or stock the type cannot survive on so a scrim is bolted over it |
| `centered-hero-stack` | **expected to fail eligibility test 2** — 5/7 in `pre-ai-2015`. Kept as a recorded fact |
| `hero-mockup-float` | **expected to fail both tests** — fires on exemplars and slop alike, 43% in 2014. Kept as a recorded fact |

## Craft signals (10)

| signal | notes |
|---|---|
| `asymmetric-split` | caveat: unstudied at narrow viewport, may not survive at phone width |
| `single-optical-anchor` | |
| `type-scale-high-contrast` | |
| `editorial-grid-break` | |
| `custom-type-pairing` | |
| `real-product-screenshot` | **scope-fixed**: the product's UI shown as a real screenshot. Mutually exclusive with `artifact-not-dashboard` by construction, not by defect |
| `artifact-not-dashboard` | the product shown as its *deliverable* rather than its UI — a priced comparison with real refusals, a claims ledger, a force-vs-time chart. Strongest single discriminator found so far |
| `density-variation` | |
| `one-accent-discipline` | **zero-accent ruling: present.** Zero and one accent are the same restraint. Stated here so it is not left to the rater; flipping it moves the count 7/8 to 5/8 |
| `live-claim-control` | replaces `motion-tied-to-input`. A control letting the visitor falsify the page's central claim. Narrower, stronger, and resolvable from a still because the affordance is a visible label |

## Dropped from v1

| signal | why |
|---|---|
| `purple-blue-gradient-cta` | split into `indigo-violet-accent` + `gradient-fill-cta`. Named the gradient, not the hue, so the archetypal AI palette went unrecorded once it shipped as a flat fill |
| `feature-icons-identical` | renamed `generic-line-icon-set` |
| `testimonial-card-triplet` | renamed `testimonial-card-row` |
| `stock-photo-hero` | renamed `stock-photo-generic` |
| `dark-mode-afterthought` | conflated "ships a neglected second theme" with "ships no second theme", so it read absent for opposite reasons. The fact moves to `materials` |
| `motion-tied-to-input` | unresolved 17/20. A static capture cannot settle it. Replaced by `live-claim-control` |

## `materials` — a separate key, deliberately

Descriptive facts a page is made of: `single-theme`, `dual-theme`,
`stock-photo`, `commissioned-photo`, `illustration`, `webgl`, `video-hero`.
Open list, extended as evidence demands.

**It must not share a namespace with the signal vocabulary.** The moment
`stock-photo` sits next to `gradient-blob`, someone writes a rule against
it. Materials are never stance-bearing and the build must never emit a rule
from one.

## Values

`present` · `absent` · `unresolved`

`unresolved` is an admission that the evidence could not settle it, not a
judgment. It stays visibly an admission — that is what keeps it from
becoming the destination for calls a rater would rather not make.

## Build checks this list forces

Beyond the v1 test plan:

- **Every vocabulary signal must be reachable by at least one rule, or be
  explicitly marked rule-ineligible with the evidence that disqualified
  it.** Without this check a signal can validate, count, and emit into
  `antislop.json` while backing nothing — a green build, a growing count,
  and no output on any surface. The build cannot catch that per-file,
  because rule-reachability is not a property of any single file.
- `real-product-screenshot` and `artifact-not-dashboard` both `present` on
  one file is a contradiction; flag it.
- A `materials` entry appearing in a rule's `signal` field is an error.

## Migration cost, named

The 20 committed evidence files use v1. Renames are mechanical. The six new
signals (`artifact-not-dashboard`, `live-claim-control`, `scroll-reveal-blank`,
`typewriter-headline`, `indigo-violet-accent`, `gradient-fill-cta`,
`stock-photo-generic`) are unset on all 20 and need a re-pass against the
screenshots — which still exist in `~/scratch/antislop/shots/`. That is real
work, not a sed, and it belongs in session 2's plan rather than being
discovered mid-session.

## Candidate, not adopted

`type-sited-in-image` — type placed where a photograph has no detail, so no
scrim is needed. One supporting file (`capveon`). Revisit at larger n.
