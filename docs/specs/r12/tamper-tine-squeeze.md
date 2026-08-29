# tamper-tine-squeeze

**tier:** core

**product surface it replaces:** a "compacting/optimizing" loader (e.g. a
database vacuum or asset-optimization progress state) — an indeterminate
"still working" indicator with real mechanical texture instead of a bar.

**the real mechanic, with source:** a ballast tamping machine's satellite
units plunge paired tines into the ballast either side of a sleeper, squeeze
them together under high-frequency vibration to consolidate the stone
beneath it, then lift and shift to the next sleeper. Source: railway
maintenance-of-way engineering — mechanised ballast tamping (e.g.
Plasser & Theurer-class tamping units).

**one-sentence mechanic description:** Paired tines plunge either side of a
sleeper, squeeze together under vibration to pack the stone beneath it,
then lift and step to the next sleeper.

**rendering approach:** DOM/SVG. Tine-pair and sleeper geometry derive from
the container's smaller dimension; a horizontal row of sleepers scaled to
container width, typically 5–7 visible.

**REAL NUMBERS:**
- Real tine vibration frequency: ~35Hz (Plasser & Theurer-class units) —
  documented as text only, NOT animated 1:1 (round-9 decoupling rule: 35Hz
  aliases against 60Hz paint).
- Real insertion depth: ~250–300mm below the sleeper.
- Real squeeze force: ~20–30kN per tine pair.
- Real per-sleeper machine advance: ~2–3 sleepers/minute in continuous
  tamping — too slow for a legible UI loop, so the rendered rate is
  compressed and documented as compression, not literal.
- Rendered cadence: one plunge → squeeze → lift → shift cycle every 1.6s
  per sleeper; the squeeze itself is a smooth close-and-hold over ~500ms.
  No attempt at rendering 35Hz vibration directly — a low-amplitude jitter
  capped at 6Hz is layered only during the ~500ms hold, well below
  paint-rate alias risk, to suggest vibration texture without strobing.

**the resting loop:** t0 shows tines plunged and open around a sleeper on
the left of the row; at 2.5s that pair has squeezed shut, lifted, and the
satellite has advanced to the next sleeper (mid-plunge there); at 5s the
satellite is three sleepers further along than at t0 — a materially
different position every time.

**the reduced-motion freeze frame:** freezes at the squeeze-closed,
mid-hold frame (tines fully shut against the sleeper, the compacted state)
— the frame that shows the mechanism's purpose, not an open/transit frame.

**interaction (if any) and what it must NOT do:** none (ambient loader). If
bound to a real progress value, the satellite's position along the row maps
to percent-complete instead of looping — looping is the indeterminate
"still working" state only, and must never fake a percentage it doesn't
have.

**light theme vs dark:** tines and sleeper are `--foreground` strokes.
Packed ballast under a finished sleeper reads as a denser `--foreground`
stipple versus a sparser `--ns-muted` stipple for not-yet-tamped ballast —
confirm that density delta still reads in light theme, where `--ns-muted`
sits close to `--background`.

**kill criteria:** if the compressed cadence reads as jittery/nervous
rather than a deliberate mechanical squeeze, or the packed-vs-loose ballast
distinction is illegible at card scale, kill it.

**legibility line:** the ONE followable thing is a single tine pair's
plunge → squeeze-shut → lift cycle on the satellite's current sleeper;
cadence is 1.6s per sleeper, with a clearly held ~500ms squeeze-shut moment
as the "arrival," not a blink.
