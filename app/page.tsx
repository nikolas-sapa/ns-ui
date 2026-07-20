import registry from "@/registry.json";
import { Showcase } from "./_components/showcase";
import type { RegistryEntry } from "./_components/preview-card";

const items: RegistryEntry[] = registry.items
  .map((item) => ({
    name: item.name,
    title: item.title,
    description: item.description,
    collection: item.meta?.collection ?? "core",
  }))
  .sort((a, b) => a.title.localeCompare(b.title));

export default function Home() {
  return <Showcase items={items} />;
}
