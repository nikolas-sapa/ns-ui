# microtome-ribbon-feed

- **slug:** microtome-ribbon-feed
- **tier:** loud (full-bleed showpiece)

## Product surface it replaces
Full-bleed hero.

## The real mechanic
Rotary microtome sectioning: the specimen block advances a fixed feed
increment (typically 2-10 microns) per handwheel revolution, the blade cuts
a paper-thin section on the down-stroke, and each fresh section adheres
edge-to-edge to the previous one (static cling / surface tension) — building
an unbroken ribbon that curls off the blade and drapes under its own weight.

## One-sentence mechanic description
A microtome blade slices paper-thin sections off an advancing specimen
block, each section clinging to the edge of the last to build an unbroken
ribbon that curls and drapes below the blade.

## Rendering approach
2D canvas, full-bleed. Ribbon modeled as a linked chain of N=140 segments
(max grown length), each segment a short rigid link of length 6px at a
1080px-tall reference frame, scaled by `containerMinDim / 1080`. Chain
physics: simple verlet/catenary relaxation under a constant downward pull so
older (lower) segments sag more than fresh ones near the blade. Block and
blade rendered as a 3-4 stop `--foreground`/`--ns-muted` luminance ramp
(same "give the environment structure" approach as weld-pool).

## Real numbers
- Handwheel stroke cycle (advance + cut + return): 1.4s.
- One new ribbon segment is added per stroke — cadence 1.4s/segment.
- Block face feed increment: rendered as a fixed 3px advance per stroke
  (stands in for the real 5-micron feed).
- Simulated gravity constant for ribbon droop: 900 px/s² (scaled to canvas
  space), producing visible catenary sag that increases with ribbon length.
- Ribbon caps at 60 segments (~84s of growth); on reaching the cap it lifts
  away over a 2s fade, the block resets to zero feed depth, and the cycle
  restarts — unbounded loop.

## The resting loop
- **t0:** short 4-segment ribbon just starting to form, block near its zero
  position.
- **2.5s:** ~9 segments grown, ribbon visibly longer, sag just beginning to
  show at the oldest end.
- **5s:** ~16 segments grown, pronounced catenary drape filling noticeably
  more of the frame than at t0.

## Reduced-motion freeze frame
Freeze at the **22-segment "half-grown" frame**: fresh thin sections
visible right at the blade edge, older segments showing full catenary
drape below — the single frame that shows both ends of the mechanic at
once (formation and drape).

## Interaction
Pointer proximity may add a small local sway to the draped ribbon — a
luminance-only glint that leads the pointer (lead-compensated per the
showpiece recipe's pointer-follower lesson). It must NOT change the feed
cadence, accelerate section formation, or introduce any accent-tinted
highlight.

## Light vs dark theme
Blade and block use the metal-value ramp pattern (near-black to near-white
stops in both themes, bias/contrast shifts between themes rather than
direction). Ribbon renders as a thin translucent `--foreground` strip over
`--background`; in light theme, bump strip alpha up (checked explicitly,
not assumed) since a thin light-on-light strip is the harder case named in
the showpiece recipe.

## Kill criteria
- If the ribbon reads as a generic wavy line with no legible per-segment
  joins (no visible banding at segment boundaries), reject.
- If segment cadence is faster than roughly 1s/segment such that individual
  section formation cannot be tracked by eye, reject.

## Legibility
The ONE followable thing: a new ribbon segment forming and joining exactly
at the blade edge. Cadence: 1.4s/segment — in the ~1-second range the round
9 lessons call out as followable — with a visible departure (thin section
peeling off the block) and arrival (joining the prior ribbon's edge), never
a blink-cut.
