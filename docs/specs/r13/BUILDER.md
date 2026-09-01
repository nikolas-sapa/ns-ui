# Round 13 — builder contract

Read in this order: this file, `BRIEF.md`, `DECISIONS.md`, then YOUR spec file.
Then read the nearest existing component named in your spec's item 2, in full,
plus `registry/loud/weld-pool/` (component.tsx, demo.tsx, meta.json) as the
reference for house structure and for how a meta.json `instruction` is written.

## What you deliver — four files, one directory
`registry/<collection>/<slug>/` where `<collection>` is `core` or `loud` as your
spec states:

- `component.tsx` — the component. `"use client"`. Named export, PascalCase of
  the slug. Props with sensible defaults; every prop your spec names.
- `demo.tsx` — default-exported demo, named `<Slug>Demo`. This is what the card
  and `/preview/<slug>` render. It must show the component doing its thing at
  card scale with no props required.
- `meta.json` — `name`, `title`, `description`, `collection`, `tags[]`,
  `instruction`, `useWhen`, `dependencies: []`, and `autoplay` only if pointer
  motion is genuinely part of the identity. Copy weld-pool's shape exactly.
  `instruction` is a single dense paragraph carrying the real numbers from your
  spec — an agent must be able to rebuild the component from it alone.
  `useWhen` names the two nearest components and says when to pick them instead.
- `screenshots/` — leave the directory absent; the gate generates it.

## Hard rules (these are what fails review, not style)
- Zero colour literals anywhere, including GLSL and including fallbacks. Five
  tokens only, read via `getComputedStyle(document.documentElement)` and re-read
  on a `MutationObserver` watching documentElement's class.
- NO PAINT BEFORE THE FIRST TOKEN READ. Trace it on three paths specifically:
  rAF start, `ResizeObserver` fire, `IntersectionObserver` resume. Two agents in
  a previous round assumed no early-paint path existed and were wrong.
- `--ns-accent` is interaction chrome only — a real button, a focus ring. Never
  in a highlight, a beam, a pointer trail, or your component's climactic moment.
  Pointer highlights move in LUMINANCE only.
- `--border` is a ~1.1:1 separator in light theme. Invisible as a fill or stroke.
- Alive at rest: visibly different at t=0 / 2.5s / 5s with zero input, from
  unconditional self-animation. An `autoplay` descriptor does NOT count — the
  gate never fires it. If your spec's process finishes and stops, re-read
  DECISIONS.md D3.
- `prefers-reduced-motion: reduce` renders ONE composed still frame at your
  spec's named non-t0 STATIC_TIME, and that frame must be byte-stable over time.
- Derive geometry from the container's SMALLER dimension. The card is not a page.
- Canvas: `w-full h-full` or JS-set style dims; DPR-aware backing store capped at
  1.5 (full-bleed) or 2; `ResizeObserver` on the host element, not `window`;
  pause the rAF on `IntersectionObserver` offscreen AND `visibilitychange`;
  adaptive scale only after sustained measured slowness, never on device sniffing
  and never gated on frame count.
- Text over your surface needs a token scrim (`bg-background/70 backdrop-blur`),
  not bare type — measure contrast at the WORST frame of your loop.
- Placeholder copy only. Never invent prices, percentages, customer counts,
  guarantees, certification names, or quotes attributed to anyone.

## Process
- Edit files only. NO `git` of any kind. NO `npm run registry:build`. No deploys.
  The orchestrator holds the commit boundary and builds the registry per wave.
- Do not touch any file outside your own component directory. Every other
  builder in this wave is working in the same worktree at the same time.
- Verify by reading your own code and reasoning against the rules above. Do not
  start a dev server — Turbopack serves corrupted chunks under parallel load, and
  eleven other builders are running right now. The orchestrator runs the real
  verification against a production build after the wave.
- If, after reading the nearest existing component, you conclude yours is a
  restyle of it: STOP and say so. That is a success, not a failure. Two hero
  concepts died at spec stage on exactly this instruction last round.

## Report back
The four files you wrote, the three riskiest numbers you chose and why, anything
in your spec you could not honour and what you did instead, and your honest
answer to "is this a restyle of <nearest slug>".
