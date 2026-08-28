# braze-capillary-fill

**tier:** core

**product surface it replaces:** a linear progress/validation-fill indicator (form field
confirmation, upload/save progress, a "filling in" state for a multi-field row).

**the real mechanic, with its source:** torch brazing. Filler metal (rod or preplaced ring)
melts at the joint mouth and is drawn INTO the narrow gap between two closely-fitted
parts by capillary action, not gravity or pressure — flow direction is toward the hottest,
narrowest part of the gap, and the fillet forms only where filler exits the gap and pools
at the surface under surface tension. AWS Brazing Handbook: capillary rise scales inversely
with gap width, so a well-fitted joint (0.05-0.15mm) wicks faster and more completely than
a loose one; too wide a gap and the filler just puddles without wicking.

**one-sentence mechanic description:** a bright bead of molten filler sits at the mouth of
a hairline seam and is drawn sideways along the gap by capillary pull, leaving a filled,
slightly domed track behind it and building a small fillet where it reaches the far end.

**rendering approach:** 2D canvas, DOM overlay for the seam itself (a 1px `--border` hairline
gap between two flat panels rendered as `<div>`s). Fill front rendered as a canvas strip
sized to the seam's bounding box, 240x24 logical px scaled by DPR, redrawn every rAF frame.

**REAL NUMBERS:**
- capillary front advances at 38px/s baseline, modulated ±20% by a low-frequency sine
  (0.08Hz) standing in for local gap-width variance along the seam.
- fillet build-up: once the front reaches the far end (~6.3s at 240px/38px/s), a 14px-radius
  meniscus grows over 900ms to its resting bulge, then holds.
- brightness ramp: the wetted zone within 18px behind the front is +0.35 luminance (molten,
  brightest point), decaying to +0.08 over the next 60px (solidified, still warm), flat
  background luminance beyond that (cold, unfilled gap = `--border` value, filled/solid =
  `--foreground` at 0.7 alpha).
- loop period: 9.4s fill + 2.1s hold at full fillet + 1.2s fade-reset = 12.7s, then repeats
  from an empty gap (a fresh joint, not a reverse-wipe — brazing doesn't unmelt).

**the resting loop:** t0 — gap is empty (`--border` hairline, no fill). t2.5s — front has
advanced ~95px, a bright wetted zone trails it, roughly 40% of the seam filled. t5s — front
has advanced ~190px (near the far end), fillet meniscus is mid-growth at the exit point.
Loop then holds at full fillet briefly and resets to empty over a 1.2s fade, unforced,
continuous.

**the reduced-motion freeze frame, named explicitly:** `STATIC_PROGRESS = 0.62` — front at
62% of the seam, wetted trail visible, fillet not yet started. Chosen because it shows both
the unfilled gap ahead and the solidified fill behind in the same frame, which neither t0
(nothing filled) nor the full-fillet hold (nothing left to explain) shows on its own.

**interaction (if any) and what it must NOT do:** none required for the core loop. If used
as a real form-fill/save indicator, an optional `progress` prop can pin the front position
to actual state instead of the looping demo clock — but the resting/demo loop must run
unconditionally when no prop is passed, so the catalog card is alive without input. The
molten highlight must be pure luminance (+L only) — never composited with `--ns-accent`.

**how it reads in light vs dark theme:** dark — cold gap is a slightly darker hairline
against the panel (`--border` on `--background`), wetted/molten zone brightens toward
near-white. Light — same relationship inverted in magnitude, not direction: cold gap stays
`--border` (already near-invisible per token rules), filled zone is `--foreground` at full
opacity so the filled track reads as a solid dark line against light panels; the molten
brightness bump is capped lower in light theme (+0.15 not +0.35) so it never overshoots
into a blown-out white patch on a light background — checked at build time, not inferred.

**kill criteria:** if the wetted/molten highlight is only readable as a color shift rather
than a luminance shift, reject. If the front's advance is imperceptible at card scale
(seam too short, front too fast) so t0/2.5s/5s don't visibly differ, reject. If the fillet
meniscus reads as a generic dot rather than a joint bead (no directional build, no meniscus
curvature), reject — the mechanic must be visibly a JOINT filling, not a progress bar with
a gradient.
