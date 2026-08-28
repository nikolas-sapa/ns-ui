# semaphore-arm-cast

**tier:** core

**product surface it replaces:** ambient loader / multi-stage status indicator (same
bucket as `status-glyph-cadence` — this spec's `useWhen` must point there and name
the difference explicitly).

**the real mechanic:** the Chappe optical telegraph, France, 1794 — a mast carrying a
horizontal regulator bar with a pivoting indicator arm at each end. Each arm swings to
one of 8 positions (45° increments), and the two-arm combination selected a symbol
from a 92-entry codebook, relayed tower to tower across the network.

**one-sentence mechanic description:** two mechanical arms swing to a new angled
position every couple of seconds, each held position reading as a distinct symbol.

**rendering approach:** SVG at card scale. Mast height = `min(width,height) * 0.8`,
arm length = `min(width,height) * 0.28`, both derived from the container's smaller
dimension on mount and `ResizeObserver`. Two arms, each an independently-rotated
`<line>`/`<g>` around its own pivot on the regulator bar. Stroke only, from
`--foreground`, read via `getComputedStyle` + `MutationObserver`.

**REAL NUMBERS:**
- Each arm's swing transition: **550ms**, cubic-bezier ease (mechanical relay speed,
  not instant).
- Symbol dwell after both arms settle: **1.6s**.
- Stagger between arm 1 and arm 2 starting their swing: **150ms** (arms don't move in
  perfect lockstep — a real two-man relay wouldn't either).
- Full beat per symbol: ~550ms + 150ms + 1.6s = **~2.15s**.
- Sequence: unbounded 9-symbol loop, ~19.4s full cycle, repeats.
- Arm positions: 8 discrete angles per arm, 0°/45°/90°/135°/180°/225°/270°/315°.

**the resting loop:**
- t0: both arms held at some symbol's angle pair.
- t2.5s: at least one full symbol change (~2.15s beat) has occurred — different angle
  pair, clearly distinguishable silhouette.
- t5s: two symbol changes visible since t0 — a third distinct angle pair.

**the reduced-motion freeze frame:** pinned to symbol index 3, fully settled (not
mid-swing): arm 1 at 135°, arm 2 at 270° — a wide, asymmetric spread chosen because
it's visually the most structured pose in the 9-symbol set (several other symbols in
the sequence place both arms close to vertical, which reads as "off"/at-rest rather
than as an active signal).

**interaction:** none — ambient status only.

**light vs dark theme:** mast and regulator bar drawn in `--foreground` stroke at
full opacity; both arms also `--foreground`, distinguished from the mast only by
being the moving elements — no separate fill/stroke logic needed between themes since
everything is a stroke against the card's own background. Check at the smallest card
size early: two arms at low stroke width can visually merge into the mast in light
theme if stroke width isn't bumped relative to dark theme's typically higher default
contrast.

**kill criteria:** if the two-arm swing is indistinguishable at a glance from a
generic pair of clock hands (no distinct "held discrete symbol" read, i.e. it looks
like it's just always sweeping rather than snapping to positions and holding), kill —
that would make it a restyle of an analog-clock pattern rather than a telegraph. If
two arms collapse into an unreadable blob below ~120px card height, kill.

**legibility:** the one thing to follow is the two arms swinging together to a new
held angle pair; cadence is a new symbol roughly every 2.15s, the swing itself taking
550ms with a clear departure from the old angle and arrival at the new one (never an
instant snap).
