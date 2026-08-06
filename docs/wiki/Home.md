# ns-ui wiki

ns-ui is a shadcn-compatible component registry. Components are installed by
URL with the `shadcn` CLI; there is no `ns-ui` npm package to depend on and
nothing to keep in sync after install.

Live registry: <https://design.helpmarq.com>

## This wiki is hand-maintained

Almost everything else in this repo that states a number is generated.
`README.md` has its counts rewritten in place by `scripts/build-readme.ts`
(only the text between `<!-- generated:NAME start -->` / `<!-- ... end -->`
markers), `public/llms.txt` is regenerated wholesale, `/status` reads
`lib/status.generated.json`, which is measured at build time.

**The wiki is none of those things.** Nothing regenerates these pages and no
gate checks them. Any figure here is a hand-copied snapshot of the repo at the
time of writing, and will rot silently. Where a number matters, this wiki says
where to re-derive it rather than only quoting it.

Numbers quoted below were derived on 2026-08-05 from `registry.json` at commit
`cadbed47`:

```
node -e "const r=require('./registry.json');const c=r.items.filter(i=>i.meta.collection==='core').length;console.log(r.items.length,c,r.items.length-c)"
# 298 246 52
```

298 components total: 246 in the `core` collection, 52 in `loud`.

## How the pieces fit

| Piece | Where | What it is |
|---|---|---|
| Component sources | `registry/core/**`, `registry/loud/**` | One folder per component: `component.tsx`, `demo.tsx`, `meta.json`, `screenshots/`. |
| The site | `app/**` | Next.js app that renders the catalog, per-component pages, `/preview/<name>` screenshot fixtures, `/status`, and the account/submission surfaces. Deployed to `design.helpmarq.com`. |
| The registry payloads | `registry.json`, `public/r/**` | The shadcn registry index and per-component install payloads. Generated. |
| Agent-facing text | `public/llms.txt`, `public/llms-full.txt` | The catalog as plain text for models. Generated. |
| MCP server | `mcp/` | `@nikolas.sapa/ns-ui-mcp`, stdio transport. Ships an offline snapshot of the registry so it works without the repo. |
| CLI | `cli/` | `@nikolas.sapa/ns-ui`. `search` / `list` / `info` / `categories` / `add`. Fetches live, falls back to a bundled index. |
| Convex backend | `convex/` | Accounts, saved library, submissions, testimonials, and the recorded uptime history behind `/status`. |

The registry payloads, the agent-facing text, the MCP snapshot and the CLI
index are all generated from the same `meta.json` sidecars by one command.
See [Architecture](Architecture).

## Where to go next

- [Installing a component](Installing-a-component) — prerequisites and the CSS token contract.
- [Architecture](Architecture) — what is generated, from what, and why generated files are never hand-edited.
- [Quality gates](Quality-gates) — the five gate scripts and how to run them.
- [Authoring a component](Authoring-a-component) — the shape of a component folder, and what the canonical docs cover.
- [Deployment](Deployment) — how Vercel builds the site and the Convex deployment together.

## Canonical docs in the repo

The wiki does not restate these. Read them for the authoritative version:

- [`README.md`](https://github.com/nikolas-sapa/ns-ui/blob/main/README.md) — front page, install, the gate, local run.
- [`CONTRIBUTING.md`](https://github.com/nikolas-sapa/ns-ui/blob/main/CONTRIBUTING.md) — setup, adding a component, PR and DCO sign-off requirements.
- [`AGENTS.md`](https://github.com/nikolas-sapa/ns-ui/blob/main/AGENTS.md) — the working contract for agents editing this repo: `meta.json` authority, autoplay descriptors, `useWhen`, the token rule, the verify gate.
- [`SECURITY.md`](https://github.com/nikolas-sapa/ns-ui/blob/main/SECURITY.md), [`CODE_OF_CONDUCT.md`](https://github.com/nikolas-sapa/ns-ui/blob/main/CODE_OF_CONDUCT.md), [`CHANGELOG.md`](https://github.com/nikolas-sapa/ns-ui/blob/main/CHANGELOG.md).

`AGENTS.md` used to carry two stale figures of its own (a hand-typed `core`/`loud`
split, and a claim that `public/llms.txt` was not gitignored when it is) — both
were fixed to point at the generated source instead of a number. Prefer
`registry.json` and `.gitignore` over any prose count, including the ones on
this page: a hand-typed figure anywhere in this repo is a snapshot, not a
contract, and will be wrong again eventually.
