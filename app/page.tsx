import type { Metadata } from "next";
import registry from "@/registry.json";
import { loadUseWhen } from "@/lib/use-when";
import { kindOf } from "@/lib/kind";
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

/** The lead sentence carries the component's job; the rest is build detail. */
const firstSentence = (text: string) => text.split(/(?<=\.)\s/, 1)[0] ?? "";

/**
 * `useWhen` is written as "use for X, not Y" — and the Y half made searching
 * lie: button-glass says "not a destructive action needing deliberate
 * confirmation", so it surfaced for "confirm". The negative clause is guidance
 * for a reader, never a match target, so it is dropped here.
 */
const dropNegatives = (text: string) => text.replace(/,\s*not\b[^.;]*/g, "");

const useWhen = loadUseWhen();

const items: ShowcaseEntry[] = registry.items
  .map((item) => ({
    name: item.name,
    title: item.title,
    description: item.description,
    collection: item.meta?.collection ?? "core",
    // Plain-language label beside the metaphorical name — see lib/kind.ts.
    kind: kindOf(item.meta?.tags),
    // Search matches tags too, so the projection carries them to the client.
    tags: item.meta?.tags ?? [],
    // …and the two plainest-spoken fields the registry has, so a descriptive
    // query ("reacts to the cursor") finds something.
    prose: dropNegatives(
      `${useWhen[item.name] ?? ""} ${firstSentence(item.meta?.instruction ?? "")}`,
    ).trim(),
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
    itemListElement: registry.items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${REGISTRY_ORIGIN}/components/${item.name}`,
      name: item.title,
    })),
  },
};

// Identity, separate from the catalog listing above: `CollectionPage` says
// what this PAGE is, and an agent reading it still cannot tell what ns-ui IS
// or who stands behind it. SoftwareApplication + Organization are the two
// types that answer those, linked by @id so the three read as one graph
// rather than three unrelated blocks.
//
// `address` is deliberately absent — schema.org PostalAddress wants a real
// one, and this project has no published business address. An invented
// address is worse than a missing field. See the change summary.
const identityJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": `${REGISTRY_ORIGIN}/#software`,
      name: "ns-ui",
      url: REGISTRY_ORIGIN,
      description:
        "A registry of React components you install by URL — each built around a single interaction, each installed as plain source with no runtime package.",
      applicationCategory: "DeveloperApplication",
      applicationSubCategory: "React component registry",
      operatingSystem: "Any",
      softwareRequirements: "React 19+, Tailwind CSS v4",
      license: "https://opensource.org/licenses/MIT",
      // Free, and saying so in the field agents actually read for price.
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      codeRepository: "https://github.com/nikolas-sapa/ns-ui",
      author: { "@id": `${REGISTRY_ORIGIN}/#organization` },
      publisher: { "@id": `${REGISTRY_ORIGIN}/#organization` },
    },
    {
      "@type": "Organization",
      "@id": `${REGISTRY_ORIGIN}/#organization`,
      name: "ns-ui",
      alternateName: "ns-ui component registry",
      url: REGISTRY_ORIGIN,
      logo: `${REGISTRY_ORIGIN}/opengraph-image`,
      description:
        "The maintainer of ns-ui, an open-source (MIT) registry of React components for shadcn-compatible tooling.",
      founder: { "@type": "Person", name: "Nikolas Sapalidis" },
      sameAs: [
        "https://github.com/nikolas-sapa/ns-ui",
        "https://www.npmjs.com/package/@nikolas.sapa/ns-ui",
        "https://www.npmjs.com/package/@nikolas.sapa/ns-ui-mcp",
      ],
      // The same address SECURITY.md and CODE_OF_CONDUCT.md already publish —
      // not a new one invented for this markup.
      contactPoint: [
        {
          "@type": "ContactPoint",
          contactType: "technical support",
          email: "nikolas.sapalidis@gmail.com",
          url: `${REGISTRY_ORIGIN}/about`,
          availableLanguage: ["English"],
        },
        {
          "@type": "ContactPoint",
          contactType: "security",
          email: "nikolas.sapalidis@gmail.com",
          url: "https://github.com/nikolas-sapa/ns-ui/security/advisories/new",
        },
      ],
    },
  ],
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(identityJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(collectionPageJsonLd) }}
      />
      <Showcase items={items} featured={featured} stars={stars} />
    </>
  );
}
