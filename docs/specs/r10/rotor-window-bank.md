# rotor-window-bank

**tier:** loud

**product surface it replaces:** full-bleed hero / decorative background band — an ambient
letter-wheel backdrop for a page header, in the same family as `hero-ascii-*` and
`background-ascii-*`.

**the real mechanic, with source:** the rotor stepping mechanism of an electromechanical
rotor cipher machine (Enigma-family). Each rotor is a wheel with a visible letter window;
a pawl advances the rightmost rotor one position per tick. When a rotor's own notch aligns
with its pawl, it kicks the rotor to its left forward too. The middle rotor carries the
"double-step" anomaly: if the middle rotor is *itself* sitting on its own notch when the
tick lands, it both kicks the left rotor **and** advances a second position on that same
tick — the mechanical quirk that made Enigma's period 26x25x26 instead of a clean 26^3.
Sourced from the physical stepping mechanism, not the electrical scrambling it feeds.

**one-sentence mechanic description:** a row of three letter-wheels turns like an odometer,
mostly one wheel at a time, until a rare tick where the middle wheel unexpectedly steps
twice and drags the wheel beside it along with it.

**rendering approach:** DOM. Three fixed-width wheel windows (a `<div>` each, `font-variant-numeric`
tabular / monospace glyph column), each window a `overflow:hidden` frame over a vertical
glyph strip translated by `transform: translateY()`; stepping is a CSS transition per wheel,
no canvas needed. Geometry derives from the container's smaller dimension: window height
= min(containerW, containerH) / 5, three windows laid out with a gap = window height / 4.

**REAL NUMBERS:**
- ring size (rendered): **9 positions per wheel**, cycling a fixed glyph set
  (documented note in the component comment: the real Enigma ring is 26 positions; 9 is
  chosen so the anomaly the component exists to show is followable at card scale — see
  rate-decoupling below).
- right-wheel tick rate: **1 tick / 1.4s** (advances one position every tick).
- notch position: right wheel kicks middle wheel every **9th tick** (once per full
  right-wheel revolution, i.e. every 12.6s).
- double-step event: with a 9-position ring and the notch at a fixed offset, the middle
  wheel's own notch recurs every 9 middle-wheel steps — at this rate the double-step lands
  roughly every **~55-65s** (not a fixed integer multiple since two coprime-ish periods
  interact; component logs the real tick count so behavior stays deterministic per session).
- step transition: **220ms ease-out**, wheel travels exactly one glyph row; double-step
  plays as two back-to-back 220ms steps with a 90ms hold between them, never a single
  blurred jump, so the eye can count "one, pause, two."
- left-wheel kicks: only occur on a middle-wheel double-step, same 220ms transition, fires
  in the second half of the pair (visibly *after* the middle wheel's second step lands).

**the resting loop — t0 / 2.5s / 5s:** t0: three wheels each showing a static glyph, right
wheel mid-way through a step transition (never caught fully idle by a fresh mount, offset
by a random phase on init). t=2.5s: right wheel has advanced roughly one further position
from t0. t=5s: right wheel has advanced ~3 positions total from t0, cycling visibly; middle
and left wheels unchanged unless a rare notch/double-step fell in that window, which is
fine and expected — the loop must never be "waiting" for it.

**reduced-motion freeze frame:** freezes at the moment right after a double-step resolves
(`STATIC_PHASE`: right wheel at position 4, middle wheel one tick past its notch, left
wheel one position advanced) — the one frame that shows all three wheels having just moved
in relation to each other, not the default idle single-wheel state.

**interaction:** none. Pure ambient background; no pointer/press affordance. Must NOT
gain a click-to-scramble or hover-to-speed-up interaction — that would turn it into a
toy/gadget rather than a backdrop.

**light vs dark theme:** wheel window background reads from `--background`, glyph ink from
`--foreground` at 90% opacity for the centered/active glyph and 35% for the glyphs
partially visible above/below the window (the "next glyph creeping into frame" cue that
sells continuous rotation). Window separators between the three wheels use `--border` as a
1px rule, never a fill. No accent anywhere — this is not an interactive element.

**legibility line:** the ONE followable thing is the middle wheel visibly stepping twice
in the same beat that the left wheel moves — cadence: each of the two steps in a
double-step is a full 220ms transition with a 90ms hold between them (~530ms total for the
pair), slow enough to count "step, pause, step" by eye, and rare enough (~once a minute)
that seeing it land reads as an event, not noise.

**kill criteria:** if a compressed ring makes the double-step read as gimmicky/arbitrary
rather than an emergent property of two wheels turning at different rates, or if three
static-looking odometer wheels read as a plain digit counter with no cipher-machine
identity, kill it — this component lives or dies entirely on the double-step being visibly
different from a normal single-wheel carry.
