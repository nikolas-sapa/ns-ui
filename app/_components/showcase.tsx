"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CopyButton } from "./copy-button";
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
const EXAMPLE_NAME = "particle-hero";

export type ShowcaseEntry = RegistryEntry & {
  tags: string[];
  /** useWhen + the instruction's lead sentence — the plainest-spoken copy. */
  prose: string;
  /**
   * Temporary audit flag for a one-off weak/redundant review pass. Remove
   * this field, the "review" filter tab below, and the whitelist entry in
   * scripts/build-registry.ts once the pass is done.
   */
  review: boolean;
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

type Filter = "all" | "core" | "loud" | "review";

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

export function Showcase({ items }: { items: ShowcaseEntry[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    let core = 0;
    let loud = 0;
    let review = 0;
    for (const i of items) {
      if (i.collection === "loud") loud += 1;
      else core += 1;
      if (i.review) review += 1;
    }
    return { all: items.length, core, loud, review };
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
   * One lowercase string per component to match against. 50 items, so this is
   * a plain substring scan on every keystroke — no index, no debounce.
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

  const { visibleItems, loose } = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const inScope = items.filter(
      (i) =>
        (filter === "all" ||
          (filter === "review" ? i.review : i.collection === filter)) &&
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

  const activeCategory = categories.find((c) => c.id === category);
  const filtered = filter !== "all" || category !== null || query !== "";
  const clearAll = () => {
    setFilter("all");
    setCategory(null);
    setQuery("");
  };

  const { registerRef, isActive } = useMountManager();

  const tabs: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "core", label: "Core" },
    { key: "loud", label: "Loud" },
  ];

  // Temporary audit tab — amber, not the blue accent, so it reads as
  // scaffolding rather than a permanent part of the collection filter.
  // Remove alongside the `review` field once the audit pass is done.
  const reviewTab: { key: Filter; label: string } = {
    key: "review",
    label: "Review",
  };

  return (
    <main className="mx-auto w-full max-w-[1600px] px-6 pb-32 sm:px-10">
      <header className="grid gap-10 pt-20 sm:pt-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-end lg:gap-16">
        <div>
          <div className="flex items-center justify-between gap-4">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
              ns-ui
            </p>
            <ThemeToggle />
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

      <div className="sticky top-0 z-30 -mx-6 mt-14 border-b border-border bg-background/85 px-6 py-3 backdrop-blur sm:-mx-10 sm:px-10">
        <div className="flex items-center justify-between gap-4">
          <div
            role="tablist"
            aria-label="Filter by collection"
            className="flex items-center gap-1"
          >
            {tabs.map((t) => {
              const selected = filter === t.key;
              return (
                <button
                  key={t.key}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  onClick={() => setFilter(t.key)}
                  className={`rounded-sm px-2.5 py-1 text-sm outline-none transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent ${
                    selected
                      ? "bg-surface font-medium text-foreground"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {t.label}
                  <span className="ml-1.5 font-mono text-xs text-muted">
                    {counts[t.key]}
                  </span>
                </button>
              );
            })}
            {counts.review > 0 ? (
              <button
                key={reviewTab.key}
                role="tab"
                type="button"
                aria-selected={filter === reviewTab.key}
                onClick={() =>
                  setFilter(filter === reviewTab.key ? "all" : reviewTab.key)
                }
                className={`ml-1 rounded-sm border px-2.5 py-1 text-sm outline-none transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-[#f5a623] ${
                  filter === reviewTab.key
                    ? "border-[#f5a623] bg-[#f5a623]/15 font-medium text-[#f5a623]"
                    : "border-dashed border-[#f5a623]/40 text-muted hover:border-[#f5a623] hover:text-[#f5a623]"
                }`}
              >
                {reviewTab.label}
                <span className="ml-1.5 font-mono text-xs opacity-70">
                  {counts.review}
                </span>
              </button>
            ) : null}
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <label htmlFor="component-search" className="sr-only">
              Search components
            </label>
            <input
              id="component-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              autoComplete="off"
              spellCheck={false}
              className="w-28 min-w-0 rounded-sm border border-border bg-surface px-2 py-1 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none sm:w-56 sm:px-2.5"
            />
            <p
              aria-live="polite"
              className="shrink-0 font-mono text-[11px] text-muted sm:text-xs"
            >
              {visibleItems.length} shown
            </p>
          </div>
        </div>

        {/* What is this for? — the row a newcomer uses instead of guessing the
            house vocabulary. Roles, not tags: 166 tags, 128 of them singletons,
            would be noise. */}
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
                  onClick={() => setCategory(on ? null : c.id)}
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-xs outline-none transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent ${
                    on
                      ? "border-accent bg-accent text-white"
                      : "border-border text-muted hover:border-muted hover:text-foreground"
                  }`}
                >
                  {c.label}
                  <span
                    className={`ml-1.5 font-mono text-[11px] ${
                      on ? "text-white/70" : "text-muted"
                    }`}
                  >
                    {c.count}
                  </span>
                </button>
              );
            })}
          </div>
          {filtered ? (
            <button
              type="button"
              onClick={clearAll}
              className="shrink-0 rounded-sm px-1.5 py-1 text-xs text-muted underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

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
          the closest, best first.
        </p>
      ) : null}

      <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-14 md:grid-cols-2 2xl:grid-cols-3">
        {visibleItems.map((entry) => (
          <PreviewCard
            key={entry.name}
            entry={entry}
            active={isActive(entry.name)}
            registerRef={registerRef}
            installCommand={installFor(entry.name)}
          />
        ))}
      </div>

      <footer className="mt-24 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3 border-t border-border pt-6 font-mono text-xs text-muted">
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
          {/* Owner's call to keep this live: the repo is public, MIT and pushed —
              it 404s only because of an account-level GitHub flag pending appeal.
              Expected to resolve itself when the flag lifts. */}
          <a href="https://github.com/nikolas-sapa/ns-ui" className={FOOTER_LINK}>
            GitHub
          </a>{" "}
          ·{" "}
          <a href="https://nikolas.helpmarq.com" className={FOOTER_LINK}>
            Built by Nikolas
          </a>
        </p>
        <p className="mt-2">Built with love for developers, with Claude Code.</p>
      </footer>
    </main>
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
