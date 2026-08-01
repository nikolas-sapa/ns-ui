---
name: tailwind_outline_none_focus_visible_trap
desc: Never pair base `outline-none` with `focus-visible:outline-<n>` on the same element in Tailwind v4 — outline-none sets --tw-outline-style:none, so the focus-visible width applies with style none, and the ring is invisible even though every class looks correct.
created: 2026-07-23T09:05:00Z
updated: 2026-07-23T09:05:00Z
---

# tailwind_outline_none_focus_visible_trap

Tailwind v4's `outline-none` utility sets `--tw-outline-style: none` as a CSS
custom property, not just `outline-style: none` directly. Because
`outline-style` itself is computed from that custom property, a *later*
`focus-visible:outline-<n>` utility only sets `--tw-outline-width`/color — the
style stays `none`, so the outline never paints even though `outline-2
outline-offset-2 outline-accent` all read correct in the DOM inspector.

This shipped in `switch-eclipse` (`className="... outline-none ...
focus-visible:outline-2 focus-visible:outline-offset-2
focus-visible:outline-accent"`) and failed `scripts/verify.ts`'s
"keyboard focus renders no visible focus state" check — the unfocused/focus
screenshots byte-compared identical because there was genuinely no visible
ring, not a screenshot-timing issue.

Rule of thumb: if you want a focus-visible-only ring, don't add a base
`outline-none` at all — just the `focus-visible:outline-*` utilities alone are
enough, since there's no default outline to suppress on a `<button>` styled
with `border`/`background` utilities in the first place. Only reach for
`outline-none` when you are not also using any `focus-visible:outline-*`
utility on that same element (e.g. you're building your own focus treatment
entirely out of `box-shadow` or `ring-*` instead).
