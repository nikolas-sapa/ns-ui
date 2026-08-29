# profilometer-trace

- **slug:** `profilometer-trace`
- **tier:** core (card-scale canvas)

## Product surface it replaces
Divider — a horizontal rule that is alive at rest instead of a static line.

## The real mechanic
Contact stylus profilometry: a diamond stylus is dragged across a surface at constant speed, its vertical deflection recorded as a trace that decomposes into roughness (short-wavelength) and waviness (longer-wavelength) components per the standard cutoff-filter convention. Source: contact surface metrology, ISO 4287 / ASME B46.1 roughness measurement.

## One-sentence mechanic description
A stylus sits fixed near the right edge of a divider while the measured surface's roughness trace scrolls continuously beneath it from right to left, peaks and valleys passing under the tip forever.

## Rendering approach
2D canvas, `w-full` at a divider-scale height (48-64px). Ring buffer of height samples at 4px horizontal pitch scrolling left at a constant rate, so old samples exit the left edge and new ones enter at the right — no reset, no seam. Height samples come from fixed seeded 1D fractal noise (2 octaves, wavelengths 18px and 54px) representing roughness, summed with a shallow 240px-wavelength sinusoid at 0.4x the roughness amplitude representing waviness, per the real roughness/waviness decomposition.

## Real numbers
- Scroll speed: 24px/s (≈6 new samples/s entering at the 4px sample pitch).
- Stylus fixed position: x = 82% of container width.
- Peak deflection: 0.35 * divider height.
- Roughness noise: 2 octaves, wavelengths 18px and 54px. Waviness: sinusoid wavelength 240px, amplitude 0.4x roughness amplitude.
- Stylus tip indicator: a short vertical stroke whose length instantaneously matches the current trace height directly beneath it (the "drop-off" read).

## The resting loop
- t0: ring buffer is pre-seeded, never literally blank — trace already mid-scroll with peaks/valleys visible.
- 2.5s later: ~60px of new trace has entered from the right; the segment under the stylus is a different peak/valley arrangement.
- 5s later: fully different trace segment under the stylus, a distinct excursion registered.

## Reduced-motion freeze frame
Freeze at the deterministic (seeded) phase where the stylus sits directly over the deepest valley in the visible buffer — not t0. Named `FREEZE_PHASE = deep-valley-lock`.

## Legibility
The one thing to follow: the trace scrolling past the fixed stylus tip, whose indicator line visibly rises and drops as peaks and valleys pass under it. Cadence: continuous constant-px/s scroll (24px/s) rather than a discrete swap, so there is nothing to time a blink against — the eye tracks a smooth drift.

## Interaction
Hovering the trace area locally slows scroll speed up to 60% within a radius around the pointer (reads as "zooming attention" on that stretch), reverting over 400ms after the pointer leaves. Must NOT: recolor the trace or stylus with `--ns-accent`; stop scroll entirely at any point (kills alive-at-rest).

## Light vs dark theme
Trace stroke `--foreground`. Zero-line baseline `--border` (a thin flat reference line, per the separator-token rule — never used as trace fill). Stylus tip `--foreground` with a small filled circle. Checked in light theme first for trace-vs-baseline separation.

## Kill criteria
Reject if: the ring buffer ever produces a visible jump/seam on wrap; scroll speed is tied to raw frame count instead of elapsed time (reads as jittery on a variable frame rate); trace amplitude falls below the perceptual floor at minimum divider height/card width.
