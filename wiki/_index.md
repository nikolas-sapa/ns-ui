---
name: ns_ui
desc: Shared cross-node reference for the ns-ui registry — conventions, gotchas, and reusable patterns discovered while building components.
tags: []
sources: []
created: 2026-07-22T18:58:34Z
updated: 2026-07-28T16:20:53Z
---

# ns_ui

[[inline_style_overrides_tailwind_position|inline_style_overrides_tailwind_position]]: A component-scoped <style> rule at equal specificity beats Tailwind utilities by source order — never re-declare position (or other box-critical props) on an element that already carries a Tailwind position utility; an absolute inset-0 wrapper silently flipped to relative collapses to height 0 when all its children are absolute.

[[raf_negative_delta_first_frame|raf_negative_delta_first_frame]]: A rAF callback's timestamp can read marginally behind a performance.now() sample taken just before requestAnimationFrame was scheduled — clamp raw = now - lastSample to >= 0 or a fresh animation's first frame computes a tiny negative delta and poisons anything downstream (eased progress going negative, negative radii, etc).

[[svg_dasharray_non_scaling_stroke|svg_dasharray_non_scaling_stroke]]: Chromium ignores pathLength for stroke-dasharray when vectorEffect="non-scaling-stroke" is set — never combine them; use divs for straight indicator lines.

[[svg_group_transform_origin|svg_group_transform_origin]]: Never set transform-box: fill-box on an SVG <g> you're rotating around a hand-picked pivot with px transform-origin — it makes the origin ambiguous. Leave transform-box at its default (view-box) so px values map straight to your viewBox coordinates.

[[svg_ssr_trig_hydration_mismatch|svg_ssr_trig_hydration_mismatch]]: Raw Math.cos/sin output baked into SVG coordinates can hydration-mismatch between server and client — round to a fixed precision before setting x/y/cx/cy/points.

[[tailwind_outline_none_focus_visible_trap|tailwind_outline_none_focus_visible_trap]]: Never pair base `outline-none` with `focus-visible:outline-<n>` on the same element in Tailwind v4 — outline-none sets --tw-outline-style:none, so the focus-visible width applies with style none, and the ring is invisible even though every class looks correct.

[[verify_goto_timeout_render_cost|verify_goto_timeout_render_cost]]: verify.ts page.goto uses waitUntil networkidle with a 30s cap, and a dev-mode preview page already takes ~15-25s to settle in headless Chromium (7MB+ dev chunks, software rendering) — a demo that does heavy load-time render work (many 3D-transformed layers, CSS filters, large data-URL textures, constant replay loops) tips past 30s and fails with "page.goto: Timeout". Fix the demo's render cost, not the gate.

[[verify_hover_hits_element_center|verify_hover_hits_element_center]]: scripts/verify.ts hovers the geometric center of the first visible button/a/[role=button]. A hover effect computed from cursor position relative to the element (e.g. "tilt toward the cursor") must not evaluate to zero at dead-center, or the hover-vs-default pixel diff comes back identical and the gate hard-fails.

[[verify_screenshot_coverage_by_role|verify_screenshot_coverage_by_role]]: verify.ts only auto-screenshots hover/press/focus/unfocused for the first visible button/a/[role=button] on the page — role=slider (and other roles) get none of those states, and stale screenshots from an earlier run aren't cleaned up automatically.

***
