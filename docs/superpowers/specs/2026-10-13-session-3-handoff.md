# State after session 3 — the gate is open and ten rules are live

Date: 2026-10-13
Supersedes: `2026-10-12-session-2-handoff.md`, which described a shut gate
and zero rules. Both are now wrong.
On main: `0d196ebe`, deployed and verified serving.

## What is live

```
content/evidence/*.md  →  scripts/build-antislop.ts  →  mcp/data/antislop.json
content/rules/*.md     ↗                             ↘  get_antislop_rules(context)
```

| | |
|---|---|
| evidence | 32 files, 3 cohorts: `yc-current` 15, `agent-tools` 10, `pre-ai-2015` 7 |
| vocabulary | 26 signals, `lib/antislop-vocab.ts` |
| **rules** | **10 authored**, counts computed from their own evidence lists |
| MCP | `get_antislop_rules(context)`, 10 rules for `hero`, stdout clean |
| posts | 2, with BlogPosting + BreadcrumbList schema, in `llms.txt` |
| gates | 82 tests (`npm run test:antislop`), typecheck clean |

The ten rules: three slop (`hero-gradient-blob`,
`type-generic-sans-default`, `layout-symmetric-everything`) and seven craft
(`layout-asymmetric-split`, `hero-single-optical-anchor`,
`type-scale-high-contrast`, `layout-editorial-grid-break`,
`type-custom-pairing`, `product-artifact-not-dashboard`,
`layout-density-variation`).

## First task next session, and it may undo the above

**`deepmark` has one rater and no second read.** It is the third `slop`
file, which is what opened the gate. All ten rules depend on it.

Full basis in `2026-10-13-deepmark-verdict-basis.md`. Summary: it nets +6
(9 slop, 3 craft), the highest in the corpus, above `heroku-2014` (+5) and
`openhack` (+4), and it survives its two most novel calls being flipped. It
fails if three are wrong.

A blind re-rate has been dispatched twice and died on budget both times. If
one returns `mixed`:

1. Set `deepmark`'s verdict to `mixed`.
2. `node scripts/build-antislop.ts` — the eligible-but-unruled check will
   fail, naming the signals that lost eligibility.
3. Delete the rule files for the no-longer-eligible signals. The build
   goes green with however many survive.

That is the whole revert. The rules are generated from the evidence, so
nothing needs rewriting.

## The eligibility gate, as it now stands

A signal backs a rule only if all of these hold:

| gate | threshold | applies to |
|---|---|---|
| separation | 0.30 gap, in the direction the class claims | both classes |
| verdict pools | 3 rated files in each | both classes |
| control cohort | present-rate ≤ 0.30 | **slop signals only** |
| control pool | 3 rated control files | slop signals only |
| **observations** | **3 `present` corpus-wide** | **both classes** |

The last one was added in this session, after the gate first opened and let
two signals through on almost nothing: `badge-pill-spam` was eligible on a
**single** `present` file and `stock-photo-generic` on two. Both cleared
because every other minimum counts how many files were RATED, and the
separation test reads a rate — 1 of 3 slop files is 33%, which clears a 0.3
gap. Nothing looked at how many times the signal had been observed.

All thresholds encode findings at n=32 and are expected to be revisited.
They are in one block at the top of `scripts/antislop/eligibility.ts` with
the reasoning attached.

## What the evidence supports, and what it does not

**Supports:** the convergent template predates AI. Mean slop per page
barely moves across twelve years (3.14 → 2.62 → 2.40) while mean craft
climbs (3.71 → 5.38 → 5.90). They did not abandon the template moves, they
stopped running them bare. `railway-com` carries 8 slop signals, more than
the 2014 slop file, and is still `mixed` because 6 craft signals carry
them.

**Does not support:** "AI makes everything look the same." Several slop
signals run at similar or higher rates in the 2014 control.
`three-card-row` is rising, not declining. No slop signal in the vocabulary
is rising over twelve years once `hero-mockup-float` is excluded for not
discriminating.

## Known-soft, in priority order

1. **`deepmark`'s single rater.** Above.
2. **Circularity.** Verdicts were set by the raters who had just set the
   signals. The density bands are therefore not an independent finding.
   Unfixed and untested.
3. **The mixed/slop boundary is not clean.** Net separates exemplar from
   slop with no overlap, but `stripe-2014` is `mixed` at +4 and `openhack`
   is `slop` at +4. The measure sorts the extremes and is unreliable where
   verdicts are actually hard.
4. **One viewport.** Everything is 1440×900.
   `layout-asymmetric-split` records this in its own rule text.
5. **The 7 disagreement files** — `resend-com`, `capveon`, `github-2014`,
   `basecamp-2014`, `cursor-com`, `nxtcure-labs`, `squarespace-2014` — each
   had `exemplar` withheld by a rater despite a clean signal profile. Still
   the largest known blind spot in the vocabulary.
6. **`scroll-reveal-blank`'s `absent` side** is now verified both ways
   (three exemplars moved to `present` when the walk ran on negatives), but
   `databuddy` had walk and park without a dwell control.

## Open vocabulary work

`2026-10-11-vocabulary-v4-candidates.md`, eight findings with
measurements. The largest: **a signal cannot be scored from source.**
Measured both ways on two sites, markup was wrong on all three signals
tried, twice in the flattering direction. That kills `check_design(html)`
as markup analysis; anything automating the rating has to render and sample
pixels.

## Method, paid for the hard way

- **`--full-page` silently returns correct-dimension PNGs with unpainted
  content.** Use `~/scratch/antislop/shoot-scroll-deep.cjs` (600px steps,
  700ms settle). The shallower `shoot-scroll.cjs` stops at 4000px.
- **A walk does not fix lazily-sized canvases.** They size from 0×0 only
  once in view. Park on the section ~10s.
- **Row-level diff, never by eye.** A page rotating its cover art per load
  read as content mounting and produced a false confirmation.
- **Background is the modal pixel.** An absolute brightness threshold reads
  a light page as 100% inked before and after.
- **A boolean per-row metric is too coarse** — one line of text marks a row
  fully inked, which is how a false `absent` survives. Use a continuous
  per-row ink fraction, with same-run static controls.
- **Verify negatives, not just positives.** Any verification pass applied
  only to positives flatters the signal.
- **`npm ci`, never `npm install`.** An `npm install` in this worktree
  stripped `@auth/core` from the lockfile and produced three typecheck
  errors that were then misreported as pre-existing.
- **Main moves constantly.** Four separate sessions shipped to it during
  session 3. Merge main before every push.

## Where the next slop file is not

The slop pool is 3 and more would strengthen every rule. Product Hunt
Cloudflare-challenges headless browsers; the v0 community gallery yields no
outbound URLs through a text reader. The `agent-tools` cohort is
structurally wrong — those sites originated the template moves they carry.
The 356-row YC list at `~/scratch/antislop/yc-companies.tsv` has 345
unstudied entries with live URLs and is the path of least resistance.
