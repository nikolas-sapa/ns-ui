# toner-fuse-streak

**tier:** core

**product surface it replaces:** loader / progress indicator — content "prints in"
instead of spinning or fading in.

**the real mechanic, with source:** the xerographic imaging cycle used in every
laser printer and photocopier since the 1970s: a photoconductor drum is charged
uniformly (~-600V), selectively discharged where a laser/LED writes the image
(exposed areas drop to near 0V, unexposed stay near -600V), toner particles
(~8-10µm, carrying the opposite charge) are pulled onto the still-charged
regions by the electrostatic field, transferred to paper by a corona, then
fused by a heated roller pair (~180-200°C nip, tens of ms dwell). Two
well-documented failure artifacts ride along with the cycle: **edge deletion**
(fringing-field effects thin or drop toner right at the boundary of small
features — hairline rules and small text serifs go first) and **toner
starvation** (a large solid fill area locally depletes the toner cloud faster
than it can replenish, producing a streaky, lighter band toward the trailing
edge of the fill). Source: standard xerographic process description
(charge/expose/develop/transfer/fuse), documented failure modes from print
shop service literature.

**one-sentence mechanic description:** a loading surface renders its content as
if a laser printer were imaging it line by line — charge, then a selective
discharge sweep, then toner development that visibly starves on large fills
and drops out at fine edges before the fuser locks it down.

**rendering approach:** 2D canvas, `w-full h-full`, backing store sized to
container's smaller dimension × its aspect (cap DPR 2). Content is rasterized
once off-screen into a luminance mask (from a caller-supplied children
snapshot, or a built-in placeholder block/line pattern if no content is
passed) at a resolution of one "toner cell" per ~3px of the mask. Grid: mask
resolution scales so ~120-160 cells span the container's smaller dimension.

**REAL NUMBERS:**
- charge sweep: uniform field applied instantly at t0 (drum charge is not a
  visible phase in the real process, so it is not rendered as a beat)
- expose/develop sweep: one horizontal pass, 900ms top-to-bottom (this is the
  ONE followable event per round-9 rule — the real engine images a page in
  under a second at >20ppm; decoupled and slowed to a legible top-to-bottom
  wipe rather than rendered 1:1)
- edge-deletion: any mask edge (luminance gradient over <2 cells) renders 15-25%
  under-toned for the first 400ms after the wipe passes it, then fills to full
  density — a visible "thin edges catch up last" effect
- toner-starvation streak: any contiguous fill region wider than 18% of the
  mask's smaller dimension gets a randomized streak band (18-30% opacity
  reduction, 8-14px tall, positioned in the trailing 30% of the fill along the
  wipe direction) that fades in over the 400ms after the wipe passes and holds
  steady (real: solid-fill density loss is a persistent artifact, not a
  transient)
- fuse settle: 220ms after the wipe completes, a single soft radial highlight
  (luminance only, +8% brightness, ~180ms decay) sweeps once across the full
  frame at the nip roller's implied contact line — the "fuse flash," reads as
  the roller pass locking the image down

**the resting loop:** t0 = mask fully un-toned (faint --border-derived outline
of the content shape only, ~4% opacity fill). t=2.5s = a full cycle has
completed and held for ~1.5s at full density with streaks and edge-thinning
visible; a new cycle has just begun its wipe (~40% down). t=5s = mid-cycle at
a different phase again (the loop period is 2.6s: 900ms wipe + 1.5s hold +
200ms reset-to-blank), so 2.5s and 5s land at different points and read
visibly different from each other and from t0.

**reduced-motion freeze frame:** hold at the fully-fused, full-density frame
with both artifacts visible (streak band + thinned edges) — the most
structured, most "read the content" frame, not the blank t0 state.

**legibility:** the ONE thing to follow is the wipe line itself — a single
soft horizontal band, brighter than its surroundings by ~6% luminance,
traveling top to bottom over 900ms, with toner visibly "catching" behind it.
900ms top-to-bottom is slow enough that a viewer's eye can track the wipe
position at any instant; it is deliberately much slower than the real engine's
page-per-second imaging rate specifically so it stays followable.

**interaction:** none. This is a passive loading state — it must not respond
to hover/press with anything beyond default focus-visible chrome if it happens
to wrap a control. It must NOT use `--ns-accent` for the wipe band or the fuse
flash; both are luminance-only per the standing rule.

**light vs dark theme:** un-toned mask is `--border`-derived at ~4% mix with
background in both themes (a whisper of the shape, not invisible). Full toner
density reads as `--foreground` at ~85-95% opacity depending on theme (dark
theme can afford full 95%, light theme is checked first and may need to hold
under 90% to keep the streak artifact visible against a lighter starting
point — streaks must remain a *relative* dip, not clip to indistinguishable
near-white).

**kill criteria:** if the wipe reads as a generic loading shimmer once the
toner-starvation streak and edge-deletion thinning are removed for
simplification, this is a reject — the artifacts are the identity, not
garnish. If it cannot render without a caller-supplied content mask (i.e. the
built-in placeholder pattern is the only thing it ever looks good with), it is
too narrow to ship as `core`.
