# mudflow-levee-build

- **slug:** mudflow-levee-build
- **tier:** core (card-scale DOM/canvas)

## Product surface it replaces (Filter 1)
Progress / activity track — an ambient "work is flowing through a channel" indicator, nearest
sibling `progress-wick`, differentiated by mechanism: the track itself is self-BUILT by the
flow's own coarse fraction shearing out to the margins (structure emerges from the flow),
versus a pre-existing track being filled or wicked into.

## The real mechanic
A debris flow (mudflow with a significant coarse fraction — cobbles and boulders suspended in
a fine-grained matrix) moving down a channel self-constructs its own confining banks as it
travels: shear at the flow's lateral margins is highest where the channel walls or prior
deposits slow the edges relative to the faster center, and that shear preferentially pushes
the largest clasts outward and stalls them at the margin (a real process called lateral
levee formation, well documented on alluvial fans and in volcanic lahars) — the coarse
material effectively self-sorts into two low ridges running the length of the flow, which
then confine and channelize everything that follows behind it, letting later surges run
further and faster than the first pulse did. Over many surges the levees build higher, the
channel between them narrows, and eventually a surge overtops or breaches one levee,
avulsing the active channel to a new path alongside the old one — which then begins building
its own pair of levees while the abandoned channel's levees stay as a visible scar.

## One-sentence mechanic description
A muddy flow keeps pushing its coarsest material out to its own edges, building two levees
that grow taller and narrow the channel with every surge, until a surge breaches one bank and
the whole channel jumps sideways to start building a fresh pair.

## Rendering approach
2D canvas, horizontal track (left-to-right flow direction, matching the progress-track
convention it replaces). Channel geometry: two levee-height arrays (top margin, bottom
margin), one value per horizontal pixel-bucket (bucket width derived from container's smaller
dimension, same `minDim/240` rule as ripple-migrate-slip), updated by depositing coarse-clast
markers (small filled shapes, not a particle system) at the current flow edge position each
surge. The active flow itself renders as a horizontally-scrolling turbulent band confined
between the two levee height arrays.

## Real numbers
- Surge interval: a new pulse enters the channel every **2.4s** on average (1.6-3.4s bounds,
  irregular), each surge taking **1.8s** to traverse the visible track left to right.
- Levee growth: while a surge is active, its outer 8% (top and bottom) deposits clast markers
  onto the levee arrays at the surge's current leading-edge x-position, raising that local
  levee height by **0.4-0.9px per marker** (randomized, proportional to a per-surge "coarse
  fraction" scalar) — so levee height along the channel is a genuine record of how many
  surges have passed each point and how coarse they were, not a uniform ramp.
- Channel narrowing: as levee height increases, the confined flow band width decreases
  proportionally (channel width = track height minus both levee heights) — visibly narrower
  over successive surges.
- Breach trigger: once a levee segment's height exceeds **78% of the track's half-height**
  (channel critically narrowed), the NEXT surge instead breaches that levee at its highest
  point — a discrete event: a visible gap opens in that levee over **300ms**, the flow band
  jumps to run alongside the old channel on that side, and the old levee pair is left in
  place, static, as a visible scar (no longer receiving new clast deposits) while a fresh
  pair begins forming around the new path. Breach-to-breach interval averages **9-13s**, well
  clear of the round 9 legibility floor for a rare, high-salience event.
- Marker density: roughly one clast marker deposited per **90ms** of active surge time per
  active margin, small enough (2-3px) that levee growth reads as a granulated ridge, not a
  smooth line.

## The resting loop
- **t0:** an arbitrary mid-sequence frame — an active surge partway across the track, visibly
  asymmetric levee heights built up from prior surges (never a fresh flat channel).
- **2.5s:** at least one full surge will typically have completed (mean interval 2.4s), levee
  height visibly taller/more built-up at the points that surge passed versus t0, channel
  visibly narrower if no breach occurred.
- **5s:** either a breach has occurred (visible new gap and a channel now running a different
  path, old levee pair static beside it) or the channel has narrowed further still — both
  states are clearly structurally different from t0.

## The reduced-motion freeze frame
Freeze immediately after a breach completes (new channel path established, old levee pair
visible and static alongside it, gap in the old levee clearly open) — the single most
structured frame, showing both an active and an abandoned channel path at once.

## Interaction
None required. If added: hovering a levee segment could report its accumulated height as a
"surge count" tooltip — must not pause the surge cadence and must not tint the flow band or
any levee marker with `--ns-accent`.

## Light vs dark theme
Flow band renders as a `--foreground`-toned turbulent texture at reduced alpha (~0.5) against
`--background`; levee clast markers render at full `--foreground` opacity so the built-up
ridges read as solid structure against the more transparent moving flow. `--border` marks
only the track's own fixed outer frame, never the levee itself (a genuine structural element
that must stay visible, not a low-contrast separator). Check in light theme that the flow
band's reduced alpha doesn't drop the active channel below legibility against the levees.

## Kill criteria
- If levee growth doesn't read as material accumulating specifically at the MARGINS (i.e. it
  looks like a generic progress bar filling or a track glowing), kill it — the self-built
  confining bank is the entire mechanic, not channel occupancy.
- If the breach event isn't clearly legible as a discrete channel-jump versus the ambient
  narrowing, kill it — the avulsion is the one big payoff event per cycle and it must read as
  categorically different from ongoing surge activity.
- If it reads as a restyle of `progress-wick`'s fill mechanic once built, kill it — the track
  itself being self-constructed by the flow, and later abandoned/avulsed, must be the primary
  read, not a value filling a fixed channel.
