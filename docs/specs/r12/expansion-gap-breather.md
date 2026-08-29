# expansion-gap-breather

**tier:** core

**product surface it replaces:** a divider/spacer between two
independently-sized layout regions (divider) — a seam that visibly absorbs
the size mismatch between its neighbors instead of being a static rule.

**the real mechanic, with source:** continuous welded rail (CWR) is laid
with small expansion gaps at intervals, or terminates in a breather switch
with long tapered blades, specifically so the rail can grow and shrink with
temperature without buckling in heat or pulling apart in cold — the gap
width (or blade overlap) continuously tracks rail temperature. Source:
railway permanent-way engineering, CWR expansion joints and breather
switches, standard practice for jointless track.

**one-sentence mechanic description:** A rail joint's gap continuously
widens and narrows as the rail expands and contracts with temperature,
absorbing the mismatch so the track never buckles or pulls apart.

**rendering approach:** DOM/SVG divider, full height of its container;
width derives from the gap's current opening, clamped to a min/max so it
can sit inline between two flex/grid children.

**REAL NUMBERS:**
- Real steel thermal expansion coefficient: 11.7×10⁻⁶ per °C.
- Real rail-surface temperature range (temperate climate): roughly −10°C to
  +50°C, a 60°C swing (rail runs hotter than air in sun).
- A 60m fixed rail length under that swing would want ~42mm of length
  change if fully unrestrained; CWR restrains most of it, leaving
  expansion joints/breather switches to absorb the residual — typical
  breather-switch tapered-blade travel is on the order of 20–100mm
  depending on design and anchor spacing.
- Rendered/simulated: a "rail temperature" sine, 14-second period (rendered
  — the real cycle is diurnal, decoupled per the round-9 rule), amplitude
  maps to a gap width oscillating between 4px (hot/expanded, gap nearly
  closed) and 22px (cold/contracted, gap open); the tapered-blade edges are
  drawn as angled, interlocking teeth sliding past each other, not a plain
  rectangular slot widening.

**the resting loop:** t0 shows the gap at some mid-width with the tapered
teeth partially interlocked; at 2.5s (past a sixth of the 14s cycle) the
gap has visibly widened or narrowed and the teeth have slid further along
their taper; at 5s (past a third of the cycle) the gap is at a materially
different width than both prior samples, moving in one consistent direction
across all three.

**the reduced-motion freeze frame:** freezes at the mid-cycle frame (gap at
its average width, teeth half-interlocked) — the most-structured frame,
showing both the open gap and the interlocking geometry, rather than a
fully-closed or fully-open extreme.

**interaction (if any) and what it must NOT do:** none required as a pure
divider. If used adjacent to resizable panels, the gap's rendered width may
additionally respond to the real layout mismatch it's absorbing — but it
must NOT stop breathing when idle; the ambient thermal motion is what makes
it alive at rest independent of any layout event.

**light theme vs dark:** gap and teeth are `--foreground` strokes at
separator weight — explicitly NOT `--border` (per the token rules,
`--border` is near-invisible at ~1.1:1 in light, and this is a deliberate
structural divider, not a hairline). Confirm the interlocking teeth hold
stroke weight and stay legible at card scale in light theme first.

**kill criteria:** if the breathing amplitude collapses to sub-pixel at
typical divider widths (reads as static), or the tapered-teeth geometry is
indistinguishable from a plain rectangular gap at small sizes, kill it.

**legibility line:** the ONE followable thing is the gap's width slowly
widening and narrowing as its tapered teeth slide past each other; cadence
is a 14-second full breathe cycle, so a 2–3 second glance shows clear,
unhurried directional movement rather than a static rule.
