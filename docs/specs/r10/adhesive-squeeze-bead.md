# adhesive-squeeze-bead

**tier:** core

**product surface it replaces:** a "merge/combine two items" affordance — merging two
cards, docking a panel onto another, attaching a chip to a row — currently served by a
generic snap-together animation or a plain overlap-and-fade.

**the real mechanic, with its source:** structural adhesive bonding with bond-line
thickness control (aerospace/automotive bonded-joint practice). A bead of adhesive is
applied to one surface; when the mating part is pressed down, the bead spreads and excess
is forced out at the joint edges as visible "squeeze-out" — a fillet-shaped bead along the
perimeter. Glass bead spacers (or a physical stop) fixed in the adhesive layer set a
minimum bond-line thickness so the parts can't be pressed fully together and starve the
joint; a good bond shows continuous, unbroken squeeze-out all the way around the seam, and
a starved/broken squeeze-out line is the defect inspectors look for.

**one-sentence mechanic description:** two panels compress an adhesive layer between them
until it stops at a set thickness, and along their shared edge a continuous bead of excess
adhesive squeezes out and settles into a fillet, uneven at first and evening out as it
finishes.

**rendering approach:** DOM/SVG. Two flat panel `<div>`s approach along the Y axis via CSS
transform; the squeeze-out bead is an SVG `<path>` along the shared edge, its outline points
individually perturbed and animated (not a single stroke-width tween) so the bead visibly
builds unevenly before it settles round.

**REAL NUMBERS:**
- panel approach: 260ms travel from 14px gap to the bond-line stop (fixed 3px gap — the
  spacer thickness), ease-in (accelerating close, matching two rigid panels under applied
  pressure rather than a soft cushion-stop).
- squeeze-out growth: as the gap crosses below 6px (starts partway through the approach,
  not at contact), the bead path's local radius at each of 24 control points along the
  seam grows from 0 to a target 2-5px (individually varied per point, seeded once per
  cycle) over 340ms, producing a visibly lumpy/uneven bead first.
- settle: over the following 700ms the 24 control points ease toward a smoothed average of
  their neighbors (3-point moving average, 2 passes) so the bead visibly relaxes from lumpy
  to a continuous even fillet — this settle-from-uneven-to-smooth motion is the one thing
  to follow.
- hold: 2.1s at the settled, even bead.
- reset: 500ms fade of the bead + panel separation back to the 14px starting gap, then loop.
- full period: 260 + 340 + 700 + 2100 + 500 = 3.9s, continuous.

**the resting loop:** t0 — panels apart (14px gap), no bead. t2.5s — bead is fully settled
and even, mid-hold (approach+growth+settle = 1.3s, so 2.5s is 1.2s into the 2.1s hold —
solidly in the "finished, even fillet" state). t5s — second cycle (5s mod 3.9s = 1.1s in)
is deep in the settle phase, bead visibly less even than the t2.5s frame — distinct state.

**the reduced-motion freeze frame, named explicitly:** `STATIC_PHASE = "settled"` — panels
at bond-line stop, bead fully even and continuous around the visible seam length. This is
the frame that reads as "a good bond" at a glance, which neither the gap-open nor the
mid-lumpy-growth frame communicates on its own.

**interaction (if any) and what it must NOT do:** drag-to-attach (dragging one panel toward
the other) can drive the approach distance directly off drag position instead of the
ambient clock; releasing past the squeeze-out threshold commits to the full growth+settle
sequence, releasing before it springs the panel back to the 14px start. The squeeze-out
bead must never render as an accent-colored highlight — it's `--foreground` value only,
uneven-to-smooth luminance is not a substitute for hue and must not be dressed up as one.

**how it reads in light vs dark theme:** dark — bead is a `--foreground`-toned raised
fillet against the dark panel edges, its unevenness readable as small luminance bumps along
the path. Light — same path geometry, bead stays `--foreground` (dark line on light panels)
since a fillet reads as a physical ridge regardless of theme direction; check specifically
that the 24-point jitter amplitude is still visible in light theme at card scale (a value-
only bump can wash out faster on light backgrounds than dark ones — verify, don't assume
parity).

**kill criteria:** if the settle motion (uneven → smooth) is imperceptible at card scale —
the ONE thing this component asks a viewer to follow — reject. If squeeze-out reads as a
generic border-radius pulse rather than a bead building along a seam with individually
varying growth points, reject; the whole point is visible unevenness resolving to evenness,
not a uniform stroke fade-in.
