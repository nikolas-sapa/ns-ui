# v4 change 3 addendum — what the independent raters found in the definition

Date: 2026-10-15
Follows: `2026-10-14-vocabulary-v4-proposal.md` change 3, applied in
`cde24c02` (mechanism) and `04ca89d9` (five re-scores).
Status: **findings, not decisions.** Nothing here was applied when written.
**Holes 7, 2 and 1 are now applied, and hole 3 closed as a side effect, in
`2026-10-15-holes-7-and-2-applied.md`.** That document also measures what
the new wording contradicts: six applied `present` values. Three have since
been re-rated from fresh captures and flipped to `absent` (`truemile`,
`browserbase-com`, `sentient-os`); three remain open. The other findings stand
as written.

Change 3 dropped the exclusivity between `real-product-screenshot` and
`shows-deliverable` and renamed the latter. Seven raters then re-scored the
affected files, one per file, each capturing fresh. **`shows-deliverable` went
from 7/42 to 12/42 present** — the starvation the proposal predicted, measured.

The change was right. It also exposed six holes in what remains, each found
independently and each with a file that makes it concrete. They are listed in
the order a rater is likely to hit them. Hole 7 arrived last and is the one
most likely to undo the fix.

---

## 1. "Real refusals" is load-bearing and undefined

> **APPLIED** with hole 2, which cannot be stated without it. It bit the file
> that supplied the example: two of `neuron-industries`'s four refusals are
> capabilities withheld from the cheap tier, i.e. "Enterprise only" in
> disguise.

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

> **APPLIED** in `2026-10-15-holes-7-and-2-applied.md`, as
> railway-com's test plus a procedure: *name the entry that could have
> embarrassed the vendor.* Thirteen auditors showed the refusal clause does
> essentially all the discriminating and "whose work" separates one file alone.
> "Audit" had to be disambiguated — three of thirteen read it as provenance,
> which silently annexes hole 8.

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

> **CLOSED** by hole 2's wording, with no clause of its own. The test is content
> that could count against the vendor, so a well-populated UI shot earns nothing
> for being well populated. Note the consequence for this very file: audited
> against the applied wording, `modal-com` FAILS, and this steelman is why.

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

> **RENAME APPLIED** in `2026-10-15-holes-7-and-2-applied.md`:
> `real-product-screenshot` → `real-product-surface` across the vocabulary, all
> 42 evidence files and a new guard test (83 tests, proven failable). **No value
> moved with the rename** — the re-pass that sets values against the new wording
> is separate, as change 3's rename preceded its re-score. Note a scope gap the
> hole as written does not cover: the motivating cases (`financial-datasets`,
> `railway-com`) read **`absent`** when this was written, so a re-pass limited
> to the files carrying the signal (22 then: 21 `present` + 1 `unresolved`;
> the "23" below predates change 3's re-scores) would miss them. **20** files
> read `absent` then, and those are the ones a widened definition endangers.
> The widened definition puts every `absent` file at risk of being wrong, not
> just the ones holding it.
>
> **These counts are as of 2026-10-15 and are a record, not a live figure.**
> Both motivating cases are now `present` and the set has been re-passed.
> Current numbers live in `2026-10-15-holes-7-and-2-applied.md`, which a corpus
> test now holds to the evidence files. Called out because a present-tense
> count in a dated document reads as live fact — the same failure this
> addendum already records once, for `grep-ai`.

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

## 7. The definition names two positions and pages occupy a third — and this one interacts with change 4

> **APPLIED** in `2026-10-15-holes-7-and-2-applied.md`, as the
> proposed clause plus an explicit block on the change-4 inversion. The 16
> untouched files need **a standalone re-pass**: zero of them mention the word
> *deliverable*, so each is a fresh rating. An earlier version of this note
> folded them into hole 6's capture as "a strict subset of hole 6's re-pass
> set"; that held only under this addendum's original scope (the `present`
> files). Hole 6's real set is the 18 `absent` files, and all 16 read
> `present`, so the sets are disjoint.

Found by `tsenta`'s rater, reported last, and it is the hole most likely to
undo the fix.

The definition covers the deliverable **as product chrome** and, via the hard
case, **the deliverable inside chrome**. `tsenta`'s strongest content is
neither. Its scored shortlist — `Senior Frontend Engineer · Stripe` **92%**
kept against `React Developer (intern)` **31%**, `Lead .NET Engineer` **18%**
and `Java Backend, on-site Pune` **24%** struck through with genuine CSS
`line-through`, each refusal explained by its own row content — is a
**page-authored HTML panel under a marketing eyebrow**. Containment was probed
directly: `inClone: false` on all of it. Not a screenshot of a running app, not
an exported file.

Under the current wording a rater can reasonably call that "just a marketing
graphic" and score `absent` — **landing on v3's wrong answer by the opposite
route.**

And it is worse than a gap, because it collides with change 4. That change
globalised the rule that *marketing* signals are not scored off content inside
an embedded product surface. Read carelessly alongside this definition, the
same instinct starts **withholding deliverable credit from anything that is
not in product chrome** — the exact inversion. One rule says "product chrome
doesn't count for marketing signals"; a rater generalising it concludes "only
product chrome counts for the deliverable signal."

**Proposed clause, from that rater:** the deliverable may be shown as product
chrome, as a captured artefact, **or as a page-authored rendering of the
product's output**. What disqualifies is unreadable or placeholder content, not
the authoring medium.

That phrasing also resolves hole 3's collapse hazard from the other side: the
test is readable, falsifiable content, and the authoring medium is irrelevant
in both directions.

**Smaller, recorded not proposed:** `tsenta` shows the deliverable six distinct
ways and the signal is binary, so the corpus cannot distinguish it from a page
with one readable chart. Not a reason to hold anything.

## 8. The missing axis: is the deliverable's content sourced or fabricated?

> **PROPOSAL WRITTEN**: `2026-10-16-hole-8-provenance-proposal.md`. It splits
> this into three sub-questions (origin, external anchor, disclosure), proposes
> recording them as `materials` rather than as a signal, and puts a five-test
> plan ahead of any procedure. It is blocked on the same `materials`-shape
> decision as change 5. Nothing is applied.

Recorded by `railway-com`, for the second time by that file, and it is the one
hole change 3 *created* rather than exposed.

Splitting medium from content is right. But Railway's deliverable — an error-log
table whose decisive row is
`Error: No route matches URL "//test/wp-includes/wlwmanifest.xml"`, a WordPress
scanner probing a non-WordPress app — is **rendered in vector, not captured**.
All five of that page's product visuals are SVG with live `<text>` and zero
`<image>` elements.

So a page could hand-draw a convincing artefact, score `shows-deliverable:
present`, and have `real-product-screenshot` correctly record that nothing was
captured — and **the two axes would read as contradicting each other rather
than as the precise finding they are.**

The rater's belief that Railway's content is real rests on a single telling
detail: nobody invents a `wlwmanifest.xml` probe for a mockup. That is a sound
inference and **the vocabulary gives no way to record it.** The same page
recorded the same shape of gap the first time it was studied.

**The missing axis is sourced versus fabricated content.** Note it is not the
same as hole 6: hole 6 asks whether the *medium* was captured or rebuilt; this
asks whether the *content* came from somewhere real. `tsenta` shows why both
are needed — its rater found the content coherent across four surfaces spanning
4,300px and *still* caught three fabrication tells (a miscounted word claim, a
transposed score order, a clock-seeded log), none of which any current signal
can hold.

## 9. Precedent set: a vendor-aggregate counter is not a deliverable

Not a hole, a ruling, recorded here because it is cohort-wide precedent and was
the hardest call in the batch.

`railway-com`'s split-flap board was **verified genuinely live** — a runtime
fetch to `backboard.railway.com/graphql/internal?q=publicStats` returning
`totalDeploymentsLastMonth: 209533282`, with field names matching the subhead's
cumulative-versus-windowed split and values ticking against a read 15 minutes
earlier. It clears the live-telemetry bar and is **still `absent`.**

The discriminating test, which is the most useful thing to come out of this
pass: **whose work does the artefact show, and can a reader audit it against
the vendor's interest?** All three v3 exemplars pass — a priced comparison with
real refusals contains content against the vendor; a claims ledger enumerates
assertions so each can be checked; a force-vs-time chart is one unit of the
product doing its job. Every row of Railway's board can only flatter by being
larger, no entry can embarrass, and the 209 million deployments are things
Railway's *customers* did.

The counter nearly wins and is on record: unit-digit precision and liveness make
`209,533,282` falsifiable in a way `218.7M+` is not. But those are properties of
the **rendering**, not of the content's relation to the reader.

**Otherwise every odometer scores `present` and the signal collapses into "has a
nice number"** — useless for re-sorting the 23 files. This test is a strong
candidate for the hole-2 wording.

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

~~0. **Hole 7**~~ — **DONE.** ~~1. **Hole 2**~~ — **DONE.** ~~Holes 1, 3~~ —
**DONE** (1 applied with 2; 3 closed by it). Hole 4 was already applied.
See `2026-10-15-holes-7-and-2-applied.md`.

**0. Re-rate the three files that wording still contradicts** — `modal-com`,
   `papaya`, `the-subvocal-company`, one file per rater from a fresh capture.
   `truemile`, `browserbase-com` and `sentient-os` are done: all three flipped
   to `absent` on their own walks. `modal-com` carries `real-product-surface:
   present` and sits inside hole 6's set; the other two are standalone.
3. **Hole 6** (`real-product-surface`) — now **urgent rather than optional**.
   Two files read `real-product-screenshot: absent` while plainly showing their
   product (`financial-datasets` rebuilt live, `railway-com` drawn in vector),
   and two more (`clerk-com` and `grep-ai`) hold `present` only on the
   convention. A rename plus a re-pass on the files carrying the signal.

   > **CORRECTED 2026-10-16.** This item originally read "Three files read
   > `absent` ... `grep-ai` page-authored replicas ... and a fourth,
   > `clerk-com`, holds `present`." That is wrong on the split and it
   > propagated into the `real-product-surface` block in
   > `lib/antislop-vocab.ts`, where a rater reads it. `grep-ai` reads
   > `present` at every commit from its origin (`0d196ebe`) through HEAD, and
   > its own prose records it: "`real-product-screenshot` stays `present`,
   > flagged ... a **fourth** instance". It belongs with `clerk-com` in the
   > convention group. The affected-file count (4) was right; the grouping was
   > not. Both the vocab block and this item are now corrected, and a corpus
   > test asserts the four named files' values against their front-matters so
   > the claim cannot drift again. No signal value moved — this is a prose
   > correction, not a re-score.
4. **Hole 8** (sourced vs fabricated content) — the one change 3 created. Needs
   a new axis, not a reworded one.
4. **Hole 5** — needs a decision, not a measurement. Lowest urgency; no file
   currently turns on it.

## The re-score is complete

**All seven reported. `shows-deliverable` went 7/42 → 14/42 present.**

`railway-com` landed last and scored `present` on its **error-log table**, not
on the split-flap board it was dispatched to adjudicate — see finding 9 for the
board ruling. It also forced one orchestrator call: its
`real-product-screenshot` flips to `absent` for consistency with
`financial-datasets`, flipped on the same fact pattern in the same pass. Both
pages *show* their product UI and neither *captures* it, and v3's wording is
"shown as a real screenshot". Applying the letter to one file and not the other
would be arbitrary.

`tsenta` reported `present` and is applied. Its file had
**contradicted itself** — concluding the page "shows no deliverable", then
later describing the résumé-diff panels and quoting their green `+` lines. The
rater had the deliverable in hand and wrote it down. That is the cleanest
evidence in the corpus that the v3 construction rule was producing the
conclusion rather than the page.
