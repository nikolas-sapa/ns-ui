# interlace-field-comb

**tier:** loud

**product surface it replaces:** full-bleed hero / background band.

**the real mechanic, with source:** analog interlaced video (NTSC/PAL) draws a frame as two
temporally-offset fields — odd scanlines (field 1) then even scanlines (field 2), ~1/50s or
1/60s apart. A static frame "weaves" the two fields into one clean image. Anything that moved
between the two field captures produces a "comb" artifact: a horizontal-edge object shows a
jagged serration where odd and even lines disagree, because each set of lines is sampling a
different instant. This is the actual defect broadcast engineers call combing, distinct from
`flyback-tear` (signal/sync loss, already shipped) and `rolling-shutter-skew` (CMOS sensor
readout skew, already shipped) — combing is specifically about two co-owned, temporally
offset scanline sets disagreeing on a moving edge, not signal loss or per-row read timing.

**one-sentence mechanic description:** horizontal bands of content drift at slightly different
phase/offset between odd and even scanline sets, so any diagonal or moving edge serrates into
a visible comb, and the two fields periodically re-align into a clean "woven" frame before
drifting apart again.

**rendering approach:** 2D canvas, full-bleed. Backing store at device pixel ratio (capped 1.5).
Scanline pitch derived from the container's smaller dimension: `pitch = clamp(round(minDim / 260), 1, 3)` px per field-line pair. Content is a single slow-moving field (a soft diagonal
luminance gradient band, 2-3 large soft-edged shapes drifting) sampled twice per output frame at
two different time offsets — one for odd rows, one for even rows.

**REAL NUMBERS:** field rate 50Hz (PAL-derived, chosen over 60 so the offset is perceptible
without aliasing against a 60Hz display — this is the round 9 decoupling lesson: the visual
sweep is slow and independent of any real display rate). Field time offset: 1/50s = 20ms between
the odd-field sample and the even-field sample. Content drift speed: 6px/s lateral. Re-weave
(alignment) cycle: every 4.0s the drift crosses zero offset and the frame reads as one clean
image for about 400ms, then resumes diverging. Comb serration amplitude at max divergence: up to
`pitch * 2` px of horizontal disagreement between adjacent odd/even rows.

**the resting loop:** t0 — mid-cycle, visible comb serration along the moving shapes' edges,
maximum divergence. t2.5s — past a re-weave point (at 4.0s intervals, so ~2.5s lands mid-drift
the opposite direction from t0), comb visible but on the opposite phase. t5s — approaching the
next re-weave, serration shrinking back toward a clean weave.

**the reduced-motion freeze frame:** freeze at the moment of full re-weave (offset = 0, one full
cycle in from start, e.g. `STATIC_TIME = 4.0s`) — the single frame where the comb artifact is
absent and the underlying gradient shapes read cleanly, which is the most legible "before" state
that still shows the shapes the effect acts on.

**interaction:** none. Must not tie the comb phase to pointer position — the mechanic is a
signal-timing artifact, not a hover effect, and doing so would invite a live cursor-tinted
highlight, exactly the accent-mixing failure the round 9 notes warn about.

**light vs dark:** the drifting shapes are a luminance gradient (`--foreground` mixed toward
`--background`, opacity varied, never accent) so the comb is legible as brightness disagreement
between adjacent scanlines in both themes; in light theme increase the base contrast delta
between the two fields' sample offsets slightly (drift speed unchanged, but shape edge contrast
raised ~15%) since fine 1-2px serrations wash out faster against a light background.

**kill criteria:** if at card/full-bleed scale the 1-3px scanline pitch is imperceptible on a
standard display (i.e. reads as a static soft gradient with no visible comb at any phase),
this is a reject — the mechanic's whole identity is the comb, and a component that only shows a
drifting gradient is a restyle of an existing background component.

**legibility:** the ONE thing to follow is the comb serration growing and shrinking on a single
moving edge; the 4.0s re-weave cadence (divergence → clean weave → divergence) is slow enough to
watch the edge sharpen and then serrate again with the eye, never a blink.
