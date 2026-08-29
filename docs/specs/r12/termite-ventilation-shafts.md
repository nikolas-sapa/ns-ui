# termite-ventilation-shafts

**tier:** loud

**product surface it replaces:** full-bleed background (a full-bleed
"breathing structure" texture, distinct from the network-growth pieces
already shipped — see mechanic distinction below).

**the real mechanic, with source:** Macrotermes mound ventilation works by
thermosiphon convection: metabolic heat from the colony/fungus garden
warms air in the mound's central chimney and surface conduits, that warm
air rises and flows out through a network of surface ridge/shaft
conduits, cooling as it goes and sinking back down through separate return
conduits, driven by the day/night temperature differential between the
mound surface and the nest core (Turner 2001 "On the mound of Macrotermes
michaelseni", the "exhalent/inhalent" flow model, since refined but the
diurnal-cycle convective flow reversal is the well-documented core
mechanic). Unlike vein growth, the conduit NETWORK is fixed once built —
what's alive is the flow direction and volume through it, cycling with a
slow diurnal period.

**one-sentence mechanic description:** A fixed network of ridged surface
conduits around a central chimney visibly fills and drains with flow in
alternating directions over a slow day/night cycle, driven by a temperature
differential that itself visibly rises and falls.

**rendering approach:** 2D canvas, full-bleed. The conduit network is
generated ONCE at mount (a fixed branching structure from one central
chimney outward — this is deliberately NOT re-grown or re-simulated at
runtime, distinguishing it from `auxin-canal`/`forage-vein`/`agar-starve`,
which all regenerate their networks live). What animates at runtime is flow
state along the fixed edges, rendered as a moving fill-fraction and a
particle-density overlay per conduit segment.

**REAL NUMBERS:**
- Network generation (once, at mount): a chimney trunk at container center,
  branching via a simple recursive angle-split (2-3 children per node,
  ±25-40° spread, length ratio 0.72 per generation) down to 5-6 generations,
  terminating at the container's edge margin — this can reuse a plain
  recursive branch generator since the network itself is static set-
  dressing, not the mechanic.
- Diurnal cycle period: 42s (compressed real day/night cycle) — the single
  governing clock.
- Temperature differential: `dT(t) = sin(2*PI*t/42)`, driving both flow
  direction (dT>0 = exhale/outward, dT<0 = inhale/inward) and flow magnitude
  (`|dT|`, so flow is near-zero and the network looks nearly still at the
  two crossover points, ~t=0 and t=21 in-cycle).
- Flow render: each conduit segment carries a fill-fraction that eases
  toward `clamp(|dT| * segmentDepthFactor, 0, 1)` over a 2.5s time constant
  (segments further from the chimney lag slightly, `segmentDepthFactor =
  1 - 0.05*generation`, so the flow visibly propagates outward/inward from
  the trunk rather than updating everywhere at once).
- Particle overlay: within each segment whose fill-fraction exceeds 0.15,
  4-8 small dots (per segment, scaled by segment length) advance along the
  segment at 12px/s in the current flow direction, wrapping/despawning at
  the segment end — this is what makes direction (not just magnitude)
  legible at a glance.
- Crossover stall: for the ~1.5s window around each direction reversal
  (|dT| < 0.08), particle motion pauses entirely (true zero flow) rather
  than crawling — a real, observably still moment twice per 42s cycle.

**resting loop (t0/2.5s/5s):** t0 (assume mount mid-cycle at a random phase)
shows some fill/particle motion already present, direction and magnitude
depending on phase. At 2.5s and 5s, fill-fraction and particle
density/direction have visibly shifted (unless mount happened to land
exactly on a crossover, in which case particles resume within the 1.5s
stall window, still producing a visible difference by t=2.5s regardless of
starting phase).

**reduced-motion freeze frame:** the network at peak exhale (`dT=1`,
t=10.5 in-cycle), full fill-fraction and particles visible mid-conduit but
frozen — named `PEAK_EXHALE`, chosen over the crossover-stall frame because
it's the state that most clearly shows the network carrying flow, not the
one moment it's genuinely empty.

**interaction:** none; ambient full-bleed background. Must NOT color-code
inhale vs exhale via hue — direction is carried entirely by particle motion
direction along a fixed conduit shape, magnitude entirely by fill-fraction
luminance; `--ns-accent` never appears.

**light vs dark:** conduit outlines in `--border`, fill wash in `--ns-muted`
scaled by fill-fraction alpha (0 to ~0.4), flow particles in `--foreground`
at low alpha (~0.5) so they read as distinct moving points against the
filled conduit in both themes — check light theme specifically for particle
visibility against the `--ns-muted` fill wash, which may need the particle
alpha raised since light theme's fill/foreground contrast compresses.

**kill criteria:** if collapsing the flow-direction cue (particle motion)
away leaves the piece indistinguishable from a generic pulsing-vein
background, or if the fixed-network/live-flow distinction from the space-
colonization pieces isn't visually apparent (i.e., it still reads as "the
network is growing"), cut it.

**legibility:** the one thing to follow is particle direction reversing at
each of the two crossover stalls per 42s cycle — the 1.5s full-stop window
right before reversal is the followable event; a viewer watching one
conduit segment can see flow slow to a stop, pause, then resume moving the
opposite way.
