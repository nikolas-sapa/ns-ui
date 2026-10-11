# Signal vocabulary v2 — revisions forced by the first evidence wave

Date: 2026-10-11
Status: input for session 2, not yet applied
Evidence base: 20 files, 3 cohorts, commit 8931b700

The v1 vocabulary in `2026-10-10-antislop-authority-design.md` was written
before any site had been studied. Twenty files later, **8 of its 22 signals
are wrong** — not mis-measured, mis-defined. This records what the evidence
forced, so session 2 builds the schema from findings rather than from the
original guesses.

## 1. The premise changed

`centered-hero-stack` runs 5/7 in 2014, 2/8 in YC Fall 2026, 0/5 in
agent-tools. It is a 2014 pattern in decline, not an AI artifact.
`feature-icons-identical` (3/7 → 2/8 → 0/5) and `three-card-row`
(2/7 → 1/8 → 2/5) follow the same curve. `gradient-blob` is roughly flat
across twelve years (2/7 → 3/8).

Only `hero-mockup-float` is genuinely rising: 3/7 → 5/8.

Craft moved the other way: `type-scale-high-contrast` 3/7 → 7/8,
`one-accent-discipline` 5/7 → 7/8.

**Consequence for the program's claim.** "AI makes every site look the same"
is not what the evidence says. The defensible claim is narrower and better:
the convergent template predates AI by a decade, models inherited it from
2014-era marketing sites, and the strongest current builders have already
moved past it. Every public surface should make that claim, not the first.

## 2. Signals that read zero because of their definition

Three of the six zero-firing signals are blind by construction, not because
the pattern is absent.

| v1 signal | reads | problem | v2 |
|---|---|---|---|
| `purple-blue-gradient-cta` | 0/20 | names the gradient, not the hue; the archetypal AI palette now ships as a flat fill | split into `indigo-violet-accent` (hue, any fill) and `gradient-fill-cta` (multi-stop on a primary button, any hue) |
| `testimonial-card-triplet` | 0/20 | names an exact count; real sites keep the template and vary the count (6 in a 3×2, ~12 in a masonry wall) | `testimonial-card-row` — three or more equal-weight quote cards as the whole social-proof section; exact count goes in prose |
| `feature-icons-identical` | 0/20 literal | no site repeats one glyph | `generic-line-icon-set` — one undifferentiated set, uniform stroke and size, carrying no information the heading doesn't |

`generic-line-icon-set` was applied independently by two raters before being
named: the YC agent on `databuddy` and `capveon`, and the orchestrator on
the 2014 control (Stripe's three circular green icons, GitHub's four blue,
Heroku's purple isometric set). Neither repeats a glyph; both are one set.
Agreement across raters on different cohorts is why this one is settled
rather than pending.

The other three zeros — `badge-pill-spam`, `glass-card-overuse`,
`emoji-as-icon`, `dark-mode-afterthought` — have a different cause
(threshold and scope) and their disposition is still open.

## 3. Signals the vocabulary cannot express

| proposed | class | evidence |
|---|---|---|
| `artifact-not-dashboard` | craft | `decent-com` (priced carrier comparison with two refusals, claims ledger), `silica` (force-vs-time chart) |
| `scroll-reveal-blank` | slop | `openhack`, `nxtcure-labs`, `melty-gg` |
| `typewriter-headline` | slop | `nxtcure-labs` (hero, caught at two strings), `decent-com` (product panel, two dollar values) |
| `indigo-violet-accent` | slop | `nxtcure-labs`; `databuddy` background bloom |
| `live-claim-control` | craft | `silica` ("Press and hold to apply load", drives the chart backing the page's one argument) |
| `stock-photo-generic` | slop | stock that could belong to any company, or stock the type cannot survive on so a scrim is bolted over it. `capveon` is **absent**: its headline is sited in dark water where the photograph has no detail, so no scrim is needed, and every image is credited |

**`artifact-not-dashboard` exposes a bug, not a gap.** `real-product-screenshot`
means the opposite thing, so `decent-com` had to be marked absent on it —
reading as a deficiency when showing the deliverable instead of the UI is
the best decision on that page. The two cannot both stand as written.

**`scroll-reveal-blank` is worth a signal beyond being a template tell:** it
is a real robustness defect. No-JS, print, prefetch, reduced-motion, and any
agent reading the page all get nothing.

## 4. Open schema decisions for session 2

1. ~~Does the vocabulary need a third class?~~ **Settled: no.** Every
   signal exists to aggregate into a rule carrying `stance: avoid | prefer`.
   A neutral signal can never carry a stance, so it would validate, count
   and emit into `antislop.json` while being unable to do the one job a
   signal has. The two candidates dissolve on inspection:
   `yc-backer-badge` is not a design fact at all (it records who funded the
   company; `cohort: yc-current` already says that) and existed only to stop
   contaminating `badge-pill-spam` — which that signal's own scope rule
   fixes directly. `stock-photo-hero` felt neutral because it was named at
   the wrong altitude: it named a material, not a decision. Renamed to
   `stock-photo-generic` it carries a stance cleanly.
   **The general lesson: a signal that feels neutral is almost always named
   at the wrong altitude.** Rename it before reaching for a new class.
2. **Replace `motion-tied-to-input`.** Unresolved 17/20 — a static capture
   cannot settle it. `live-claim-control` is narrower, stronger, and
   resolvable from a still because the affordance is a visible label.
3. **Reclassify `centered-hero-stack`** out of slop. It is a legacy pattern
   in decline; scoring it as a defect mismeasures every cohort.
4. **Disposition for `badge-pill-spam`, `glass-card-overuse`,
   `emoji-as-icon`, `dark-mode-afterthought`** — all 0/20, cause pending.

## 5. Method, settled by this wave

- **`--full-page` is not a trustworthy instrument on scroll-reveal sites.**
  It returns a correct-dimension PNG with unpainted content and no error:
  `openhack` rendered 5388px of section borders and isolated buttons at
  correct Y positions with nothing between them. Two captures 3.5s apart
  came back byte-identical, so it is not a timing issue — the page waits for
  scroll events a full-page capture never generates. Use the scroll walker
  (`~/scratch/antislop/shoot-scroll.cjs`) and add a blank-band variance
  detector before scaling past ~8 sites.
- **Dump text alongside every screenshot.** `innerText` plus a node count
  settles `three-card-row` and `testimonial-card-row` with no pixels, and
  text is present in the DOM even at zero opacity. Would have resolved every
  signal this wave had to leave unresolved.
- **Playwright's default capture is `color-scheme: light`,** so a default
  capture rendering dark proves the site is dark-only. That is how
  `dark-mode-afterthought` was settled on evidence rather than assumption.
- **Screenshot storage, for the spec's deferred question:** full-page PNGs
  ran 0.2–5.9MB, median ~1MB, tallest 10869px. ~200–400MB at 200 sites.

## 6. Slop is a density, not a signal — the rule model does not survive

Tested across all 20 files. Slop-signal count against the verdict assigned
independently when each file was written:

| verdict | n | slop-signal counts |
|---|---|---|
| exemplar | 9 | 0, 0, 0, 1, 1, 1, 1, 1, 2 |
| mixed | 9 | 0, 1, 1, 2, 2, 2, 2, 4, 4 |
| slop | 2 | 5, 6 |

Clean separation. **No single signal predicts a verdict; the count does.**
The two slop pages are `heroku-2014` (6 signals: centered stack, gradient
field, three-card row, symmetric panels, floating mockups, one line-icon
set) and `openhack` (5). Every exemplar sits at 2 or below.

### The separation is partly circular — do not cite it as a finding

**The verdict and the signals were set by the same rater in the same pass.**
Each rater read the screenshots, set 22 signals, then assigned a verdict
informed by what they had just set. So "slop-count predicts verdict" is
partly tautological. The clean separation may be measuring rater
consistency rather than a property of the sites.

Three raters produced the three cohorts, and the pattern holds in all
three — but that does not break the circularity, because each rater could
be individually self-consistent. It is not independent evidence.

Two cheap ways to break it, for session 2:
- One agent sets signals, a second assigns verdicts blind to them.
- Check whether the count predicts a verdict the rater did not produce.

Until one runs, the 0-2 / 0-4 / 5-6 bands are a hypothesis to test, not a
result — independently of the n=2 problem.

### The cheap circularity check, and what it found

Before spending agents on a blind re-rate, recompute the verdict
mechanically from the signals alone and see which files disagree. It needs
no agents and it found more than the blind test would have.

Rule: `slop>=5 → slop`, `slop>=3 → mixed`, else `exemplar`.
**It reproduces 13 of 20 hand verdicts.**

Every one of the 7 disagreements runs in the same direction:

| file | cohort | hand | mechanical | slop | craft |
|---|---|---|---|---|---|
| `resend-com` | agent-tools | mixed | exemplar | 0 | 7 |
| `capveon` | yc-current | mixed | exemplar | 1 | 6 |
| `github-2014` | pre-ai-2015 | mixed | exemplar | 1 | 5 |
| `basecamp-2014` | pre-ai-2015 | mixed | exemplar | 2 | 3 |
| `cursor-com` | agent-tools | mixed | exemplar | 2 | 5 |
| `nxtcure-labs` | yc-current | mixed | exemplar | 2 | 4 |
| `squarespace-2014` | pre-ai-2015 | mixed | exemplar | 2 | 4 |

**Seven for seven, the rater withheld `exemplar` from a page the vocabulary
scores as clean.** Never the reverse. Three different raters, three
cohorts, same direction.

That one-directional bias is evidence *against* pure circularity: a rater
merely reading back their own signals would produce errors in both
directions. Something outside all 22 signals is informing the verdict, and
it only ever argues for less praise. `resend-com` is the sharpest case —
zero slop signals, seven craft signals, and still not called exemplar.

**These 7 are the most informative files in the set.** Whatever the raters
saw is the vocabulary's largest blind spot, and it is a bigger prize than
the blind re-rate. Session 2 should interview the files, not the raters:
read the prose notes of these 7 against the 9 exemplars and name what
separates them.

A partial lead from the margins: craft count by hand verdict is
exemplar [4,5,6,6,6,7,7,7,8], mixed [2,3,4,4,4,5,5,6,7], slop [2,2]. Craft
separates about as well as slop does and the v1 model ignores it entirely.
`slop − craft` sharpens it further: every exemplar sits at −3 or below, both
slop files at +3 or above. Still overlapping in the middle, so it is a lead,
not a rule.

### A signal must EARN a rule

The v1 model (one rule = one signal + a count) does not survive for the
*conventions*, but it is probably fine for signals that discriminate on
their own — `emoji-as-icon` and `generic-sans-default` plausibly still do.
Rather than abandoning it, make a signal earn its rule. It may back one
only if:

1. its present-rate separates exemplar from slop, and
2. it is not already common in `pre-ai-2015`.

`hero-mockup-float` fails both and gets no rule; it stays in the evidence
files as a recorded fact. This is a procedure to apply as evidence
accumulates, not a threshold to freeze at n=20, and it fits the
numeric-criteria style of the v1 test plan.

### Several slop signals are just pre-AI web conventions

`hero-mockup-float` at 43% in 2014 and `generic-line-icon-set` across all
three 2014 exemplars are the same finding twice: **part of the v1
vocabulary measures "is this a website" rather than "is this slop".** That
is what the density result predicts — individual conventions are neutral,
accumulation is the defect. The two findings corroborate each other, which
is worth more than either alone.

The rule this forces: never author "icons bad". Author the count, the
uniformity, and the informational emptiness. A rule phrased the first way
fails against the 2014 cohort the first time anyone tests it.

## 7. `hero-mockup-float` does not discriminate

Earlier summarized as the one slop signal genuinely rising (3/7 → 5/8). It
does not survive the control.

| cohort | fires | verdicts of the files firing |
|---|---|---|
| pre-ai-2015 | 3/7 | slop, mixed, mixed |
| yc-current | 5/8 | mixed, exemplar, exemplar, mixed, slop |
| agent-tools | 1/5 | mixed |

It fires on exemplars and slop alike, and was already 43% standard in 2014.
A convention, not a defect. Nothing in the program should claim otherwise.

With this struck, **no slop signal in the vocabulary is rising over twelve
years.** The ones that move are falling.

## 8. Disposition of the four remaining zeros

From the cohort agent, whose reasoning separates them by cause rather than
lumping them as "unused":

- `badge-pill-spam` — keep; add a number (3+ decorative pills in marketing
  chrome above the fold) and a scope rule excluding embedded product UI.
  Without the scope rule, `nxtcure-labs` and `openhack` fire on their
  product screenshots instead of their marketing. Stays 0/20 here: the
  badge-pill wave has passed, which is a finding, not a gap.
- `glass-card-overuse` — keep with a threshold (3+ translucent-blur
  surfaces). `capveon`'s single floating nav is the only glass surface in
  20 files. Glassmorphism has passed too.
- `emoji-as-icon` — keep unchanged. The one honest zero: unambiguous
  definition, no threshold needed, genuinely absent. This is the baseline
  against which the other zeros should be judged.
- `dark-mode-afterthought` — does not survive. It conflates "ships a
  neglected second theme" with "ships no second theme", so 7 single-theme
  sites and the one genuinely good dual-theme site (`nxtcure-labs`) all
  read absent for opposite reasons. Split `single-theme` out as a separate
  fact.

## 9. `centered-hero-stack` indicts good pages

It pulls `neomatter`, the clearest exemplar in the YC set, into a slop hit.
What makes `openhack` slop is centring *plus* symmetric-everything plus
generic-sans-default plus hero-mockup-float — four signals on one axis.
`neomatter` centres one 110px italic display serif, then breaks the grid in
every band below. Same signal, opposite outcome. This is the clearest
single case for the compound model in section 6.

## 10. `one-accent-discipline` has no zero-accent ruling

`neomatter` (cream, near-black) and `capveon` (white, near-black, warm
photography) carry no chromatic accent at all — the photography carries
every colour. Both were marked present on the reading that zero or one
accent is the same restraint, and both files say so. Flipping that reading
moves the count 7/8 to 5/8. Session 2 picks one and states it in the
vocabulary rather than leaving it to the rater.

## 11. Standing caveat

n = 7, 8, 5. Directional, not conclusive. The 2014 control files are one
rater's judgment with no second read; the YC set had two. Any public claim
built on these counts states the n.
