# Runtime animation audit — September 2026

Read-only audit of what registry components do with `requestAnimationFrame`
when nobody is looking at them. Static analysis is complete and validated;
the runtime section records what could and could not be measured.

**These counts supersede the earlier partial figures (411 rAF / 165 / 58).**
The differences are AST-vs-grep classification, not a change in the registry:
this pass parses every `component.tsx` with the TypeScript compiler rather
than matching text.

---

## 1. Scope: the gallery is not the defect surface

Verified from the import graph, not from a docblock.

`app/preview/[name]/embed/animation-gate.ts` exports `ANIMATION_GATE_SCRIPT`,
which monkey-patches `requestAnimationFrame`/`cancelAnimationFrame` inside the
embed document. It pauses on **both** `document.visibilitychange` and a parent
`postMessage` visibility signal, holds each loop's own re-request rather than
forwarding it (so a paused loop goes fully idle, no polling), and replays held
callbacks with a corrected clock so nothing phase-jumps on resume.

`ANIMATION_GATE_SCRIPT` has exactly one importer:

```
app/preview/[name]/embed/page.tsx:8   import { ANIMATION_GATE_SCRIPT } from "./animation-gate";
app/preview/[name]/embed/page.tsx:79  <script dangerouslySetInnerHTML={{ __html: ANIMATION_GATE_SCRIPT }} />
```

Every gallery, saved-library and review card renders through
`LivePreviewFrame` into that embed iframe. **On those routes a component's own
missing visibility handler is irrelevant** — the gate stops the loop whether
or not the component cooperates.

`app/preview/[name]/page.tsx`, the direct preview link, is **ungated**.

So the real defect surface is:

- **(a) source that consumers copy into their own apps** — this registry ships
  code as the product, so a missing handler costs us nothing and is inherited
  by everyone who installs that component; and
- **(b) our own direct `/preview/<name>` pages.**

Findings below are ranked by what a consumer inherits, not by our runtime cost.

### 1a. Defect in the gate itself — unbounded `tokens` Map

`animation-gate.ts` does `tokens.set(id, token)` on **every** rAF call, and
only `cancelAnimationFrame` ever deletes an entry. A normal animation loop
never cancels per-frame, so the Map accumulates one entry per frame for the
life of the iframe — ~3,600 entries per minute per mounted card at 60fps,
across up to 12 simultaneous iframes.

The entry is two words plus Map overhead, so this is a slow leak rather than an
acute one, but it is unbounded and it is in the one file whose entire job is to
stop background work. The fix is to delete the token in the `wrap()` wrapper
after the callback runs. **Not fixed here** — this worktree has concurrent
editors and this deliverable is the report.

---

## 2. Static classification of all 534 components

Method: `component.tsx` parsed with the TypeScript compiler API. A rAF call is
counted as a **recursive loop** when the identifier passed to `rAF` names the
function that lexically contains the call — i.e. the loop re-arms itself. Zero
`demo.tsx` files contain `visibilitychange`, so `component.tsx` is the whole
story.

| | count |
|---|---|
| total components | 534 |
| use `requestAnimationFrame` | **413** |
| — IntersectionObserver **and** `visibilitychange` | 128 |
| — IntersectionObserver only | 60 |
| — `visibilitychange` only | 59 |
| — neither | **166** |

`166` is a **suspect list, not a defect count.** Two filters were applied
before publishing any number.

### Filter 1 — one-shot rAF vs self-recursive loop

Of the 166: **112 recursive**, **54 one-shot**.

The 54 are FLIP / transition-commit patterns — a single frame of delay so the
browser commits a "from" style before the "to" style is written. They have zero
background cost and are **not** defects. Verified by reading them, including
every one that calls `cancelAnimationFrame` (32 of the 54 do, purely to cancel
one pending frame in an effect cleanup — it does not imply a loop):

- `registry/core/lining-wear` — double `rAF(() => rAF(...))` around a FLIP transform.
- `registry/core/chart-bar-halftone:92` — `requestAnimationFrame(() => setEntered(true))`, cancelled in cleanup.
- `registry/core/dock-shelf-lean:134`, `registry/core/index-contour:517`,
  `registry/core/empty-state-sonar:192`, `registry/core/stem-and-leaf-live:235`,
  `registry/loud/toast-newton-cradle:369` — all "force reflow, then transition on the next frame".

### Filter 2 — does the recursive loop actually run forever?

The 112 recursive loops split by whether the re-request is conditional:

| sub-bucket | count | meaning |
|---|---|---|
| **unconditional re-request** | **52** | runs every frame from mount to unmount. Defect. |
| guarded by a lifecycle flag only | **4** | flag is only cleared at unmount, so also perpetual. Defect. |
| guarded by an interaction/settle state | 37 | genuinely idles at rest. Not a defect. |
| guarded by a finite progress term | 19 | terminates when the animation ends. Not a defect. |

**Published defect count for this bucket: 56 components run a perpetual rAF
loop with no IntersectionObserver and no `visibilitychange` handler.**

Examples, one per sub-bucket, so the classification can be checked:

- **Unconditional (defect)** — `registry/core/grazing-light:206-210`:
  ```
  const loop = () => { tick({ idleAngleDeg: idleAngleAt(...), pointer }); raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop);
  ```
  No condition anywhere. Also `registry/core/loader-spirograph-trace:158-165`
  (indeterminate spinner, `% 1` sweep, never ends) and
  `registry/core/ticker-teleprinter:152`.
- **Lifecycle-flag-guarded (defect)** — `registry/core/confirm-slide-shatter`
  (`if (alive)`), `registry/core/compare-crack-seam` (`alive`),
  `registry/core/stat-tile-ascii-arrive` (`!done`), `registry/core/confirm-hold-wax`.
- **State-gated (not a defect)** — `registry/core/sparkline-automaton:365-372`:
  ```
  if (active()) { raf = requestAnimationFrame(loop); }
  else { raf = 0; last = 0; draw(now); }   // genuinely idle: no rAF at rest
  ```
  Also `toc-minimap-mercury` (`settled`), `progress-narrated` (`busy`),
  `pin-register` (`!settled || (drag && drag.active)`).
- **Finite (not a defect)** — `registry/core/chain-scale`, `slider-vernier`,
  `progress-hatch`, `meter-quota-rule` — all `if (t < 1)` / `if (p < 1)`.

Full list of the 52 unconditional loops:

```
loader-spirograph-trace, toast-gravity-stack, ticker-tape-splice, rack-seat,
hero-ascii-wordmark, grazing-light, slider-range-shear, ticker-teleprinter,
tabs-carriage, confirm-dial-align, keymap-ascii-heat, tabs-notch-tenon,
banner-tear-stub, checkbox-domino-run, nav-condense-rail, refresh-pull-flywheel,
network-packet-trace, brass-check, patchbay-ascii-cable, progress-telegraph-log,
loader-braille, ring-stain, tonearm-skate, zipper-stall, voice-recorder-meter,
footer-ascii-rule, tag-input-tear, back-bearing, bowditch-close, file-upload-seal,
hachure-fall, cambium-lay, router-tier-cascade, leaven-crest-fall,
marquee-ticker-glyph, text-ekg-baseline, feed-escapement, background-ascii-dither,
mull-hinge, background-ascii-wake, pole-shy, passing-loop, press-register,
hero-letterpress-lockup, rapid-wire, ascii-engraving-contour, success-plumb-bob,
curtain-austrian-gather, curtain-traveler-draw, gallery-gantry-track,
scroll-defrost, curtain-tab-diagonal
```

### Filter 2b — IntersectionObserver as a pause path vs a reveal trigger

An observer that only flips an entrance state is not a pause path, so a
component can be in the "has IntersectionObserver" bucket and still be
undefended. Classification rule: the observer counts as a **pause path** if its
callback calls `requestAnimationFrame`/`cancelAnimationFrame`, or assigns a
value that is read inside the loop function's body.

Of the 60 IO-only components, **58 are real pause paths** and 2 are not:

- **Pause path** — `registry/core/blast-hole-delay-sequence:177-182` and
  `registry/core/facer-stamp-flip:303-306` both do
  `visible = entries[0]?.isIntersecting ?? true;` where `visible` is read by
  the loop. `registry/core/tendril-cast:515-518` goes further and restarts the
  loop on re-entry (`if (visible && !reducedQuery.matches && !raf) startLive()`).
- **Not a pause path** — `registry/core/listbox-sticky-groups:246` (a sticky
  header "has this group scrolled past" detector feeding `setArrived`) and
  `registry/core/scroll-caliper`. Both also run a recursive loop, so they belong
  with the undefended set.

Of the 128 "both" components, 31 have an IntersectionObserver that is a reveal
trigger rather than a pause path — but all 31 still have a `visibilitychange`
handler, so they are defended against the tab-hidden case and only undefended
against the scrolled-out-of-view case.

### Headline

**58 components** (56 from the "neither" bucket + `listbox-sticky-groups` and
`scroll-caliper`) ship a perpetual `requestAnimationFrame` loop with **no
visibility defense of any kind**. A consumer who installs one of these gets a
loop that burns a frame callback every 16ms for as long as the component is
mounted, regardless of whether it is on screen.

A further **31** are defended against a hidden tab but not against being
scrolled out of view.

