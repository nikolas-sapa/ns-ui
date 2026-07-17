# Tickets: ns-ui v1 — registry + first two components

Builds the ns-ui component registry per `docs/superpowers/specs/2026-07-17-component-library-design.md`: walking skeleton, quality gate, glass-button, particle-hero, install story.

Work the **frontier**: any ticket whose blockers are all done. After ticket 2, tickets 3 and 4 can run in parallel; ticket 5 only needs ticket 1.

## Walking skeleton: preview site + registry pipeline

**What to build:** A running Next.js preview site where visiting a component's preview page renders its demo full-bleed, and the registry build emits an installable JSON payload for every registered component. Seeded with a minimal real `core/glass-button` component (registered, rendering, with its metadata sidecar) so the whole pipe is proven end to end.

**Blocked by:** None — can start immediately.

- [x] Preview page renders the seed component's demo full-bleed in dark mode with Geist fonts
- [x] Registry build completes and emits an installable JSON payload for the seed component
- [x] Metadata sidecar (name, collection, tags, instruction, dependencies) exists for the seed and is included in the build
- [x] Repo runs from clean clone: install → dev server → preview page works

## Quality gate: automated verify

**What to build:** A verify script that renders every registered component's preview page headlessly, captures screenshots across states (default, hover, mid-scroll where applicable) and themes (dark, and light where applicable), hard-fails on any console error or blank render, and validates every metadata sidecar for required fields. Screenshots land in the component's folder.

**Blocked by:** Walking skeleton.

- [x] Verify passes on the seed component and writes its screenshots into the component folder
- [x] A console error or blank render makes verify exit non-zero
- [x] A metadata sidecar missing a required field makes verify exit non-zero

## Glass-button to the bar

**What to build:** The seed glass-button taken from minimal to done: liquid-glass surface (translucency, refraction/blur, thin borders), distinct hover/press/focus states with physics-based motion, dark + light themes, in Geist DNA. Done means it passes verify and survives the screenshot-judge loop at component-library polish level.

**Blocked by:** Quality gate.

- [x] Passes verify with committed screenshots (all states × both themes)
- [x] Hover/press/focus states are distinct and animated with physics-based easing
- [x] Judge loop completed — final screenshots hold up against Aceternity/Magic UI-level reference
- [x] Accessible: keyboard focus visible, works as a real button

## particle-hero (flagship)

**What to build:** A Geist-dark full-viewport hero section: WebGL particle/dot field that reacts to cursor movement, staggered headline/subline reveal, one CTA (the glass-button once available, otherwise a plain styled button). Runs at 60fps on a laptop, degrades gracefully without WebGL, passes the full gate.

**Blocked by:** Quality gate. (Parallel with glass-button.)

- [x] Particle field visibly reacts to cursor; smooth on a laptop (no jank at 1440p)
- [x] Staggered text reveal on load with physics-based easing; CTA present
- [x] Renders a usable static fallback when WebGL is unavailable
- [x] Passes verify with committed screenshots; judge loop completed against Vercel/Linear-level reference

## Install story end-to-end

**What to build:** From a separate scratch project, one shadcn CLI add command pointing at the local registry drops the component's source files and installs its npm dependencies, producing a working component. A README quickstart documents run, verify, add-a-component, and install flows.

**Blocked by:** Walking skeleton.

- [x] Fresh scratch project: one CLI add command → component source lands + deps install → component renders
- [x] README quickstart covers: run dev, run verify, add new component, install into another project
