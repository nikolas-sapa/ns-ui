# sleeper-renewal-relay

**tier:** core

**product surface it replaces:** a live "processing/refreshing" ambient row
indicator in a table or list (feedback moment) — the row-level equivalent
of a generic sync spinner.

**the real mechanic, with source:** a mechanised sleeper-renewal train
crawls continuously along the track: a crane/claw lifts one old sleeper
clear of the formation, kicks it out to a side wagon, swings a new sleeper
into the gap, and clips the rail back down — all while the machine advances
to repeat on the next sleeper, never stopping the line for more than the
single swap. Source: railway maintenance-of-way engineering, mechanised
sleeper/tie exchange trains used on mainline renewal work.

**one-sentence mechanic description:** A crawling renewal gang lifts one
old sleeper clear, swings a new one into the gap, and clips the rail down
before advancing to the next, never stopping the line.

**rendering approach:** DOM/SVG list. Each sleeper is a fixed-height row;
sleeper width derives from the container's smaller dimension divided by the
visible row count (6–9 rows at card scale). No canvas.

**REAL NUMBERS:**
- Real sleeper spacing: ~650mm centre-to-centre (~1,540 sleepers/km).
- Real renewal-train throughput: roughly 500–1,000 sleepers per shift —
  on the order of tens of seconds per sleeper, too slow for a legible UI
  loop, so the rendered rate is compressed and documented as compression,
  not literal.
- Rendered cadence: one full lift → swap → drop → clip cycle every 1.3s per
  sleeper; the lift-and-swap arc takes ~450ms (visible departure), the
  drop-and-settle takes ~350ms (visible arrival), leaving a ~500ms settled
  dwell before the next row engages.
- The crane advances through a full 8-row visible stack in ~10.4s, then
  wraps to the top and continues — unbounded, never finishes.

**the resting loop:** t0 shows the crane mid-lift on one row with its
already-renewed neighbor visibly fresher; at 2.5s two further rows have
been swapped and the crane has advanced two positions; at 5s the crane has
wrapped past the visible window's midpoint, so the set of fresh-vs-old rows
differs from both prior frames.

**the reduced-motion freeze frame:** freezes with the crane arm mid-arc,
holding a lifted sleeper directly above the gap, not yet dropped — the
single frame showing old-out / new-in / clip-pending simultaneously.

**interaction (if any) and what it must NOT do:** none required (ambient
loader). If bound to a real "refreshing" state, an optional prop may pause
the loop at the current row once data is current — pausing must only land
on a settled dwell point, never mid-arc, so it never looks broken.

**light theme vs dark:** old sleeper = `--ns-muted` fill (worn), new
sleeper = `--foreground` fill (crisp) — the contrast between the two IS the
renewal signal. In light theme where `--ns-muted` sits close to
`--background`, confirm the delta still holds above ~1.4:1 at card scale.
Crane arm and clip marks are `--foreground` strokes only, never
`--ns-accent`.

**kill criteria:** if the old/new fill contrast collapses in light theme,
or the cadence reads as a blink instead of a lift-drop-settle sequence,
kill it.

**legibility line:** the ONE followable thing is a single sleeper's
lift-out → swap → drop-in cycle at the crane's current row; cadence is
1.3s per sleeper with a visible ~450ms departure and ~350ms arrival, inside
the round-9 "roughly a second, with departure and arrival" rule.
