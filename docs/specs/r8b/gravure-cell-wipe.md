# gravure-cell-wipe

- **slug:** `gravure-cell-wipe`
- **tier:** core (card-scale 2D canvas)

## Product surface it replaces
Divider / background texture strip — an ambient, always-moving band rather than a static rule.

## The real mechanic
Rotogravure printing. An engraved copper cylinder carries a matrix of ink-retaining cells whose depth (typically 4-40 microns) sets tonal value: deeper cells hold more ink and print darker. Each rotation, the cylinder is flooded with ink, then a steel doctor blade wipes the cylinder's land area clean, leaving ink only inside the cells. Source: rotogravure cylinder engraving and doctor-blade ink metering, the standard packaging/publication-print process.

## One-sentence mechanic description
A rotating cylinder of etched cells sweeps under a wiping blade every turn, each cell's depth deciding how much ink survives the wipe.

## Rendering approach
2D canvas. Cell grid derived from the container's smaller dimension: pitch = clamp(min(w,h)/48, 6px, 14px). Cell depth per grid position comes from a single low-frequency value-noise field, seeded once at mount (static per instance, not per frame). The doctor-blade wipe is a vertical band, width = 3 cell-pitches, sweeping left to right across the grid, wrapping (cylinder is circumferential).

## Real numbers
- Cylinder circumference = grid width in cells; rotation rate completes one full wipe pass every 20s (18°/s equivalent).
- Doctor-blade band width = 3 cell-pitches.
- Steady-state ink alpha per cell = depth (0-1) × 0.85 max, composited toward `--foreground` over `--background`.
- Freshly-wiped columns get a +0.12 luminance boost for 400ms after the blade passes, decaying exponentially (tau = 900ms) back to steady state.
- Cell radius drawn at 0.75× pitch (leaves visible land/gutter between cells, doesn't tile solid).

## The resting loop
- t0: wipe band at column 0; cells ahead of the band show the raw unwiped ink field (denser, unsettled); cells behind are already at settled steady-state value.
- 2.5s: band has swept ~1/8 of the grid width (45° of rotation); a bright "just-wiped" trailing swath is visible immediately behind it, distinct from the rest of the settled field.
- 5s: band at ~1/4 width (90°); cumulative wiped region and its decay trail have visibly changed shape and position from both t0 and 2.5s.

## Reduced-motion freeze frame
Freeze with the wipe band at 50% across the grid (`FREEZE_PHASE = mid-rotation`) — the one frame that shows both the unwiped ink field ahead and the wiped/settled field behind simultaneously.

## Interaction
Pointer proximity within 3 cell-pitches locally nudges displayed cell depth +0.15 (a "peek" at more ink), decaying over 600ms once the pointer leaves. Luminance-only — must NOT use `--ns-accent` and must not leave a persistent tint.

## Light vs dark theme
Ink = `--foreground` over `--background`. Cap steady-state cell alpha at 0.85 in dark theme, 0.7 in light theme (dark ink on light ground reads heavier at equal alpha) — check light theme at card scale (~280px) first, not last.

## Kill criteria
Reject if the wipe band reads as a generic CRT/scanline sweep with no legible cell-depth story. Reject if card-scale renders fewer than ~20 visible cells across the short axis (illegible) — the pitch clamp must be revisited, not shipped illegible.
