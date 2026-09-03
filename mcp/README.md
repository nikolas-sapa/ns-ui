# @nikolas.sapa/ns-ui-mcp

MCP server for the [ns-ui](https://design.helpmarq.com) component registry. Gives an
agent the whole catalog — search, prop signatures, real source, install commands, and
the design-token conventions the components are built against — as tools, so it stays
in context for the length of a session instead of being one fetch you did once.

If you just want the catalog as text, `https://design.helpmarq.com/llms.txt` still
works and needs nothing installed. This is for when you want it as tools your agent
can call repeatedly, mid-task, without you re-fetching or re-pasting anything.

## Setup

Add to your MCP client config (Claude Code, Cursor, or any client that speaks MCP over
stdio):

```json
{
  "mcpServers": {
    "ns-ui": {
      "command": "npx",
      "args": ["-y", "@nikolas.sapa/ns-ui-mcp"]
    }
  }
}
```

Claude Code specifically: `claude mcp add ns-ui -- npx -y @nikolas.sapa/ns-ui-mcp`.

See [design.helpmarq.com/connect](https://design.helpmarq.com/connect) for the config
shapes for Cursor, VS Code, Windsurf, Zed, Cline and Codex CLI, which differ from the
shape above.

Requires Node 18+ (`engines` in `package.json`).

## Checking it works

The server speaks JSON-RPC over stdio, newline-delimited, and prints nothing on its own.
A silent process is the healthy state, so "it launched" tells you nothing. Drive a real
handshake instead. In a scratch directory, not in this repo, so you do not add a
dependency to it:

```bash
mkdir /tmp/ns-ui-mcp-check && cd /tmp/ns-ui-mcp-check
npm init -y
npm install @nikolas.sapa/ns-ui-mcp
node <path-to-this-repo>/mcp/scripts/verify-stdio.mjs \
  ./node_modules/@nikolas.sapa/ns-ui-mcp/dist/index.js
```

It runs initialize, then tools/list, then calls every tool, and asserts each returns a
non-empty result. The last line on success is:

```
ALL CHECKS PASSED
```

In a client, working looks like five tools appearing under `ns-ui`:
`search_components`, `get_component`, `list_categories`, `install_command`,
`get_conventions`. Call `list_categories` first. It returns the taxonomy plus a `total`
and a `generatedAt` timestamp, which is the quickest way to see both that the server
answers and how old its snapshot is.

## When it does not work

**Check the tool count first.** No `ns-ui` tools at all means the client never launched
the process, which is a config-path problem, not a server problem. Tools present but
erroring is a different bug, and worth reporting.

**Your client's config shape is probably not the one above.** The JSON block here is the
Claude Code / generic stdio shape. Cursor, VS Code, Windsurf, Zed, Cline and Codex CLI
each differ. Copy the right one from
[design.helpmarq.com/connect](https://design.helpmarq.com/connect) rather than adapting
this one by hand.

**`command: "npx"` needs `npx` on the PATH the client sees**, which is often not your
shell's PATH. If the client launches nothing and logs nothing, put an absolute path to
the `npx` binary there.

**The component count looks low, or a component you know exists is missing.** The
snapshot is baked in at publish time, so an older installed version reports an older
catalog. Measured: an installed `0.7.1` reported `"total": 423` while the live site was
at 534.

**`npx` quietly installs an older version than the newest published one.** If your npm
has `minimum-release-age` set, a recent publish is filtered out of resolution. It does
not always fail loudly. Measured on one machine: `npm install @nikolas.sapa/ns-ui-mcp`
resolved `0.7.1` while `0.9.0` was published. Older npm reports this as
"No versions available" instead. Either way it is your npm policy, not this package.
Wait out the window or override the policy locally.

## Tools

- **`search_components(query, category?, collection?, limit?)`** — searches name,
  title, description, tags and selection guidance ("use when"). Every word in `query`
  must appear somewhere in a component's searchable text (order doesn't matter), so
  `"cursor reactive hero"` works, not just single-word lookups. Returns compact results
  (name, title, one-line description, category, collection) — not full source. Filter
  by `category` (an id from `list_categories`) or `collection` (`"core"` | `"loud"`).
  `limit` defaults to 20; the response also reports `total` so you know if there's more.
- **`get_component(name)`** — full detail for one component by exact name:
  description, "use when" guidance, tags, condensed prop signature, npm dependencies,
  the exact install command, and the real source of its `component.tsx`.
- **`list_categories()`** — the browsable taxonomy (the same 12 categories the site's
  chip row uses — `lib/search-categories.ts` in the main repo), each with a count, plus
  per-collection counts.
- **`install_command(name)`** — the exact
  `npx shadcn add https://design.helpmarq.com/r/<name>.json` string for one component.
- **`get_conventions()`** — the token contract every component is built against
  (`--background`/`--foreground`/`--ns-muted`/`--border`/`--ns-accent`, Tailwind v4, React 19,
  `prefers-reduced-motion` handling, accessibility baseline). Read this once per session
  before writing code alongside an installed component, so it matches rather than
  fighting the design language.

## How the data gets here

This package ships a static snapshot of the registry (`data/registry-snapshot.json`,
components + categories + parsed prop signatures + component source), not a live
connection to the site. It doesn't read the main repo at runtime — once installed from
npm, the repo isn't there — so the snapshot has to be baked in before publish.

That snapshot is produced by `scripts/build-mcp-snapshot.ts` at the repo root, which:

1. reads `registry.json` (generated by `build-registry.ts`) for name/title/
   description/tags/collection/dependencies,
2. reads `public/llms-full.txt` (generated by `build-llms.ts`) for the "use when" line
   and condensed prop signature per component, rather than re-implementing that
   scanner,
3. reads each component's real `component.tsx` off disk for source,
4. calls `categorize()` from `lib/search-categories.ts` (the same taxonomy the site
   uses — not a second, invented one) and `kindOf()` from `lib/kind.ts`.

It's chained into the repo's existing `npm run registry:build` at the root, and also
runs as this package's own `prepack` (`npm run build && node ../scripts/build-mcp-snapshot.ts`)
so a fresh `npm publish` from this directory always ships current data even if someone
forgot to run the root build first. `mcp/data/` is gitignored — same story as
`registry.json` and `public/llms.txt` in the main repo: it's generated, so it isn't
committed.

## Development

```bash
npm install          # inside mcp/ — this package has its own node_modules,
                      # published independently, same pattern as cli/
npm run dev           # runs src/index.ts directly (Node's native TypeScript
                       # support — no build step needed for local iteration)
npm run typecheck     # tsc --noEmit
```

### Why there's a build step here but not elsewhere in this repo

The rest of ns-ui runs `.ts` files directly via Node's native type stripping — no
build step. This package can't: Node explicitly refuses type stripping for files under
`node_modules` (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`), and once someone
installs this from npm, that's exactly where its files live. So `npm run build`
(`tsc -p tsconfig.build.json`) compiles `src/*.ts` to `dist/*.js`, and the package's
`bin` points at `dist/index.js`. Verified by packing (`npm pack`), installing the
tarball into a scratch project, and running the installed bin through a real
initialize → tools/list → tools/call handshake — not just by running it from the
source checkout, which would have hidden this.

## Publishing

```bash
npm run build              # or rely on prepack
npm publish --access public
```

`prepack` regenerates both the compiled `dist/` and the `data/` snapshot before every
pack/publish, so the published tarball is never stale relative to the root repo.
