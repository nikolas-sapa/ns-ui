# roller-occlusion

- **slug:** `roller-occlusion`
- **tier:** core (card-scale DOM/canvas)

## Product surface it replaces
Loader / progress ambient — a determinate-feel "something is being pumped through" indicator, not a percentage bar.

## The real mechanic
Peristaltic pump roller-head. A rotor carries 3 rollers spaced 120° apart around flexible tubing laid in a shoe; each roller in turn presses the tube fully flat (100% occlusion, lumen walls touching), trapping and pushing a fixed slug of fluid ahead of it while the tube wall behind the roller rebounds viscoelastically back to round. Because rollers overlap in their occlusion windows (only one roller is ever fully off the tube), flow is quasi-continuous rather than pulsed — the standard justification for why peristaltic heads are chosen over piston pumps in lab/medical dosing. Source: standard peristaltic (roller/hose) pump kinematics, e.g. as documented for lab dosing pumps and dialysis blood pumps.

## One-sentence mechanic description
A three-roller head rotates around a horizontal tube, each roller flattening the tube fully as it passes and driving a visible slug of fill ahead of it while the tube re-inflates elastically in its wake.

## Rendering approach
2D canvas, DPR-capped 2. Tube drawn as a horizontal capsule path spanning the container's smaller dimension × 0.7 in length; tube diameter = 18% of container height. Roller head is 3 circles (radius = 12% of tube diameter... i.e. sized to visibly flatten the tube) on a rotor circle of radius = tube diameter × 1.4, centered above the tube's midpoint, rotor plane tangent to the tube centerline.

## Real numbers
- Rotor speed: 12 rpm idle (0.2 rev/s) — mid-range for a lab peristaltic pump (typical 1–100 rpm).
- 3 rollers at 120° spacing; occlusion contact arc per roller ≈ 140° of rotor rotation (rollers overlap ~20° so exactly one roller is always ≥95% occluding).
- Occlusion closes over 60ms as a roller enters contact, holds full occlusion for the contact arc, releases over 90ms (tube wall rebound is measurably slower than compression — real viscoelastic tubing recovery lag).
- Tube lumen visual width interpolates 100% (open) → 4% (occluded) → 100%, eased with the 60ms/90ms asymmetry above, not a symmetric ease.
- Fluid slug: a filled segment of length = rotor circle circumference / 3 (one slug per roller gap) advances at the tube's linear equivalent of rotor speed; slug leading edge luminance is highest value, trailing edge fades to background over the slug's own length (drawn as a linear luminance gradient, not opacity, so it reads correctly composited under both themes).

## The resting loop
- t0: one roller mid-occlusion (tube pinched to ~4% width at that point), one slug boundary crossing the tube's midpoint.
- 2.5s: rotor has completed 0.5 rev — a different roller occludes, slug boundaries have advanced ~43% of tube length, tube wall behind the now-released first roller is mid-rebound (visibly not yet fully round).
- 5s: rotor has completed 1.0 rev — same roller angle as t0 but the fluid slug pattern has advanced a full tube length and wrapped, so the frame differs in slug phase even though roller phase repeats (avoid the loop reading as a freeze by offsetting slug period from rotor period by a non-integer ratio, e.g. slug advances 1.08 tube-lengths per rotor rev).

## Reduced-motion freeze frame
Freeze at the point 35° into a roller's occlusion arc: tube ~60% occluded (not fully pinched, not fully open — shows the mechanic mid-motion), with one slug boundary visible at the tube's 1/3 mark. Named: `FREEZE_PHASE = 35deg-into-occlusion`.

## Interaction
Hover/focus over the tube nudges rotor speed up 1.6× for the duration of the hover (pump "spinning up"), decaying back over 400ms on release — a luminance/speed change only. Must NOT: recolor the slug with `--ns-accent`, must NOT pause the rotor on hover (that reads as broken, not responsive).

## Light vs dark theme
Dark: tube wall at `--ns-muted`, fluid slug ramps toward `--foreground` at its leading edge. Light: tube wall at `--border`-derived value only for the *outline*, never as a fill (per the separator-token rule) — tube fill body uses a `--background`-to-`--ns-muted` two-stop ramp so the occluded pinch point stays legible against a light page background (the failure mode: an all-`--muted` tube on a light background nearly disappears at low opacity — checked first, not last).

## Kill criteria
Reject if: the rebound/compression asymmetry is dropped (looks like a generic ball-on-a-track loop, no longer reads as peristaltic); if roller and slug periods are locked to an integer ratio (loop visibly freezes every rev); if it reads as a generic "loading spinner" restyle rather than a legible pump mechanism at a glance.
