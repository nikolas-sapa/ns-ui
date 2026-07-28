---
name: svg_ssr_trig_hydration_mismatch
desc: Raw Math.cos/sin output baked into SVG coordinates can hydration-mismatch between server and client — round to a fixed precision before setting x/y/cx/cy/points.
created: 2026-07-23T09:20:00Z
updated: 2026-07-23T09:20:00Z
---

# svg_ssr_trig_hydration_mismatch

A component that computes SVG point coordinates from `Math.cos`/`Math.sin`
(dial ticks, radial layouts, polygon points, anything placed by angle) and
renders them straight into JSX attributes can hit a real Next.js hydration
error: *"A tree hydrated but some attributes of the server rendered HTML
didn't match the client properties."* Node's V8 and the browser's V8 can
disagree in the last bit or two of a trig result (e.g.
`28.904501176718135` server-side vs `28.904501176718128` client-side) —
close enough to be visually identical, far enough to fail React's string
diff on hydration since the raw float gets serialized into the SSR HTML.

This is a genuine console error, not a benign warning — `verify.ts`'s
console-error check fails on it. It only shows up on components that
actually use `Math.cos`/`Math.sin` (or similar) to place SVG geometry (e.g.
`gnomon-set`'s sundial dial); straight-line/grid layouts using plain
arithmetic never hit it.

**Fix:** round every computed coordinate to a fixed decimal precision (a
few decimals of pixel precision is plenty at typical component scales)
before it reaches JSX or a DOM write:

```ts
function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
function pointAt(angleDeg: number, r: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  return [round(cx + r * Math.cos(rad)), round(cy + r * Math.sin(rad))];
}
```

Rounding makes server and client output byte-identical regardless of the
underlying float's last-bit noise.
