# gather-marver

**tier:** core (card-scale, 2D canvas)

## Product surface it replaces
A file-upload / processing indicator — the spot a generic spinner or indeterminate progress ring currently occupies while raw input is being normalized into a usable shape.

## The real mechanic
Gathering and marvering in glassblowing. A gaffer gathers a molten gob of glass on the end of a blowpipe — the gob comes off the furnace lopsided and off-centre — then rolls it back and forth on the marver, a flat steel (historically marble) table. The rolling motion isn't decorative: it centres the gob's mass around the pipe's axis and skins its outer surface, correcting the initial asymmetry into a workable, rotationally even shape before any blowing starts. Source: standard hot-shop gather/marver sequence (glassblowing fundamentals, e.g. Corning Museum of Glass process descriptions).

## One-sentence mechanic description
An irregular, off-centre blob rolls back and forth across a flat baseline, visibly losing its lumps and creeping toward a centred, even disc the longer the process runs.

## Rendering approach
2D canvas, single card-scale field (no grid — one deforming blob path). Blob outline is a closed Catmull-Rom spline over 12 control points; geometry radius derives from 42% of the container's smaller dimension. Marver line is a static 1px `--border` baseline the blob rolls along.

## Real numbers
- Roll cadence: one full pass (left travel + right travel) every 1.8s — a back-and-forth period slow enough to read as deliberate rolling, not a shake.
- Each of the 12 control-point radii starts with amplitude noise up to ±35% of base radius (the "lopsided gob"), and every completed roll pass reduces each point's deviation by a factor of 0.82 (so full visual centring — deviation under 3% — takes roughly 9 passes, ~16s).
- Horizontal travel per pass: ±28% of container width around centre.
- Rotation: the blob also spins 24°/s continuously (its own axis, independent of the roll travel) — this is the pipe rotating under the gaffer's hand, and it's what keeps the loop unbounded even after centring finishes: once fully centred, a perfectly round, evenly-shaded disc still visibly spins.

## The resting loop
- t0: blob is markedly lumpy (large deviation), near left extent of its travel.
- t2.5s: roughly 1.4 passes elapsed — visibly less lumpy, past centre, still travelling.
- t5s: ~2.8 passes elapsed — noticeably rounder, deviation down to roughly 45% of its starting amplitude, at a different point in its travel/rotation than either earlier frame.

## Reduced-motion freeze frame
Freezes on a partially-centred frame (STATIC_PASS = 5 of the ~9 needed, roughly mid-correction, deviation ~35% of start) rather than the fully lumpy start or the fully round end — the single frame where the "correcting toward round" mechanic is legible without needing motion to prove it.

## Interaction
None required for the base loop. If used as an active upload indicator, real progress (0–100%) may be mapped onto the pass counter (progress 0% = pass 0/9, 100% = fully round) instead of looping indefinitely — but that mode must not use the accent colour to mark completion; a settled, fully-round, evenly-lit disc at `--foreground` luminance is the completion state.

## Light vs dark theme
The blob's fill is a radial luminance gradient between `--ns-muted` (rim) and `--foreground` (near-centre "hot skin"), same in both themes — check light theme first since the rim can wash out against `--surface` there; increase rim-to-background luminance delta if a light-theme contrast check comes back under 3:1.

## Kill criteria
If the centring correction is too subtle to perceive within a single 5-second observation window (i.e. t0 vs t5s look like the same blob), kill it — the whole point is a visible before/after within the resting-loop check.

## Legibility
The one thing to follow: an uneven blob getting rounder, one roll pass at a time, on a 1.8s cadence — slow enough that a viewer can count "it just got a bit rounder" as a discrete event rather than a blur.
