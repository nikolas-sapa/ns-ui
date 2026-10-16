# Holes 7 and 2 — applied, with the consequence measured

Date: 2026-10-15
Applies: `2026-10-15-change-3-addendum.md` holes 7 (medium) and 2 (axis), with
hole 1's refusal test folded in because hole 2's wording cannot be stated
without it. Hole 3 closes as a side effect and needed no clause of its own.
Status: **the definition is applied. Six applied signal values were
contradicted or doubtful under it, and all six have since been re-rated from
fresh captures**: five `shows-deliverable` flips to `absent`, one confirmed
`present` on a different artefact than the one it was scored on. The list is
at the bottom.

Both clauses landed in `lib/antislop-vocab.ts` above `CRAFT_SIGNALS`, beside
change 1's procedure and change 4's scope rule, because that comment block is
what a rater actually reads. The v3 spec is a dated decision record and was
left alone.

---

## Hole 7 — applied as written

The clause is the addendum's, unchanged in substance: the deliverable may be
shown **as product chrome, as a captured artefact, or as a page-authored
rendering of the product's output**, and what disqualifies is unreadable or
placeholder content, not the authoring medium.

Two things were added to it.

**The change-4 inversion is blocked explicitly**, because that was the half of
hole 7 that could undo the fix rather than merely leave a gap. The vocabulary
now states that change 4's scope rule — marketing signals are not scored off
content inside an embedded product surface — does **not** license the converse,
"only product chrome counts for the deliverable." A rater generalising change 4
by instinct reaches that inversion, and `tsenta` is the page where it costs the
answer: its strongest content is page-authored HTML under a marketing eyebrow,
probed `inClone: false`, so the instinct scores it absent and lands on v3's
wrong answer by the opposite route.

**Hole 3's collapse hazard closes from the same side.** The test is content that
could count against the vendor, so a well-populated UI shot earns nothing for
being well populated. That is the discriminator finding 3 said had to be stated
or raters would split on pages of that shape; it did not need its own clause
once hole 2 was written. One fewer open hole than the addendum lists.

## Hole 2 — the axis, and the word that nearly took hole 8 with it

Adopted `railway-com`'s test as the axis: **whose work does the artefact show,
and does its content carry anything that could count against the vendor?** All
three v3 examples pass it, which makes it a unification of the two readings
rather than a choice between them.

**But "can a reader audit it" did not survive contact with raters, and that is
the finding of the session.** Thirteen independent auditors applied the test to
the applied `present` scores, one per file, from each file's own recorded prose.
**Three of thirteen read "audit" as "trace the content to a real
measurement"** — and on that reading seeded or self-labelled demo data fails on
provenance. That is **hole 8** (sourced vs fabricated content), a separate axis
that has not had its pass, and the test as worded was quietly annexing it.

`railway-com`'s own ruling forecloses the provenance reading, which is why the
wording is a fix rather than a retreat: the split-flap board was verified
**genuinely live** — a runtime fetch returning `totalDeploymentsLastMonth:
209533282`, ticking against a read fifteen minutes earlier — and is still
`absent`, because "precision and liveness are properties of the rendering, not
of the content's relation to the reader." Maximum provenance, no credit. So
provenance neither earns this signal nor forfeits it, and the vocabulary now
says so in those terms. **Seeded or self-labelled example content is scored on
what it says:** a demo that shows the product declining, costing or failing
passes; a demo where every value is the flattering one does not, and it fails
on stance, not on being a demo.

Three auditors reached for provenance unprompted. A fourth went the other way
and said the quiet part out loud about a file that passes — *"the vendor
controlled which figures appear but not whether they are correct ... Chosen is
not the same as free."* That is hole 8's distinction arriving from the pass
side, and it is further reason to keep the two axes apart until hole 8 is
worked rather than letting this signal absorb it by accident.

### The procedure, which is the part that discriminates

Finding 0 of the v4 proposal: a signal with a stated measurement procedure gets
measured, one without gets asserted. So hole 2 shipped with one.

> **Name the entry that could have embarrassed the vendor.** If a rater cannot
> point at one in the scored content, the signal is absent.

Across the thirteen audits this separated the corpus cleanly, and the "whose
work" clause separated exactly one file on its own. **The refusal is the
load-bearing half of railway's sentence.** Every file that holds has a nameable
entry; every file that does not hold is missing one — found from thirteen
directions without coordination:

| holds, entry named | the entry |
|---|---|
| `grep-ai` | `This evaluation used a Claude agent baseline, not Codex. Savings vary by workload.` under its own 91% claim; a competitor ticked at parity; its own `56.27/100` |
| `financial-datasets` | publishes its worse past accuracy (`96.10`) on a 95-100% axis, beside a live sec.gov `filing_url` |
| `neuron-industries` | `Certifications: UL + CE (planned)` kept on the flagship column rather than omitted |
| `decent-com` | answers "Every option you can get, priced." with two of six rows `Not allowed` / `Too small` |
| `capveon` | closes its queue `Four approved in one click each. One escalated.` |
| `silica` | applied force `2.0 g` against its own joint measurement `1.5 g` — a 25% shortfall on the number it most benefits from showing exact |
| `railway-com` | its own error log carrying a WordPress scanner probing a non-WordPress app |

Hole 1's refusal test had to come along, because "a priced comparison with real
refusals" is half of hole 2's conflation and is undefined without it. A refusal
counts when it **narrows a claim the page would benefit from leaving broad**.
It bit immediately, against the file that supplied the example: on
`neuron-industries`, `Motion: EtherCAT only` and `Soft real-time` are both
capabilities withheld from the cheap tier that push a buyer toward the
expensive one — structurally "Enterprise only", a differentiator wearing a
refusal's clothes — and that file's own correction notes the two-up's Motion row
reads plain `EtherCAT`, with the "only" living in a different table. Strike both
and the score still stands on the certification row, but on a thinner margin
than the file's enumeration implies.

---

## The 16 untouched files: a standalone re-pass after all

Hole 7 genuinely changes what a rater looks at on those files — it redirects
attention from the product chrome to the page's own canvas — so the question was
live rather than rhetorical. Three measurements settled it.

**1. The "no prose cue" claim is true, and is now measured rather than
asserted.** Across all 16 files, occurrences of the word *deliverable* outside
the signal key itself: **zero**. Not thin, zero. A hole-7 re-pass there is
sixteen fresh ratings from fresh captures, which is the shape of work that cost
session 3 eleven rules.

**2. The 16 are NOT inside hole 6's re-pass set, and this paragraph first said
they were.** It reasoned that all 16 carry the surface signal `present`, and
that hole 6 must re-pass every file carrying the signal, so one capture would
answer both questions. The premise was the addendum's scope, and that scope was
wrong: a widening definition endangers the `absent` files, not the `present`
ones, so hole 6's real re-pass set is the **18** files at `absent`. All 16 here
read `present`. **The two sets are disjoint**, and the fold this paragraph
recommended would have re-captured sixteen pages hole 6 has no reason to
revisit while leaving the hole-7 question unasked on all of them.

What survives is the sizing: 16 pages, zero prose cues, so a fresh rating on
each. They need their own pass, asking only `shows-deliverable` under holes 7
and 2. Hole 6's 18 pages get the mirror: the surface question, plus the
deliverable question folded in, since hole 7 can move an `absent` deliverable on
any page and the capture is the expensive part.

**3. Two of the 16 describe artefact content, and are not cheaper than the
rest after all.** Scanning for described artefact content rather than for the
word:
`cursor-com` records readable `+135/-21` diff counts and a model picker listing
named models inside a real product capture, and `github-2014` records "real
commit history and a real diff with green and red". Both are **change 3** cases
— a readable artefact inside product chrome — not hole 7 cases, so change 3
alone already reaches them and neither needs the new clause. They fell outside
the original seven only because that set was defined as files whose prose
*argues the signal* rather than files whose prose *describes the content*.
An earlier draft of this paragraph called them "corrections available without a
capture". **That was true under change 3 alone and is false under the procedure
this document applies.** Change 3 asks only whether a readable artefact is
shown, and the prose answers that. Hole 2 asks for the entry that could have
embarrassed the vendor, and `+135/-21` names none: a diff count is the product's
output on a job, but nothing in either file says whether any line of it could
have come out against Cursor or GitHub. Answering that means reading the page,
which makes both of them rating acts like the other 14. They ride along with
hole 6's capture on the same terms, with one advantage: their raters know where
to look.

## What was contradicted: all six re-rated, five flipped

The narrowing half of hole 2 can invalidate an applied `present`, so all
fourteen were audited against it from their own recorded prose. Seven do not
come through clean, and one of those resolves. **Three were then re-rated from
fresh captures and flipped to `absent`; the other three are left exactly as they
were.**

| file | audit | why | scored |
|---|---|---|---|
| `modal-com` | **FAILS** | no error row, no 4xx, no timeout, no cold-start figure anywhere in the scored content; `GPU Utilization 94%` is the top of a bounded range. The page's own "Fast container scheduling and startup" card illustrates a timing claim with an abstract isometric cube — "the one place a cold-start number is the obvious deliverable, and there is none" | session 4, today |
| `sentient-os` | **FAILS** → flipped | "every card is a win in an invented scenario with a named cast, and nothing on the page shows the product declining, failing or costing." Its `Example` badge is honesty about provenance, which is hole 8's axis, not a refusal | session 4, today |
| `truemile` | **FAILS** → flipped | the artefact is four capability stage labels radiating into the vendor's own brand tile; its only quantity is "plans run through a billion possible scenarios", which can only flatter by being larger. The file's justification answers the *old* axis ("what it produces rather than its UI") and never reaches the new one | pre-change-3 |
| `papaya` | TENSION | commissioned illustration whose three metric chips (`Latency -20%`, `Cost -22%`, `Quality +7%`) all point the vendor's way, with no baseline or identified run. Right subject, no entry that could embarrass | pre-change-3 |
| `browserbase-com` | TENSION → flipped | the two artefacts the file nominates are described by the file itself as drawn vignettes; the run ledger admits only `Done` and `Uploading`, with no `Failed` row. The video trace has the right subject but terminates at `flights.example.com/booking`, a reserved placeholder domain, under the file's own unsubstantiated word "real" | pre-change-3 |
| `the-subvocal-company` | TENSION | three destination panels with no measurement, error, latency or confidence value and no refusal; the single quantity, "200+ words per minute", is a rounded floor that can only flatter by being larger | pre-change-3 |
| `tsenta` | resolves to **holds** | its auditor's split was explicitly provenance ("no external ground truth"), which the provenance carve-out removes. On stance it has `line-through` refusals at 18-31% against a 58% top match, and its rater audited the content and found three blemishes, so it is falsifiable as written | session 4, today |

**Two of the three FAILS are files an independent rater scored `present` from a
fresh capture hours ago**, and the convergence is not a coincidence: finding 3
of the addendum already wrote the steelman for `modal-com` absent, and finding 4
already recorded that its strongest measured content is the least stood-behind.
This audit reached the same place from the definition instead of from the page.
That is the best available evidence the wording is right, and the worst possible
reason to act on it unilaterally.

The rule the three flips respected: a flip is a rating act, not a correction, so
each one was earned with its own fresh walk rather than by applying the prose
audit. Two of the three found content the prose had missed, and flipped anyway.

**Three have since been re-rated from fresh captures and all three flipped to
`absent`.** The flips are rating acts backed by their own walks, not the prose
audit being applied:

- **`truemile`** — fresh walk, 11 tiles, `clamped: false`, `coverage: 1`, docH
  7244 stable, footer reached. The auditor's predicted gap was real: the prose
  had quoted one of four hero node bodies, and the page carries a stronger
  below-the-fold artefact the viewport-only pass never saw (`div.work-surface`
  at y2660, a semantic `<ol>` of a driver-callout response). It still fails, and
  now on measured grounds: a whole-document sweep for limits, costs, failures
  and refusals returns three hits, two of them an exception the product then
  handles cleanly. `Approval before execution` is stated four times in the
  page's own voice as a selling point, which is hole 1's "Enterprise only" case.
- **`browserbase-com`** — re-captured, 11 tiles, `coverage: 1.0`, docH 7426
  (104px taller than session 4; nothing structural moved). The three task-trace
  videos were pulled from the CDN and read frame by frame, which found
  substantially *more* real content than the prose recorded — real
  Skyscanner/Expedia/Kayak URLs, an Alaska Airlines table, a `$635` deal — so
  the flip is on stance, not on thin content. The arc runs query → `Found 4
  flights` → clean markdown → `Trip booked!`, with the one quantified
  comparison going the product's way. No `Failed` row anywhere.
- **`sentient-os`** — fresh walk, 22 tiles, `coverage: 1`, docH 14803 stable. A
  text sweep of all 14803px with the deck dwelled through 14 cycles returns
  **zero** matches for fail, error, denied, unable, cannot, retry, timeout,
  declined, blocked, insufficient, unavailable, quota or incorrect. A reported
  failed tool call in `job-application-demo.mp4` was checked by stepping the
  clip at 16 points and reading every status bar: seven MCP calls, every one
  `started` or `completed`, no failure state in any frame — the pill carries a
  red-magenta gradient that reads as an error at a glance. The run also
  succeeds, completing the form with the résumé attached.

**The remaining three were re-rated on 2026-10-16, one rater per file, each
reusing an unclamped full-coverage walk.** Two flipped and one held, and the
one that held shows the procedure working in the direction a flip-bias would
hide:

- **`modal-com`: `shows-deliverable` present → absent**, overturning a
  session-4 independent rater on the stance test that rater did not have. A
  whole-page search for errors, failed states, latency or cold-start numbers,
  costs, quotas, losing comparison rows and status links found none near the
  scored row; the page states the opposite of a limit ("without quotas or
  reservations"). Decisive detail: Modal's own audit-log docs define a `status`
  field ("Whether the action succeeded or failed"), and the homepage table
  drops exactly that column. The audit rows (`13:54:49`, then `13:54:32` ×3)
  are static across loads. `real-product-surface` stays `present`: a faithful
  HTML/SVG rebuild whose columns match the documented audit fields.
- **`papaya`: `shows-deliverable` present → absent; `real-product-surface`
  absent → present.** All 30 hero deltas and every Papaya-effect figure flatter
  (down to `Cost −6%`); every bad number on the page (`Failing 42%`, `18 gave
  up`, `+8.2s latency`) is the demo customer's agent failing, which is the
  thing Papaya sells catching. The seven `.webp` panels were settled against
  the live product's own bundle (`/app/assets/index-BfPfe5X4.js`), which
  carries the same components, labels and a `PhiAirwaysExample` demo dataset:
  faithful renders of the real product with demo data, cropped and lightly
  edited, so `present` under change 3b.
- **`the-subvocal-company`: `shows-deliverable` holds `present`, on a new
  artefact; `real-product-surface` absent → present.** The prose audit was
  right that the destination panels carry nothing that could embarrass. The
  91.8s lab video does: from 57.5s the prototype's own screen reads "I can
  talk primately and nobody can listen", and the editors left it in, stamped a
  monkey and "**PRIVATELY" over it, and kept the wrong line on screen through
  the READY state. A misrecognition shipped on purpose is the procedure's
  embarrassing entry in its plainest form. The same video is a genuine camera
  capture of the prototype's software on a real laptop, so "no UI exists" no
  longer holds (a lab app, not the shipping interface; recorded in the file).

**Net on `shows-deliverable`: 14/42 → 9/42 present.** Five flips, one hold,
each from its own walk.

## One data-quality note, free

Two files quote the same artefact inconsistently across two passes. `capveon`
has it as a "four-column table" and as a "two-column queue", and its escalation
count — the single strongest piece of against-interest content on that page — is
attested in only one of the two quotations. `silica` quotes its legend at
`Motor-current estimate 22 g` while describing the chart as "visibly noisy
around 50g". Neither moves a signal. Both mean a later pass cannot treat these
files' quoted values as a stable source.

Full per-file audits, including each auditor's strongest argument against its
own verdict: `~/scratch/antislop/hole2-audit/`.

## Change 3b applied: `real-product-screenshot` → `real-product-surface`

Hole 6, applied as a rename plus a guard, with **no value moved**. The old name
keyed the signal to a FORMAT when the thing worth recording is GENUINENESS: it
credited a captured UI while `hero-mockup-float` penalised a fake one, leaving
REAL BUT UNCAPTURED with no slot. New wording:

    satisfied by a genuine capture OR a faithful live rebuild of the real
    product; failed by a stylised or invented UI.

Touched: `lib/antislop-vocab.ts`, all 42 evidence front-matters, two new tests
(84 total, both proven failable: renaming the key back on one file turns 4 tests
red, and flipping one file's value reds the distribution invariant below).
Prose bodies keep the old name where a rater used it — that records what they
scored against at the time, same as change 3's handling.

**A scope gap the hole as written does not cover.** The addendum scopes the
re-pass to "the 23 files carrying the signal". But the two motivating cases,
`financial-datasets` and `railway-com`, read **`absent`** when this was
written — that is the defect, and both are now `present` (below). A widening definition puts every `absent` file at risk, not the
`present` ones, so the re-pass set is the inverse of the one named. **16** files read `absent`
today, against 25 `present` and 1 `unresolved` (20/21/1 when this was first
written). Four have since moved absent → present under the new wording:
`papaya` and `the-subvocal-company` on fresh re-rates, then `financial-datasets`
and `railway-com` on recorded facts (below). Of the 16, `browserbase-com` and
`truemile` were re-rated under the new wording and held `absent`, so **14 remain
unscored against it**. Scoring them is a rating act, not a correction, and it
is the single largest remaining item in this program.

**Cheapest first, reachable without a capture, and now DONE:**
`financial-datasets` and `railway-com` were both re-scored from fresh captures today, and their prose
already establishes the fact pattern in forensic detail — three independent
instruments confirming no raster UI exists, five product visuals in SVG with
live `<text>` and zero `<image>`. Those two are the rename's own evidence. Every
other `absent` file needs a capture.
