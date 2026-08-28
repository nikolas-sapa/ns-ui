# glory-hole-cycle

**tier:** core (card-scale, DOM + 2D canvas)

## Product surface it replaces
A generic "processing / actively syncing" status chip or badge — the pulsing-dot pattern used to say "this is still being worked on right now."

## The real mechanic
Glassblowing's glory-hole reheat cycle. A gaffer's piece cools as soon as it leaves the furnace mouth — soda-lime glass drops from working-hot (~1,100°C at the glory hole) toward the point it stiffens too much to shape (~900°C) within seconds of open air. The gaffer periodically reinserts the piece into the glory hole to reheat it back to working temperature, then withdraws it to work while it's hot, repeating for as long as the piece is being formed. Source: standard hot-shop technique, documented in glassblowing studio practice (e.g. Corning Museum of Glass hot-shop demonstrations) — the reheat/withdraw rhythm, not a single glow.

## One-sentence mechanic description
A status chip's glow ramps up sharply as if reinserted into a furnace mouth, then decays through an orange-to-neutral luminance curve as if pulled back out to be worked, repeating on a steady beat for as long as the process is active.

## Rendering approach
DOM: a rounded chip (`--surface` fill, `--border` 1px ring) containing a small circular canvas (36×36 CSS px, DPR-scaled) for the "glass" glow plus a text label. Canvas draws a soft radial gradient disc; no grid — single-element field, radius fixed at 60% of the canvas's smaller dimension.

## Real numbers
- Cycle period: 4.0s, fixed, non-negotiable cadence (well under the "near/above paint rate aliasing" trap, far above the ~1s-per-event legibility floor).
- Reheat ramp (glow rising): 0.7s, eased in (cubic ease-out) from `Lmin` to `Lmax`.
- Cool decay (glow falling): 3.3s, exponential decay `L(t) = Lmin + (Lmax-Lmin) * exp(-t/τ)` with τ = 1.1s, so it visibly dims fast then trails slowly — matching real radiative cooling, not a linear fade.
- `Lmax` = 0.92 (near `--foreground` luminance mixed toward white-hot), `Lmin` = 0.18 (near `--ns-muted`), both interpolated in luminance only — no hue at any point.
- A subtle 1px inner ring pulses opacity 0.15→0.4 in sync with the reheat ramp only (reads as "reinsertion," a discrete event, not continuous shimmer).

## The resting loop
- t0: mid-decay, canvas at roughly 45% luminance, ring at 0.15 opacity.
- t2.5s: a fresh reheat ramp is underway (2.5s falls ~0.5s into a new 4.0s cycle) — canvas near peak brightness, ring near 0.4.
- t5s: past one full cycle, into the decay tail of cycle two — visibly dimmer again, different phase than t0.

## Reduced-motion freeze frame
Freezes at the peak of the reheat ramp (t = 0.7s into the cycle, `L = Lmax`, ring opacity 0.4) — the single frame that most clearly shows "hot," the component's legible extreme, rather than an ambiguous mid-decay grey.

## Interaction
None required — it's a passive status indicator. If a dismiss/cancel affordance is added, it must not restart or accelerate the glow cycle on hover/focus (the cycle represents real elapsed process time, not UI feedback).

## Light vs dark theme
Both themes interpolate the same `Lmin`→`Lmax` sweep between `--ns-muted` and `--foreground` (never literal orange). In light theme the "hot" peak reads as a bright near-white disc against the muted chip background; in dark theme it reads as the disc brightening toward foreground white against a near-black chip. Contrast is checked at both extremes in light theme first, since `Lmin` sitting too close to `--surface` there is the likely failure.

## Kill criteria
If, in light theme, the decay tail (last ~1.5s of each cycle) becomes indistinguishable from the resting chip background at normal viewing distance, kill it — the whole mechanic depends on the low end still reading as "dim, not gone."

## Legibility
The one thing to follow: a single glow rising fast and falling slow, once every 4 seconds. That period is well clear of both known failure modes (not a strobe near paint rate, not a sub-second blink) and gives a full second-plus at both the bright and dim ends for the eye to register each state before the next transition starts.
