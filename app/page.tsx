import registry from "@/registry.json";
import { loadUseWhen } from "@/lib/use-when";
import order from "@/lib/component-order.json";
import { FEATURED } from "@/lib/featured";
import { getStarCount } from "@/lib/github-stars";
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

/** The lead sentence carries the component's job; the rest is build detail. */
const firstSentence = (text: string) => text.split(/(?<=\.)\s/, 1)[0] ?? "";

/**
 * `useWhen` is written as "use for X, not Y" — and the Y half made searching
 * lie: glass-button says "not a destructive action needing deliberate
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
      featuredRank(a.name) - featuredRank(b.name) ||
      recency(a.name) - recency(b.name) ||
      a.title.localeCompare(b.title),
  );

const featured = [...featuredOrder.keys()];

export default async function Home() {
  const stars = await getStarCount();
  return <Showcase items={items} featured={featured} stars={stars} />;
}
