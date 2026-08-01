# ns-ui — Personal Component Registry

**Date:** 2026-07-17
**Status:** Approved (design), pre-implementation
**Name:** `ns-ui` (working name; rename allowed before public stage)

## Purpose

Own library of high-craft "wow" components (heroes, animated backgrounds, effects), built one component at a time. Three staged uses:

1. **Now — personal kit:** drop components into client/personal projects.
2. **Later — AI corpus:** each component's metadata + screenshots become RAG/fine-tuning data (see session research: curated small corpus beats scraped scale).
3. **Maybe — public product:** deploy preview site → it becomes the docs site + registry endpoint.

Stages 2 and 3 require zero rework; they consume artifacts stage 1 already produces.

## Aesthetic identity

Two collections:

- **`core`** — Geist-dark restraint (Vercel/Linear school). Follows global design DNA: `#0a0a0a` base, Geist Sans/Mono, blue `#006bff` accent used sparingly, no gradient washes. Wow via craft: shader/particle motion, typography, timing.
- **`loud`** — flashy showcase (Aceternity school): auroras, glows, gradients. Explicitly exempt from the no-gradient-background rule; the exemption applies only inside this collection.

## Architecture

Single repo, shadcn registry model (components distributed as copy-paste source via the shadcn CLI, not an npm package).

```
ns-ui/
  app/                      # Next.js preview site (App Router)
    preview/[name]/page.tsx # full-bleed render of one component (screenshot target)
  registry/
    core/<component>/
    loud/<component>/
      component.tsx         # the component (self-contained)
      demo.tsx              # usage demo rendered by preview page
      meta.json             # name, collection, tags, natural-language instruction, npm deps
  registry.json             # shadcn registry index
  scripts/verify.ts         # Playwright quality gate
  docs/superpowers/specs/   # this spec + future specs
```

**Stack:** Next.js (latest, App Router) · TypeScript · Tailwind v4 · Motion (framer-motion successor) · three + @react-three/fiber (+ drei) for shader/particle components. `npx shadcn build` compiles `registry.json` → `public/r/*.json` installable payloads. No custom build tooling.

**meta.json shape (fixed):**
```json
{
  "name": "hero-particles-webgl",
  "title": "Hero Particles WEBGL",
  "description": "Full-viewport hero with a cursor-reactive WebGL particle field.",
  "collection": "core",
  "tags": ["hero", "webgl", "particles"],
  "instruction": "A dark hero section with a WebGL particle field that reacts to cursor movement and staggered headline reveal.",
  "dependencies": ["three", "@react-three/fiber", "motion"]
}
```
`instruction` is written as the prompt that *should* produce this component — that is the future SFT/RAG pair. meta.json is the single source of truth: `scripts/build-registry.ts` generates `registry.json` from the sidecars (collection/tags/instruction ride along in each item's `meta` field) and runs `shadcn build`. `public/r/` is generated output, not committed.

## Quality gate

A component is **done** only when:

1. `scripts/verify.ts` passes: Playwright renders `/preview/<name>`, captures screenshots across states (default, hover, mid-scroll) × themes (dark, light where applicable); **fails on any console error or blank render**.
2. Screenshot-judge loop completed: render → screenshot → critique against reference standard (Aceternity/Codrops-level bar) → iterate until it holds up.
3. Screenshots committed under the component folder (`screenshots/`) — doubles as corpus data.

## Taste profile (owner-stated, 2026-07-17)

Loved: shader/particle backgrounds · text & scroll choreography · 3D/interactive objects (tilt cards, cursor-following) · micro-craft (nice buttons, liquid glass). NOT drawn to aurora/glow gradient flash — so `core` is the primary collection; `loud` exists but is not the roadmap driver.

## Component #1

`core/hero-particles-webgl` — Geist-dark hero section: WebGL particle/dot field reacting to cursor (r3f), staggered text reveal (Motion), one CTA. Combines the owner's top two loved styles (shader background + text choreography); immediately usable in client work.

**Roadmap candidates after #1 (one at a time, each through the full gate, no batch scaffolding):** liquid-glass button set → 3D tilt card → scroll-story section → text scramble/morph headline.

## Install story

- After public deploy: `npx shadcn add <registry-url>/r/hero-particles-webgl.json` from any project.
- Until then: local registry URL (`http://localhost:3000/r/...`) or direct file copy.

## Out of scope (deliberately)

- npm packaging, versioning, changelogs
- Docs content beyond the preview pages
- AI corpus tooling (embedding, training pipelines) — sidecar files only for now
- Public deploy, domain, marketing
- Video/motion capture for the corpus (screenshots only until needed)

## Error handling & testing

Verification is the Playwright gate above (render errors, console errors, blank output). No unit-test suite for visual components — the render gate and screenshot judgment are the meaningful checks. `meta.json` validated for required fields by `verify.ts`.
