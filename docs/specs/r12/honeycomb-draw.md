# honeycomb-draw

**tier:** core

**product surface it replaces:** background / divider texture panel (a bordered
grid-pattern filler behind a section or card, the kind currently reached for
via `background-truchet-weave` or `grid-magnetic-lattice`).

**the real mechanic, with source:** Honeybees build comb by standing in
clusters and extruding wax scales, chewing them into rough circular tubes at
roughly uniform spacing. The tubes start as circles; because the wax is warm
and plastic and the workers pack tubes at near-equal spacing and pressure,
surface tension at the shared walls relaxes each three-way wall junction
toward the ~120 degree angle that minimizes total wall length for a given
area — closely packed circles collapse into a hexagonal lattice through pure
local relaxation, no bee ever "decides" to build a hexagon (Pirk et al. 2004,
Bauer & Bienefeld 2013 - self-organized hexagon formation from circular cell
packing).

**one-sentence mechanic description:** A field of wax cells starts as loosely
packed circles that locally relax, wall by wall, into a tight hexagonal
honeycomb, with new circles seeding in from one edge to keep the front alive.

**rendering approach:** 2D canvas. Cell centers on a jittered triangular
lattice, spacing derived from `min(container.w, container.h) / 11` (so ~11
cells span the short axis at card scale). Each cell tracks a scalar `radius`
(0 to target) and a `wallAngleError` used only to drive the visual wall-bend,
not physics precision.

**REAL NUMBERS:**
- Cell target spacing: `s = min(w,h) / 11`, jitter ±0.12s per seed at spawn.
- Growth: each cell's radius eases from 0 to `0.62s` over 2.2s (ease-out
  cubic), simulating wax deposition.
- Relaxation: once two neighboring cells' radii overlap by more than 6% of
  `s`, the shared wall begins straightening — wall midpoint slides toward the
  Voronoi-correct position over 1.4s (critically-damped spring, stiffness
  k=90, damping ratio 1.0), which is what visibly performs the circle→hexagon
  collapse rather than snapping.
- New seed rate: 0.6 cells/s spawn along the container's leading edge
  (left edge, one per ~s px of edge height) whenever fewer than 85% of grid
  slots are filled.
- Full relax→hex settle takes ~3.6s per cell from spawn; a given card at 11
  cells wide reaches full coverage in ~14s from empty, then holds steady
  state (cells replacing themselves is NOT part of the loop — see resting
  loop below for what stays alive after that).
- After full coverage, one random existing cell every 4-7s (uniform) is
  marked "recapped": its wall strokes flash to `--foreground` for 260ms then
  fade back to `--border` over 900ms, simulating a cell being re-drawn/
  reinforced — this is what keeps the piece alive at rest indefinitely once
  growth finishes.

**resting loop (t0/2.5s/5s):** t0 shows a mostly-empty field with a handful
of soft circles seeded at the left edge, no straight walls yet. At 2.5s the
edge column has grown into full circles starting to flatten into hex walls
while new circles seed one column deeper. At 5s a visible hex lattice has
formed 2-3 columns deep behind the growth front, with the front itself still
mid-relaxation further right. Once the whole grid is filled (~14s in), the
loop continues via the recap flash (never fully static).

**reduced-motion freeze frame:** the lattice pre-computed to its fully-filled,
fully-relaxed state (skip stright to t=20s equivalent) with zero cells mid-
relaxation and no recap flash firing — named `SETTLED_COMB`, the one frame
where every wall is already a straight hexagon edge.

**interaction:** none. Purely ambient; no pointer/press affordance. Must NOT
tie any recap flash or growth rate to `--ns-accent` — walls are `--border`
at rest, `--foreground` only for the brief recap pulse (luminance change,
not hue).

**light vs dark:** cell walls stroke in `--border` (the ~1.1:1ish separator,
acceptable here since it's genuinely a hairline separator, not a fill);
circle fills (pre-relaxation, still-round cells) use a very low-alpha
`--ns-muted` wash so the unrelaxed cells read as soft blobs against
`--background` in both themes without becoming a filled shape competing with
foreground content. Recap flash uses `--foreground` directly, which has
correct contrast in both themes by construction.

**kill criteria:** if the circle-to-hexagon relaxation isn't visually
distinguishable from a simple hex-grid fade-in (i.e., it always looks like a
static grid with opacity ramping rather than walls visibly straightening),
the whole mechanic reduces to "grid appears" and should be cut.

**legibility:** the one thing to follow is a single wall straightening from
a round overlap into a hex edge; the 1.4s spring settle is slow enough to
watch happen, and the 4-7s recap flash gives a second, separate followable
event once the grid is full.
