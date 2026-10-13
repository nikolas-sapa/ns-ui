# Is `deepmark` really slop? The basis for the file that opened the gate

Date: 2026-10-13
Status: decision recorded, blind second read still outstanding

The eligibility gate requires 3 files rated `slop`. For 32 files the corpus
had 2. `deepmark` was the third, and it was rated by one rater who also set
its verdict. Ten rules now rest on it. This records what that verdict is
actually worth.

## The verdict is not a boundary case

| file | verdict | slop | craft | net |
|---|---|---|---|---|
| **deepmark** | **slop** | **9** | **3** | **+6** |
| heroku-2014 | slop | 7 | 2 | +5 |
| openhack | slop | 6 | 2 | +4 |
| stripe-2014 | mixed | 6 | 2 | **+4** |
| railway-com | mixed | 8 | 6 | +2 |
| databuddy | mixed | 5 | 4 | +1 |

`deepmark` carries the highest slop count in the corpus and the highest
net, above both files other raters independently rated `slop`. On the
calibration standard this project set — slop is a high slop count *without
craft carrying it* — it is further from the boundary than either existing
slop file.

## But the mixed/slop boundary is not clean, and an earlier claim of mine
## was wrong

`stripe-2014` is rated `mixed` at net **+4**, the same net as `openhack`
rated `slop`. So net does not separate `mixed` from `slop`: +4 appears on
both sides.

An earlier commit claimed "slop minus craft still separates with no
overlap: exemplar runs -7 to -2, slop +4 to +6." That is true only of
*exemplar versus slop*. It is not true of mixed versus slop, and the
earlier phrasing invited the stronger reading. The net measure sorts the
extremes and is unreliable at the margin, which is where verdicts are
actually hard.

Also corrected: `railway-com` has been quoted repeatedly in this project as
7 slop / 6 craft / net +1. It is **8 slop / 6 craft / net +2**. The
bidirectional scroll walk added `scroll-reveal-blank: present` to it and
the figure was never updated in the retellings.

## How wrong would the rater have to be?

Flipping the rater's most novel and least certain calls on `deepmark` to
`absent`, in order of how new they are to the vocabulary:

| flipped | net | still slop-range? |
|---|---|---|
| `badge-pill-spam` | +5 | yes |
| + `stock-photo-generic` | +4 | yes |
| + `testimonial-card-row` | +3 | **no** |
| + `three-card-row` | +2 | no |

So the verdict survives the two most novel signal calls being wrong — the
two that had never fired in 31 prior files — and fails if three are wrong.

The adversarial bound: if every craft signal the rater marked `absent` on
`deepmark` were actually `present`, net goes to −1 and the verdict
collapses entirely. That is not a plausible error, but it is the honest
ceiling on how much this single reading can bear.

## Decision

The verdict stands and the rules ship. It is the strongest-netting file in
the corpus, it is not near the boundary, and it tolerates the two calls
most likely to be wrong.

What it does not have is a second reader. A blind re-rate was dispatched
and did not return. That remains outstanding work, not a resolved
question, and it is the first thing to finish in the next session:

- If a second reader returns `mixed`, the slop pool drops to 2, eligibility
  closes, and all ten rules must be withdrawn. The rules are generated from
  the evidence, so that is a mechanical revert, not a rewrite.
- The same circularity flagged in `vocabulary-v2` section 6 applies here
  in its sharpest form: one rater set 26 signals and then assigned a
  verdict informed by what they had just set.

Nothing published from these rules should claim more than "ten rules, from
32 studied sites, three of them rated slop, one of those by a single
unreviewed reader."
