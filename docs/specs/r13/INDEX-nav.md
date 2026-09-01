# INDEX-nav — round 13, nav and page-furniture slice

Scout: `scout-nav`. Slice: landing-page **furniture and navigation** — the
chrome around the content.

**~24 candidates considered. 5 ship. 19 killed.** Fourteen died at concept
stage; **five more died after their specs were written**, on evidence that
only existed once `GAP-MAP.md`, `DECISIONS.md` and the sibling scouts' specs
landed. The brief predicted the highest kill rate of any slice here; that is
what happened, and it is the right outcome — the obvious nav answers are all
templated and the registry already holds most of them.

Checked against: all **534** registry slugs (`registry.json` titles +
descriptions), `crease-fall` on `feat/lab-menu`, `sieve-throw` on lab-search,
`GAP-MAP.md` §3 (axis saturation), §4 (gap list + closed list), §6 (the 59-slug
removed-component ledger), `DECISIONS.md` D1-D8, and every sibling scout spec
on disk.

**No spec here cites an r10/r11/r12 component as a model.** Verified by grep
across all 10 files against the full quarantine list — zero hits. The only
components cited as positive precedent are shipped registry slugs
(`nav-site-condense`'s `<dialog>` pattern) and the negative lessons in
`docs/showpiece-recipe.md` and `docs/review-workflow.md` (`seam-gild` /
`starch-shear` on autoplay-vs-aliveness, the `curtain-*` `expect`-marker
failure).

---

## Ships — ranked 1-5

Ranked on GAP-MAP's own rule: *a concept that answers a named gap outranks a
technically better concept that answers none.*

| # | slug | surface | one-line justification |
|---|---|---|---|
| 1 | **`automat-wall`** | mega-menu | GAP-MAP #9 names **"a mega-menu"** as one of exactly two missing pieces in site-nav furniture, and the registry has zero. The only panel here with **per-cell state and a service round that runs while it is shut** — the four nearest slugs (`menu-nested-trays`, `context-menu-unfold`, `dropdown-drape`, `crease-fall`) are all one-surface folding claims with no closed-state behaviour. Lands on the **multi-element choreography** axis §3 names as not exhausted, and is clear of §3.5 entirely. Best a11y payload in the set: disclosure-not-menu (no false `aria-haspopup`), a genuinely occluded gate marker, a reasoned refusal of `aria-live`. |
| 2 | **`blind-recoil`** | mobile menu sheet | GAP-MAP #9's **other** named missing piece: "a mobile sheet that is a component rather than a page". Position-dependent spring torque plus a gravity pawl give an interaction nothing in the registry has — **to close it you must first pull it further open** — and three detents make partial reveal a mechanical state, not a slider value. **Renamed from `blind-pawl`** and carrying an explicit §3.5 defence (addendum §9): the blind *is* the sheet at viewport scale, not a mechanism badge beside a control. The `inert` + `aria-hidden` treatment of unrevealed bands is the strongest single a11y argument in this slice. |
| 3 | **`lantern-dial`** | anchor / section progress | The only component in the registry that **anticipates**: the hall lantern commits to a direction from `velocity * lookahead` before the pointer arrives, and can be wrong and correct itself. Continuous-between-floors is the exact inverse of `decatron-step-ring`. Moves toward GAP-MAP #10's "hands off between sections rather than scrubbing one scene". **Carries one named build risk** (addendum §9): the 9x9 selector window is a lead screw in a box and is §3.5-exposed; the spec names the drop-in replacement (needle quiver at ±1.5°, 0.8 Hz) and tells the builder to put its fate in the review notes rather than defend it silently. Also explicitly disambiguated from the four r10-r12 signalling quarantines. |
| 4 | **`gondola-detach`** | floating CTA dock | The reference's own engineering point — *carriers slow down exactly where a human has to read* — **is** the perceptual budget answer, so the constraint and the mechanism are the same object. Cheapest to build of the five, most robust resting loop (a translating rope lay that runs with zero carriers on screen). Docked to 4 honestly: a floating dock appears on no named gap list, and `capstan`/`slack-reel` are on §3.5's list, so the spec has to argue the rope spans the dock rather than sitting in a corner. |
| 5 | **`weighbridge-deck`** | consent strip | A measurement-integrity gate is a genuinely novel, anti-dark-pattern read on consent: the strip refuses to commit a number that is still moving and says so with a motion lamp. Its §3.5 defence is the strongest available — **the mechanism is behavioural, not a drawing**, and survives deleting the deck elevation entirely. Ranked last because the surface is on no gap list and is the closest thing here to the settings auto-reject: it must stay a **strip**, never grow a preferences panel, the accept/reject settle-time symmetry must actually be measured, and all copy is placeholder per the scope tripwire. |

---

## Cut after specs were written (5)

Each has a complete spec on disk carrying a `CUT — do not build` banner,
retained only so the orchestrator can overrule with the argument in hand. I am
not asking for any of them back.

| slug | surface | why it died |
|---|---|---|
| `column-slack` | scroll-condensed nav bar | Mechanically the strongest thing I specced — a **rate** machine with an integrator, so a fast scroll *upward* condenses the bar and slow scrolling expands it, which the three existing position-based navs structurally cannot do. Killed on two independent GAP-MAP grounds: #9 counts five real navs and says the missing pieces are a mega-menu and a mobile sheet, **not a fourth condensed bar**; and §3.5 — its 96px transport zone is a mechanism drawn beside a control, the most-rejected shape in the repo, with the slug colliding by name with `slack-reel`, one of the fifteen cut in that commit. Two reasons is decisive. |
| `scroller-gate` | theme switcher | GAP-MAP §4 lists the theme toggler as **explicitly closed — "do not re-open"** (`toggle-theme-ascii`). Mechanism strength does not reopen a closed surface. |
| `log-heave` | back-to-top / scroll affordance | GAP-MAP #1 says `footer-ascii-rule` is already "a back-to-top scroll instrument with a sitemap attached, **not a footer block**", and that the open gap is the footer band itself. A second back-to-top instrument answers the half of that surface the repo already over-answers. Killed on its own strongest claim being irrelevant. |
| `gather-chain` | multi-section step trail | **Collides with `structure-collating-mark`** — same bindery gathering line, same pockets, chain and saddle, same **caliper**, same misgather payload. Per **D4** the feature-grid bucket (#5, 6 slugs) is thinner than the nav bucket, so mine loses. *Superseded clause, recorded so it is not re-derived:* this kill was originally argued partly on three components coming off one bindery, counting `structure-foredge-trim`. That count no longer holds — `foredge-trim` was traded for a second footer after this index was first written — and the round now carries exactly one bindery component. The direct collision above is what the kill rests on. |
| `distributor-bar` | language switcher | **D5** records that after `convert-matrix-return` was cut, "the Linotype distributor mechanic now leaves the round entirely", and that a cut winner does not revive the concept it beat. A third distributor concept does not revive it either. Recorded because the spec carries the best single a11y detail produced in this slice — `lang` on every `role="option"`, so a screen reader pronounces "Deutsch" in German — worth stealing into whatever language switcher eventually ships. |

---

## Killed at concept stage (14)

| candidate | mechanic | why it died |
|---|---|---|
| 404 / empty page (x3) | cinema changeover cue dots; returned-parcel damage tally; blank-plate proof | **Closed** in GAP-MAP §4 (four 404s ship, six `empty-state-*`, bucket 12 deep). |
| route curtain / page-load (x2) | dual-projector reel changeover; theatre iron safety curtain | **Closed** — loader/curtain is the second-largest bucket on the landing axis at 63, and `gel-wash` was built and removed there for answering the category by invention. |
| announcement bar | hotel / ship **annunciator drop board** | Mechanically distinct from `shutter-telegraph-board` but **visually indistinguishable** at card scale — both a bank of flipping louvred shutters. `announcement-bar-relay` and `banner-tear-stub` hold the surface. |
| nav bar | mechanical **split-flap departure board** | `split-flap-board` ships; a nav in flap cells is that slug with different content. §3.4 also records display hardware as near-exhausted at 32 slugs. |
| nav bar | signal-box **lever frame** and tappet locking bed | Auto-reject: the honest surface is an interlocking table. `docs/round-playbook.md` records a railway-interlocking concept already killed on this exact filter; `tabs-rail-points` and `guardrail-interlock-keys` hold the mechanic. |
| section progress | **tide gauge / river stage board** | Restyle of `toc-minimap-mercury` (a level climbing a graduated rail), in a water family five deep. |
| CTA dock | **paternoster lift** | Redundant with `gondola-detach`; the gondola's decelerating station is the better answer to the readability constraint. |
| CTA dock | **cable-car grip** on a constant-speed cable | Same redundancy; the cable/counterbalance corner is `passing-loop`'s. |
| nav beacon | **lighthouse characteristic** | `tour-spotlight` is already a lighthouse, `fresnel-flash-group` was cut in r12, and a flashing element beside body copy blows any sane perceptual budget. |
| announcement queue | **carillon pinned barrel** | `lug-cage-tally` already runs pin wheels at mutually-prime rates past a fixed read mark. |
| nav | **Lamson pneumatic tube** network | `airlift-slug-flow` already injects discrete slugs into a vertical conduit; `pneumatic-carrier-dispatch` was also cut in r11. |
| nav | **change-ringing** method permutation | Superb loop, disqualified by the slice's own constraint: its content is reordering the row, i.e. moving nav labels next to readable copy. |
| section marquee | **escalator comb plate** | Marquee belongs to `scout-structure`. |
| back-to-top | mine headframe **Koepe friction winder** | `brass-check` works the pit-head lamp room; the counterbalanced-pair claim is `passing-loop`'s. |

---

## The one slot I could not fill honestly

The lead named six pieces of open ground: mega-menu, mobile sheet,
scroll-condensed nav, anchor/section progress, floating CTA dock, announcement
bar. I have the first five (with the condensed bar cut on GAP-MAP's own
evidence). **The announcement bar is the gap I failed to fill.** Three
mechanics reached the shortlist and all three died on real duplication —
`announcement-bar-relay` already owns queued handoff with measured height
easing, `banner-tear-stub` owns dismissal-as-perforation, and
`shutter-telegraph-board` owns any bank of flipping shutters. I would rather
report an empty slot than pad the set; a fourth bar that restyles one of those
three is exactly what the removed-component ledger is full of.

---

## Standing risks the builders must carry

- **`--ns-accent` discipline.** All five specs confine accent to
  `:focus-visible` rings and CTA fills, in an explicit table. The repo's most
  repeated defect: sample R/G/B across each component in both themes and
  confirm equality everywhere else.
- **Light theme first.** Three of the five depend on a faint mark
  (`@ 0.16`-`@ 0.28`) at its worst on a light `--background`. Each spec names
  the mark and what backs it up structurally.
- **The gate cannot see an `autoplay` descriptor.** Every resting loop here is
  an unconditional rAF or `infinite` keyframe, with the t=0/2.5/5 arithmetic in
  §4 of each spec. The builder must still confirm the three screenshots differ
  rather than trusting the arithmetic — this is how `seam-gild` and
  `starch-shear` were lost.
- **`expect` must point at a genuinely occluded marker.** `automat-wall` and
  `blind-recoil` both have open/shut states and both specify a dedicated marker
  element rather than a frame, track or trigger — per the `curtain-*` failure
  in `docs/review-workflow.md`.
- **§3.5 is the live threat to this slice.** Four of the five carry an explicit
  addendum §9 assessing their exposure to the small-mechanism-metaphor shape
  and, where exposed, naming what to cut first. If an owner reads any of these
  as a badge on a control, the addendum already says which part to delete.
- **Card-scale legibility.** The second failure mode in the ledger
  (`sear-notch`, `blowdown-seat`: "both worked, neither could be read"). Every
  §8 here gives the geometry at 400x260 and names what degrades; the builder
  must verify at dsf 2, not dsf 1.
- **Scope tripwire.** `weighbridge-deck` touches consent copy. Placeholder
  categories, weights and labels only — real consent wording is an owner
  decision and must be surfaced, not written.
