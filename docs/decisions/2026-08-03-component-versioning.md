# Decision: component versioning before Phase C

Status: **decided**. Date: 2026-08-03. Scope: what "version" means in this registry once
`/submit` (community-spec §2, Phase C) starts producing pull requests from people who are not
the owner.

This discharges the prerequisite recorded as "decide component versioning BEFORE contributors
arrive." Phase C is what makes them arrive, so it is decided here.

---

## The decision in one paragraph

**Version the registry, not the component.** The version already exists — it is `CHANGELOG.md`,
currently at `v0.19.0`, parsed by `app/changelog/entries.ts` and published at `/changelog`. Nothing
is added to `meta.json`. A contributor bumps nothing. A change to an existing component is edited in
place and gets a `CHANGELOG.md` line; a change that would break someone who overwrites their copy is
the maintainer's call, and its escape hatch is a new slug, not a version number. The 228 existing
components migrate by having zero files touched.

This is **ratification, not adoption**: registry-level semver already ships and is already what the
site shows. What is decided is that it stays the *only* version, and Phase C does not add a second
one underneath it.

## Why per-component semver loses — it would be theatre

`npx shadcn add <origin>/r/<slug>.json` copies `component.tsx` into the consumer's project. From
that moment the file is **their source code**, in their repo. There is **no dependency edge** back
here: no lockfile entry, no resolver, no manifest recording which version they took. Nothing on
their machine will ever consult a version number this registry publishes, because nothing on their
machine contacts this registry again.

A version is only useful if something can *resolve* against it. Publishing `"version": "2.0.0"` for
a component would change nothing about any installed copy, trigger no notification, and appear in no
consumer's tooling. It would be a number maintained for an audience of zero.

Grounded, not assumed: **shadcn's own registry item schema has no version field.**
`node_modules/shadcn/dist/schema/index.d.ts` (registryItemSchema, ~743-830) carries `name`, `type`,
`title`, `description`, `files`, `dependencies`, `meta`, `docs`, `categories` — and a grep for
`version` across `shadcn/dist/schema/` returns nothing. A version could be smuggled through the open
`meta` record (how `collection`/`tags`/`instruction` already travel), where nothing would read it.
The format's authors omitted the field because their distribution model makes it inert.

**The upgrade path that actually exists today:** re-run `npx shadcn add <same URL>`, let it
overwrite, read the diff in your own VCS. That is real, already shipped, and strictly better
information than semver — the consumer sees the actual change rather than a maintainer's
one-character opinion about it.

## The rule for a breaking change

1. **Default: edit in place**, and write a `CHANGELOG.md` line naming the component and what
   changed. That is where a consumer looks to decide whether to re-run the install command.
2. **Escape hatch, used rarely: a new slug.** Not `foo-v2` — a genuinely new descriptive name, the
   way `confirm-slide-shatter` sits beside `confirm-hold-ink`. The old slug keeps resolving to the
   code someone originally installed. In a copy-in registry **the slug is the version identifier**,
   and "don't mutate an identity, mint a new one" is the only versioning primitive the model
   supports.

156 of 228 components export a `*Props` type, so breaking changes are real rather than
hypothetical — but props are thin and mostly optional, so the honest expectation is this fires a
handful of times a year at most. It stays an escape hatch, not a policy.

**Retention cost, priced honestly:** a superseded slug still gets enumerated by
`build-registry.ts`, so it stays in the catalog, `llms.txt`, the sitemap and the MCP snapshot — a
near-duplicate competing with its own replacement. Fixing that costs one optional `"deprecated":
true` key honored by `build-llms.ts`, the catalog and the sitemap, and deliberately *not* by
`build-registry.ts` so `/r/<slug>.json` keeps 200-ing. **Do not build it now** — build it the first
time the escape hatch is actually used. Until then it is a feature with no caller.

## Where the version lives

| Thing | Verdict |
|---|---|
| `CHANGELOG.md` | **The version.** Sole authority. Already is. |
| `meta.json` | **No version field.** |
| `registry.json` | **No** — generated and not committed; a version there is written into a file absent from git. |
| `package.json` | **Not the version.** See drift below. |
| Git tags | Recommended, one per `CHANGELOG.md` entry. Not verified this pass. |

**Drift found and resolved:** `package.json` says `"version": "0.1.0"` while `CHANGELOG.md` is at
`v0.19.0` — two numbers both spelled "version", eighteen minors apart. Resolution: `package.json`'s
version is **inert and stays that way**. The package is `"private": true`, never published, and
consumers fetch `/r/<slug>.json` over HTTP, never via npm install. Bumping it to 0.19.0 is strictly
worse — it creates a second number to keep in sync forever, for no reader.

`mcp/package.json` and `cli/package.json` carry their own real, independent versions. Those version
*the client*, not the registry's contents. Unchanged by this decision.

## What a contributor does on submit: nothing

No version field on `/submit`. No changelog edit. A version field would be the worst possible thing
to expose to an outside contributor — it is a judgment about *other people's installed code*, which
the submitter has no information to make.

The maintainer makes one binary call at review time, and it is testable rather than a matter of
taste:

> Would someone who overwrites their existing copy get a broken build or a changed contract they did
> not ask for? A removed or renamed prop, a newly required prop, a renamed export, a new runtime
> dependency, or a materially different interaction contract.

**Yes** → new slug, old one stays served, `CHANGELOG.md` names both. **No** (polish, bug fix,
accessibility, perf, a newly *optional* prop, token correction) → edit in place, changelog line, done.

## Migration for the 228 existing components: nothing

Zero files touched. No `meta.json` edited, no script changed, no build output changed, no screenshot
regenerated, no `npm run verify` re-run.

This is the strongest single argument for the decision. Every per-component alternative starts with a
228-file mechanical edit landing on a solo maintainer — immediately before opening the door to
outside PRs, i.e. exactly when a 228-file diff is most expensive to rebase around.

## Strongest objection

**"A consumer cannot tell whether their installed copy is stale."** True, and unfixed. Someone who
installed in June has no way to learn it improved in August short of reading `/changelog` or
re-running the install and eyeballing the diff.

Three things blunt it, none eliminate it: they would still have to notice the number (semver does not
push, it answers a question you had to think to ask); re-running `shadcn add` and reading the VCS
diff answers the same question better; `/changelog` already exists for exactly this. The residual is
real — this design optimises for the maintainer and for the accuracy of what is published, and costs
a "you may be out of date" nudge this distribution model cannot deliver anyway.

## What would have to be true for the alternative to win

**Named trigger: `cli/` grows a `diff` or `update` command** comparing an installed file against the
registry's current copy. That is when a staleness marker acquires a reader.

Even then **semver still loses; a content hash wins** — auto-derived at build time in
`build-registry.ts`, zero contributor duty, impossible to get wrong, and exactly the right answer to
the only question a CLI can mechanically ask ("is my copy the same bytes as yours?") rather than "is
this change safe to take?", which no number encodes. **Do not add the hash before that command
ships** — a hash nothing reads is dead weight in every generated artifact and every diff.

Weaker second trigger: if the escape hatch fires 3+ times in a year, superseded slugs are
accumulating fast enough to justify the `deprecated` flag, and possibly to reopen this.

## Flagged as speculative complexity, rejected

- Per-component semver in `meta.json` — 228 number lines, no reader, no resolver.
- A build-time content hash *today* — right idea, no caller yet. Deferred behind the CLI trigger.
- A `deprecated`/`hidden` flag *today* — right idea, no caller yet. Deferred until first use.
- Per-component `CHANGELOG.md` files — 228 files duplicating git history.
- A release script syncing `package.json` to `CHANGELOG.md` — automation to keep an inert number in
  step with a real one. The fix is to declare the inert number inert.

## Consequences

**Positive:** zero migration; zero contributor burden; no change to `meta.json`,
`build-registry.ts`, or the generated-files contract; `/changelog` becomes the sanctioned answer to
"what changed"; Phase C's `/submit` spec needs no amendment; the prerequisite is discharged without
blocking Phase C.

**Negative:** no staleness signal for consumers until the CLI trigger fires; the breaking-change
judgment is a single unaudited human call with no number recording it was made; `CHANGELOG.md`
discipline becomes load-bearing — a change shipped without a changelog line is now genuinely
invisible, where before it was merely undocumented.

**Follow-ups, small and non-blocking:**

1. One line in `CONTRIBUTING.md`: changes to an existing component are described in the PR body; the
   maintainer decides in-place vs new slug.
2. One line wherever `package.json` is described: its `version` is inert; the registry's version is
   `CHANGELOG.md`.
3. Confirm git tags track `CHANGELOG.md` entries; start tagging if not.
