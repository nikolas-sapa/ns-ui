# ns-ui

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Live registry](https://img.shields.io/badge/registry-design.helpmarq.com-006bff)](https://design.helpmarq.com)
[![CI](https://github.com/nikolas-sapa/ns-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/nikolas-sapa/ns-ui/actions/workflows/ci.yml)

218 React components you install by URL, no package to depend on. Every one is
built around a single interaction and gated by a Playwright suite that refuses
to pass a component whose hover looks identical to its resting state.

Two collections. `core` (183) is restrained and production-facing, Geist-dark.
`loud` (35) is a deliberately flashy showcase.

Browse them live at **[design.helpmarq.com](https://design.helpmarq.com)**.

|  |  |
|---|---|
| ![particle-hero](https://raw.githubusercontent.com/nikolas-sapa/ns-ui/main/registry/core/particle-hero/screenshots/dark-default.png) | ![pressure-front](https://raw.githubusercontent.com/nikolas-sapa/ns-ui/main/registry/loud/pressure-front/screenshots/dark-default.png) |
| **particle-hero** — a field that answers the cursor | **pressure-front** — contour lines that bunch toward the CTA |
| ![caustic-coverflow](https://raw.githubusercontent.com/nikolas-sapa/ns-ui/main/registry/core/caustic-coverflow/screenshots/dark-default.png) | ![ridge-walk](https://raw.githubusercontent.com/nikolas-sapa/ns-ui/main/registry/core/ridge-walk/screenshots/dark-default.png) |
| **caustic-coverflow** — drag to scrub, flick for momentum | **ridge-walk** — pick a point on a pareto frontier |
| ![crack-compare](https://raw.githubusercontent.com/nikolas-sapa/ns-ui/main/registry/core/crack-compare/screenshots/dark-default.png) | ![knockout-404](https://raw.githubusercontent.com/nikolas-sapa/ns-ui/main/registry/loud/knockout-404/screenshots/dark-default.png) |
| **crack-compare** — the before/after divider is a fracture | **knockout-404** — type carved out of the surface |

## Install

Any shadcn-configured project, zero config:

```bash
npx shadcn add https://design.helpmarq.com/r/<name>.json
```

That drops the source at `components/ui/<name>.tsx` and installs the
component's npm dependencies. There is no `ns-ui` package and nothing to keep
in sync. The code is yours to edit.

New project:

```bash
npx shadcn init -d
npx shadcn add https://design.helpmarq.com/r/caustic-coverflow.json
```

## For agents

```
GET https://design.helpmarq.com/llms.txt
```

One fetch returns the whole catalog as plain text: every component, its props,
the situation it suits, and its exact install command. No MCP server, no tool
definitions, no pagination. An agent that can make an HTTP request can pick the
right component and install it in two steps.

`llms-full.txt` at the same origin adds the full behavioral description per
component, hand-written rather than derived from tags, for the cases where
several components share a UI role and a model has to tell them apart.

`/registry.json` serves the standard shadcn registry index for tools that
expect it.

## The gate

`scripts/verify.ts` is why the registry stays small. It drives every component
through headless Chromium, screenshots each state against each theme, and
hard-fails on:

- a console error, or a blank render
- hover byte-identical to default, or focus identical to an unfocused baseline
  (an interaction that does not actually interact)
- dark and light byte-identical (a component that ignored the theme)
- an interactive control with no accessible name, `role=switch|checkbox|radio`
  without `aria-checked`, a visible dialog with no accessible name, or controls
  Tab cannot reach
- a popover or menu that opens but lands clipped invisible behind an ancestor's
  `overflow: hidden`, caught by hit-testing the opened element rather than
  measuring its box

The screenshots it produces are committed, so the claims above are auditable in
the repo rather than asserted here.

## Run it locally

```bash
npm install
npm run dev            # / lists components, /preview/<name> renders one
npm run verify         # the gate, in another shell, with dev running
```

Node 22.18 or newer.

### Environment variables

Copy `.env.example` to `.env` and fill in what you need. Everything is
optional locally — the app still runs and the email form still renders, it
just returns an error on submit if the EmailOctopus vars are unset.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_REGISTRY_ORIGIN` | Overrides the public origin install commands and `llms.txt` resolve against. Defaults to `https://design.helpmarq.com`. |
| `EMAILOCTOPUS_API_KEY` | Bearer key for the EmailOctopus v2 API, used by the email capture form (`lib/actions/subscribe.ts`). Server-only, never exposed to the client. |
| `EMAILOCTOPUS_LIST_ID` | The EmailOctopus list contacts are added to. |

Adding a component means creating a folder with
`component.tsx`, `demo.tsx` and `meta.json`; registration is automatic. See
[CONTRIBUTING.md](CONTRIBUTING.md), and [AGENTS.md](AGENTS.md) if you are an
agent working inside this repo.

## License

MIT. See [LICENSE](LICENSE).
