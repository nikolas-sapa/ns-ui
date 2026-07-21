"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CopyButton } from "./copy-button";
import { PreviewCard, type RegistryEntry } from "./preview-card";
import { ThemeToggle } from "./theme-toggle";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";

const installFor = (name: string) =>
  `npx shadcn add ${REGISTRY_ORIGIN}/r/${name}.json`;

/**
 * The header command used to read `/r/[name].json`, which copies a command
 * that fails. It now shows a real component so the clipboard always holds
 * something runnable; the caption says any name substitutes.
 */
const EXAMPLE_NAME = "particle-hero";

export type ShowcaseEntry = RegistryEntry & { tags: string[] };

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

type Filter = "all" | "core" | "loud";

export function Showcase({ items }: { items: ShowcaseEntry[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    let core = 0;
    let loud = 0;
    for (const i of items) {
      if (i.collection === "loud") loud += 1;
      else core += 1;
    }
    return { all: items.length, core, loud };
  }, [items]);

  /**
   * One lowercase string per component to match against. 50 items, so this is
   * a plain substring scan on every keystroke — no index, no debounce.
   */
  const haystacks = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of items) {
      map.set(
        i.name,
        `${i.name} ${i.title} ${i.description} ${i.tags.join(" ")} ${
          i.collection
        }`.toLowerCase(),
      );
    }
    return map;
  }, [items]);

  const visibleItems = useMemo(() => {
    const inCollection =
      filter === "all" ? items : items.filter((i) => i.collection === filter);
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return inCollection;
    return inCollection.filter((i) => {
      const hay = haystacks.get(i.name) ?? "";
      return terms.every((t) => hay.includes(t));
    });
  }, [items, filter, query, haystacks]);

  const { registerRef, isActive } = useMountManager();

  const tabs: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "core", label: "Core" },
    { key: "loud", label: "Loud" },
  ];

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
            Canvas, motion and glass, built on Geist tokens for light and dark.
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
              className="w-20 min-w-0 rounded-sm border border-border bg-surface px-2 py-1 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none sm:w-56 sm:px-2.5"
            />
            <p
              aria-live="polite"
              className="shrink-0 font-mono text-[11px] text-muted sm:text-xs"
            >
              {visibleItems.length} shown
            </p>
          </div>
        </div>
      </div>

      {/* Two columns up to 2xl: the demos are full-viewport designs, so a
          wider card is the difference between reading as a component and
          reading as a smudge. */}
      {visibleItems.length === 0 ? (
        <div className="mt-24 text-center">
          <p className="text-sm text-muted">
            No component matches{" "}
            <span className="font-mono text-foreground">{query}</span>
            {filter === "all" ? "" : ` in ${filter}`}.
          </p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="mt-3 rounded-sm px-2 py-1 font-mono text-xs text-muted underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
          >
            Clear search
          </button>
        </div>
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
