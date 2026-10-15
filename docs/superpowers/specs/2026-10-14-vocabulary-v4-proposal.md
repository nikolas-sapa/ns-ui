# Vocabulary v4 — proposed changes, with the corpus evidence for each

Date: 2026-10-14
Status: **proposed, not applied.** No signal value in any of the 42 evidence
files was changed by this document.
Follows: `2026-10-14-session-4-handoff.md` (13 gaps, 10 new files)
Supersedes the open items in: `2026-10-11-vocabulary-v4-candidates.md`

Session 3 authored eleven rules and withdrew all eleven. The cause was a
verdict resting on an unmeasured signal. This document exists so the next
rule-authoring pass is not the same event with a larger n, and it is a
proposal rather than an edit because changing the vocabulary reinterprets
every file already rated against it.

---

## Finding 0 — the one that reframes the rest

**A signal with a stated measurement procedure gets measured. A signal
without one gets asserted.** Proportion of files scoring a signal `present`
that discuss it in the prose body at all:

| signal | present | discussed | | has a stated procedure? |
|---|---|---|---|---|
| `scroll-reveal-blank` | 13 | 13 | **100%** | yes — walk vs dwell control |
| `indigo-violet-accent` | 11 | 9 | **81%** | yes — hue buckets |
| `three-card-row` | 11 | 6 | 54% | partly — "literally three" |
| `generic-sans-default` | 11 | 6 | 54% | no |
| `asymmetric-split` | 33 | 16 | 48% | no |
| `single-optical-anchor` | 25 | 11 | 44% | **no definition at all** |
| `custom-type-pairing` | 16 | 7 | 44% | no |
| `one-accent-discipline` | 33 | 13 | 39% | partly — zero-accent ruling |
| `generic-line-icon-set` | 9 | 3 | 33% | partly |
| `centered-hero-stack` | 13 | 4 | 30% | no |
| `type-scale-high-contrast` | 25 | 6 | 24% | **no threshold, no altitude** |
| `hero-mockup-float` | 13 | 3 | 23% | no |
| `density-variation` | 34 | 6 | **18%** | no |
| `gradient-blob` | 7 | 1 | **14%** | no |

**Caveat, stated because it limits the claim:** naming the signal in prose
is a proxy. A rater can back `centered-hero-stack` by writing "a centred
stack on one axis" without typing the slug, and several did. So the absolute
percentages understate justification and should not be quoted as
"X% unbacked."

What survives the caveat is the **correlation**, and it is what matters: the
two signals carrying an explicit procedure sit at 81-100%; the signals
carrying nothing cluster at 14-33%. The remedy for every known-soft in the
list is therefore the same shape, and it is not "write a definition" — it is
**attach a procedure a second rater can re-run.**

`density-variation` is the most load-bearing instance. It is the
highest-frequency signal in the vocabulary at 34/42 present, it is on the
craft side of every net, and 18% of its presents name it.

---

## Change 1 — `type-scale-high-contrast` gets a measured procedure

**Status: APPLIED as a procedure and a necessary threshold, with zero value
changes.** It took three attempts and two reversals to get here; the route
matters more than the number.

### Final form, in `lib/antislop-vocab.ts`

```
ratio = largest text node containing at least one letter, nominal font-size,
        divided by getComputedStyle(document.body).fontSize

below 3.75:1  ->  ABSENT      (necessary, not sufficient)
```

### How the denominator was settled, after getting it wrong twice

The first cut, 3.3:1, came from the 21 files whose prose states a ratio. It
validated at 18/21 on the held-out 21 and looked clean — then agreed on only
14/21 of the files it was *derived from*, which is backwards. Cause: the
corpus's stated ratios do not share a denominator. Raters variously used body
computed size, the adjacent hero subhead, and the smallest body run, a spread
reaching 1.6x on one page (`sentient-os`, 2.46 stated vs 4.05 against body).

Every derivation disagreement was the same shape — scored `absent` while
measuring above the cut against body — and `railway-com` states why outright:
*"54/20 = 2.7:1 against the hero subhead, 3.4:1 against 16px body ... so
`type-scale-high-contrast` is absent."* The rater had both numbers and scored
the subhead. So the subhead looked like the corpus convention.

It is not. Run head to head over all 42:

| denominator | best cut | misclassified |
|---|---|---|
| body computed `font-size` | **3.75:1** | **5 / 42 (88% agree)** |
| adjacent hero subhead | 3.33:1 | 8 / 41 (80% agree) |

Body wins, and at 3.4 against body `railway-com` itself falls below the cut
and agrees. One rater's stated framing was not the corpus's behaviour.

### The display term

"At least one letter." Requiring two words was the first attempt: it correctly
excluded grep.ai's `$ 2.89` and `78.6` — price and stat figures setting a 4.0
ratio on a page whose headline is smaller — but also rejected
`anthropic-com`'s `Haiku 5.5`, which IS the headline, dropping it to a false
1.2:1. One letter separates a figure from a headline; two words does not.

### Why nothing was re-scored

**Five files sit at exactly 3.75:1** — `databuddy`, `decent-com` and
`nxtcure-labs` scored `present`; `deepmark` and `neuron-industries` scored
`absent`. Identical measured ratio, opposite calls. Something other than the
ratio decided those five, so the threshold rules *out* rather than ruling in,
and the remaining five disagreements (`cursor-com` 4.5, `sentient-os` 4.05,
`deepmark` 3.75, `neuron-industries` 3.75, `mailchimp-2014` 2.5) are left
standing. Flipping them would substitute arithmetic for judgment that cannot
be interrogated from the prose.

The threshold's value is forward-looking: the next rating is reproducible.

### One earlier warning in this document was wrong

It said applying the cut "could shrink the slop pool from 2 to 1." It cannot.
`eligibility()` pools on the `verdict` field (`e.verdict === "slop"`), not on
the net — the net is an analysis construct and the build never reads it. A
signal flip changes that signal's present-rate *within* a pool, which is a far
smaller and more appropriate consequence.

## Change 2 — `single-optical-anchor` is rule-ineligible until defined

It is the only v3 signal with an empty notes cell. It is scored `present` on
**25 of 42 files**, 44% of which discuss it. It came in at 8/10 in session 4
against 40% in the prior `yc-current` cohort, a +38-point swing consistent
with being marked present by default. **And it is in the eligible-11** — the
set that becomes rule-backing the moment a third slop file lands.

**Proposed: mark it explicitly rule-ineligible, with the reason attached,
until it has both a definition and a re-pass.** The eligibility block already
supports a signal that counts and records but emits nothing; this is that
case, and the v3 build check requires the disqualifying evidence be stated.

A definition is deliberately **not** proposed here. Writing one now would
retroactively validate or invalidate 25 existing scores made without it, by
an author who cannot re-rate 42 pages in the same breath. Authoring the
definition and re-passing the corpus against it is one task, and it belongs
to whoever does the re-pass.

What the re-pass should resolve, from how the signal was actually applied:
the `standard-machines` rater observed it fires near-automatically on a page
with one graphic and one text block — so any candidate definition has to
state whether "one mass dominates because there is only one mass" counts.

---

## Change 3 — the screenshot / deliverable axis

**Status: the mechanism is APPLIED. The affected values are being re-scored
by independent raters and land separately.**

### What was wrong

The two signals were declared mutually exclusive "by construction, not by
defect." They are not mutually exclusive, because **they are not defined over
the same axis**: `real-product-screenshot` is defined on a *capture medium*
and `artifact-not-dashboard` on *content*.

Four files break it in four directions:

| file | what it ships | old scoring | problem |
|---|---|---|---|
| `financial-datasets` | **no screenshot at all** — every surface a live DOM rebuild, rendering a literal `Metric / Type / Period / Value / Citation` ledger | screenshot present, deliverable absent | the letter of both definitions gives the reverse |
| `neuron-industries` | a priced comparison with real refusals — $2,950 vs $6,450, 1000 vs 4000 Hz, `UL + CE (planned)` — the vocabulary's **own worked example** | deliverable absent | suppressed because the page also ships 9 IDE screenshots |
| `dipole-labs` | nothing — no die shot, loss curve, latency figure or port count, on a page claiming to beat "the physical limits of silicon" | both absent | identical scoring to a page floating a fake dashboard |
| `the-subvocal-company` | eyewear; there is no UI to screenshot | screenshot absent | reads as a deficiency when it is a category fact |

### What was applied

- **`artifact-not-dashboard` is renamed `shows-deliverable`.** The old name
  encoded the exclusivity in the name — "not a dashboard" is a claim about
  the other signal. The new name names only its own content.
- **The exclusivity is dropped.** It lived in exactly one place, a test in
  `scripts/test-antislop-corpus.ts`, now replaced by a test that guards the
  rename instead of the constraint. Verified it can fail: reintroducing the
  old name on one file fails 3 of 82 tests.
- All 42 files carry the new key.

The scoring rule is now: **score the medium and the content independently. A
page that shows both scores both.** A deliverable rendered inside app chrome
still counts — the chrome is the medium, which `real-product-screenshot`
already records, and the content is what `shows-deliverable` scores. A UI that
merely *implies* a deliverable without showing one is `absent`.

Note this does not cancel the global product-surface scope rule from change
4. That rule stops *marketing* signals being scored off product chrome. It
does not mean a deliverable shown inside product chrome cannot count.

### What is NOT applied: `dashboard-instead-of-deliverable`

The `neuron-industries` rater proposed a matching slop signal — the page shows
its own UI *in place of* what the product produces. It is the real
discriminator and it is deferred, because a new signal unscored on 42 files is
a dead signal, which the build correctly flags. It wants its own pass.

### Scope of the re-score, and why it is not all 42

23 of 42 files score `real-product-screenshot: present` with the deliverable
`absent`. Re-scoring all 23 means re-reading 23 pages. **7 of them have prose
that explicitly argues a deliverable IS shown** — written by a rater who was
forced to score `absent` and said so: `financial-datasets`, `grep-ai`,
`modal-com`, `neuron-industries`, `railway-com`, `sentient-os`, `tsenta`.
Those 7 are being re-scored by independent raters from the page, one per file.

**The remaining 16 are unverified under the new semantics and are left
standing.** They carry no prose cue either way, so a re-score would be a fresh
rating rather than a correction, and inventing one from an old screenshot is
how session 3 lost eleven rules. Named here so the gap is visible rather than
implied: `basecamp-2014`, `clerk-com`, `cursor-com`, `databuddy`,
`github-2014`, `heroku-2014`, `linear-app`, `mailchimp-2014`, `melty-gg`,
`neomatter`, `openhack`, `resend-com`, `sona8`, `squarespace-2014`,
`stripe-com`, `vercel-com`.

## Change 4 — the product-screenshot scope rule becomes global

Cheap, prevents real errors, changes no existing value.

The rule "excludes pills inside an embedded product screenshot" is attached
only to `badge-pill-spam`. The `tsenta` rater had to extend it by analogy to
three more signals in one sitting: `three-card-row` (a 4-up of job-match
cards inside a dashboard clone), `emoji-as-icon` (7 Inter checks used as
diff markers) and `one-accent-discipline` (pastel card fills, status
colours, iOS blue). Session 4's own brief got the `tsenta` card row wrong
until a strip was opened.

**Proposed: state once, at the top of the signal tables — marketing chrome
is the unit of analysis. Content inside an embedded product surface is not
scored, for any signal.** `railway-com` already set the precedent twice
(U+2713 in JetBrains Mono log lines; the six-series chart palette inside the
Observability capture).

---

## Change 5 — record a denominator

Two raters proposed this independently, from opposite sides of the same hole.

Three pages are under 3100px and score 0–2 slop signals because most
sections do not exist: `dipole-labs` 1528, `standard-machines` 1668,
`osseus` 2654. The net flatters them. Quantified rather than asserted:
`dipole-labs` is **13 signals declined by decision against 3 absent by
vacancy**; `standard-machines` is **at least 9 of 16 with no section in which
they could fire**.

The craft side has the mirror, which is the more important half — the
`standard-machines` rater's finding: `single-optical-anchor` and
`density-variation` are near-automatic on a page with one graphic and one
text block, so **the craft signals stop discriminating at exactly the surface
area where the slop signals stop discriminating.** A 0/16 one-screen page and
a 12000px page refusing every gradient, pill, glass surface and scroll gate
across forty sections score identically, and the second is far stronger
evidence.

**Proposed: `materials` gains `page-extent: <px>` and `section-count: <n>`.**
In `materials` deliberately, per the `dipole-labs` rater, so it stays
non-stance-bearing and no rule can be written against it. The eligibility
thresholds can then normalise a present-rate by surface area instead of
treating a thin page as a restrained one.

**Status: data measured for all 42, not applied — two blockers, one of them
a schema decision that is not mine to make silently.**

Page extent is now measured for every file at 1440x900, with the
inner-scroller probe in front of it, in
`~/scratch/antislop/page-extents.json`. Range **1203px** (`mailchimp-2014`)
to **17890px** (`grep-ai`), median ~7200. The thin tail that motivated the
change: `dipole-labs` 1528, `standard-machines` 1668, `stripe-2014` 1385,
`mailchimp-2014` 1203.

**Blocker 1 — `materials` is a flat string list.** It cannot carry
`page-extent: 1528` without becoming a map, which is an `Evidence` schema
change plus a validator and test change. The alternative is a string entry
like `page-extent-1528`, which is parseable but is the kind of thing that
reads as data smuggled into a vocabulary. Either way it is a structural
decision about the evidence format, not an additive field, so it is proposed
rather than done.

**Blocker 2 — `section-count` has no definition.** "What is a section" is a
judgment call, and an undefined count is exactly the failure change 2 holds
`single-optical-anchor` back for. Page extent is unambiguous and sufficient
for normalising a present-rate; recommend shipping only that and dropping
`section-count` until something needs it.

Two measurement notes for whoever applies it. `grep-ai` reads **900px**
without the inner-scroller probe and **17890px** with it — a 20x error, and
the single strongest argument for putting the probe in front of any
measurement that touches page height. And `tsenta` measured 9326 during the
session-4 walk and 9548 two hours later: these pages change under you, so the
field wants the capture date beside it, which `studied` already supplies.

---

## Change 6 — split `generic-sans-default`

Known-soft #6 understates it: it conflates **three** pages, not two, in the
`edotenv` rater's formulation — ships no webfont, ships a deliberate neutral
grotesque, and reaches for the era's default sans unthinkingly.

Two files make it concrete, and both would be convicted by a rule emitted
from the signal as it stands:

- `edotenv` authors an exact per-size tracking table: −8.50% at 139.2px
  through +10.00% on the mono, all exact percentages, monotonic. That is
  precisely what `railway-com` was scored `present` for *lacking* ("no
  per-size tracking table... the 16px body runs at `letter-spacing:
  normal`").
- `the-subvocal-company` runs Inter at −0.045em on both display sizes, where
  railway's Inter body ran at `normal`.

**Proposed: the same split the vocabulary already gave
`dark-mode-afterthought` — face identity and tracking discipline are two
different facts.** Keep the slop signal on unconsidered face choice; move
tracking discipline to the craft side where it can be measured off the
ladder.

---

## Change 7 — `CONTEXTS` is too narrow

All ten session-4 drafts invented values and the build rejected every one.
Sixteen section names had no slot: `about, benchmarks, datasets, demo-video,
faq, mission, offer, platforms, problem, product, research, scenes,
security, specs, stats, team`.

Only clear equivalences were mapped (`proof` / `social-proof` / `logo-wall`
→ `testimonials`, `blog` → `blog-index`, `api-playground` → `docs`); the
rest were dropped rather than reinterpreted. Record:
`~/scratch/antislop/context-normalisation.json`.

**Proposed: add `faq` (4 pages), `team` (3), `stats`, `security`,
`integrations`.** Low risk — `context` backs no rule and no threshold reads
it.

---

## Not proposed, and why

- **A signal for a typeface pile.** `sentient-os` loads 14 faces / 7
  families but its ladder is a strict two-voice split (Cabinet ≥26px with
  nothing below, Satoshi ≤27px with nothing above, different tracking
  rules); four of the other five appear only inside simulated Gmail/Finder
  chrome. The honest reading is that `custom-type-pairing` is *correct*
  here and the face count is noise. The discriminating evidence is the size
  ladder, not the face list — which is a note on the signal, not a new one.
- **A signal for a duplicated section.** Session 4 asserted one and it was
  a stitcher artifact. One real instance is needed before a slot is cut.
- **`type-sited-in-image`.** Now at three supporting files (`capveon`,
  `osseus`, `financial-datasets`) and load-bearing on `osseus`, where
  `stock-photo-generic` fires on trigger (a) while trigger (b) is not merely
  absent but inverted. Still a candidate rather than a proposal: it wants
  the same thing as everything above — a procedure — and nobody has written
  one.
- **A home for the no-JS text deficit.** Three files now: `railway-com` 53%
  JS-only, `financial-datasets` 60%, `the-subvocal-company` **100% — no-JS
  yields 0 characters and a 900px `scrollHeight`.** Distinct from
  `scroll-reveal-blank`, whose definition correctly exonerates all three.
  This is a robustness defect rather than a template tell, and it may belong
  somewhere other than the signal vocabulary entirely.

---

## Suggested order

**Applied** (commit `3a04ce51`), none of which changed a signal value:
change 2 (hold `single-optical-anchor` back from backing a rule), change 4
(global product-surface scope rule), change 7 (five new contexts, with the
raters' own values restored where now expressible).

**Attempted and returned as proposals**, because both turned out to need a
decision rather than a measurement — which is the useful finding from the
attempt:

- **Change 1** needs the measurement procedure decided first: the
  denominator and the display term. Measured consistently, 7 derivation
  files move, and the cut would flip `openhack` from +4 to +3 and shrink the
  slop pool from 2 to 1.
- **Change 5** needs a schema decision: `materials` is a flat string list
  and cannot carry a number. Data is measured for all 42 regardless.

**Remaining, in cost order:**

1. **Change 6** (split `generic-sans-default`) — a re-pass on 11 files.
2. **Change 3** (screenshot/artifact onto one axis) — a re-pass on all 42,
   touching 23 and 7 present values. Worth its own session.

**Before any rule is authored from any gate**, change 2 must be in place —
it is the specific failure session 3 already paid for once. It is.
