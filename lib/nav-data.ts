// Client-safe projection of registry.json (build-registry.ts generates it) —
// a bare `registry.json` import here would pull every component's full record
// (instruction prose, files, dependencies, cssVars) into anything that reaches
// this module, for a sidebar tree that only reads name/title/tags/collection/
// rank.
//
// This module is SERVER-ONLY now: `app/layout.tsx` calls `navGroups()` for the
// category summary, `app/nav-tree.json/route.ts` prerenders the full tree, and
// `app/components/[name]/page.tsx` walks it for prev/next. Nothing with
// "use client" may import it — see `lib/nav-tree.ts` for why that rule is not
// cosmetic.
import registry from "@/lib/registry-lite.generated.json";
import order from "@/lib/component-order.json";
import { CATEGORIES, categorize } from "@/lib/search-categories";
import { kindOf } from "@/lib/kind";
import type { NavGroup, NavItem, NavKind } from "@/lib/nav-tree";

// The shapes and the pure walks live in `lib/nav-tree.ts`, which imports no
// registry — `site-shell.tsx` needs them on the client, and importing them
// from here dragged the 136.7 KB `registry-lite.generated.json` into the
// client bundle with them. Re-exported so server callers keep one import.
export type { NavItem, NavKind, NavGroup, NavSummary } from "@/lib/nav-tree";
export { flatOrder, locate, packNavTree, summarizeNav } from "@/lib/nav-tree";

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/**
 * The sidebar's grouped, two-level component tree: category -> kind -> item.
 *
 * `categorize()` returns EVERY category a component belongs to, and the tree
 * now lists a component under every one of them — the same multi-match rule
 * the catalog's filter chips already use, so "Overlays" means the same 31
 * components whether you find them by chip or by opening the tree. A
 * component that is genuinely both a hero and a background IS both; filing
 * it under only the first match hid it from whichever category it lost the
 * tiebreak in, and a visitor scanning "Backgrounds" for it would come up
 * empty. Duplication across sections costs nothing to scroll past — a
 * missing component costs the thing someone came here for. (This used to be
 * first-match-only, to keep the tree from listing anything twice; that
 * produced sidebar counts that silently disagreed with the chips a few
 * hundred pixels away, which is worse than the duplication it avoided.)
 *
 * The kind level is measured, not assumed: histogrammed across the registry,
 * most categories are spiky — a handful of kinds with real membership (Loader
 * x8, Slider x6) next to a long tail of one-offs (Signature x1, Moire x1). A
 * uniform three-level tree makes those singletons *worse* to reach (one extra
 * click for nothing), so only kinds with 2+ members become their own
 * collapsible group; everything else — including the ~27% of components
 * `kindOf` can't label — renders flat under the category, same depth as today.
 *
 * Memoized at module scope. It is a pure function of two module-level JSON
 * imports (`registry-lite.generated.json`, `component-order.json`) with no
 * arguments and no environment reads, and the whole thing is a rebuild from
 * scratch each call: a map over all 534 entries, `categorize()`, two Maps, the
 * bucket loop, then a sort per category and per kind. `app/layout.tsx` calls
 * it via `summarizeNav` on EVERY rendered route, so an unmemoized version ran
 * that recompute 591+ times per build — once per static page — plus once more
 * per component page for `flatOrder`, and again for `/nav-tree.json`. Same
 * shape of fix as `lib/use-when.ts`'s cache, for the same reason.
 *
 * Returning the shared instance is safe because every consumer is read-only:
 * `summarizeNav` and `packNavTree` only map over it, `flatOrder` only walks it
 * and pushes into an array it created itself, and `filterGroups` (site-shell)
 * operates on the client's own fetched copy, not on this one. The in-place
 * `sort`s below all run on arrays built inside this call, before it returns.
 * If a future caller needs to mutate the tree, it must copy — do not add a
 * mutation here and rely on the caller getting a fresh one.
 */
let cached: NavGroup[] | null = null;

export function navGroups(): NavGroup[] {
  if (cached) return cached;
  const items = registry.map((i) => ({
    name: i.name,
    title: i.title,
    tags: i.tags ?? [],
    loud: (i.collection ?? "core") === "loud",
  }));

  const memberships = categorize(items);
  const rank = new Map((order as string[]).map((name, i) => [name, i]));
  // Owner's taste ranking (meta.json `rank`), same tie-break shape as
  // `rank`/`recency` above — unset resolves to Infinity, a no-op that
  // defers straight to the existing recency order. See app/page.tsx's
  // `componentRank` for the identical rule on the catalog side; the two
  // must not diverge.
  const tasteRank = new Map(registry.map((i) => [i.name, i.rank]));
  const byTaste = (name: string) => tasteRank.get(name) ?? Number.MAX_SAFE_INTEGER;
  const buckets = new Map<string, (NavItem & { kind: string | null })[]>();

  for (const item of items) {
    const ids = memberships.get(item.name);
    for (const id of ids?.length ? ids : ["other"]) {
      const list = buckets.get(id) ?? [];
      list.push({
        name: item.name,
        title: item.title,
        loud: item.loud,
        kind: kindOf(item.tags),
      });
      buckets.set(id, list);
    }
  }

  // Ranked-first, then newest — same recency snapshot the catalog sorts by.
  const byRecency = (a: NavItem, b: NavItem) =>
    byTaste(a.name) - byTaste(b.name) ||
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
  cached = groups;
  return groups;
}
