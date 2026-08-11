# The showpiece recipe

What actually got approved, distilled into a build recipe for future agents making full-bleed `loud` WebGL showpieces. Written 2026-08-11 after two 10-component ideation batches (17 of 20 rejected) failed, and three full-bleed showpieces (weld-pool, dye-whorl, flyback-tear) all shipped clean on first owner review. Reference implementation to read before starting anything: `registry/loud/weld-pool/component.tsx`.

## The two taste filters

Both must pass before mechanism, reference pull, or craft matter at all — a technically perfect component that fails either filter is still a reject.

**Filter 1 — name the product surface it replaces.** Hero, background, divider, card, nav, loader, empty state, feedback moment, pricing element, gallery, testimonial, footer. If the honest answer is "a settings screen", "an internal dashboard", or "a developer tool", it is an automatic reject, however clever the mechanism. Two batches of gate-green, accessible, technically excellent components (hex viewer, regex tester, cron editor, shortcut recorder, code annotator, SRE threshold config, admin table) died on this filter alone.

**Filter 2 — alive at rest and striking at first glance.** A static bordered grey card is an automatic reject. Subtle and tasteful is a failure for a showpiece — something must move, breathe, drift, or settle before the user touches anything. This is the filter batch 2 still missed 4/10 times even after batch 1's Filter 1 lesson was applied up front: components claimed aliveness convincingly in prose but rendered dead or below the perceptual floor. See Verification below for how to actually check this before shipping.

## Source ideas from real reference, not model invention

Do not let an ideation model invent a category answer. Two prior builds — `footing-course` (footer) and `gel-wash` (preloader/route curtain) — were built, passed the gate, and then removed specifically for "inventing a house-style answer to a category instead of reading real mechanics." Same failure mode as the two rejected ideation batches, already on record before this session.

`weld-pool` is the positive counter-example and the reason to trust this pattern: it did not come from a model ideating a concept. `docs/21st-bookmarks.md` had flagged a liquid-metal full-bleed hero as the single biggest unbuilt gap **three separate times** in the repo's own recorded thinking, before this build ever started. `dye-whorl` and `flyback-tear` extended that proven pattern (full-bleed WebGL, monochrome-derived value ramp, embossed/inline typography) into adjacent physical processes (ink diffusion, CRT signal loss) rather than inventing a fresh category cold.

**Rule: before ideating a showpiece, grep the repo's own docs (`docs/21st-bookmarks.md`, `docs/component-backlog.md`) for a gap that's already been named more than once. Build the named gap. Don't invent a new one.**

## The monochrome constraint — a design problem to solve, not dodge

Colors come only from `--background`, `--foreground`, `--ns-muted`, `--border`, `--ns-accent`, read via `getComputedStyle(document.documentElement)` at mount and re-read on a `MutationObserver` watching `documentElement`'s class. No literals anywhere, including inside shader/GLSL source — every color a shader touches is a uniform fed from the same five tokens.

Every cue that would normally be carried by hue must be carried by value (luminance) instead. Three worked examples:

- **weld-pool (metal):** luminance ramp + specular highlights + a surface normal derived from a single height field. Density is bought by giving the *environment* structure (five light sources at different elevations/azimuths) rather than piling more noise into the material — an almost-flat patch of surface still crosses 3-4 reflection bands, which is what makes chrome read as chrome without ever touching hue.
- **flyback-tear (CRT):** luminance and scanline structure only — explicitly no green phosphor tint, no RGB channel split. The failing-signal read comes from structure (tear, roll, sync loss), not from a colored gimmick.
- **dye-whorl (ink):** density and edge structure, inverted between themes rather than re-hued — dark ink in light water reads as one thing, and the same density field has to read as the *inverse* relationship in dark theme without becoming a literal color swap.

**Light theme is the harder case.** A full-bleed sheet full-bleeds the page in both themes (unlike a thin metal band on a page, which can invert). weld-pool's five luminance stops span near-black to near-white in *both* themes — what moves between themes is bias and contrast, not direction. Check light theme early in the build, not as a final pass; it is where value-only readability actually breaks.

## Three hard-won interaction/perf lessons

**(a) Lead-compensate the pointer follower, don't just smooth it.** A plain exponential follower has steady-state error of exactly `velocity * tau` under constant velocity — at 700px/s and a 12ms tau that's 24.5px behind the real cursor. The eye reads this as the surface not responding, which is a worse fault than the jitter the smoothing was meant to fix. weld-pool cancels this by extrapolating the pointer target one `tau` ahead in the rAF loop (`ptrX += (tgtX + leadX - ptrX) * k`, where `leadX = velX * POINTER_TAU`), so at constant velocity the head sits exactly on the cursor and the smoothing budget is spent only on direction changes. **Name this explicitly when documenting the fix: the naive smoothing fix is what caused the lag bug it looks like it should have prevented.**

**(b) Deposit/update rate must match the 60Hz display, not the pointer event rate.** weld-pool's wake was originally sampled at a fixed pixel-distance threshold (26px), which at 700px/s only crossed once every ~2.2 frames — a 20Hz wake under a 60Hz page. It read as lag despite a flat 16.7ms frame time; nothing was dropping frames, the deposit cadence itself was too coarse. Fixed by halving the spacing (13px, ~1/frame) and adding a time-ceiling fallback (`SAMPLE_MAX_GAP`) so the deposit is bound by whichever is tighter — distance or elapsed time — instead of distance alone.

**(c) Measure frame time with a `readPixels` fence, never `gl.finish()`.** `gl.finish()` is a no-op under ANGLE/Metal (the actual GPU work is still async), so a naive benchmark built on it reads 0.00ms and tells you nothing. When the owner reported weld-pool as "laggy," a proper fence measurement showed a flat 16.7ms frame time with the shader itself costing ~7% of the 60Hz budget (~1.1ms on an M3 at 2880x1800) — the instinct to cap DPR or cut shader complexity would have fixed nothing, because the shader was never the bottleneck. **Measure before optimising. A named lag complaint is not evidence the expensive part is the cause.**

## Verification that actually catches "alive at rest"

`scripts/verify.ts` loads `/preview/<name>` with **no** `embed`/`autoplay` params. Any `autoplay`-mode descriptor does not fire in the graded screenshots — only genuine, unconditional self-animation (a CSS `infinite` keyframe or an always-running rAF loop) counts toward Filter 2. Batch 2 lost two components (`seam-gild`, `starch-shear`) exactly this way: strong mechanism, zero idle keyframes, gate saw a dead frame.

The actual check: capture screenshots at t=0s, t=2.5s, t=5s and confirm they visibly differ (proves genuine self-animation, not a static frame). Then capture under `prefers-reduced-motion: reduce` and confirm those frames are byte-stable across time (proves the reduced-motion path is actually static, not just slower). Both checks are cheap and both catch real defects the automated gate alone misses.

## Standard canvas host checklist

Every full-bleed WebGL showpiece needs, unconditionally:

- DPR-aware backing store sizing, capped (weld-pool caps at 1.5, not the usual 2 — full-bleed area cost dominates, and 1.5 holds frame rate on a 1440x900 hero without visible specular loss).
- `ResizeObserver` on the host element, not `window.resize` — catches layout-driven resizes (sidebar toggle, flex reflow) that never fire a window event.
- Pause the render loop when scrolled offscreen (`IntersectionObserver`, threshold 0) and when the tab is hidden (`visibilitychange`) — a full-bleed shader running offscreen is the most expensive idle thing a page can carry.
- `prefers-reduced-motion: reduce` freezes the clock on a deliberately-chosen static frame (not `t=0`) that already shows the component's key state (weld-pool freezes at `STATIC_TIME = 6.4` so lobes are spread and a specular hit sits on the headline).
- Adaptive render scale that engages **only after frames actually go slow** — track frame time as an EMA, step down only after a sustained stretch (weld-pool: ~900ms) over budget, step back up only after a much longer clean stretch, and double the wait after each failure. Never gate on frame count (a slow machine takes longer to hit N frames, which is backwards) and never step down pre-emptively on device heuristics — see lesson (c) above.
