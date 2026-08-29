# kymograph-smoke-trace

- **slug:** kymograph-smoke-trace
- **tier:** loud (full-bleed showpiece)

## Product surface it replaces
Hero — a full-bleed page hero for anything that wants a "something is being
recorded live, permanently, right now" mood (lab notebooks, physiology/health
products, precision-instrument brand pages).

## The real mechanic
The kymograph (Carl Ludwig, 1847): a rotating drum wrapped in soot-blackened
("smoked") paper. A stylus, driven by a lever linked to whatever is being
measured (muscle twitch, pulse, respiration), rides against the drum and
scratches a continuous groove through the soot as the drum turns at constant
speed, exposing the pale paper beneath. The trace is permanent the instant
it's scratched — nothing about it is redrawn or smoothed after the fact.
Between uses the drum was re-coated with soot over a flame; this component
uses that resmoking step as its infinite-loop seam.

## One-sentence mechanic description
A soot-blackened drum turns steadily while a stylus scratches a bright,
permanent trace through the black coating, and a trailing brush re-smokes
the drum dark again just before each pass returns to that spot.

## Rendering approach
2D canvas, full-bleed, `w-full h-full` with JS-set backing-store size (DPR
capped at 1.5). The drum surface is rendered as a horizontally-scrolling
raster band (an "unrolled" view of the cylinder, same convention as other
loud showpieces that show a moving strip rather than literal 3D geometry).
Two layers on one canvas:
1. **Soot layer** — a dark, faintly noise-textured fill (`--foreground` at
   low alpha over `--background`, no literal colors) covering the band.
2. **Scratch layer** — wherever the stylus has passed, pixels are drawn at
   full `--background` luminance (i.e. "erased" back to paper white/paper
   dark depending on theme), 2px wide, antialiased.
A resmoking brush (a soft vertical gradient wipe, ~40px wide) trails 1 full
drum revolution behind the stylus and repaints the soot layer back to full
density, so the loop never has to reset or fade.

## Real numbers
- Drum surface speed: real kymographs ran 25mm/s (fast recording) to
  0.5mm/s (slow); this build uses a mid setting, mapped to **40px/s**
  leftward scroll of the soot band.
- One full drum revolution (the loop period) = **14s** at that speed over a
  1200px-equivalent circumference (scaled to container width).
- Stylus trace: driven by a periodic burst generator — baseline near-flat
  jitter (±1.5px) punctuated by a "twitch" event every **3.2s** (a fast
  rise over ~120ms, decaying ring-down over ~600ms, amplitude 18-30px) —
  modeled on a muscle-twitch/pulse trace, not literal biodata.
- Resmoking brush trails the stylus by exactly one revolution (14s), width
  40px, full opacity restore in one pass.

## The resting loop
- **t0:** soot band fully dark, no scratch visible yet, stylus at the left
  edge about to start.
- **t=2.5s:** roughly 100px of bright scratch trace visible, including one
  completed twitch spike, soot ahead untouched.
- **t=5s:** ~200px of trace visible spanning at least one full twitch
  cycle plus baseline; resmoking brush not yet caught up (it's 14s behind).
  All three frames are visibly different in trace length and shape.

## The reduced-motion freeze frame
Frozen mid-revolution: soot dark on both sides, a bright scratch trace
occupying the left ~55% of the visible band including two twitch spikes at
different phases (one mid-rise, one settled), and the resmoking brush
frozen mid-stroke at the far right edge repainting the oldest soot. Named:
`STATIC_PHASE` at t=9.8s of the 14s cycle.

## Interaction
None. This is a hero — it must not require a pointer to be alive. If a
pointer is present, it may nudge the twitch-generator's phase (not
amplitude, not color) so hovering doesn't feel inert, but must NOT drive
the trace directly (that would blur the "permanent, unedited scratch"
identity) and must NOT use `--ns-accent` anywhere.

## Light theme vs dark
The soot/paper relationship inverts value, not hue, between themes exactly
like `dye-whorl`'s ink/water pattern: soot layer reads as darker-than-page
in light theme (`--foreground` at high alpha over `--background`) and as
a slightly-lighter-than-page smoked layer in dark theme if the physical
metaphor is kept literal — but the brief's rule is legibility over realism,
so the scratch trace must always be the higher-contrast element against its
local soot in BOTH themes (soot layer luminance biased toward the page
background, scratch always at the far end of the ramp from it). Verify by
sampling scratch-vs-soot luminance delta in both themes; if it drops below
a clearly-readable threshold, bias the soot layer further, not the scratch.

## Kill criteria
- If the scratch/soot subtractive-reveal reads at a glance as just another
  animated ink line (indistinguishable from `dye-whorl` or
  `streaming-ink-dry`), the soot-vs-paper subtractive identity has failed
  and this is a reject.
- If the resmoking brush is not visible/legible as a distinct pass (i.e. it
  just looks like a fade), the infinite-loop mechanism reads as a bug, not
  a feature — reject or redesign the brush as a harder-edged wipe.
- If DPR-capped canvas or the noise texture makes the soot read as a flat
  color card at rest (fails Filter 2's "alive at rest" bar), reject.

## Legibility
The one thing to follow: **the bright scratch trace lengthening at the
stylus tip, one twitch spike every 3.2s.** That cadence is well under the
paint rate and slow enough to watch a single twitch rise and ring down
without losing track of where the stylus currently is.
