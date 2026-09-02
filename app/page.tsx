import type { Metadata } from "next";
import registry from "@/registry.json";
import { kindOf } from "@/lib/kind";
import { categorize } from "@/lib/search-categories";
import order from "@/lib/component-order.json";
import { FEATURED } from "@/lib/featured";
import { getStarCount } from "@/lib/github-stars";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";
import { jsonLdScript } from "@/lib/json-ld";
import { Showcase, type ShowcaseEntry } from "./_components/showcase";

// Newest first. `component-order.json` is the slug list sorted by git creation
// date (regenerate with `npm run order:build` after adding components).
// A slug missing from the snapshot sorts last, so a freshly-added component is
// visible rather than hidden until the order is regenerated.
const rank = new Map((order as string[]).map((name, i) => [name, i]));
const recency = (name: string) => rank.get(name) ?? Number.MAX_SAFE_INTEGER;

// "New" badge + the Newest/Oldest sort both need this same recency number on
// the client, so it travels with each entry rather than being re-derived
// there. `component-order.json` holds no timestamps (build-order.ts computes
// them, then drops them before writing the flat slug array) — so "new" is
// defined by position, not by age: the NEW_COUNT most recently added slugs.
const NEW_COUNT = 16;

// Curated slugs, filtered against what actually exists so a rename or
// removal in `registry/` (owned by sibling agents) degrades quietly instead
// of leaving a dead slug in the featured rail.
const registryNames = new Set(registry.items.map((i) => i.name));
const featuredOrder = new Map(
  FEATURED.filter((name) => registryNames.has(name)).map((name, i) => [name, i]),
);
const featuredRank = (name: string) =>
  featuredOrder.get(name) ?? Number.MAX_SAFE_INTEGER;

// Owner's taste ranking (meta.json `rank`, lower = better) — sorts ahead of
// everything else below. Unset (the common case: not every component has
// one yet) resolves to Infinity, which is a no-op in the comparator: it
// just defers to the existing featured/recency order, so a component
// without a rank sits exactly where it always did rather than jumping
// behind every ranked one as a block.
const rankByName = new Map(registry.items.map((i) => [i.name, i.meta?.rank]));
const componentRank = (name: string) => rankByName.get(name) ?? Number.MAX_SAFE_INTEGER;

// Category membership, resolved here rather than on the client. It used to be
// derived there by handing every component's `meta.tags` across the boundary
// and running `categorize()` over them — 41.8 KB of tags in the document to
// produce, per component, one to three short category ids. The client needs
// the ids (chip counts on first paint, the category filter, the "other"
// catch-all), never the tags, and `categorize()` is the same pure function
// the sidebar and /categories call, so nothing can disagree by being computed
// on a different side of the wire.
//
// The rest of the search haystack — tags, useWhen, the instruction's lead
// sentence — is not here at all any more: it is served from
// /search-index.json (lib/search-corpus.ts) and fetched on the first sign of
// a search.
const memberships = categorize(
  registry.items.map((item) => ({
    name: item.name,
    tags: item.meta?.tags ?? [],
  })),
);

const items: ShowcaseEntry[] = registry.items
  .map((item) => ({
    name: item.name,
    title: item.title,
    description: item.description,
    collection: item.meta?.collection ?? "core",
    // Plain-language label beside the metaphorical name — see lib/kind.ts.
    kind: kindOf(item.meta?.tags),
    cats: memberships.get(item.name) ?? [],
    order: recency(item.name),
    isNew: recency(item.name) < NEW_COUNT,
  }))
  .sort(
    (a, b) =>
      componentRank(a.name) - componentRank(b.name) ||
      featuredRank(a.name) - featuredRank(b.name) ||
      recency(a.name) - recency(b.name) ||
      a.title.localeCompare(b.title),
  );

const featured = [...featuredOrder.keys()];

// Count comes from `registry.items.length` at build time, not a hardcoded
// number — this codebase has a history of stale counts (218, 222, 223) baked
// in as literals that drifted the moment a component was added or removed.
//
// `numberOfItems` still reports the whole registry; `itemListElement`
// enumerates only the featured rail. Measured, the full enumeration was
// 69.3 KB of the homepage document — the single largest thing on it that no
// visitor ever sees. It bought nothing: `app/sitemap.ts` already lists every
// `/components/<name>` URL, which is where crawlers look for enumeration,
// and `/categories/<id>` server-renders the members of each category as real
// links. A partial `ItemList` under a correct `numberOfItems` is the shape
// schema.org documents for a paged/curated listing, so this is not a lie
// about the collection's size — it is the excerpt this page actually shows.
const listed = FEATURED.filter((name) => registryNames.has(name));
const titleByName = new Map(registry.items.map((i) => [i.name, i.title]));
const collectionPageJsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "ns-ui",
  url: REGISTRY_ORIGIN,
  isPartOf: { "@id": `${REGISTRY_ORIGIN}/#software` },
  publisher: { "@id": `${REGISTRY_ORIGIN}/#organization` },
  mainEntity: {
    "@type": "ItemList",
    numberOfItems: registry.items.length,
    itemListElement: listed.map((name, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${REGISTRY_ORIGIN}/components/${name}`,
      name: titleByName.get(name) ?? name,
    })),
  },
};

export const metadata: Metadata = {
  // The audited gap: without this, every agent resolving the homepage has to
  // guess which host is canonical (the vercel.app alias also serves this
  // exact HTML — see lib/registry-origin.ts).
  alternates: { canonical: "/" },
};

export default async function Home() {
  const stars = await getStarCount();
  return (
    <>
      <Showcase items={items} featured={featured} stars={stars} />
      {/* The catalog listing goes LAST: it used to serialize an ItemList for
          the full registry (~69KB measured), and while it sat ahead of the
          markup it pushed this page's <h1> to byte 63,882 — past where agents
          that truncate a fetch stop reading, which is why an audit reported
          "no H1" on a page that has always server-rendered one. It is small
          now that it enumerates only the featured rail, but it stays here:
          nothing needs it early, and last is the position that cannot
          regress the <h1> if the list ever grows again.

          The identity graph (SoftwareApplication + Organization) does NOT
          live here for the mirror-image reason: moved down with this block,
          it fell off the end of a 2.3MB document and the next audit reported
          no JSON-LD at all. It is small and it is required to be found, so it
          renders in <head> from app/layout.tsx instead — early enough that no
          truncation can miss it, and on every page rather than just this
          one. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(collectionPageJsonLd) }}
      />
    </>
  );
}
