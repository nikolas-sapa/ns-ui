# Changelog

Single source of truth for the /changelog page. Each entry is a `## vX.Y.Z - YYYY-MM-DD`
heading, a `###` title, then one paragraph of body. Newest first.

## v0.18.0 - 2026-08-01

### Keyboard focus covers the card, and five smaller defects

Tabbing the grid drew a focus ring in the corner of a card while a mouse got the whole
card as one hit target, the same accessibility mismatch on the site's primary content.
The ring now lives on the element hover already highlights, verified with real Tab key
events rather than a bare .focus() call, which would not have caught it. Five smaller
polish defects went with it: the footer stopped spreading three unrelated lines
edge-to-edge at desktop width, mobile filter chips became a two-column grid instead of
one per row with dead space beside it, the sidebar's component search and the catalog's
own search now say which is which since they do different jobs, the Sort select wears
the site's own chevron instead of the browser's, and card hover gained a perceptible
wash since brightening a hairline border was invisible against a near-black demo.
docs/polish-audit.md records every item considered, including one left alone on purpose.

## v0.17.0 - 2026-08-01

### A collapsible sidebar, and a count it agrees with

Category now opens to kind (Slider, Loader, Tabs) and kind opens to components, each
level counted, because a flat 223-item list under 12 categories was still a list. A kind
only earns its own group at two or more members, so a category with 35 kinds and 25
singletons doesn't add a click to reach a third of the registry for nothing. The count
next to each category in the sidebar had drifted from the number on the matching filter
chip, 61 versus 55 for Inputs & forms, because the tree filed a component under its
first matching category while the chips counted every match. Both now use the same
multi-match rule, verified sidebar against chip across all twelve categories.

## v0.16.0 - 2026-07-31

### Plain-language labels, raw source, and an MCP server

Component names kept their metaphor at this point, renaming 223 of them was a separate
decision for later, but each now carries a plain "kind" caption derived from the tag each
meta.json already carries: Nested Slug reads as Nested Slug / Hero, not something you
click through to understand. The playground gained a Source disclosure showing the real
component.tsx with a copy button, since these install as plain files with no runtime
package, so the source is the artifact. And a stdio MCP server shipped alongside the
CLI: five tools, search, full detail plus source, categories, the install command, and
the design-token conventions, so an agent building against the registry keeps the token
contract in context for a session instead of re-fetching it.

## v0.15.0 - 2026-07-31

### A colour gap filled, and two components that didn't belong

tide-ledger, a calendar heatmap on a five-step sequential ramp mixed at runtime from
--accent into --background, joined the registry. Two siblings built alongside it in the
same pass, gel-wash (a theatre-lantern preloader) and footing-course (a footer the page
slides off), came out again: both were built from a bookmarked slug rather than from the
thing the slug was pointing at, so they answered a category rather than the actual gap.
The backlog behind all three is now one organized document across the 21st.dev bookmark
sweep and a name-level diff against seven other component ecosystems, ordered by what
unlocks a whole page rather than what is easiest to build next.

## v0.14.0 - 2026-07-29

### Open to contributions

The repo got the scaffolding a public project needs: CI running the registry build, typecheck
and production build on every pull request, issue templates for bugs and component requests, a
pull request template, a code of conduct, a security policy, and a contributing guide that walks
an outside contributor from an empty folder to a passing verify gate. The README was rewritten
around what the registry is for rather than how it was made, and the agent-only scaffolding used
to build it started coming out of the tree.

## v0.13.0 - 2026-07-29

### Every component checked in both themes, and at card size

Two defect classes only show up where nobody looks. One is a component that reads correctly in
dark and collapses in light. The other is a grid thumbnail framed on the wrong element, cropping
away the very thing the component exists to show. All 197 were swept for both. Ten card-crop
cases were fixed by giving each a `card.focus` selector aimed at the element the component is
actually about, checked on the homepage grid rather than on the full preview route where the
defect is invisible.

## v0.12.0 - 2026-07-28

### A fourth build round, and the components that needed a second look

Twenty-eight components merged from a fourth parallel round, 21 core and 7 loud, among them a
Solari departures board, a peelable decal, a plimsoll gauge and a vortex street. That took the
registry to 198, and tack-peel came out for good, leaving 197. Several older components got the
second look they needed: umbra-toggle's controlled state had drifted out of sync and its demo
was inert, decal-peel inverted its gradient in the light theme, carbon-lift's ghost duplicate
travelled a fixed 12px regardless of how far it actually had to go, solari-flap grew from one row
to a four-row board, and patina-pip and stipple-year were made legible at card size.

## v0.11.0 - 2026-07-22

### Fifteen cut, and four rounds of owner review

The parallel round produced more than it deserved to keep. Fifteen slop and duplicate components
were removed, taking the registry from 185 to 170, and one that a merge resurrected had to be cut
twice. What remained went through four rounds of owner review: ten flagged components repaired,
then 17 interaction bugs, then 8 more including reworks of earlier fixes, then a ridge-walk
redesign and six more reworks. Three hardcoded hexes were found and killed. The verifier stopped
aborting the whole sweep when a single component threw, and started printing every failure rather
than only the first.

## v0.10.0 - 2026-07-22

### The registry roughly tripled, built in parallel

Six git worktrees, each its own branch and dev port, ran the same ideate-judge-build-gate
workflow across a different lane of the design space, then merged back conflict-free because
every component is a self-contained folder and the registration index is generated, not
hand-edited. The registry crossed 185 components spanning inputs, data instruments, typography,
feedback, motion, agent surfaces and loud showpieces, with slug collisions prevented by a
cross-branch check rather than coordination.

## v0.9.0 - 2026-07-22

### An agent-UI category, and typing that demonstrates itself

A first set of AI and agent-interface primitives landed: a thinking-state glyph that encodes
its state through motion rather than colour, a streaming-text renderer, a reasoning timeline, a
tool-call approval row, a context-window budget meter and more. The autoplay driver learned a
`type` mode, so keyboard-first components like the OTP reels now type their own demo in the grid
instead of resting on a still frame.

## v0.8.0 - 2026-07-21

### Search, a runnable install command, and this page

The grid got a client-side search over name, title, description and tags, composed with the
collection filter. The header install command now shows a real component name instead of a
`[name]` placeholder, so what lands on the clipboard actually runs. This page is itself the
`strandline` component from the registry, fed real releases.

## v0.7.0 - 2026-07-21

### Cards demonstrate themselves

A shared autoplay driver synthesises pointer, scroll, press and drag input from an `autoplay`
descriptor in each component's meta.json. 37 components that previously sat still until touched
now demonstrate themselves in the grid.

## v0.6.0 - 2026-07-21

### One origin, one theme switch

The registry origin became a single source of truth, so llms.txt and the showcase can no longer
drift apart. /registry.json moved to its conventional path and llms.txt learned to disambiguate.
A real light/dark toggle landed with a system-preference default and no first-paint flash.

## v0.5.0 - 2026-07-20

### The landing page became a live preview grid

Every card is the real component running, not a screenshot. Emulating a viewport with a scaled
div drifted at every window shape, so each card is now an iframe onto a real 1440x900 viewport,
CSS-scaled into place.

## v0.4.0 - 2026-07-20

### Registry live, and readable by agents

MIT licensed, published, and given llms.txt plus llms-full.txt so an agent can consume the whole
catalogue without an MCP server. TypeScript was pinned back to 5.x after v7 shipped no
lib/typescript.js and broke the Next build.

## v0.3.0 - 2026-07-18

### Audit fleet

24 confirmed bugs and 8 broken light themes fixed across 17 components, then two rounds of owner
tuning across thirteen more. Nothing new shipped; everything already there got honest.

## v0.2.0 - 2026-07-18

### Harvest and breeding rounds

A 56-site research harvest and a 14-site crawl catalogued 1,535 components and fed a breeder
workflow. Four fusion batches took the registry from a handful to 50, with an ambient-motion pass
across all of them.

## v0.1.0 - 2026-07-17

### Walking skeleton

Spec, owner taste profile, ticket breakdown, then the first working loop: a preview site, a
registry build pipeline generated from meta.json sidecars, and a verify quality gate.
glass-button and the particle-hero flagship were the first two components in.
