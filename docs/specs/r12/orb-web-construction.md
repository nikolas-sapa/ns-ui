# orb-web-construction

**tier:** loud

**product surface it replaces:** full-bleed hero background (adjacent to
`weld-pool`/`dye-whorl` — an ambient full-bleed showpiece behind headline
copy, not a literal "spider" gimmick).

**the real mechanic, with source:** Orb-weaver construction sequence
(documented across Araneidae behavioral studies, e.g. Zschokke 1999 "Nest-
building behaviour of the orb-web spider"): a bridge thread is laid first
between two anchor points, then a frame of a few straight threads, then
radii (spokes) laid from the hub outward to the frame, then a temporary
non-sticky auxiliary spiral laid from hub outward (structural scaffold), and
finally the permanent sticky capture spiral laid from the OUTSIDE back
toward the hub, consuming/removing the auxiliary spiral as it goes. Damage
repair (a real, documented behavior) rebuilds only the torn sector, not the
whole web.

**one-sentence mechanic description:** A web builds itself in the spider's
real order (bridge, frame, radii, then a spiral from center-out, replaced by
a second spiral from outside back to center), then a random sector tears and
gets rebuilt in place while the rest of the web sits finished.

**rendering approach:** 2D canvas, full-bleed. Hub at container center;
radius count and hub position derived from `min(w,h)`. Every thread segment
is a simple line/arc draw; no physics solve needed since positions are
scripted by the construction sequence, not simulated tension.

**REAL NUMBERS:**
- Radii count: `n = clamp(round(min(w,h) / 60), 16, 28)` spokes, evenly
  angled with ±4° per-spoke jitter (real webs aren't perfectly even).
- Frame: 3 anchor threads laid first, 0.4s each, 1.2s total.
- Radii: laid sequentially outward from hub, one every 90ms (a spoke takes
  260ms to draw its full length, so 2-3 are mid-draw at once) — full radii
  phase takes `n * 90ms` (~1.8-2.5s).
- Auxiliary spiral: one full turn every 380ms outward from hub to frame,
  drawn as a faint dashed single-pixel spiral (`--border`), ~5-6 turns to
  reach the frame — auxiliary phase ~2.1s.
- Capture spiral: drawn from the outermost auxiliary turn back inward, one
  turn every 520ms (slower — real capture-spiral silk is laid more
  carefully than the scaffold), replacing the dashed auxiliary line turn-by
  -turn with a solid line as it passes; capture phase ~3.1s.
- Total build time hub-to-finished: ~9-10s.
- Rest period once finished: holds static for 6-9s (randomized).
- Damage event: one random sector (a 40-70° wedge, 2-4 adjacent radii plus
  the capture-spiral turns crossing them) is erased over 180ms (a "tear").
- Repair: the same sequence (radii-then-spiral) rebuilds ONLY that wedge,
  taking proportionally ~9-10s * (wedge angle / 360°) ≈ 1-2s, while the rest
  of the web stays static and fully drawn throughout.
- Full cycle (finished → rest → tear → repair → rest) repeats indefinitely,
  period ~9-13s after the first full build.

**resting loop (t0/2.5s/5s):** t0 shows bridge+frame only, maybe first
radius starting. At 2.5s radii are mostly laid, auxiliary spiral spinning
outward behind them. At 5s the capture spiral is unwinding inward, replacing
dashed with solid turns — visibly different silhouette at all three marks.
After first full build (~10s), the loop continues via the tear/repair cycle
so it never goes static for more than ~9s at a stretch.

**reduced-motion freeze frame:** the fully-finished web, capture spiral
complete, mid-rest (no tear active) — named `WEB_COMPLETE`, chosen because
it is the one state that reads as "a web" rather than a partial construction
or an actively-torn sector.

**interaction:** none required; ambient hero background. Must NOT let any
capture-spiral highlight or tear-flash use `--ns-accent` — the tear moment
should read via a brief luminance drop (thread erased to nothing) not a
color cue.

**light vs dark:** all silk drawn as `--foreground` at low alpha (~0.35) for
capture spiral, `--border` for the fainter auxiliary/radii scaffold lines,
against a plain `--background` — no separate light/dark palette needed since
both tokens invert correctly; verify in light theme that the low-alpha
capture spiral doesn't disappear below perceptual floor (bump to ~0.45 alpha
in light if needed, checked empirically against `--border`'s ~1.1:1).

**kill criteria:** if the construction sequence collapses into "lines appear
in sequence" indistinguishable from a generic loading-spiral animation once
the specific bridge→frame→radii→auxiliary→capture ordering isn't visually
legible as distinct phases, cut it — the phase distinction (dashed scaffold
being replaced by solid capture line) is the whole point.

**legibility:** the one thing to follow is the capture spiral's solid line
overtaking the dashed auxiliary spiral turn by turn as it winds inward; at
520ms/turn a viewer can track individual turns being replaced, and the tear
-then-rebuilt-sector cycle gives a second, slower (9-13s period) event to
notice on a longer look.
