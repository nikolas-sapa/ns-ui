# State after session 4 — ten candidates, no third slop file, gate stays closed

Date: 2026-10-14
Supersedes: nothing. Extends `2026-10-14-session-3-final-handoff.md`, which
is still accurate on the pipeline, the five-threshold gate and the three
capture failure modes.

## The answer to session 3's first task

Session 3 left one task: **find a genuinely slop-rated site and have two
raters agree on it.** One more slop file opens the separation test for all
26 signals at once.

Ten candidates were sampled and rated. **None is slop.** The pool is still
2, the gate is still closed, and `antislop.json` still carries 0 rules.

No blind rater was dispatched, because nothing reached `slop` for one to
check. Dispatching one anyway would have been theatre.

| | before | after |
|---|---|---|
| evidence files | 32 | **42** |
| `yc-current` cohort | 15 | **25** |
| verdicts | 12 exemplar / 18 mixed / 2 slop | **16 / 24 / 2** |
| rules | 0 | **0** |
| tests | 82 pass | 82 pass |

## What was sampled, and how

`~/scratch/antislop/yc-companies.tsv` has 357 rows; 338 were unstudied with
live URLs. A **seeded random sample** (`random.seed(20261014)`) drew 16; all
16 returned HTTP 200; the first 10 in sample order were taken, with no
substitutions. That matters: the sample is unbiased, so the verdicts below
are an estimate of slop prevalence in the YC population rather than a
curated set.

```
net  verdict   slop craft  file                  page px
 -1  mixed      2    3     osseus                  2654
 -2  mixed      3    5     neuron-industries      13947
 -2  mixed      4    6     sentient-os            14803
 -2  mixed      3    5     tsenta                  9326
 -3  mixed      0    3     standard-machines       1668
 -5  mixed      0    5     dipole-labs             1528
 -5  exemplar   0    5     edotenv                 3098
 -6  exemplar   2    8     financial-datasets      5758
 -6  exemplar   1    7     provenmetal             4384
 -7  exemplar   1    8     the-subvocal-company   13726
```

Six mixed, four exemplar. The highest net in the batch is **−1**, against a
threshold of **+4** that is necessary (not sufficient) for `slop`.

## Why this is a result and not a failure to look hard enough

Three checks, because "we found nothing" is exactly the claim that deserves
falsification rather than assertion.

**1. The conclusion survives removing the most suspect craft signal.**
`single-optical-anchor` is the one v3 signal with an empty notes cell — it
has no definition at all (known-soft #5). It came in at **8/10 present in
this batch against 6/15 (40%) in the pre-existing `yc-current` cohort, a
+38-point swing**, which is what an undefined signal being marked present
by default looks like. So: recompute every net with it struck from the craft
side entirely.

```
  +0  osseus            -1  sentient-os       -2  tsenta
  -2  standard-machines -2  neuron-industries -4  edotenv
  -4  dipole-labs       -5  provenmetal       -5  financial-datasets
  -6  the-subvocal-company
```

Top file moves from −1 to **0**. Still **4 signals short** of +4. No
plausible amount of rater generosity on that signal closes the gap, so the
finding does not depend on it. (It is still a real defect and still needs a
definition; it is just not the reason the batch is clean.)

**2. The gate is live, not stuck at zero.** "0 rules" could mean a correctly
closed gate or a broken one. Flipping `osseus` to `verdict: slop` and
rebuilding makes the build immediately name **11 rule-eligible signals** and
fail demanding rules for each:

```
gradient-blob, symmetric-everything, indigo-violet-accent,
stock-photo-generic, asymmetric-split, single-optical-anchor,
type-scale-high-contrast, editorial-grid-break, custom-type-pairing,
artifact-not-dashboard, density-variation
```

Reverted immediately; `osseus` is `mixed` and the build is back to 0 rules.
Two things follow. The separation test does run. And **one verdict on one
file flips 11 signals from ineligible to eligible** — which is the
quantified case for the two-rater rule, not an opinion about it.

**3. One file was re-verified by hand against the rendered page.** `osseus`,
the top net, scored `centered-hero-stack` and `asymmetric-split` both
present, which is the combination most likely to be a rater error. It is
correct: the hero is a centred stack inside a photo band, and every body
section below is a left heading block against a right text column with the
left column vacant below the heading — the "asymmetric by vacancy" shape
`railway-com` already records. Different sections, not a contradiction.

**That same hand check then produced this session's own worst error, and it
is the most instructive thing in this document.** Reading the stitched strip
I saw the section "A continuous data flywheel" twice, consecutively, and
appended a confident paragraph to `osseus.md` asserting the page ships a
duplicated section — "the strongest single piece of evidence on this page
that the copy was assembled rather than written."

It was my stitcher. `osseus` is 2654px, so `maxScrollY` is 1754; the walk's
fourth step asked for 2100 and the browser clamped it to 1754. `stitch.py`
assumed every step advanced a full 700px and appended the tile's band
anyway, re-showing 346px. The rater had already caught it from the other
direction and said so explicitly: *"159 duplicate rows at dominant offset
exactly 346 = 3000−2654 ... a second rater will otherwise read a repeated
section as a page defect."* Which is precisely what I did.

The paragraph has been removed; `osseus.md` now matches the rater's draft
byte for byte. **The page has no duplicated section.**

Worth stating plainly because it is the project's own failure mode: I
asserted a defect in an evidence file from an instrument I had not verified,
in the same session whose entire thesis is that a green instrument proves
nothing until you have seen it fail. The stitcher fix and its guard are
below.

## Prevalence, which is the strategic finding

`yc-current` is now **1 slop in 25 rated files, 4%**. (`openhack`, session
1.) At that rate, a random YC draw needs roughly **25 more candidates per
additional slop file**, not 10.

So YC sampling is a viable path to a third slop file but a slow one, and
session 3's "path of least resistance" framing was optimistic. 313 unstudied
rows remain. Either budget ~25 candidates for one more slop file, or find a
population with a higher base rate. Nothing in this session suggests where
that population is; Product Hunt and the v0 gallery were already ruled out.

## Capture: two more silent failure modes, and a lying instrument

The three in the session-3 handoff all still hold. Add:

**4. A screenshot stability timeout truncates a walk silently.**
`sentient-os` animates continuously enough that Playwright's screenshot
stability check never settles — seven non-zero WebGL2 canvases, so no frame
ever stabilises. The first pass died mid-walk after 6 tiles and the output
read as a ~4200px page. It is **14803px**, a 3.5x undercount. The tile loop
had already written 6 valid files, so nothing looked wrong downstream.

Fix, now in `shoot-tiles.cjs`: `animations: 'disabled'` and `timeout: 90000`
on every `page.screenshot`. Detection rule: **if the last tile is not a
footer, suspect the walk, not the page.**

**5. An element too short to be a scroller can still clamp `window.scrollTo`.**
Found by the `the-subvocal-company` rater, and it is nastier than #3 because
both instruments behave correctly. `div.scroll-film-pin.scroll-film--cover`
is `position: sticky` + `overflow: hidden` at 1170/900 = **1.27x**, below the
1.5x threshold the walker uses to identify an inner scroller — so the probe
correctly rejected it, then the walker fell back to the one instrument that
element disables. Asked for 7500, got 7092. Asked for 13726, got 7109.
**12 of 20 tiles are the same band and 48.2% of the page was never
captured.** Neither reading errored. The rater recovered the tail with a
wheel-driven walk (`p.mouse.wheel`) and rated the complete page; their
verdict stands.

Fix, now in `shoot-tiles.cjs`: **read back `window.scrollY` after every
step** and compare to the clamped target. Two consecutive short landings
abort the walk, and the result carries `clamped`, `reachedPx` and
`coverage`, with a `CLAMPED` line on stderr. Verified both directions —
fires on `the-subvocal-company` (`clamped: true`, coverage 0.583, aborts at
12 tiles instead of silently writing 20) and stays quiet on `osseus`
(`clamped: false`, coverage 1.0).

**The strips for `the-subvocal-company` in `s4strips/` are from the bad
capture and must not be re-rated from.** Its height invariant passes while
its content is wrong, because the duplicate tiles stitch to the right total.
Only the walker can catch this, which is why the check went there.

**`satPct` lies on any light page, and four raters found it independently.**
`probe3.cjs` reports HSL saturation as `(mx-mn)/(255-|mx+mn-255|)`, whose
denominator collapses toward white. An off-white paper field therefore scores
as near-fully-saturated in one hue bucket:

| page | reported | actual |
|---|---|---|
| `dipole-labs` | 98.7%, one bucket | paper `rgb(250,250,247)`, 0.6% HSL sat |
| `edotenv` | 95.5%, bucket 1 | `#FBFAF7` at L=0.976; real chroma **0.018%** |
| `osseus` | 89.8% | cream `(232,232,216)`; 82.3% of pixels at chroma 8-15 |
| `tsenta` | 72.6%, bucket 0 | field `rgb(253,252,252)`; one red unit flips it |

`edotenv`'s rater reproduced the formula to the decimal. `osseus`'s rater
noted that **`s4v.cjs:73` already carries the comment "HSL satPct lies at
high luminance"** while `probe3.cjs` still emits it as the headline pixel
fact — and that it would have sent them to `one-accent-discipline: absent`
on a coloured field that does not exist.

**I made this worse.** I read those four numbers off the probe and wrote
them into the rater briefs as findings ("page saturation is 98.7%
concentrated in a single hue bucket", "work out whether that saturation is a
background field or an accent"). Four raters had to spend effort
disproving an artifact I had handed them as evidence. Replace `satPct` with
a max-min RGB chroma scan, or gate it above L≈0.9; until then, do not put it
in a brief.

## Cost: the first dispatch died and the fix is reusable

Five raters were dispatched with two sites each and instructions to read
every tile. All five were killed by a 402 budget-pool exhaustion **before
writing a single file**. Cause: ~22 full-size 1440x900 PNGs per site, read
individually.

Fix, `scripts/antislop/stitch.py`: the walk steps 700px through a 900px
viewport, so consecutive tiles share 200px. Taking each tile's unique band
and stacking them reconstructs the real full-page image — the thing
`--full-page` silently fails to produce — in strips of ~4200px at full 1440
width, so body copy stays legible.

**110 tiles became 23 strips.** The second dispatch was ten agents of one
site each, reading 1–4 strips, with an instruction to write the front matter
first and append prose in a second edit. All ten completed; none died.

**The first version of that script was wrong, in the way described above.**
It assumed every walk step advanced a full 700px. The browser clamps at
`maxScrollY = docH − 900`, so the last one or two tiles can be the same
frame, and appending 700px of each re-shows content. Every short page in the
batch came out too tall: `standard-machines` 2300px for a 1668px page,
`dipole-labs` 2300 for 1528, `osseus` 3000 for 2654, `edotenv` 3700 for
3098. Four raters noticed and corrected for it arithmetically in their
prose; I did not, and asserted a page defect from it.

Now fixed to compute each tile's actual clamped landing and take only the
newly-revealed band — and, because that is the kind of bug a strip does not
look like it has, **the script asserts that stitched height equals page
height** and fails loudly otherwise. All ten re-stitch to exactly their
page height. Note the limit: that invariant cannot catch failure mode 5,
where duplicate tiles stitch to the correct total. Hence the walker check.

Three practices worth keeping:
- Stitch strips, don't read tiles.
- One site per agent: a death costs one rating, not two.
- Write the signal profile before the prose. A run that dies after the front
  matter still leaves a usable rating.

## Vocabulary gaps this batch exposed

Ranked by how much they cost a rating. Items 1, 2 and 5 were each reported
independently by two or more raters.

1. **Restraint and absence of surface area are indistinguishable, and the
   craft side has the mirror of the same hole.** Three pages are under
   3100px (`dipole-labs` 1528, `standard-machines` 1668, `osseus` 2654) and
   score 0–2 slop signals because most sections do not exist. The net
   flatters them. Two raters quantified the split rather than asserting it:
   `dipole-labs` is **13 signals declined by decision against 3 absent by
   vacancy**; `standard-machines` is the reverse, **at least 9 of 16 with no
   section in which they could fire**. `osseus`'s prose puts it best — it
   "has not solved the problems those signals detect; it has not reached
   them."

   The `standard-machines` rater identified the mirror image, which is the
   more important half: `single-optical-anchor` and `density-variation` are
   **near-automatic on a page with one graphic and one text block**, so the
   craft signals stop discriminating at exactly the surface area where the
   slop signals stop discriminating. A 0/16 one-screen page and a 12000px
   page refusing every gradient, pill, glass surface and scroll gate across
   forty sections score identically, and the second is far stronger
   evidence.

   Both raters proposed the same fix, independently: **record a denominator**
   — page height or section count — alongside the counts. `dipole-labs`'s
   rater suggests it belongs in `materials`, which keeps it
   non-stance-bearing. Note the declined/vacant partition is currently
   rater-authored and lives only in prose, so two raters could draw it
   differently and both be inside the rules.
2. **`real-product-screenshot` / `artifact-not-dashboard` is broken in both
   directions, and this batch has the sharpest instance yet.** Known-soft #2
   gets worse the closer you look. Four separate findings:
   - **The two signals are not defined over the same axis.** The
     `financial-datasets` rater nailed the root cause:
     `real-product-screenshot` is defined on a **capture medium** and
     `artifact-not-dashboard` on **content**, so they are not mutually
     exclusive alternatives at all. That page contains **no screenshot** —
     every product surface is a live DOM rebuild — and what those surfaces
     render is a claims ledger in v3's own words (`Metric / Type / Period /
     Value / Citation`, the Citation column holding quoted source strings
     beside out-links). The letter of both definitions gives the reverse of
     what was scored. The verdict is robust either way: both are craft, so
     net stays −6.
   - **The exclusion suppresses the vocabulary's own worked example.**
     `neuron-industries` ships, at y9802-11400, "a priced comparison with
     real refusals" — Cortex Mini $2,950 vs Cortex $6,450, 1000 vs 4000 Hz,
     3 vs 0.5 µs P99.9 jitter, `Motion: EtherCAT only` on the cheap unit,
     `Certifications: UL + CE (planned)`. Forced to `absent` because the
     page also ships 9 IDE screenshots.
   - **Both-absent cannot distinguish "offered no evidence" from "offered
     evidence badly."** `dipole-labs` claims to pass "the physical limits of
     silicon" and ships zero die shot, loss curve, latency figure or port
     count. A page floating a gradient-washed fake dashboard scores the same
     pair. On a hardware company that is the entire criticism.
   - **Absent reads as a deficiency when it is a category fact.**
     `the-subvocal-company` sells eyewear; there is no UI to screenshot. It
     is the first file where the exclusivity costs nothing, because the page
     shows the deliverable captioned with its destination.

   Recommended split, from the `neuron-industries` rater: "shows a
   deliverable" (scoreable independently) and "shows a dashboard instead of
   a deliverable" (the actual discriminator).
3. **The product-screenshot scope note is attached only to
   `badge-pill-spam` and needs to be global.** The `tsenta` rater had to
   apply it by analogy to `three-card-row` (a 4-up of job-match cards inside
   a dashboard clone), `emoji-as-icon` (7 Inter checks as diff markers) and
   `one-accent-discipline` (pastel fills, status colours, iOS blue). A rater
   working the row table or the emoji count without opening a strip would
   score all three wrong. This is cheap to fix and prevents real errors.
4. **`three-card-row` is literally three, and a 4-up with card chrome is
   unrecordable.** Corpus precedent is consistent: `cursor-com` and
   `modal-com` score it present on genuine three-card rows and describe
   their four-ups separately without firing it; `capveon`, `deepmark`,
   `github-2014`, `railway-com` score absent while carrying a four-up. The
   precedent was followed. (Note: `tsenta` does have a real one my brief
   missed — a pricing triplet at y6938, three equal 357px cards with
   fill+border+radius, Starter $19 / Pro $39 / Power $99. The rater found it
   and scored the signal present on that, not on the 4-up.)
5. **`type-scale-high-contrast` has no threshold and no stated altitude, and
   two raters had to interpolate one.** The `neuron-industries` rater
   reconstructed the corpus boundary: openhack 3.5:1 absent / railway 3.4:1
   absent / clerk 3.1:1 absent against anthropic 3.8:1 present — then landed
   at 3.26:1 and 3.75:1, inside the gap, and called it a coin flip. The
   `edotenv` rater recorded **four ratios for the same page** (8.70:1 at
   nominal, 5.12:1, 5.61:1, 7.16:1 against different body terms) precisely
   because the altitude is unstated, and noted that cap-height and nominal
   altitude only diverge when display and body use different faces. A single
   number in the notes column makes this reproducible.
6. **`custom-type-pairing` makes a committed single-voice serif invisible,
   and has no clause on generic-family keywords.** Two distinct faults:
   - `osseus` sets an entire frontier-AI landing page in EB Garamond. That
     is a real decision against the grotesque default, and it nets to
     **nothing**: `generic-sans-default` correctly absent on the slop side,
     `custom-type-pairing` absent on the craft side, so the page scores
     identically to one with no type decision at all.
   - `neuron-industries` specifies **no typeface anywhere** (`faces` empty);
     its "second family" is the generic keyword `ui-monospace, Menlo,
     monospace`. Nothing in the vocabulary says whether a generic keyword
     counts as a chosen face, so the signal can award craft to a page that
     chose nothing.
   - Related, and the reason this is not simply "count families":
     `sentient-os` loads 14 faces / 7 families but the ladder shows a strict
     two-voice split (Cabinet ≥26px with nothing below, Satoshi ≤27px with
     nothing above, different tracking rules); the other five are props,
     four of them appearing only inside simulated Gmail/Finder chrome. The
     signal reads present either way, so it cannot distinguish "two voices
     plus five props" from "seven families because nobody counted." **The
     discriminating evidence is the size ladder, not the face list** — a
     rater given only `faces` could not tell them apart.
7. **`generic-sans-default` conflates three pages, not two** (known-soft #6
   understates it). The `edotenv` rater's formulation: ships no webfont,
   ships a deliberate neutral grotesque, and reaches for the era's default
   sans unthinkingly. Geist is present on face identity and absent on the
   railway discriminator — and that page authors an exact per-size tracking
   table (−8.50% at 139.2px through +10.00% on the mono, all exact
   percentages, monotonic), which is the precise thing railway was scored
   present for *lacking*. `the-subvocal-company` is the same shape: Inter at
   −0.045em on both display sizes, where railway's Inter body ran at
   `letter-spacing: normal`. A rule emitted from this signal as it stands
   would convict both pages for doing the work. Needs the split the
   vocabulary already gave `dark-mode-afterthought`: **face identity and
   tracking discipline are two different facts.**
8. **The no-JS text deficit still has no home, and is now at three files.**
   `railway-com` 53% JS-only, `financial-datasets` 60%, and
   `the-subvocal-company` is the **100% case: no-JS yields 0 characters and a
   900px `scrollHeight`.** Not degraded — blank. Every signal reads absent,
   including `scroll-reveal-blank`, whose definition correctly exonerates the
   page (3 nodes / 63 chars cross opacity under a walk; dwell at 37.8s
   crosses 0). Distinct from a scroll reveal, where the text is in the DOM
   and merely transparent, and the build cannot tell them apart. `tsenta`
   shows the other end of the same axis: 85.8% of copy is in the HTML and
   only the opacity is scroll-driven, a materially milder defect that scores
   identically.
9. **`type-sited-in-image` (v3 candidate, unadopted) now has three
   supporting files and is load-bearing on one.** `capveon` was the
   original. `osseus` sites a 60.8px headline in the haze between column
   pairs — ground (223,218,206) against a field of (238,235,224), painted
   extent feathering 918→907→gone with no hard edge and no scrim — so
   `stock-photo-generic` fires on trigger (a), generic imagery, while
   trigger (b), "type cannot survive on it so a scrim is bolted over it", is
   not merely absent but **inverted**. Scoring it present currently hides
   that the imagery is handled with skill. `financial-datasets` sites 40px
   Literata at 6.4px tracking in engraved bronze on a building pediment,
   inside the illustration's footprint, no scrim.
10. **A domain-specific generative graphic scores nothing.**
    `standard-machines`'s one deliberate visual decision is a 1143x546
    canvas carrying a dense space-filling serpentine curve that reads as PCB
    routing. Correctly neither `real-product-screenshot` (no chrome, panel,
    label or data) nor `artifact-not-dashboard` (no cells, nets, pads,
    metrics or axis — it alludes to the deliverable without being one). Same
    shape as the gap `railway-com` recorded for its split-flap board.
11. **`live-claim-control` is not resolvable from a still, contrary to its
    own spec.** The signal was adopted over `motion-tied-to-input` on the
    grounds that "the affordance is a visible label." The
    `the-subvocal-company` rater found three scene tabs ("09:15 The office" /
    "17:40 The train" / "19:30 Across the room") whose underline advances
    with scroll, so from a still they read equally as a progress indicator.
    It took a click test — clicking "19:30" moved `scrollY` 7456 → 10641 and
    swapped the scene — to confirm they are controls. Separately,
    `financial-datasets`'s controls were verified real by DOM diff but fire
    **zero network requests**, so the signal cannot distinguish a live claim
    from a convincing fixture.
12. **A trial-licence font in production has no slot.** `provenmetal` sets
    every display size in a face named literally "Rhetorik Serif **Trial**".
    Recorded in prose as a fact; it is not a stance and not a material.
13. **`glass-card-overuse` is named for cards but measured on
    `backdrop-filter` count.** It fires correctly on `neuron-industries` at
    7 surfaces — but **four of the seven are text elements** (H1, subhead,
    kicker, chip), each on `rgba(5,7,12,0.35)` over a page-wide scrim. Two
    scrims to make a 60px headline legible. The real defect is type that
    cannot survive its own background; a rule derived from the surface count
    would give the wrong advice.

## Changed outside `content/evidence/`

One line, and only because the vocabulary authorises it:
`MATERIALS` gains **`video-embed`**. `subvocal.company` ships a 3.79s beauty
clip and a 91.8s lab video of the prototype as in-page sections, which
`video-hero` describes wrongly. `MATERIALS` is documented as an open list,
and a material can never back a rule (`scripts/antislop/rules.ts` rejects
one in a `signal` field, and a test asserts it), so the addition carries no
rule risk. No signal, threshold or verdict was touched.

## Gates, verified

```
npx tsx scripts/build-antislop.ts   42 evidence file(s), 0 rule(s)
npm run test:antislop               82 pass, 0 fail
npm run typecheck                   clean
```

Plus the falsification check above: the gate opens when a third slop file
exists, and closes again when it does not.

## First task next session

Unchanged from session 3, with a corrected cost estimate: **find a third
slop file and have two raters agree on it.** Budget ~25 random YC candidates
for it, not 10, or find a higher-prevalence population first.

Two things are now cheap that were not:
- Capture and rating at ten-sites-per-pass, via `stitch.py` strips and
  one-site agents.
- Knowing what opens: the 11 signals listed above become eligible the moment
  a third slop file lands, so the rule-authoring work is pre-scoped.

And one thing to do before authoring anything, whether or not a third slop
file arrives: **give `single-optical-anchor` a definition.** It is at 60%
present corpus-wide, it is in the eligible-11 list, and it has never had
one. It was authored into eleven rules in session 3 and withdrawn with them.
If it qualifies again on a definition nobody has written, that is the same
mistake with a larger n.

## Known-soft, updated

Session 3's ranked list stands. Changes:

- **#1 circularity** is unchanged in kind but the batch adds evidence: the
  gate-liveness test shows a single verdict moving 11 signals, so verdicts
  set by the raters who set the signals remain the structural weak point.
- **#2 `artifact-not-dashboard` vs `real-product-screenshot`** is now 7/42
  (17%) corpus-wide and fired **once in ten** here. The convention is
  starving it as predicted. `financial-datasets` is the sharpest case yet: a
  live priced data table of real stock rows, which is closer to a
  deliverable than to a UI, scored `real-product-screenshot` under the
  convention.
- **#5 `single-optical-anchor` has no definition** is promoted to the first
  thing to fix, for the reason above.
- **#7 one viewport** unchanged. Everything is still 1440x900.
