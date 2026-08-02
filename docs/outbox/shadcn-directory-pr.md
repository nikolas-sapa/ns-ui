# shadcn registry directory PR — everything to submit

> **SUBMITTED 2026-08-02:** https://github.com/shadcn-ui/ui/pull/11362
> Branch `add-ns-ui-registry` on the fork `nikolas-sapa/ui`; single-entry diff to
> `apps/v4/registry/directory.json`. Their `validate-registries.mts` was run locally
> against the edited file and passed. The description shipped was shortened from the
> draft below to match the length of neighbouring entries:
> `"228 animated React components for Tailwind v4 and React 19, with a CLI and an MCP server."`

## Process (verified this session)

The current mechanism, per <https://ui.shadcn.com/docs/registry/registry-index> and the live repo:

1. Add one entry to `apps/v4/registry/directory.json` in `shadcn-ui/ui`.
2. Run `pnpm validate:registries` locally (it runs `tsx apps/v4/scripts/validate-registries.mts`).
3. Open a PR to <https://github.com/shadcn-ui/ui>. A GitHub Action (`.github/workflows/validate-registries.yml`) re-runs the validator on the PR, then the team reviews.

I fetched the real `directory.json` (264 entries), the validator script, and the workflow this session, so the requirements below are what the code actually enforces — which differs in two places from a from-memory description.

## What the validator actually checks (read from `validate-registries.mts`)

Each directory entry is validated against this Zod schema:

```
name:        string, regex /^@[a-zA-Z0-9][a-zA-Z0-9-_]*$/   // MUST start with "@"
homepage:    string, valid URL
url:         string, MUST contain the literal "{name}" placeholder
description: string
logo:        string                                          // REQUIRED
```

Two things to flag, because they are easy to get wrong:

- **`name` must be `@ns-ui`, not `ns-ui`.** The directory entry namespace is required to start with `@` — this is different from the `name: "ns-ui"` field inside our own `registry.json`, which is correct as-is and is a separate file. Do not change `registry.json`; only the directory entry gets the `@`.
- **`logo` is required** and every existing entry inlines an SVG string that uses `var(--foreground)` / `var(--background)` so it themes with the directory UI. Our `app/icon.svg` hardcodes `#0a0a0a`/`#ededed`, which would render wrong in the directory. A theme-aware version is inlined below.

The workflow also **blocks reserved namespaces**: `@shadcn,@ui,@blocks,@components,@block,@component,@util,@utils,@registry,@lib,@hook,@hooks,@theme,@themes,@chart,@charts`. `@ns-ui` is not on that list. I also confirmed `@ns-ui` is not already present in the directory (nearest neighbors are `@nordaun` and `@nteract`).

Note: the validator does **not** check the `files`/`content`/flat-structure rules — those apply to the registry your `url` serves and are checked by the team during review, not by this script. Our `registry.json` already satisfies them (verified: `$schema` is `https://ui.shadcn.com/schema/registry.json`, 228 flat items, `files[0]` has a `path` and no inline `content`), and `https://design.helpmarq.com/r/accordion-latch.json` returns HTTP 200 with a valid `registry-item.json`, so the served endpoint is live.

## The exact entry to add

Insert this object into `apps/v4/registry/directory.json`, in alphabetical position between `@nordaun` and `@nteract` (the file is ordered by `name`; ordering is a file convention, not something the validator enforces):

```json
  {
    "name": "@ns-ui",
    "homepage": "https://design.helpmarq.com",
    "url": "https://design.helpmarq.com/r/{name}.json",
    "description": "A registry of 228 crafted, animated React components built for Tailwind v4 and React 19, installable with the shadcn CLI and browsable through a first-party MCP server.",
    "logo": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='var(--background)'/><circle cx='16' cy='16' r='5' fill='none' stroke='var(--foreground)' stroke-width='2'/></svg>"
  }
```

Notes on the entry:
- `url` uses the required `{name}` placeholder and resolves to the same `/r/<name>.json` shape already serving live.
- `logo` is the project's `app/icon.svg` mark rewritten to use `var(--background)`/`var(--foreground)` so it themes correctly in the directory; single-quoted attributes so it embeds cleanly as a JSON string. (Kept inline here rather than written as a new asset, since this task is limited to `docs/outbox/`.)
- `author` is optional in the schema; omitted. Add `"author": "Nikolas Sapalidis"` (or preferred handle) if desired — some entries include it, and it will not fail validation.
- The `228` figure is the real item count in `registry.json` as of this session; update it if the registry has grown before you submit.

## Suggested PR description

> **Add @ns-ui to the registry directory**
>
> Adds `@ns-ui` — a public, MIT-licensed, open-source shadcn registry of 228 crafted, animated React components for Tailwind v4 and React 19.
>
> - Homepage: https://design.helpmarq.com
> - Registry URL: https://design.helpmarq.com/r/{name}.json (live, returns valid `registry-item.json`)
> - Source: https://github.com/nikolas-sapa/ns-ui (public, MIT)
>
> The registry is a flat registry conforming to `https://ui.shadcn.com/schema/registry.json`; no `content` fields in `files` arrays. `pnpm validate:registries` passes locally. The registry also ships a first-party MCP server (`@nikolas.sapa/ns-ui-mcp`) exposing the catalog as agent tools.

## Pre-submit checklist

- [ ] Repo is public and open source — confirmed this session: `https://github.com/nikolas-sapa/ns-ui` returns HTTP 200, `package.json` license is MIT.
- [ ] `name` is `@ns-ui` (with the `@`), not on the reserved list, not already in the directory.
- [ ] `url` contains `{name}`; endpoint returns 200.
- [ ] `logo` present and theme-aware.
- [ ] Entry placed in alphabetical order.
- [ ] `pnpm validate:registries` run locally and passing before opening the PR.
