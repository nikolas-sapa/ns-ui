# overflow-chip-mux

**tier:** core

**product surface it replaces (Filter 1):** the list/tag overflow
indicator — the common "+N more" pattern used by tag lists, attendee
avatar stacks, and filter-chip rows when there are more items than fit in
one row.

## The real mechanic

The NES PPU (Picture Processing Unit) can only evaluate 8 hardware sprites
per scanline. A 9th object sharing that scanline in a given frame is
silently dropped from the frame's render entirely — real hardware limit,
not a software choice. Game developers on 8-bit consoles worked around this
with **sprite multiplexing**: rather than let overflow objects vanish for
good, they round-robin which subset of contending objects gets the 8
available slots each frame, cycling the assignment on a fixed schedule so
every object gets its turn some fraction of the time. This produces the
well-documented visible "flicker" of NES games with many on-screen objects
(dense enemy waves, particle-heavy effects) — a real, recognisable artifact
of the hardware limit, not a bug, and deliberately throttled by developers
(commonly every few frames, not every single frame) to keep it legible
rather than a strobe.

## One-sentence mechanic description

A chip row with more items than its rendered slot budget simulates the
real NES 8-sprites-per-scanline hardware limit — instead of collapsing
overflow into a static "+N" pill, it round-robins which subset of items
occupies the visible slots on a fixed cadence, exactly the way 8-bit
console flicker actually worked.

## Rendering approach

DOM + CSS, no canvas. A flex row of chip elements. `SLOT_BUDGET = 8` visible
slots (the real PPU per-scanline limit). Items beyond the budget are held
in a JS array and cycled into the visible slots on an interval, not
rendered-and-hidden (so no layout thrash, no accessibility tree churn per
swap — swap the underlying item reference each interval, chip DOM node
identity can stay stable).

## Real numbers

- `SLOT_BUDGET = 8` (NES PPU sprites-per-scanline hardware limit).
- `SWAP_INTERVAL_MS = 130` (~7.7Hz) — a decimated round-robin cadence, not
  raw 60Hz alternation. Real multiplexing code commonly cycled the
  assignment every few frames rather than every frame specifically to keep
  the artifact legible instead of an unreadable strobe; 130ms sits in that
  range (roughly every 8 frames at 60fps).
- Each swap advances the round-robin index by exactly one item, so a full
  cycle through N overflow items takes `ceil(N / 1) * SWAP_INTERVAL_MS` —
  i.e. one contending item rotates in/out per tick, not the whole overflow
  set reshuffling at once (matches how real multiplexing rotated a fixed
  number of contenders through the remaining slots, not the whole cast).
- Demo/default seed must supply **more than 8 items** — below the budget,
  no multiplexing engages at all (correctly matching the real hardware,
  which only drops sprites once the 9th arrives on a scanline), so a
  reviewer testing with a short default list would see nothing alive.

## The resting loop — t0 / 2.5s / 5s

With >8 items seeded: t0 shows one subset of 8 chips occupying the row;
2.5s shows a visibly different subset (the round-robin has advanced
several ticks); 5s shows a third distinct subset — proving genuine
continuous rotation, not a single reshuffle-and-stop.

## Reduced-motion freeze frame

Freeze on the **first budget-full pass, round-robin index 0** — all 8
slots filled with the first 8 items in source order, no swap in progress.
A persistent, non-flickering plain-text overflow count (see Accessibility)
stays visible in this frame exactly as it does at rest, so the total item
count is never lost even when motion is frozen.

## Interaction

Hovering or focusing a currently-visible chip pins it (removes it from the
round-robin, keeps it in a slot) until unhovered/blurred. The pin
affordance may use `--ns-accent` for its focus ring only — the swap/flicker
mechanism itself must never use accent, luminance only.

## Accessibility (required, not optional)

Because only a subset of items is visually present at any moment, an
`sr-only` `<ul>` listing every item (not just the visible 8) must exist in
the DOM at all times, plus a visible, always-present plain-text total (e.g.
"8 of 14 shown, 14 total") so sighted and non-sighted users both have the
true count without depending on the flicker.

## Light vs dark theme

Chip fill/border from `--foreground`/`--ns-muted`/`--border` tokens only.
No hue anywhere. Light theme: confirm the pinned-state focus ring (the only
accent usage) stays legible without becoming the visually dominant element
in the row — it's interaction chrome, not the mechanism's climactic
moment.

## Kill criteria

- If `SWAP_INTERVAL_MS` reads as jank/a bug rather than a deliberate retro
  artifact in an unprimed viewing (no tooltip/label explaining it), reject
  or slow the cadence further.
- If the sr-only full list is missing or the visible total count is
  absent, reject — this is an accessibility regression versus the "+N
  more" pattern it replaces, which is always fully enumerable.
