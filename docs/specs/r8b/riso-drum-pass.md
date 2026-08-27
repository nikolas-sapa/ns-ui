# riso-drum-pass

- **slug:** `riso-drum-pass`
- **tier:** core (card-scale 2D canvas)

## Product surface it replaces
Loader / background ambient texture.

## The real mechanic
Risograph duplication. Ink is forced from inside a perforated cylindrical drum, wrapped in a stencil master, out through the stencil's micro-perforations onto paper as the drum rotates once per printed sheet. Multi-color riso work is run as sequential separate drum passes, one drum per color; each pass mis-registers by a few pixels against the last due to paper-feed tolerance, and each pass shows faint concentric density banding from uneven drum surface pressure. Source: Risograph GR/MZ drum duplication, standard zine/desktop-publishing print process.

## One-sentence mechanic description
A perforated drum spins once per pass, forcing ink through a stencil's dot field that stacks slightly out of register with each additional pass.

## Rendering approach
2D canvas, card-scale. Dot grid pitch = clamp(min(w,h)/40, 5px, 10px). Three sequential passes per cycle (simulating a 3-drum riso run), each pass a full drum rotation sweeping top-to-bottom, dots drawn as circles at diameter = 0.8 × pitch.

## Real numbers
- Drum rotation: 2s per pass, 3 passes per cycle = 6s total, with a 0.6s pause between passes (drum swap).
- Cumulative registration offset: pass index × (1.3px x, 0.7px y).
- Drum pressure banding: one sinusoidal alpha modulation cycle per rotation, amplitude 0.08, sweeping in sync with rotation progress.
- Dot fill per cell: threshold against a value-noise field, re-seeded fresh each pass (new stencil each cycle) — alpha 0.55 per pass, so overlapping passes build visible density (cap combined alpha at 0.82).

## The resting loop
- t0 (start of a fresh cycle): pass 1 drum sweeping top-to-bottom, only a partial band of dots drawn so far.
- 2.5s: pass 1 complete; pass 2 sweeping, its dots landing 1.3px/0.7px offset from pass 1, visible registration drift/moiré where the two overlap.
- 5s: pass 3 sweeping; three-layer density buildup visible, pressure-banding sinusoid at a different phase than t0.

## Reduced-motion freeze frame
Freeze at t = 4.2s (`FREEZE_PHASE = pass-3-half-drawn`) — passes 1-2 complete, pass 3 half-swept, the most structurally dense and legible registration-drift frame.

## Interaction
None required for the base loop. If hover is added, the only allowed effect is a localized "wet ink sheen" luminance highlight near the pointer (no rotation pause, no tint) — must not use `--ns-accent`.

## Light vs dark theme
Ink alpha composites toward `--foreground` over `--background`; verify the 3-pass overlap doesn't exceed readable contrast in light theme (combined alpha capped at 0.82, checked at card scale first).

## Kill criteria
Reject if the 3-pass registration drift is imperceptible at card scale (drift under 1px is invisible below ~4px dot pitch) — rescale rather than ship illegible. Reject if it reads identically to the existing halftone/dither chart family (`chart-bar-halftone`, `chart-donut-halftone`) with no distinct drum-rotation/registration story.
