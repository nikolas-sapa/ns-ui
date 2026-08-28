# crimp-barrel-set

**tier:** core

**product surface it replaces:** a "connect/link/attach" confirmation control — pairing
two accounts, attaching a file to a record, linking two nodes — anywhere a button currently
just swaps an icon or shows a checkmark on success.

**the real mechanic, with its source:** open-barrel wire crimping (MIL-STD-1130 /
Molex application-spec geometry). A crimp tool's dies close around a metal barrel with a
wire's stripped strands inside; the barrel is compressed into an asymmetric "B-crimp" or
"F-crimp" cross-section (not a uniform squeeze — the die geometry deforms the barrel into
a characteristic double-dimple witness shape), and the strands themselves visibly displace
and flare slightly at the barrel mouth (the "brush") where they weren't fully captured.
A good crimp is judged by that witness-mark shape, not just "did it close."

**one-sentence mechanic description:** two dies close in from opposite sides on a barrel
holding two conductor ends, flattening it into a stepped, witness-marked profile that
visibly locks the two ends together, with a small flare of displaced strand material at
each mouth.

**rendering approach:** DOM/SVG, no canvas needed. Barrel is a single SVG `<path>` (rounded
rect, ~120x36 logical units at rest) with two conductor ends as separate paths entering
from left/right; the crimp dies are two SVG shapes animated via CSS transform (translateY)
converging on the barrel.

**REAL NUMBERS:**
- die close time: 220ms travel from open (barrel at full round diameter) to seated
  (barrel flattened to 62% of its original height at the crimp zone) — matches a real
  hand-crimp tool's roughly 150-300ms squeeze.
- barrel deformation is NOT uniform: the crimp-zone path height ease-out-cubics from
  36px to 22px over the 220ms, while a 6px-wide "witness dimple" pair (die tooth marks)
  cuts an additional 4px indent at two fixed x-offsets, appearing only in the final 60ms
  as the dies bottom out.
- strand flare: 3 conductor strand lines per side displace outward 2-5px at the barrel
  mouth over the same 220ms, settling with a slight overshoot-and-settle (120ms spring,
  damping 0.7) rather than stopping dead — a crimped strand has spring-back.
- resting loop cadence: full cycle (dies retract, barrel springs back open, next crimp
  begins) every 4.6s — 220ms close, 1.4s hold-seated, 700ms retract, 2.28s open/idle
  before the next cycle. This is a repeated demonstration cycle, not a single terminal
  action, so it stays "alive at rest" per Filter 2.

**the resting loop:** t0 — dies open, barrel round, conductors loose inside. t2.5s — dies
are seated (crimped shape holding, well within the 1.4s hold window). t5s — barrel has
sprung back open and a fresh cycle's dies are mid-travel again (second cycle starts at
t=4.6s from the loop period above). All three sampled frames are visibly distinct.

**the reduced-motion freeze frame, named explicitly:** `STATIC_PHASE = "seated"` — dies
fully closed, witness dimples visible, strand flare at rest position. This is the frame
that actually explains the mechanic (a bare open barrel or bare dies retracted show
nothing); it is not t0.

**interaction (if any) and what it must NOT do:** hover/focus on the control can pre-stage
the dies to a "gripping" position (barrel slightly ovalized, not yet witness-marked) as a
hover affordance; press/activate triggers one full crimp cycle immediately, independent of
the ambient loop timer, then the ambient loop resumes. It must NOT tint the seated barrel
or witness marks with `--ns-accent` — the crimped-shut state is the climactic moment and
must read in luminance/geometry only, accent stays confined to a surrounding focus ring.

**how it reads in light vs dark theme:** dark — barrel and dies read as `--foreground` at
high opacity against `--background`, witness dimples cut a `--background`-toned notch so
they read as shadow/indent. Light — same relationship, dimples read as a slightly darker
notch rather than a light one (checked directly, not inverted by formula) since an indent
under implied top-lighting is always darker regardless of theme; only the base fill/stroke
values swap per the token read, never the light-direction logic.

**kill criteria:** if the "crimped" end-state looks identical to a plain closed clamp (no
witness dimple, no strand flare) it fails to read as a CRIMP specifically and should be
rejected. If the repeat cycle is too fast to see open/close as distinct states (violates
the ~1s-between-discrete-events legibility rule), reject. If dies ever tint with accent
color on seat, reject per the standing accent-highlight defect.
