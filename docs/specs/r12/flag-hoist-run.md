# flag-hoist-run

**tier:** core

**product surface it replaces:** ambient loader / in-flight queue-depth indicator —
a background status card showing that items are continuously entering, being
"delivered," and clearing, distinct from a notification/toast delivery stack
(`toast-gravity-stack`, `toast-newton-cradle`) which is about a single item's arrival
and dismissal, not a continuous mechanical queue.

**the real mechanic:** the mechanical flag hoist / signal halyard used for fleet and
shore signalling under sail (e.g. the Popham flag code, 1803, and the same rig still
used decoratively for dressing ship) — flags are bent onto a halyard, run up the mast
to the yard, break out (unfurl) once at the top so they can be read, then are struck
(hauled down fast) to clear the line for the next hoist.

**one-sentence mechanic description:** small flags continuously climb a halyard,
break out into a flying position at the top, then are struck down to clear the line
for the next one.

**rendering approach:** DOM/SVG at card scale, a single vertical halyard line, flag
"chips" as small rectangles that translate along it. Geometry (mast height, chip size)
derived from the container's smaller dimension. Colours via `getComputedStyle` +
`MutationObserver`.

**REAL NUMBERS:**
- Climb: from y = 92% of card height to y = 8% (the yard), constant velocity, over
  **2.4s**.
- Break-out: folded (0° / narrow silhouette) to flying (90° / full flag shape)
  rotation, **300ms**.
- Fly (held at the yard, fully unfurled): **1.1s**.
- Strike (drop out of view): **400ms** — deliberately faster than the 2.4s climb,
  reading as a mechanically distinct action (striking is quick; hoisting is steady
  work).
- New-chip stagger: a new flag begins climbing from the bottom every **1.3s**, so
  1-2 chips are climbing at once while at most one flies at the yard — queue depth
  is visually legible as "how many chips are on the line right now."
- Full individual cycle: 2.4s + 300ms + 1.1s + 400ms = **~4.2s**.

**the resting loop:**
- t0: one chip mid-climb at some height, yard empty or occupied.
- t2.5s: with a new chip starting every 1.3s, at least one additional chip has begun
  climbing and existing chips have moved — visibly different from t0 regardless of
  cycle phase.
- t5s: at least one full 4.2s cycle has completed since t0 — a different chip is
  flying at the yard, prior chip struck and gone.

**the reduced-motion freeze frame:** a frame with one chip mid-climb (~50% up the
mast) AND one chip flying at the yard simultaneously — both states visible at once is
the most structured single frame available in the cycle, versus e.g. an all-empty
mast moment which shows nothing.

**interaction:** none — ambient only.

**light vs dark theme:** flags = solid `--foreground` fill shapes. Halyard line =
`--foreground` at ~30% opacity (not `--border` — needs to stay visibly a taut line,
not fall to the ~1.1:1 separator contrast in light theme). Both themes read on fill
contrast alone, no re-hueing needed.

**kill criteria:** if the break-out rotation isn't visually distinct from the climb
(i.e. it reads as one continuous slide with no "arrival" moment), the mechanic
collapses into a generic progress-bar-with-icons and should be killed. If it reads at
a glance as functionally identical to `toast-gravity-stack`'s queue-and-clear pattern
rather than a hoist, kill.

**legibility:** the one thing to follow is a single flag chip's climb → break-out →
fly → strike cycle; cadence is a new flag starting to climb every 1.3s, one full
individual cycle taking ~4.2s, with the 300ms break-out rotation making the "arrival
at the yard" moment clearly distinct from the climb that preceded it.
