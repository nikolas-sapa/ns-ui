"use client";

import { useEffect, useRef } from "react";

export type Filter = "all" | "core" | "loud";
export type Sort = "featured" | "newest" | "oldest";

export const SORTS: { key: Sort; label: string }[] = [
  { key: "featured", label: "Featured" },
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
];

const TABS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "core", label: "Core" },
  { key: "loud", label: "Loud" },
];

/**
 * The sticky filter/sort/search cluster, pulled out of Showcase so that
 * component stays the state owner and this one stays a pure props-in,
 * callbacks-out view. Two rows at every width: tabs + search + sort share
 * row one, category chips + result state share row two — down from three,
 * which was crowding the 375px viewport.
 *
 * Sort deliberately does NOT use the accent-filled pill treatment the
 * category chips use — accent is reserved for chips because those are a
 * *filter* (narrows what's on screen); sort only reorders the same result
 * set, so lighting it up the same blue as an active chip read as a second,
 * confusing filter. It's a plain segmented control instead.
 */
export function CatalogControls({
  filter,
  onFilter,
  counts,
  query,
  onQuery,
  sort,
  onSort,
  categories,
  category,
  onCategory,
  visibleCount,
  totalCount,
  filtered,
  onClearAll,
}: {
  filter: Filter;
  onFilter: (f: Filter) => void;
  counts: { all: number; core: number; loud: number };
  query: string;
  onQuery: (q: string) => void;
  sort: Sort;
  onSort: (s: Sort) => void;
  categories: { id: string; label: string; count: number }[];
  category: string | null;
  onCategory: (id: string | null) => void;
  visibleCount: number;
  totalCount: number;
  filtered: boolean;
  onClearAll: () => void;
}) {
  const searchRef = useRef<HTMLInputElement | null>(null);

  // "/" focuses search — standard, cheap, and ignored while any text input
  // (this one included) or a contenteditable already has focus, so it never
  // steals a literal "/" the visitor meant to type.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const activeCategory = categories.find((c) => c.id === category);

  return (
    <div className="sticky top-0 z-30 -mx-6 mt-14 border-b border-border bg-background/85 px-6 py-3 backdrop-blur sm:-mx-10 sm:px-10">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
        <div role="tablist" aria-label="Filter by collection" className="flex items-center gap-1">
          {TABS.map((t) => {
            const selected = filter === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                type="button"
                aria-selected={selected}
                onClick={() => onFilter(t.key)}
                className={`rounded-sm px-2.5 py-1 text-sm outline-none transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent ${
                  selected
                    ? "bg-surface font-medium text-foreground"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {t.label}
                <span className="ml-1.5 font-mono text-xs text-muted">{counts[t.key]}</span>
              </button>
            );
          })}
        </div>

        <div className="flex min-w-0 items-center gap-3">
          <div className="relative">
            <label htmlFor="component-search" className="sr-only">
              Search components
            </label>
            <input
              ref={searchRef}
              id="component-search"
              type="search"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && query) {
                  onQuery("");
                  searchRef.current?.blur();
                }
              }}
              placeholder="Search"
              autoComplete="off"
              spellCheck={false}
              className="w-28 min-w-0 rounded-sm border border-border bg-surface py-1 pl-2 pr-6 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none sm:w-56 sm:pl-2.5"
            />
            {/* Hidden until search is unfocused-and-empty, so the "/" hint
                doesn't overlap the caret once someone's actually typing. */}
            {!query ? (
              <kbd
                aria-hidden
                className="pointer-events-none absolute right-1.5 top-1/2 hidden -translate-y-1/2 rounded-sm border border-border px-1 font-mono text-[10px] text-muted sm:block"
              >
                /
              </kbd>
            ) : null}
          </div>

          {/* A plain select, not pills — see the file header for why sort
              stays visually quiet next to the category chips' accent fill. */}
          <label htmlFor="sort-order" className="sr-only">
            Sort order
          </label>
          <select
            id="sort-order"
            value={sort}
            onChange={(e) => onSort(e.target.value as Sort)}
            className="shrink-0 rounded-sm border border-border bg-surface px-1.5 py-1 text-xs text-muted outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none hover:text-foreground"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                Sort: {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <div
          role="group"
          aria-label="Filter by what the component is for"
          className="-mb-1 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-1"
        >
          {categories.map((c) => {
            const on = category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => onCategory(on ? null : c.id)}
                className={`shrink-0 rounded-full border px-2.5 py-1 text-xs outline-none transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent ${
                  on
                    ? "border-accent bg-accent text-white"
                    : "border-border text-muted hover:border-muted hover:text-foreground"
                }`}
              >
                {c.label}
                <span className={`ml-1.5 font-mono text-[11px] ${on ? "text-white/70" : "text-muted"}`}>
                  {c.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Single live region for the result count — was previously
            duplicated with a second "n shown" readout in row one. */}
        <p aria-live="polite" className="shrink-0 whitespace-nowrap font-mono text-[11px] text-muted sm:text-xs">
          {filtered ? `${visibleCount} of ${totalCount}` : `${totalCount} shown`}
          {activeCategory ? ` · ${activeCategory.label}` : ""}
        </p>

        {filtered ? (
          <button
            type="button"
            onClick={onClearAll}
            className="shrink-0 rounded-sm px-1.5 py-1 text-xs text-muted underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}
