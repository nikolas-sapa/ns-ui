import registry from "@/registry.json";
import { Showcase, type ShowcaseEntry } from "./_components/showcase";

const items: ShowcaseEntry[] = registry.items
  .map((item) => ({
    name: item.name,
    title: item.title,
    description: item.description,
    collection: item.meta?.collection ?? "core",
    // Search matches tags too, so the projection carries them to the client.
    tags: item.meta?.tags ?? [],
  }))
  .sort((a, b) => a.title.localeCompare(b.title));

export default function Home() {
  return <Showcase items={items} />;
}
