# tourbillon-cage

- **tier:** loud
- **product surface:** full-bleed loading / route-transition curtain (the thing a spinner or skeleton-wash currently owns on a slow route change).

## the real mechanic

Breguet's tourbillon (1795): the entire escapement (balance wheel, hairspring,
pallet fork, escape wheel) is mounted on a rotating carriage so gravity's
drag on the balance's rate averages out over one carriage rotation instead
of biasing it in a fixed orientation. Two independent rotations nest: the
balance oscillates fast inside the cage, the cage itself turns slow — a
classic one-minute tourbillon completes one cage rotation per 60s while the
balance underneath ticks at 21,600-28,800 vph (3-4 Hz).

## mechanic description

A balance wheel ticks fast inside a cage that itself turns slow, so two
independent rotations nest on one axis without ever synchronizing.

## rendering approach

2D canvas, direct-DOM rAF, no deps. Geometry derived from the container's
smaller dimension: cage radius = 0.34 * min(w,h), balance radius = 0.4 *
cage radius. DPR clamp 2.

## real numbers

- Cage rotation: real reference period 60s/rev (one-minute tourbillon).
  Rendered period is DECOUPLED and compressed to 9s/rev for card
  legibility — documented as ~6.7x the real rate, not a 1:1 sim.
- Balance oscillation: real reference 28,800 vph = 4 Hz (8 beats/sec:
  tick-tock-tick-tock). Rendered at 2.5 Hz (5 beats/sec) — still decoupled
  downward from the real rate, staying well clear of the ~60 Hz paint rate
  per the r9 aliasing rule, and slow enough the balance's arc reversal at
  each end is visible as a distinct pause-and-kick rather than a blur.
- Pallet fork impulse: a 6px SVG-path fork rocks +-9deg exactly once per
  balance half-swing (5x/sec), giving the escape wheel a single-tooth
  release each time — this is the one visible "locking" event, and it is
  the only high-frequency element on screen; everything else (cage,
  hairspring breathing) moves at or under 1 Hz.
- Hairspring: drawn as a 6-turn Archimedean spiral whose outer coil radius
  breathes +-6% in phase with the balance, coupling visually to the
  tick without needing a second physics system.

## the resting loop

- t0: cage at 0deg, balance mid-swing, fork mid-rock.
- 2.5s: cage has turned ~100deg, balance has completed ~6 full oscillations
  (visibly different arc position + hairspring coil phase), fork has fired
  ~12 times.
- 5s: cage past 200deg (more than half a revolution), balance phase has
  drifted relative to its t0 position (the beat count per cage-second is
  non-integer by design — 2.5 Hz balance against a 9s cage period never
  re-locks in phase, so the composite never repeats within any observable
  window).

## reduced-motion freeze frame

Cage at 45deg (balance and hairspring both mid-arc, fork mid-rock, all
three visible structures asymmetric and legible at once) — never t0, where
the fork sits at rest-center and reads as inert.

## interaction

None — this is a route-transition curtain, not an input surface. It must
NOT gate on or react to pointer position; the two-rotation mechanism is the
entire show. On transition-complete it fades out over 200ms; it never
"finishes" the mechanism itself (the cage/balance keep turning under the
fade, so a screenshot mid-fade never reads as evidence of a stopped
machine).

## light vs dark theme

Cage arm and balance rim stroked in `--foreground` at full opacity; escape
wheel teeth and hairspring in a 55%-opacity mix toward `--ns-muted` so the
fast-moving fork reads as the foreground event against a quieter
supporting structure. `--border` never used as a stroke (per token rules) —
the faint circular cage track uses `--ns-muted` at low opacity instead. In
light theme this pushes lighter/thinner; in dark it pushes toward
near-white on near-black — same luminance relationships, no hue shift, no
color literal.

## legibility

The ONE thing to follow: the fork's tick-tock rock and the single escape
tooth it releases each time. Cadence: 5 releases/sec is fast but each is a
sharp, discrete kick against an otherwise slow-turning cage, so the eye
locks onto the fork as "the fast thing" and the cage as "the slow thing"
within the first second — exactly the two-speed read the mechanism exists
to produce.

## kill criteria

- If the balance frequency has to drop below ~1.5 Hz to avoid reading as a
  blur, the two-speed contrast collapses and it becomes indistinguishable
  from a generic spinner — reject.
- If it cannot be told apart from a plain circular loader within 1s (i.e.
  a viewer sees "a thing spinning," not "two things spinning at different
  rates"), the mechanism has failed to read and it's a restyle, not a
  showpiece.
