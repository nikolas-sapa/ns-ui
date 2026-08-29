# equation-kidney-cam

- **tier:** core
- **product surface:** section divider (a horizontal rule between page sections, replacing a plain `<hr>` or gradient-fade divider).

## the real mechanic

The equation-of-time cam (found in Breguet, Blancpain, and other "equation
marchante" watches) is a kidney/heart-profiled disc that makes one rotation
per year. A spring-loaded follower rides its edge and its radial distance
from center — read out through a lever — encodes the real difference
between mean solar time and apparent solar time, which swings between
-14m 15s (mid-February) and +16m 23s (early November) and crosses zero
four times a year. The cam's whole reason to exist is converting UNIFORM
rotational input into NON-uniform, sign-changing output — the follower
doesn't sweep at a constant rate even though the disc under it turns at
one.

## mechanic description

A follower rides the edge of a kidney-shaped cam turning at a constant
rate, so its own sweep speeds up, slows down, and reverses direction even
though the drive underneath never varies.

## rendering approach

DOM + SVG. The cam profile is a single precomputed closed path (13-point
Catmull-Rom spline through the real equation-of-time curve's shape,
normalized); the divider itself is a horizontal line whose midpoint marker
(a small tick) is positioned by the follower's live output value.

## real numbers

- Cam rotation: real period 1 year. Rendered period compressed to 11s per
  revolution for card legibility (documented as a many-thousand-times
  compression from the real annual rate — this is explicitly a
  demonstration cadence, not a simulated calendar).
- Follower output range: mapped from the real -14m15s..+16m23s
  equation-of-time swing to +-22% of the divider's half-length either side
  of center — the marker genuinely reverses direction, it doesn't just
  slow down, matching the real curve's 4 zero-crossings per cycle.
- Follower motion is NOT a sinusoid: it's driven by re-sampling the actual
  cam profile's radius at 60 points around its circumference (matching the
  real curve's asymmetric shape — the swing from most-negative to zero is
  visibly faster than zero to most-positive, because the real curve isn't
  symmetric either), updated once per rAF frame from a lookup table, no
  live trig.
- The divider's line itself brightens by 8% in `--foreground` opacity for
  400ms each time the follower crosses center (a zero-crossing "tick"),
  giving 4 brief pulses per 11s cycle, spaced unevenly (matching the real
  curve's uneven crossing dates) — never evenly spaced, which is the
  detail that sells "cam profile" over "generic wave."

## the resting loop

- t0: follower at some offset, cam rotation partway through.
- 2.5s: follower has moved to a visibly different offset (the compressed
  cycle means ~2.5/11 of a full sweep has elapsed, crossing at least one
  direction reversal in most cam rotations given the profile's
  non-monotonic shape).
- 5s: follower at yet another position, likely past one full zero-crossing
  pulse — the 4-per-cycle uneven pulse timing means no two 2.5s windows
  land on the same phase of the cam.

## reduced-motion freeze frame

Follower at its real-world most-negative point (mid-February analogue,
-14m15s, the cam's tightest inward point) — the most visually distinct
position on the profile (furthest from center, asymmetric relative to the
positive extreme), rather than t0 which could land anywhere including a
near-invisible near-zero offset.

## interaction

None — this is a passive divider. It must NOT respond to hover/scroll by
changing rate or resetting phase; a divider that jitters on scroll-into-view
would break the "alive independent of the user" requirement. `--ns-accent`
must never appear on the zero-crossing pulse — the brighten-on-cross effect
is a `--foreground` opacity lift only.

## light vs dark theme

The divider line itself uses `--foreground` at reduced base opacity (this
is a separator element, so it should NOT be full-strength `--foreground`
at rest — but it is also NOT `--border`, since `--border`'s ~1.1:1 light
contrast would make the follower's motion imperceptible; instead a
mid-opacity `--foreground` mix, e.g. 35%, gives room for the 8% pulse
brighten to register in both themes). The cam profile shape is never
rendered visibly at rest — only its effect (the follower's position) is;
an optional low-opacity ghost of the cam outline can appear on hover as a
pure decorative aid, never affecting layout.

## legibility

The ONE thing to follow: the marker's position sliding along the divider,
occasionally reversing instead of continuing. Cadence: a full sweep takes
2.5-4s between direction changes (derived from the real curve's own uneven
spacing over the 11s cycle) — slow enough that a reversal reads as "it
turned around," not a jitter, satisfying the r9 legibility bar even though
this isn't a discrete-event mechanic.

## kill criteria

- If the follower's motion reads as a simple back-and-forth oscillation
  indistinguishable from a sine wave, the entire point (non-uniform,
  asymmetric, real-curve-derived motion) has been lost to a generic
  easing curve — reject.
- If, at card scale, a static divider with a single centered tick would
  read identically to a viewer glancing for under 2s, the motion isn't
  earning the "alive at rest" requirement — reject.
