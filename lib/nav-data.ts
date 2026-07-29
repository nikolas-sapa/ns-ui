import registry from "@/registry.json";
import order from "@/lib/component-order.json";
import { CATEGORIES, categorize } from "@/lib/search-categories";

export type NavItem = { name: string; title: string; loud: boolean };
export type NavGroup = { id: string; label: string; items: NavItem[] };

/**
 * The sidebar's grouped component list.
 *
 * `categorize()` returns EVERY category a component belongs to, which is right
 * for filter chips (a chip should find it) and wrong for a nav tree (the same
 * slug appearing under four headings reads as four components). So each
 * component is placed in its FIRST matching category only — CATEGORIES order
 * is already curated newcomer-first — and anything with no match lands in
 * "Other" rather than disappearing.
 */
export function navGroups(): NavGroup[] {
  const items = registry.items.map((i) => ({
    name: i.name,
    title: i.title,
    tags: i.meta?.tags ?? [],
    loud: (i.meta?.collection ?? "core") === "loud",
  }));

  const memberships = categorize(items);
  const rank = new Map((order as string[]).map((name, i) => [name, i]));
  const buckets = new Map<string, NavItem[]>();

  for (const item of items) {
    const id = memberships.get(item.name)?.[0] ?? "other";
    const list = buckets.get(id) ?? [];
    list.push({ name: item.name, title: item.title, loud: item.loud });
    buckets.set(id, list);
  }

  // Newest first inside a group, same recency snapshot the catalog sorts by.
  const byRecency = (a: NavItem, b: NavItem) =>
    (rank.get(a.name) ?? Number.MAX_SAFE_INTEGER) -
    (rank.get(b.name) ?? Number.MAX_SAFE_INTEGER);

  const groups: NavGroup[] = CATEGORIES.map((c) => ({
    id: c.id,
    label: c.label,
    items: (buckets.get(c.id) ?? []).sort(byRecency),
  })).filter((g) => g.items.length > 0);

  const other = buckets.get("other");
  if (other?.length) {
    groups.push({ id: "other", label: "Other", items: other.sort(byRecency) });
  }
  return groups;
}
