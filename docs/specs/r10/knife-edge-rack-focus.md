# knife-edge-rack-focus

**tier:** core (card-scale canvas).

**product surface it replaces:** loader — an "instrument is actively
reading" placeholder, the same footing as `profilometer-trace` or
`barograph-drum-week`: a diagnostic-instrument display, not a settings or
admin surface.

**the real mechanic:** the Foucault knife-edge test. A knife edge is racked
(moved axially) through a mirror's point of focus; as it crosses focus, the
shadow pattern cast back across the mirror's aperture sweeps from
dark-on-one-side, through a flat uniform grey exactly at the null, to
dark-on-the-other-side — and any local zone that departs from the ideal
sphere shows as a shadow that reads as raised or sunken relative to the
rest of the surface. Source: the classical Foucault/Couder knife-edge test,
standard optical-shop and amateur-telescope-making mirror-figure QC.

**one-sentence mechanic description:** A knife edge racks slowly through a
mirror's point of focus, sweeping the mirror's shadow pattern from one side
of the aperture to the other and pausing flat and grey exactly at the
null.

**rendering approach:** 2D canvas, direct rAF. A radial shadow map derived
from a fixed baked-in zonal height profile (4 gentle zonal errors at fixed
radii, not a flat disc) is evaluated per-pixel from a single scalar knife
position `t`. Disc radius = `0.42 * min(w,h)`.

**REAL NUMBERS:**
- Knife position `t` swept via a smooth triangle wave, range [-1, 1]: 8s
  outward + 8s back = 16s full period. Never resets — reverses smoothly,
  matching how a real tester racks back and forth repeatedly to bracket
  the null.
- Shadow luminance per zone: `clamp(0.5 + k * (t - zoneOffset), 0, 1)`,
  `k = 1.8`.
- 4 baked zones at radii [0.25, 0.5, 0.7, 0.9] × disc radius, with
  `zoneOffset` spaced 0.12 apart so zones visibly cross null at slightly
  different points in the sweep — this staggered crossing is what reads
  as measuring a real surface rather than a uniform disc.
- Null dwell: while `|t| < 0.05`, the frame holds at flat grey for ~0.6s
  before the sweep continues — the real tester's pause at null, and the
  component's clearest single discrete event.

**the resting loop:** t0 — mid-sweep, roughly half the disc lit and half
shadowed, zone banding visible across the boundary. 2.5s — the shadow
boundary has swept further across, zone bands visibly separated since they
cross null at different sweep positions. 5s — knife position approaching
or leaving a null dwell (flat grey) depending on phase, a composition
clearly distinct from t0.

**the reduced-motion freeze frame:** `t = 0.3`, named `"half-sweep-zoned"`
— clear rise/fall banding visible across all 4 zones, chosen over the
flat-grey null frame because the null is nearly featureless and would
under-inform a static viewer; this is the deliberately-chosen
most-structured frame.

**interaction:** pointer press pauses the rack at the nearest null and
holds it there (mirroring how a real tester manually holds position);
release resumes the sweep from where it paused. The paused state shows
only a subtle `--foreground`/`--ns-muted` border ring, never
`--ns-accent`, and must not alter the baked zone profile.

**how it reads in light theme vs dark:** the shadow luminance ramp spans
`--foreground` to `--background` directly — this is a literal
light/shadow phenomenon in both themes, so the mapping holds unchanged;
only bias/contrast gets retuned per the weld-pool convention, never a
direction flip.

**legibility:** the one thing to follow is the shadow boundary sweeping
left-to-right then reversing across the disc, over a 16s full period. The
clearest anchor is the 0.6s null-dwell pause at flat grey — a genuine
discrete event with visible departure (shadow closing in on grey) and
arrival (grey holding, then reopening), well above the round 9
~1s-between-events floor.

**kill criteria:** if the zone banding is too subtle to read at card scale
(reads as a plain vignette sweeping rather than a diagnostic test with
distinct zones), kill. If the null-dwell pause reads as the component
freezing or breaking rather than a deliberate diagnostic hold, kill.
