---
name: verify_screenshot_coverage_by_role
desc: verify.ts only auto-screenshots hover/press/focus/unfocused for the first visible button/a/[role=button] on the page — role=slider (and other roles) get none of those states, and stale screenshots from an earlier run aren't cleaned up automatically.
created: 2026-07-23T09:20:00Z
updated: 2026-07-23T09:20:00Z
---

# verify_screenshot_coverage_by_role

`scripts/verify.ts`'s interactive-state screenshot pass uses a narrow
locator — `page.locator("button, a, [role=button]").filter({visible:
true}).first()` — to decide what to hover/press/focus. If a component's
only interactive elements use a different role (`role="slider"`,
`role="tab"`, etc.), that locator matches nothing, `interactive.count()`
is 0, and verify silently skips the whole hover/press/unfocused/focus
block. You still get `default` screenshots (both themes) and the full
a11y audit (which uses a much broader control selector that does include
`role=slider`), but no interaction-state screenshots at all. This is
expected verify behavior, not a bug to work around — a slider-only
component (e.g. `time-picker-sundial`'s two dial rings) legitimately ends up with
just `dark-default.png`/`light-default.png` in its `screenshots/` folder.

**Gotcha:** `verify.ts` never clears a component's `screenshots/`
directory before a run — it only overwrites the files for whatever steps
it actually executes that run. If an earlier run genuinely had a matching
`button`/`a`/`[role=button]` element (for example, a transient real error
— a Next.js dev-overlay "N Issue(s)" indicator is itself a `<button>` and
can get picked up as "the interactive element" if it's the only visible
one at that moment), hover/press/focus/unfocused files get written then.
Fix the underlying issue and the locator later matches nothing again —
but the stale files from that earlier run are never deleted, so the
folder can end up showing an interaction state that has nothing to do
with the component's actual current behavior. If a verify run's screenshot
count doesn't match what you expect (extra hover/press/focus files for a
slider/tab/no-button component), delete the stale files and rerun rather
than trusting whatever's sitting in the folder.
