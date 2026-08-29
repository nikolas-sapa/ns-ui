# catenary-contact-stagger

**tier:** core

**product surface it replaces:** a live connection/sync-quality indicator
(feedback moment) — replacing a generic "connected/syncing" dot or bar.

**the real mechanic, with source:** overhead contact wire is deliberately
laid in a zigzag (stagger) above the track, alternating side to side span
by span, so a pantograph's carbon collector strip wears evenly across its
width instead of grooving one spot. The strip continuously tracks this
lateral zigzag as it passes under each span; on the rare span where contact
genuinely breaks, a brief arc punctuates an otherwise smooth ride. Source:
overhead line equipment (OLE) engineering — contact wire stagger is a
standard mainline design parameter.

**one-sentence mechanic description:** A pantograph strip rides a contact
wire that zigzags side to side by design, and only arcs — briefly — on the
rare span where contact genuinely breaks.

**rendering approach:** DOM/SVG. Wire zigzag path and pantograph head
geometry derive from container width; span width = container width ÷
visible span count (3–4 spans at card scale). No canvas.

**REAL NUMBERS:**
- Real contact wire stagger: ±150–300mm alternating span to span (commonly
  ±200mm), full lateral throw ~400–600mm across two spans.
- Real span length: ~50–65m between masts on mainline OLE.
- Real collector strip width: ~0.6–1.2m, wide enough the stagger stays
  inside it.
- Rendered: the wire's zigzag sweeps one full stagger cycle (left extreme →
  right extreme → left extreme) relative to the strip every 2.0s per span
  crossed, strip drawn as a fixed-width band the zigzag must stay inside.
- Dewirement arc: rare punctuation only, mean interval 22s (randomized
  18–28s), each arc lasting ~180ms (a brief luminance flash plus a ~3px
  vertical wire "kick") — deliberately decoupled from the sweep rate so it
  never strobes.

**the resting loop:** t0 shows the wire at one lateral extreme over the
strip's centre; at 2.5s it has swept past centre toward the other extreme,
mid-way into its second sweep; at 5s it is two-and-a-half sweeps in, at a
phase distinct from both prior frames, with roughly a 1-in-9 chance an arc
has punctuated the window (expected variance, not guaranteed every render).

**the reduced-motion freeze frame:** freezes with the wire at dead-centre
over the strip — maximum contact margin, the "everything is fine" frame —
never at a stagger extreme and never mid-arc.

**interaction (if any) and what it must NOT do:** none (ambient status
read). If wired to a real connection-quality prop, degraded connectivity
should shorten the arc's mean interval rather than change colour — severity
reads via event rate, never hue.

**light theme vs dark:** wire and strip are `--foreground` strokes at full
weight in both themes. The arc flash is a luminance pulse layered onto
`--foreground` (brightened toward `--background`'s opposite pole), never
toward `--ns-accent` — confirm it stays visible against a light card
without blowing out to flat white.

**kill criteria:** if the arc reads as random flicker rather than a rare,
sourced event against a smooth sweep, or the sweep speed is fast enough to
alias against 60Hz paint, kill it.

**legibility line:** the ONE followable thing is the contact strip's slow
side-to-side sweep tracking the wire's stagger; cadence is one full sweep
every 2.0s, with the rare arc (~every 20s) reading as a clearly separate,
brief punctuation, not part of the main rhythm.
