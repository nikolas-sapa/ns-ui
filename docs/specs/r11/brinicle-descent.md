# brinicle-descent

- **slug:** brinicle-descent
- **tier:** loud (full-bleed showpiece)

## Product surface
Full-bleed hero / background panel — the ambient underwater-ice backdrop behind a page hero or section, same slot as `weld-pool`/`dye-whorl`/`flyback-tear`.

## The real mechanic
Brinicles ("ice stalactites"): as sea ice forms above a water column, it rejects brine, which is colder and denser than the seawater below. The brine sinks in a plume; because it is at (or below) the surrounding water's freezing point, a thin ice sheath nucleates and grows around the descending plume, extending it downward as a hollow tube. Documented in Antarctic/Arctic time-lapse (BBC *Frozen Planet*; oceanographic brine-rejection-channel literature, e.g. Dayton & Martin 1971's brine-drainage observations). Reported field/time-lapse descent rates cluster around 0.3–1.5 m/hr; sheath radius grows diffusion-limited (Stefan-problem sqrt(t) behaviour — thickest near the ceiling where it's oldest, thinnest at the active tip). On reaching the seafloor the plume spreads into an expanding ice halo that can freeze benthic organisms in place. Brinicles are also transient: a given tube thickens, eventually detaches from the ice sheet above (loses its brine feed or is stressed off), and drifts away, while new downwelling sites keep nucleating fresh tips elsewhere — never a single one-shot event at a downwelling site.

## Mechanic description (user-facing)
A finger of ice grows downward through dark water, freezing a spreading halo where it touches bottom, then breaks free as a new one starts nearby.

## Rendering approach
2D canvas, full-bleed, `w-full h-full`. Geometry (tube widths, halo radii) derived from the container's smaller dimension. Up to 3 tubes live concurrently, each an independent state machine (nucleate → descend → touchdown/halo → detach → fade), on staggered timers so lifecycles overlap.

## Real numbers
- Real descent rate: 0.3–1.5 m/hr (field/time-lapse range). Frame column height maps to ~2.5 m of water column.
- Compression: full descent rendered in ~10s screen time → ~1900–2900x real time, documented explicitly as an illustrative compression (this is a slow geological process; the ratio is disclosed in a code comment, not hidden).
- Sheath radius: starts at container-min-dimension / 180 at the tip, grows to /70 at the tube's oldest (ceiling) end via a sqrt(age) profile.
- Touchdown halo: expands over 1.8s to ~15% of frame width, holds 0.6s, fades over 2s.
- Detach: a 0.4s gap-opening animation at the ceiling attachment, then the tube drifts down ~40px over 1.5s fading to 0 opacity.
- New tip nucleation: staggered 3–6s before the prior tube's detach completes, at a different x position, so at least one tube is always mid-descent — never a global reset to empty.
- Full single-tube lifecycle: ~11–14s nucleate-to-fade-out.

## The resting loop
- **t0:** one or two tubes mid-descent at different depths/ages (never a blank frame — seed the initial state pre-advanced rather than starting all tubes at the ceiling).
- **2.5s:** tube positions visibly advanced; sheath thickness at the ceiling end visibly greater than at t0.
- **5s:** at least one touchdown halo has fired or is firing; tube count/positions differ from both prior checkpoints (new tip nucleated, an old one mid-detach).

## Reduced-motion freeze frame
Freeze on a state with one fully-developed mid-descent tube (thickened sheath, tip ~60% of the way down) and a second, younger tip just nucleated near the top — the most structurally complete single frame (shows sheath-thickness gradient, an active tip, and multiplicity at once), not the near-empty t0.

## Interaction
None required — ambient hero/background. If any: pointer proximity may add a subtle turbulence wobble to a tube's path, but must NOT change descent rate, trigger nucleation, or touch the touchdown halo's opacity/color — the mechanic is thermal/gravitational, not user-driven.

## Legibility
The ONE thing to follow: the single most-advanced tube's leading tip, descending steadily and then flashing into a touchdown halo. Cadence: a full tip-to-touchdown descent takes ~10s screen time, touchdown-to-detach another ~2–4s — well above the ~1s "followable discrete event" floor, and the tip's motion is continuous (not a jump-cut), so departure and arrival are both visible.

## Light vs dark theme
Dark: near-black cold water: tube sheath reads bright (high luminance) via a rim highlight (weld-pool-style: rim brighter than core), touchdown halo near-white. Light: pale-grey water (`--ns-muted`-derived background wash); tube inverts to read as a darker, structured column against the pale field (dye-whorl-style value inversion, not a literal color swap) — checked early since a bright-on-pale reading would wash out. Neither theme uses `--ns-accent`; the touchdown halo's climactic flash is pure luminance.

## Kill criteria
- If the compression ratio makes tube growth read as static across a 2.5s screenshot window → reject (fails alive-at-rest).
- If only one lifecycle exists at a time (empties fully before the next nucleates) → reject (finishes and stops).
- If `--ns-accent` or any color literal touches the tip glow or touchdown halo → reject.
- If light theme reads as a flat pale rectangle with no visible tube structure → reject.
