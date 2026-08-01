# Content and AI-discovery strategy

Written 2026-08-01. Every number below was measured against this repo or a live
fetch during the session that produced it. Where something is an estimate or a
recollection, it says so.

## Ground truth

- **228 components.** Older docs say 223 (`rename-plan.md`), 222
  (`perf-audit-2026-07.md`) or 206 (the one blog post). Those are historical.
  The GitHub repo description and root `package.json` still say 223 and 218
  respectively — both stale, both appear in scraped directory listings.
- **The 223-slug rename landed.** Verified on disk:
  `registry/core/confirm-hold-ink/` exists, `hold-to-confirm/` does not.
- **`robots.txt` is `Allow: /`** with no bot-specific rules. GPTBot,
  PerplexityBot, ClaudeBot, Google-Extended and Bingbot are all free to crawl.
  Zero Google index is a submission and linking problem, not a blocking one.
- **`site:design.helpmarq.com` returns nothing.** Direct brand-name queries
  return nothing. The site is not in the index at all.
- **ns-ui appeared in 0 of 17 tested developer queries.** Every one was won by
  21st.dev, shadcnblocks, aceternity, hover.dev, shadcn.io or the official docs.
- **`registry.json` is schema-valid** and meets every stated requirement of
  shadcn's official directory, including the one most registries fail: no
  inline `content` in the `files` array.
- **`registry.json` is gitignored** (`.gitignore:18`). It is generated at build
  time and never committed. This is why `ethan-krich/ui-registries` — which
  auto-discovers registries by scanning GitHub daily for repos containing a
  `registry.json` — has never listed us. We were never eligible.
- **`llms.txt` selection guidance is 64% unfinished.** Of 228 `use when` lines:
  100 are literally their own tags restated (`use when: sticker (peel, drag,
  3d).`), 146 contain no comparative guidance of any kind, and only **82 (36%)**
  carry the real thing (`pick confirm-hold-ink instead for a bare
  press-and-hold confirm with no payload to inspect`).
- **No JSON-LD anywhere.** No dates or author attribution on any page.

## The strategic constraint, stated plainly

The volume queries are not winnable. "Best free react component library",
"animated hero section react", and every category variant are owned by
registries with 1,000-2,000+ components and years of backlinks. We have 228
components and 13 stars. No amount of structured data closes a 10x content gap,
and pretending otherwise wastes the only resource here, which is one person's
time.

What is winnable is a different axis:

1. **First-party MCP.** The "MCP server for UI components" results are full of
   third-party wrappers *around* shadcn. Almost no registry ships its own.
   `@nikolas.sapa/ns-ui-mcp` exists and is listed on none of mcpservers.org,
   lobehub or mcpmarket.com.
2. **Registry mechanics queries.** "How do I install from a custom shadcn
   registry" is currently answered by generic explainers, not by any registry's
   own pages. Nobody owns that ground.
3. **Inclusion wins.** Directories and awesome-lists, most of which are cheap
   and some of which are free.

The pattern shared by every page that won a citation in testing: **explicit
numbers, a visible date, named attribution, categorical breadth.** Our pages
currently show none of the first three.

---

## 1. Blog content plan

Ranked by return. "Write now" means the work is done and documented in this
repo; writing is assembly, not research.

### Tier 1 — write now, no new work required

**1. "64% of my component library still fails the test I wrote a blog post
about."** The existing post argues that tags do not disambiguate similar
components. Grepping our own `llms.txt` shows 146 of 228 `use when` lines
contain no comparative guidance and 100 are bare tag restatements. Show the
count, show three degenerate lines beside three good ones, commit to closing
the gap. Zero new research, direct sequel to the only post with established
voice, and genuinely surprising — you would not expect the person who wrote
the tags-do-not-work post to have left it 64% unfixed. **This is the strongest
piece available and it doubles as public accountability for item 4 below.**

**2. "I profiled 222 components and the CPU numbers meant almost nothing."**
From `perf-audit-2026-07.md`: the same component measured 5606ms and 32ms with
no code change, purely from machine contention — a 175x swing. 205 of 222
measured exactly 0ms; five accounted for 96% of total blocking time. The honest
framing is not "I made it faster" — headline TTFB and LCP did not improve. It
is that TBT is dominated by what else is running on your machine, and how you
find five real offenders among 222 candidates. A methodology post, not a
registry post.

**3. "The `@convex-dev/auth` in-memory storage mode has a defect. Here is the
stale closure."** From `community-spec.md` §6.1a: `storage="inMemory"`
correctly suppresses localStorage writes but client auth state then never
settles, traced to a `useMemo` whose dependency never changes when null. A
primary-source library defect with a root cause is rare and gets linked from
GitHub issues. **Do not frame this as "I shipped auth on a static site" — as of
writing, nothing has shipped.** Write it as a design investigation and a defect
report, both of which stand alone.

**A note on the second defect.** This session also verified an account-takeover
vector in the same library — a global code lookup combined with a rate limiter
keyed on an attacker-controlled value. That is a far stronger piece of original
research than anything else in this document. **It goes to Convex privately
first.** It becomes publishable only after they have shipped a fix or declined
to, and never before.

### Tier 2 — light assembly needed

**4. "222 renames, one atomic commit, and the eleven places a slug secretly
lives."** From `rename-plan.md`: a slug is simultaneously a folder name, a
registry id, an install path, a CSS scope prefix, a search-vocabulary entry and
a cross-reference inside 111 other components' prose — half authored, half
derived, which is exactly the split that breaks silently. 3,888 occurrences
across 576 files. Needs a short after-action pass; the doc is the pre-mortem.

**5. "Building an MCP server for a registry that already had a working
`llms.txt`."** Why two things: `llms.txt` is one fetch for a one-shot consumer,
MCP is repeatable tool calls for an agent working across a session. The
interesting part is that they do not duplicate data — `build-mcp-snapshot.ts`
bakes from the same `registry.json`. One source, two distribution shapes.
**This is also the post that supports the winnable MCP positioning.**

**6. "Ink density instead of hue: charts that survive colorblindness and
grayscale printing."** `chart-bar-halftone`, `chart-donut-halftone` and
`heatmap-year-stipple` encode magnitude as dither density rather than colour.
The donut's own `meta.json` states the rule: angle carries share, ink density
carries ordinal position, and it is the wrong choice for nominal categories.
A real design heuristic. Half a day to read the rendering logic properly.

**7. "A component whose job is admitting how confident it isn't."**
`confidence-logprob-hatch` plus the citation-grounding family — three answers
to "how do you show a RAG answer is backed by a source". Squarely the design
territory you asked for, and topical for every team building AI chat UI now.

**8. "What a Playwright gate is actually for."** The verify gate hard-fails when
hover is byte-identical to resting, when dark and light are identical, and when
a popover clips behind an `overflow:hidden` ancestor — caught by hit-testing
rather than measuring a box. Every one is a bug class naive visual regression
misses. Pull real failures from CI history; do not invent one.

### Tier 3 — genuinely new writing

**9. "What a component name should tell a model that a screenshot can't."**
`chart-donut-halftone` front-loads role before technique — backwards for a human
browsing visually, correct for a model matching a query. Needs real token-order
analysis across 228 names. Generalises past this registry, so it travels.

**10. "12 buckets, 228 components, and why the categories are computed, not
authored."** `lib/search-categories.ts` documents that 41 of 206 components had
zero tag hits and were unreachable from the chip row. Write once category hubs
ship so it can link to real URLs.

**11. "A submission funnel that never runs a stranger's code."** From §6.2: an
iframe `sandbox` attribute would not even be the boundary, because submitted
code already executed during `next build`. Stronger once `/submit` exists.

**12. "Everything is private until you say otherwise."** From §8.1: a private
profile and a never-claimed handle must return byte-identical 404s, because any
difference is an enumeration oracle on a site with no user directory.

**13. "228 components, one interaction rule, zero exceptions."** The most
general and most shareable. Only write it if you want a system-design piece
distinct from the AI angle 1 and 9 take.

### Deliberately not blog material

`21st-source-audit.md`, `21st-refund-position.md`, `21st-bookmarks.md`. These
are internal and adversarial toward another project. Publishing reads as
combative rather than technical and buys nothing.

---

## 2. AI discoverability

**Already working:** `llms.txt` and `llms-full.txt` are generated, not
hand-maintained, so they cannot drift. `robots.txt` blocks nothing. One install
URL per component with no auth, no pagination, no session — exactly the shape a
fetch tool needs. `get_conventions()` in the MCP server is the thing that stops
an agent installing a component and then fighting it on theming for the rest of
a session; most registries have no equivalent.

**The rename helped, and did not go far enough.** Role-first naming works for
the axis it targeted — a model gets the disambiguating token first. But
distinguishing *between* components sharing a role is carried by `use when`,
and that field is 64% unfinished. **A name fix without a use-when fix leaves the
exact problem the blog post claims to have solved half-solved.**

**Concrete gaps:**
- **No JSON-LD.** `SoftwareSourceCode` per component page, generated from the
  same `registry.json` that already backs `llms.txt`.
- **No crawlable path to any component page.** Not in the sitemap, not linked
  from anywhere a crawler follows. An agent with `llms.txt` does not need it; a
  search crawler has no route in at all.
- **No comparison content**, which is what actually gets cited when an
  assistant synthesises "what should I use for Y".
- **`registry.json` is gitignored**, which silently disqualifies us from
  automated directory discovery.

---

## 3. Reddit

**Verification status: reddit.com could not be fetched during research.** Every
rule claim below is from secondary sources or recollection. **Read the actual
sidebar before posting.**

**r/webdev — Showoff Saturday only, never standalone.** Reported to prohibit
standalone self-promotion, with personal projects confined to a weekly thread.
Highest-value audience, and posting outside that thread is the most reliable way
to get removed. Angle: lead with the finding, not the product — *"64% of my
component library's LLM selection guidance is still just its tags restated, a
year after I wrote a post about why that fails."* Mention the registry once,
near the end, as where the data came from.

**r/SideProject — standalone launch likely fine.** Wants a live demo rather than
a gated signup, which `npx shadcn add <url>` with no signup satisfies
completely. Angle: the weird concrete thing — *"228 components, each gated by a
Playwright test that fails if the hover looks identical to resting."*

**r/reactjs — check for a recurring thread first.** If standalone posts are
permitted for genuinely open-source libraries, the angle is post 5: why
`llms.txt` came first and MCP second.

**Do not try: r/programming, r/InternetIsBeautiful.** Removal risk with no
upside.

---

## 4. Programmatic SEO, ranked

**1. Make component pages indexable.** The sitemap excludes them on the grounds
that they are "an internal embed target". That justification is stale — the perf
audit moved the card iframe to `/preview/<name>/embed`, and the plain route
already has correct per-component `generateMetadata`. It needs sitemap entries
and a crawlable inbound link. 228 pages of unique search demand for almost no
new infrastructure. **Constraint: `verify.ts` and `record.ts` screenshot this
exact route, so any visual addition must be accounted for in the gate.**

**2. Category hub pages.** `categorize()` already computes membership for all
228 from real tags. Making these real server-rendered routes targets head terms
("react navigation components") that a homepage with filter chips cannot,
because filtered state is not a URL. Routing plus a metadata template.

**3. Comparison pages.** Roughly a dozen components already cross-reference an
alternative in their own `use when` line. That is precisely "alternatives to X"
intent and exactly what an assistant would quote. Cannot be templated cleanly —
the reasoning is bespoke per pair.

**4. "Alternatives to shadcn `<X>`" pages.** Real demand, adversarial framing
risk, real per-page writing. Do only if 1-3 are done.

---

## 5. Sequencing

One person. Ordered by leverage, not ease.

**Week 1 — one-time, no new content:**
1. **Commit `registry.json`.** One line in `.gitignore`. Unblocks automated
   discovery by `ui-registries` — no PR, no approval, no maintenance.
2. **Open the shadcn official directory PR.** The registry already passes every
   stated criterion. Highest-authority link in the space.
3. **Add component pages to the sitemap and link to them.** Nothing else in
   section 4 compounds without this.
4. **Submit to Google Search Console** and request indexing. Zero index today is
   a submission gap, not a blocking one.
5. **Fix the stale counts** in the GitHub repo description and `package.json`.
   They appear in every scraped listing.

**Month 1:**
6. **Finish the 146 `use when` lines.** The single highest-leverage
   AI-discoverability fix available, and it is finite rather than ongoing. Real
   writing per component — the 82 good examples show it takes judgment, not a
   template.
7. Publish posts 1, 2 and 3.
8. **List the MCP server** on mcpservers.org, lobehub and mcpmarket.com. This is
   the winnable differentiator and it is currently listed nowhere.
9. Ship category hub pages.
10. r/SideProject, once something above has actually landed.

**Month 3:**
11. Comparison pages, starting with the pairs whose `use when` prose is already
    strongest.
12. Posts 4-8, roughly one every two to three weeks. Do not front-load.
13. r/webdev Showoff Saturday, once item 6 is done — that is the post's content.
14. JSON-LD on component pages.

**Not scheduled:** posts 11 and 12 and the live version of post 3 all depend on
Phase A/B/C actually shipping. They read as false the moment "shipped" is not
true yet.
