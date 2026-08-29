# column-wheel-heart-reset

- **tier:** core
- **product surface:** feedback moment (a confirm/save pulse — the small chip or indicator that flashes "done" then quietly resets itself, replacing a generic checkmark toast).

## the real mechanic

A chronograph's column wheel is a small toothed wheel with radial pillars;
each pusher press rotates it one notch (a classic layout uses 6 columns,
60deg per index) and each notch position engages a different lever
(start / stop / reset) by letting a jumper spring drop into the valley
between pillars or ride up onto one. Reset engages a heart-shaped cam
fixed to the chronograph seconds pinion: a hammer snaps against the heart's
point and the cam's asymmetric profile forces the pinion to rotate to
exactly zero regardless of where it stopped — an literally self-correcting
mechanical return, not an animated tween back to a known value.

## mechanic description

A notched wheel indexes one step per event and, on the reset step, a
hammer snaps a heart-shaped cam back to exactly one fixed position no
matter where it stopped.

## rendering approach

DOM + SVG. Column wheel: small hexagonal wheel (6 pillars) rendered as a
rotating SVG group. Heart cam + hammer: a heart-profile path plus a hinged
hammer div that swings to strike it.

## real numbers

- Full cycle (idle demo, since this is a feedback-moment component with no
  real pusher in the resting state): 4.5s, unbounded repeat.
- Column wheel index: 6 steps of 60deg each, one index every 0.75s
  (4.5s / 6), `cubic-bezier(.4,0,.2,1)` — fast settle, no overshoot (real
  column wheels are positively jumper-located, not springy).
- Run phase (steps 1-4, 3s total): heart cam sits at an arbitrary running
  position; a thin seconds-style needle sweeps continuously to sell "it's
  running," advancing 90deg per 0.75s step (topically decorative, not the
  mechanism's climactic moment).
- Reset engage (step 5, 0.75s): hammer lifts 12deg over 0.25s (`ease-out`,
  the visible "departure"), then strikes over 0.2s (`ease-in`, accelerating
  into contact) and the heart cam snaps to its zero point in the same
  0.2s window — the needle visibly jumps back to 12-o'clock position
  exactly on hammer contact, never sooner. This snap is the one
  high-contrast instant in the whole cycle.
- Idle/reset-held (step 6, 0.75s): hammer stays engaged against the heart's
  point, needle parked at zero — a visible pause before the next run phase
  begins, giving the reset a moment to register before motion resumes.

## the resting loop

- t0: column wheel at some step, needle mid-sweep (or, if landed on step
  5/6, hammer engaged and needle at zero).
- 2.5s: wheel has advanced ~3 steps from t0 (2.5s / 0.75s), a different
  column engaged, needle at a different angle or freshly reset depending
  on phase alignment — visibly different composition.
- 5s: a full 4.5s cycle plus a partial second cycle has elaped, so wheel
  step and needle phase differ from both t0 and 2.5s (5s isn't a multiple
  of 4.5s or 0.75s together with the t0 sample offset).

## reduced-motion freeze frame

Hammer mid-strike against the heart cam (12deg lift point, needle just
starting its snap toward zero) — the single most information-dense frame
(wheel step visible, hammer engaged, needle mid-transition all at once),
not t0 which could land on a mid-run frame that looks like a static plain
needle with no mechanism visible at all.

## interaction

None in the idle/demo state — it self-cycles as a decorative "confirmed and
ready again" indicator. If wired as a real confirm pulse (e.g. after a save
action succeeds), the component jumps straight to the reset-engage phase on
trigger rather than waiting for its own internal cycle, then resumes the
idle run-phase loop afterward; it must NOT let the accent color mark the
snap moment — the hammer-strike flash is a `--foreground` opacity lift,
identical to every other climactic-moment rule on this project.

## light vs dark theme

Column wheel and running needle render in `--ns-muted` (structural,
ambient "it's alive" motion); the heart cam and hammer render in
`--foreground`, and the hammer strike adds a 200ms `--foreground` opacity
pulse localized to the heart cam's tip. `--border` is never used for the
wheel's pillar strokes (per token rules, it's a separator token, not a
structural stroke) — pillar edges use `--ns-muted` at a slightly higher
opacity than the wheel body instead.

## legibility

The ONE thing to follow: the needle's continuous run, interrupted by one
sharp snap back to zero, then a held pause. Cadence: one reset event every
4.5s, with a clearly separated 0.2s snap — comfortably past the r9 floor,
and the run/pause asymmetry (3s of visible drift vs. one instant snap)
gives the reset the "arrival" quality a viewer can actually catch.

## kill criteria

- If the needle's return-to-zero looks like an ordinary eased tween (i.e.
  it doesn't read as fundamentally different in character from the
  continuous run phase), the heart-cam's real distinguishing trait —
  instantaneous, position-independent correction — has been lost. Reject.
- If a viewer can't tell the difference between "running" and "reset" at a
  glance (both phases look like generic needle motion), the column-wheel
  indexing isn't doing any legible work — reject.
