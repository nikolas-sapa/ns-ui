# ns-ui

[![License: MIT](https://img.shields.io/badge/license-MIT-0B0B0D?style=flat-square&labelColor=0B0B0D&color=0B0B0D)](LICENSE)
[![React 19](https://img.shields.io/badge/react-19-0B0B0D?style=flat-square&labelColor=0B0B0D&color=0B0B0D)](package.json)
[![Tailwind v4](https://img.shields.io/badge/tailwind-v4-0B0B0D?style=flat-square&labelColor=0B0B0D&color=0B0B0D)](package.json)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-0B0B0D?style=flat-square&labelColor=0B0B0D&color=0B0B0D)](CONTRIBUTING.md)
[![Live registry](https://img.shields.io/badge/registry-design.helpmarq.com-0B0B0D?style=flat-square&labelColor=0B0B0D&color=0B0B0D)](https://design.helpmarq.com)
[![CI](https://github.com/nikolas-sapa/ns-ui/actions/workflows/ci.yml/badge.svg?style=flat-square)](https://github.com/nikolas-sapa/ns-ui/actions/workflows/ci.yml)

<!-- generated:count start -->534<!-- generated:count end --> React components you install by URL, no package to depend on. Every one is
built around a single interaction and gated by a Playwright suite that refuses
to pass a component whose hover looks identical to its resting state.

Two collections. `core` (<!-- generated:core start -->410<!-- generated:core end -->) is restrained and production-facing, Geist-dark.
`loud` (<!-- generated:loud start -->124<!-- generated:loud end -->) is a deliberately flashy showcase.

Browse them live at **[design.helpmarq.com](https://design.helpmarq.com)**.

|  |  |
|---|---|
| ![hero-particles-webgl](https://raw.githubusercontent.com/nikolas-sapa/ns-ui/main/registry/core/hero-particles-webgl/screenshots/dark-default.png) | ![hero-isobar-contours](https://raw.githubusercontent.com/nikolas-sapa/ns-ui/main/registry/loud/hero-isobar-contours/screenshots/dark-default.png) |
| **hero-particles-webgl** — a field that answers the cursor | **hero-isobar-contours** — contour lines that bunch toward the CTA |
| ![gallery-coverflow-caustic](https://raw.githubusercontent.com/nikolas-sapa/ns-ui/main/registry/core/gallery-coverflow-caustic/screenshots/dark-default.png) | ![picker-pareto-frontier](https://raw.githubusercontent.com/nikolas-sapa/ns-ui/main/registry/core/picker-pareto-frontier/screenshots/dark-default.png) |
| **gallery-coverflow-caustic** — drag to scrub, flick for momentum | **picker-pareto-frontier** — pick a point on a pareto frontier |
| ![compare-crack-seam](https://raw.githubusercontent.com/nikolas-sapa/ns-ui/main/registry/core/compare-crack-seam/screenshots/dark-default.png) | ![not-found-knockout](https://raw.githubusercontent.com/nikolas-sapa/ns-ui/main/registry/loud/not-found-knockout/screenshots/dark-default.png) |
| **compare-crack-seam** — the before/after divider is a fracture | **not-found-knockout** — type carved out of the surface |

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
npx shadcn add https://design.helpmarq.com/r/gallery-coverflow-caustic.json
```

## For agents

```
GET https://design.helpmarq.com/llms.txt
```

One fetch returns the whole catalog as plain text: every component, its props,
the situation it suits, and its exact install command. No tool definitions, no
pagination. An agent that can make an HTTP request can pick the right
component and install it in two steps.

`llms-full.txt` at the same origin adds the full behavioral description per
component, hand-written rather than derived from tags, for the cases where
several components share a UI role and a model has to tell them apart.

`/registry.json` serves the standard shadcn registry index for tools that
expect it.

Prefer tools over a one-time fetch (an agent working across a whole session,
not just picking one component up front)? **[`mcp/`](mcp/)** is an MCP server
over the same catalog — `search_components`, `get_component` (full prop
signature + real source), `list_categories`, `install_command`, and
`get_conventions` (the token/theming contract). `npx -y @nikolas.sapa/ns-ui-mcp`,
stdio transport, per-client config at
**[design.helpmarq.com/connect](https://design.helpmarq.com/connect)** or
[`mcp/README.md`](mcp/README.md).

There's also a thin CLI, **[`cli/`](cli/)** (`@nikolas.sapa/ns-ui`): `npx
@nikolas.sapa/ns-ui add <name>` installs a component, `search`/`list`/`info`/
`categories` cover the rest of the catalog from a terminal. See
[`cli/README.md`](cli/README.md).

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
npm run dev            # / lists components, /components/<name> renders one
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

## Saved library

Signed-in users can bookmark components from the catalog. The account's Saved
view shows working interactive previews, copyable install commands, and private
folders for organizing saves. See [`docs/saved-library.md`](docs/saved-library.md).

## License

MIT. See [LICENSE](LICENSE).
