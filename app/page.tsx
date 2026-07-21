import registry from "@/registry.json";
import { loadUseWhen } from "@/lib/use-when";
import { Showcase, type ShowcaseEntry } from "./_components/showcase";

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
  }))
  .sort((a, b) => a.title.localeCompare(b.title));

export default function Home() {
  return <Showcase items={items} />;
}
