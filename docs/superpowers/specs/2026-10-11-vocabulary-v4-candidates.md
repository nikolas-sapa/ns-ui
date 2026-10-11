# Vocabulary v4 — candidates, from 25 files of practice

Date: 2026-10-11
Status: findings, not decisions. Nothing here is applied.
Corpus: 25 evidence files, 3 cohorts, commit cc558693

v3 was decided from 20 files rated under v1. These are the places v3 bent
when four agents actually rated 25 files against it. Recorded so session 3
starts from evidence rather than rediscovering them.

## 1. A signal cannot be scored from source. This kills `check_design`.

The strongest finding in the set, and it closes a question the program
spec deferred.

Three signals were measured both ways on `clerk-com` and `railway-com`,
and source-scoring was **confidently wrong on all three**:

| signal | what the source says | what the pixels say |
|---|---|---|
| `gradient-blob` | a 754×727 circle, `linear-gradient(… rgb(98,72,246) 10%, rgb(58,212,253) 100%)`, opacity 0.25 — the archetypal palette | 12 samples across its own row return `#f7f7f8` at every point. Not one channel of deviation. Occluded or clipped to nothing. **absent** |
| `glass-card-overuse` | 16 `backdrop-filter: blur()` surfaces against a threshold of 3 | sixteen 1440×50 `pointer-events-none` strips, blur stepping 1,1,2,2,3,4px — one progressive-blur mask under the sticky nav, assembled from bands. One effect, not sixteen cards. **absent** |
| `emoji-as-icon` | 8 emoji | eight U+2713 inside JetBrains Mono build logs — `mise node@25.2.1 ✓ installed`. Captured terminal output. The font family settles it, not the codepoint. **absent** |

Two of the three fail in the generous direction. The third would be the
first non-zero on `emoji-as-icon`, which v3 names as "the one honest zero"
and the baseline every other zero is judged against — so a source-scorer
would corrupt the instrument used to audit the vocabulary.

**Consequence.** The program spec defers "whether `check_design(html)` — a
slop score for pasted markup — belongs in the MCP." On this evidence: not
as markup analysis. A tool that reads HTML/CSS and scores signals would be
wrong in the flattering direction on the most visible signals in the
vocabulary. If it ships at all it has to render and sample pixels, which is
a different and much heavier product than the deferred idea assumed.

This does not affect the Task 6 build, which counts values that raters set
from pixels. It affects anything that tries to automate the rating.

## 2. `scroll-reveal-blank` conflates two defects that come apart hard

Its mechanism is scroll-gated reveals. Its justification is "no-JS, print,
prefetch, reduced-motion and any agent reading the page all get nothing."
Measured separately across the agent-tools cohort, those barely correlate:

| site | prose under 8% opacity at rest | no-JS text survival |
|---|---|---|
| stripe | 2285 chars (32%) | 89% |
| clerk | 5137 chars (51%) | 60% |
| railway | 61 chars (1.0%) | **47%** |
| modal | **0 chars** | 99% |
| browserbase | 92 chars (3.1%) | **21%** |

Railway is nearly clean on the mechanism and loses half its text without
JS. Browserbase is the worst no-JS number in the cohort and is clean on the
mechanism — and its no-JS render is not a broken shell but a different,
denser page.

Split into the reveal mechanism and an agent-readability fact. One signal
cannot carry both.

## 3. `real-product-screenshot` has no slot for a live embed

`clerk-com` does not photograph its UI, it **mounts** it: the hero's lower
half is Clerk's own sign-up surface rendered in the DOM, set in
`ui-sans-serif` at 17px (the component default, not the marketing face),
then an Acme storefront rendering Clerk's real pricing table and a checkout
drawer reading "Total Due Today USD $14.00" with a saved `Visa ··· 4242`.

Nothing is a raster capture. The definition says "shown as a real
screenshot", so as written the signal **rewards the weaker artifact**.
Rated `present` and flagged.

## 4. Capture method: a scroll walker does not fix lazily-sized canvases

Two distinct failure modes, and the second was found only because a third
agent hit it independently:

- **IntersectionObserver reveals** → fixed by a scroll walker.
- **Lazily-sized WebGL canvases** → NOT fixed. They size from 0×0 only once
  in view, and a 700px/700ms walk passes too fast. `modal.com` returned
  correct-dimension empty panels with only a centred mono caption. Fixed by
  parking on the section ~12s, after which they paint real animated
  diagrams. `railway.com`'s closing CTA needed a targeted shot at y≈10461.

Any `absent` set from a static capture — or from a walk alone — is suspect
on a page using either mechanism.

## 5. The one-directional test artifact

`scroll-reveal-blank` was walked only on files already marked `present`.
That can catch a false `present` (it caught two) but a false `absent` is
structurally uncatchable. Both demoted files were exemplars, so the
signal's exemplar contamination went 2 → 0 on a measurement that *found
nothing* — and since `unresolved` leaves the denominator too, the
present-rate rose for the same reason.

The signal now separates perfectly on a 3-file base, and the cleanliness
was manufactured by a test applied only to the files that would have
muddied it. A bidirectional walk is in flight.

**Generalize this.** Any verification pass applied only to positives
flatters the signal. Session 3 should verify a sample of negatives as a
matter of course.

## 6. Signals that may be universal rather than discriminating

`asymmetric-split` and `density-variation` both read 5/5 across
agent-tools, and `density-variation` reads 71% in the 2014 control. Every
site sets a narrow text column against an unequal mass and runs a wide size
range. Open question: badly defined at the wrong altitude, or genuinely
universal and therefore recorded but never rule-backing?

## 7. Smaller definition problems

| signal | problem |
|---|---|
| `gradient-fill-cta` | inverts — 3/7 in `pre-ai-2015`, 0/13 elsewhere. Gradient CTAs are a 2014 convention. Depths vary 3.4× (stripe 58 units of R, github 30, dropbox 17); needs a depth threshold or it records "this page is from 2014". Revisit `dropbox-2014` first. |
| `indigo-violet-accent` | no scope line. "The hue, in any fill" literally fires on Linear, whose only violet is a customer logo card at 11% saturation. `badge-pill-spam` shows how to write a scope exclusion. |
| `typewriter-headline` | name and definition disagree. "Cycling phrases on a timer" covers a rotating carousel; "typewriter" does not. Two files sit `unresolved` and resolve together in the same direction once the reading is picked. |
| `stock-photo-generic` | 0/25. **Hold the name.** Only 5 files use photography and 4 of those are exemplars using it deliberately. 0/25 is a sampling fact, not a fact about the web. A rename would be the second altitude guess in a row with no positive case to check against. Test against a cohort sampled for it. |
| `materials` | a list of assertions with no tri-state and no value for photography of unknown provenance. Had `neomatter`'s images been photographs there would have been nothing honest to write — they turned out to be paintings (brushwork, no lens falloff, no grain at 1:1). Needs `photo-unknown-provenance`, or split the provenance claim off the medium claim. |

## 8. Where the third slop file is

The eligibility gate needs 3 rated `slop` files; the corpus has 2
(`heroku-2014`, `openhack`). One more opens the separation test for every
signal at once.

**It is not in `agent-tools`.** Those are the sites being copied, so the
template signals they carry are ones they originated. `railway-com` is the
closest candidate at 7 slop / 6 craft and was deliberately not rounded — it
pins a 1px rail with a travelling train down all 12212px outside the
content column, sets IBM Plex Serif against Inter, shows four unbezelled
app captures, and renders its scale claim as a live split-flap board.
Rounding it would put a false positive where the separation test can least
afford one.

Session 3 should sample a generated/small-site cohort.
