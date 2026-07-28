---
name: verify_goto_timeout_render_cost
desc: verify.ts page.goto uses waitUntil networkidle with a 30s cap, and a dev-mode preview page already takes ~15-25s to settle in headless Chromium (7MB+ dev chunks, software rendering) — a demo that does heavy load-time render work (many 3D-transformed layers, CSS filters, large data-URL textures, constant replay loops) tips past 30s and fails with "page.goto: Timeout". Fix the demo's render cost, not the gate.
tags: []
sources: []
created: 2026-07-28T16:20:53Z
updated: 2026-07-28T16:20:53Z
---

# verify_goto_timeout_render_cost

`scripts/verify.ts` navigates with
`page.goto(BASE_URL/preview/<name>, { waitUntil: "networkidle" })` and
Playwright's default 30s timeout. Against `next dev` this is much tighter than
it looks: even a *passing* preview page takes ~15-25s to reach networkidle in
headless Chromium, because the preview route pulls a ~7MB dev chunk for the
registry demo map and headless renders without GPU acceleration. The dev server
itself answers in ~1s (curl the route to confirm) — the time goes to chunk
eval + first render in the browser.

So the failure mode "verify FAILED: page.goto: Timeout 30000ms exceeded" on a
component whose route curls fine usually means the demo's load-time render cost
ate the remaining headroom, not that anything hangs. Costs that compound badly
under software rendering:

- many simultaneously composited layers (3D transforms, `preserve-3d`)
- per-element CSS `filter` (brightness/blur) on animated elements
- large data-URL textures repeated as background-image across many elements
- self-replaying animation loops that keep the main thread busy during load

Diagnosis recipe: a tiny Playwright probe that goes to the page with
`waitUntil: "load"`, logs timing, then `waitForLoadState("networkidle")` and
prints still-in-flight request URLs on timeout. Compare against a passing
sibling page to separate the shared dev-mode baseline from the component's own
excess.

Remedies, in order: shrink the demo's texture/layer count (strip count,
canvas size), lengthen replay intervals, defer the heavy start until after
first paint. Don't raise the gate timeout — the 30s ceiling is what keeps
registry demos honest about load cost.
