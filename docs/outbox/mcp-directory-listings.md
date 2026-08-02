# MCP directory submissions — `@nikolas.sapa/ns-ui-mcp`

Status: **none of the three directories could be submitted by an agent.** All three
require either a human-completed web form, a payment, or a browser OAuth login. The
ready-to-paste copy is below; the owner has to do the final click in each case.

Verified (re-checked 2026-08-02): `@nikolas.sapa/ns-ui-mcp` is published on npm at
`0.1.0`, MIT, repo `github.com/nikolas-sapa/ns-ui`, homepage `https://design.helpmarq.com`.
The registry it serves has 228 items and the repo is public and MIT.

---

## Shared listing copy (reuse across all three)

- **Name:** ns-ui MCP
- **Package:** `@nikolas.sapa/ns-ui-mcp`
- **Short description (one line):**
  > First-party MCP server for the ns-ui component registry — search 228 React/Tailwind
  > components, get real source, prop signatures, install commands, and the design-token
  > conventions they are built against.
- **Longer description:**
  > ns-ui MCP exposes the ns-ui component registry (228 MIT-licensed React components for
  > Tailwind v4 and React 19) as MCP tools. It is shipped by the registry itself, not a
  > third-party wrapper. Beyond search and lookup, `get_conventions()` returns the design-token
  > contract every component is built against, so an agent can write surrounding code that
  > matches the components instead of fighting them. The catalog ships as a static snapshot,
  > so it works offline once installed. Requires Node 18+.
- **Install / config (stdio):**
  ```json
  {
    "mcpServers": {
      "ns-ui": { "command": "npx", "args": ["-y", "@nikolas.sapa/ns-ui-mcp"] }
    }
  }
  ```
  Claude Code one-liner: `claude mcp add ns-ui -- npx -y @nikolas.sapa/ns-ui-mcp`
- **Homepage:** https://design.helpmarq.com — connect page: https://design.helpmarq.com/connect
- **Repo:** https://github.com/nikolas-sapa/ns-ui (directory `mcp/`)
- **License:** MIT
- **Category:** Design (or Developer Tools, depending on the directory's taxonomy)
- **Tools:**
  - `search_components(query, category?, collection?, limit?)` — full-text search over name,
    title, description, tags and "use when" guidance; compact results.
  - `get_component(name)` — full detail: description, "use when", tags, condensed prop
    signature, dependencies, install command, and the real `component.tsx` source.
  - `list_categories()` — the 12-category taxonomy with counts, plus per-collection counts.
  - `install_command(name)` — the exact `npx shadcn add …` string for one component.
  - `get_conventions()` — the token contract (`--background`/`--foreground`/`--muted`/
    `--border`/`--accent`, Tailwind v4, React 19, `prefers-reduced-motion`, accessibility
    baseline).

---

## 1. mcpservers.org — web form, free, **needs the owner**

**URL:** https://mcpservers.org/submit — a web form, not a GitHub PR. Re-verified live.

Paste into the fields:

| Field | Value |
|---|---|
| Server Name | `ns-ui MCP` |
| Short Description | `First-party MCP server for the ns-ui component registry — search 228 React/Tailwind components, get real source, prop signatures, install commands, and the design-token conventions they are built against.` |
| Link (GitHub or docs) | `https://github.com/nikolas-sapa/ns-ui` |
| Category | **Design** |
| Contact Email | owner's email |

Free listing. An optional "Premium Submit" is a **$39 one-time review fee** (faster review,
official badge, dofollow link). Owner's call; the free tier gets you listed.

**Not submitted** because the form asks for a contact email and is a human web form.

---

## 2. mcpmarket.com — web form, **now appears to be paid-only**, needs the owner

**URL:** https://mcpmarket.com/submit (Vercel bot protection blocks plain `curl`; read in a
real browser to verify.)

The page has an **MCP Server** / **Agent Skill** tab pair, and a "GitHub repo" / "Remote MCP"
source toggle. Fields:

| Field | Value |
|---|---|
| Tab | **MCP Server** |
| Source | **GitHub repo** |
| Repository URL | `https://github.com/nikolas-sapa/ns-ui` |
| Email address | owner's email |
| Try Now link (optional) | `https://design.helpmarq.com/connect` |

**Changed since the earlier draft:** the listing-option radio group now shows only one choice —
**"Get Listed Now — $29 one-time"** (listed within 24 hours, official badge, "Try Now" link).
The submit button reads "Get listed now". No free submission path was visible on the page.
Treat this as a **$29 purchase decision**, not a free listing.

Their "1M+ monthly visitors / 35K+ MCP servers / 200K+ agent skills" figures are the site's own
marketing claims, not independently verified.

**Not submitted** — it requires a payment, which is the owner's decision.

(The "add a `LAUNCHGUIDE.md` to auto-fill listing details" tip remains **unverified**; nothing
on the live submit page or their docs confirms it. Do not add one on the strength of it.)

---

## 3. LobeHub — official CLI publish path, **needs a browser login by the owner**

Correction to the earlier draft: LobeHub **does** have a first-party self-publish path. It is a
CLI, not a form and not a GitHub PR.

- Skill doc: https://lobehub.com/publish-mcp/skill.md (same content at
  `https://market.lobehub.com/s/publish-mcp`)
- CLI: `@lobehub/market-cli`, binary `lhm`. Requires Node.js >= 22.
- New listings use `lhm plugin submit <repo-url>` (imports the GitHub repo as a new listing and
  assigns it to you; you must own the repo or have push access). `lhm plugin publish` is for
  publishing a *new version* of an already-listed plugin, and reads an `lhm.plugin.json`
  manifest whose `identifier` is assigned by the marketplace on first listing — never invent it.

Exact sequence for the owner:

```bash
npx -y @lobehub/market-cli login          # opens a browser, OIDC PKCE, waits up to 5 min
npx -y @lobehub/market-cli github connect # links GitHub for ownership verification
npx -y @lobehub/market-cli plugin submit https://github.com/nikolas-sapa/ns-ui
npx -y @lobehub/market-cli plugin list --output json   # poll; import is async, a few minutes
```

Do not poll past ~10 minutes — if nothing appears, the import failed silently.

**Not submitted** — `lhm login` and `lhm github connect` both require a human completing an
OAuth flow in a browser. No LobeHub credentials exist on this machine (`~/.lobehub-market`
does not exist). This is the credential gate I was told to stop at rather than work around.

There is also a "Request a Server" dialog at https://lobehub.com/mcp/submit, but its own copy
points owners at the CLI: "Is this your own MCP Server? Publish it with the official CLI."

---

## Summary

| Directory | Channel | Blocked by | Cost |
|---|---|---|---|
| mcpservers.org | Web form `/submit` | Human form + contact email | Free ($39 optional premium) |
| mcpmarket.com | Web form `/submit` (GitHub repo URL) | Payment | $29 one-time (no free option visible) |
| LobeHub | `@lobehub/market-cli` → `lhm plugin submit` | Browser OAuth login | Free |

None of the three is a pull request to a public repo, so nothing could be opened on the owner's
behalf.
