---
name: svg_dasharray_non_scaling_stroke
desc: Chromium ignores pathLength for stroke-dasharray when vectorEffect="non-scaling-stroke" is set — never combine them; use divs for straight indicator lines.
created: 2026-07-22T19:22:28Z
updated: 2026-07-22T19:22:36Z
---

# svg_dasharray_non_scaling_stroke

Combining `pathLength={1}` (normalized dash math) with
`vectorEffect="non-scaling-stroke"` on the same `<path>` is a trap: Chromium
computes `stroke-dasharray`/`stroke-dashoffset` in *screen space* when
non-scaling-stroke is set, ignoring `pathLength` entirely. A normalized dash
window like `0.2 0.8` becomes meaningless — the painted segment lands at
arbitrary positions while every attribute reads "correct" in DevTools and in
code review. Four fix attempts on wizard-canal-lock's connector passed code review
and failed on screen because of exactly this.

Rules of thumb:

- Never pair `pathLength` with `vectorEffect="non-scaling-stroke"` when using
  dash-based windowing/progress tricks.
- If the shape is a straight line (progress tracks, steppers, underlines),
  skip SVG: two absolutely-positioned divs (full-width track + translated
  segment) do the same job with none of the coordinate-space pitfalls.
  Reference implementation: `registry/core/wizard-canal-lock/component.tsx`.
- Verify paint, not attributes: screenshot + pixel-sample in a real browser
  (see the pattern in the wizard-canal-lock fix — Playwright screenshot decoded via
  in-page canvas, no PNG dependency needed).
