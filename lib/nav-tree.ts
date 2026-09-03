/**
 * The sidebar tree's shapes and its pure walks — and nothing that imports the
 * registry.
 *
 * That last part is the entire reason this file exists separately from
 * `lib/nav-data.ts`. `site-shell.tsx` is a Client Component and needs
 * `flatOrder`/`locate`/the types; importing them from `nav-data.ts` dragged
 * that module's `import registry from "@/lib/registry-lite.generated.json"`
 * into the client graph with them, and the bundler inlines a JSON import
 * verbatim. Measured by deleting the inlined array from the built chunk and
 * recompressing: `433s_kwy47172.js` goes 143.4 -> 56.2 KB raw, 36.5 -> 15.5 KB
 * gz, 31.4 -> 13.7 KB br. That chunk is loaded by 562 of the 567 prerendered
 * documents — including all twelve concurrent card iframes, each of which
 * parses the 534-entry array again in its own realm. A tree-shaker cannot drop
 * it, because `navGroups()` and the JSON live in the same module; only cutting
 * the import edge can, which is what this split does.
 *
 * The 56.2 KB that remains is `lenis`, pulled in by `SmoothScroll` in the root
 * layout. Dropping that from the card-iframe route needs a second root layout
 * via route groups, i.e. moving every other route under `app/(site)/` — out of
 * scope here, and deliberately not attempted.
 */

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

/**
 * What the server actually renders into every document now: one row per
 * category, no items. The tree's 534 components (≥728 rows once the
 * multi-match rule duplicates them) arrive from `/nav-tree.json` instead.
 *
 * `total` is carried rather than derived because it cannot be derived from
 * these rows: a component belongs to every category its tags match, so
 * summing `count` double-counts. It is the number beside the wordmark, and
 * the comment on the old client-side `total` is explicit that it has to
 * match the catalog's "N shown".
 */
export type NavSummary = {
  groups: { id: string; label: string; count: number }[];
  /** Unique components across the whole tree — also `flat.length`, since
   *  `flatOrder` dedupes to exactly that set. */
  total: number;
};

/**
 * Wire form of the tree, indices instead of repeated strings.
 *
 * A component listed under three categories appears three times in the tree
 * (the multi-match rule documented above `navGroups()`), so the obvious
 * `NavGroup[]` JSON repeats its name and title once per membership — ~728
 * copies of 534 names. Interning them into one `items` table and referring to
 * them by index costs one `map` on arrival and roughly halves both the
 * transfer and the parse.
 *
 * Short keys for the same reason: this is a machine-read file with no reader,
 * and `unpackNavTree` immediately restores the real names.
 */
export type NavTreeWire = {
  /** `[name, title, loud ? 1 : 0]`, one per unique component. */
  i: [string, string, 0 | 1][];
  /** Categories, each with kind sub-groups (`k`) and loose items (`i`), both
   *  holding indices into the table above. */
  g: { id: string; label: string; k: { id: string; label: string; i: number[] }[]; i: number[] }[];
};

export function packNavTree(groups: NavGroup[]): NavTreeWire {
  const index = new Map<string, number>();
  const items: [string, string, 0 | 1][] = [];
  const idx = (item: NavItem) => {
    const seen = index.get(item.name);
    if (seen !== undefined) return seen;
    const at = items.length;
    items.push([item.name, item.title, item.loud ? 1 : 0]);
    index.set(item.name, at);
    return at;
  };
  return {
    i: items,
    g: groups.map((g) => ({
      id: g.id,
      label: g.label,
      k: g.kinds.map((k) => ({ id: k.id, label: k.label, i: k.items.map(idx) })),
      i: g.items.map(idx),
    })),
  };
}

export function unpackNavTree(wire: NavTreeWire): NavGroup[] {
  const items: NavItem[] = wire.i.map(([name, title, loud]) => ({
    name,
    title,
    loud: loud === 1,
  }));
  const pick = (at: number) => items[at];
  return wire.g.map((g) => {
    const kinds = g.k.map((k) => ({ id: k.id, label: k.label, items: k.i.map(pick) }));
    const loose = g.i.map(pick);
    return {
      id: g.id,
      label: g.label,
      count: loose.length + kinds.reduce((n, k) => n + k.items.length, 0),
      kinds,
      items: loose,
    };
  });
}

/** Only counts items — kinds are just a grouping of the same items, not
 *  additional ones, so `count` fields would double a component up otherwise. */
export const countGroup = (g: NavGroup) =>
  g.items.length + g.kinds.reduce((n, k) => n + k.items.length, 0);

/**
 * The tree flattened into the single order it actually reads top-to-bottom
 * in the sidebar — same category → kind → loose-item walk `navGroups()`
 * builds and `NavCategory`/`NavKindGroup` render, deduped to first
 * occurrence. A component can be a member of several categories (the
 * multi-match rule documented above `navGroups()`), so without the dedupe a
 * component filed under two sections would neighbour itself in prev/next.
 * First occurrence wins rather than last so this agrees with whichever
 * section the sidebar auto-opens for that component (`locate()`, same
 * category-then-kind order).
 */
export function flatOrder(groups: NavGroup[]): NavItem[] {
  const seen = new Set<string>();
  const flat: NavItem[] = [];
  const push = (item: NavItem) => {
    if (seen.has(item.name)) return;
    seen.add(item.name);
    flat.push(item);
  };
  for (const g of groups) {
    for (const k of g.kinds) for (const i of k.items) push(i);
    for (const i of g.items) push(i);
  }
  return flat;
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

/** The server-rendered half: category rows and the unique component count. */
export function summarizeNav(groups: NavGroup[]): NavSummary {
  return {
    groups: groups.map((g) => ({ id: g.id, label: g.label, count: g.count })),
    total: flatOrder(groups).length,
  };
}
