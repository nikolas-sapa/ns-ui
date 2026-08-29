# autoclave-cycle-gauge

- **slug:** autoclave-cycle-gauge
- **tier:** core (card-scale canvas)

## Product surface it replaces
A progress/status meter — an alternative to a generic progress bar for a
long-running background process.

## The real mechanic
Steam sterilizer (autoclave) cycle as shown on an analog combined
pressure/temperature gauge: a come-up ramp as steam pressure and chamber
temperature climb together, a timed sterilize hold at set point, then a
vent/exhaust phase that drops pressure faster than it rose.

## One-sentence mechanic description
A sterilizer's pressure needle sweeps through a slow come-up, a steady
timed hold, and a fast vented exhaust, while a chamber temperature trace
scrolls beneath it.

## Rendering approach
2D canvas: circular dial + needle, plus a horizontal scrolling trace strip
beneath it. Geometry from `min(width, height)`; needle length = 0.36 ×
min-dimension.

## Real numbers
- Come-up ramp: 0 → 15 psi / 121°C over 12s (compressed from a real 8-20 min
  come-up, ~40-60x).
- Sterilize hold: 15 psi sustained for 15s (compressed from a real 15-20 min
  hold).
- Exhaust/vent: 15 → 0 psi over 5s — deliberately faster than the ramp,
  matching a real fast-exhaust cycle.
- Full cycle: 32s, then repeats unbounded.
- Needle tremor during hold: ±0.5° amplitude, continuous (regulator
  chatter around set point).
- Temperature trace scroll rate: 8 px/s, leaving a persistent ridge shaped
  like the current cycle's pressure profile.

## The resting loop
- **t0:** needle at 0, trace strip empty.
- **2.5s:** needle ~20% up the ramp (~3 psi), short trace ridge started.
- **5s:** needle ~42% up the ramp (~6.3 psi), visibly longer trace ridge
  than at 2.5s.

## Reduced-motion freeze frame
Freeze at the **hold-phase midpoint** (cycle t=18s): needle parked at 15
psi with tremor frozen at neutral, trace strip showing the full come-up
ramp plus a partial flat hold segment — the most structured single frame,
showing all three phase shapes at once.

## Interaction
None required. If hover reveals a numeric psi/°C readout, render it in
`--foreground` only — accent is reserved for any focusable control's ring,
never the readout itself.

## Light vs dark theme
Dial face uses `--background`, ticks and needle use `--foreground`. Trace
ridge fill is a semi-transparent `--foreground` overlay. Needle stroke
width has a 1.5px floor so it stays visible against the light-theme dial
face specifically.

## Kill criteria
If the three phases (ramp / hold / vent) cannot be told apart from the
needle's motion alone within the first 5s — i.e. the ramp and vent read at
the same visual speed — reject.

## Legibility
The ONE followable thing: the needle's sweep, whose speed and direction
change distinctly across the three phases. Cadence (12s ramp / 15s hold /
5s vent) produces an unmistakable slower-then-flat-then-fast profile that
reads at a glance without needing the trace strip to confirm it.
