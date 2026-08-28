# range-light-transit

**tier:** core

**product surface it replaces:** ambient feedback moment / connection-sync status —
an indicator that two independent, slowly-varying states are converging and briefly
agreeing, distinct from a determinate progress bar or a binary connected/disconnected
dot.

**the real mechanic:** maritime range lights (leading lights) — a pair of navigation
lights at different distances and heights that a pilot keeps vertically stacked
("in transit") to hold a safe channel course. When the vessel drifts off the line the
lights visibly separate; back on the line, they read as one aligned pair. Source:
standard leading-line navigation marks (e.g. USCG range light pairs, UK Trinity House
leading lights).

**one-sentence mechanic description:** two lights drift independently and repeatedly
slide in and out of vertical alignment, briefly brightening together each time they
line up.

**rendering approach:** SVG/DOM at card scale. Two small discs on independent
vertical guides: front light lower in the card, rear light higher, each offset
horizontally by its own sine function of time. A thin vertical guideline element
connects them, opacity driven by how close they are to aligned. All colour via
`getComputedStyle` + `MutationObserver`.

**REAL NUMBERS:**
- Front light: horizontal drift amplitude = 18% of card width, period **6.2s** (sine).
- Rear light: horizontal drift amplitude = 14% of card width, period **9.7s** (sine).
- Periods are incommensurate (no small common multiple), so alignment moments recur
  aperiodically, roughly every **14-18s**, not on a fixed beat — this is deliberate,
  matching how a real transit line is crossed irregularly rather than metronomically.
- Alignment trigger: horizontal offset between the two discs < 3% of card width.
- Guideline: brightens from 0 to full opacity over the **250ms** the discs stay within
  the alignment threshold.
- Arrival cue: at peak alignment (offset ≈ 0) both discs increase luminance +20% for
  **300ms**, then fade back to baseline over **600ms** as they drift apart — a
  quarter-second-plus envelope, never a single-frame flash.

**the resting loop:**
- t0: discs at some non-zero offset, guideline dim or absent.
- t2.5s: offset has changed substantially (front light alone moves through ~40% of
  its 6.2s period in 2.5s) — visibly different disc positions from t0.
- t5s: different offset again, possibly mid-approach to or departure from an
  alignment event.

**the reduced-motion freeze frame:** a partial-offset frame with the guideline at
~40% brightness (mid-approach) — both discs visible, the vertical reference line
partially present, and a clearly non-zero offset. Not the full-alignment frame (the
+20% luminance spike reads as blown-out/flat) and not a maximum-offset frame (the
guideline is fully absent there, the least-structured option).

**interaction:** none — ambient only.

**light vs dark theme:** dark theme: discs and guideline carried by luminance,
brightening = literal brightening against the dark card. Light theme inverts the cue
rather than re-hueing: discs render as filled dark shapes on the light background, and
the "alignment" moment deepens contrast/shadow briefly instead of adding lightness
(a +20% lightness spike would simply clip to white and vanish against an
already-light background) — check this explicitly, it's the one place this spec's
value direction has to flip between themes.

**kill criteria:** if the two-disc drift reads as generic bouncing-dots/loading-dots
motion with no "these are converging toward alignment" read, kill. If an alignment
event never lands inside any plausible 5-8s glance window (i.e. the 14-18s recurrence
proves too sparse in practice), shorten the periods and re-verify rather than shipping
a component whose defining moment a reviewer never sees.

**legibility:** the one thing to follow is the vertical/horizontal gap between the two
discs closing and reopening; cadence is each disc's own drift cycling every 6-10s,
with a full alignment (gap near zero, brief brighten-then-fade) recurring roughly
every 14-18s and taking a visible quarter-second-plus to arrive and depart.
