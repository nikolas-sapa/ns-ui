# roast-first-crack

- **slug:** roast-first-crack

- **tier:** loud

## Product surface
Full-bleed hero/background for a "brewing/in-progress" or transformation
landing moment (build pipeline, batch job, onboarding "we're preparing
your account" moment) — replaces a generic tumbling-particle or noise
shader background.

## The real mechanic
Coffee roasting first crack: beans tumble continuously in a rotating drum
roaster. As internal steam pressure builds past a threshold, individual
beans audibly and visibly crack (a sudden radial fissure releasing chaff
silverskin, which is lighter than the bean and drifts free while the bean
itself keeps tumbling). First crack is a stochastic process — not every
bean cracks at once, they pop over a window of a few minutes at an
irregular but clustered cadence. Source: standard coffee-roasting
first-crack phase, the defining audible/visual milestone roasters watch for.

## Mechanic description
Beans tumble in a rotating drum; individual beans intermittently crack open,
each releasing a fleck of chaff that drifts free while the bean settles back
into the tumble.

## Rendering approach
2D canvas, `w-full h-full`, DPR capped at 1.5. Drum boundary is a circle
inscribed in the container using min(w,h) × 0.42 as radius. Bean count
scales with drum area: floor(drumArea / 900px²), clamped 40-90.

## Real numbers
- Drum rotation: 0.15 rev/s (slow tumble, well below any strobe-risk
  threshold — real roaster drums run 45-65 RPM but that rate is never
  rendered 1:1; this is a decoupled, documented slow-sweep per the round-9
  rule).
- Bean tumble: each bean follows the drum's rotation plus a small
  gravity-settle wobble (beans near the "top" of the tumble fall toward
  the mass, beans at the bottom get carried up by drum rotation) —
  simulated as a simple radial position + drift, not full rigid-body
  physics.
- Crack event rate: stochastic, mean 1 crack every 1.4s during steady
  state (Poisson-ish with jitter, never perfectly periodic — real first
  crack clusters and thins), floor of 700ms between any two cracks so
  events never blur together.
- Crack visual: a bean's fissure line appears instantly (a crack is
  genuinely sudden, unlike the extrusion cut which needed a visible
  stroke) but the chaff release that follows animates over 600ms — a fleck
  peels off and drifts outward/upward before fading, which is what gives
  the sudden event a followable arrival, not just a departure.
- Chaff fleck: 1-2 per crack, rendered as a curling silverskin peel (not a
  free particle) — it stays attached to the fissure edge at one end while
  the free end lifts and curls outward through a ~70° arc over 400ms, then
  detaches and drifts 15 px/s for a further 200ms while fading. This is the
  deliberate visual distinction from winnow-chaff-drift's chaff: that
  chaff is already airborne and travels laterally on a crosswind; this
  chaff peels FROM a surface before it ever becomes airborne, and the
  peel-curl (not lateral drift) is the readable motion.
- Total cracked-bean fraction visible at steady state: ~20-30% of the
  population showing a fissure (beans "reset" to uncracked after 8-12s so
  the drum has an unbounded supply of crackable beans — a real roast would
  exhaust supply, but an ambient loop can't finish, so beans cycle).

## Resting loop
- t0: drum at some rotation phase, several beans mid-tumble, 0-2 chaff
  flecks in flight, some beans already showing fissures from prior cracks.
- 2.5s: at least one new crack has fired (fissure appears, chaff flecks in
  flight); drum has rotated ~22° from t0.
- 5s: multiple crack cycles completed, drum has rotated ~45° from t0,
  cracked-bean population has turned over.

## Reduced-motion freeze
Freeze at the instant just after a crack fires: fissure fully visible on
one bean, its chaff fleck mid-drift (not yet faded, not at spawn point) —
the single frame that shows drum population, tumble state, AND the crack
mechanic's full lifecycle (fissure + departing chaff) simultaneously.

## Interaction
None (ambient hero background). Must NOT tint chaff or fissures with
`--ns-accent` — fissures read via a `--foreground`-derived hairline crack,
chaff via reduced-opacity `--foreground`, same discipline as
winnow-chaff-drift.

## Light vs dark
Beans rendered as `--ns-muted`-toned filled ellipses (not `--border` — that
token stays at separator contrast and would vanish as a fill). Fissures are
a thin `--foreground` line at full contrast so they read as a genuine
crack regardless of theme. Chaff at ~40% `--foreground` opacity, bumped in
light theme if it falls under 3:1 against `--background` (same rule as
winnow-chaff-drift's chaff).

## Legibility
The one thing to follow: individual crack events, each showing a fissure
and its departing chaff fleck. Cadence: ~1.4s mean between cracks with a
700ms floor — matches the round-9 "roughly a second between discrete
events" guidance exactly, and each event has both a sudden departure
(fissure) and a traceable 600ms arrival (chaff drift + fade), satisfying
the "transition must show departure and arrival" rule.

## Kill criteria
Reject if: crack events cluster or thin so unpredictably that the drum
reads as empty for stretches longer than ~3s (tune the Poisson jitter
bounds); if the drum rotation reads as static (0.15 rev/s must still be
perceptible against the tumbling beans' own motion — verify at t0/2.5s/5s);
if beans-plus-fissures collapse visually into indistinguishable noise at
card scale (this is a loud/full-bleed-only concept for that reason — do
not attempt a core-tier version without a substantially simplified bean
count).
