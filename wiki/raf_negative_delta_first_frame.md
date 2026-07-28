---
name: raf_negative_delta_first_frame
desc: A rAF callback's timestamp can read marginally behind a performance.now() sample taken just before requestAnimationFrame was scheduled — clamp raw = now - lastSample to >= 0 or a fresh animation's first frame computes a tiny negative delta and poisons anything downstream (eased progress going negative, negative radii, etc).
created: 2026-07-23T06:25:00Z
updated: 2026-07-23T06:25:00Z
---

# raf_negative_delta_first_frame

Any rAF loop that (re)starts by taking `performance.now()` synchronously
(e.g. in a "wake" helper that seeds `lastRef.current = performance.now()`
before calling `requestAnimationFrame(tick)`) and then, inside `tick(now)`,
computes `const raw = now - lastRef.current` for a delta-time step, can see
`raw` come out **slightly negative** on that first frame. The browser's rAF
`now` argument represents the frame's start timestamp, which is not
guaranteed to be >= a `performance.now()` sampled synchronously moments
earlier in the same script turn. The gap is small (fractions of a
millisecond to a few ms) but real, and reproduced 100% of the time in
practice, not as rare jitter.

Symptom: anything derived from that first-frame delta going through a
non-linear function can misbehave in a way that's hard to trace back to
"time went backwards." Concretely, in signet-drop
(`registry/loud/signet-drop/component.tsx`), a hold-to-confirm progress
value was computed as `progress = min(1, progress + raw / holdMs)`, so a
negative `raw` on the hold's opening frame drove `progress` to something
like `-0.003`. That alone is invisible — but it was fed through
`easeOutCubic(t) = 1 - (1-t)**3`, which is well-behaved for `t` in `[0,1]`
but swings sharply negative for `t` slightly below 0 (`easeOutCubic(-0.01)
≈ -0.03`). That eased value scaled a wax-blob's SVG `<circle r>`, and
`setAttribute("r", "-0.03")` throws in Chromium ("A negative value is not
valid"), which verify.ts's console-error check treats as a hard fail. The
error only ever surfaces well downstream of the actual bug, on a completely
different line than the one at fault — trace it back to the rAF delta
computation, not the line the stack trace points at.

Rule of thumb: clamp the delta at the source, once, rather than guarding
every consumer:

```ts
const raw = Math.max(0, now - lastRef.current); // never let time run backwards
const dt = Math.min(MAX_STEP, raw);
lastRef.current = now;
```

This is cheap insurance worth adding to every rAF tick loop in this repo
that derives progress/easing from a wall-clock delta, not just ones that
happen to feed an SVG radius — the same negative-input-to-an-easing-curve
failure mode applies to scale/opacity/position too, it just won't always
throw a console error to catch it.
