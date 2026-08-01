"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CatalogControls, type Filter, type Sort } from "./catalog-controls";
import { CopyButton } from "./copy-button";
import { EmailCapture } from "./email-capture";
import { FeaturedCard } from "./featured-card";
import { GitHubStarButton } from "./github-star-button";
import { PreviewCard, type RegistryEntry } from "./preview-card";
import { ThemeToggle } from "./theme-toggle";
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

const FOOTER_LINK =
  "rounded-sm underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent";

/**
 * How many demos may run at once.
 *
 * Each preview is now an iframe onto /preview/<name>, so a mount costs a page
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
  const [query, setQueryState] = useState("");

  // Starts at the server-rendered default and syncs from the URL once
  // mounted — same mounted-gate pattern as ThemeToggle, so there is nothing
  // for hydration to disagree about. Kept in the URL (plain history API, not
  // useSearchParams — that needs a Suspense boundary this page doesn't have)
  // so a click into a component's playground and back doesn't reset it, and
  // so a filtered view is a link someone can actually share.
  const [sort, setSortState] = useState<Sort>("featured");
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
    const categoryFromUrl = params.get(CATEGORY_PARAM);
    if (categoryFromUrl) setCategoryState(categoryFromUrl);
    const queryFromUrl = params.get(QUERY_PARAM);
    if (queryFromUrl) setQueryState(queryFromUrl);
  }, []);

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
    for (const i of items) {
      if (i.collection === "loud") loud += 1;
      else core += 1;
    }
    return { all: items.length, core, loud };
  }, [items]);

  /** name -> category ids, computed once from the components' own tags. */
  const memberships = useMemo(() => categorize(items), [items]);

  const categories = useMemo(
    () =>
      CATEGORIES.map((c) => ({
        ...c,
        count: items.filter((i) => memberships.get(i.name)?.includes(c.id))
          .length,
      })).filter((c) => c.count > 0),
    [items, memberships],
  );

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

  const { visibleItems: filteredItems, loose } = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const inScope = items.filter(
      (i) =>
        (filter === "all" || i.collection === filter) &&
        (!category || memberships.get(i.name)?.includes(category)),
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
  }, [items, filter, category, query, haystacks, memberships]);

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
  const filtered = filter !== "all" || category !== null || query !== "";
  const clearAll = () => {
    setFilter("all");
    setCategory(null);
    setQuery("");
  };

  const { registerRef, isActive } = useMountManager();

  const byName = useMemo(() => new Map(items.map((i) => [i.name, i])), [items]);
  const featuredItems = useMemo(
    () => featured.map((name) => byName.get(name)).filter((i): i is ShowcaseEntry => !!i),
    [featured, byName],
  );

  return (
    <main className="mx-auto w-full max-w-[1600px] px-6 pb-32 sm:px-10">
      {/* First focusable element on the page. Lands past the header, install
          box and the whole filter/sort/category cluster (20 tab stops) and
          straight onto the first component — the entry point most keyboard
          and screen reader visitors actually want. */}
      <a
        href="#catalog"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-50 focus-visible:rounded-sm focus-visible:bg-accent focus-visible:px-3 focus-visible:py-2 focus-visible:text-sm focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-hover"
      >
        Skip to components
      </a>

      {/* Two-column split waits for xl, not lg — the persistent sidebar
          (site-shell.tsx) goes static at exactly lg (1024), and splitting the
          header at the same breakpoint left the headline column squeezed to
          ~160px there (one word per line, "Star on GitHub" wrapping). At
          1024 the header now stays a single stacked column with the full
          main-column width to itself. */}
      <header className="grid gap-10 pt-20 sm:pt-28 xl:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] xl:items-end xl:gap-16">
        <div>
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
              ns-ui
            </p>
            <div className="flex items-center gap-3">
              <GitHubStarButton stars={stars} />
              <ThemeToggle />
            </div>
          </div>
          <h1 className="mt-5 max-w-3xl text-3xl font-semibold leading-[1.15] tracking-tight sm:text-4xl">
            A personal registry of {items.length} React components.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">
            Canvas, motion and glass — themed by your own CSS tokens, light and dark.
            Every card below is the real component running live. Click one to
            open it full size.
          </p>
        </div>

        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
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
          <p className="mt-2.5 text-xs leading-relaxed text-muted">
            Runs as-is. Swap{" "}
            <span className="font-mono text-foreground">{EXAMPLE_NAME}</span>
            {" for any component name, or copy a card’s exact command."}
          </p>
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

      {!filtered && sort === "featured" && featuredItems.length > 0 ? (
        <section className="mt-14" aria-labelledby="featured-heading">
          <h2
            id="featured-heading"
            className="font-mono text-xs font-normal uppercase tracking-[0.18em] text-muted"
          >
            Featured
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
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
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!filtered && sort === "featured" && featuredItems.length > 0 ? (
        <h2 className="mt-24 font-mono text-xs font-normal uppercase tracking-[0.18em] text-muted">
          All components
        </h2>
      ) : null}

      {/* Two columns up to 2xl: the demos are full-viewport designs, so a
          wider card is the difference between reading as a component and
          reading as a smudge. */}
      {visibleItems.length === 0 ? (
        <div className="mx-auto mt-24 max-w-md text-center">
          <p className="text-sm text-muted">
            Nothing matches{" "}
            {query ? (
              <span className="font-mono text-foreground">{query}</span>
            ) : (
              "these filters"
            )}
            {activeCategory ? ` in ${activeCategory.label.toLowerCase()}` : ""}
            {filter === "all" ? "" : ` in ${filter}`}.
          </p>
          <p className="mt-5 text-xs text-muted">
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
                }}
                className="rounded-full border border-border px-2.5 py-1 font-mono text-xs text-muted outline-none transition-colors hover:border-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none"
              >
                {q}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={clearAll}
            className="mt-5 rounded-sm px-2 py-1 font-mono text-xs text-muted underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
          >
            Show all {items.length}
          </button>
        </div>
      ) : null}

      {loose ? (
        <p className="mt-10 text-xs text-muted">
          Nothing matches every word of{" "}
          <span className="font-mono text-foreground">{query}</span> — showing
          the closest matches
          {/* "best first" only describes the relevance ranking loose search
              produces — Newest/Oldest deliberately override it below. */}
          {sort === "featured" ? ", best first" : ""}.
        </p>
      ) : null}

      <ul
        aria-label={`${visibleItems.length} component${visibleItems.length === 1 ? "" : "s"}`}
        className="mt-10 grid grid-cols-1 gap-x-8 gap-y-14 md:grid-cols-2 2xl:grid-cols-3"
      >
        {visibleItems.map((entry) => (
          <li key={entry.name}>
            <PreviewCard
              entry={entry}
              active={isActive(entry.name)}
              registerRef={registerRef}
              installCommand={installFor(entry.name)}
            />
          </li>
        ))}
      </ul>

      {/* Second CTA placement for anyone who scrolled past the hero without
          noticing the first one. Plain bordered link, not a second
          LiquidCollar — one WebGL context for the CTA is enough, and a
          repeated animated treatment would start reading as an ad. */}
      <div className="mt-24 flex flex-col items-center gap-3 border-t border-border pt-14 text-center">
        <p className="text-sm text-muted">If any of this was useful, a star helps others find it.</p>
        <GitHubStarButton variant="quiet" stars={stars} />
      </div>

      <div className="mt-14 flex flex-col items-center border-t border-border pt-14 text-center">
        <EmailCapture />
      </div>

      <JumpToTop />

      {/* Grouped rather than spread: `justify-between` used to pin these
          three fragments to the far edges of the 1600px container, which at
          a normal desktop width left them looking like unrelated scraps
          rather than one footer. A bounded gap keeps the two link clusters
          close and lets the "built with" line sit apart without spanning
          the whole row to do it. */}
      <footer className="mt-16 flex flex-wrap items-baseline gap-x-12 gap-y-3 border-t border-border pt-6 font-mono text-xs text-muted">
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
          <p>
            For AI agents:{" "}
            <a href="/llms.txt" className={FOOTER_LINK}>
              /llms.txt
            </a>{" "}
            ·{" "}
            <a href="/llms-full.txt" className={FOOTER_LINK}>
              /llms-full.txt
            </a>
          </p>
          <p>
            <a href="/changelog" className={FOOTER_LINK}>
              Changelog
            </a>{" "}
            ·{" "}
            <a href="/writing" className={FOOTER_LINK}>
              Writing
            </a>{" "}
            ·{" "}
            <a href="/connect" className={FOOTER_LINK}>
              Connect
            </a>{" "}
            ·{" "}
            <a href="https://github.com/nikolas-sapa/ns-ui" className={FOOTER_LINK}>
              GitHub
            </a>{" "}
            ·{" "}
            <a href="https://nikolas.helpmarq.com" className={FOOTER_LINK}>
              Built by Nikolas Sapa
            </a>
          </p>
        </div>
        <p>Built with love for developers, with Claude Code.</p>
      </footer>
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
      className={`fixed bottom-6 right-6 z-30 flex size-11 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-sm outline-none transition-[opacity,transform] duration-200 ease-out hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none sm:size-10 sm:bottom-8 sm:right-8 ${
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

/**
 * Decides which cards may run.
 *
 * Rule: any card touching the real viewport is never evicted (evicting a
 * visible card would blank it mid-scroll). The cap only sheds cards that are
 * entirely off-screen, nearest-to-viewport first.
 */
function useMountManager() {
  const elements = useRef(new Map<string, HTMLElement>());
  const near = useRef(new Set<string>());
  const frame = useRef<number | null>(null);
  const [mounted, setMounted] = useState<Set<string>>(() => new Set());
  const observer = useRef<IntersectionObserver | null>(null);

  const recompute = useCallback(() => {
    frame.current = null;
    const vh = window.innerHeight;
    const onScreen: string[] = [];
    const offScreen: { name: string; dist: number }[] = [];

    for (const name of near.current) {
      const el = elements.current.get(name);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh) {
        onScreen.push(name);
      } else {
        const centre = (r.top + r.bottom) / 2;
        offScreen.push({ name, dist: Math.abs(centre - vh / 2) });
      }
    }

    const next = new Set(onScreen);
    offScreen.sort((a, b) => a.dist - b.dist);
    for (const o of offScreen) {
      if (next.size >= MOUNT_CAP) break;
      next.add(o.name);
    }

    setMounted((prev) => {
      if (prev.size === next.size && [...next].every((n) => prev.has(n))) {
        return prev;
      }
      return next;
    });
  }, []);

  const schedule = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(recompute);
  }, [recompute]);

  useEffect(() => {
    observer.current = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const name = (e.target as HTMLElement).dataset.name;
          if (!name) continue;
          if (e.isIntersecting) near.current.add(name);
          else near.current.delete(name);
        }
        schedule();
      },
      { rootMargin: `${PRELOAD_MARGIN}px 0px ${PRELOAD_MARGIN}px 0px` },
    );
    // A card can cross the true viewport edge while staying inside the
    // preload margin, which fires no intersection callback — so re-rank on
    // scroll too (rAF-throttled, reading only the handful of near cards).
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    for (const el of elements.current.values()) observer.current.observe(el);
    schedule();
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      observer.current?.disconnect();
      observer.current = null;
    };
  }, [schedule]);

  const registerRef = useCallback(
    (name: string, el: HTMLElement | null) => {
      const prev = elements.current.get(name);
      if (prev && prev !== el) {
        observer.current?.unobserve(prev);
        elements.current.delete(name);
        near.current.delete(name);
      }
      if (el) {
        elements.current.set(name, el);
        observer.current?.observe(el);
      }
      schedule();
    },
    [schedule],
  );

  const isActive = useCallback((name: string) => mounted.has(name), [mounted]);

  return { registerRef, isActive };
}
