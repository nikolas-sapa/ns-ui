"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AskAI } from "./ask-ai";
import { CatalogControls, type Filter, type Sort } from "./catalog-controls";
import { CopyButton } from "./copy-button";
import { EmailCapture } from "./email-capture";
import { FeaturedCard } from "./featured-card";
import { GitHubStarButton } from "./github-star-button";
import { PreviewCard, type RegistryEntry } from "./preview-card";
import { useMountManager } from "./use-mount-manager";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";
import { CATEGORIES, categorize } from "@/lib/search-categories";
import { SYNONYM_TEXT } from "@/lib/search-synonyms";

const installFor = (name: string) =>
  `npx shadcn add ${REGISTRY_ORIGIN}/r/${name}.json`;

/**
 * The header command used to read `/r/[name].json`, which copies a command
 * that fails. It now shows a real component so the clipboard always holds
 * something runnable; the caption says any name substitutes.
 */
const EXAMPLE_NAME = "hero-particles-webgl";

export type ShowcaseEntry = RegistryEntry & {
  tags: string[];
  /** useWhen + the instruction's lead sentence — the plainest-spoken copy. */
  prose: string;
  /** Recency rank from lib/component-order.json — 0 is newest. Missing
   *  components (not yet in the committed snapshot) sort last. */
  order: number;
};

/**
 * How many demos may run at once.
 *
 * Each preview is now an iframe onto /preview/<name>/embed, so a mount costs a page
 * load as well as CPU. The cap is nonetheless pinned by the "never evict a
 * visible card" invariant, not by budget: measured on-screen card counts are
 * 6 at 1440x900 (2 columns) and 12 at 2560x1080 (3 columns inside the
 * 1600px container, ~4 rows in view). Setting the cap below 12 therefore
 * changes nothing at the wide shape — measured: cap 9 still mounted 12 — it
 * only removes the off-screen preload budget at the narrow ones.
 */
const MOUNT_CAP = 12;

/** Mount a demo this far outside the viewport so it has run a beat before seen. */
const PRELOAD_MARGIN = 600;

const SORT_PARAM = "sort";

/**
 * Words a newcomer can click when nothing matched. Each is a real query that
 * returns results through the synonym map.
 */
const RESCUE_QUERIES = ["dropdown", "toggle", "chart", "hero", "toast", "table"];

/** Glue words, ignored by the loose fallback below. */
const STOPWORDS = new Set([
  "a", "an", "and", "any", "are", "as", "at", "be", "can", "do", "does", "for",
  "how", "i", "in", "is", "it", "its", "me", "my", "need", "of", "on", "or",
  "some", "that", "the", "this", "to", "use", "want", "when", "with", "you",
]);

const FILTER_PARAM = "collection";
const NEW_PARAM = "new";
const CATEGORY_PARAM = "category";
const QUERY_PARAM = "q";

export function Showcase({
  items,
  featured,
  stars,
}: {
  items: ShowcaseEntry[];
  /** Curated slugs, already filtered to ones that exist — see lib/featured.ts. */
  featured: string[];
  /** Live GitHub star count, or `null` if the fetch failed — see lib/github-stars.ts. */
  stars?: number | null;
}) {
  const [filter, setFilterState] = useState<Filter>("all");
  const [category, setCategoryState] = useState<string | null>(null);
  // Narrows to the same cohort the cards chip as `new` — `entry.isNew`, the
  // NEW_COUNT most recently added slugs (app/page.tsx). A filter, not a sort:
  // "Newest" already covers ordering, and a sort that removed rows would lie.
  const [newOnly, setNewOnlyState] = useState(false);
  const [query, setQueryState] = useState("");
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [saving, setSaving] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/saves")
      .then(async (res) => {
        if (res.status === 401) {
          setAuthenticated(false);
          return;
        }
        if (!res.ok) throw new Error("save list failed");
        const data = (await res.json()) as { slugs?: unknown };
        setSaved(new Set(Array.isArray(data.slugs) ? data.slugs.filter((s): s is string => typeof s === "string") : []));
        setAuthenticated(true);
      })
      .catch(() => setAuthenticated(false));
  }, []);

  const toggleSave = useCallback(
    async (name: string) => {
      if (authenticated !== true || saving.has(name)) return;
      const wasSaved = saved.has(name);
      setSaving((current) => new Set(current).add(name));
      setSaved((current) => {
        const next = new Set(current);
        if (wasSaved) next.delete(name);
        else next.add(name);
        return next;
      });
      try {
        const res = await fetch("/api/saves", {
          method: wasSaved ? "DELETE" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: name }),
        });
        if (res.status === 401) setAuthenticated(false);
        if (!res.ok) throw new Error("save failed");
      } catch {
        setSaved((current) => {
          const next = new Set(current);
          if (wasSaved) next.add(name);
          else next.delete(name);
          return next;
        });
      } finally {
        setSaving((current) => {
          const next = new Set(current);
          next.delete(name);
          return next;
        });
      }
    },
    [authenticated, saved, saving],
  );

  // Starts at the server-rendered default and syncs from the URL once
  // mounted — same mounted-gate pattern as ThemeToggle, so there is nothing
  // for hydration to disagree about. Kept in the URL (plain history API, not
  // useSearchParams — that needs a Suspense boundary this page doesn't have)
  // so a click into a component's playground and back doesn't reset it, and
  // so a filtered view is a link someone can actually share.
  const [sort, setSortState] = useState<Sort>("featured");
  // Flips once this effect has run, so the retirement effect below can wait
  // for it — see that effect's comment for why the two can't be merged.
  const [urlSynced, setUrlSynced] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get(SORT_PARAM);
    if (fromUrl === "newest" || fromUrl === "oldest" || fromUrl === "featured") {
      setSortState(fromUrl);
    }
    const filterFromUrl = params.get(FILTER_PARAM);
    if (filterFromUrl === "core" || filterFromUrl === "loud") {
      setFilterState(filterFromUrl);
    }
    // Validated like sort and collection above: an unknown id (stale link,
    // renamed category) would otherwise match nothing and empty the catalog
    // with no chip lit and no filter named in the zero-results copy.
    const categoryFromUrl = params.get(CATEGORY_PARAM);
    if (
      categoryFromUrl === "other" ||
      CATEGORIES.some((c) => c.id === categoryFromUrl)
    ) {
      setCategoryState(categoryFromUrl);
    }
    if (params.get(NEW_PARAM) === "1") setNewOnlyState(true);
    const queryFromUrl = params.get(QUERY_PARAM);
    if (queryFromUrl) setQueryState(queryFromUrl);
    setUrlSynced(true);
  }, []);

  // `urlSynced` is consumed by the effect that retires the pre-hydration gate
  // (lib/catalog-gate.ts, `html.catalog-*`), which lives further down beside
  // the search memo it guards. See it for why it is a separate effect.

  /** Writes one param, dropping it entirely at its default value so the URL
   *  stays clean when nothing is filtered. `replaceState`, same as sort —
   *  keystroke-driven search would otherwise spam history on every character. */
  const setParam = useCallback((key: string, value: string | null) => {
    const url = new URL(window.location.href);
    if (value === null || value === "") url.searchParams.delete(key);
    else url.searchParams.set(key, value);
    window.history.replaceState(null, "", url);
  }, []);

  const setSort = useCallback(
    (next: Sort) => {
      setSortState(next);
      setParam(SORT_PARAM, next === "featured" ? null : next);
    },
    [setParam],
  );
  const setFilter = useCallback(
    (next: Filter) => {
      setFilterState(next);
      setParam(FILTER_PARAM, next === "all" ? null : next);
    },
    [setParam],
  );
  const setCategory = useCallback(
    (next: string | null) => {
      setCategoryState(next);
      setParam(CATEGORY_PARAM, next);
    },
    [setParam],
  );
  const setNewOnly = useCallback(
    (next: boolean) => {
      setNewOnlyState(next);
      setParam(NEW_PARAM, next ? "1" : null);
    },
    [setParam],
  );
  const setQuery = useCallback(
    (next: string) => {
      setQueryState(next);
      setParam(QUERY_PARAM, next);
    },
    [setParam],
  );

  const counts = useMemo(() => {
    let core = 0;
    let loud = 0;
    let fresh = 0;
    for (const i of items) {
      if (i.collection === "loud") loud += 1;
      else core += 1;
      // Counted off `isNew` rather than re-importing NEW_COUNT, so the
      // control can never claim more than the order snapshot actually marks.
      if (i.isNew) fresh += 1;
    }
    return { all: items.length, core, loud, new: fresh };
  }, [items]);

  /** name -> category ids, computed once from the components' own tags. */
  const memberships = useMemo(() => categorize(items), [items]);

  const categories = useMemo(() => {
    const named = CATEGORIES.map((c) => ({
      ...c,
      count: items.filter((i) => memberships.get(i.name)?.includes(c.id))
        .length,
    })).filter((c) => c.count > 0);

    // Same `["other"]` catch-all the sidebar already applies
    // (`lib/nav-data.ts`), id/label verbatim so tree, chips and
    // `/categories/<id>` agree. Without it a component whose tags hit no
    // category is in zero chips and unreachable by clicking.
    const orphans = items.filter((i) => !memberships.get(i.name)?.length).length;
    return orphans > 0
      ? [...named, { id: "other", label: "Other", tags: [], count: orphans }]
      : named;
  }, [items, memberships]);

  /**
   * One lowercase string per component to match against. 206 items, so this
   * is a plain substring scan on every keystroke — no index, no debounce.
   *
   * The synonym words are folded in here rather than matched separately, so a
   * multi-word plain query ("file upload") still works term by term against
   * the existing every-term rule.
   */
  const haystacks = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of items) {
      map.set(
        i.name,
        `${i.name} ${i.title} ${i.description} ${i.tags.join(" ")} ${
          i.collection
        } ${i.prose} ${SYNONYM_TEXT[i.name] ?? ""}`.toLowerCase(),
      );
    }
    return map;
  }, [items]);

  // A `useDeferredValue(query)` sat here, feeding the memo below so a
  // keystroke's own render stayed synchronous while the 265-card grid
  // re-rendered at lower priority. It was aimed at the 624ms INP Speed
  // Insights reports for this search box. It was measured and removed:
  // production build, 4x CPU throttle, six keystrokes typed with no gap,
  // three runs each — worst interaction 104/104/104ms deferred against
  // 104/104/120ms without it. No effect at this scale, and the local worst
  // case never got near 624ms in the first place, so the condition that
  // produces that number in the field was not reproduced here and this
  // change could not be shown to address it. It also cost something real:
  // because the deferred value lags by one render, the post-hydration render
  // on a `?q=` URL still held the unfiltered grid, so the gate below retired
  // over the *wrong* grid and `/?q=toggle` measured 0.3330 with the rest of
  // the fix already in place. Same trade as `solari-flap` in
  // docs/perf-audit-2026-07.md — added coupling for no measurable gain — and
  // reverted for the same reason.

  // Retires the pre-hydration gate (lib/catalog-gate.ts, `html.catalog-*`,
  // app/globals.css) once React's own state has read the URL — from here on
  // the component's own conditional render and `filtered ? "" : "hidden"` are
  // the only things deciding visibility, the same way ThemeToggle and the
  // sidebar toggle drop their own no-flash markers once they take over.
  // Without retirement the classes are never cleared, and clearing a filter
  // or switching back to Featured mid-session would leave the rail, heading
  // and Clear button stuck in whatever visibility the *original* URL implied.
  //
  // Kept out of the URL-reading effect above, not appended to it: that
  // effect's `setState` calls commit *after* the current paint, so removing
  // the classes inline there would repaint the gated blocks one frame before
  // the corrected state does — reintroducing the very shift this exists to
  // prevent. As a separate effect it only runs once that corrected render has
  // already committed, which is exactly the point the grid becomes safe to
  // reveal.
  useEffect(() => {
    if (!urlSynced) return;
    document.documentElement.classList.remove("catalog-filtered", "catalog-sorted");
  }, [urlSynced]);

  const { visibleItems: filteredItems, loose } = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const inScope = items.filter(
      (i) =>
        (filter === "all" || i.collection === filter) &&
        (!newOnly || i.isNew) &&
        (!category ||
          (category === "other"
            ? !memberships.get(i.name)?.length
            : memberships.get(i.name)?.includes(category))),
    );
    if (terms.length === 0) return { visibleItems: inScope, loose: false };

    const strict = inScope.filter((i) =>
      terms.every((t) => (haystacks.get(i.name) ?? "").includes(t)),
    );
    if (strict.length > 0) return { visibleItems: strict, loose: false };

    // Nothing matched every word. A sentence-shaped query ("reacts to the
    // cursor") is a real thing to type, and a dead end is the worst answer, so
    // fall back to any-word matching ranked by how many words hit. Glue words
    // are dropped first — "the" is a substring of half the registry's copy and
    // would rank noise to the top.
    const words = terms.filter((t) => !STOPWORDS.has(t));
    const scored = inScope
      .map((i) => {
        const hay = haystacks.get(i.name) ?? "";
        return { item: i, hits: words.filter((w) => hay.includes(w)).length };
      })
      .filter((s) => s.hits > 0)
      .sort((a, b) => b.hits - a.hits);
    return {
      visibleItems: scored.map((s) => s.item),
      loose: scored.length > 0,
    };
  }, [items, filter, newOnly, category, query, haystacks, memberships]);

  // Applied on top of the filter/search result, independent of it, so the
  // sort survives filtering and search (owner requirement). "Featured" is a
  // no-op — `filteredItems` already carries the server's featured-first,
  // then-recency order. Newest/Oldest ignore that entirely and re-order by
  // `order` (recency rank, 0 = newest), so the relevance ranking a loose
  // search fallback produces is intentionally overridden when a sort other
  // than Featured is active — an explicit sort choice outranks it.
  const visibleItems = useMemo(() => {
    if (sort === "featured") return filteredItems;
    const dir = sort === "newest" ? 1 : -1;
    return [...filteredItems].sort((a, b) => {
      // `order` is Number.MAX_SAFE_INTEGER for a component missing from
      // lib/component-order.json's committed snapshot (freshly added, order
      // not yet regenerated — see app/page.tsx). Newest already sorts that to
      // the bottom for free; Oldest, reversed naively, would put it at the
      // TOP — falsely presenting a just-added component as the most ancient
      // one in the registry. Unknown recency sorts last in both directions.
      const aKnown = a.order !== Number.MAX_SAFE_INTEGER;
      const bKnown = b.order !== Number.MAX_SAFE_INTEGER;
      if (aKnown !== bKnown) return aKnown ? -1 : 1;
      return dir * (a.order - b.order);
    });
  }, [filteredItems, sort]);

  const activeCategory = categories.find((c) => c.id === category);
  const filtered =
    filter !== "all" || newOnly || category !== null || query !== "";
  const clearAll = () => {
    setFilter("all");
    setNewOnly(false);
    setCategory(null);
    setQuery("");
  };

  const { registerRef, isActive, isOnScreen } = useMountManager({ mountCap: MOUNT_CAP, preloadMargin: PRELOAD_MARGIN });

  const byName = useMemo(() => new Map(items.map((i) => [i.name, i])), [items]);
  const featuredItems = useMemo(
    () => featured
      .slice(0, 4)
      .map((name) => byName.get(name))
      .filter((i): i is ShowcaseEntry => !!i),
    [featured, byName],
  );

  // Under the featured gate, `visibleItems` opens with exactly the four the
  // rail above already rendered, in the same order — the first screen of a
  // 298-item catalog would repeat itself. Excluded from the grid only under
  // that same gate, and keyed off `featuredItems` (what is actually rendered)
  // rather than the 36-slug `featured` list, which would delete 32 curated
  // components that never appeared in the rail. Derived from state, so the
  // pre-hydration catalog gate's first paint is untouched.
  const gridItems = useMemo(() => {
    if (filtered || sort !== "featured" || featuredItems.length === 0) {
      return visibleItems;
    }
    const shown = new Set(featuredItems.map((i) => i.name));
    return visibleItems.filter((i) => !shown.has(i.name));
  }, [visibleItems, featuredItems, filtered, sort]);

  return (
    <main className="mx-auto w-full max-w-[1600px] px-6 pb-32 sm:px-10">
      {/* First focusable element on the page. Lands past the header, install
          box and the whole filter/sort/category cluster (20 tab stops) and
          straight onto the first component — the entry point most keyboard
          and screen reader visitors actually want. */}
      <a
        href="#catalog"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-50 focus-visible:rounded-sm focus-visible:bg-ns-accent focus-visible:px-3 focus-visible:py-2 focus-visible:text-sm focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Skip to components
      </a>

      {/* Star button used to open the two-column header grid below, which
          only spans the narrower left column above xl — it read as floating
          somewhere in the middle of the page rather than sitting at the
          top. Pulled out to its own full-width row above the header so it's
          the first thing on the page, right-aligned against the Install
          column's edge instead of the left column's, and genuinely higher:
          `lg:pt-10` only kicks in once the fixed mobile nav toggle
          (site-shell.tsx, `fixed left-3 top-3`, 44px) is hidden at lg, so it
          never climbs into that button's space at narrower widths. Theme
          toggle used to sit here too — SiteShell renders one for every page
          now, so this row no longer needs its own. */}
      <div className="flex items-center justify-between gap-3 pt-20 sm:pt-28 lg:pt-10">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-ns-muted">
          ns-ui
        </p>
        <GitHubStarButton stars={stars} />
      </div>

      {/* Two-column split waits for xl, not lg — the persistent sidebar
          (site-shell.tsx) goes static at exactly lg (1024), and splitting the
          header at the same breakpoint left the headline column squeezed to
          ~160px there (one word per line, "Star on GitHub" wrapping). At
          1024 the header now stays a single stacked column with the full
          main-column width to itself. */}
      <header className="mt-8 grid gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] xl:items-end xl:gap-16">
        <div>
          <h1 className="max-w-3xl text-3xl font-semibold leading-[1.15] tracking-tight sm:text-4xl">
            A personal registry of {items.length} React components.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-ns-muted">
            Canvas, motion and glass — themed by your own CSS tokens, light and dark.
            Every card below is the real component running live. Click one to
            open it full size.
          </p>
        </div>

        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ns-muted">
            Install
          </p>
          <div className="mt-3 flex w-full items-start gap-2 rounded-md border border-border bg-surface py-2 pl-3.5 pr-1.5">
            {/* explicit <wbr> so a wrap lands after the origin, not mid-domain */}
            <code className="min-w-0 flex-1 break-words font-mono text-xs leading-6 text-foreground">
              npx shadcn add {REGISTRY_ORIGIN}
              <wbr />
              /r/{EXAMPLE_NAME}.json
            </code>
            <CopyButton
              variant="inline"
              value={installFor(EXAMPLE_NAME)}
              label="Copy install command"
            />
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-ns-muted">
            Runs as-is. Swap{" "}
            <span className="font-mono text-foreground">{EXAMPLE_NAME}</span>
            {" for any component name, or copy a card’s exact command."}
          </p>

          {/* The homepage's only link to the API surface, and it sits here
              rather than in the footer for a mechanical reason: this page is
              ~2.3MB of markup, and an agent audit that truncates its fetch
              reported "documentation found at /docs but not linked from the
              homepage" while the footer link was the only one. Next to the
              install command is also where someone wondering "can I automate
              this?" actually is. */}
          <p className="mt-3 text-xs leading-relaxed text-ns-muted">
            <a
              href="/docs"
              className="rounded-sm underline underline-offset-2 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none"
            >
              Developer docs
            </a>
            {" — registry API, OpenAPI spec and the MCP server."}
          </p>

          {/* Same moment as the install box above: deciding whether the
              registry is worth pulling in. Compact row, no repeated
              heading/copy — the "Install" label above already sets the
              context for this column. */}
          <div className="mt-4">
            <AskAI variant="compact" />
          </div>
        </div>
      </header>

      <CatalogControls
        filter={filter}
        onFilter={setFilter}
        counts={counts}
        query={query}
        onQuery={setQuery}
        sort={sort}
        onSort={setSort}
        newOnly={newOnly}
        onNewOnly={setNewOnly}
        newCount={counts.new}
        categories={categories}
        category={category}
        onCategory={setCategory}
        visibleCount={visibleItems.length}
        totalCount={items.length}
        filtered={filtered}
        onClearAll={clearAll}
      />

      {/* Featured rail: a small, genuinely-curated set, live and directly
          interactive rather than an autoplaying thumbnail. Hidden the moment
          a visitor filters, searches, or picks a recency sort — those states
          already answer "show me X"; a curated rail only makes sense as the
          entry point into the full catalog, and it competes with an explicit
          Newest/Oldest request rather than serving it. */}
      {/* Skip-link target: id lands here regardless of whether the Featured
          rail is showing, so "Skip to components" always works. tabIndex=-1
          makes it focusable via fragment navigation without adding a tab
          stop of its own. */}
      <div id="catalog" tabIndex={-1} className="outline-none" />

      {/* `catalog-gate-hide` is the pre-hydration twin of this condition —
          see app/globals.css and lib/catalog-gate.ts. This block always
          renders in the server-painted default (filtered=false,
          sort="featured"), so a shared `?q=`/`?sort=` link paints it and
          then unmounts it once React reads the URL; the CSS class keeps it
          invisible from the very first paint instead, so nothing below it
          jumps when React's own unmount happens moments later. */}
      {!filtered && sort === "featured" && featuredItems.length > 0 ? (
        <section className="catalog-gate-hide mt-14" aria-labelledby="featured-heading">
          <h2
            id="featured-heading"
            className="font-mono text-xs font-normal uppercase tracking-[0.18em] text-ns-muted"
          >
            Featured
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ns-muted">
            A curated set, live. Click any preview to open it full size and
            play with it.
          </p>
          <ul className="mt-6 grid grid-cols-1 gap-x-8 gap-y-14 md:grid-cols-2">
            {featuredItems.map((entry, i) => (
              <li key={entry.name}>
                {/* The grid is 2-up at md and above, so the first two posters
                    are the only ones above the fold — and the LCP candidates. */}
                <FeaturedCard
                  entry={entry}
                  installCommand={installFor(entry.name)}
                  priority={i < 2}
                  saved={saved.has(entry.name)}
                  authenticated={authenticated}
                  savePending={saving.has(entry.name)}
                  onToggleSave={toggleSave}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Same gate as the Featured rail above — this heading only makes
          sense as a header for the rest of the grid *after* a curated
          Featured section, so it shares that section's condition exactly
          and needs the same pre-hydration cover. */}
      {!filtered && sort === "featured" && featuredItems.length > 0 ? (
        <h2 className="catalog-gate-hide mt-24 font-mono text-xs font-normal uppercase tracking-[0.18em] text-ns-muted">
          All components
        </h2>
      ) : null}

      {/* Two columns up to 2xl: the demos are full-viewport designs, so a
          wider card is the difference between reading as a component and
          reading as a smudge. */}
      {visibleItems.length === 0 ? (
        <div className="mx-auto mt-24 max-w-md text-center">
          <p className="text-sm text-ns-muted">
            Nothing matches{" "}
            {query ? (
              <span className="font-mono text-foreground">{query}</span>
            ) : (
              "these filters"
            )}
            {activeCategory ? ` in ${activeCategory.label.toLowerCase()}` : ""}
            {filter === "all" ? "" : ` in ${filter}`}.
          </p>
          <p className="mt-5 text-xs text-ns-muted">
            Components here are named evocatively, so plain words are the way
            in. Try one:
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {RESCUE_QUERIES.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  setQuery(q);
                  setCategory(null);
                  setFilter("all");
                  setNewOnly(false);
                }}
                className="rounded-full border border-border px-2.5 py-1 font-mono text-xs text-ns-muted outline-none transition-colors hover:border-ns-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none"
              >
                {q}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={clearAll}
            className="mt-5 rounded-sm px-2 py-1 font-mono text-xs text-ns-muted underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent transition-colors"
          >
            Show all {items.length}
          </button>
        </div>
      ) : null}

      {loose ? (
        <p className="mt-10 text-xs text-ns-muted">
          Nothing matches every word of{" "}
          <span className="font-mono text-foreground">{query}</span> — showing
          the closest matches
          {/* "best first" only describes the relevance ranking loose search
              produces — Newest/Oldest deliberately override it below. */}
          {sort === "featured" ? ", best first" : ""}.
        </p>
      ) : null}

      {/* Stand-in for the grid on a URL that carries a filter or a non-default
          sort. Hiding the Featured rail was only half the shift: the grid's
          own children are what move. The server renders the unfiltered,
          featured-order list — 265 cards — and React then replaces or reorders
          every one of them once it reads the URL. Measured on a production
          build at 1440x900: `/?sort=oldest` shifted 0.158 and `/?sort=newest`
          0.332 with the rail already gated and the `<ul>` itself provably
          never moving (its top stayed at 493px throughout); the shift sources
          were the cards' own stretched-link `::after` boxes. No pre-hydration
          script can fix that, because CSS cannot reorder or filter arbitrary
          DOM — the only first paint that shifts nothing is one that does not
          show the wrong grid at all.

          So on those URLs the grid is `display: none` until React's state has
          read the URL, and this wordless box holds its place. `min-h-screen`
          is the load-bearing part: it must be at least a viewport tall at
          every width, so that the CTA and footer below it stay off-screen and
          therefore cannot shift when the real grid swaps in. Cards arriving
          are new nodes, and new nodes are not a layout shift.

          Both classes retire together in the `urlSynced` effect above, so
          nothing here survives into the interactive page. On a bare `/` the
          script sets no class, this stays `display: none`, and the grid paints
          immediately exactly as before — measured 0.0000. */}
      <div aria-hidden className="catalog-gate-standin mt-10 min-h-screen" />

      <ul
        aria-label={`${gridItems.length} component${gridItems.length === 1 ? "" : "s"}`}
        className="catalog-gate-grid mt-10 grid grid-cols-1 gap-x-8 gap-y-14 md:grid-cols-2 2xl:grid-cols-3"
      >
        {gridItems.map((entry) => (
          <li key={entry.name}>
            <PreviewCard
              entry={entry}
              active={isActive(entry.name)}
              onScreen={isOnScreen(entry.name)}
              registerRef={registerRef}
              installCommand={installFor(entry.name)}
              saved={saved.has(entry.name)}
              authenticated={authenticated}
              savePending={saving.has(entry.name)}
              onToggleSave={toggleSave}
            />
          </li>
        ))}
      </ul>

      {/* Second CTA placement for anyone who scrolled past the hero without
          noticing the first one. Plain bordered link, not a second
          LiquidCollar — one WebGL context for the CTA is enough, and a
          repeated animated treatment would start reading as an ad. */}
      <div className="mt-24 flex flex-col items-center gap-3 border-t border-border pt-14 text-center">
        <p className="text-sm text-ns-muted">If any of this was useful, a star helps others find it.</p>
        <GitHubStarButton variant="quiet" stars={stars} />
      </div>

      <div className="mt-14 flex flex-col items-center border-t border-border pt-14 text-center">
        <EmailCapture />
      </div>

      <JumpToTop />
    </main>
  );
}

/** How far down the page before the jump-to-top control appears. */
const JUMP_THRESHOLD = 1200;

/**
 * Quiet floating "back to top" — the catalog runs long (206 cards), and the
 * sticky filter bar is the only other fixed landmark, so this is the one
 * cheap way back without a mouse-wheel marathon. Rendered once, opacity/
 * pointer-events toggled rather than mounted/unmounted, so it never steals
 * focus by appearing mid-tab.
 */
function JumpToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > JUMP_THRESHOLD);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollUp = useCallback(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  }, []);

  return (
    <button
      type="button"
      onClick={scrollUp}
      aria-label="Back to top"
      tabIndex={visible ? 0 : -1}
      className={`fixed bottom-6 right-6 z-30 flex size-11 items-center justify-center rounded-full border border-border bg-surface text-ns-muted shadow-sm outline-none transition-[opacity,transform,color] duration-200 ease-out hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none sm:size-10 sm:bottom-8 sm:right-8 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
      }`}
    >
      <svg
        viewBox="0 0 16 16"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M8 12.5v-9M4 7l4-4 4 4" />
      </svg>
    </button>
  );
}
