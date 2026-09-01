# INDEX-hero — round 13, hero + type slice

Scout slice: landing-page **hero** and **type**. Full-bleed hero backgrounds, ASCII/glyph-grid
heroes, kinetic/typographic headline treatments, section-scale generative backgrounds.

**6 delivered out of 26 candidates.** Not padded to ten. Hero (48) plus ambient background (54)
is 102 of the 157 landing-axis slugs, so the non-restyle argument in §2 of each spec is the
make-or-break section and the kill bar was set there. Everything below is sourced on the
**technique axis** — dithering algorithm families, display-drive artifacts, rasterization and
composition mechanics, phototypesetting — never "a new field to simulate" (`GAP-MAP.md` §3.1) and
never "a new physical process rendered full-bleed" (§3.2 default-reject).

## Clearance checks run before finalising

- **All 534 shipped slugs** — nearest-slug argument written per spec against the actual nearest,
  not a distant one.
- **`GAP-MAP.md` §6 never-rebuild ledger (59 removals)** — no proposal matches any removed slug,
  including the 23 quarantined in rounds 10–12.
- **Closed categories** — none of the six is a liquid-metal hero, rotating-word slot, funnel
  chart, heatmap, 404, knot geometry, theme toggler, preloader/curtain, dither chart, choropleth,
  donut, masonry, contact form or lens. (`stem-snap`'s pointer applies a *local ppem bias*, not
  magnification — it is not a lens; if a reviewer reads it as one, the interaction should be
  dropped rather than the component.)
- **Prior-round spec directories `r8b`, `r9`, `r10`, `r11`, `r12`** — swept by keyword for all six
  mechanics. Only two real near-misses, both cleared: `r9/facsimile-drum-scan.md` (a helical drum
  scanner hero; **specced, never built, dropped**) shares "a hero with a scanning head" with
  `micr-flux` but has no glyph-derived signal and no trace — its subject is a raster reveal.
  `r9/bias-hysteresis.md` is a magnetic B/H loop *gauge*, not a read head. All other keyword hits
  were substring noise.
- **Concurrent round-13 scout specs in this directory** — two of my finished specs were
  round-level duplicates and were deleted (see kill list). Both mechanics ship in this round from
  the other scouts' framings.
- **Shared luminance ladder — done.** All six §6 sections now cite the six-stop ladder in
  `INDEX-ascii.md` §4 rather than deriving their own alphas. Full result table below.

---

## Ranked 1–6

| # | Slug | Spec | Surface | One line |
|---:|---|---|---|---|
| 1 | `subfield-contour` | `hero-subfield-contour.md` | background | Plasma-panel temporal subfield drive: the visible image is **dynamic false contour**, an artifact that exists only in the eye's integral across moving edges and in no frame of the source. A static region shows *nothing* — the inverse of `bitplane-cascade`, where a static region is exactly where the planes are legible. |
| 2 | `micr-flux` | `hero-micr-flux.md` | hero / kinetic type | MICR E-13B: a read head sweeps the headline and the waveform beneath it is `dΦ/dx` of the glyphs' own ink area, so type and trace are one object — you can point at a stem and at its doublet. Pointer-Y widens the head aperture until the doublets smear and the signature dies. |
| 3 | `justify-river` | `hero-justify-river.md` | section background | Real Knuth–Plass line breaking with a breathing measure, inking the **rivers**. Hits the one axis `GAP-MAP` §3 explicitly names as *not* exhausted — composition mechanics as a layout driver rather than a headline effect — and the registry has never inked an absence. |
| 4 | `lumitype-disc` | `hero-lumitype-disc.md` | hero / kinetic type | Second-generation phototypesetting: a 96-slot glyph disc at 8 rev/s, xenon flash exposures firing **out of string order**, a 4-position lens turret scaling one master to four optical sizes, and uncorrected escapement lag. Nothing locks and nothing is physical — the opposite of `hero-letterpress-lockup`. |
| 5 | `stem-snap` | `hero-stem-snap.md` | hero / type | TrueType grid-fitting at a drifting ppem: StemSnapV classes, blue-zone overshoot suppression across the ppem-17 cutoff, dropout control. The outline moves continuously while the bitmap changes in whole-pixel steps. |
| 6 | `hilbert-diffuse` | `hero-hilbert-diffuse.md` | background | Riemersma dithering: error carried in a 16-slot exponential FIFO along a **Hilbert curve** instead of a raster kernel, so the grain is isotropic and streak-free — the exact inverse artifact of the registry's Floyd–Steinberg component — with the traversal head drawn as a visible thread. |

### Process note — the mutual-deference deadlock, and how it resolved

Structural glyph matching (Xu/Zhang/Wong) was ranked #1 by two scouts and briefly ended up in
neither set. I read `ascii-glyph-match.md`, judged it a round-level duplicate of my draft, and
yielded on the thinner-bucket rule. scout-ascii independently read my `hero-glyph-correlate.md`,
reached the same verdict, and deleted its own file. Each of us saw the other's spec on disk and
concluded the other owned the mechanic.

**Settled: it ships from scout-ascii, aimed at a gallery / media tile.** That is the right
outcome and my yield was correct on the merits — not only is the gallery bucket thinner than
hero (12 vs 48), its nearest neighbour `gallery-ascii-gradient-orientation` sits on that same
surface, so the non-restyle argument is testable against a real adjacent component rather than a
distant one. My framing aimed the same mechanic at the most crowded bucket in the registry.

The deference rule is still the right rule. What was missing was checking whether the other
party had also applied it. **Standing practice for the rest of this round: when yielding a
concept to a sibling scout's spec, message the lead rather than only recording it in a kill
list.** A kill list is not a handshake.

### Luminance-ladder calibration pass — result

Every per-theme alpha in the six specs re-solved against `INDEX-ascii.md` §4's targets
`C = [1.35, 1.80, 2.60, 4.00, 7.00, 16.0]` in encoded sRGB. Mechanics, rates, geometry and freeze
frames untouched. What the six derivations actually measured, before correction:

| spec | element | light | dark | spread | verdict |
|---|---|---:|---:|---:|---|
| `micr-flux` | head rule | 5.60:1 | 3.51:1 | **1.60x** | worst in the set → both to stop 4 |
| `lumitype-disc` | disc off-axis | 1.77:1 | 1.33:1 | 1.33x | **dark below the floor** → both to stop 2 |
| `stem-snap` | ghost halo | 1.53:1 | 1.20:1 | 1.27x | **dark below stop 1** → 2 light / 1 dark |
| `micr-flux` | peak ticks | 5.75:1 | 4.71:1 | 1.22x | both to stop 5 |
| `justify-river` | body type | 2.15:1 | 1.81:1 | 1.19x | both already stop 2 → small correction |
| `hilbert-diffuse` | head thread | 2.69:1 | 2.38:1 | **1.13x** | **already right**, both already stop 3 |
| `micr-flux` | baseline rule | 1.81:1 | 1.70:1 | **1.06x** | **already right**, both already stop 2 |

**Three findings worth the lead's attention.**

1. **`justify-river`'s river cue was unrealizable in both themes** — not miscalibrated, impossible.
   It rendered a river as paper lifted above white (`#ffffff`, ceiling 1.000:1) or dipped below
   dark paper (`#0a0a0a` against pure black, **1.06:1**, under `--border`). A river is already
   paper; there is no ink in it to modulate. Fixed by carrying the cue on the river's **banks** —
   bounding words step one stop up, channel untouched — which works identically in both themes and
   needs no direction inversion. Detection, linking rule, `M(t)`, the DP and `STATIC_TIME` are
   unchanged. This is the one thing in the set that would not have worked at all.
2. **"Light lands a stop pale" is a tendency, not a law.** `lumitype-disc`'s off-axis disc glyphs
   failed in **dark** (1.33:1, at `--border`'s invisibility level) while reading fine in light, and
   my own prose in that spec had asserted the opposite. `stem-snap`'s ghost failed in dark too.
   Two of the seven values break the general rule, which is precisely why a solved table beats six
   independent derivations.
3. **Two rules unified across themes.** `lumitype-disc`'s flash halo (was +0.30 L dark / −0.26 L
   light) and `stem-snap`'s snap flash (was +0.22 / +0.16) are now "+2 stops" and "+1 stop"
   respectively, in both themes — because "more exposure" and "more ink" are the same ladder
   direction regardless of which way the sheet runs. Two theme-split magnitudes became one rule.

**Two table cells to check with the ladder's owner** — I re-solved it independently and agree
everywhere except: `--border` against light `--background` measures **1.19:1** on my solve, not the
1.26:1 the table states; and stop 6's light α of 0.929 delivers **14.85:1**, not 16.0 (0.955 hits
16.0). Neither changes a single decision above — `--border` is unusable either way and stop 6 is
"maximum ink" either way — and I have used the table's published values so the round stays on one
set of numbers. Flagging rather than diverging.

### The two at-risk entries, named

- **5 (`stem-snap`)** — `cursor-subpixel-fringe`'s own description says "as if a renderer were
  locally re-hinting glyphs to the pixel grid", so the words collide even though the mechanisms do
  not. That component draws three fixed RGB-stripe slivers on an abstract field and never touches
  an outline; this one quantizes a real outline and has no subpixel structure at all. The spec
  argues it in §2. If a reviewer still reads them as siblings, kill this one — the argument is
  load-bearing and I would rather lose it at spec stage.
- **6 (`hilbert-diffuse`)** — closest shipped adjacency in the set. `loader-ascii-diffuse-fill`
  already ships Floyd–Steinberg serpentine error diffusion and names *directional streaking* as its
  signature. The separation is real (no kernel, no raster, isotropic grain, 1-bit dots rather than
  glyphs, visible curve head) but it rests on the traversal being **drawn**. Spec carries an
  explicit builder kill test: if the Hilbert head is not legible as a moving thread, this is a
  second error-diffusion component and should be dropped.

### What every spec carries

Per-theme numbers in §6 written up front rather than deferred to a final pass — in four of the six
the light-theme case changes a *number*, and in `lumitype-disc` it changes the *direction* of a cue
while keeping the physical statement identical. A named non-`t0` `STATIC_TIME` with the argument
for why that frame is the most structured, computed from a constant so frames are byte-stable.
Lead-compensated pointer constants (`POINTER_TAU` 0.012, `VEL_TAU` 0.06, `LEAD_MAX` 24) advanced in
the rAF loop, never a plain exponential follower. An explicit statement of each component's
climactic moment and confirmation that `--ns-accent` is absent from it. No `--border` as a fill or
stroke anywhere — `micr-flux`'s baseline rule is the one place a builder would reach for it and the
spec names `--ns-muted` @ 0.35 instead.

---

## Killed — 20 concepts

### Killed on hero-bucket crowding, after the specs were written (3)

Cut on the round-lead's constraint that hero is the most crowded bucket on the landing axis and the
non-restyle argument is make-or-break. Each was already flagged as a weak entry in the previous
version of this index; each has a second, concrete reason. Full drafts are in this scout's
transcript and can be restored on request.

| Concept | Why cut |
|---|---|
| `verso-showthrough` — the next section's headline, mirrored, bleeding through a sheet of finite opacity under a raking backlight and a static fibre-formation field | Two reasons. It is the only one of the nine at real risk on showpiece Filter 2 — a true show-through peaks at ~7% and its light-theme fix was a gain bump, not a mechanism. And this round already carries **three** paper-in-transmitted-light specs from other scouts (`material-dandy-watermark.md`, `convert-dandy-roll.md`, `structure-dandy-roll.md`); a fourth is family crowding regardless of the mechanical distinction. Its distinguishing feature — that the ghost is *mirrored* — is a framing, not a mechanism. |
| `typeball-tilt` — tilt-and-rotate typeball resolving 88 states 15.5x/s with the live 7-bit whiffletree code | A whiffletree is precisely a **small mechanism metaphor**, and `GAP-MAP` §3.5 records that shape as having the worst kill record in the repo (15 of 59 removals cut in one commit). The "mechanism that selects vs. the mark left behind" argument is true, but the deliverable is still a typewriter typing a headline into a registry that already holds `nav-overstrike-typewriter`, `ticker-teleprinter`, `split-flap-board` and `punch-figure`. |
| `smoke-proof` — punchcutting; the counter struck as a positive white before the letterform exists, then 34 file strokes, soot, proof pull | Already flagged as first-to-drop. `GAP-MAP` §3.2 and §3.3 both push against the metal/print family, and this round already carries `structure-quoin-lockup.md`, `convert-foil-block.md` and `convert-matrix-return.md` in it. Four die-and-metal components in one round is the crowding problem the lead named, and the counter-first inversion is not worth being the fourth. |

### Killed against another round-13 scout's spec (2)

Both were written in full, then deleted after reading concurrent output in this directory. Both
mechanics ship in this round from the other scouts' framings, which is the correct outcome in
both cases — theirs are aimed at thinner buckets with closer, more testable adjacencies. Drafts
are in this scout's transcript.

| Concept | Killed by | Why |
|---|---|---|
| `glyph-correlate` — structure-based ASCII (Xu/Zhang/Wong, SIGGRAPH 2010), 32-sample sub-cell coverage vector matched by normalized cross-correlation against a 95-glyph bitmap atlas; hero wordmark, pointer raising sub-cell sampling to 8x16 against a second atlas | scout-ascii's restored `ascii-glyph-match` | One technique, two surfaces = a round-level duplicate. Ships from scout-ascii at **gallery / media tile** (12 slugs) against the same-surface neighbour `gallery-ascii-gradient-orientation`; mine sat in **hero** (48 slugs, the deepest bucket in the registry) and argued against a distant adjacency. This was my #1 and the yield was still correct. See the process note above. |
| `distributor-bar` — Linotype matrix circulation, 7-bit notch code sorted mechanically along the distributor bar; hero with magazine / bar / galley registers | `convert-matrix-return.md` | Same machine, same distributor bar, same notch-code sort. Theirs is a **logo wall** (1 slug, gap #3). Same rule, same outcome. |

### Killed against a shipped slug (13)

| Concept | Killed by | Why |
|---|---|---|
| Atkinson error diffusion (6/8 kernel, 25% of error discarded, blown highlights) | `loader-ascii-diffuse-fill` | That component's stated identity *is* error diffusion. A different kernel is a parameter change, not a technique. This is the clean version of the kill that `hilbert-diffuse` had to survive. |
| DoG / Sobel edge-direction ASCII | `gallery-ascii-gradient-orientation` | Already runs a 3x3 Sobel and buckets gradient angle into four glyphs. |
| FRC temporal dithering (6-bit panel, 2/4-frame duty patterns, per-cell phase) | `nav-blue-noise-scrim` | Both are "the mask changes every frame"; too fine a distinction to defend. Also intra-round overlap with `subfield-contour`. |
| Unicode-16 octant sub-cell grid (2x4 solid block octants) | `divider-teletext-mosaic`, `divider-mosaic-split`, `loader-braille` | Fourth member of the sub-cell block family; the 2x4 geometry already ships as braille. |
| Litho stone scumming / ink-water damping balance | `offset-fountain-split` | Same press; the ink/water axis is occupied. |
| Stochastic FM screening | `heatmap-year-stipple`, `background-lloyd-relax` | Blue-noise dot placement is house idiom (`GAP-MAP` §3.3), not an open axis. |
| Collotype gelatin reticulation (screenless continuous tone) | `crack-polygon-order` | A crack network that resets. The "no screen at all" argument was real but would not survive a glance at the two side by side. |
| Storage-tube CRT (zero decay, destructive full-screen erase flash) | `hero-beam-glyph`, `hero-long-exposure` | Vector-CRT wordmark and zero-clear accumulation both already ship. |
| Trinitron aperture grille, damper-wire shadows, corner convergence error | `cursor-subpixel-fringe`, `flyback-tear`, `interlace-field-comb`, `chargen-rom-slice` | Six CRT components already; `GAP-MAP` §3.4 says the axis is spent. |
| Drum-scanner helix / flying-spot scanner | `fiche-step-repeat`, `meter-matrix-scan`, and `r9/facsimile-drum-scan.md` (specced, dropped) | Raster-sweep family, well covered, and the drum version was already tried and dropped once. |
| Benton pantograph punchcutting machine | `minimap-pantograph`, `punch-figure` | A two-panel diagram, not a hero. |
| Rowland ruling engine, lead-screw periodic error and ghost lines | `background-engine-turn-guilloche`, `dial-moire` | Ruled-grating-with-a-beat territory is held twice. |
| OpenType shaping (GSUB/GPOS, cluster boundaries, mark attachment) | — | Reads as a developer tool: `showpiece-recipe.md` Filter 1 auto-reject. |

### Killed on the round's own rules (2)

| Concept | Why |
|---|---|
| Prepress trapping (choke / spread on an overprint edge) | Trapping is a two-ink phenomenon and is meaningless monochrome. Auto-reject on "anything whose identity is a hue". |
| Monotype punched-ribbon caster (ribbon read tail-first, justification wedges set before any character casts) | Wonderful mechanic, but a third hot-metal concept alongside the shipped `hero-letterpress-lockup`. Redundant. |
