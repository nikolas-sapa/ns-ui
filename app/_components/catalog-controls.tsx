"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

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
 * callbacks-out view. Tabs + search + sort share row one; category chips
 * + result state share row two, with the chips wrapping onto extra lines
 * (instead of scrolling off-screen) once they don't fit one line — the
 * chip count outgrew a single row a while back and a horizontal-scroll
 * region just clipped the last chip mid-label with no affordance to
 * reveal the rest.
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
  const barRef = useRef<HTMLDivElement | null>(null);

  // Publishes the bar's real height as a CSS variable so a card's
  // scroll-mt (preview-card.tsx) can clear it exactly instead of guessing a
  // static number — the chip row wraps onto extra lines at narrower widths
  // and the Clear button appears/disappears with `filtered`, both of which
  // change this height at runtime.
  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const set = () =>
      document.documentElement.style.setProperty("--filter-bar-h", `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
    <div
      ref={barRef}
      className="sticky top-0 z-30 -mx-6 mt-14 border-b border-border bg-background/85 px-6 py-3 backdrop-blur sm:-mx-10 sm:px-10"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
        {/* Plain toggle buttons, not an ARIA tablist — there's no associated
            tabpanel and no arrow-key navigation, so `role="tab"` promised a
            keyboard pattern this never implemented. `aria-pressed` matches
            how the category chips below already announce their state. */}
        <div role="group" aria-label="Filter by collection" className="flex items-center gap-1">
          {TABS.map((t) => {
            const selected = filter === t.key;
            return (
              <button
                key={t.key}
                type="button"
                aria-pressed={selected}
                onClick={() => onFilter(t.key)}
                className={`min-h-11 rounded-sm px-2.5 py-1 text-sm outline-none transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent sm:min-h-0 ${
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

        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:gap-3">
          <div className="search-trace-field relative w-full min-w-0 flex-1 rounded-sm sm:w-auto sm:flex-none">
            <label htmlFor="component-search" className="sr-only">
              Search catalog
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
              // "catalog" distinguishes this from the sidebar's own search —
              // see the comment on that input in site-shell.tsx.
              placeholder="Search catalog"
              autoComplete="off"
              spellCheck={false}
              className="min-h-11 w-full min-w-0 rounded-sm border border-border bg-surface py-1 pl-2 pr-6 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none sm:min-h-0 sm:w-56 sm:pl-2.5"
            />
            <span aria-hidden className="search-trace pointer-events-none motion-reduce:hidden" />
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
          {/* `appearance-none` + a hand-drawn chevron: without it this was
              the one control on the page rendering the browser's own arrow
              glyph instead of the same chevron the sidebar's <details> and
              the mobile menu already use — a different icon language on the
              same screen. */}
          <div className="relative">
            <select
              id="sort-order"
              value={sort}
              onChange={(e) => onSort(e.target.value as Sort)}
              className="min-h-11 shrink-0 appearance-none rounded-sm border border-border bg-surface py-1 pl-1.5 pr-5 text-xs text-muted outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none hover:text-foreground sm:min-h-0"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  Sort: {s.label}
                </option>
              ))}
            </select>
            <svg
              viewBox="0 0 16 16"
              aria-hidden
              className="pointer-events-none absolute right-1.5 top-1/2 size-2.5 -translate-y-1/2 text-muted"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 6l4 4 4-4" />
            </svg>
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex items-start gap-2">
        {/* A two-column grid below `sm`, not the flex-wrap row the wider
            layout uses: content-sized pills at 390px mostly fit one (rarely
            two) per line, left-aligned, leaving the rest of the row empty —
            a ragged column of half-used rows. The grid gives every chip an
            equal-width cell so the row fills edge to edge; `sm:` reverts to
            the packed flex-wrap once there's room for pills to sit at their
            own width without leaving that gap. min-h-11 (44px touch target)
            is unchanged either way. */}
        <div
          role="group"
          aria-label="Filter by what the component is for"
          className="grid min-w-0 flex-1 grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:items-center sm:gap-x-1.5 sm:gap-y-2"
        >
          {categories.map((c) => {
            const on = category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => onCategory(on ? null : c.id)}
                className={`flex min-h-11 items-center justify-center rounded-full border px-2.5 py-1 text-xs outline-none transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent sm:min-h-0 sm:w-auto sm:shrink-0 sm:justify-start ${
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
        <p aria-live="polite" className="shrink-0 whitespace-nowrap py-1 font-mono text-[11px] text-muted sm:text-xs">
          {filtered ? `${visibleCount} of ${totalCount}` : `${totalCount} shown`}
          {activeCategory ? ` · ${activeCategory.label}` : ""}
        </p>

        {filtered ? (
          <button
            type="button"
            onClick={onClearAll}
            className="flex min-h-11 shrink-0 items-center rounded-sm px-1.5 py-1 text-xs text-muted underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent sm:min-h-0"
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}
