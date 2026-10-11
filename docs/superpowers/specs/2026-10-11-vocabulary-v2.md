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
| `stock-photo-hero` | neutral? | `capveon` (five credited CC0 photographs) |
| `yc-backer-badge` | neutral? | 7 of 8 — cohort artifact; recording it stops it contaminating `badge-pill-spam` |

**`artifact-not-dashboard` exposes a bug, not a gap.** `real-product-screenshot`
means the opposite thing, so `decent-com` had to be marked absent on it —
reading as a deficiency when showing the deliverable instead of the UI is
the best decision on that page. The two cannot both stand as written.

**`scroll-reveal-blank` is worth a signal beyond being a template tell:** it
is a real robustness defect. No-JS, print, prefetch, reduced-motion, and any
agent reading the page all get nothing.

## 4. Open schema decisions for session 2

1. **Does the vocabulary need a third class?** v1 has slop and craft only.
   `stock-photo-hero` and `yc-backer-badge` are descriptive, not
   evaluative. Third class, or plain frontmatter fields outside the signal
   set? Awaiting the cohort agent's recommendation.
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

## 6. Standing caveat

n = 7, 8, 5. Directional, not conclusive. The 2014 control files are one
rater's judgment with no second read; the YC set had two. Any public claim
built on these counts states the n.
