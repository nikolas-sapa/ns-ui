import registry from "@/registry.json";
import order from "@/lib/component-order.json";
import { CATEGORIES, categorize } from "@/lib/search-categories";

export type CategoryMember = { name: string; title: string; description: string };
export type CategoryPageData = { id: string; label: string; members: CategoryMember[] };

// Same recency rank `nav-data.ts` and `app/page.tsx` sort by, so a category
// page lists members in the same order the sidebar tree does.
const rank = new Map((order as string[]).map((name, i) => [name, i]));
const recency = (name: string) => rank.get(name) ?? Number.MAX_SAFE_INTEGER;

/**
 * One category's members, computed from real registry tags via
 * `categorize()` — never a hand-authored list. Server-only (reads
 * `registry.json`/`component-order.json` directly) and imported solely by
 * `app/categories/**`, so it never touches `/`'s client bundle.
 */
export function categoryPages(): CategoryPageData[] {
  const items = registry.items.map((i) => ({
    name: i.name,
    title: i.title,
    description: i.description,
    tags: i.meta?.tags ?? [],
  }));
  const memberships = categorize(items);

  return CATEGORIES.map((c) => {
    const members = items
      .filter((i) => memberships.get(i.name)?.includes(c.id))
      .sort((a, b) => recency(a.name) - recency(b.name))
      .map((i) => ({ name: i.name, title: i.title, description: i.description }));
    return { id: c.id, label: c.label, members };
  });
}

/** A single component's category memberships (ids + labels), for linking
 *  the tag row on `/components/[name]` back to `/categories/<id>`. */
export function categoriesFor(name: string, tags: string[]): { id: string; label: string }[] {
  const memberships = categorize([{ name, tags }]);
  const ids = new Set(memberships.get(name) ?? []);
  return CATEGORIES.filter((c) => ids.has(c.id)).map((c) => ({ id: c.id, label: c.label }));
}
