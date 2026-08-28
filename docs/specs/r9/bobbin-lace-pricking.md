# bobbin-lace-pricking

- **slug:** bobbin-lace-pricking
- **tier:** core (card-scale canvas, decorative/ambient)

## Product surface it replaces
A decorative divider / empty-state ornament — an alternative to `divider-mosaic-split` or
`empty-state-braille-orbit` for a quiet, structured ambient motif rather than a functional control.

## The real mechanic
Bobbin lace is made by twisting and crossing pairs of thread wound on bobbins around pins stuck
into a pricked pattern on a pillow. Each pin marks a fixed point where two thread pairs cross and
lock; the lacemaker works a narrow band of pins at a time, following the pricked pattern down the
pillow, and pins BEHIND the working band are pulled out once the lace there is secure enough to
hold its own structure — the pin is a temporary fixture, present only while its crossing is still
being formed. Source: bobbin lace (pillow/pricking) construction (textile/lacemaking).

**Differentiation from shipped siblings:** no other lattice/mesh component in the registry
(`mesh-lash`, `seep-lattice`, `pin-register`) has a temporary fixture that is placed, used, and then
physically removed as work progresses — that removal-behind-the-band is the load-bearing, uncontested
part of this mechanic and must stay central to the spec.

## One-sentence mechanic description
A narrow band of pins works its way down a pricked grid, twisting a pair of threads into a locked
cross at each active pin, while older pins behind the band are pulled free once their crossing has
set into the growing lace ground.

## Rendering approach
2D canvas, `w-full h-full`. Pin grid derived from the container's smaller dimension: pin pitch
~16px, grid rows/cols fit to container. Working band: 3 rows tall, always positioned partway down
the field, moving downward over time; rows above the band are solid finished lace ground
(rendered once, static), rows at/below the band are pins in progress or not-yet-reached.

## Real numbers
- Per-pin cross-and-lock: 850ms — two short thread-pair strokes visibly rotate around the pin
  (180deg twist, eased) and settle into a locked X.
- Working band advances one full row (all pins in that row cross) every ~2.6s (3 pins/row roughly
  staggered 700ms apart within the row, so pins don't all resolve simultaneously).
- Pin removal: a pin two rows behind the current working row is pulled (a quick 180ms upward
  slide-out + fade of the pin glyph only — the thread crossing it secured stays put) roughly every
  2.6s, one pin at a time, trailing the band.
- Finished ground (rows above the band, pins already removed) is static — no re-animation once
  set, consistent with the real material staying put once its knot has taken.

## The resting loop
- t0: working band roughly a third of the way down the field, some pins mid-cross, a trail of
  finished lace ground above.
- t=2.5s: band has advanced roughly one row, different pins now active, more pins pulled from
  behind.
- t=5s: band has advanced further still; the field either continues downward (new pricking rows
  keep entering from the bottom, same unbounded scrolling-field approach used elsewhere in this
  set) or, on reaching the bottom, the whole field slow-fades and a fresh pricking pattern begins
  from the top — pick whichever reads more like continuous work at build time, but it must never
  simply stop.

## Reduced-motion freeze frame
**PIN_SET** — freeze mid-cross on a pin with its thread pair visibly locked in an X, band
positioned roughly a third down the field (structured mix of finished ground above, active band,
untouched pricking below).

## Legibility
The ONE thing to follow: the working band itself — its position, and the pull of an old pin just
behind it. Both the cross-and-lock (850ms) and the pin pull (once every ~2.6s) sit comfortably
above the "roughly a second between events" floor, and the pull is a distinct, visible motion (a
sharp upward slide), not a blink.

## Interaction
None. Ambient/autoplay only.

## Light vs dark theme
Finished lace ground: `--foreground` at low-moderate opacity, fine strokes (it should read as
delicate, not bold). Active pins: `--foreground` full-strength dot + thread strokes. Untouched
pricking (pin holes not yet reached): `--border`-token dots only (correctly used as the faint
separator/placeholder mark it is, never a stroke on the lace itself). No `--ns-accent`.

## Kill criteria
- If the twist-and-lock motion is too fine-grained to read at card scale (pin pitch would need to
  drop below ~10px on a small card), kill it or restrict to larger card sizes only.
- If it reads as a generic abstract "connecting dots" network rather than legibly lace-like
  (recognizable crossing pairs, a visible working band), kill it.
