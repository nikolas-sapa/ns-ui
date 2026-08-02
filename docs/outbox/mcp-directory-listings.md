# MCP directory submissions — `@nikolas.sapa/ns-ui-mcp`

`@nikolas.sapa/ns-ui-mcp` is published on npm (latest `0.1.0`, MIT, repo `github.com/nikolas-sapa/ns-ui`, verified this session) and is currently listed on **none** of the three directories below. Each has a different submission mechanism; details and a ready-to-paste listing follow.

## Shared listing copy (reuse across all three)

- **Name:** ns-ui MCP
- **Package:** `@nikolas.sapa/ns-ui-mcp`
- **One-line description:** MCP server for the ns-ui component registry — search 228 crafted React/Tailwind components, get real source and prop signatures, install commands, and the design-token conventions they are built against, as tools an agent can call mid-session.
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
- **Tools it exposes** (from `mcp/README.md`, verified this session):
  - `search_components(query, category?, collection?, limit?)` — full-text search over name, title, description, tags and "use when" guidance; returns compact results.
  - `get_component(name)` — full detail for one component: description, "use when", tags, condensed prop signature, dependencies, exact install command, and the real `component.tsx` source.
  - `list_categories()` — the 12-category taxonomy with counts, plus per-collection counts.
  - `install_command(name)` — the exact `npx shadcn add …` string for one component.
  - `get_conventions()` — the token contract every component is built against (`--background`/`--foreground`/`--muted`/`--border`/`--accent`, Tailwind v4, React 19, `prefers-reduced-motion`, accessibility baseline).
- **What it is (state factually, no comparative claims):** a first-party MCP server for a 228-component shadcn-compatible registry. It ships a static snapshot of the catalog (components + categories + parsed prop signatures + source), so it works offline once installed. The distinguishing tool is `get_conventions()` — it returns the design-token contract, so an agent can write code that matches the registry's components rather than fighting them. That is what makes it more than a fetch-the-catalog wrapper. Requires Node 18+.

> Note on positioning: I have deliberately **not** included the "almost no registry ships its own first-party MCP server" line. That was prior research, not verified this session, and an unverifiable comparative superlative is exactly the kind of claim a directory reviewer strikes. The factual "first-party MCP server for this registry, with a conventions tool" stands on its own.

---

## 1. mcpservers.org — web form (verified this session)

**Mechanism:** a web form at <https://mcpservers.org/submit>. Not a GitHub PR. (Older docs mention editing `mcp_server_market.json` in `chatmcpclient/mcp_server_market` — that is a different, chatmcp-specific catalog, not the mcpservers.org submit flow. The live submit page is a form.)

**Fields the form asks for** (read live this session):
- Server Name → `ns-ui MCP`
- Short Description → the one-line description above
- Link (GitHub or docs) → `https://github.com/nikolas-sapa/ns-ui` (or the connect page)
- Category → **Design** (closest fit from their dropdown: Development / Productivity / Database / Search / Web Scraping / File System / Version Control / Communication / Cloud Service / Cloud Storage / Marketing / Finance / Design / Memory / Other)
- Contact Email → owner's email

**Cost:** free listing. Optional "Premium Submit" is a **$39 one-time review fee** for faster approval, an official badge, and a dofollow link. Owner's call; the free tier is sufficient to get listed.

---

## 2. mcpmarket.com — GitHub-repo submission form (verified this session)

**Mechanism:** a form at <https://mcpmarket.com/submit> that takes **the full GitHub repository URL** and nothing else on the page itself; they review it for inclusion and email when it goes live. Submit `https://github.com/nikolas-sapa/ns-ui`.

- Their page advertises a paid placement option ("put your listing in front of our 1M+ monthly visitors", "one-time payment, no subscription", stated avg. 4–6 week listing time). The "1M+ monthly visitors" figure is **their** marketing claim, not independently verified.
- A commonly-cited tip is that adding a `LAUNCHGUIDE.md` to the repo lets the submit form auto-fill listing details/tags/setup. I could **not** confirm this on the live submit page or in `docs.mcpmarket.com` this session — treat it as **unverified**. If the form offers auto-fill, `mcp/README.md` already contains everything it would need (tools, install, requirements). Do not add a `LAUNCHGUIDE.md` on the strength of an unverified tip; verify the form's behavior first.

---

## 3. lobehub — no working public self-serve path found (reported honestly)

**Mechanism:** unclear / gated. What I found this session:
- <https://lobehub.com/mcp/submit> redirects (302) into the logged-in app as a "Request a Server" flow (`market.lobehub.com/s/plugins/submit` 404s when fetched unauthenticated), so I could not reach an actual submission form to enumerate its fields. It requires a LobeHub account.
- There is **GitHub-issue precedent**: server-addition requests have been filed as issues on `lobehub/lobehub` with labels `feature:mcp` + `feature:marketplace` (example: issue #13861, "[Request] Add … MCP server to marketplace"). That issue was **closed as `Inactive`**, so the issue route exists but appears to go stale rather than convert reliably.
- LobeHub's docs describe adding MCP servers to *your own* LobeHub instance (Custom MCP), which is a user-side connect flow, not a marketplace listing.

**Recommendation:** the reliable path is to sign in to LobeHub and use the in-app "Request a Server" flow (needs an account, which is why I could not complete it). The GitHub-issue route is a fallback but has a poor track record. Listing copy above is ready for whichever form the in-app flow presents. Of the three directories, this is the one that may not have a clean self-serve mechanism at all.

---

## Submission-channel summary

| Directory | Channel | Verified this session | Cost |
|---|---|---|---|
| mcpservers.org | Web form (`/submit`) | Yes — read the live form fields | Free (optional $39 premium) |
| mcpmarket.com | Web form taking a GitHub repo URL (`/submit`) | Yes — read the live form | Free listing; paid placement offered |
| lobehub | In-app "Request a Server" (account-gated); GitHub issue as weak fallback | Partially — redirect + issue precedent confirmed; form itself gated | Free |
