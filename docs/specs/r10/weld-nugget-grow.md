# weld-nugget-grow

**tier:** core

**product surface it replaces:** a press-and-hold confirm button (destructive-confirm,
"hold to submit", "hold to merge two records") — the class of control currently served by
generic radial-fill hold buttons.

**the real mechanic, with its source:** resistance spot welding (RWMA / AWS D8.9). Two
copper electrode tips clamp two metal sheets under force and pass a heavy current pulse
through the stack; resistive heating melts a lens-shaped "nugget" that grows outward from
the electrode centerline as current continues, held under electrode force so it solidifies
under pressure. If the weld schedule overshoots (too much current/time for the sheet
thickness) molten metal is expelled from the faying surface before the electrodes retract —
"expulsion," a visible spatter defect, is the real failure mode operators watch for and is
the boundary the good/bad weld sits against.

**one-sentence mechanic description:** two electrode tips clamp down on a seam and a bright
molten nugget grows outward from their center under sustained pressure, solidifying into a
fused dark spot the instant the current cuts — or, if held too long, spits a burst of
expelled material at the edge before locking.

**rendering approach:** 2D canvas for the nugget growth (radial gradient field, no WebGL
needed at card scale), DOM for the two electrode tip shapes converging via CSS transform.
Canvas sized 96x96 logical px at the weld site, DPR-scaled.

**REAL NUMBERS:**
- electrode squeeze: 180ms travel to clamped (matches a real weld schedule's squeeze-time
  order of magnitude scaled for legibility, not the literal ~250ms industrial figure).
- current/heat pulse: nugget radius grows from 0 to 14px over 640ms on an ease-out curve
  (fast initial growth as resistance is highest before the interface melts, slowing as the
  molten pool approaches steady-state diameter) — this is the ONE thing to follow, at a
  cadence slow enough to track (640ms is well above the ~130ms "too fast to read" floor
  from the round 9 legibility note).
- hold-at-full-nugget: 900ms, brightness holding at peak (+0.4 luminance at nugget core,
  decaying to background over the outer 6px "heat-affected zone" ring).
- normal-cycle solidify: nugget luminance decays from molten (+0.4) to solid dark fused
  spot (`--foreground` flat, no glow) over 500ms as current cuts and electrodes hold under
  force before retracting.
- 1-in-4 cycle "expulsion" variant: at the 640ms growth peak, a single small burst — 3-5
  short radial streaks, 8-16px length, 90ms fade — fires from one edge of the nugget before
  the same solidify sequence plays; this is a deliberate, infrequent variation, not every
  cycle, so it reads as a real defect case rather than the baseline behavior.
- full loop period: 180ms squeeze + 640ms growth + 900ms hold + 500ms solidify + 900ms
  retract/idle = 3.12s, repeating continuously.

**the resting loop:** t0 — electrodes open, bare seam, no nugget. t2.5s — within the growth
window, a mid-size bright nugget (roughly cycle position 2.5/3.12=0.80 → deep in solidify,
so at t2.5s the nugget is dark/fused with electrodes about to retract — verify against the
period above and adjust phase offset if needed so 2.5s lands mid-growth rather than
post-solidify, since mid-growth is the most legible of the three sample points). t5s —
second cycle in progress (5s mod 3.12s = 1.88s into cycle two, deep in the hold/solidify
transition), visibly different nugget state from both earlier samples.

**the reduced-motion freeze frame, named explicitly:** `STATIC_PHASE = "held"` — electrodes
clamped, nugget at full molten radius and peak brightness, mid-hold. Chosen over the
solidified/retracted frame because a viewer needs to see the nugget AT ITS MOST DEVELOPED,
not after it's gone dark and lost its shape.

**interaction (if any) and what it must NOT do:** press-and-hold on the control drives the
squeeze→growth→hold sequence directly off pointer/touch duration instead of the ambient
clock (release before 820ms = electrodes retract without a weld, a clean abort, no nugget
forms); releasing after the growth threshold locks the weld immediately rather than waiting
out the ambient hold window. The molten nugget's glow must be luminance-only — no accent
tint on the "success" moment, which is exactly the climactic-moment case the token rules
call out by name.

**how it reads in light vs dark theme:** dark — molten nugget as a bright near-white radial
core against dark electrode tips; solidified nugget drops to a mid-value dark `--foreground`
dot, still distinguishable from bare sheet by a thin `--border` ring (the heat-affected
zone). Light — same luminance relationship (molten = brighter than surround, in this case
meaning LESS dark rather than literally brighter-than-white, capped so it never blows past
`--background`), solidified nugget stays `--foreground`-dark and reads clearly since dark-
on-light has more headroom than the dark theme's bright-on-dark case — check the light pass
specifically for the molten phase, since that's the direction most likely to wash out.

**kill criteria:** if the nugget growth reads as a generic pulsing circle indistinguishable
from a loading spinner, reject — the electrode clamp geometry and the hold/solidify sequence
must be visible, not just a growing blob. If the expulsion variant is too rare to ever
appear in a 3-sample verification screenshot window, that's fine (it's a bonus detail, not
the graded behavior) but if it's needed to make the loop feel alive, the base cycle itself
has failed Filter 2 and the component should be reworked or killed.
