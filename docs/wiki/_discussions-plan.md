# Discussions — proposed setup

Nothing has been created. This is a proposal; every category below has to be
created by hand in **Settings → Discussions** (or the owner can accept the
defaults and delete the ones that don't apply).

GitHub seeds a new Discussions tab with **Announcements**, **General**,
**Ideas**, **Polls**, **Q&A** and **Show and tell**. The proposal is to keep
four of those, rename one, add one, and drop the rest, on the principle that a
category with no traffic reads as a dead project.

## Keep

**Announcements** (announcement format, maintainer-post-only)
The registry publishes three separately-versioned things — the site, the CLI
(`@nikolas.sapa/ns-ui`) and the MCP server (`@nikolas.sapa/ns-ui-mcp`) — and a
breaking change in the token contract affects installed copies that no
package manager will ever update. That needs a one-way channel that isn't the
changelog.

**Q&A** (question/answer format)
The predictable install failures are answerable and repeatable: React 19,
Tailwind v4, and a host project missing `--background` / `--foreground` /
`--border`, which the registry deliberately does not ship. Marking an accepted
answer makes the next person's search work.

**Ideas** (open discussion)
Component requests are the highest-volume inbound a registry gets, and they
are not bug reports. Keeping them out of Issues is what stops the issue
tracker becoming a wishlist.

**Show and tell** (open discussion)
Components here are installed as source and meant to be edited. What people
changed is the only feedback channel that shows how the components behave
outside this repo's own theme.

## Add

**Registry & tooling** (open discussion)
The MCP server, the CLI and `llms.txt` are a different audience from the
component consumers — agent authors integrating the catalog, not designers
picking a hero. Their questions ("what does `get_conventions` return", "why is
the CLI index stale relative to the site") don't belong in the same thread as
component requests.

## Drop

**General** — a catch-all next to five specific categories is where threads go
to be un-triaged.

**Polls** — nothing here is decided by vote, and an empty Polls tab is a
visible dead end.

## Not for Discussions

Security reports stay on the process in
[`SECURITY.md`](https://github.com/nikolas-sapa/ns-ui/blob/main/SECURITY.md).
Discussions are public and indexed; a category inviting them would be a
mistake. Worth stating explicitly in the Q&A category description.

## Owner decision — the welcome post

GitHub posts a default welcome thread in the first category. The replacement
copy is **not drafted here** and should not be: it is the project's voice, it
makes promises about responsiveness and scope that only the owner can make,
and it is the one piece of this that is unambiguously marketing rather than
documentation.

If it helps, the factual material it could draw on is already written and
verified: [Home](Home) for what the pieces are,
[Installing a component](Installing-a-component) for the prerequisites people
will actually trip on.
