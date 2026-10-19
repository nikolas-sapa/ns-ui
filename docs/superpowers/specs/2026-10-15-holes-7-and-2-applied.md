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
| `decent-com` | answers "Every option you can get, priced." with two of six rows `Not allowed` / `Too small`. **Dated:** as captured 2026-10-10. A redesign had removed the band by 2026-10-16; the example still shows the procedure correctly but no longer describes the live page |
| `capveon` | closes its queue `Four approved in one click each. One escalated.` |
| `silica` | its force chart authors its own joint reading as applied force plus Gaussian noise (`gauss()*.8`), so at the 2.0 g rest load its own sensor reads 0.3-3.8 g, under a heading claiming it can feel "as light as a paperclip". **Corrected:** this row first cited a fixed `2.0 g` vs `1.5 g` shortfall. The chart is simulated (`Math.random`) and that exact pair is one random frame, 6 of 150 samples. The noise is the designed, stable property, and it is what makes the entry |
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

**Net on `shows-deliverable`: 14/42 → 15/67 present** (13/42 before the
twenty-five `ai-builder` pages, of which only `correlation-studio` and `grepjob` read `present`). Five flips and one hold
in the six-file pass took it to 9; the hole-7 pass then added `resend-com`,
`github-2014`, `clerk-com` and `sona8`, the aviern re-study added `aviern`, and
the decent-com and sona8 re-studies removed `decent-com` and `sona8` (both
pages were redesigned), and the databuddy re-study added `databuddy` (its own
live demo shows `Bounce rate +37%` on the vendor's site). Each from its own
walk. The vercel-com re-study moved `real-product-surface` present → absent:
its captures are Notion's, Zapier's and Mintlify's products, not Vercel's.

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
`present` ones, so the re-pass set is the inverse of the one named. **25** files read `absent`
today, against 39 `present` and 3 `unresolved` (15/26/1 at n=42, before the twenty-five
`ai-builder` pages below; 20/21/1 when this was first written). Five have since moved absent → present under the new wording:
`papaya` and `the-subvocal-company` on fresh re-rates, `financial-datasets` and
`railway-com` on recorded facts (below), and `stripe-2014` in the fourteen-file
pass. **Every `absent` file has now been scored against the new wording** — the
pass is complete, and its results are in the next section.

**Cheapest first, reachable without a capture, and now DONE:**
`financial-datasets` and `railway-com` were both re-scored from fresh captures today, and their prose
already establishes the fact pattern in forensic detail — three independent
instruments confirming no raster UI exists, five product visuals in SVG with
live `<text>` and zero `<image>`. Those two are the rename's own evidence. Every
other `absent` file needs a capture.

## The fourteen-file surface pass: complete

Every file still reading `real-product-surface: absent` after the first four
flips was re-rated from a fresh capture, one agent per file, under one shared
brief. Each agent also asked the deliverable question on the same capture,
since capturing is the expensive part. Results:

- **13 of 14 hold `absent`** on the surface.
- **One flips, `stripe-2014`.** Two of the four hero slides are genuine
  screenshots of Stripe Checkout, checked against Stripe's own archived
  Checkout files from Nov 2014. The earlier rater saw only slide 3, which the
  page pins as the default.
- **Two more flipped and were reverted**, see "the studied page" below.
- **No deliverable value moved.** `capveon` and `silica` hold `present`; the
  rest hold `absent`.

Of the 13 that hold, three are **category facts**: an optical interconnect
(`dipole-labs`), RL training environments (`standard-machines`), and
pre-production robot joints (`silica`). The other ten have a showable product
and show none of it.

### Two rules this pass forced

**The doorway is not the surface.** `acyclic` shows four CLI commands, every
flag verified against the shipped binary, with no output and none of the
product's own screens. A command line, a sign-in form or an install snippet is
real and still fails, because the product has not answered yet. `stripe-2014`'s
Checkout form is the counter-case: it *is* the product, and passes with empty
fields. Now in the vocabulary.

**A re-pass re-interprets the page as studied.** Two agents flipped values on
pages redesigned since their `studied` date:
- `decent-com` had removed its priced-carrier band, taking `shows-deliverable`
  present → absent.
- `aviern` had gained a segmentation-overlay video, taking both signals absent
  → present.

Each flip left a file describing two pages: one signal on today's page, the
verdict and everything else on the studied one. **Both are reverted**, with the
agents' sections kept as dated drift records.

- **`decent-com`'s studied content still passes the new procedure** (`Not
  allowed` / `Too small`), so it returns to `present`.
- **`aviern`'s video is new since the study**:
  - the 2026-10-13 prose never mentions it;
  - that prose records a caption reading "A1000 imagery forthcoming";
  - ~~the 2026-10-08 archive snapshot has no `<video>`~~ — **withdrawn.** That
    came from grepping the raw HTML of a client-rendered page, which also lacks
    every visible string on it, so absence proved nothing. Rendered, the
    snapshot shows three videos on an earlier pipeline-inspection version of
    the site.

  So aviern returns to `absent`, on the first two points alone. Both re-studies
  have since landed: `decent-com` went `exemplar` → `mixed` (net −5 → +1) and
  `aviern` stays `mixed` (net −4) with both signals `present` on the live page.

A redesign triggers a **full re-study** instead. Both files are queued. aviern's
looks likely to take both signals to `present`: its new perception overlay
visibly misses a shrub.

### Pages that changed under their evidence

These need re-studying. No value in this pass rests on the stale parts, but
other signals in these files do:

| file | what changed | signals now resting on gone content |
|---|---|---|
| `decent-com` | redesign; deliverable band removed | the `exemplar` verdict, `testimonial-card-row`, `typewriter-headline`, `density-variation` |
| `aviern` | redesign; 9706 → 6947px, CGI hero, new video | `stock-photo-generic`, the `stock-photo` material |
| `standard-machines` | rebuilt; 1668 → 900px, canvas gone | `single-optical-anchor`, `density-variation`; change 5's page-extent row |
| ~~`acyclic`~~ | **not drift.** A 2026-10-13 full-page capture is pixel-identical to today's page; the old study rated the first viewport only and read the fold as the page's end. Re-studied 2026-10-16; the flips are old-rating errors | — |
| `provenmetal` | CTA labels changed | the `scroll-reveal-blank` paragraph names the old buttons |

### A sixth silent capture failure

**Content shown only during an intro or load-gated animation is never
captured.** The walker disables animations, which is right for stable tiles,
but it also hides anything that appears only while an animation runs:
- `anthropic-com`'s hero shows three painted images for about 2s, then hides
  them.
- `dropbox-2014`'s nine hero slides never started at all, because the archive's
  dead tracking pixels stopped the page's load event from firing.

Both turned out decorative. The next one may not, and neither the stitcher's
invariant nor the walk check can see it. When a hero visibly animates, read its
DOM for hidden media before rating.

### And a fix to the stitcher, from the other writer

The stitcher's height check was tied to `walkHeight`, the height *before* the
walk. A page that grows during the walk therefore stitched short and still
reported `0 mismatches`. `anthropic-com` did exactly that: 3340 before, 3346
after. It now stitches to the settled height and prints the drift. That was my
bug; the fix was made in the other session's working tree and verified here on
`anthropic-com`.

## The hole-7 pass and the five re-studies: complete

**Hole 7 (16 files, `shows-deliverable` only).** 12 hold `absent`; **4 flip to
`present`**, each on an entry the earlier study could not have seen:

| file | the entry | why it was missed |
|---|---|---|
| `resend-com` | `Bounced` … `to melia@gmail.com with type Spam`, under "reach humans instead of spam folders" | page-authored panel on the page's own canvas: the exact hole-7 case |
| `github-2014` | a staff commit titled `Sorry VB users` in GitHub's own `octokit.net` history | the client screenshot had not loaded in the capture |
| `clerk-com` | a Directory Sync row `Okta - HospitalB` / `Error` | two non-default tabs deep |
| `sona8` | the product's own dashboard: "1 of 1 conversations did not reach" its brief | inside a click-to-play video. **Unverified and superseded:** its rendered size was never checked against the legibility rule, and the 2026-10-18 re-study of the redesigned page rates `absent` |

`sona8` and `databuddy` are now redesigned; both are queued for a full
re-study. The current databuddy page would pass on a `TypeError` in its own
pricing code, shown by its own error tracker.

**Five re-studies, merged with the old study kept below each:**

| file | verdict | net | cause |
|---|---|---|---|
| `decent-com` | exemplar → **mixed** | −5 → +1 | redesign removed its deliverable |
| `provenmetal` | exemplar → **mixed** | −6 → −3 | **rater disagreement, not the page**; contested, needs a third blind rating |
| `acyclic` | mixed | +2 → +1 | **not a redesign**: a 2026-10-13 full-page capture is pixel-identical to today's; the old study rated the first viewport only |
| `aviern` | mixed | −1 → −4 | redesign; both artefact signals now `present` on a perception overlay that misses a shrub |
| `standard-machines` | mixed | −3 → −1 | rebuilt to one viewport |

Exemplars drop from 16 to 14. Slop stays at 2; both anchors were re-checked
and unchanged. Still 0 rules.

**Two rules the pass sharpened, now in the vocabulary.** An unflattering
entry counts when it is the product's own operation or unscrubbed output and
not the capability the panel is selling (`stripe-com`'s dispute rows are
excluded because its callouts sell dispute handling; `clerk-com`'s sync error
counts though Okta may be at fault, as `railway-com`'s probe counted though
Railway did not send it). And legibility is judged at page size:
`basecamp-2014`'s "only 8 of about 40 attendees actually showed up" is a real
concession set at about 4 CSS px, and does not count.

**Withdrawn: the aviern ruling's archive evidence.** It grepped the raw HTML of
a client-rendered page; rendered, the 2026-10-08 snapshot does carry video.

**Capture.** Four more instances of animation- or load-gated content the walker
froze blank. `stitch.py` now warns on a uniform band of 600px or more, which
catches the two large ones (squarespace-2014, mailchimp-2014) and, measured
across all 40 captures, nothing else. It cannot catch the short ones, and says
so. `shoot-tiles.cjs` takes `NS_LOAD_MS` for slow archive heroes. All seven
archive sources are now pinned to exact snapshots.

**Vocabulary gaps this pass surfaced, not decided:** `symmetric-everything` has
no procedure (text alignment and mass placement disagree on standard-machines);
`real-product-surface` is undefined for hardware (footage cannot prove
autonomy); whether an embarrassing entry must be noticeable at normal viewing
(aviern's 37px shrub); whether text inside the vendor's own marketing film is in
scope (two decent-com calls hang on it); `glass-card-overuse` counts
declarations, not visible frost.

## Three more re-studies, 2026-10-18

| file | verdict | net | cause |
|---|---|---|---|
| `sona8` | mixed | −5 → 0 | redesign; 35 text nodes gated behind scroll against 0 for the dwell control |
| `databuddy` | mixed | +1 → +1 | redesign; its hero is five live iframes of the real app, showing `Bounce rate +37%` on the vendor's own site |
| `vercel-com` | exemplar → **mixed** | → −4 | the hero and the bento changed; the page shows no Vercel product UI, and all four substance craft signals are absent |

Corpus: **13 exemplar / 27 mixed / 2 slop**. provenmetal is settled `mixed`,
2–1, by a third blind rater.

**A fourth silent capture failure, now caught.** On databuddy, smooth scrolling
plus the page's own scroll lock stalled one tile at y3907 instead of y4200.
That is a single short landing, so the walker's two-in-a-row abort never fired.
The stitcher then pasted the tile at its expected y: content repeated, and the
total height still matched. The walker now forces instant scroll and writes
every landing to `walk.json`. The stitcher refuses any tile that landed more
than 8px short, and a forged short landing turns it red. Captures written before
this change carry no landings and cannot be checked retroactively.

## The slop hunt, 2026-10-18: the gate opens, on a selected sample

The rule gate needs three `slop` files; the corpus had two (`heroku-2014`,
`openhack`). YC cohorts yield about one in twenty-five, so the population
changed: sites makers launched from AI site builders, harvested from the
builders' own showcase galleries (madewithlovable.com, madewithbolt.com). A
new cohort, `ai-builder`, records the sampling source. It is not a verdict.

**Screen, then blind raters.** About forty candidates were ranked by a cheap
mechanical triage (glass panels, gradient CTA, indigo accent, gradient text,
generic sans, pills, emoji, blur blob, centred hero, three-card row), which
scored `openhack` 5 and `linear`/`anthropic`/`provenmetal` 0. The top five each
went to two independent blind raters who never saw the screen scores. Signals
were merged agree → value, split → `unresolved`.

| file | verdict | raters' nets | agreed-only net | splits |
|---|---|---|---|---|
| `permit-guide-ai` | slop | +6 / +6 | +6 | 2 |
| `zingy-cannoli` | slop | +12 / +7 | +10 | 5 |
| `prilo-ai` | slop | +6 / +6 | +6 | 2 |
| `vizleads` | mixed | +4 / +2 | +3 | 2 |
| `referable-dev` | mixed | +3 / +2 | +3 | 3 |

Every pair agreed on the verdict; `vizleads` rater A reached +4 and still said
`mixed`, having no separation argument against the +3 files. All three `slop` files clear `heroku-2014`
(+5) on agreed values alone. Corpus: **13 exemplar / 29 mixed / 5 slop**.

**The gate opened: 13 signals are rule-eligible**, eight slop and five craft.
`scripts/build-antislop.ts` exits non-zero while any eligible signal has no
rule, so this evidence cannot merge until each is authored or held back.

**The defect: five of the eight slop signals were selection criteria.**
`gradient-blob`, `three-card-row`, `glass-card-overuse`,
`generic-sans-default` and `indigo-violet-accent` are what the screen ranked
on, and the three new files supply most of the slop pool for each. Selecting
on a signal and then measuring that signal in the selection is circular: the
present-rate is high partly because the screen put it there. The raters being
blind to the screen does not fix this; it is the sample, not the rating, that
was chosen on the signal. `asymmetric-split` inherits a weaker version through
the screen's centred-hero term. `symmetric-everything`,
`testimonial-card-row` and `stock-photo-generic` were not screened, but the
first has no procedure (the same defect that holds back
`single-optical-anchor`).

What would clear it: three or more `slop` files found **without** the screen,
for example a random draw from the same galleries rated blind, re-measuring the
five screened signals on that sample alone.

### The random draw: one more slop file, and what survives the clean pool

Eight more gallery sites, drawn with seed 20261018 from the thirty that were
not screen-selected, calibration sites, unreachable, blank or behind a sign-in,
two blind raters each. Every pair agreed on the verdict, on 24 to 26 of 26
signals. **One `slop`: `toppic`** (+8 / +6). Seven `mixed`: `dachly`,
`glowcase`, `luna-vos`, `toolsapp-work`, `correlation-studio`, `puzzlesbox`,
`sakura-name-sparkle`. Six of the seven are not landing pages at all: the root
URL serves the product (a dashboard, a Sudoku, a name generator), which every
rater flagged as a scope case the vocabulary has no clause for. Each file now
opens with a **Sampling:** line naming its route. Corpus: **13 exemplar /
36 mixed / 6 slop**.

The clean pool is the three `slop` files no screen chose: `heroku-2014`,
`openhack`, `toppic`. Re-running eligibility on the corpus minus the five
screen-selected files:

| signal | screened on | full corpus | clean pool |
|---|---|---|---|
| `gradient-blob` | yes | eligible | **thin** (slop n=2) |
| `three-card-row` | yes | eligible | **thin** (slop n=2) |
| `glass-card-overuse` | yes | eligible | eligible, gap 0.33 |
| `generic-sans-default` | yes | eligible | eligible, gap 0.44 |
| `indigo-violet-accent` | yes | eligible | eligible, gap 0.33 |
| `symmetric-everything` | no | eligible | eligible, gap 1.00 |
| `testimonial-card-row` | no | eligible | thin (slop n=2) |
| `stock-photo-generic` | no | eligible | eligible, gap 0.33 |
| five craft signals | no | eligible | eligible |

For the two screened signals that fail on the clean pool, the full-corpus
eligibility rests on the selection. `testimonial-card-row` was not screened,
so its full-corpus pass is not circular; it is only thinner without the
screened files. Three passes sit at 0.33, one file from the 0.30 floor.


### Ten rules authored, three held back

Every rule is `soft`: the slop pool is three to six files, and several gaps sit
one file above the floor. Each rule's evidence list is the pool its claim is
about, so the generated count reads as that claim:

- **avoid**, screened signals (`glass-card-overuse`, `generic-sans-default`,
  `indigo-violet-accent`): the three slop files no screen chose. A screen-picked
  file cannot vouch for the signal it was picked on.
- **avoid**, unscreened (`testimonial-card-row`, `stock-photo-generic`): all
  six slop files.
- **prefer** (`asymmetric-split`, `type-scale-high-contrast`,
  `editorial-grid-break`, `density-variation`, `one-accent-discipline`): the
  thirteen exemplar files. Bodies state the slop and control contrast in words,
  never as a number the build cannot re-check.

Held back in `RULE_INELIGIBLE`, each with its removal condition:
`gradient-blob` and `three-card-row` (eligible only through the
screen-selected files) and `symmetric-everything` (no procedure; raters
measured it two incompatible ways and split on `toolsapp-work`).

Holding `gradient-blob` and `three-card-row` turned 19 gate tests red: their
fixtures used those two names as stand-in signals. The stand-ins are now
`gradient-fill-cta` and `typewriter-headline`, with a note that a stand-in must
never be a held signal. Both guards were seen red: removing a rule fails the
build naming the signal, and so does dropping a hold-back.

### `symmetric-everything` gets a procedure, and openhack leaves the slop pool

The signal was held for having no procedure. The corpus had in fact applied
one, "alignment counts" on section headings (edotenv, tsenta, deepmark,
standard-machines), without writing it down. It is now written down in
`lib/antislop-vocab.ts` and run by `scripts/antislop/symmetry.cjs`: the share of
h1/h2 section headings that are centred, `present` at 0.85 or more. It is
page-wide by definition, because a centred hero alone is `centered-hero-stack`.

Run over all 55 pages, it agrees with every agreed rating but three, all set
before any procedure existed:

| file | was | measured | now |
|---|---|---|---|
| `openhack` | present | 1/12 text-align, 2/12 axis | absent; net +4 → +3, **slop → mixed** |
| `heroku-2014` | present | 3/4 text-align, 1/4 axis | absent; net +5 → +4, stays slop at the floor |
| `deepmark` | present | 2/13 | absent; a data fix, its #75 note already said so |
| `toolsapp-work` | unresolved | 0/9 | absent |

Two probe defects were found and fixed on the way: `<header>` was excluded as
chrome, which hid heroku-2014's hero and mirrored panels, and a consent
dialog's heading counted as a section. The two measures, computed alignment
and axis position, agree on 15 of the 16 contested pages compared.

**Consequence for the rules.** With openhack `mixed`, only two slop files were
not screen-selected (heroku-2014, toppic). The three rules counted over that
pool (`glass-card-overuse`, `generic-sans-default`, `indigo-violet-accent`)
fall under the three-file minimum and are withdrawn into `RULE_INELIGIBLE`,
two hours after they shipped. `symmetric-everything` is unscreened and
separates on the full corpus (3/5 slop, 0/13 exemplar, 0/7 control), so it
gets a rule. **Eight rules now:** avoid `symmetric-everything`,
`testimonial-card-row`, `stock-photo-generic`; prefer the five craft signals.
Corpus: **13 exemplar / 37 mixed / 5 slop.**

What reopens the three: one more slop file found without the screen.

### The second random draw: two more slop files, and the five holds lift

Twelve more gallery sites, drawn with seed 20261019 from the twenty-two left
(`gunsvzombies` returned 404, project deleted, and was replaced from the same
seed by `openmark`), two blind raters each. **Two `slop`:
`coupleshub` (+7 / +8) and `freesubtitlemaker` (+6 / +5).** Nine `mixed`.
`pitpicks` split on the verdict (A `exemplar`, B `mixed`, both at −3); a third
blind rater said `mixed`, so it is settled 2–1 as provenmetal was, with each
signal taking the value two of three raters gave (`merge-three.py`).
Corpus: **13 exemplar / 47 mixed / 7 slop.**

**Process defects found and fixed during the draw:**
- The brief gave both raters on a page one probe folder (`s5work/<slug>/`).
  On four pages a rater ran or read the other's measurement script or raw DOM
  output. No rater opened another's draft, and each re-measured what it used;
  `coupleshub` and `freesubtitlemaker` record it in a note. The brief now gives
  each rater `s5work/<slug>-<rater>/`.
- Two raters stopped before writing a usable draft (`siamferry` A wrote
  nothing; `freesubtitlemaker` A wrote front-matter only). Both were re-run.
  The idempotency check would have stopped the second re-run on its own stub,
  so the stub was moved aside first.
- `merge-pair.py` took the union of both raters' `materials`, so one rater's
  provenance token survived on `thecurryclub`, where `shows-deliverable` split
  to `unresolved`. The provenance test caught it; both merge scripts now drop
  provenance tokens unless the deliverable is settled `present`.

**The holds lift.** The unscreened slop pool is now four: `heroku-2014`,
`toppic`, `coupleshub`, `freesubtitlemaker`. All five screened signals separate
on it alone (`gradient-blob` 3/3 settled, `three-card-row` 3/3, both at the
three-file minimum because one file each split), so all five leave
`RULE_INELIGIBLE` and get rules counted over that pool. `single-optical-anchor`
remains the only hold. **Thirteen rules**, all soft: avoid `gradient-blob`,
`three-card-row`, `glass-card-overuse`, `generic-sans-default`,
`indigo-violet-accent`, `symmetric-everything`, `testimonial-card-row`,
`stock-photo-generic`; prefer the five craft signals.

**Vocabulary gaps raised by this draw's raters** (recorded, not acted on):
`generic-sans-default` and `custom-type-pairing` both fire on an Inter body
under a chosen display face; a declared font that never loads (four pages) is
scored by what renders, which no definition states; `real-product-surface` has
no test for a page-built replica of a login-gated app; `hero-mockup-float` does
not say whether "hero" is a position; `stock-photo-generic` does not say
whether generated imagery or abstract video counts.

### `single-optical-anchor`: a procedure tried, and the hold stays

The last held signal was tried the way `symmetric-everything` was released:
write the procedure the corpus already used once, run it on every page, compare.
provenmetal's third rater had written one down: first viewport only, each mass
weighed by luminance ink (sum over its box of |Y − median background|), a mass
dominates at 2x the next. `scripts/antislop/anchor.cjs` runs it; it reproduces
that rater's hand numbers on provenmetal exactly (H1 2382, second heading 2238)
and its `absent`.

Run on all 67 pages, with the 2x cut fixed before the run, it **does not
reproduce the ratings**. On the 40 pages where it finds two or more masses it
agrees with the settled rated value on 16 of 38 (42%), under chance. On 23 more
it finds a single mass, which "dominates because it is alone", the caveat
raters kept writing; calling those `present` agrees on 9 of 17 settled, about
chance. Four pages gave no measurable mass. Separately, blind raters
split on this signal on **8 of the 25 two-rater pages**, the most of any signal
(`density-variation` is next at 7).

So neither the eye nor this instrument gives a reproducible value, and
re-scoring 30-odd pages to match an unvalidated script would replace one
unchecked set of values with another. The hold stays, its reason now carries
these numbers, and no evidence value moved. What would release it: a definition
that two blind raters reproduce on a fresh sample before any re-pass.

**A flag on a live rule.** `density-variation` backs a `prefer` rule (12/13
exemplars) but raters split on it on 7 of 25 pages. Its exemplar values were
mostly set by one rater each. Worth a two-rater spot check of the exemplars
before trusting that rule's count.

