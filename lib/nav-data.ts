import registry from "@/registry.json";
import order from "@/lib/component-order.json";
import { CATEGORIES, categorize } from "@/lib/search-categories";
import { kindOf } from "@/lib/kind";

export type NavItem = { name: string; title: string; loud: boolean };
/** A `kind` sub-group inside a category — see `kindOf` for the label. */
export type NavKind = { id: string; label: string; items: NavItem[] };
export type NavGroup = {
  id: string;
  label: string;
  /** Total components in this category, kinds + loose items combined. */
  count: number;
  /** Kinds with 2+ members — worth their own collapsible level. */
  kinds: NavKind[];
  /** Components whose kind is a singleton (or tagless) — rendered flat,
   *  directly under the category, not wrapped in a redundant one-item group. */
  items: NavItem[];
};

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/**
 * The sidebar's grouped, two-level component tree: category -> kind -> item.
 *
 * `categorize()` returns EVERY category a component belongs to, which is right
 * for filter chips (a chip should find it) and wrong for a nav tree (the same
 * slug appearing under four headings reads as four components). So each
 * component is placed in its FIRST matching category only — CATEGORIES order
 * is already curated newcomer-first — and anything with no match lands in
 * "Other" rather than disappearing.
 *
 * The kind level is measured, not assumed: histogrammed across the registry,
 * most categories are spiky — a handful of kinds with real membership (Loader
 * x8, Slider x6) next to a long tail of one-offs (Signature x1, Moire x1). A
 * uniform three-level tree makes those singletons *worse* to reach (one extra
 * click for nothing), so only kinds with 2+ members become their own
 * collapsible group; everything else — including the ~27% of components
 * `kindOf` can't label — renders flat under the category, same depth as today.
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
  const buckets = new Map<string, (NavItem & { kind: string | null })[]>();

  for (const item of items) {
    const id = memberships.get(item.name)?.[0] ?? "other";
    const list = buckets.get(id) ?? [];
    list.push({
      name: item.name,
      title: item.title,
      loud: item.loud,
      kind: kindOf(item.tags),
    });
    buckets.set(id, list);
  }

  // Newest first inside a group/kind, same recency snapshot the catalog sorts by.
  const byRecency = (a: NavItem, b: NavItem) =>
    (rank.get(a.name) ?? Number.MAX_SAFE_INTEGER) -
    (rank.get(b.name) ?? Number.MAX_SAFE_INTEGER);

  const split = (categoryId: string, members: (NavItem & { kind: string | null })[]) => {
    const byKind = new Map<string, NavItem[]>();
    for (const m of members) {
      if (!m.kind) continue;
      const list = byKind.get(m.kind) ?? [];
      list.push(m);
      byKind.set(m.kind, list);
    }

    const kinds: NavKind[] = [];
    const loose: NavItem[] = [];
    const claimed = new Set<string>();

    for (const [label, kindItems] of byKind) {
      if (kindItems.length < 2) continue;
      kinds.push({
        id: `${categoryId}:${slugify(label)}`,
        label,
        items: kindItems.sort(byRecency),
      });
      for (const i of kindItems) claimed.add(i.name);
    }
    for (const m of members) {
      if (!claimed.has(m.name)) loose.push({ name: m.name, title: m.title, loud: m.loud });
    }

    // Real clusters first (biggest first — that's what a visitor scans for),
    // singletons after, both newest-first within themselves.
    kinds.sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label));
    loose.sort(byRecency);
    return { kinds, loose };
  };

  const groups: NavGroup[] = CATEGORIES.map((c) => {
    const members = buckets.get(c.id) ?? [];
    const { kinds, loose } = split(c.id, members);
    return { id: c.id, label: c.label, count: members.length, kinds, items: loose };
  }).filter((g) => g.count > 0);

  const other = buckets.get("other");
  if (other?.length) {
    const { kinds, loose } = split("other", other);
    groups.push({ id: "other", label: "Other", count: other.length, kinds, items: loose });
  }
  return groups;
}

/** Where a component lives in the tree, for auto-opening its section on
 *  navigation — `null` if it's not in the registry (shouldn't happen for a
 *  real slug, but a stale link degrades to "nothing auto-opens" rather than
 *  a crash). */
export function locate(
  groups: NavGroup[],
  name: string,
): { groupId: string; kindId: string | null } | null {
  for (const g of groups) {
    for (const k of g.kinds) {
      if (k.items.some((i) => i.name === name)) return { groupId: g.id, kindId: k.id };
    }
    if (g.items.some((i) => i.name === name)) return { groupId: g.id, kindId: null };
  }
  return null;
}
