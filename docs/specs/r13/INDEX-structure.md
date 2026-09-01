# r13 — landing-page structure and pacing, ranked

Scout slice: section dividers and section-to-section transitions, scroll-driven reveals and pinned
sequences, feature grids and bento arrangements, marquees and logo ribbons in motion, image/video
galleries, footers, route curtains.

**10 specs delivered.** Ranked against `GAP-MAP.md`'s gap list, not against my own sense of which
mechanic is prettiest — a concept answering a twice-named open gap outranks a technically better one
that answers none.

## What the gap map changed

Re-ranked and re-weighted after reading `GAP-MAP.md` in full. Three concrete consequences:

- **Two footers, not one.** Footer is gap #1 (count 1, named three times in the repo's own docs, and
  `footer-ascii-rule` is a back-to-top scroll instrument with a sitemap attached rather than a
  footer block). `joint-iron` and `nonpareil-comb` are both footers, and **neither reads scroll** —
  duplicating the scroll instrument would collapse the distinction between the registry's only
  footers.
- **`foredge-trim` was killed.** It was ranked 9 of 10 on the previous pass with an argument I
  described as the thinnest I was making. Section dividers are 21 slugs — my best-covered surface —
  so the bar there is highest, and a marginal divider is exactly the wrong thing to spend a slot on
  when footer sits at 1. Killed rather than shipped weak; `nonpareil-comb` took the slot. The set now
  has **no standalone divider**; `former-fold` covers the transition half of that bucket.
- **Both marquees are non-ticker and carry non-text payload**, which is precisely gap #8's stated
  miss ("all three are financial-ticker register: fixed-speed horizontal text… missing: a marquee
  carrying non-text payload"). `flying-splice` carries marks on a web fed by two rolls;
  `kiss-cut` carries marks that are what *remains* after the waste is stripped.

Feature grid / bento (gap #5) is answered twice as asked: `quoin-lockup` (bento) and
`collating-mark` (feature grid).

## Verification done

- Checked against all 534 registry slugs **by description and tags, not by slug name** — the
  backlog's method note is right that a name-level check misses hidden surfaces
  (`warp-knit-tricot-lapping` and `tray-weep` are both dividers with no surface word in the slug;
  `expansion-gap-breather` is a welded-rail seam divider, which is what killed `back-step-bead`).
- Checked against the **59-slug removed-component ledger**. `strata-cut` (the one slug in
  `ns-ui-lab-scroll` not in this worktree) is a **removed duplicate of `scroll-story-strata`**, not
  work in flight — `multiplane-crane` is a five-plate optical rig with no strata, no core sample and
  no depth HUD, so it is clear of it. `footing-course` and `gel-wash` are cited in this index and in
  the specs **only as failure modes**, never as models.
- **No r10/r11/r12 component is cited anywhere in these 10 specs as a positive model** — verified by
  grep against all 23 quarantined slugs plus `strata-cut`, `tensegrity-drift` and `tack-peel`. The
  only precedents cited are shipped code (`weld-pool`, `ebb-flat:613`,
  `curtain-austrian-gather:439`, `dye-whorl`) and the `seam-gild` / `starch-shear` lesson in
  `docs/showpiece-recipe.md`.
- Checked against the concurrent r13 scouts' ~30 specs by grepping their files for this slice's
  process vocabulary and reading every mechanic-level match: `material-plate-throw`,
  `material-cockle-swell`, `material-wrinkle-cure`, `material-peel-flow`, `convert-matrix-return`,
  `convert-spreader-bar`, `material-dandy-watermark`. One real collision, resolved below.

## Two decisions the lead needs

1. **`dandy-roll` was written in full, then killed.** It was a Fourdrinier-watermark footer;
   `material-dandy-watermark.md` landed in this directory using the same process for a badge, and
   the convert scout had already killed a third one. Two watermark components in one round is the
   split-idea failure. `joint-iron` replaced it.
2. **`matrix-strip` renamed `kiss-cut`** so it does not read as a sibling of convert's unrelated
   Linotype `matrix-return`.

## Ranking

| # | Slug | Tier | Surface | Gap | Why here |
|---|---|---|---|---|---|
| 1 | `joint-iron` | loud | footer | **#1** | Makes the footer's own surface the mechanic instead of bolting an instrument beside it: a French groove formed under a heated brass iron with a measured 14% spring-back on release, three stations at 1/3-cycle offsets so something is always forming, dwelling and releasing. The spec does the card-scale arithmetic and states plainly that 2.6px of depth cannot carry the payoff — facet width (7.5px of channel narrowing) and facet contrast (0.035 L) do. |
| 2 | `nonpareil-comb` | loud | footer | **#1** | A marbling size bath whose comb pass *is* a multi-column band and whose endpaper *is* the terminal sheet — which is the footer job as the gap map defines it. Survives `dye-whorl` on a physical claim, not a styling one: no diffusion term exists, the pattern is conserved material boundaries advected as contours, which is exactly why it can be lifted off intact. |
| 3 | `quoin-lockup` | core | bento grid | **#5** | The only layout primitive here whose variable is **pressure** rather than cell assignment — `grid-bento-ascii` re-spans and `grid-bento-dense` re-packs, and neither has a failure mode. A tile pieing out of plane when a quoin backs off, then being planed flush, is the striking moment a bento grid has never had. |
| 4 | `collating-mark` | core | feature grid | **#5** | Gives a feature grid a second, independent channel: an ordering staircase down a spine rail that a misgather visibly breaks, legible without reading a cell. The card-scale step arithmetic is in the spec and is what forced the count from 8 down to 5 (rail `0.10*M`, 4.7px per step). |
| 5 | `former-fold` | loud | section transition | **#10** | The one concept here that answers gap #10's stated miss — a sequence that **hands off between sections** rather than scrubbing one scene. The outgoing section is neither destroyed (`transition-panel-crumble`) nor unfolded in place (`crease-fall`): it is a travelling web folded over a former board, with the former-offset correction as the artifact nothing else has. |
| 6 | `flying-splice` | core | marquee / logo ribbon | **#8** | Non-text payload and a speed driven by something real. Survives `ticker-tape-splice` only because the subject moved off the ribbon onto the roll stands: a running roll shrinking 64.6px → 27.5px while its RPM more than doubles to hold constant web speed. Carries a hard ≥30%-of-band-width constraint on the rolls. |
| 7 | `kiss-cut` | core | marquee | **#8** | The best inversion in the set — the marquee's content is what *remains after a subtraction*, the label never moves and the waste around it peels at a fixed angle onto a filling rewind. Ranked below `flying-splice` only because it is the second web ribbon. |
| 8 | `multiplane-crane` | loud | scroll sequence | #10 | Five opaque plates casting separation-scaled shadows on each other and racking through per-plate optical focus — a mechanic the registry has no version of, and the resting loop stands alone with zero scroll events, which is the only state the gate sees. Ranked here rather than higher because it **scrubs a single scene**, which is the pattern gap #10 says 4 of the existing 5 already are. |
| 9 | `work-and-turn` | loud | gallery | — | A gallery whose resting arrangement is deliberately not reading order, resolved by a real imposition fold; the retained gripper edge is the argument against a card flip and is checkable by eye. Gallery is 12 slugs, the least starved bucket in my slice. |
| 10 | `bolt-slit` | loud | route curtain | **closed** | **Flagging a conflict rather than resolving it unilaterally:** my brief lists route curtains in this slice, but `GAP-MAP.md` §4 lists preloader/route curtain as *explicitly closed* (5 slugs) and `gel-wash` was removed from that bucket. The mechanic is genuinely new — every existing curtain moves an intact covering, this one destroys it along a fibre grain and lets the fold's stored spring open it — and the spec names the dedicated `data-curtain-open` occlusion marker and its coordinates so it cannot repeat the bug that shipped three times. **Lead's call whether a closed bucket gets a sixth entry.** |

## Killed, and why

~26 candidates worked, 16 cut.

**Killed on the gap map / lead direction**
- *foredge-trim* (a divider as the fore-edge of a lift under a guillotine, draw-cut knife marks and
  clamp burnish as the subject). Written in full and killed on re-ranking: dividers are 21 slugs,
  the best-covered surface in my slice, and its argument against `edge-burnish-glaze` — reversible
  gloss versus material permanently removed — was the thinnest one in the set. A marginal divider is
  the wrong use of a slot when footer sits at 1.

**Killed on a concurrent scout's claim**
- *dandy-roll* (Fourdrinier watermark footer) → `material-dandy-watermark.md`. See above.

**Killed on an existing slug**
- *selvedge-tuck* and *headband-sew* (a divider as a woven selvedge with a weft tuck-in device; a
  divider as a sewn headband) → both collide with `welt-channel-close` (a needle locking one stitch
  at a working point while a flap folds shut behind it). Killed for the same reason twice, which is
  itself the signal that "a needle working along an edge" is a closed axis. Weaving is a fourth
  visit anyway: `warp-knit-tricot-lapping`, `background-truchet-weave`, `loader-loom-weave`,
  `tufting-gun-loop-pile`.
- *draw-cut-lip* (a guillotine severing a stack, the falling trim strip as subject) →
  `extrusion-die-cut`. Was rebuilt as `foredge-trim`, which is now also killed.
- *back-step-bead* (a divider as a welded plate seam laid in back-step sequence, sections drawn
  together by shrinkage) → `expansion-gap-breather` is already a divider sourced from
  continuous-welded-rail thermal expansion, and `weld-pool` owns molten metal.
- *wrack-line* (successive strandlines from a semidiurnal tide) → `ebb-flat`,
  `heatmap-calendar-tide`, `password-strength-tide`.
- *contour-plough* → `index-contour`, `hero-isobar-contours`, `ascii-engraving-contour`,
  `hachure-fall`, `terrain-erosion-carve`.
- *focal-slit* (route curtain as a focal-plane shutter slit) → `rolling-shutter-skew`, `blade-stop`.
- *doctor-curtain* → `gravure-cell-wipe`.
- *contact-sheet* (gallery as a darkroom contact sheet developing under agitation) →
  `skeleton-develop`, `fiche-step-repeat`, `photostat-reverse`.
- *zoetrope-slit* → `film-gate-weave`, `interlace-field-comb`, `curtain-leader-countdown`,
  `scrubber-film-strip`. Film transport is saturated.
- *register-hairline* (transition as separations pulling into register) → `press-register`,
  `pin-register`, `riso-drum-pass`.
- *shingle-lap* (a footer as a web press's shingled delivery stream, exposed strips as content) →
  the information design collides directly with the convert scout's `slate-gauge` (double-lap
  slating occluding every quote to its computed gauge margin). Same lap-exposes-a-margin idea.
- *job-case* (a footer as a California job case, boxes sized by letter frequency, type distributed
  back in and pulled out) → strong mechanic, killed on set composition: `quoin-lockup` is already
  letterpress and this set was already print-heavy.
- *festoon-dancer* (a logo ribbon storing slack in a festoon accumulator with a bobbing dancer roll)
  → folded into `flying-splice` rather than shipped beside it; same web press.

**Killed on the round brief's own rules**
- *changeover-cue* (route curtain as a two-projector reel changeover: SMPTE cue marks 12 ft and
  1.5 ft from the end, dowser, changeover). Real and precise, dead on arrival:
  `curtain-leader-countdown` is already the SMPTE Universal Leader and `film-gate-weave` holds
  academy leader. One artifact over from an existing curtain, in a bucket that already had five.
- *makeready-tissue* (a pinned scroll where successive press pulls even out as tissue patches build
  up under low spots). Visually weak by construction: the payoff is an image getting *more even*, a
  reduction in contrast over time. A concept whose climax is "less happens" cannot pass Filter 2.
- *drawdown-grid* (a feature grid whose pattern is a real weave drawdown) → weaving saturation, and
  a binary drawdown fights holding real feature content.

## Notes for the builder brief

- **Every concept here must pass the gate un-scrolled.** `scripts/verify.ts` loads
  `/preview/<name>` with no scroll and no autoplay and screenshots t=0/2.5/5, and in a card viewport
  `rect.height - innerHeight <= 0` so scroll progress pins at 0 permanently
  (`registry/loud/ebb-flat/component.tsx:613`). Every scroll-touching spec names its resting loop as
  the primary read and its scroll response as an added axis. **Six of the ten read no scroll at all.**
- **Read progress once per rAF from layout**, never in the scroll handler — `ebb-flat`'s docblock
  records why (bursty on a trackpad flick, delivered after paint on some engines).
- **`bolt-slit` is the only spec with a `gate` descriptor**, and it names the dedicated occlusion
  marker, its coordinates and why a rod/track/wrapper cannot be used
  (`registry/loud/curtain-austrian-gather/component.tsx:439`). Verify with `elementFromPoint` before
  and after the trigger.
- **Card-scale arithmetic is done in the specs, not left to the builder**, wherever a number was
  near the floor: `collating-mark` (N forced 8→5), `quoin-lockup` (4px gutter change named as too
  small, pie/plane cycle named as the primary channel instead), `joint-iron` (2.6px spring-back
  named as insufficient, facet width and contrast named as the carriers), `multiplane-crane`
  (offscreen blur-scale table and a named fallback ladder), `nonpareil-comb` (0.22 L minimum
  contrast across adjacent regions so a 4.25px column resolves in light theme).
- **`flying-splice` and `kiss-cut` must not ship in the same wave.** Both are web ribbons; the
  deciding test, written into both specs, is whether the dominant moving object is a pair of rolls
  or a peel front.

## One thing outside my slice, for the lead

The round now carries **two logo walls** (`matrix-return`, `spreader-bar`) from the convert scout
**and two marquees** from me, against a gap-map count of 1 logo wall and 3 marquees shipped. Those
are the right gaps (#3 and #8) but probably not four travelling bands of marks in one 30-component
round. If one has to go, `kiss-cut` is mine to drop — it is ranked 7 and fenced for exactly this.
