# fax-line-slip

**tier:** core

**product surface it replaces:** loading / connecting state before content
arrives (e.g. a document preview, an attachment thumbnail resolving).

**the real mechanic, with source:** the Group 3 fax handshake and transmission
sequence: the calling machine sends a CNG tone (1100Hz, pulsed ~0.5s on/3s
off), the answering machine responds with a CED tone (2100Hz, held ~2.6-4s),
then the page transmits as a sequence of horizontal scan lines at the
negotiated modem rate (commonly 9600bps at standard resolution, ~1728 pixels
per line at 204dpi — producing roughly 5-6 lines/second of real throughput at
that rate). Thermal-paper fax machines are also documented for a specific
mechanical fault: paper slip through the feed rollers mid-page, which shows up
as a sudden horizontal shear/skew in a band of the received image where the
paper momentarily moved relative to the print head, followed by lines
resuming true afterward. Source: ITU-T T.30 fax handshake tones and G3
transmission rate, documented thermal fax paper-slip artifact.

**one-sentence mechanic description:** a document preview connects with two
audible-register handshake pulses rendered as a waveform, then builds in as
horizontal scan lines from top to bottom, with one deliberate paper-slip skew
partway down before the lines resume true.

**rendering approach:** 2D canvas, `w-full h-full`, resolution derived from
container's smaller dimension: one scanline per ~2px of the mask height,
capped at 220 lines for a card-scale container.

**REAL NUMBERS:**
- handshake phase: two short waveform pulses render across the top ~15% of
  the frame — a tight-period sine burst (visually standing in for 1100Hz)
  lasting 500ms, a 500ms gap, then a lower-period sine burst (standing in for
  2100Hz) lasting 1200ms — total handshake ~2.2s before the first scan line
  begins (this is the ONE audible-register detail rendered visually; it is
  not sped up because it is already at a human-followable pace)
- scan-line build: one line commits every 45ms after the handshake completes
  (real G3 at 9600bps is ~5-6 lines/sec = ~180ms/line; the render commits
  faster, ~22 lines/sec, specifically because 220 individual line-reveal
  events at real-world speed would take 40 seconds — the DECOUPLING here goes
  the other direction from the round-9 warning: the real rate is documented
  in this spec, but rendering it 1:1 would make the resting loop unbearably
  slow rather than illegible, so it is compressed, not decoupled for
  alias-avoidance)
- paper slip: at a randomized point between 55-75% down the frame, one 3-line
  band shears horizontally by 14-22px (randomized per cycle) over a single
  40ms frame, then the following line resumes at 0px offset — a hard, sudden
  discontinuity, not an eased slide
- hold: 1.8s once the full frame has scanned in
- reset: the frame does not fade — it clears top-to-bottom in a single 200ms
  wipe (mirrors a fresh page feeding in), then the handshake tones replay

**the resting loop:** t0 = handshake waveform mid-first-pulse, no scan lines
yet. t=2.5s = scan lines building, roughly 1/3 down the frame, paper-slip
event not yet reached. t=5s = frame fully scanned (handshake 2.2s + ~9.9s
scan time for 220 lines at 45ms ≈ 12.1s total build — so at t=5s the frame is
roughly 60% scanned with the slip artifact likely already visible, distinctly
different from both earlier states).

**reduced-motion freeze frame:** the fully-scanned frame at rest, WITH the
paper-slip artifact visible in its band — the most structured, most
information-carrying frame, showing both the completed content and the
mechanical fault that gives the component its identity.

**legibility:** the ONE thing to follow is the scan-line front — a single
horizontal edge between "resolved" (above) and "not yet arrived" (below)
descending steadily, with one sharp, unmistakable discontinuity (the slip)
breaking that steady descent exactly once per cycle. The slip is deliberately
a single abrupt event rather than a repeating glitch, so it reads as a fault
that happened once, not noise.

**interaction:** none — this is a passive connecting/loading state. It must
NOT loop the paper-slip artifact more than once per cycle (a repeating
glitch reads as broken rendering, not as a documented mechanical fault) and
must NOT use `--ns-accent` anywhere in the waveform or scan-line fill.

**light vs dark theme:** scan lines render as `--foreground` content over a
`--background` field exactly as a real thermal print reads (dark marks on
light stock); dark theme inverts this relationship (light content on dark
field) rather than literally swapping which token is which — check early
that the paper-slip shear band stays legible in both (it needs a value
difference at its edge, not just a position shift, or it reads as
imperceptible in light theme where the base contrast is already lower).

**kill criteria:** if the paper-slip event is not immediately readable as "one
thing went wrong here" on a first, uninstructed viewing, cut it or the whole
concept dies — a mechanical-fault detail that requires the spec to explain it
has failed Filter 2's "striking at first glance" bar.
