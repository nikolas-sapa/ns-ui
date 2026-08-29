# plasma-filament-wander

- **tier:** loud
- **product surface it replaces:** full-bleed interactive hero background — the ambient, cursor-reactive backdrop behind a headline or CTA cluster.

## the real mechanic
A plasma globe: a high-frequency (typically ~30-40kHz) high-voltage signal
on a central electrode inside a low-pressure gas-filled sphere ionizes the
gas into discrete filaments (streamers) that reach from the electrode to
the inner glass surface. The filaments continuously wander, split, and
reattach at the glass in a chaotic but tree-like, ever-rerouting pattern —
this is a documented, widely-observed behavior of the device, not a model
invention. Touching the glass locally increases conductivity at that point
and filaments preferentially route toward the touch location while
continuing to wander otherwise.

## one-sentence mechanic description
Filaments reach out from a center point toward an outer boundary,
constantly retracting and re-growing toward new points, and drift toward
the cursor when it's near.

## rendering approach
2D canvas, full-bleed. A faint unlit ring (the "glass," a thin
low-contrast circle sized off the container's smaller dimension) is drawn
to keep the plasma-globe reference legible without being literal or
kitschy. 11 filaments baseline, each a jittered polyline from the center
point to a target angle on the ring's circumference. Each filament tracks
its own independent lifecycle: attached-and-jittering, or
retracting-and-regrowing to a new target.

## real numbers
- Filament count: 11, baseline.
- Per-filament lifetime before re-routing: 1.2-2.6s, randomized
  independently per filament (staggered so filaments never all re-route
  together — avoids a synchronized strobe).
- Retract-to-regrow transition: ~350ms eased (`easeInOutCubic`), during
  which the filament shortens toward center then regrows toward the new
  target angle.
- Attached-state jitter: 4-8px lateral wander per filament, resampled at
  ~10Hz (decoupled from the 60Hz paint loop) for the plasma-noise look.
- Pointer bias: when the pointer is within 20% of the container's smaller
  dimension from the ring, up to 40% of filaments choose their NEXT
  re-route target biased toward the pointer's angle (not snapped
  instantly — the bias only applies at each filament's own next natural
  re-route, respecting its individual 1.2-2.6s cadence).
- Filament width: 1.5-2.5px core with a soft ~4px luminance halo.

## the resting loop
- t0: 11 filaments in an initial configuration, all attached and jittering.
- 2.5s: at minimum 2-3 filaments (lifetime floor 1.2s) have completed at
  least one full retract-regrow cycle to a new target angle.
- 5s: the filament configuration is substantially different from both t0
  and 2.5s — most filaments have re-routed at least once, several twice.

## reduced-motion freeze frame
Freeze at a deterministic seed's t=1.8s state: filaments at varied
lengths and angles (some freshly regrown and short, most mid-jitter at
full length) — asymmetric and mid-cycle, more structured than either a
fresh all-at-center frame or a fully-settled all-at-max-length frame.

## interaction
Pointer proximity within 20% of the container's smaller dimension from
the ring biases up to 40% of filaments' next re-route target toward the
pointer's angle, applied only at each filament's own natural re-route
moment. It must NOT: snap filaments instantly to the pointer, make all
filaments chase the pointer at once (that reads as a spotlight, not a
plasma globe), or use `--ns-accent` anywhere in the filament or halo
color — luminance only, per the standing accent-highlight rule.

## light vs dark theme
Dark: filaments in `--foreground` near-full luminance against dark
`--background`, ring in low-contrast `--ns-muted`. Light: same
relationships — filaments must stay meaningfully brighter/darker than
`--background` (test both directions; a "glow" concept inverted into
light theme should still read as the most contrasted element in frame,
not necessarily literally "bright"). Check light theme early: an
inverted-luminance plasma filament that loses contrast against a light
page is a known failure mode for this whole device category.

## legibility
One thing to follow: a single filament's retract-and-regrow cycle to a
new point on the ring. Cadence: 1.2-2.6s per filament's own cycle,
staggered across 11 filaments so the globe always shows some motion while
any one filament's individual event stays trackable — clear retraction
(departure) and re-extension to a new angle (arrival), not a blink.

## kill criteria
- If pointer bias has to become an instant snap to read as "responsive" in
  testing, kill the interaction rather than violate the lead-compensation/
  no-instant-snap lesson from weld-pool.
- If, at typical hero card scale (not just full 100vw), 11 filaments read
  as visual noise rather than distinct reaching lines, reduce count or
  kill — this must read at card scale per the token rules even though it
  ships loud/full-bleed by default.
- If light theme cannot get filaments to read as clearly the brightest (or
  clearly the most contrasted) element in frame without accent color,
  kill it.
