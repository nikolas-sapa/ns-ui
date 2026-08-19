# Changelog

Single source of truth for the /changelog page. Each entry is a `## vX.Y.Z - YYYY-MM-DD`
heading, a `###` title, then one paragraph of body. Newest first.

## v0.24.0 - 2026-08-19

### Round 7: 63 new components, a card that framed itself on the cursor, and the guard that closes it

Sixty-three components landed across six lanes — identity/access & trust (12), money in motion
(12), multiplayer/presence & annotation (12), living systems & growth (12), wayfinding & spatial
(9), reliability & operations (6) — taking the registry from 326 to 389. Two more, sear-notch and
blowdown-seat, were built, passed the gate, and got cut anyway: both worked, neither could be
read. Component pages now carry sidebar prev/next navigation with a position counter, instead of
leaving Newest-sort as the only way to move between them. A reduced-motion audit swept 117
suspects and found four components suppressing state-change feedback rather than vestibular
motion — gauge-capacity-waterline had no passive readout at all, so its value changed with
nothing on screen to show it; the other 107 were already correct and untouched. Separately,
chart-bar-halftone, chart-donut-halftone and loader-thread-spool were framing their catalog cards
on `<SmoothCursor>`'s own `<svg>`, injected into every route ahead of any demo's markup, and
rendering blank — three of the four components that shipped this way, and three of those were
live in production before it was caught. `card.focus` now has to be a scoped selector: `build-autoplay.ts`
fails the build on a bare tag name, naming the component and the actual failure (a bare tag
matches global layout chrome before the demo's own element, not just "invalid selector"), and the
twenty other bare-tag values already in the registry — mostly `canvas` and `button`, verified
harmless only because `svg` happens to be the one tag the layout injects unconditionally — were
converted to scoped selectors rather than grandfathered in, so the next global element the layout
gains doesn't reopen the same hole silently.

## v0.23.0 - 2026-08-12

### Focus that vanished on close, and a rate limit a rejection could reset

The mobile nav drawer closed on Escape and backdrop click without returning focus to its
toggle, leaving a keyboard visitor's focus on an element that had just gone `-translate-x-full
invisible`; it now restores focus the same way `command-palette.tsx` already did. That palette
declared `aria-modal="true"` but only handled Escape, Arrow and Enter, so Tab walked focus
straight out into the sidebar links behind the overlay while the dialog stayed open — Tab is
now trapped on the one real focusable control, the input. Both search inputs, the palette's
field and the sidebar tree filter, were `outline-none` with no focus-visible replacement, so
focusing them produced no visible change at all; `globals.css` had already been written
assuming a ring that nothing supplied. Separately, the testimonial submission cap counted only
rows still `status: "pending"`, so an owner rejection cleared the limiter and the same account
could resubmit immediately — volume was bounded by review speed, not the 24h window. It's now
durable and status-independent in a new `testimonialRateLimits` table. `validateSubmission`,
the Convex-side enforcement point a direct caller reaches by skipping the HTTP route, never
checked `company`, and neither `role` nor `company` had a length bound anywhere; both now share
`MAX_NAME_LENGTH`. The status-snapshot cron compared `CRON_SECRET` with a plain `!==`; it now
uses the constant-time helper already in the codebase. And the rate-limit message that promised
"a submission awaiting review" — untrue once the cap stopped counting pending rows — now states
the actual rule. Riding along: the changelog page's release tide renders instead of an empty
axis, and all 1524 prop rows across the registry's 295 components now carry a description, up
from 706.

## v0.22.0 - 2026-08-06

### A search field instead of a chip, and chrome that now reaches every page

The ⌘K trigger had been getting scaled up for two rounds running — bigger font, bigger
padding, same small chip — and still read as something that got inflated rather than
designed. It's now a proper full-width search field in the sidebar header: magnifier,
muted "Search components…" placeholder, the ⌘K hint right-aligned in its own kbd chip,
opening the same palette it always did. The sidebar's own tree filter, which used to sit
in an identical bordered box one row below and had already caused visitors to assume the
two searched the same thing, is now visually subordinate — borderless, a funnel glyph,
grouped with Expand/Collapse instead of dressed as a second search bar. Every one of the
298 component pages was missing the theme toggle entirely before this pass; it's in the
shell now, alongside a skip link and prev/next navigation between components. The footer
is regrouped into four columns instead of one long run. Smooth scroll (Lenis) and a custom
cursor now run site-wide rather than on isolated pages. `/preview/<slug>/play` is gone,
folded into `/components/<slug>` with a permanent redirect from the old address, and every
component demo now renders inside one shared framed stage — the fixed 520px well that used
to clip taller heroes is gone with it. Canonical tags, noindex on the pages that shouldn't
rank, seven dedicated OpenGraph images and an RSS feed for `/writing` are new. Click
targets were enlarged across 18 routes, and this is the first pass at a mobile layout below
1440px. `/install` and `/theming` are new documentation routes, and the MCP server's token
list is now generated straight from `globals.css` instead of hand-maintained. Saved
components show live previews instead of static placeholders, and props tables show real
default values — 196 of 298 components had been silently missing them. An Ask AI launcher
now sits on `/connect`, every component page, the footer and the homepage; its own popup
auto-dismisses and stops appearing at all after two views instead of nagging indefinitely.
`/status` can no longer fail a production build over a slow CDN response. Copy buttons were
added to descriptions, build specs, props, feed URLs and changelog entries themselves.

## v0.21.0 - 2026-08-05

### Components that installed into the wrong colours, and a status page that can fail

Every component in this registry was styled against tokens the registry never shipped, so
`npx shadcn add` produced components that rendered wrong in someone else's project and
gave no error doing it. `--muted` and `--accent` also collided semantically with stock
shadcn — theirs is a light background and a subtle grey surface, ours was body text and
electric blue — so installed body copy came out nearly invisible. Both are renamed to
`--ns-muted` and `--ns-accent`, and 266 of the 298 registry items now ship a `cssVars`
block so the tokens arrive with the component; `--background`, `--foreground` and
`--border` are deliberately left to inherit from the host theme, because a component that
brings its own background looks foreign in every project it lands in. The registry grew
from 266 to 298: eight ASCII fields built on real mechanisms — Lichtenberg discharge,
Schlieren density gradients, shock diamonds, reaction-diffusion fronts, Voronoi and
magnetic domain walls, force chains, nodal lines — plus ASCII instruments that do a job
(a git graph, a log tail, a flamegraph, a kanban board with WIP limits, a Gantt with a
real critical path). A new /status page reports what is actually true rather than what is
reassuring: it shows no uptime figure until it has recorded days to compute one from, it
says "not measured" where it cannot honestly check, and it refuses to claim sign-in works
because a public query resolving proves only that the backend can be read. Every failure
this registry has ever had returned HTTP 200, which is why a conventional green banner
would have been a lie. Behind it, monitoring now samples every ten minutes and a day's bar
is derived from all of that day's samples, so one lucky ping cannot paint a bad day green.
Convex now deploys as part of the Vercel build — the drift that once left `/submit` and
every account feature returning 200 while completely dead has happened three times, and it
is now structurally impossible rather than merely documented. All 72 preview videos were
regenerated: every one had been named for a slug that no longer existed, so no featured
card had ever moved. The screenshot gate went from covering 266 of 298 components to all
298. Five automated gates now guard the things that used to depend on remembering — focus
rings, disabled states that still react to the mouse, animations that ignore reduced
motion, unreachable categories, stale CSS variables, and functions that exist in the repo
but not on the deployment — and each one was deliberately broken first to prove it fails.

## v0.20.0 - 2026-08-04

### Install URLs that had quietly stopped working, and 38 more components

Every install command published in the CLI and MCP packages had been returning 404. The
223-slug rename shipped after those packages were built, not before, so both were handing
out addresses that no longer existed — and because a failed `npx shadcn add` happens in
someone else's terminal, nothing here would ever have reported it. Every old address now
redirects to its current one, and both packages have been republished with correct data,
so old installs keep working and new ones resolve directly. The registry grew from 228 to
266 components, most of them ASCII instruments: dithered bar, line, funnel, radar,
scatter, waterfall and box-plot charts, a choropleth, sankey, treemap and flow diagram, a
patchbay, seatmap, keymap and spreadsheet range, plus new ASCII backgrounds and heroes.
The catalog's own "Newest" sort had been putting new components last instead of first,
which is fixed. Scrolling the catalog could flip the whole site between light and dark:
the theme-toggle demo shared a storage key with the site itself, and autoplay pressed it
as you scrolled. The homepage no longer shifts its layout while it loads. `/community`,
`/guidelines` and `/submit` are new: the first two are written, and `/submit` opens a pull
request against this repo under your own GitHub account, which needs one more callback URL
registered before it can complete. The screenshot suite that guards every component was
skipping hover, press and focus entirely on 18 of them — anything whose main control is an
input, slider, checkbox or radio — and closing that gap immediately turned up a text field
with no visible keyboard focus state.

## v0.19.0 - 2026-08-02

### Optional accounts, and component pages worth landing on

You can now sign in with GitHub, Google or an emailed code and save components to your
account. Signing in stays entirely optional: `npx shadcn add`, the CLI and the MCP server
all work with no account, and the catalog is unchanged for anyone browsing without one.
Component pages moved from `/preview/<slug>` to `/components/<slug>`, while the install
URLs at `/r/<slug>.json` are untouched, so every install command anyone has already run
still works. Those pages used to be the live demo and nothing else, and now carry the
component's name, description, its own install command, a props table, dependencies and
tags, which is also why all 228 components are in the sitemap for the first time with
structured data behind them. Next.js moved from 16.2.10 to 16.2.11 for a security fix.
Deleting an account is specified but not built yet.

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
