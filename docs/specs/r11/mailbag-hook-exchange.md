# mailbag-hook-exchange

**tier:** loud

**product surface it replaces:** hero / full-bleed background — an ambient
banner strip behind a section, not a spinner or status widget.

**the real mechanic, with source:** the Railway Post Office (RPO)
catcher-crane mail exchange, used on US mail trains roughly 1864-1977.
A trackside crane arm holds an outgoing mailbag on an iron hook at a fixed
height; as the train passes at speed (no stop), a catcher arm swings out
from the RPO car, snags the trackside bag, and simultaneously kicks a
second bag off the train's own arm into a net alongside the track — a
same-instant two-way exchange, not a one-way pickup. Real transfer contact
time was well under a second; real headway between exchanges on a given
line was minutes to hours.

**one-sentence mechanic description:** A trackside crane holds a mailbag on
a hook; at intervals a train sweeps past, its catcher arm snags the bag and
kicks a replacement bag onto the trackside net in the same motion, then the
arm resets and waits, swaying, for the next pass.

**rendering approach:** 2D canvas, full-bleed, geometry derived from
container width (track runs left-to-right, ties spaced at
`containerWidth / 48`). Crane arm, hook, bags, and train silhouette are flat
vector shapes drawn with luminance fills/strokes only (token-derived), no
raster assets. Train body is a simple rectangle-plus-taper silhouette so it
reads at card width down to ~480px.

**REAL NUMBERS:**
- Real catch speed: 30-45 mph; real engagement duration: ~0.15-0.3s
  (undrawable at 60Hz). DECOUPLED: rendered engagement is stretched to a
  900ms scripted gesture (arm swings out over 280ms, hook-bag contact holds
  120ms, arm + new bag swing back over 500ms) — documented departure from
  the sub-second real event for legibility, not a 1:1 animation of the real
  rate.
- Train pass interval: one exchange every 7.0s, fixed cadence (not random
  jitter) so the wait itself becomes part of the read.
- Idle crane sway (between passes, this is what proves Filter 2): the arm,
  loaded with the waiting outgoing bag, decays as a damped pendulum
  (zeta 0.35, period 1.6s) that never fully stops — amplitude bottoms out
  at 2deg and holds, a resting tremor rather than dead stillness.
- Signal lamp on the crane post blinks at 0.5Hz (2s period) continuously —
  a second, independent alive-at-rest cue on a different clock from the
  pendulum so t0/2.5s/5s never land on the same phase pairing twice.
- Track ties scroll at a constant 40px/s ambient rate at all times (train
  silhouette itself is only on-screen during the 900ms pass).

**the resting loop:** t0 — crane arm mid-sway at some phase, lamp lit or
unlit, ties scrolling, no train visible. t2.5s — arm sway has visibly
decayed/rephased, lamp has flipped state at least once (2s period), ties
have moved ~100px, train likely mid-approach or freshly departed depending
on where in the 7s cycle t0 landed. t5s — a full exchange has occurred (bag
swapped on the hook is now a different bag graphic — alternating fill
pattern each cycle so "swapped" is visibly a different bag, not the same
one re-drawn), ties have moved further, lamp/pendulum phases both shifted
again.

**reduced-motion freeze frame:** the instant of contact — arm fully
extended, hook engaged with both bags mid-transfer, train mid-frame at
center. Named `CONTACT_FRAME`. This is deliberately not t0 (arm at rest)
because contact is the single most structured, information-dense frame:
crane, train, both bags, and the hook are all simultaneously legible.

**interaction:** none. This is an ambient full-bleed background; it must
not require or reward pointer input. No hover state on the crane or train.

**what it must NOT do:** must not tint the lamp, hook, or bag-swap moment
with `--ns-accent` — the lamp is luminance-only (brightens toward
`--foreground`, dims toward `--ns-muted`), never colored.

**legibility:** the ONE thing to follow is the hook — does it currently
hold a bag, and did that bag change. Everything else (ties scrolling, lamp
blinking, arm swaying) is peripheral atmosphere; the hook state is checked
by eye once per ~7s cycle, which is well inside the "roughly a second
between discrete events, with a visible departure/arrival" legibility bar
(920ms of departure+arrival motion inside 7s of anticipation, no blink-cut).

**light vs dark:** track/ties and crane structure render at
`--ns-muted`-derived low contrast against `--background` in both themes;
the train silhouette and bags need to sit at a clearly higher contrast step
than the structure (closer to `--foreground`) so they read as the
foreground subject in light theme, where the structure alone risks washing
out. Check light theme first — a flat monochrome crane on white paper is
the harder case.

**kill criteria:** if the 7s idle gap between exchanges reads as "broken"
rather than "waiting" in a 5-10s screenshot window (i.e. Filter 2 fails
because the pendulum decay isn't visible enough on its own), the idle
motion budget needs to grow, not the exchange frequency shrink — a faster
cadence would blow past the ~1s-between-discrete-events legibility floor
this exact concept was chosen to respect.
