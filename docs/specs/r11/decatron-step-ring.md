# decatron-step-ring

- **tier:** core
- **product surface it replaces:** a circular step/progress indicator — the "step N of 10" or cyclic-position ring used in onboarding flows, multi-step forms, or a rotating counter display.

## the real mechanic
A decatron is a cold-cathode counting tube with ten main cathodes arranged
radially around a central anode, used historically as a decade counter and
readout in one device. The glow discharge sits on exactly one main cathode
at rest. Stepping to the next cathode is a documented two-phase transfer:
a guide electrode (G1) positioned between each pair of main cathodes is
pulsed first, and the glow visibly and briefly stretches/transfers partway
onto that guide electrode before the pulse on the next main cathode (G2)
completes the transfer and the glow fully settles and brightens there —
real decatrons show this as a distinct "stretch, then snap" motion between
stations, not an instant jump, because the discharge has to physically
relocate through an intermediate electrode.

## one-sentence mechanic description
A glow spot steps around a ring of ten stations, briefly stretching onto
the guide electrode between two cathodes before snapping fully onto the
next one.

## rendering approach
SVG or 2D canvas, ring geometry derived from the container's smaller
dimension. 20 nodes total arranged in a circle: 10 main-cathode dots at
the cardinal step positions and 10 guide-electrode dots interleaved
between them. Non-lit nodes render as small dim dots (fixed low
luminance, representing an unstruck cathode visible under ambient light).
The lit element renders with a bright core + soft halo.

## real numbers
- Step interval: 1.4s per full step (guide-phase to next main-phase).
  - Guide phase: first 30% (~420ms) — halo appears on the guide node
    between current and next main cathode, stretched as a soft ellipse
    connecting the two positions, brightness ramping 0→70%.
  - Main phase: remaining 70% (~980ms) — guide fades to 0, next main
    cathode ramps to full brightness and settles.
- Full revolution: 10 steps × 1.4s = 14s per lap, looping indefinitely
  (unbounded counter — this never "finishes").
- Idle plasma noise: the currently-lit main cathode's halo radius pulses
  ±8% at ~2Hz to read as gas discharge rather than a static LED.
- Node/halo sizing: main cathode dot radius ~4% of ring radius; lit halo
  radius ~14% of ring radius.

## the resting loop
- t0: cathode 0 lit, steady.
- 2.5s: roughly 1.8 steps elapsed — likely mid-transition, guide glow
  visibly stretching between two positions, or freshly settled on
  cathode 1 or 2.
- 5s: ~3.6 steps elapsed — visibly further around the ring than at 2.5s,
  confirming continuous unbounded progression rather than a settle-and-stop.

## reduced-motion freeze frame
Freeze mid-guide-phase (e.g., 15% into a step) with the glow visibly
stretched across the guide node between two main cathodes — the single
frame that shows both the ring layout and the two-phase transfer
mechanic at once, more structured than a frame with one cathode fully
settled and nothing else lit.

## interaction
None required as a passive step indicator. If wired to an actual
multi-step form's current step, an external step-index prop should drive
which cathode is "home," and the component should animate the shortest
path (respecting the two-phase step motion per hop) to the target rather
than teleporting — but the idle/no-prop case must still free-run
continuously per the resting-loop numbers above, since this is a showpiece
component whose default demo has no external driver.

## light vs dark theme
Dark: unlit nodes near-invisible `--ns-muted` dots, lit cathode
`--foreground` core with halo blending to `--background`. Light: unlit
nodes need enough contrast to read as "a ring of ten dots" even before the
lit one draws the eye — verify unlit-node contrast against light
`--background` first, since ten near-invisible dots plus one bright spot
reads as "single dot on empty card," not as a ring, if the dim nodes drop
below the perceptible floor.

## legibility
One thing to follow: the glow spot advancing one station around the ring.
Cadence: 1.4s per step, each with a visible two-part motion (stretch onto
the guide, then snap onto the next cathode) — clear departure and arrival,
not a blink.

## kill criteria
- If unlit nodes are indistinguishable from the background in light theme
  even after tuning, the ring reads as one wandering dot on an empty card
  and the mechanic is lost — kill or rework contrast strategy.
- If the guide-phase stretch isn't visually distinguishable from the
  main-phase snap at card scale, the "two-phase" identity collapses into
  a generic rotating-dot loader (several of which likely already exist)
  and this becomes a restyle — kill.
- If a 1.4s step interval reads as too slow for a progress-adjacent use
  case in testing, kill or move to loud tier as an ambient ring rather
  than force a faster, less legible cadence.
