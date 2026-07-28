---
name: verify_hover_hits_element_center
desc: scripts/verify.ts hovers the geometric center of the first visible button/a/[role=button]. A hover effect computed from cursor position relative to the element (e.g. "tilt toward the cursor") must not evaluate to zero at dead-center, or the hover-vs-default pixel diff comes back identical and the gate hard-fails.
tags: [verify, testing, hover, gotcha]
sources: []
created: 2026-07-23T06:25:48Z
updated: 2026-07-23T06:25:48Z
---

# verify_hover_hits_element_center

`scripts/verify.ts`'s interaction pass does
`page.locator("button, a, [role=button]").filter({visible:true}).first().hover()`.
Playwright's default `.hover()` targets the element's bounding-box center —
not a random point, not the edge, always dead-center.

This is a trap for any hover effect whose magnitude is a function of cursor
position relative to the element — e.g. "tilt N degrees toward the cursor,"
computed as `offset = (clientX - centerX) / (width / 2)`. At the exact
center, `offset` is `0`, so a naive `tilt = offset * MAX_DEG` evaluates to
no visible change at all, and verify's hard-fail check
(`hover screenshot === default screenshot`) trips even though the hover
handler is legitimately wired up and works fine for a real user whose
cursor lands anywhere else.

Fix: clamp the magnitude away from exactly zero rather than letting it
scale linearly through the center — e.g.
`Math.max(0.5, Math.min(1, Math.abs(offset)))` times a fixed sign — so a
cursor-relative effect still produces a guaranteed, visible pixel change
even for a synthetic hover that lands precisely on center. Real
implementation: `registry/core/clapper-bell/component.tsx`'s
`onPointerMove`.
