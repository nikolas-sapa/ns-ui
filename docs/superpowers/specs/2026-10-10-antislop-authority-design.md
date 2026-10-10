# ns-ui as the anti-slop design authority — program design

Date: 2026-10-10
Status: design approved in chat, spec awaiting owner review
Branch: `feat/antislop-authority`

## Intent

**Stated by the owner:** kill AI slop; make ns-ui the leading thing about it.
Expand beyond components into a place people find everything they need:
a directory of other design sites and tools (Point First Dev and peers),
research on what actually makes design good (papers, website art,
architecture, infographics), study of the best current sites (Y Combinator
companies, AI-agent companies, new tech), and a catalog of the GitHub repos
that matter. Answer why models keep producing the same template and the same
gradients, and how people built sites before. Knowledge lands on many
surfaces — MCP, blogs, community, not MCP alone. Multi-session, agent teams,
sessions kept clean.

**Assumptions, not stated:** that the evidence is worth more than the rules
written from it; that surfaces should render from one base rather than each
holding its own copy; that community contribution scales the evidence past
what agents can study alone.

**Success:** an agent building a landing page calls ns-ui and gets back what
to avoid, what to use instead, and a count of real sites behind that claim.
A person lands on the site and finds the rule, the essay, and the directory
entry that all quote the same number.

## Problem

AI-built sites converge: centered hero, gradient blob, three-card row,
identical feature icons. The model is not careless. Every design resource on
the internet is written for a person who is looking at it, and a model gets
almost none of what a human gets from three seconds of looking. Nobody has
written down what good looks like in a form a machine can read, backed by
evidence a human can check.

## Thesis

One evidence base, many surfaces.

Study real sources. Record each as a tagged evidence file. Author rules that
aggregate over evidence, with counts **computed from the files, never typed**.
Render that one base to every surface.

```
content/evidence/*.md  +  content/rules/*.md
                 |
                 v
        scripts/build-antislop.ts
                 |
   +--------+----+----+---------+----------+---------+
   |        |         |         |          |         |
  MCP  /guidelines /writing /directory /community  llms.txt
 agents    canon     essays    hook     submissions  (exists)
```

The moat is not the rules — anyone can write rules. It is the evidence:
hundreds of studied sources, tagged by context and cohort, where every claim
traces to files you can count. A directory gets cloned in a weekend. An
evidence base does not.

## Architecture

Follows the pipeline this repo already runs three times (`registry.json`,
`mcp/src/conventions.ts`, `llms.txt`): source files in the repo, a `build-*`
script, generated output, markers that make hand-editing a build failure.

### Storage

Files in the repo. Not Convex — Convex holds user state here (accounts,
submissions, testimonials); content is file-based. The alternative, a Convex
table for live-editable rules, is skipped: no editor needs it, and it would
put the evidence base outside code review.

Community submissions (session 7) land in Convex as *proposals*, then get
promoted into `content/evidence/` by a maintainer. Public writes never touch
the evidence base directly.

### Evidence file

`content/evidence/<slug>.md`

```
---
source: https://linear.app
kind: site            # site | paper | repo | tool | artifact
cohort: agent-tools   # see vocabulary
context: [hero, nav, pricing]
verdict: exemplar     # exemplar | slop | mixed
studied: 2026-10-10
signals:
  centered-hero-stack: absent
  gradient-blob: absent
  three-card-row: absent
  asymmetric-split: present
---
Prose notes. What the mechanism actually is, in the register of
content/writing/agent-readable-registry.md — specific, not adjectival.
```

### Rule file

`content/rules/<id>.md`

```
---
id: hero-centered-stack
context: hero
signal: centered-hero-stack
stance: avoid          # avoid | prefer
severity: hard | soft
evidence: [linear-app, resend-com, yc-w26-acme, ...]
---
## Avoid
## Instead
## Why
<!-- generated:count start -->38/40<!-- generated:count end -->
```

The count between the markers is rewritten by the build script from the
resolved `evidence:` list. Hand-editing it is overwritten on the next build,
and a CI diff check makes that a red build — the same doctrine that keeps
the `get_conventions` token line from going stale.

### Closed vocabularies

`lib/antislop-vocab.ts`, mirroring how `lib/css-tokens.ts` is the single
source for the token line. Free-text signals would make every count
meaningless, so the build rejects any signal outside the list.

Seed, to be refined in session 2 (mined from the existing
`design-taste-frontend` skill, which already encodes much of this):

- **Slop signals:** `centered-hero-stack` `gradient-blob` `three-card-row`
  `glass-card-overuse` `emoji-as-icon` `generic-sans-default`
  `purple-blue-gradient-cta` `symmetric-everything` `badge-pill-spam`
  `hero-mockup-float` `feature-icons-identical` `testimonial-card-triplet`
  `dark-mode-afterthought`
- **Craft signals:** `asymmetric-split` `single-optical-anchor`
  `type-scale-high-contrast` `editorial-grid-break` `custom-type-pairing`
  `motion-tied-to-input` `real-product-screenshot` `density-variation`
  `one-accent-discipline`
- **Contexts:** `hero` `nav` `pricing` `features` `testimonials` `cta`
  `footer` `docs` `dashboard` `empty-state` `404` `auth` `blog-index`
  `article`
- **Cohorts:** `yc-current` `yc-2015-2019` `agent-tools` `design-studio`
  `pre-ai-2015` `print` `architecture` `infographic` `academic-paper`

`yc-2015-2019` and `pre-ai-2015` exist to answer the owner's question about
how people built sites before. They are the control group, not nostalgia.

### Build script

`scripts/build-antislop.ts`, wired into `npm run registry:build`:

1. Validate every evidence file's frontmatter keys and every signal against
   the vocabulary.
2. Resolve every rule's `evidence:` slugs to real files.
3. Compute counts; rewrite the generated markers in rule files and on
   `/guidelines`.
4. Emit `mcp/data/antislop.json`.

### Surfaces

| Surface | Renders | Session |
|---|---|---|
| MCP `get_antislop_rules(context)` | rules + counts + exemplar refs, from the snapshot | 2 |
| `/guidelines` | the canon page, one rule per section | 6 |
| `/writing` | essays citing evidence slugs | 6 |
| `/directory` (new) | sites, tools, repos, with curation from evidence | 5 |
| `/community` | submit an exemplar or a slop sighting | 7 |
| `llms.txt` | rule index appended to the existing generator | 6 |

## Tracks

| Track | What |
|---|---|
| **B** spine | signal vocabulary, schemas, build script, MCP tool |
| **D** field study | YC current + pre-AI, agent-tool companies, teardowns |
| **C** corpus | papers, architecture, infographics, website art, pre-AI web craft |
| **A+E** directory | design sites, tools, registries, GitHub repos — one enumeration job |
| **S** surfaces | guidelines, essays, llms.txt |
| **K** community | submission and promotion flow |

## Session map

| S | Track | Work | Agent team |
|---|---|---|---|
| 1 | — | this spec | none |
| 2 | B | vocabulary, schemas, build script, MCP tool, 12 seed evidence files | architect, then build; `design-taste-frontend` mined for the vocabulary |
| 3 | D | field study, evidence files | 5 research agents in parallel, one cohort each |
| 4 | C | corpus, evidence files | 3 research agents by discipline, `/research` deep mode |
| 5 | A+E | enumerate and ship `/directory` | 3 research agents, then frontend |
| 6 | S | guidelines, essays, llms.txt | frontend, then reviewer |
| 7 | K | community submission and promotion | backend, security-reviewer, database |

Agents write evidence and rule files only. No git, no deploy. The
orchestrator holds the commit boundary. Copy edits, pricing, and any public
claim get surfaced back, never shipped by an agent.

Rationale for D before A: the directory is the hook and is clonable in a
weekend; the evidence base compounds, and the directory's curation reads
better written after 200 sites have been studied than before.

Rationale for K last: public writes need the schema frozen, need exemplars
on the page so submitters know what a good one looks like, and should reuse
`convex/submissions.ts` plus the existing testimonial moderation rather than
inventing a flow.

## Test plan

Lands before the implementation plan. Each criterion is runnable and
numeric.

1. **Missing evidence** — a rule listing 40 slugs with 39 files present
   exits 1 and names the missing slug.
2. **The check can fail** — delete one evidence file, confirm red; restore,
   confirm green. Run before trusting any green build.
3. **Unknown signal** — a signal outside `lib/antislop-vocab.ts` exits 1 and
   names both the signal and the file.
4. **Missing frontmatter** — an evidence file lacking any required key exits
   1 and names the key.
5. **Count integrity** — hand-edit a generated count, run the build, confirm
   it is restored and that a CI diff check goes red.
6. **MCP latency** — `get_antislop_rules("hero")` p95 under 50ms over 100
   calls, zero network calls.
7. **Snapshot size** — `mcp/data/antislop.json` under 2MB at 300 evidence
   files. The registry snapshot is already 12MB; this one stays lean or the
   MCP cold start degrades.
8. **Seed gate** — the build warns until there are at least 12 evidence
   files spanning at least 3 cohorts. No rule is authored before that.
9. **Dead vocabulary** — a signal with zero evidence files two sessions
   after being added is reported, so the vocabulary tracks reality.

## Non-goals

- No ns-ui redesign.
- No new components.
- No crawler or scraping infrastructure. Agents study sources and write
  files; nothing runs on a schedule.
- No auto-updating bot.
- No new runtime dependencies.
- The directory is a static curated list, not a submission queue. Community
  submission covers evidence only.
- No scoring of other people's sites publicly by name as "slop". Evidence
  files record signals; the public surfaces quote aggregate counts and name
  exemplars, not offenders.

## Deferred

- Whether `check_design(html)` — a slop score for pasted markup — belongs in
  the MCP. Attractive, and a separate design once rules exist.
- Whether evidence should carry screenshots. Storage cost against the value
  of a visual record; decide in session 3 when the real volume is known.
