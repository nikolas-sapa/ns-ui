# Changelog

Single source of truth for the /changelog page. Each entry is a `## vX.Y.Z - YYYY-MM-DD`
heading, a `###` title, then one paragraph of body. Newest first.

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
