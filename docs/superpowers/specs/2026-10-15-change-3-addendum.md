# v4 change 3 addendum — what seven independent raters found in the definition

Date: 2026-10-15
Follows: `2026-10-14-vocabulary-v4-proposal.md` change 3, applied in
`cde24c02` (mechanism) and `04ca89d9` (five re-scores).
Status: **findings, not decisions.** Nothing here is applied.

Change 3 dropped the exclusivity between `real-product-screenshot` and
`shows-deliverable` and renamed the latter. Seven raters then re-scored the
affected files, one per file, each capturing fresh. **`shows-deliverable` went
from 7/42 to 12/42 present** — the starvation the proposal predicted, measured.

The change was right. It also exposed six holes in what remains, each found
independently and each with a file that makes it concrete. They are listed in
the order a rater is likely to hit them.

---

## 1. "Real refusals" is load-bearing and undefined

The v3 example is "a priced comparison **with real refusals**." The refusal
clause is doing the work of separating a deliverable from a pricing grid, and
nothing defines it.

`neuron-industries`'s rater supplied the test they actually used: **does the
refusal cost the vendor something?** On that page it does — `Certifications: UL
+ CE (planned)` sits on *both* columns with the flagship included and the row
kept rather than omitted; `Motion: EtherCAT only` names what the cheap SKU
lacks; CPU/GPU/NPU are identical across both columns rather than inflated.

Without that test the signal fires on any three-column pricing grid, because
"Enterprise only" is a differentiator wearing a refusal's clothes.

**Proposed wording:** a refusal counts when it narrows a claim the page would
benefit from leaving broad. `grep-ai` is the second instance — Google's cost
cell left `Unconfirmed / Preview pricing incomplete` rather than filled in, and
all six vendors ticked on `Managed execution`, competitors included.

## 2. The definition still conflates two axes — the same defect change 3 fixed

`neuron-industries`'s rater again, and this is the sharpest of the six. The
v3 examples are not the same kind of thing:

- "a priced comparison with real refusals" is **vendor commercial substance**
- "a force-vs-time chart" is **the artefact the product produces**

A SaaS page with an honest pricing table and no output artefacts is `present`
on the first reading and `absent` on the second. `neuron-industries` satisfies
both, so it *hides* the split rather than exposing it — which is exactly how
the screenshot/deliverable conflation survived to n=42.

**This should be settled before any further re-pass**, because the 16 untouched
files of the 23 will be scored against whichever reading the next rater infers.

## 3. The collapse hazard, stated as a steelman

`modal-com`'s rater argued the opposite case against their own verdict, which
is the most useful thing in this addendum.

The honest steelman for `absent` on that page: the section captions
("Out-of-the-box observability", "Security and compliance for enterprise
teams") make the cards' referent a *console capability*, so the numbers are set
dressing populating a UI shot. **And if well-populated numbers score present,
nearly any competent product screenshot does — re-merging the two signals from
the other direction.**

What defeated it for that rater was that the test is on content, not on the
caption's framing, and those values clear the "no readable values" bar
decisively. But the discriminator has to be *stated* or raters will split on
pages of this shape, and a split on this signal is what cost session 3 eleven
rules.

## 4. A measured claim in prose is not a deliverable — say so

`modal-com` carries three grades of measured content, and the ranking is
perverse:

| grade | example | is it an artefact? | how strongly asserted? |
|---|---|---|---|
| rendered seeded telemetry | `Containers 108`, `GPU Utilization 94%` | **yes** | **weakest** — every actor is `@example.com` |
| illustration with plausible figures | `TRAFFIC → PROD 220 ms / CANDIDATE 140 ms` | no | middle |
| prose claim in a quote | "Modal served 1 trillion tokens for Jev within three days of launch" | no | **strongest** |

The signal as written correctly scores only the first. But it scores the
*least* stood-behind of the three, and nothing stops a rater counting the
testimonial. **Write the exclusion in.**

## 5. No rule for a self-disclosed composed deliverable

`neuron-industries` carries the vocabulary's *third* worked example — a
force/temp-vs-time curve with an `80.0 °C threshold` line and a timestamped
assertion log ending `RESULT · PASS  3 assertions · 512 cycles simulated`. Its
rater **discounted it**, because the page captions it itself at y≈6232:
`ILLUSTRATION: EACH BEHAVIOR BECOMES ONE ISOLATED, TIMED TEST`.

That was the right call and the vocabulary does not license it. Immaterial on
that page, which had a better candidate. Decisive on a page whose only
candidate is captioned that way.

Note this cuts *against* the signal in one direction and *for* honesty in
another: the caption is the page being truthful. A rule that scores a
self-disclosed illustration `absent` is penalising the disclosure. Probably the
right answer is `absent` for the signal plus a note, but it needs deciding
rather than inferring.

## 6. Change 3b — `real-product-screenshot` is keyed to format, not genuineness

Two raters reached this independently, and the count is now **four instances**,
not the one the proposal's table lists.

`financial-datasets` reads `absent` post-fix, which scans as "did not show its
real product" — when it showed its real product *harder* than a screenshot can:
interactive, selectable, accessible, theme-aware, and structurally incapable of
being a stale or doctored capture. Three instruments confirmed no UI screenshot
exists on it (network log: 5 image responses of 59, four logos; DOM walk: zero
canvas, video, iframe, CSS `url()`, `data:` URIs; inline-SVG census: 37 glyphs,
largest 20x20, none containing `<text>`).

`grep-ai` holds `present` only on the same convention `clerk-com` holds it on —
zero raster product screenshots, every surface a DOM/SVG rebuild — and more
weakly than clerk, which mounts its live component where grep's panels are
page-authored replicas, one populated with placeholders (`Acme Holdings`,
`Cedar Technologies`, `Northstar Trading`).

**The asymmetry left behind:** `hero-mockup-float` penalises a **fake** UI,
`real-product-screenshot` credits a **captured** UI, and nothing covers **real
but uncaptured**.

**Proposed:** `real-product-surface` — satisfied by either a genuine capture or
a faithful live rebuild, failed by a stylised or invented UI. Scores
`financial-datasets` correctly and still catches the slop case the signal was
built for, a glassy fake dashboard floating in a hero.

---

## Two observations outside the six

`sentient-os`'s rater could not separate **a de-identified real output from
designer-written copy in output format**, and neither can the definition. On
that page both land `present`. What decided it was that the page *labels its own
sample* — an `Example` badge in the title bar, a footer reading `5 example
files · Personal details omitted` — so nothing is passed off as a capture. That
labelling test is better than anything currently written down and is adjacent
to hole 5.

`grep-ai`'s rater noted the deferred `dashboard-instead-of-deliverable` would
score cleanly `absent` on that page, which argues it is a real discriminator
rather than a restatement of `shows-deliverable`. Weak evidence for
un-deferring it, on one file.

---

## Recommended order

1. **Hole 2** (which axis the signal is on) — everything else is downstream of
   it, and the 16 untouched files will be scored against whichever reading the
   next rater infers.
2. **Holes 1, 3, 4** — one sentence each into the notes column. Cheap, and each
   prevents a specific rater split that has already nearly happened.
3. **Hole 6** (`real-product-surface`) — a rename plus a re-pass on the 23
   files carrying `real-product-screenshot`. Its own change, now with four
   supporting files.
4. **Hole 5** — needs a decision, not a measurement. Lowest urgency; no file
   currently turns on it.

## Still outstanding from the re-score

`railway-com` and `tsenta` were dispatched and had not reported when this was
written. `railway-com` is the precedent file for whether live platform
telemetry counts as a deliverable — a split-flap board showing real aggregate
throughput — and that question is a sub-case of hole 2.
