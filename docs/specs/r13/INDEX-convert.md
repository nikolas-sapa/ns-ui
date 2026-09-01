# r13 — conversion surfaces, ranked

Scout slice: closing CTA bands, logo walls, testimonial and social proof, waitlist and
email capture, pricing and plan selection.

Re-aimed after `GAP-MAP.md`. Gaps **#2 (CTA closing band, count 0), #3 (logo wall,
count 1), #4 (testimonial / social proof, count 2), #6 (waitlist capture, 1 of 53 form
slugs) and #7 (pricing, 4 with three of them siblings)** are all in this slice. Ten specs,
distributed against those five holes and weighted toward the two the lead named as the
round's highest value — a full-width closing band and a logo wall that is alive at rest:

| Gap | Specs |
|---|---|
| #2 closing CTA band (0 today) | `foil-block`, `air-bend` |
| #3 logo wall (1 today, and it stops) | `spreader-bar`, `matrix-return` |
| #4 testimonial / social proof (2 today) | `slate-gauge`, `bundle-band`, `tape-emboss` |
| #6 waitlist capture (1 today) | `rocker-blot` |
| #7 pricing (4 today) | `flag-rack`, `slip-wring` |

Checked against all 534 shipped slugs, the `feat/lab-pricing` worktree (`weir-crest`,
`brine-float`, `ebb-flat`, `pin-barrel`), the 59-slug removed-component ledger, and the
concurrently-written r13 specs on disk.

**`dandy-roll` was written and then killed.** It was a trust band on the papermaking
watermark, and two concurrent scouts had already claimed the same process —
`structure-dandy-roll.md` (footer, identical slug name) and `material-dandy-watermark.md`
(badge/seal, identical Beer-Lambert transmission model). Mine was the third and the least
distinct. `spreader-bar` replaced it, aimed at gap #3 instead.

## Ranking

| # | Slug | Tier | Gap | Why here |
|---|---|---|---|---|
| 1 | `foil-block` | loud | #2 | Hot foil blocking with a hard transfer threshold (96 °C **and** 0.34 MPa), so a strike visibly fails differently every time, and the spent foil web indexing 71 px per 4.6 s cycle gives the band an unforced resting loop. The registry's count for this surface is zero; this is the strongest mechanic in the set aimed at it. |
| 2 | `spreader-bar` | loud | #3 | The only concept anywhere in this round that handles **unequal optical weight**, and it handles it by physics: a mark's ink coverage sets where it hangs. Seven torsional pendulums at incommensurate periods with a draught term means it has no rest state at all — the exact thing `logo-cloud-settle` lacks. |
| 3 | `air-bend` | loud | #2 | Second closing band, deliberately. Press-brake air bending over-bends 4.6° and loses exactly that in the first 40 ms of release — the only elastic-recovery model in the registry, where every other "spring" is an easing on a position. The band is the section; the bend line is layout. |
| 4 | `slate-gauge` | core | #4 | The gap map asks for "a quote surface where the *reading* is the mechanic". Double-lap slating occludes every quote to its computed gauge margin, so the wall shows the first line of everything and the whole of one thing, and its geometry never changes. |
| 5 | `rocker-blot` | core | #6 | Gap #6 is specific: the capture must produce a real payoff, not a toast. Here the payoff is a located queue position, a durable session artefact and a referral state, all three built from the same uptake law. Nothing else in the registry moves ink off one surface onto another. |
| 6 | `flag-rack` | core | #7 | A cash-register indicator rack is a *sort*, not a mutation — every value is physically present and a change costs two plates crossing. Fills the gap between `split-flap-board` (mutate in place) and `counter-carry-ripple` (carries), and it is not a fourth liquid level. |
| 7 | `matrix-return` | loud | #3 | A closed circulation with a purely mechanical sort — the Linotype distributor bar releases each matrix by the shape of its own notch, no reader anywhere. Conserved population, so it can never settle or pile up. Below `spreader-bar` because it does not address optical weight. |
| 8 | `bundle-band` | core | #4 | Best aliveness in the set (Poisson arrivals, banding at 25, verification breaks) and the one social-proof surface that can show error as well as throughput. Ranked here because the pile it draws is **not** the number it reports, and that has to be stated loudly or a viewer reads it as data. |
| 9 | `tape-emboss` | core | #4 | Stress-whitening is a genuinely different relief cue from a bevel shadow — bright glyph interior, edges not darker than the ground — which is the whole argument against `card-number-emboss`, and it holds with the same sign in both themes. Trust marks are the thinnest part of gap #4. |
| 10 | `slip-wring` | core | #7 | Gauge blocks, where seam width (0.5 px wrung vs 2.0 px resting) is the commitment readout and removal is a shear rather than a lift. Last because it is the shape `GAP-MAP.md` §3.5 says gets rejected most often — a small mechanism metaphor on a small control — and because a 12 px add-on block is the card-scale legibility failure that cut `sear-notch`. Both risks are written into the spec as gates the builder must clear first. |

## Removed-ledger and never-rebuild check

No spec in this set is on the 59-slug removed list, and none re-opens a closed gap.
Three ledger entries touch this slice and are recorded in the relevant specs:

- `pneumatic-carrier-dispatch` (r11, cut in owner review) independently confirms the kill
  of the Lamson-tube capture concept below. Noted in `convert-rocker-blot.md`.
- `lamination-fold-shear` (r11, cut) was a sheet-folding mechanic. `air-bend` bends sheet,
  so its spec now carries the assumption that the failure was card-scale legibility and a
  gate to prove the 0.15 L step across the bend line survives a 320 px card.
- `flag-hoist-run` and `semaphore-arm-cast` (r12, cut) are signal flags. "Flag" in
  `flag-rack` is the cash-register trade term for a printed indicator tablet. The spec
  offers `indicator-rack` as a rename if the name invites the confusion.

`footing-course`, `gel-wash`, `tack-peel`, `day-tank`, `slack-reel` and `level-bubble` are
not proposed, and nothing here is sourced from `docs/specs/r10`, `r11` or `r12`.
Closed surfaces (rotating-word slot, funnel chart, heatmap, contact form, theme toggler,
preloader, 404, masonry gallery, lens) are untouched.

## Killed, and why

Roughly 25 candidates cut. The pattern is that this registry is already very deep on
printing presses, separation processes, liquid levels and postal machinery.

**Killed on a concurrent scout's claim**
- *Dandy-roll watermark* (trust band) → `structure-dandy-roll`, `material-dandy-watermark`.

**Killed on an existing slug**
- *Liquid-level pricing* (any tank, float, meniscus or head reading) → `weir-crest`,
  `brine-float`, `gauge-capacity-waterline`, `meter-quota-meniscus`. `GAP-MAP.md` #7
  names this explicitly: three of the four pricing slugs already read as siblings.
- *Banknote latent image* (two hatch angles, readable only at a glancing view) →
  `lenticule-swing` is two images behind slats swapped by viewing angle.
- *Testimonials on a bill spike* → `spindle-strike` already impales receipts on a spine.
- *Lamson pneumatic tube / cash carrier for capture* → `rapid-wire`, and
  `pneumatic-carrier-dispatch` was built on it and removed.
- *Brass mail chute* → `spiral-chute-accrete`.
- *Pipe-organ stop jamb as a plan selector* → `wind-regulator-bellows`.
- *Coin-sorting rail / graduated-hole tray as a tier picker* → `sorter-pocket-route`,
  `sieve-throw`.
- *Edmondson ticket tube rack + dating press* → `magazine-drop`.
- *Galley proof pulled on a proof press* → five presses already ship
  (`hero-letterpress-lockup`, `press-register`, `screen-flood-stroke`, `riso-drum-pass`,
  `gravure-cell-wipe`), and `GAP-MAP.md` §3.3 calls print reproduction exhausted at 40
  slugs. A sixth press is a restyle by weight of evidence.
- *Kardex visible-edge card file*, *Rolodex rotary index* → `carousel-card-riffle`,
  `stack-step-carousel`.
- *Thermal receipt printing* → `file-upload-thermal`, `contact-form-teletype`,
  `toner-fuse-streak`.
- *Carbon-copy multipart form* → `carbon-ply-fade`.
- *Letterpress numbering box for a queue position* → `counter-carry-ripple` owns the
  carry, and the carry is the numbering box's identity.
- *Taximeter / fuel-dispenser variator as a usage price reveal* → `frank-register`,
  `counter-carry-ripple`. A third odometer is a restyle.
- *Price-tag gun peel plate* → `sticker-peel`.
- *Guillotine clamp-then-draw* → `extrusion-die-cut`, `blade-stop`, `remnant-cut`.
- *Blanking press scrap skeleton* → `extrusion-die-cut`, and the name collides with this
  repo's own use of "slug".
- *Shot tower + roundness sorting* → `sieve-throw`, `winnow-chaff-drift`.
- *Newspaper stereotype flong* → `seal-roll` (a barrel rolls across, the quote presses in,
  the surface re-clays). Same impression-carries-the-quote story.
- *Take-a-number ticket dispenser* → `banner-tear-stub` plus `split-flap-board`. Two
  components in a trench coat.
- *Sandblast resist / abrasive frosting through a stencil* → `stencil-fill`, `scroll-defrost`.
- *Guilloche, engine-turn, burin security ornament* →
  `background-engine-turn-guilloche`, `ascii-engraving-contour`, `hero-burin-hatch`.
- *Hallmark / assay punch row* → `rating-stamp`, and inside my own set it overlapped
  `tape-emboss` on the same surface. Cut on both counts.
- *Bottle-capping crown crimp for a checkout commit* → `crimp-barrel-set`,
  `file-upload-seal`, `confirm-hold-wax`, and `GAP-MAP.md` puts 17 slugs in the CTA
  bucket already doing the confirm/payoff job. The gap is the band, not another confirm.

**Held as a reserve, not written up**
- **`gauge-plate`** (pricing). A standard wire gauge plate: you find a wire's gauge by the
  smallest slot it will pass, and the gauge number goes *down* as the wire gets thicker.
  Selection is by mechanical fit, and every slot you did not fit into stays on screen, which
  is the comparison. A reference lane feeds sample wires past at 8 px/s with a fresh
  gauge seating itself every 6.4 s, so it is alive at rest. Not written up because I am
  already contributing two pricing selectors and `chain-scale` also turns a continuous
  drag into a discrete ladder; the defence is that a gauge plate discretises by *fit* rather
  than by snapping an animated value. If that argument does not convince, the concept
  should die rather than ship.

## Cross-scout adjacencies to resolve before building

- `structure-flying-splice` is a logo **ribbon / marquee** on a web-press flying paster.
  `spreader-bar` and `matrix-return` are logo **walls**. Gap #3 is thin enough to justify
  more than one, but three logo surfaces in one round is too many — pick two.
- `material-cockle-swell` is a pull-quote block; `slate-gauge` is a testimonial wall.
  Different scope, different process, but both sit in gap #4. Worth a side-by-side.
- `material-frit-sinter` is a stat/KPI tile; `bundle-band` is a social-proof counter.
  Adjacent surfaces, unrelated mechanics.
- `material-spangle-freeze` is a galvanised-steel feature card. `air-bend`'s sheet has a
  mill finish. No conflict, but do not let the two drift toward the same specular treatment.
- `structure-quoin-lockup` and `hero-letterpress-lockup` are both letterpress. `foil-block`
  is foil transfer, not impression — the argument is in its spec §2 and should be checked
  against the quoin spec before both are briefed.

## Standing rules every spec in this set already carries

- Placeholder copy only. No prices, percentages, customer counts, uptime figures,
  guarantees, certification names, or quotes attributed to anyone.
- `--ns-accent` on interaction chrome only, and explicitly forbidden by name in the two
  places this project keeps smuggling it in: `air-bend`'s specular band and `foil-block`'s
  foil anisotropy.
- `--border` unused as a fill or stroke anywhere.
- A named, non-t0 reduced-motion freeze frame with the reason it was chosen, and a
  byte-stability argument for it.
- Geometry derived from `min(w, h)` so every one reads at card scale, plus an explicit
  legibility floor where the mechanic could hide the content (`spreader-bar`'s 34° cap,
  `slate-gauge`'s 44 px hit target, `slip-wring`'s seam-distinction gate).
