# tape-emboss — trust strip as a Dymo embossing labeller

**Collection:** core · **Surface:** trust-mark / label strip beneath a CTA or pricing block

## 1. Surface and the real process

Replaces the small trust strip — the row of short assurance labels that sits under a
pricing table or a signup form.

Borrowed process: the **handheld embossing labeller** (Dymo M-1011 and descendants).
A character wheel is rotated to the glyph; squeezing the handle drives a punch against a
die through vinyl tape, plastically deforming it into a raised character. The vinyl is
**stress-whitened** — plastic deformation crazes the polymer so it scatters light and the
raised character turns opaque white *regardless of the tape's colour*. A ratchet advances
the tape one character pitch per squeeze, and a separate lever cuts the strip. The tape is
glossy; the embossed characters are matte.

## 2. Nearest existing slug and why this is not a restyle

Nearest: `card-number-emboss` (core) and `stencil-fill` (core).

`card-number-emboss`'s cue is a **bevel shadow** — relief lit from a fixed direction, so
the character is defined by a dark edge. The entire identity of a Dymo label is that the
mark is *not* a shadow but a change in the material's light scattering, so the character's
**interior** is bright and its edges are not darker than the ground; the two are
distinguishable in a single still. The surface differs too: this is a fixed trust strip that
types itself on an unbounded loop, not a text input driven by keystrokes.

## 3. Mechanic

- **Character pitch 15 px. Tape width 34 px.** Strip drawn with a 2 px corner radius and
  a 0.6 px specular gloss line at 28% of the tape height (the vinyl's crown).
- **Character wheel:** 44 positions on a circle of radius 46 px, at the strip's left. It
  rotates at 6.2 rad/s along the **true shortest arc** on the wheel, with a detent — a
  1.4° overshoot and 90 ms settle on arrival. So a `Z` following an `A` visibly takes
  longer than a `B` following an `A`. That honesty is the mechanic.
- **Squeeze:** handle closes 130 ms, punch dwell 60 ms, release 110 ms. Tape advances
  15 px during release with a ratchet snap — 80 ms ease-out, 2 px overshoot.
- **Stress whitening:** the glyph mask is dilated by 1.2 px and filled at
  `base_L + 0.42` (light) / `base_L + 0.40` (dark) — **the same direction in both
  themes**, because whitening is whitening. A 2 px halo at `+0.10 L` around it is the
  shoulder of the deformation. **No dark bevel anywhere** — this is the single rule that
  keeps it from becoming `card-number-emboss`.
- **Whitening bloom:** real crazing continues after the strike. Glyph luminance rises
  from `+0.30` to the full `+0.42` over 900 ms with `tau = 320 ms`, so the last two or
  three characters on the strip are always at slightly different brightnesses.
- **Cycle:** a strip of `N = 9` characters types itself (≈ 0.38 s each), then the cutter lever
  descends over 220 ms and severs. The cut strip falls 26 px onto a pile with ±3° rotation,
  a fresh leader feeds out over 340 ms, and the next phrase begins. Period ≈ **4.8 s**.
  The pile is a rolling window of the last 5 strips — unbounded, never resetting.
- **Idle within a strip:** the wheel never fully stops — it hunts ±0.6° at 1.1 Hz (a real
  free-turning dial), and the gloss line drifts 1 px vertically on a 3.70 s period.
- Geometry from `min(w, h)`: pitch `0.045 * min(w,h)` floored at 11 px; wheel radius
  `0.14 * min(w,h)` floored at 30 px.

## 4. Alive at rest (no input)

- **t = 0.0 s** — wheel mid-rotation toward the second character, one character
  embossed, 4 cut strips on the pile.
- **t = 2.5 s** — 6 characters embossed, tape advanced 90 px, wheel at a different
  bearing, the newest character still mid-bloom and visibly dimmer than its neighbour.
- **t = 5.0 s** — the strip has been cut and a new one is 2 characters in; the pile has
  gained a strip and the oldest has rolled off.

## 5. Reduced-motion freeze frame

**Freeze at t = 2.90 s.** Seven of nine characters embossed, with the seventh held at
`+0.34 L` mid-bloom so the bloom gradient is visible across the last two characters; the
wheel stopped 12° short of the eighth character with the handle at 40% squeeze; four
cut strips on the pile.

Why: the bloom gradient proves the whitening is progressive rather than painted, the
part-squeezed handle proves the drive, and the pile proves the loop. t=0 is a blank tape
with one character and an empty pile — the surface's whole content missing.

Byte-stability: phrase list, wheel positions and pile rotations are fixed constants; no
PRNG after mount.

## 6. Hue carried by luminance, both themes

| | Light theme | Dark theme |
|---|---|---|
| tape base | L 0.30 (dark strip on a pale page) | L 0.38 (mid strip on a dark page) |
| embossed glyph | +0.42 -> L 0.72 | +0.40 -> L 0.78 |
| deformation halo | +0.10 | +0.10 |
| gloss line | +0.06 | +0.06 |
| cut strips on pile | 0.92 / 0.86 / 0.80 / 0.74 of live contrast | same ratios |

**Same signs and near-identical magnitudes in both themes** — only the tape's base
moves. That is the correct model: a Dymo label is white-on-dark whatever room it is in.
`--border` unused. No `--ns-accent` in the canvas; only the optional link's focus ring.

## 7. Accessibility

- The label text is **real DOM text**; the canvas is `aria-hidden="true"`.
- The full set of phrases is present in the DOM at all times as a visually-hidden `<ul>`,
  which is what a trust strip actually needs. **Prefer this to `aria-live`** — a live region
  firing every 4.8 s forever is noise, and the content is not news.
- If the strip contains a link it is a normal `<a>` in flow with a 2 px `--ns-accent` focus
  ring; otherwise the component contributes no tab stops.
- Focus order: preceding CTA -> strip link (if any) -> following content.
- Text contrast: the embossed glyph at `L 0.72` on `L 0.30` tape is ~4.9:1 in light theme
  and ~5.3:1 in dark — but because the visible label is canvas-drawn, the DOM copy is
  what carries the requirement, and it must be styled to >= 4.5:1 independently.

## 8. Placeholder copy

- phrases: `PLACEHOLDER MARK ONE`, `PLACEHOLDER MARK TWO`,
  `PLACEHOLDER MARK THREE`

Do **not** ship certification names (SOC 2, ISO 27001, GDPR, PCI), refund or money-back
guarantees, uptime figures, or "no credit card required" — those are legal and
commercial claims, and this project has already shipped a fabricated guarantee once.
