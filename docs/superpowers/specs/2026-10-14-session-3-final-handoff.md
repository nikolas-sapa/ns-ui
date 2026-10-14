# State after session 3 — the gate opened, then closed on a second reading

Date: 2026-10-14
Supersedes: `2026-10-13-session-3-handoff.md`, which said the gate was open
and ten rules were live. Both were true for about an hour and are now
wrong.

## What is live

```
content/evidence/*.md  →  scripts/build-antislop.ts  →  mcp/data/antislop.json
content/rules/*.md     ↗                             ↘  get_antislop_rules(context)
```

| | |
|---|---|
| evidence | 32 files, 3 cohorts: `yc-current` 15, `agent-tools` 10, `pre-ai-2015` 7 |
| verdicts | 12 exemplar, 18 mixed, **2 slop** |
| vocabulary | 26 signals, `lib/antislop-vocab.ts` |
| **rules** | **0** — the gate requires 3 slop files and the corpus has 2 |
| MCP | `get_antislop_rules(context)` works, serves an empty rule set |
| posts | 2, schema + machine-readable dates + `llms.txt` |
| gates | 82 tests (`npm run test:antislop`), typecheck clean |

The pipeline is complete and correct. It authors nothing because nothing is
supportable, which is the design.

## What happened, because it is the whole lesson

`deepmark` was rated `slop` by one rater, took the pool to 3, opened the
gate, and eleven rules were authored and merged. Two independent blind
raters then worked it without seeing the file.

Both returned the same six slop signals. **They split on craft, 2 against
4**, and the deciding call was measurable: `custom-type-pairing` had been
rated `absent` and is `present` — Space Grotesk carries every display size
(60, 42, 36, 26px) and Geist all body copy (14-18px). 123 Geist nodes, 28
Space Grotesk, nothing else at or above 26px.

6 slop / 4 craft / net **+2**, identical to `railway-com`, the `mixed`
anchor. The pool went back to 2 and all eleven rules were withdrawn.

Three other ratings fell in the same pass:

- **`grep-ai` was rated on 5% of its page.** `documentElement.scrollHeight`
  on grep.ai is 900; the real content is `div.grep-public-main` at 17890.
  Viewport, `--full-page` and `window.scrollTo` all return the same first
  900px with no error. Re-rated `exemplar` → `mixed` from a 22-tile capture
  through the inner scroller.
- **Carousels are not rows.** `three-card-row` and `testimonial-card-row`
  on `deepmark` are a 4-slide overflow track in a 1408px clip and a 2-slide
  testimonial track. Three cards sit in frame at 1440px.
- **`scroll-reveal-blank` versus native lazy loading.** A capture diff says
  present (5.5% of pixels, 14 images missing). Zero text nodes under 8%
  opacity at rest, after a 19-step walk, and after a matched dwell control,
  with visible chars identical at 8285 in all three. The cause is
  `loading="lazy"` on 31 of 34 images, which survives no-JS and withholds
  nothing from a markup reader.

## First task next session

**Find a genuinely slop-rated site, and have two raters agree on it.**

One more slop file opens the separation test for every signal at once.
A single rater cannot supply it — that is what this session proved at the
cost of eleven rules.

Protocol that worked: rate it, then dispatch a blind rater who is given the
vocabulary, the three anchor files (`heroku-2014`, `openhack`,
`railway-com`) and the URL, and is explicitly forbidden the file under
review. Disagreement on a measurable signal gets settled by measuring, not
by seniority.

**Where it is not:** Product Hunt Cloudflare-challenges headless browsers.
The v0 community gallery yields no outbound URLs through a text reader. The
`agent-tools` cohort originated the template moves it carries. The 356-row
YC list at `~/scratch/antislop/yc-companies.tsv` has ~338 unstudied entries
with live URLs and is the path of least resistance.

## The eligibility gate

| gate | threshold | applies to |
|---|---|---|
| separation | 0.30 gap, in the direction the class claims | both classes |
| verdict pools | 3 rated files in each | both classes |
| control cohort | present-rate ≤ 0.30 | slop signals only |
| control pool | 3 rated control files | slop signals only |
| observations | 3 `present` corpus-wide | both classes |

All five fail closed. All encode findings at n=32 and are expected to move.
They sit in one block at the top of `scripts/antislop/eligibility.ts` with
the reasoning attached.

## Capture, three failure modes, all silent

1. **Unpainted full-page.** `--full-page` returns a correct-dimension PNG
   with sections laid out and nothing painted. Use
   `~/scratch/antislop/shoot-scroll-deep.cjs` (600px steps, 700ms settle).
2. **Lazily-sized canvases.** They size from 0×0 only once in view; a walk
   passes too fast. Park on the section ~10s.
3. **Inner scroll container.** `documentElement.scrollHeight` reports the
   viewport while the content lives in a child element. Every instrument
   agrees on the wrong answer. Probe for `scrollHeight > clientHeight + 200`
   on `clientHeight > 300` elements before capturing, and use
   `~/scratch/antislop/shoot-inner.cjs`.

Plus: row-level diff, never by eye (rotating content reads as mounting).
Background is the modal pixel (an absolute threshold reads a light page as
100% inked). A boolean per-row metric is too coarse. Verify negatives, not
just positives. `npm ci`, never `npm install`.

## Known-soft, ranked

1. **Circularity.** Verdicts were set by the raters who had just set the
   signals. The density bands are not an independent finding.
2. **`artifact-not-dashboard` versus `real-product-screenshot`.** Three of
   four pages in one blind batch satisfied both. The convention giving the
   screenshot priority structurally starves the signal the spec calls its
   strongest discriminator: a page honest enough to show its deliverable
   usually also shows its UI. Unresolved.
3. **`symmetric-everything` has no threshold** and is worth ±1 net on
   `deepmark` alone. The largest unthresholded signal in the vocabulary.
4. **`type-scale-high-contrast` has no threshold or stated altitude.**
   `deepmark` is 3.58:1 at the hero cap-height and 2.6:1 across the page
   rhythm; which you score changes the verdict.
5. **`single-optical-anchor` has no definition** — the one v3 signal with an
   empty notes cell.
6. **`generic-sans-default` conflates two decisions**: shipping no webfont
   at all, and shipping a deliberate neutral grotesque. Both read present
   for opposite reasons, which is what got `dark-mode-afterthought` dropped
   from v1.
7. **One viewport.** Everything is 1440×900.
8. **The 7 disagreement files** where a rater withheld `exemplar` from a
   clean signal profile. Still the largest known blind spot.

## Open vocabulary work

`2026-10-11-vocabulary-v4-candidates.md`, eight findings with
measurements. Largest: **a signal cannot be scored from source.** Markup
was wrong on all three signals tested, twice in the flattering direction.
`check_design(html)` as markup analysis is dead; automation has to render
and sample pixels.
