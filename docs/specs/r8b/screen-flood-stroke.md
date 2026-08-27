# screen-flood-stroke

- **slug:** `screen-flood-stroke`
- **tier:** core (card-scale 2D canvas)

## Product surface it replaces
Loader / ambient progress indicator — a "something is being produced" affordance, not a percentage bar.

## The real mechanic
Screen printing. A squeegee performs a flood stroke (light pass, no downward pressure, spreads ink evenly across the mesh without pushing it through) followed by a print stroke (firm pass, blade angled roughly 75°, forces ink through the mesh openings onto the substrate). Mesh count (threads per inch, e.g. 156 mesh) sets the dot/grain resolution of what prints. Source: manual screen-printing flood/print stroke cycle, standard textile/poster-print process.

## One-sentence mechanic description
A squeegee alternates a light flood pass that spreads ink across the mesh and a firm print pass that forces it through, printing one impression per cycle.

## Rendering approach
2D canvas, card-scale. Mesh grid pitch = clamp(min(w,h)/60, 4px, 9px) — finer than a printed-dot pitch since it represents mesh fabric, not the ink itself. Squeegee is a single bar angled 18° from vertical, traveling across the card.

## Real numbers
- Cycle period 1.8s total: flood stroke 0.6s (left→right, low pressure, spread alpha stays at 0.15), print stroke 0.9s (right→left, high pressure, ink-through alpha jumps to 0.9 at openings the stroke has passed), 0.3s dwell/lift.
- Ink-through accumulation: openings the print stroke has covered stay inked, up to 2 stacked layers, alpha capped at 0.9; older impressions decay via exponential falloff (tau = 2.4s) toward a floor of 0.2 (residual staining — never reaches 0, so it never reads as freshly wiped/static).
- Mesh fabric line itself drawn at low, fixed alpha (0.08) of `--foreground`, always faintly visible under the ink.

## The resting loop
- t0: mid-flood-stroke (squeegee 30% across), low-pressure smear visible, no fresh impression on the substrate yet.
- 2.5s: past one full cycle into the next flood pass — a full fresh impression from the prior print stroke is visible, partway through its fade toward the 0.2 ghost floor, with the new flood pass underway.
- 5s: two overlapping ghosted impressions of different fade ages plus the current stroke are all visible simultaneously.

## Reduced-motion freeze frame
Freeze at t = 1.5s (`FREEZE_PHASE = print-stroke-60pct`) — squeegee mid print-stroke, visibly angled, roughly 60% of the mesh printed and 40% not yet, the single most legible "process caught in the act" frame.

## Interaction
None required for the passive loop. If used as a determinate affordance, a progress value 0-1 may drive the print-stroke's rightward travel distance instead of the clock — but the flood-stroke/mesh sheen must keep animating unforced even once progress reaches 100% (stays alive at rest per Filter 2, does not finish and stop).

## Light vs dark theme
Ink = `--foreground` over `--background`. The mesh fabric line must use a low-alpha `--foreground`, not `--border` — `--border` is reserved as an invisible separator token and would vanish as a stroke, defeating the always-visible-mesh requirement.

## Kill criteria
Reject if the flood/print two-stroke distinction isn't visually legible (reads as one generic wipe). Reject if the ghost-fade residue reads as a rendering bug (smudgy/dirty) rather than an intentional print-shop artifact on review.
