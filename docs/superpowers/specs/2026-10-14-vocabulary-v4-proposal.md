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

## Change 1 — `type-scale-high-contrast` gets a derived threshold

**Proposed: present iff display ≥ 3.3× computed body, measured at nominal
`font-size`, largest display node against the body `font-size`.**

Not invented. Every ratio stated in the corpus prose, paired with the value
the file scored, taking the figure the rater cites for *this* signal:

```
present (n=12): 3.00 3.36 3.90 3.96 4.09 4.50 4.50 4.50 5.00 5.90 6.50 8.70
absent  (n=9):  2.20 2.23 2.46 2.70 2.75 2.92 3.00 3.10 3.26
```

- Highest `absent`: **3.26** (`neuron-industries`)
- Lowest `present` that is the page's own figure: **3.36**
  (`the-subvocal-company`)
- **No file scored `absent` cites a ratio at or above 3.36.** One-sided
  clean.

A cut at 3.3 sits in the 3.26–3.36 gap and misclassifies **1 of 21**:
`mailchimp-2014` at "near 3:1", scored `present` explicitly as "the highest
in this cohort" — a within-cohort comparison, not an absolute reading. Keep
it as a documented exception or re-score it; either is defensible, and the
file says which basis it used.

**Altitude.** Nominal `font-size`, not cap-height. The `edotenv` rater
established why this is safe: cap-height and nominal only diverge when
display and body use different faces, and where they do, the corpus states
both. Nominal is reproducible from the computed ladder without a font
metrics table.

**Impact on the 42 files:** 21 files state a ratio and 20 are consistent
with the cut. 21 files state none and are unverified against it — they need
a ladder re-read, which is cheap (`measure2.cjs`) and does not require
re-capture.

---

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

## Change 3 — split the screenshot / artifact pair onto one axis

The sharpest gap in the batch, found independently by three raters. The two
signals were declared mutually exclusive "by construction, not by defect."
They are not mutually exclusive, because **they are not defined over the same
axis**: `real-product-screenshot` is defined on a *capture medium* and
`artifact-not-dashboard` on *content*.

Four files break it in four different directions:

| file | what it ships | current scoring | problem |
|---|---|---|---|
| `financial-datasets` | **no screenshot at all** — every surface is a live DOM rebuild, rendering a literal `Metric / Type / Period / Value / Citation` ledger | screenshot present, artifact absent | the letter of both definitions gives the reverse |
| `neuron-industries` | a priced comparison with real refusals — $2,950 vs $6,450, 1000 vs 4000 Hz, `UL + CE (planned)` — which is the vocabulary's **own worked example** | artifact absent | suppressed because the page also ships 9 IDE screenshots |
| `dipole-labs` | nothing — no die shot, loss curve, latency figure or port count, on a page claiming to beat "the physical limits of silicon" | both absent | identical scoring to a page floating a fake dashboard |
| `the-subvocal-company` | eyewear; there is no UI to screenshot | screenshot absent | reads as a deficiency when it is a category fact |

**Proposed, from the `neuron-industries` rater:** two signals over one axis.

- `shows-deliverable` (craft) — the page shows the thing the product
  produces. Scoreable independently; no exclusivity.
- `dashboard-instead-of-deliverable` (slop) — the page shows its own UI
  *in place of* what the product produces. The actual discriminator, and the
  thing the spec meant by calling `artifact-not-dashboard` its strongest
  signal.

Plus a `materials` entry, not a signal, for "no UI exists" (hardware,
eyewear, a dataset) so a category fact stops reading as a failure.

**Impact: this is the expensive one.** It renames two signals and changes
what they mean, so all 42 files need a re-pass on both. 23 files score
`real-product-screenshot` present and 7 score `artifact-not-dashboard`
present. Do not apply this one piecemeal.

---

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

**Impact:** additive. No existing value changes; the two fields are unset on
all 42 files and derivable from the walk output without re-capture.

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

1. **Change 4** (global scope rule) and **Change 7** (contexts) — no value
   changes, prevents errors, do them first.
2. **Change 5** (denominator) — additive, derivable from existing walk
   output.
3. **Change 1** (type-scale threshold) — needs a ladder re-read on 21 files,
   no re-capture.
4. **Change 2** (mark `single-optical-anchor` rule-ineligible) — one line,
   and it removes the largest unmeasured signal from the eligible-11 before
   any gate opens.
5. **Change 6** (split `generic-sans-default`) — a re-pass on 11 files.
6. **Change 3** (screenshot/artifact axis) — a re-pass on all 42. Last, and
   worth its own session.

Changes 1–5 can land before a third slop file exists. **Change 2 should land
before any rule is authored from any gate**, because it is the specific
failure session 3 already paid for once.
