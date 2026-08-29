# capstan-slip

**tier:** core

**product surface it replaces:** a determinate progress bar (a transport-
driven alternative to the plain filled-track family — the mechanic lives
in the transport geometry itself, not in a scrolling waveform trace, so it
doesn't compete with `waveform-ascii-scrub` or `scrubber-film-strip`).

**the real mechanic, with source:** tape is driven at constant linear
speed by a capstan shaft pinched against it by a rubber pinch roller;
roller eccentricity, bearing wear, and momentary micro-slip at the nip
between roller and tape are the dominant real-world source of flutter
(rapid speed variation) in analog tape transports. Professional decks spec
wow-and-flutter under 0.05% WRMS; a slipping or glazed roller pushes that
far higher and is audible as a periodic "wow" in pitch. Source: standard
tape-transport service literature (capstan/pinch-roller wow-and-flutter
alignment procedures, e.g. Studer/Otari deck manuals).

**one-sentence mechanic description:** a roller nips a moving tape against
a driven shaft, and every so often the nip visibly compresses and slips —
the tape's speed dips and the roller catches back up.

**rendering approach:** DOM/SVG, side-on view: a capstan shaft (circle) and
pinch roller (circle) nipping a straight horizontal tape path spanning the
card; the tape surface carries a repeating tick/mark pattern that scrolls
past the nip to show speed. Geometry (shaft/roller radii, tape path
length) derived from the container's smaller dimension.

**REAL NUMBERS:**
- Real tape speed: 19.05 cm/s (7.5 ips studio reference — documented
  only). Rendered tape-mark scroll speed: 28px/s baseline at card scale.
- Capstan rotation: continuous at 0.6 rev/s (slow and legible, deliberately
  decoupled from any real transport RPM).
- Micro-slip events (the discrete mechanic, sized to the round-9 "~1s
  between events" rule): fire every 1.1s ± 0.2s jitter. Each event: nip
  visibly compresses ~2px over ~40ms, tape scroll speed drops to 40% of
  baseline for 90ms, then springs back to baseline via an underdamped
  recovery (~120ms settle, one small overshoot) — total event length
  ~250ms, easily long enough to register as "there, it slipped."
- Real spec reference shown as static text if a readout is included:
  "0.05% WRMS" (professional-deck flutter spec, for context only, not
  animated).

**the resting loop:** t0 — tape marks at some scroll offset, nip at rest
between events. 2.5s — roughly 2 slip events have fired (1.1s cadence),
visibly different mark spacing trailing the nip from the most recent one.
5s — a clearly different tape-mark offset and a different count of visible
slip artifacts than at t0.

**the reduced-motion freeze frame:** frozen mid-slip, ~40ms into an event
— the nip at its compression peak, with compressed tape-mark spacing
trailing it. Chosen because it's the single frame that shows both the
roller deformation and the resulting mark-spacing differential at once,
which a mid-cycle "nothing happening" frame would not.

**interaction (if any) and what it must NOT do:** none required for the
ambient loop. An optional hover-triggered numeric callout ("0.05% WRMS")
must render in plain `--foreground`/`--ns-muted` text, never as an
accent-tinted highlight on the roller or nip.

**light theme vs dark:** capstan and roller strokes `--foreground`; tape
path fill `--background` with `--foreground` tick marks; if a static
housing/chassis outline is added it uses `--border` as a true separator,
never as the roller or tape's own line weight.

**kill criteria:** if the finished piece reads as a generic "loading with
dots/segments" motif once the transport chrome is stripped away — kill it.
If it's visually confusable with `idler-drop`'s gear-train motif (both are
mechanical-transmission SVG pieces) at a glance, kill it and say so.

**legibility:** the ONE thing to follow is the nip point flexing and
recovering. Cadence: ~1.1s between slip events, each lasting ~250ms
(dip then spring-back) — long enough to watch the whole dip-and-recover,
not a flicker.
