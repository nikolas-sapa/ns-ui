# carbon-ply-fade

**tier:** core

**product surface it replaces:** activity feed / notification fanout (e.g. "this
event was also copied to N recipients") — an alternative to a stacked toast or
a plain list.

**the real mechanic, with source:** carbon-paper pressure copying (typewriter
or ballpoint form sets, in wide office use through the 1980s, still used in
multi-part invoice/receipt books today): a stylus or typewriter key strikes
the top sheet, transferring wax-pigment from a carbon sheet onto the paper
beneath it through mechanical pressure alone (no chemistry). In a stacked
multi-ply form, that same strike has to propagate its force down through every
layer, and each layer absorbs and disperses some of it — the first copy
receives close to full transferred density, and each subsequent ply comes out
measurably fainter than the one above it, a real geometric-ish falloff from
force dissipation through the stack (commonly usable to 3-5 plies before a
copy is illegible). This is a physical, force-based attenuation, not a
chemical or optical process. Source: standard multi-part carbonless/carbon
form construction, documented pressure-copy attenuation through a stack.

**one-sentence mechanic description:** a single event strikes the top of a
stack of ply-cards and echoes downward through the stack, each copy arriving
fainter than the one above it, in the same instant the strike lands.

**rendering approach:** DOM, no canvas. A vertically or diagonally offset
stack of 4-5 flat card layers (each a full-width panel, offset ~6px down and
2px right per ply behind it, `--border` edges, matching the "stacked
receipt/form" reading). Layer count derives from available height ÷ minimum
readable ply height; on a card-scale container this is fixed at 4 plies.

**REAL NUMBERS:**
- strike cadence: one strike event every 1.1s (an event arrives at the top
  ply and echoes down)
- density falloff per ply: ply N's peak density = ply(N-1)'s peak density ×
  0.68, starting from ply 1 (top) at 100% (--foreground) opacity — by ply 4
  this is ~31%, by ply 5 (if present) ~21%, matching the real "illegible past
  4-5 plies" threshold
- propagation delay: each ply's strike registers 90ms after the ply above it
  (the mechanical force takes a beat to travel down the stack — this is the
  followable part, see legibility)
- strike decay: each ply's content flashes to its peak density instantly on
  arrival then holds at that density (a strike does not fade — carbon
  transfer is permanent per pull, unlike a toast that fades away); the PLY
  ITSELF (its whole card) very slightly compresses (scaleY 0.985, 60ms, spring
  back over 140ms) on impact, giving the strike physical weight
- between strikes: content on all plies stays static for the remaining
  ~700ms of the 1.1s cadence before the next strike begins

**the resting loop:** t0 = mid-strike, plies 1-2 have registered their
content, plies 3-4 still show the prior event's content or blank if this is
the first strike. t=2.5s = several strikes deep into a rolling window (older
top-ply content has been overwritten by newer strikes, the stack always shows
the MOST RECENT event's density-falloff even though the underlying "event"
changes every 1.1s). t=5s = different event content on the top ply than at
2.5s, same falloff pattern — visibly different because the displayed event
label/content rotates through a small caller-supplied or built-in list.

**reduced-motion freeze frame:** hold on a fully-propagated strike (all plies
showing their falloff, no plies mid-transit) — the moment 90ms×3 after a
strike lands, all four plies settled.

**legibility:** the ONE thing to follow is the propagation itself — content
appearing on ply 1, then ply 2, then ply 3, then ply 4, each ~90ms after the
one above, so the eye can trace the strike traveling down the stack in a
single glance before the whole stack goes static again. This satisfies the
round-9 "cadence a viewer can follow" rule directly: the strike-to-strike
cadence (1.1s) is close to the ~1s guidance, and each individual ply-to-ply
delay (90ms) reads as staggered continuation of ONE event, not four separate
blinking events.

**interaction:** none required; if wrapped around a real notification list,
hovering the top ply may pause the strike cadence (does not reverse or hide
plies) so a viewer can read a specific event without the stack overwriting it
mid-look. Must NOT use `--ns-accent` for the strike flash — density is
luminance-only.

**light vs dark theme:** top-ply peak density is `--foreground` at full
opacity in both themes; the falloff ratio (×0.68 per ply) is the same
multiplier in both themes, but light theme's plies below #3 risk falling
under the visible-contrast floor against `--background` — check whether ply 4
needs a floor (e.g. never below 12% opacity) to stay legibly present rather
than vanishing, which would misrepresent "faint" as "absent."

**kill criteria:** if the stack reads as a generic drop-shadowed card pile
with no visible falloff difference between plies, the mechanic has been lost
and this is a reject. If the strike cadence needs to exceed ~1 per second to
feel "alive," that breaks the round-9 legibility rule and the concept should
be killed rather than sped up.
