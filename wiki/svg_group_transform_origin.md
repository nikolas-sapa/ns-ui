---
name: svg_group_transform_origin
desc: Never set transform-box: fill-box on an SVG <g> you're rotating around a hand-picked pivot with px transform-origin — it makes the origin ambiguous. Leave transform-box at its default (view-box) so px values map straight to your viewBox coordinates.
tags: [svg, css, transform]
sources: []
created: 2026-07-23T06:25:48Z
updated: 2026-07-23T06:25:48Z
---

# svg_group_transform_origin

When a component rotates an SVG `<g>` around a specific hinge/pivot point
(a hasp swinging off a staple, a bell's clapper/body recoiling around an
anchor), the natural way to express that pivot is `transform-origin: <x>px
<y>px` matching coordinates already used in the `viewBox` and child paths.

That only works cleanly if `transform-box` is left at its browser default
for SVG children, which resolves `transform-origin` px values against the
nearest SVG viewport's own coordinate system — i.e. your viewBox units,
directly. Adding `transform-box: fill-box` (a habit carried over from HTML
transforms, where fill-box doesn't apply) changes what those px values are
measured against to the element's own bounding box, which does not line up
with viewBox coordinates and makes hand-picked pivots land in the wrong
place — hinge points drift off from where the artwork implies they should
be, subtly enough to not throw any error, just look slightly wrong.

Fix: don't set `transform-box` on rotating SVG groups at all. Pick the
pivot's viewBox coordinates directly (e.g. the center of a hinge circle
already drawn at `cx=8 cy=4.5`) and use those same numbers verbatim in
`transform-origin`.
