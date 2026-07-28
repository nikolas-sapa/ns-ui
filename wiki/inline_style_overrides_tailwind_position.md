---
name: inline_style_overrides_tailwind_position
desc: A component-scoped <style> rule at equal specificity beats Tailwind utilities by source order — never re-declare position (or other box-critical props) on an element that already carries a Tailwind position utility; an absolute inset-0 wrapper silently flipped to relative collapses to height 0 when all its children are absolute.
tags: []
sources: []
created: 2026-07-28T16:20:53Z
updated: 2026-07-28T16:20:53Z
---

# inline_style_overrides_tailwind_position

Components in this registry often ship a scoped stylesheet via an inline
`<style>{CSS}</style>` tag. That stylesheet is injected into the document
AFTER Tailwind's, so any rule with the same specificity as a Tailwind utility
(single class = 0-1-0) wins by source order.

The trap: adding `position:relative` to a state class (e.g. to anchor a
`::after` overlay) on an element that already has Tailwind `absolute inset-0`.
The moment the state class is applied, the element computes `position:relative`
— and a relative element whose children are all absolutely positioned collapses
to `height: 0`. `inset-0` stays in computed style but does nothing under
`relative`. Everything inside disappears, with zero console errors and markup
that looks correct in devtools unless you check *computed* position.

This is especially nasty on delayed state classes (settle/sheen/entered):
the component renders fine for the first couple of seconds, then blanks when
the class lands — screenshots taken at different moments disagree, and a
verify hover-diff run can still pass off an unrelated button.

Rules:

- In component CSS, never declare `position` (or display/inset/size) for an
  element that gets its positioning from Tailwind classes.
- A `::after`/`::before` overlay needs a *positioned* ancestor, not a
  *relative* one — `absolute` already qualifies; the extra `position:relative`
  is redundant at best and a collapse at worst.
- When a box is mysteriously invisible, check `getBoundingClientRect().height`
  and `getComputedStyle(el).position` before suspecting the paint code.
