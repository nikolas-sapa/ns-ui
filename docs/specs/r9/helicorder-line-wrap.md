# helicorder-line-wrap

- **slug:** helicorder-line-wrap
- **tier:** core (card-scale DOM/canvas)

## Product surface it replaces
Loader / ambient status indicator — a "the system is alive and being watched
continuously" heartbeat widget, the same family as `meter-latency-capillary`
or `text-ekg-baseline`, for a status page or monitoring card.

## The real mechanic
A seismograph helicorder: a pen traces one horizontal line across a rotating
drum; when it reaches the right margin it steps back to the left edge and
the drum has advanced downward by one pen-width (a helical pitch), so the
NEXT line begins directly below the one just finished. Stations still
running these show a stack of 8-24 offset horizontal lines per "drum",
oldest at top, newest growing at the bottom, each line representing a fixed
real-time span (commonly 15 or 30 minutes per line).

## One-sentence mechanic description
A pen sweeps one line at a time across a stacked drum record, stepping down
to start a fresh line the instant it runs off the right edge, so the record
grows as a tower of offset horizontal traces rather than one continuous one.

## Rendering approach
DOM + 2D canvas hybrid, card-scale, geometry derived from the container's
smaller dimension. 8 fixed row slots stacked vertically; each row is a
canvas strip. The "live" row draws left-to-right; on wrap, the finished
row's canvas is left as a static bitmap and the next row down becomes live
(oldest row scrolls off the top and the stack shifts up by one row, or the
whole card fades-and-restarts after all 8 fill — pick the shift, it keeps
motion continuous per Filter 2).

## Real numbers
- Real device: one line = 15 real minutes at typical helicorder drum speed
  (60mm/min). This build compresses that to **12s of app time per line**
  (documented ratio: 1 app-second ≈ 75 real seconds) — a deliberate
  decouple per the round-9 legibility rule, since 15 real minutes is far
  too slow to read as "alive."
- 8 rows × 12s = **96s** for a full drum stack to fill top to bottom.
- Idle trace: low-amplitude random-walk "microseism" noise, baseline
  amplitude ±2px, updated every frame.
- Event trace: an "quake" spike fires on average every **28s** (randomized
  18-40s), amplitude 15-20px, rising over ~200ms and decaying over ~2.5s —
  clearly distinguishable from the idle baseline.
- Row sweep speed: row width ÷ 12s ≈ **25px/s** for a 300px-wide card —
  well under any paint-rate aliasing threshold.
- Wrap transition: **200ms** — the pen head does not teleport from right
  margin to left margin; it fades out at the right edge over ~80ms while a
  new pen head fades in at the left edge of the row below over ~120ms, so
  the wrap has a visible departure and arrival, not a blink.

## The resting loop
- **t0:** row 1 empty, pen head at left margin about to start.
- **t=2.5s:** row 1 roughly 20% traced, idle noise visible, no quake yet
  (unless a randomized early one landed).
- **t=5s:** row 1 ~40% traced, at least the chance of one quake spike
  having fired and settled; visibly longer trace than t=2.5s regardless.

## The reduced-motion freeze frame
Frozen with 4 of 8 rows filled, the 5th row (current) traced 60% of the
way across, and one quake spike visible mid-height on an earlier completed
row — a clearly mid-instrument, structured frame, not a blank or a full
stack. Named `STATIC_ROW = 4, STATIC_PROGRESS = 0.6`.

## Interaction
None required (ambient status widget). If hoverable, a hover may reveal a
timestamp tooltip for the row under the cursor — DOM text, `--ns-accent`
permitted only on that tooltip's focus/hover chrome, never on the trace
itself.

## Light theme vs dark
Rows are separated by a hairline using `--border` (its designed ~1.1:1
role — a true separator, not a fill). Trace ink is `--foreground` at full
value in both themes; quake spikes gain height, not color, so they read
identically in both themes. Verify at card scale in light theme first — the
row separators are the first thing to vanish if built with the wrong token.

## Kill criteria
- If compressing to 12s/line makes the sweep alias or strobe against a
  60fps paint (it shouldn't at 25px/s, but must be verified, not assumed —
  this is exactly the round-9 failure mode).
- If the vertical stacking-and-offset wrap is not visually distinguishable
  from a plain looping ticker (`marquee-ticker-glyph`, `ticker-tape-splice`
  already exist) — the stack-and-step-down IS the mechanism; if it reads
  as one continuous scrolling line, this is a reject.
- If 8 rows can't fit legibly at minimum card width without the rows
  becoming illegible hairlines, reduce row count and re-verify legibility
  before shipping, or kill.

## Legibility
The one thing to follow: **the pen wrapping from the right margin of one
row to the left margin of the row below.** Cadence: once every 12s, with an
explicit 200ms fade-out/fade-in transition so the eye can catch the step
rather than losing the pen mid-frame.
