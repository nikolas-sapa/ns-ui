# facsimile-drum-scan

- **slug:** facsimile-drum-scan
- **tier:** loud (full-bleed showpiece)

## Product surface it replaces
Hero — a full-bleed "an image is arriving, line by line, right now" hero,
suited to product pages about transmission, archives, precision printing,
or anything that wants a slow-reveal mood distinct from a generic wipe.

## The real mechanic
Early drum facsimile (Bartlane cable pictures, Belinograph, weather-map fax
machines): a photograph or plate is wrapped around a drum that spins fast
while a print/scan head creeps slowly along the drum's axis, so the image
builds up as a sequence of thin helical scanlines rather than all at once.
Real machines produce a visible defect from this process — helical banding,
a faint per-line horizontal jitter/moiré where consecutive scanlines don't
perfectly register — which is part of how a fax print visibly announces
its own mechanism rather than looking like a clean photograph.

## One-sentence mechanic description
A bright scan head creeps down a blank frame, laying down one faintly
mis-registered scanline at a time until a coarse image resolves, then pauses
and starts scanning a new one.

## Rendering approach
2D canvas, full-bleed, `w-full h-full`, DPR capped at 1.5. Source images are
procedurally generated monochrome patterns (never a real photo — no asset
dependency): a small library of 3 generators (radial halftone dot mass,
topographic-noise contour field, a simple geometric silhouette from layered
sine fields) rendered once to an offscreen buffer per cycle, all values
derived from the 5 monochrome tokens only. The visible canvas reveals that
offscreen buffer scanline-by-scanline from top to bottom; each revealed row
gets a small random horizontal offset (±1-2px) and a slight per-row opacity
variance (92-100%) to simulate helical banding — this is the load-bearing
texture, not decoration.

## Real numbers
- Real drum: ~60-90rpm rotation, ~96 lines/inch axial advance. This build
  reveals **25 lines/second** (one row every 40ms) across a buffer height of
  480 rows scaled to the container — full image revealed in **~19.2s**.
- After a full reveal: **1s pause** (scan head glows steady at the bottom,
  no new rows), then the buffer regenerates with the next pattern in the
  3-pattern rotation and the scan restarts from row 0 — infinite loop, no
  hard reset visible as a blank flash (crossfade the restart over 300ms).
- Helical-banding jitter: ±1-2px horizontal, applied once per row at reveal
  time and then fixed (not re-randomized every frame — it's baked into the
  image the way a real banding defect is baked into the print).
- Scan head glow: a 3px-tall bright band at the current reveal row,
  luminance-only highlight (`--foreground` boosted, never `--ns-accent`).

## The resting loop
- **t0:** frame blank/dark, scan head glow at row 0, nothing revealed yet.
- **t=2.5s:** ~62 of 480 rows revealed (top ~13% of the pattern visible).
- **t=5s:** ~125 of 480 rows revealed (~26%), visibly more than t=2.5s and
  a different partial silhouette than a static image would show.

## The reduced-motion freeze frame
Frozen at 55% revealed (row 264 of 480): top portion shows the completed
banded pattern, scan head glow sits at the boundary row, remainder below is
blank — a clearly mid-scan, structured frame. Named `STATIC_ROW = 264`.

## Interaction
None required — full-bleed hero, must be alive unforced. A pointer may be
allowed to nudge which of the 3 patterns is "up next" on the following
loop (queued, not immediate) so hover isn't a dead gesture, but must not
skip rows or accelerate the reveal rate — that would break the honest
scan-speed identity. No `--ns-accent` anywhere.

## Light theme vs dark
Revealed pixels carry the actual pattern's luminance values (from
`--background`/`--foreground` mix); unrevealed rows sit at a neutral
mid-value between the two tokens so "not yet scanned" reads distinctly from
both "scanned dark" and "scanned light" content in both themes. Check light
theme first: the unrevealed-region value must not collapse toward
`--background` (which would make it invisible) or toward `--foreground`
(which would make it look "already revealed, just blank content").

## Kill criteria
- If 25 lines/s (a rate approaching but under 30Hz) reads as flicker or a
  strobe rather than a smooth reveal against actual 60fps paint — this is
  exactly the round-9 warning about near-paint-rate mechanics; verify by
  eye against a recording, and if it strobes, drop the rate (e.g. to
  15-18 lines/s) and re-verify before shipping, or kill.
- If the helical-banding jitter isn't visible/legible at card... at
  full-bleed scale (it must remain visible at the loud tier's natural
  large size), the differentiator from a generic "wipe reveal" transition
  is gone — reject.
- If the 3 procedural patterns end up visually indistinguishable from each
  other in practice, the "new pattern each cycle" freshness claim is false
  — either make them genuinely distinct or cut to 1 pattern and re-justify
  Filter 2 some other way.

## Legibility
The one thing to follow: **the scan head's glow row descending steadily,
with the revealed image growing beneath it.** Cadence: one row every 40ms
(25/s), a full image every ~19s — slow enough to watch the pattern resolve
across several seconds without needing to stare at a single frame.
