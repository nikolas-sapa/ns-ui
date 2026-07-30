"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavGroup } from "@/lib/nav-data";

/**
 * The persistent left sidebar, and the one rule that keeps it from breaking
 * the quality gate:
 *
 * `/preview/<name>` (the BARE route, no `/play`) is what `scripts/verify.ts`
 * and `scripts/record.ts` screenshot, and what the playground embeds in an
 * iframe. `/preview/<name>/embed` is the cacheable card thumbnail every catalog
 * and featured card loads. Both must stay naked component pages — the gate
 * grabs "the first visible interactive element" for its hover/press/focus diff,
 * and a sidebar full of links would hand it a nav link instead. So those two
 * shapes render children with no chrome at all.
 *
 * `/embed` has to be listed explicitly: it is a deeper path, so the original
 * single-segment pattern rejected it and every card rendered the full sidebar
 * inside its own iframe (caught by screenshot, after the DOM check passed).
 */
const isBarePreview = (pathname: string) =>
  /^\/preview\/[^/]+(?:\/embed)?$/.test(pathname);

const LINK =
  "block truncate rounded-sm px-2 py-1 text-sm outline-none transition-colors hover:bg-surface hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none";

export function SiteShell({
  groups,
  children,
}: {
  groups: NavGroup[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  // Close the mobile drawer on navigation — otherwise tapping a component
  // leaves the panel covering the thing you just asked to see.
  useEffect(() => setOpen(false), [pathname]);

  // The list is long enough that the active item is routinely scrolled out
  // of view (arriving via a catalog card, a direct link, prev/next) — so pull
  // it into the middle of the panel rather than leaving the visitor to hunt.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "center" });
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const active = pathname.startsWith("/preview/")
    ? pathname.split("/")[2]
    : null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (i) =>
            i.name.includes(q) || i.title.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, query]);

  const total = useMemo(
    () => groups.reduce((n, g) => n + g.items.length, 0),
    [groups],
  );
  const shown = useMemo(
    () => filtered.reduce((n, g) => n + g.items.length, 0),
    [filtered],
  );

  if (isBarePreview(pathname)) return <>{children}</>;

  return (
    <div className="lg:flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="site-nav"
        className="fixed left-3 top-3 z-50 inline-flex h-11 w-11 items-center justify-center rounded-md border border-border bg-background text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent lg:hidden"
      >
        <span className="sr-only">
          {open ? "Close component navigation" : "Open component navigation"}
        </span>
        <MenuIcon open={open} />
      </button>

      {open ? (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-background/70 lg:hidden"
        />
      ) : null}

      <nav
        id="site-nav"
        aria-label="Components"
        className={`fixed inset-y-0 left-0 z-40 flex w-[17rem] flex-col border-r border-border bg-background transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 motion-reduce:transition-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* pl-14 clears the fixed mobile toggle button (44px, left-3 top-3),
            which otherwise sits directly on top of the wordmark once the
            drawer is open. Not needed at lg — the toggle is hidden there. */}
        <div className="flex items-center justify-between gap-2 pb-3 pl-14 pr-4 pt-4 lg:pl-4 lg:pt-5">
          <Link
            href="/"
            className="rounded-sm font-mono text-sm tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            ns-ui
          </Link>
          <span className="font-mono text-[11px] text-muted">{total}</span>
        </div>

        <div className="px-4 pb-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter components"
            aria-label="Filter components"
            className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-6">
          {query && shown === 0 ? (
            <p className="px-2 py-3 text-sm text-muted">No match.</p>
          ) : null}
          {filtered.map((g) => (
            <section key={g.id} className="mb-4">
              <h2 className="px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                {g.label}
              </h2>
              <ul>
                {g.items.map((i) => {
                  const on = i.name === active;
                  return (
                    <li key={i.name}>
                      <Link
                        ref={on ? activeRef : undefined}
                        href={`/preview/${i.name}/play`}
                        // This sidebar lists every component, so the default
                        // fired ~126 RSC prefetches on every page load — for a
                        // list the visitor picks at most one item from. Before
                        // these routes were made cacheable that was ~126
                        // uncached function invocations per visit; now it is
                        // merely 126 wasted CDN round trips. The target is
                        // prerendered, so the click is fast without them.
                        prefetch={false}
                        aria-current={on ? "page" : undefined}
                        className={`${LINK} ${
                          on
                            ? "bg-surface font-medium text-accent"
                            : "text-muted"
                        }`}
                      >
                        {i.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <div className="flex items-center gap-3 border-t border-border px-4 py-3 font-mono text-[11px] text-muted">
          <Link
            href="/changelog"
            className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
          >
            Changelog
          </Link>
          <Link
            href="/writing"
            className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
          >
            Writing
          </Link>
        </div>
      </nav>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      aria-hidden
    >
      {open ? (
        <path d="M4 4l8 8M12 4l-8 8" />
      ) : (
        <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
      )}
    </svg>
  );
}
