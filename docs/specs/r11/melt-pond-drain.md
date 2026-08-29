# melt-pond-drain

- **slug:** melt-pond-drain
- **tier:** core (card-scale)

## Product surface
Loader / empty-state ambient panel — same slot family as `loader-ink-blob`, `empty-state-sonar`.

## The real mechanic
Melt ponds: pools of meltwater that sit atop summer sea ice (or supraglacial ice), growing through the melt season. They drain rapidly, often within roughly an hour to a few hours, once meltwater finds or opens a crack, seal-breathing-hole, or moulin connecting through to the ocean/englacial drainage below. Water level drops visibly during the drainage event, sometimes leaving a lighter drained-pond floor exposed. Ponds refill from continued melt and can drain again through a DIFFERENT crack later in the season as drainage paths open, migrate, and reseal. Documented in sea-ice/glaciology melt-pond literature (e.g. Polashenski et al. on Arctic melt-pond drainage events).

## Mechanic description (user-facing)
A shallow pool slowly fills, then drains fast through a crack that opens at a new spot each time, leaving a shallow residual pool that refills and repeats.

## Rendering approach
2D canvas (or DOM+SVG basin shape), card-scale, `w-full h-full`. A basin depression with a pale/reflective water surface whose level and a small drain-crack marker are the only moving parts.

## Real numbers
- Fill phase: real ponds fill over days to weeks of melt — compressed to ~9–11s render time.
- Drainage event: real rapid-drainage events run under an hour to a few hours — compressed only mildly, rendered over ~1.2s (fast but well above the round-9 "no blinks" floor, and the funnel-dimple/level-drop/floor-expose stages give it visible departure and arrival).
- Level drop per drainage event: 80–90% of pond depth, never to zero — a shallow residual pool always remains (matches field-observed partial drainage).
- Drain location: a new position along the basin rim is chosen each cycle, explicitly excluding the immediately-prior location.
- Refill: resumes over ~9–11s from the residual level toward the next drain threshold.

## The resting loop
- **t0:** pond mid-fill or mid-drain (seed non-empty, non-full).
- **2.5s:** water level visibly different from t0 (risen further, or a drain event has fired and level has dropped).
- **5s:** at minimum one full drain-and-refill-start cycle boundary has been crossed since t0, at a different rim location than any prior drain in view.

## Reduced-motion freeze frame
Freeze mid-drainage: funnel dimple formed, level partway through its drop, floor partly exposed — the single most structured frame (shows basin, water, AND the drain mechanism at once), not a flat full or empty pond.

## Interaction
None — ambient loader/empty-state filler. No pointer-driven draining; the mechanic is melt/gravity driven, not touch driven.

## Legibility
The ONE thing to follow: the drain event — the pond surface visibly dropping into a newly opened crack point (dimple forms, level falls, floor settles). Recurs roughly every 10–12s; each event takes ~1.2s door-to-door, clearly longer than a blink.

## Light vs dark theme
Dark: dark basin floor, pale reflective water surface (near `--foreground`'s bright end). Light: pale basin floor (`--ns-muted`-derived), water surface reads as a value step distinct from the floor via subtle specular/edge shading rather than hue — checked early since flat pale-on-pale is the failure mode.

## Differentiator (checked against neighbours)
`registry/core/gauge-capacity-waterline` and `registry/core/meter-quota-meniscus` are both data-bound, steady-state water-level metaphors driven by an external `value` prop (capacity/quota gauges) with no self-driven episodic behaviour. melt-pond-drain is unbound and ambient by default, and its climax is a periodic, self-triggered "finds a new crack and drains" event — a fill-drain-refill CYCLE, not a level-vs-threshold reading. Also distinct from the fracture-family siblings (`craze-rule`, `compare-crack-seam`): the crack here is incidental infrastructure for the drain, not the subject — the subject is the water level and surface.

## Kill criteria
- If the fill/drain distinction isn't visible across t0/2.5s/5s (e.g., landing on the same slow fill phase twice) → reject.
- If a drain event reads as an instant level-snap rather than a dimple/fall/settle sequence → reject (round-9 cadence rule).
- If the drain location repeats at the exact same rim spot every cycle → reject (reads as a mechanical valve, not migrating drainage).
- If any color literal or `--ns-accent` touches the water surface or drain marker → reject.
