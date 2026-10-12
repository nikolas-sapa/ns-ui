# Session 2 handoff — pipeline built, gate shut

Date: 2026-10-12
Branch: `feat/antislop-authority`
State: 80 tests green, typecheck clean, build wired into `registry:build`

## What runs

```
content/evidence/*.md  →  scripts/build-antislop.ts  →  mcp/data/antislop.json
content/rules/*.md     ↗                             ↘  get_antislop_rules(context)
```

| piece | where |
|---|---|
| closed vocabulary, 26 signals | `lib/antislop-vocab.ts` |
| evidence parser + shared frontmatter helpers | `scripts/antislop/evidence.ts` |
| rule parsing, computed counts | `scripts/antislop/rules.ts` |
| rule eligibility | `scripts/antislop/eligibility.ts` |
| build, markers, snapshot | `scripts/build-antislop.ts` |
| MCP tool | `mcp/src/antislop.ts`, registered in `mcp/src/index.ts` |
| fixture corpus | `scripts/fixtures/antislop/` |
| 25 evidence files | `content/evidence/` |

Verified, not asserted: stdout byte-empty on MCP boot, latency 0.19ms
serving 103KB (spec budget 50ms), snapshot 185KB at the spec's 300-file
scale against a 2MB ceiling, CI stale-count check proven red in a
throwaway repo.

## The gate is shut, and that is the product working

**Zero of 26 signals are eligible.** Every one reports the same reason:
the corpus has 2 rated `slop` files and the gate requires 3.

```
$ node scripts/build-antislop.ts --report
SKIP <every signal>   not enough rated evidence to compute a separation:
                      slop (n=2); 3 rated files required in each verdict pool.
zero-evidence signals (4): glass-card-overuse, emoji-as-icon,
                           badge-pill-spam, stock-photo-generic
```

The build passes with `content/rules/` empty. Nothing is authored because
nothing can be supported. That is why the fixture corpus exists — without
it the pipeline is untestable, since the real corpus exercises no counting,
no marker rewriting and no snapshot content.

## Session 3: one file opens everything

**Find a third `slop`-rated site.** One more takes the pool to 3 and opens
the separation test for all 26 signals simultaneously. This is a sharper
target than "gather more evidence".

**It is not in `agent-tools`.** Those are the sites being copied, so the
template signals they carry are ones they originated. The closest candidate
there, `railway-com` at 7 slop / 6 craft, was deliberately not rounded: it
pins a 1px rail with a travelling train down all 12212px outside the
content column, sets IBM Plex Serif against Inter, shows four unbezelled
app captures, and renders its scale claim as a live split-flap board.
Rounding it would put a false positive where the separation test can least
afford one.

Sample a generated/small-site cohort instead.

## Unfinished, and why

**The bidirectional scroll-reveal walk did not complete.** `scroll-reveal-blank`
was verified only on files already marked `present`, which caught two false
positives — both exemplars — and cannot catch a false `absent`. The signal
now separates perfectly on a 3-file base and the cleanliness is partly an
artifact of a one-directional test. An agent was walking the 18 `absent`
files when its budget ran out. It changed no files and reported one thing
worth keeping:

> Dense everywhere, near-zero change on 17 of 18 — but my boolean row
> metric is coarse (one line of text marks a row fully inked), which is
> exactly how a false `absent` would survive.

So the unfinished work needs a **continuous per-row ink fraction**, not a
boolean, plus same-session static controls for every live page to remove
cross-session page drift. Treat the current `scroll-reveal-blank`
distribution (5 present, 2 unresolved, 18 absent) as unconfirmed on the
`absent` side.

`clerk-com` and `stripe-com` read `present` from static captures and have
never been walked.

**Generalize the lesson:** any verification pass applied only to positives
flatters the signal. Verify a sample of negatives as a matter of course.

## Capture method, settled

Two distinct failure modes, both silent:

- **IntersectionObserver reveals** → fixed by a scroll walker. Use
  `~/scratch/antislop/shoot-scroll-deep.cjs` (600px steps, 700ms settle,
  height re-measured each step). The shallower `shoot-scroll.cjs` stops at
  4000px and misses bands below it.
- **Lazily-sized WebGL canvases** → NOT fixed by walking. They size from
  0×0 only once in view. Park on the section ~12s and take a viewport shot.

Measure by row-level diff, never by eye: a page with per-load randomized
content (rotating cover art) reads as content mounting. Take background as
the modal pixel — an absolute brightness threshold reads a light page as
100% inked before and after.

## Carried forward

- `docs/superpowers/specs/2026-10-11-vocabulary-v4-candidates.md` — eight
  findings with measurements, including the one that kills `check_design`
  as markup analysis.
- The blind re-rate still has not run. The density bands came from raters
  who set the signals and then assigned the verdict.
- The 7 disagreement files, where a rater withheld `exemplar` from a page
  the vocabulary scores clean. Still the largest known blind spot.
- Everything is one viewport, 1440×900. `asymmetric-split` in particular
  may not survive at phone width.
