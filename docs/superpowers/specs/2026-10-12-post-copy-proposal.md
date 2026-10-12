# Post copy proposal: heading rewrites and statistic splits

Date: 2026-10-12
Targets: `content/writing/source-vs-pixels.md`, `content/writing/slop-template-2014-control.md`
Register reference: `content/writing/llms-txt-use-when-audit.md` (five literal-question headings, one weak closer)

**Draft only.** Nothing in `content/writing/` was modified. No number, claim or caveat is changed
anywhere below. Every edit is a heading swap, a paragraph break, a reorder of sentences already
present, or the restoration of an antecedent (a subject or an `n`) that the original carried in a
neighbouring sentence.

Word counts in Task B are measured with `wc -w` on the exact text shown, not estimated. Two of the
six before-counts in the brief differ from measurement by one word (B3: 85 not 86, B5: 89 not 90);
the measured values are used.

---

## Task A: heading rewrites

Nine headings were diagnosed in the brief, four in the 2014 control post and five in
source-vs-pixels, against a stated count of eight. All nine are rewritten below. The final section
says which one to drop if eight was the intended number.

| Post | Current | Proposed | Reason |
|---|---|---|---|
| slop-template-2014-control | The counts | Nine signals, counted out of 7, 8 and 10 | Names the metric and all three cohort sizes, so the table's subject is in the heading rather than one paragraph below it. |
| slop-template-2014-control | The signal that failed | hero-mockup-float fires on exemplars and slop alike | Names the signal and the finding that disqualified it, instead of the narrative beat. |
| slop-template-2014-control | The result that broke when I finished the corpus | At 25 files the slop band sits inside the mixed band | Names what broke, the band separation, and the corpus size that broke it. |
| slop-template-2014-control | Why the control was worth shooting anyway | What seven 2014 pages bought, and what they cannot settle | Keeps the question shape the author already uses, names the cohort and its n, and carries the section's own hedge into the heading. |
| source-vs-pixels | Two of these flatter. The third corrupts the instrument. | Two signals flatter the page. The emoji signal breaks the baseline. | Keeps the two-sentence rhythm but says which signal and what it costs, in the section's own terms (the reference point every other zero is judged against). |
| source-vs-pixels | So the obvious product does not work | Why I am not building check_design(html) | Names the function the post opened with. Phrased as a decision, not a general impossibility, because the section explicitly declines to claim a proof. |
| source-vs-pixels | Two of the mistakes were mine | Two errors of mine: melty.gg's cover art, and a threshold that cannot come back red | Names both findings and both entities while keeping the concession. Longest proposed heading; a shorter variant is in the final section. |
| source-vs-pixels | The page I still cannot explain | Vercel leaves 2630px unpainted, and the cause stays unresolved | Vendor plus measurement, the pattern of the two strongest headings in the corpus. "Unresolved" is the value actually recorded, so the heading promises no explanation. |
| source-vs-pixels | What this is actually worth | What 25 evidence files and three signals measured both ways settle | Names the corpus and the measurement. "Settle" matches the section, which claims only the build decision. |

### Two conventions kept

- **No code formatting in headings.** No heading in either post, or in the reference post, contains
  backticks. `hero-mockup-float` and `check_design(html)` are therefore proposed bare. Add backticks
  if preferred; the strings are the same either way.
- **`##` throughout.** No `###` introduced in either post.

### Untouched headings

`slop-template-2014-control`: "The control cohort already runs the template", "Centering is not the
defect", "What the dev-tools cohort actually shows".

`source-vs-pixels`: "Clerk declares a gradient blob that never paints", "The sixteen glass cards are
one blur", "Railway's eight emoji are build logs", "Rendering is necessary and nowhere near
sufficient".

That is seven, not eight: 16 headings in total, nine diagnosed, seven already working.

---

## Task B: statistic splits

Six passages flagged, six split, none declined. Every split is a paragraph break. Two of them also
move a sentence that is already in the passage, and three restore a subject or an `n` from a
neighbouring sentence.

### B1: source-vs-pixels, "Two of the mistakes were mine", first bolded paragraph

**Before (136 words, one paragraph):**

> **I compared two captures by eye and reported a false confirmation.** On `melty.gg`, a band under the hero changes between loads: Call of Duty and Super Mario cover art in one capture, Elden Ring and Hollow Knight in the next. I read that as a section mounting. It is the page rotating its cover art per load. A row-level diff puts every changed row in the hero video panel plus two rows in the cover-art strip, and across roughly 4000px of black between it and the FAQ, not one row differs. Mean ink per row goes 7.6% to 8.3%, and all 0.7 of that point is the video sitting at a different frame. `openhack` under the identical walk goes 6.0% to 27.8%, 4.6x. That is what a gate opening looks like, and melty is not it.

**After (57 + 34 + 50 = 141 words, three paragraphs):**

> **I compared two captures by eye and reported a false confirmation.** On `melty.gg`, a band under the hero changes between loads: Call of Duty and Super Mario cover art in one capture, Elden Ring and Hollow Knight in the next. I read that as a section mounting. It is the page rotating its cover art per load.
>
> A row-level diff puts every changed row in the hero video panel plus two rows in the cover-art strip, and across roughly 4000px of black between it and the FAQ, not one row differs.
>
> Mean ink per row on `melty.gg` goes 7.6% to 8.3% under the walk, and all 0.7 of that point is the video sitting at a different frame. `openhack` under the identical walk goes 6.0% to 27.8%, 4.6x. That is what a gate opening looks like, and melty is not it.

The citable passage is the third, at 50 words: both ink series, the 4.6x, and the conclusion. It
needs `melty.gg` and "under the walk" restored, because standing alone "mean ink per row" names no
page and no procedure. Both facts are stated in the sentence that currently follows it. The 34-word
row-diff paragraph is under the 40-word target; it is already a complete claim, and padding it would
mean inventing words.

### B2: source-vs-pixels, "Two of these flatter", second paragraph

**Before (97 words, one paragraph):**

> The emoji one is different in kind. `emoji-as-icon` reads `absent` on all 25 files. The vocabulary's current draft names it "the one honest zero, and the baseline for judging other zeros", because a vocabulary full of signals that never fire is usually a vocabulary with bad definitions, and this zero is the one I trust. Source-scoring would put the first non-zero there, from captured terminal output, on a page that has no emoji in it at all. It would not just be wrong about Railway. It would break the reference point every other zero is judged against.

**After (55 + 42 = 97 words, two paragraphs):**

> The emoji one is different in kind. `emoji-as-icon` reads `absent` on all 25 files. The vocabulary's current draft names it "the one honest zero, and the baseline for judging other zeros", because a vocabulary full of signals that never fire is usually a vocabulary with bad definitions, and this zero is the one I trust.
>
> Source-scoring would put the first non-zero there, from captured terminal output, on a page that has no emoji in it at all. It would not just be wrong about Railway. It would break the reference point every other zero is judged against.

A pure break. Not one word changes, nothing moves, and both halves land in the band: the statistic
with its claim at 55 words, the consequence at 42. The n of 25 stays with the zero it describes.

### B3: source-vs-pixels, "Two of the mistakes were mine", second bolded paragraph

**Before (85 words, one paragraph):**

> **An absolute brightness threshold is meaningless on a light page.** The first comparison pass counted a row as inked if a sampled pixel cleared a fixed brightness. Every pixel of `nxtcure-labs`'s `#f5f3ff` field clears it, so the page read 100% inked before the walk and 100% inked after, which is a measurement that cannot come back red and therefore proves nothing. Background has to be taken as the modal pixel of the capture, with a row counting as inked when a sample deviates from that.

**After (47 + 41 = 88 words, two paragraphs):**

> **An absolute brightness threshold is meaningless on a light page.** Every pixel of `nxtcure-labs`'s `#f5f3ff` field clears a fixed brightness bar, so the page read 100% inked before the walk and 100% inked after, which is a measurement that cannot come back red and therefore proves nothing.
>
> The first comparison pass counted a row as inked if a sampled pixel cleared a fixed brightness. Background has to be taken as the modal pixel of the capture, with a row counting as inked when a sample deviates from that.

The method sentence moves to the second paragraph, next to the fix it motivates. "Clears it" then
has no antecedent, so it becomes "clears a fixed brightness bar", which states the same threshold
the moved sentence describes. A zero-reword alternative is in the final section.

### B4: slop-template-2014-control, "Why the control was worth shooting anyway", closing paragraph

**Before (134 words, one paragraph):**

> What the control bought, for seven pages of work, is the ability to tell two explanations apart. "AI flattened web design" predicts a 2014 cohort that looks varied. Mine has the highest mean slop count of the three, 3.14 against 2.62 and 2.40, and contains a page running seven template moves at once. Treat the ordering as weak: that is a half-signal gap across samples of 7, 8 and 10, and it would flip if one 2014 page were re-rated. The page running seven at once is the part that does not depend on the average. So the convergent template is not a model artifact. It is 2014-era marketing-site convention, learned by the models from the pages I just screenshotted, and the strongest current builders are measurably further from it than their predecessors were.

**After (47 + 51 + 38 = 136 words, three paragraphs):**

> What the control bought, for seven pages of work, is the ability to tell two explanations apart. "AI flattened web design" predicts a 2014 cohort that looks varied. Mine, at n=7, has the highest mean slop count of the three, 3.14 against 2.62 (n=8) and 2.40 (n=10).
>
> Treat the ordering as weak: that is a half-signal gap across samples of 7, 8 and 10, and it would flip if one 2014 page were re-rated. The cohort also contains a page running seven template moves at once, and that is the part that does not depend on the average.
>
> So the convergent template is not a model artifact. It is 2014-era marketing-site convention, learned by the models from the pages I just screenshotted, and the strongest current builders are measurably further from it than their predecessors were.

Each of the three means now carries its own n inside the 47-word passage, so the comparison cannot be
lifted without its sample sizes. The hedge sentence is **verbatim**, including its own "across
samples of 7, 8 and 10": the n is duplicated rather than moved, because the caveat needs it as much
as the statistic does, and the post already commits to repeating those three numbers. The two
sentences about the seven-signal page are merged into the hedge paragraph, with "The cohort also
contains" supplying the subject the first of them took from the statistic sentence.

### B5: slop-template-2014-control, "The result that broke when I finished the corpus"

**Before (89 words, one paragraph):**

> Finishing the corpus to 25 and completing a vocabulary re-pass broke it. Exemplars now run 0 to 3, mixed runs 1 to 7, and the two slop pages sit at 6 and 7. The slop band is now entirely inside the mixed band. Railway's homepage carries seven slop signals, the same count as Heroku 2014, and was rated mixed, because it also pins a 1px rail with a travelling illustrated train down all 12,212px outside the content column and renders its deploy count as a mechanical split-flap departure board.

**After (43 + 46 = 89 words, two paragraphs):**

> Finishing the corpus to 25 and completing a vocabulary re-pass broke it. Exemplars now run 0 to 3, mixed runs 1 to 7, and the two slop pages sit at 6 and 7. The slop band is now entirely inside the mixed band.
>
> Railway's homepage carries seven slop signals, the same count as Heroku 2014, and was rated mixed, because it also pins a 1px rail with a travelling illustrated train down all 12,212px outside the content column and renders its deploy count as a mechanical split-flap departure board.

A pure break, zero words changed. The three bands and the corpus size stand alone at 43 words. The
Railway case, which is a separate citable fact, stands alone at 46.

### B6: slop-template-2014-control, "The signal that failed", second paragraph

**Before (75 words, one paragraph):**

> In 2014 it fires on three pages: one rated slop, two rated mixed. In the YC cohort it fires on five: two exemplars, two mixed, one slop. It fires on good and bad pages alike, and was already standard in 43% of the 2014 cohort. Squarespace 2014 is the clearest case: a MacBook floating dead centre with a real customer site on its screen, where the signal does real work, because the product is websites.

**After (49 + 30 = 79 words, two paragraphs):**

> `hero-mockup-float` fires on three of the seven 2014 pages: one rated slop, two rated mixed. In the YC cohort it fires on five of eight: two exemplars, two mixed, one slop. It fires on good and bad pages alike, and was already standard in 43% of the 2014 cohort.
>
> Squarespace 2014 is the clearest case: a MacBook floating dead centre with a real customer site on its screen, where the signal does real work, because the product is websites.

Three edits, all restorations. The leading "it" becomes `hero-mockup-float`, because the passage is
uncitable while its subject lives in the previous paragraph. "Three pages" becomes "three of the
seven 2014 pages" and "five" becomes "five of eight", which are the denominators already in the
table and in the sentence directly above ("3/7 to 5/8"). Without them, the extracted passage reports
two counts with no sample size, which is the regression the brief rules out.

---

## Declined, and decisions left to the author

**Nothing in Task B was declined.** All six passages split without touching a number, a claim or a
caveat. Three needed an antecedent restored (B1, B6) or an n made explicit (B4, B6). Those are the
only additions, and each one restores a fact from the sentence next door.

**Nine headings, not eight.** The brief states eight and enumerates nine. If eight is the real
number, drop the rewrite of **"What this is actually worth"** and keep it as it stands. The reference
post keeps exactly one weak closing heading, "The uncomfortable version", so one unsearchable closer
per post is inside the standard the author set. Every other heading in that reference post names
something, so the other eight rewrites have no such precedent to lean on.

**Longest heading.** "Two errors of mine: melty.gg's cover art, and a threshold that cannot come back
red" is 16 words, longer than any heading now in either post. A shorter version that keeps both
entities: "melty.gg rotates its cover art, and my threshold could not come back red", at 13 words,
which loses the concession the current heading carries.

**Lower-risk alternative for B3.** The split above moves one sentence and rewords three words. A pure
break instead, after "proves nothing", gives 61 and 24 words with nothing changed at all. The
61-word half is one word over the target band and the 24-word half is well under it, so it trades the
band for leaving the prose untouched.

**Alternative shape for B2.** The split above keeps the statistic with the honest-zero claim. Putting
it with the consequence instead, by moving the "Source-scoring would put the first non-zero there"
sentence up and the vocabulary-draft sentence down, gives 57 and 42 words and requires swapping one
"it" for `emoji-as-icon`. That version reads as the stronger paragraph and is the larger
intervention. The pure break is proposed because it costs nothing.

**Not changed, and not proposed for change:** every statistic the brief did not list, the four
zero-firing slop signals, the circularity caveat about one rater setting both the signals and the
verdicts, and the "pipeline currently authors zero rules" paragraph. Each is either already short
enough to extract or is a caveat the brief protects.
