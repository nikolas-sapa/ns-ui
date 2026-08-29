# gluten-windowpane

- **slug:** `gluten-windowpane`
- **tier:** core (card-scale canvas)

## product surface it replaces
A background-task progress/status indicator (currently a spinner or linear progress bar for "processing"/"analyzing" states).

## the real mechanic
The baker's "windowpane test" for gluten development: a small piece of dough is stretched by hand between the fingers; under-developed dough tears immediately, fully-developed dough stretches into a thin, translucent membrane light passes through without tearing. Full development typically needs ~400-600 hand folds or ~8-10 minutes of machine kneading, tested repeatedly during the process. Source: standard bread-baking technique.

## one-sentence mechanic description
A dough membrane is stretched, held, and released on a repeating cycle, going from opaque and jittery-stranded to translucent and straight-stranded as kneading "progresses."

## rendering approach
2D canvas, single membrane patch filling the card. Strand geometry derives from the container's smaller dimension: strand length = `minDim * 0.8`, strand count and jitter driven by cycle number below. Translucency rendered as canvas alpha compositing the `--background` value through the membrane, plus a radial luminance highlight (never accent) where light "passes through" most.

## real numbers
- 4 knead cycles per loop. Each cycle: 1800ms stretch (scaleX up to 1.6, membrane thins) + 600ms hold + 800ms snap-back = 3200ms.
- Strand count per cycle: 8 → 14 → 22 → 34, rendered as thin `--foreground` lines.
- Strand angle jitter (deviation from straight, simulating alignment): ±35° (cycle 1) → ±22° (cycle 2) → ±11° (cycle 3) → ±4° (cycle 4).
- Membrane alpha (translucency, 0 = opaque): 0.05 → 0.18 → 0.35 → 0.62.
- After cycle 4 holds 1500ms at full development, reset to cycle 1 (a fresh dough test) and loop. Full loop: 4×3200ms + 1500ms = 14.3s.

## the resting loop
- t0: mid-stretch in whichever cycle the loop phase lands on — low strand count, high jitter, low translucency.
- 2.5s: different stretch/hold/snap phase, more strands and slightly higher translucency than t0.
- 5s: into the next cycle — visibly more strand count, tighter alignment, higher translucency than 2.5s.

## reduced-motion freeze frame
Freeze at the fully-developed windowpane held-state (cycle 4's 600ms hold, mid-point): max translucency, tightest strand alignment, radial light-through highlight visible — the most structured, informative frame, not t0.

## interaction
Optional: pointer position can locally shift the stretch center toward the cursor. Must not tint the light-through highlight with `--ns-accent` — brightness/alpha only, never hue.

## light vs dark theme
Membrane base reads at `--background`, strands at `--foreground`, light-through highlight as a luminance boost sampled from the same `--background`/`--foreground` pair (brighter in dark theme, darker-toward-white in light theme) — check light theme early since the translucency effect risks disappearing against a near-white `--background`.

## kill criteria
- If the translucency ramp reads identically to a generic loading shimmer/skeleton once abstracted — read `skeleton-develop` first (photographic-print reveal, one-shot, not a cyclical elasticity test) and confirm the strand-alignment mechanic is what carries the identity, not the alpha fade alone.
- If strand jitter-to-alignment isn't visually legible at card scale (too few pixels to show angle deviation), kill.

## legibility
The ONE thing to follow: the membrane visibly going from opaque/jittery to translucent/aligned across one stretch-hold-snap cycle. Cadence: 3.2s per knead cycle — slow enough to watch one full stretch play out before the next begins.
