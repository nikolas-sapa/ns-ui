# jam-kickout-loop

**tier:** core

**product surface it replaces:** loader — an ambient "background job with
retries" indicator (e.g. a sync/processing status), explicitly not a
button (see kill criteria — `button-retry-backoff` already owns the
per-click retry-with-cooldown territory; this is a system-level, always-on
line, never something the viewer presses).

**the real mechanic, with source:** bulk mail sortation conveyor jam
handling. A photo-eye pair spanning the belt detects a piece that is
mis-timed, overlapping its neighbor, or stalled; a solenoid-driven
diverter arm kicks that single piece off the main line onto a
recirculation loop track before it reaches the sort point, and the loop
re-merges it back onto the main line one belt-cycle later for another
pass, rather than stopping the whole line to clear it by hand.

**one-sentence mechanic description:** Most items ride the main line
straight through, but every so often the line kicks one item onto a
side loop that carries it around and drops it back onto the main line a
beat later for another attempt.

**rendering approach:** DOM + CSS, a horizontal main track plus one lower
side loop (a rounded-rect diversion path) rendered as a simple SVG path;
items are small `<div>` tiles animated with a shared rAF driving each
tile's `transform: translateX`/`translate along path` from its own spawn
time. Geometry derives from the container's smaller dimension (loop
height = 0.3 * min(w,h)); track scales full width.

**REAL NUMBERS:**
- Main line feed: one item spawns every 900ms at the left edge, travels
  the main line at a constant rate such that it reaches the diverter point
  (72% of track width) in 1.6s.
- Jam-kickout ratio: every 6th item (a fixed counter, never
  `Math.random()`) is diverted — real bulk-mail recirculation rates run
  roughly 2-5%; 1-in-6 (~16.7%) is a documented, deliberate amplification
  for legibility over a card-scale viewing window, not a claim about real
  jam frequency.
- Diverter kick: real photo-eye-to-solenoid latency is ~80-120ms
  (near-instant); rendered as a 150ms arm-swing that physically redirects
  the tile's path — the tile visibly leaves the main line, not fades out.
- Loop transit: 1.9s around the side loop, then the tile re-merges onto
  the main line at a fixed re-entry point (18% of track width, i.e. behind
  the diverter) and continues to the right edge like any other item —
  documented as a full second attempt, not a respawn.
- Exit: items reaching the right edge (both first-pass and recirculated)
  fade over 250ms — the "success" moment, visually distinct from a kicked
  item's redirect.

**the resting loop:** t0 — several items mid-transit on the main line at
staggered phases, possibly one mid-loop on the side track. t2.5s — at
least one full kickout-to-remerge cycle has completed and several items
have exited; the population of visible tiles has fully turned over.
t5s — a second kickout has very likely occurred (900ms spawn * 6 = 5.4s
period), so a second full loop transit is underway or complete.

**reduced-motion freeze frame:** named `MID_KICKOUT`, the instant a tile is
mid-diverter-swing, still partially over the main line but already
angled onto the loop path, with one other tile visible further along the
loop and one normal tile mid-main-line — a single frame showing normal
transit, the kickout event, and loop transit together.

**interaction:** none. This is a passive status ambient loop; no click
retries anything (that is explicitly `button-retry-backoff`'s job, a
per-action control, not this component's).

**what it must NOT do:** must not color the diverted tile with
`--ns-accent` to mark it as "different" — the diverted tile's distinction
comes from its path (leaving the main line) and, if any further emphasis
is needed, a luminance step, never hue. Must not let the loop visibly
finish or drain to empty — spawning is continuous and unbounded.

**light vs dark:** the side-loop track itself is `--border`-derived
(structure, whisper contrast); tiles need a clear luminance step against
`--background` in both themes. In light theme, check that the diverted
tile's path is still traceable against the loop track without relying on
the track being visible as a line — the tile's own motion should carry
the read even if the track underneath is nearly invisible per the
`--border` rule.

**kill criteria:** if the 1-in-6 kickout ratio reads as "randomly broken"
rather than "a designed recirculation path" — e.g. reviewers read it as a
bug — the fix is to make the diverter arm's swing more deliberate/visible
(a real mechanical gesture), not to hide or slow the kickout further;
if it still reads as broken after that, this concept dies rather than
disguising a jam as something else.
