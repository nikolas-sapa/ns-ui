# tray-weep

- **slug:** `tray-weep`
- **tier:** loud (full-bleed WebGL showpiece)

## Product surface it replaces
Section divider / full-bleed background band between page sections.

## The real mechanic
Bubble-cap distillation column tray. Vapor rises through a stack of horizontal trays, forced through slotted caps that sit submerged under a shallow pool of liquid on each tray; the vapor exits the cap slots as a curtain of small bubbles that froths up through the liquid layer, while liquid itself flows across the tray from an inlet downcomer to an outlet weir and spills down to the tray below. When vapor velocity locally sags below design, liquid "weeps" backward down through the cap slots instead of the vapor bubbling up through them — a named tray-design failure mode engineers explicitly design against. Source: standard tray-column (bubble-cap / sieve-tray) distillation internals, chemical engineering unit-ops.

## One-sentence mechanic description
A horizontal band of liquid froths continuously as vapor bubbles up through a row of submerged caps, liquid creeping sideways toward a weir and spilling to the band below while any cap running short on vapor weeps liquid back down through itself.

## Rendering approach
WebGL, fullscreen triangle + fragment shader over a banded layout: N horizontal tray bands (N derived from container height / a fixed 90px tray-spacing-equivalent, min 2, max 6), each band a shallow froth layer. Cap positions on a 1D row per band, spacing = container width / 14 (fixed cap count reads consistently at card and full-bleed scale — geometry re-derives cap count, not spacing, on resize using the smaller dimension as the base unit).

## Real numbers
- Per-cap bubbling frequency: 18 Hz at nominal vapor rate (real bubble-cap columns run roughly 10–50 Hz per slot; 18 chosen as a legible-at-60fps mid-point — individual bubbles render as short-lived luminance blobs, not tracked as discrete sprites past ~20Hz).
- Froth height: oscillates 30–55% of tray gap, period 1.8s, driven by the aggregate bubbling rate across all caps in a band (froth is a density field, not literal bubble geometry, above the per-cap layer).
- Liquid lateral flow: creeps from inlet (left edge) to weir (right edge) at 4% of tray width per second; on reaching the weir, spills to the band below over 250ms, restarting the inlet flow (so lateral position resets, matching the real inlet-to-weir-to-downcomer cycle).
- Weep events: a cap randomly (Poisson, mean interval 3.5s per cap) drops below the vapor threshold for 400–700ms; during that window its bubbling reverses to a downward droplet instead of an upward bubble curtain — visually distinct direction, not just a pause.
- Tray-to-tray cascade delay: liquid spilling from tray N reaches tray N+1's froth layer 180ms later (accumulates a slight visible phase offset down the stack — no two trays are ever in the same froth phase).

## The resting loop
- t0: all trays' froth heights at different phases (per the 180ms cascade offset), 0–1 caps currently weeping.
- 2.5s: at least one full lateral liquid-flow cycle has completed on the topmost tray (spill event visible), froth heights have shifted through roughly 1.4 periods.
- 5s: the weep-event pattern across caps is a different subset than t0 (Poisson-random, so structurally guaranteed to differ over a 5s window given the 3.5s mean interval).

## Reduced-motion freeze frame
Freeze mid-cascade: topmost tray at peak froth height, a spill event frozen at 50% opacity/height transition into the tray below, one cap mid-weep (droplet visible, not yet detached) — the single frame showing bubbling, spilling and weeping simultaneously. Named: `FREEZE_PHASE = mid-cascade-with-weep`.

## Interaction
Pointer over a tray band locally raises that band's vapor rate (frothier, faster bubbling directly under the cursor, radius = 15% of container width), decaying over 500ms on leave — a real tray-column behavior (local vapor maldistribution reads as more/less froth). Must NOT: recolor froth with `--ns-accent`; must NOT let the interaction stop or reverse the lateral liquid-flow cycle (that would read as broken plumbing, not response).

## Light vs dark theme
Dark: froth at `--ns-muted` climbing to `--foreground` at peak bubble density. Light: liquid body sits close to `--background` with froth read via a `--border`-adjacent-but-distinct value bump (never literally `--border`, which must stay invisible-as-fill) — checked in light theme first, since a full-bleed band in light mode is the harder case per the recipe.

## Kill criteria
Reject if: the weep direction-reversal is dropped (loses the one mechanic that makes this identifiably a distillation tray and not generic bubbling); if trays don't visibly cascade with a phase offset (reads as one repeated band tiled vertically); if froth density at card scale collapses below the perceptual floor (fewer than ~6 caps visible at minimum supported width).
