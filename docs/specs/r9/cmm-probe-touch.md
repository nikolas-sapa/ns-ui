# cmm-probe-touch

- **slug:** `cmm-probe-touch`
- **tier:** core (card-scale canvas or SVG)

## Product surface it replaces
Empty state — a shape being continuously measured/built into legibility, adjacent territory to `empty-state-braille-orbit` but a distinct mechanic.

## The real mechanic
Coordinate-measuring machine (CMM) touch-trigger probing: a probe indexes to a programmed point on a part, approaches slowly along the local surface normal, registers contact (trigger), retracts, and travels to the next point, building an inspection pass of the part's actual geometry. Source: CMM touch-trigger probing cycles, standard contact metrology.

## One-sentence mechanic description
A probe tip indexes around a part's outline forever, approaching, touching, and retracting at each station while older touched points fade into the background — an endless inspection lap, never a finished report.

## Rendering approach
2D canvas or SVG. A fixed closed contour (a rounded-rectangle-ish part silhouette with a couple of plausible features — a notch, a boss) carries N = 18 probe stations spaced around it. The probe renders as a small stylus/ball approaching perpendicular to the local surface normal at each station.

## Real numbers
- Per-station cycle: approach 420ms, dwell-at-contact 180ms (trigger registers — a small luminance flash on the touched marker, not color), retract 300ms, travel-to-next-station 300ms. Total 1.2s/station.
- Full lap: 18 stations x 1.2s = 21.6s.
- Trail: touched points remain visible, individually fading from `--foreground` to `--ns-muted` over a 21.6s trailing window (one full lap) — a rolling trail, so the contour is always mid-inspection, never a finished static cloud.

## The resting loop
- t0: probe pre-seeded mid-cycle at some station, with a partial trail of recently-touched points already visible — never starts from a blank contour.
- 2.5s later: probe has advanced roughly 2 stations; trail composition has shifted.
- 5s later: probe at a further station; the oldest points visible at t0 have begun fading out.

## Reduced-motion freeze frame
Freeze at the moment of contact-dwell (the 180ms trigger window) on station index 9 (roughly opposite the lap's start) — the single most legible frame, tip visibly touching. Named `FREEZE_PHASE = contact-dwell-station9`.

## Legibility
The one thing to follow: the probe tip moving from one station to the next — approach, touch (visible flash), retract, travel. Cadence: 1.2s/station, comfortably inside the "roughly a second between events, with visible departure and arrival" rule — explicitly not a blink-swap like `overflow-chip-mux`.

## Interaction
Hover/focus on a touched station shows a small synthetic deviation readout in `--ns-muted` text. Must NOT: let hover interrupt or speed up the probe's own indexing cadence (the global cycle stays independent of pointer input, same rule as `peen-coverage`'s hover-doesn't-touch-the-global-clock); tint the trigger flash with `--ns-accent`.

## Light vs dark theme
Contour stroke `--border` (it's the reference outline, a separator, never a fill). Touched points and the probe tip `--foreground` fading to `--ns-muted`. No accent used except an optional focus ring if a station readout is made keyboard-focusable.

## Kill criteria
Reject if: the lap ever completes and stops instead of indexing forever (Filter 2 failure); station-to-station transitions read as instant/blinking rather than showing approach-then-retract motion (the exact `overflow-chip-mux` failure); trail fade is fast enough that the "just touched" cluster reads as noise instead of a legible recent-history trail.
