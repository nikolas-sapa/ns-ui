# arc-ladder-climb

- **tier:** loud
- **product surface it replaces:** full-bleed section-divider / hero background — a break between two page sections that stays alive under it, not a static rule.

## the real mechanic
The Jacob's ladder: two bare wires diverge upward from a narrow gap (few kV
across ~6-10mm at the base) driven by an HV transformer or neon-sign
transformer. The field is strongest at the narrowest point, so the arc
always strikes there first. Once struck, the ionized channel is a low-density
hot plasma column — buoyancy (hot ionized air rises) plus the electrostatic
force along the diverging rails drags the arc upward. As it climbs, the gap
between the rails widens, channel resistance and required sustaining voltage
rise, until the supply can no longer maintain ionization across the widened
gap; the arc extinguishes. The field at the narrow base is still strongest,
so a new arc re-strikes there almost immediately, and the cycle repeats
continuously for as long as power is applied — this is a textbook illustration
of the classic Jacob's ladder device (found in physics demonstrations and
retro sci-fi prop electronics), not a model invention.

## one-sentence mechanic description
A bright arc strikes at the base of two diverging rails, climbs the widening
gap as it burns, and dies at the top — then a fresh arc restrikes at the
base and climbs again, forever.

## rendering approach
2D canvas, full-bleed. Two thin straight rail strokes drawn from a shared
apex at bottom-center diverging outward at a fixed half-angle to the frame
edges (half-angle 7°, base gap sized to ~1.4% of the container's smaller
dimension). The arc itself is a jittered polyline of 5-7 vertices spanning
rail-to-rail at the current climb height, redrawn every frame from a
per-vertex random-walk offset. A short decaying afterglow trail (previous
2-3 arc positions, opacity falling ~55%/segment) is composited underneath
the live arc to read as heated air, not a static ladder rung.

## real numbers
- Cycle period: 1.6-2.2s, re-randomized ±15% each cycle (real ladders are not
  metronomic — supply ripple and air currents vary each strike).
- Climb path: from y = 4px (scaled to container) to y = 0.85 × container
  height, eased with `easeInQuad` (real ladder accelerates as the buoyant
  plume speeds up) over ~78% of the cycle period.
- Extinguish-to-restrike gap: ~120-220ms of darkness at the base before the
  next arc strikes (real re-strike isn't instantaneous — ionization has to
  redevelop).
- Rail half-angle: 7°, base gap: 1.4% of container's smaller dimension.
- Arc jitter: 5-7 vertices, each offset redrawn every frame but resampled
  from a smoothed noise function at 24Hz (decoupled from the 60Hz paint
  rate per the round-9 aliasing lesson — real HV arcs flicker near mains
  frequency, well above what should be rendered 1:1).
- Afterglow trail: 3 previous positions retained, each fading over ~400ms.
- Arc width: 2-3px core, tapering, with a soft luminance halo ~6px.

## the resting loop
- t0: an arc sits low, near the narrow base, short and bright.
- 2.5s: the arc (or a later one, cycle-dependent) is partway up, visibly
  elongated, with a fading afterglow trail below it.
- 5s: 2-3 full cycles have elapsed since t0; height, afterglow shape and
  restrike timing all differ from t0 and 2.5s because of the per-cycle
  jitter — no two passes look identical.

## reduced-motion freeze frame
Freeze at 55% climb height — the arc mid-ladder, clearly separated from
both rails, elongated, with a visible afterglow trail beneath it. This is
the most structured single frame: it shows the narrow base, the diverging
rails, and the climbing arc all at once, unlike t0 (arc too short to read
against the rails) or full climb (arc near-vertical, trail off top edge).

## interaction
None. This is a passive divider/background; it must not add pointer
tracking or a hover state — the arc's own climb-and-restrike cadence is
the entire spectacle. Do not tint the arc or its halo with `--ns-accent`.

## light vs dark theme
Dark: rails in `--ns-muted`, arc core in `--foreground` at near-full
luminance, halo blended toward `--background`. Light: same token mapping —
the arc must still read as the brightest element in the frame, so its
luminance target is derived relative to `--foreground`, not a fixed value,
and the halo blend is tuned down so it doesn't wash into a grey smear
against a light `--background`. Check light theme first: a subtle-contrast
arc against light background is the way this concept dies.

## legibility
One thing to follow: a single arc climbing from base to top and vanishing.
Cadence: ~1.8s average per full climb-and-restrike cycle — well within the
"about a second or more between discrete events" rule, and each climb shows
clear departure (strike at base) and arrival (extinguish near top), not a
blink.

## kill criteria
- If the arc's random-walk jitter has to run above ~30Hz to look like a
  plasma channel rather than a wobbling line, the concept fails the
  decouple-from-paint-rate rule and should be killed or reworked.
- If, at card scale (not full-bleed), the diverging rails collapse into an
  illegible sliver, this should ship loud-only or be killed rather than
  forced to core.
- If light theme cannot get the arc to read at least one full luminance
  band above the rails without touching `--ns-accent`, kill it.
