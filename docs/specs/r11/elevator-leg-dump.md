# elevator-leg-dump

**tier:** core

**product surface it replaces:** loader — an ambient "system is working"
indicator for a background/batch process, standing in for a generic
spinner or progress bar where no discrete percentage exists.

**the real mechanic, with source:** a bucket elevator ("leg"), the vertical
conveyor used to lift bulk material (grain, and historically bulk mail
sacks in large sorting-facility vertical transfers) — a continuous chain
or belt loop strung between a bottom pulley (the "boot") and a top pulley
(the "head"), carrying evenly spaced buckets. Buckets scoop material at the
boot, ride up the ascending leg, and at the head are flung outward by
centrifugal force as the pulley curves them over, dumping into a chute,
before the empty bucket continues down the descending leg back to the
boot.

**one-sentence mechanic description:** A closed loop of buckets climbs one
side, tips and empties into a chute as it crests the top pulley, then
rides back down empty on the other side to be refilled at the bottom.

**rendering approach:** DOM + CSS custom properties, no canvas needed. A
tall oval/stadium-shaped track (two vertical straights + two semicircular
caps) built from a fixed set of bucket `<div>`s positioned via a single
shared `--t` (0-1 loop phase) driving `offset-path` (CSS motion path) or a
computed `transform: translate` from a parametric stadium function if
`offset-path` support/perf is a concern. Track geometry derives from the
container's smaller dimension (track height = 0.9 * min(w,h), track width
= 0.35 * min(w,h)).

**REAL NUMBERS:**
- Real chain speed: 1.5-2.5 m/s; real bucket spacing: 200-300mm — passes a
  fixed point at roughly 6-10 buckets/second, far above the paint-rate
  floor. DECOUPLED: rendered as 8 buckets total around the loop, one full
  loop revolution takes 8.8s, so a bucket crests the head and dumps roughly
  every 1.1s — the real rate is documented above, not animated 1:1.
- Dump event: 220ms tip-and-empty (bucket rotates -100deg relative to the
  chain as it rounds the head pulley, a small particle/streak sprite marks
  the dump), then rotates back to upright over the following 300ms as it
  starts down the descending leg.
- Fill event at the boot: symmetric to the dump — bucket rotates through
  the boot pulley and a short fill-mark (a rising fill-level rect inside
  the bucket glyph) appears over 200ms as it starts back up.
- Bucket fill level is NOT uniform: buckets fill to a value cycling through
  a fixed period-5 sequence (60%, 85%, 40%, 100%, 70%) so the dumped
  material amount visibly varies dump to dump — this is what proves the
  loop isn't just decorative geometry.

**the resting loop:** t0 — 8 buckets distributed around the track at fixed
1.1s phase offsets, at least one visibly mid-ascent, one mid-descent, all
holding their period-5 fill levels. t2.5s — roughly 2 dump events have
occurred (the head-pulley bucket has changed at least twice), all bucket
positions have advanced ~28% around the loop. t5s — roughly 4-5 dump events
elapsed, a full fill-level cycle is roughly visible if watched continuously.

**reduced-motion freeze frame:** named `HEAD_CREST`, the instant one bucket
is mid-dump at the top pulley (rotated, streak visible) while the adjacent
bucket on the descending side is already upright and empty, and a third
bucket on the ascending side is fully upright and full — one frame shows
fill, transit, and dump simultaneously, the most structured single frame
the loop produces.

**interaction:** none. Ambient loader; no pointer state.

**what it must NOT do:** never tint the dump streak or fill-level rect with
`--ns-accent` — fill level reads via a luminance step against
`--ns-muted`, dump streak is a `--foreground`-derived flash, never colored.
Must not read as a progress bar with a completion state — there is no 0%
or 100%, only continuous circulation; a builder must resist adding a
percentage readout.

**light vs dark:** the track outline is `--border`-derived and must stay
at its correct ~1.1:1 whisper contrast (structure, not the subject) in
both themes; buckets and their fill levels need a real luminance step
against `--background` (closer to `--foreground`) so they don't wash into
the track outline, especially in light theme where the track risks
disappearing entirely if buckets are drawn at the same low contrast.

**kill criteria:** if 8 buckets at 1.1s spacing reads as too sparse (long
dead stretches between visible dumps) or too busy (motion overload) in a
runtime audit, the bucket count is the one number to retune — never drop
below ~1s between dump events, per the round 9 cadence rule.
