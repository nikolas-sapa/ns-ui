# Round 13 — orchestrator decisions

Binding. A builder must read this alongside the spec and BRIEF.md.

## D1 — paper-in-transmitted-light: one only
Four specs converged on paper read in transmitted light. Two were withdrawn by
their own scouts (convert-dandy-roll, material cast-wall/deckle-drain family).
Of the remaining two, `material-dandy-watermark` SHIPS (badge/seal — fills an
empty block surface; pure Beer-Lambert, no light source and no normal, which is
the deliberate optical opposite of the registry's grazing-light components) and
`hero-verso-showthrough` is CUT (hero is the deepest bucket at 48 slugs, and its
own scout flagged it as the set's quietest and its Filter-2 risk).

## D2 — wire-skim cycle length
`material-wire-skim`'s 20.9s cycle exceeds the gate's 5s screenshot window, so
the graded frames would only ever see the rough pass. Take the spec's preferred
fix: shorten the rough pass to 4.2s so a full pass sequence is visible inside
the window. Do NOT fix this by making the gate wait longer.

## D3 — the moving-band pattern, and its mandatory test
`material-peel-flow`, `material-frit-sinter` and `material-spangle-freeze` all
sweep a band across a monotonic process. That is an approved fix for the
"process that finishes and stops" auto-reject — it turns a temporal process zone
into a spatial one. It also has a specific failure mode, caught in this round on
spangle-freeze: once the process behind the band is permanent, the mature region
becomes a still image sliding, which is green on the gate and dead to the eye.

Every component using a moving band over a monotonic process MUST carry a
second, unforced process in the mature region (spangle-freeze uses parabolic
Fe-Zn interfacial alloy growth) and MUST pass this check before it is submitted:

> Crop the region the band has already passed. Compare t=0 to t=5s. If the two
> differ only by translation, the component FAILS.

## D4 — thinner bucket wins
When two scouts spec the same real-world mechanic, the one aimed at the emptier
GAP-MAP bucket ships and the other is cut, regardless of which was ranked higher
in its own set. Already applied: ascii-glyph-match over hero glyph-correlate,
convert-matrix-return over hero distributor-bar.

## D5 — travelling bands of marks: four specced, three ship
The round converged on four travelling bands: `convert-spreader-bar` (logo wall),
`convert-matrix-return` (logo wall), `structure-flying-splice` (logo ribbon),
`structure-kiss-cut` (marquee). Gap #3 is thin enough for two logo surfaces, not
three. SHIP the wall + the ribbon + the marquee: `spreader-bar`, `flying-splice`,
`kiss-cut`. CUT `matrix-return`, per both scouts' independent recommendation —
its mechanic is strong but it is the third-best of three on the same gap.

Consequence, recorded deliberately: `hero-distributor-bar` was cut earlier under
D4 in favour of `matrix-return`, so the Linotype distributor mechanic now leaves
the round entirely. A concept that won a D4 collision and later dies does NOT
revive the concept it beat — the loser lost on bucket depth, which has not
changed.

## D6 — closing CTA band: three specced, two ship
`convert-foil-block`, `material-peel-flow` and `convert-air-bend` all landed on
gap #2 after the re-aim. Two is right for a bucket at zero. SHIP `foil-block`
(hot foil, dual transfer threshold, spent-web indexing) and `peel-flow` (WebGL,
Orchard levelling). CUT `air-bend`: its identity is a 40 ms elastic release —
the weakest resting loop of the three — and the press/die family is already
carried by `foil-block` and `structure-quoin-lockup`.

This reverses my earlier read that both `air-bend` and `peel-flow` would build;
`foil-block`'s re-aim onto the same band is what changed it.

## D7 — slip-wring cut before build
`convert-slip-wring` is cut, not gated. Its own spec names two conditions it must
clear: GAP-MAP §3.5's most-rejected shape in this repo's history (a small
mechanism metaphor on a small control, 15 of 59 removals in one commit), and a
12 px block against the card-scale legibility failure that cut `sear-notch` and
`blowdown-seat`. A concept that needs two hard gates before a builder starts is
not worth a builder slot in a round with a full gap list. The `gauge-plate`
reserve is NOT promoted in its place.

## D8 — foil-block vs quoin-lockup
Both sit near letterpress. They are distinct and both ship: `quoin-lockup`'s
variable is PRESSURE distributing a layout, `foil-block`'s is a dual TRANSFER
THRESHOLD (96 °C and 0.34 MPa) deciding whether a mark takes at all. The
`foil-block` builder must state that distinction in the component's docs and
must not render a bed of type.

## D9 — a cut spec must be deleted or banner-stamped
The r10-r12 spec dirs are the round's worst trap: they contain specs for
23 components that were quarantined in owner review, they read as approved work,
and one scout cited a quarantined component twice as a positive model before
catching it. Round 13 will not do that to the next round.

Two acceptable end states for a cut concept, and no third:
- the spec file is DELETED (scout-hero's practice), or
- the spec file carries a `CUT — do not build` banner as its first line, with the
  reason (scout-nav's practice).

A spec sitting on disk with neither is a defect. Before this round is handed
over, every file in docs/specs/r13/ must be one of: built, queued in a wave, or
banner-stamped.

## D10 — nav slice ships 5, column-slack is the alternate
scout-nav ranked `column-slack` last against its own first-pass judgement and
flagged it at-risk: it is mechanically the strongest thing in that set (a rate
machine with an integrator, so a fast upward scroll condenses the bar — which the
three existing position-based navs structurally cannot do), but GAP-MAP #9 counts
five real navs already and names the missing pieces as a mega-menu and a mobile
sheet, not a fourth condensed bar.

Take the scout's own read: `automat-wall`, `blind-pawl`, `lantern-dial`,
`gondola-detach`, `weighbridge-deck` ship. `column-slack` is held as FIRST
ALTERNATE — promote it if a wave-1 component dies in review, rather than
backfilling with something unspecced.

`weighbridge-deck` ships with a standing condition: it is the closest thing in
the round to the settings auto-reject. It stays a strip. If it grows a
preferences panel it is cut, and the reviewer must police the accept/reject
settle-time symmetry its spec makes mandatory rather than taking it on trust.

## D11 — mutual-deference deadlock: the concept comes back
scout-hero and scout-ascii both ranked structural glyph matching (Xu/Zhang/Wong)
as their #1, each saw the other's spec on disk, each concluded the other owned it
under D4, and each stood down. scout-ascii additionally deleted its file. The
mechanic both scouts rated highest left the round because both deferred.

D4 decides who ships a contested concept. It does NOT license both parties to
withdraw. `hero-glyph-correlate` is restored.

Standing rule for future rounds: a scout that yields a concept under D4 must say
so in its index AND name the spec it yielded to. If the spec it named is not on
disk at merge time, the orchestrator restores the yielding scout's version. Two
scouts converging on one strong mechanic is a signal the mechanic is good, never
a reason to lose it.

## D12 — ascii slice ships 4; chain-slew cut
scout-ascii delivered 5 against 73 siblings, correctly. Four ship:
`ascii-thermal-history` (footer signature, gap #1), `ascii-double-height`
(testimonial band), `ascii-charset-shift` (feature grid — answers "a grid where
the cells carry the mechanic" directly), `ascii-figlet-smush` (CTA band).

`ascii-chain-slew` is CUT. It is a logo wall, and the round already ships
`spreader-bar` (wall) and `flying-splice` (ribbon) on a bucket of 1. Its own
scout ranked it last and named it as the one to cut. Its zero-translation
constraint was a genuine tie-break against `matrix-return`, but `matrix-return`
is already cut under D5, so the tie-break has nothing left to win.

## D13 — enumerate by description, not by tag
scout-ascii's first enumeration used the `ascii` tag, found 87 slugs, and missed
about 40 print/reproduction components that carry no such tag. The second pass, a
description-level keyword sweep over all 534 items, killed six of its ten
concepts. Tag-based enumeration is not sufficient for dedup work in this repo.
Any future scout or auditor sweeps descriptions, not tags.

## D14 — the luminance ladder is round 13's shared reference
`INDEX-ascii.md` §4 derives a six-stop luminance ladder giving per-theme canvas
alpha for target contrast ratios [1.35, 1.8, 2.6, 4.0, 7.0, 16.0], solved in
ENCODED sRGB because `ctx.globalAlpha` composites there, not in linear light.
Light and dark differ by up to 0.10 alpha at the middle stops, so a ramp tuned on
dark lands about one stop too pale in light. It also records the measurement that
`--border` is 1.26:1 against white, which is why the token is useless as a fill.

Every builder from wave 2 onward reads it before choosing alpha values, instead
of deriving their own. This is the round's answer to "check light theme early,
not as a final pass."

## D15 — bolt-slit cut: a closed bucket stays closed
`structure-bolt-slit` is a route curtain. GAP-MAP §4 lists that bucket as
explicitly closed: 5 slugs already ship and `gel-wash` was built there and
removed. The scout flagged it rather than resolving it unilaterally, which was
the right call, and the mechanic IS genuinely new — every existing curtain moves
an intact covering, this one destroys it along a fibre grain and lets the fold's
stored spring open it.

It is still cut. A closed bucket is closed on the strength of what already ships,
not on the strength of the next idea, and this round has a live gap list with
surfaces at 0 and 1. Mechanism quality does not reopen a closed surface — the
same reasoning scout-nav applied to itself when it cut `scroller-gate`.

Banner-stamp the spec per D9. If a future round reopens route curtains, this is
the first thing to build there.

## D16 — the round ships two footers
`structure-foredge-trim` (divider, bucket of 21) was traded for
`structure-nonpareil-comb` (footer, bucket of 1). Correct trade, and it stands.
`joint-iron` and `nonpareil-comb` both ship.

Standing condition on both: NEITHER responds to scroll. `footer-ascii-rule`, the
registry's only existing footer entry, is a back-to-top scroll instrument with a
sitemap attached. If either new footer takes a scroll input, the registry's three
footers collapse into one idea and the gap is not actually filled.

## D17 — specs are frozen once a builder is dispatched
`structure-joint-iron.md` was edited by its scout at 21:04, after its builder was
dispatched at ~21:00, and the edit changed a load-bearing number (the 2.6 px
spring-back is insufficient at card scale; facet width and contrast carry it).
The builder was told to re-read.

From wave 2 on: once a builder holds a spec, that spec is frozen. A scout with a
correction sends it to the orchestrator, who relays it to the builder. Two agents
writing and reading the same file with no lock is how a builder ships against a
number nobody intended.

## D18 — glyph-match ships in the ascii framing
Resolving D11. The deadlock was not a lost file: scout-ascii wrote
`ascii-glyph-match.md`, saw `hero-glyph-correlate.md` land, deliberately deleted
its own, and scout-hero withdrew after reading the file before it vanished. Each
yielded to the other. scout-ascii has restored it.

Exactly ONE ships, and it is `ascii-glyph-match`, aimed at a gallery / media tile
(12 shipped) rather than a hero wordmark (48 shipped). D4 gives it the thinner
bucket, and the deciding factor is that its nearest neighbour
`gallery-ascii-gradient-orientation` sits on that same surface, so the
non-restyle argument is testable against a real adjacent component instead of a
distant one. scout-hero is stood down and its restore countermanded.

Note for the handoff: scout-ascii declined to force this mechanic onto an empty
bucket to score a gap, on the grounds that answering a category by invention is
the documented `footing-course` / `gel-wash` failure mode. That is the correct
reading of the gap list. A gap is a place to look, not a quota.

## D19 — column-slack cut outright; the scout's ruling supersedes mine
D10 held `column-slack` as first alternate. scout-nav then cut it and named two
reasons, the second of which is stronger than my reason for keeping it: its 96 px
transport zone is a mechanism drawn beside a control (GAP-MAP §3.5, the
most-rejected shape in this repo's history), and the slug collides by name with
`slack-reel`, one of the fifteen cut in that commit. Cut, not held.

The scout volunteered this against the strongest thing it wrote, and named the
reasons rather than dropping it quietly. That is the behaviour this process wants
and it is recorded deliberately.

There is now NO first alternate. If a wave-1 component dies in review, the
replacement comes from the wave-2 spec set, not from a backfill.

## D20 — bindery count resolved; announcement bar is a known-open hole
scout-nav asked whether three components off one bindery was intended. It has
already shrunk to one: scout-structure killed `foredge-trim`, and `kiss-cut` is
die-cutting rather than binding. `structure-collating-mark` is the round's only
bindery component. Intended.

The announcement bar could not be filled: `announcement-bar-relay` owns queued
handoff with measured height easing, `banner-tear-stub` owns
dismissal-as-perforation, `shutter-telegraph-board` owns any bank of flipping
shutters. Accepted as an empty slot and carried into the handoff as a
known-open surface, NOT as a miss. A reported hole is worth more than a fourth
bar restyling one of those three.

## D21 — `--ns-muted` is never a wash
scout-hero's ladder pass traced three of seven miscalibrated values in its set to
one root cause: `--ns-muted` used at an alpha as "a lighter version of the ink".
At full strength it measures 8.45:1 in light and 6.12:1 in dark, so
`--ns-muted`-at-an-alpha lands on an uncontrolled ratio that differs by theme and
cannot be reasoned about against a contrast target at all.

RULE, round-wide: where the intent is a lighter version of the ink, use
`--foreground` at a ladder stop. `--ns-muted` is a token you use at full strength
for genuinely muted text, not a base to fade. This is separate from, and as
important as, the `--border` rule — it explains a class of "reads right in dark,
washes out in light" defects the project has been treating as individual
component bugs.

## D22 — a cue must ask for contrast the substrate still has
`justify-river`'s river cue was not miscalibrated, it was UNREALIZABLE: it lifted
paper above white (ceiling 1.000:1) or dipped it below dark paper (1.06:1, under
`--border`). A river is already paper. There is no ink in it to modulate.

The fix was to carry the cue on the river's BANKS — bounding words step one stop
up, the channel is never painted — which is also how a typographer actually sees
a river, works identically in both themes, and needs no direction inversion.

Generalised check, for every builder and every reviewer: before calibrating a
cue, confirm the substrate has headroom in the direction the cue asks for. A cue
that wants a region lighter than the lightest thing on screen, or darker than the
darkest, is not a number problem and no alpha will fix it. Redesign the cue onto
something that still has range.

## D23 — "light lands a stop pale" is a tendency, not a law
The round has been repeating that light theme is the harder case. It usually is,
and it is not always: `lumitype-disc`'s off-axis glyphs failed in DARK at 1.33:1
while reading fine in light, and `stem-snap`'s ghost halo failed in dark too. Two
of seven values broke the rule, and the spec's own prose asserted the opposite of
what its numbers showed.

That is the argument for the shared table rather than per-spec derivation: a
general rule applied by seven separate agents produces seven plausible wrong
answers. Solve against the ladder, in both themes, per element.

## D24 — a component must never boot empty (deterministic pre-roll)
Two builders hit the same defect independently, from opposite directions:

- `peel-flow` simulates a levelling field on a scrolling web. A blank field takes
  a full scroll lap — tens of seconds — to populate the frozen zone, so t=0
  rendered an empty right third. Fixed with a deterministic pre-roll that
  fast-forwards ~95% of a lap at a coarse but CFL-safe dt before the FIRST PAINT,
  on every entry path: mount, resize, reduced-motion, mode change. The resting
  loop and the reduced-motion timeline are now measured from that pre-roll
  baseline, not from sim-time zero.
- `foil-block` found its spec's own keyframes demanded nine accumulated ghosts by
  t=2.5s, impossible from a fresh mount inside one 4.6s cycle. Fixed by
  pre-seeding nine ghosts from the same continuous pressure field at synthetic
  negative strike times.

RULE: any component whose visual identity accumulates over time — a simulation, a
deposit, a wear pattern, a queue, a residue — must render its steady state at
t=0. "Alive at rest" means the component was ALREADY alive before you looked. A
component that visibly boots is a component whose first impression is its least
representative frame, and the gate screenshots at t=0.

The pre-roll must be deterministic and must run on every entry path, not just
mount. An IntersectionObserver resume that restarts from a blank field has the
same defect as a cold mount.

## D25 — calibrate to the discrete scheme, not the textbook constant
`peel-flow` found that the raw SI constants from Orchard's levelling equation
land about 33x too fast when dropped into a 13-point discrete biharmonic stencil
— fast enough to trip its own spec's kill criterion by levelling almost
instantly. It calibrated K_BASE to reproduce the spec's tau table via the
stencil's discrete eigenvalue instead, and documented why in the code.

Correct instinct, and general: a physical constant is stated for the continuous
equation. The moment it enters a discrete scheme on a fixed grid, the scheme's
own eigenvalues govern the rate. Reproduce the intended TIME CONSTANTS and note
the departure from the textbook figure; do not ship a literal constant that
produces the wrong behaviour and call it physically accurate.

## D26 — the ladder is corrected, and now carries its own round-trip check
scout-ascii re-derived both disputed cells and found scout-hero right on both:
`--border` vs light `--background` is 1.19:1 (it had omitted the +0.05 offset on
the darker term, computing 1.05/0.83077 instead of 1.05/0.88077), and light stop
6 is alpha 0.955, not 0.929. Four rounding fixes went in with them.

The cause is worth recording because it is NOT what either of us guessed. The two
solves agree to five decimals on every luminance value and on the encode step,
which is why they matched on five of six light stops and all six dark stops. It
was not a colour-space disagreement. Both errors were hand-arithmetic slips in
the light column's inversion, run six times by hand. One slip is nameable; the
other is not reconstructible from the record, and scout-ascii declined to invent
a cause for it, which is the right call.

THE DURABLE FIX IS THE CHECK, NOT THE VALUES: substitute alpha back through the
forward formula and compare against the target ratio. Neither error survives that
round trip. It is now run for all twelve cells (all pass to three decimals) and
is a stated requirement for any future edit to the table. Both wrong numbers
looked entirely plausible — that is exactly how they got published and cited by a
second agent.

Generalise it: a derived table that no one round-trips is a table of plausible
numbers. Any spec value obtained by inverting a formula gets substituted back.

## D27 — `--ns-muted` measured; the ceiling is theme-dependent (sharpens D21)
Measured contrast for a `--ns-muted` wash, light/dark: 1.99/1.89 at alpha 0.4,
3.03/2.86 at 0.6, 4.91/4.26 at 0.8, 8.45/6.12 at 1.0.

Two consequences sharper than D21 stated:
- The two curves track within ~6% below alpha 0.6, then diverge to 38% at full
  strength. That is WHY the defect hides: a builder tunes a mid-strength wash, it
  looks right in both themes, and it only breaks when someone later strengthens
  it. The bug is planted by one agent and detonated by another.
- Dark theme cannot reach stop 5 at all through a muted wash, since 6.12 < 7.00,
  and neither theme reaches stop 6. A spec asking for a "strong muted wash" is
  asking for a value that does not exist.

Final wording of the rule: wherever the intent is "a lighter version of the ink",
use `--foreground` at a lower stop. `--ns-muted` is legitimate at FULL strength as
a distinct second ink — `empty-state-mezzotint` and `empty-state-braille-orbit`
already ship that way — and illegitimate as a variable-strength wash.
`ascii-figlet-smush` had the defect and is fixed in place.

## D28 — unrealizable cues are now a pre-check, not a post-mortem (generalises D22)
Added to the ladder as §4.3. Before choosing a stop, compute the headroom toward
the extreme the cue heads for: C_max = (Y_lighter + 0.05)/(Y_darker + 0.05). If
the target ratio exceeds it, stop — no alpha exists and retuning cannot fix it.

Measured headroom: `--foreground` ink on paper is 17.93:1 light and 16.91:1 dark,
so the whole ladder fits. Paper toward white in light theme is 1.000:1 — literally
zero headroom. Paper toward black in dark theme is 1.061:1, below stop 1.

So a cue carried by making paper MORE PAPER is unrealizable in both themes, which
confirms `justify-river` independently. The general remedy: when the substrate is
paper, move the cue to the adjacent ink. A river, a gutter, a gap, a knockout and
a hole are all paper, and none of them can carry a value cue on its own.

## D29 — illustrative keyframes must be derived from the formula, or omitted
Five builders independently hit the same spec defect, each resolving it correctly
and each spending effort to do so:

- `foil-block` — the phase table summed to 4510ms against a stated 4.60s total,
  and the t=0/2.5s/5s narrative demanded a pre-strike outline and a post-strike
  web position simultaneously, plus nine accumulated ghosts inside one 4.6s cycle.
- `flying-splice` — the worked `R_max` example produced rolls occupying 12.7% of
  band width against the spec's own 30% kill criterion; and the knife "fires at
  +90ms" while the static frame at +90ms showed it "mid-sweep".
- `kiss-cut` — matrix tension was to "cross a 1.18 threshold" while the specified
  ±12% sine peaks at 1.12 and never reaches it.
- `slate-gauge` — the §4 angles at t=2.5s and t=5s do not fall out of the stated
  22s cosine, implying a faster zero-crossing than a symmetric sinusoid gives.
- `quoin-lockup` — five tiles at 4+2+2+1+1 = 10 cells cannot partition a 3x3 grid.

None of these is a builder error. Every one is a scout writing an illustrative
number by eye alongside a formula, and the two disagreeing.

RULE for future rounds: a spec's t=0 / 2.5s / 5s values and any worked example
must be COMPUTED from the spec's own stated formula, or omitted entirely. A
descriptive sentence ("direction has flipped and the wall reads brighter") is
fine and carries the intent. A fabricated number is worse than no number: it
reads as authoritative, it conflicts with the formula beside it, and every
builder pays to discover it independently.

Where a spec already carries both, the FORMULA wins and the builder documents the
discrepancy — that is what all five did, and all five were right to.
