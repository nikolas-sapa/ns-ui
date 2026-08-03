"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { locate, type NavGroup, type NavItem, type NavKind } from "@/lib/nav-data";
import { SIDEBAR_HIDDEN_KEY } from "@/lib/sidebar";
import { McpPopup } from "./mcp-popup";
import { SiteAuth } from "./site-auth";

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

/** Which categories/kinds are open, beyond the current page's own section —
 *  persisted so a visitor's browsing structure survives navigation.
 *
 *  Bumped to `-v2`: v1 leaked. `<details>` fires its native `onToggle` for
 *  *any* open change, including ones this component forced (filter-matched
 *  sections, "Expand all") rather than ones the visitor actually clicked —
 *  and every write landed in storage regardless. One search or one
 *  Expand-all click permanently expanded the whole tree for that visitor,
 *  which is what "collapsed by default" actually looked like on a browser
 *  that had ever done either. The toggle handler below now only persists
 *  opens/closes that came from a real click; this key rename is a one-time
 *  reset for storage that's already poisoned by the old behavior. Don't
 *  bump it again for anything short of another genuine leak. */
const STORAGE_KEY = "ns-ui-nav-open-v2";

function readStored(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/** Written only from the specific places below that represent an actual
 *  visitor choice — never from a blanket effect watching `openIds`, which is
 *  what let a filter search or "Expand all" write themselves to storage in
 *  the first place (see the STORAGE_KEY comment). */
function persistOpen(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /* private mode / storage disabled — open state just won't persist */
  }
}

export function SiteShell({
  groups,
  children,
}: {
  groups: NavGroup[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Desktop-only sidebar collapse (separate from `open`, which is the
  // mobile drawer above). `sidebarHidden` only gates the two toggle
  // buttons' `aria-expanded` — the actual hide/show is driven by the
  // `sidebar-hidden` class on <html>, set synchronously pre-hydration by
  // the no-flash script (lib/sidebar.ts) and toggled imperatively on click
  // below, same split as ThemeToggle's `isDark`/`document.documentElement`.
  // `mounted` gates only the a11y state for the same reason ThemeToggle's
  // does: the persisted value can't be known during SSR.
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setSidebarHidden(document.documentElement.classList.contains("sidebar-hidden"));
    setMounted(true);
  }, []);

  const setSidebarHiddenPersisted = useCallback((next: boolean) => {
    document.documentElement.classList.toggle("sidebar-hidden", next);
    try {
      if (next) localStorage.setItem(SIDEBAR_HIDDEN_KEY, "1");
      else localStorage.removeItem(SIDEBAR_HIDDEN_KEY);
    } catch {
      // Storage unavailable (private mode, locked down) — the toggle still
      // works for this tab, it just won't persist.
    }
    setSidebarHidden(next);
  }, []);

  const [query, setQuery] = useState("");
  const activeRef = useRef<HTMLAnchorElement | null>(null);
  const isFiltering = query.trim().length > 0;

  const active = pathname.startsWith("/preview/")
    ? pathname.split("/")[2]
    : null;

  // Where the active component lives in the tree, computed from the same
  // pathname both the server and the client already agree on — nothing here
  // needs a mounted-gate, unlike the persisted extra opens below.
  const activeLocation = useMemo(
    () => (active ? locate(groups, active) : null),
    [groups, active],
  );

  const [openIds, setOpenIds] = useState<Set<string>>(() => {
    const seed = new Set<string>();
    if (activeLocation) {
      seed.add(activeLocation.groupId);
      if (activeLocation.kindId) seed.add(activeLocation.kindId);
    }
    return seed;
  });

  // Merge in whatever the visitor had open in a previous session. Additive
  // only, and deferred to an effect — localStorage doesn't exist on the
  // server, so this is the one part of the open-state that needs the mounted
  // gate (same pattern as ThemeToggle / Showcase's sort-from-URL sync).
  useEffect(() => {
    const stored = readStored();
    if (stored.length === 0) return;
    setOpenIds((prev) => new Set([...prev, ...stored]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-open the active component's section on every navigation (not just
  // mount) — arriving at a component via a catalog card or a direct link
  // should reveal it even if that section isn't in the persisted set. This
  // only ever adds ids, so a section the visitor manually collapsed stays
  // collapsed for every *other* navigation. Landing here is itself a real
  // signal about the visitor's tree (unlike the filter/expand-all cases
  // below), so this one still persists.
  useEffect(() => {
    if (!activeLocation) return;
    setOpenIds((prev) => {
      const alreadyOpen =
        prev.has(activeLocation.groupId) &&
        (!activeLocation.kindId || prev.has(activeLocation.kindId));
      if (alreadyOpen) return prev;
      const next = new Set(prev);
      next.add(activeLocation.groupId);
      if (activeLocation.kindId) next.add(activeLocation.kindId);
      persistOpen(next);
      return next;
    });
  }, [activeLocation]);

  // Close the mobile drawer on navigation — otherwise tapping a component
  // leaves the panel covering the thing you just asked to see.
  useEffect(() => setOpen(false), [pathname]);

  // The list is long enough that the active item is routinely scrolled out
  // of view (arriving via a catalog card, a direct link, prev/next) — so pull
  // it into the middle of the panel rather than leaving the visitor to hunt.
  // Deferred one frame: the section-opening effect above can still be
  // committing when this runs, and `scrollIntoView` on an element inside a
  // closed <details> is a no-op (no layout box).
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      activeRef.current?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // The browser fires <details onToggle> for a forced open exactly like a
  // real click — while filtering, every matched section's `open` is forced
  // (below, `isFiltering || openIds.has(g.id)`), so without this guard a
  // single search permanently added every matched id to storage. Bail out
  // entirely rather than just skip the persist: leaving those ids out of
  // openIds too is what makes them snap back to their real state once the
  // filter clears, instead of staying stuck open.
  const toggle = useCallback(
    (id: string, next: boolean) => {
      if (isFiltering) return;
      setOpenIds((prev) => {
        const nextSet = new Set(prev);
        if (next) nextSet.add(id);
        else nextSet.delete(id);
        persistOpen(nextSet);
        return nextSet;
      });
    },
    [isFiltering],
  );

  const filtered = useMemo(() => filterGroups(groups, query), [groups, query]);

  // Unique components, not a sum of category counts — a component listed
  // under two categories (multi-match, same rule the filter chips use) is
  // still one component, and this is the number next to the wordmark that
  // has to match the "223 shown" the catalog page opens with.
  const total = useMemo(() => {
    const names = new Set<string>();
    for (const g of groups) {
      for (const k of g.kinds) for (const i of k.items) names.add(i.name);
      for (const i of g.items) names.add(i.name);
    }
    return names.size;
  }, [groups]);
  const shown = useMemo(
    () => filtered.reduce((n, g) => n + countGroup(g), 0),
    [filtered],
  );

  const allIds = useMemo(() => {
    const ids: string[] = [];
    for (const g of groups) {
      ids.push(g.id);
      for (const k of g.kinds) ids.push(k.id);
    }
    return ids;
  }, [groups]);

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
        {/* Traveling light trace along the nav's own right hairline (the
            border-r below) — a slow accent glow drifting down and looping,
            gone entirely under reduced motion rather than left static. Sits
            on the hairline itself (w-px, right-0) so it reads as the border
            breathing, not a separate decoration next to it. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-px overflow-hidden motion-reduce:hidden"
        >
          <span className="absolute inset-x-0 top-0 h-24 animate-[nav-trace_9s_ease-in-out_infinite] bg-gradient-to-b from-transparent via-accent/40 to-transparent" />
        </span>

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
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-muted">{total}</span>
            {/* Desktop-only: collapses the whole sidebar, not a section
                inside it — do not confuse with Expand all / Collapse all
                below, which never remove the nav itself. Hidden below `lg`
                because the mobile drawer already has its own close
                affordance (the hamburger button above); this would just be
                a second, redundant way to dismiss the same panel there. */}
            <button
              type="button"
              onClick={() => setSidebarHiddenPersisted(true)}
              aria-expanded={mounted ? !sidebarHidden : undefined}
              aria-controls="site-nav"
              className="hidden size-6 shrink-0 items-center justify-center rounded-sm text-muted outline-none transition-colors hover:bg-surface hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none lg:inline-flex"
            >
              <span className="sr-only">Hide sidebar</span>
              <RailChevron direction="left" />
            </button>
          </div>
        </div>

        <div className="px-4 pb-3">
          {/* "sidebar" in both the visible text and the label — this box and
              the catalog's own search sit in near-identical bordered fields
              and, before this, both just said "Search"/"Filter components":
              nothing on screen said they're two different result sets
              (this narrows the tree, the catalog's narrows the grid), so
              typing in one and expecting the other to react was a
              reasonable, wrong assumption. Labelled apart rather than
              wired together — they genuinely answer different questions. */}
          <div className="search-trace-field relative rounded-md">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter sidebar"
              aria-label="Filter sidebar"
              className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
            />
            <span aria-hidden className="search-trace pointer-events-none motion-reduce:hidden" />
          </div>
        </div>

        {/* Bulk controls — at 223 items across up to three levels, hunting
            down every chevron by hand is the wrong default interaction. */}
        <div className="flex items-center gap-3 px-4 pb-2 font-mono text-[10px] uppercase tracking-wider text-muted">
          {/* Expand all is a one-off "show me everything right now", not a
              standing preference — it doesn't persist, so the tree is back
              to normal on the next visit. Collapse all is the opposite kind
              of click (a deliberate reset) and does persist. */}
          <button
            type="button"
            onClick={() => setOpenIds(new Set(allIds))}
            className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={() => {
              const empty = new Set<string>();
              setOpenIds(empty);
              persistOpen(empty);
            }}
            className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
          >
            Collapse all
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-6">
          {isFiltering && shown === 0 ? (
            <p className="px-2 py-3 text-sm text-muted">No match.</p>
          ) : null}
          {filtered.map((g) => (
            <NavCategory
              key={g.id}
              group={g}
              open={isFiltering || openIds.has(g.id)}
              onToggle={(v) => toggle(g.id, v)}
              openIds={openIds}
              onToggleKind={toggle}
              isFiltering={isFiltering}
              active={active}
              activeRef={activeRef}
            />
          ))}
        </div>

        {/* flex-wrap so a long signed-in name/email drops to its own line
            (SiteAuth's `basis-full` below) instead of overflowing past the
            sidebar's fixed width — it never affects Changelog/Writing/Connect
            themselves, which stay on the first line at any name length. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border px-4 py-3 font-mono text-[11px] text-muted">
          <Link
            href="/categories"
            className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
          >
            Categories
          </Link>
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
          <Link
            href="/community"
            className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
          >
            Community
          </Link>
          <Link
            href="/guidelines"
            className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
          >
            Guidelines
          </Link>
          <Link
            href="/connect"
            className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
          >
            Connect
          </Link>
          {/* Hydration-only — see site-auth.tsx for why it fetches nothing
              until after paint and never flashes a different state than the
              signed-out default already rendered here. */}
          <SiteAuth />
        </div>
      </nav>

      {/* The rail that survives hiding the sidebar — CSS-only visibility
          (see the `.sidebar-restore` rule in globals.css) so it appears in
          the exact same paint as the collapse itself, pre-hydration
          included, instead of the button vanishing along with the nav it
          controls. Desktop-only by construction: that CSS rule only ever
          applies at the `lg` breakpoint. */}
      <button
        type="button"
        onClick={() => setSidebarHiddenPersisted(false)}
        aria-expanded={mounted ? !sidebarHidden : undefined}
        aria-controls="site-nav"
        className="sidebar-restore fixed left-0 top-4 z-40 h-11 w-6 items-center justify-center rounded-r-md border border-l-0 border-border bg-background text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none"
      >
        <span className="sr-only">Show sidebar</span>
        <RailChevron direction="right" />
      </button>

      <div className="min-w-0 flex-1">{children}</div>

      {/* /connect is where this popup would send someone — pointless there.
          Every /preview/<name> shape (bare route + /embed, the screenshot
          gate and every card's iframe) already returned above this point. */}
      {pathname !== "/connect" ? <McpPopup /> : null}
    </div>
  );
}

/** Only counts items — kinds are just a grouping of the same items, not
 *  additional ones, so `count` fields would double a component up otherwise. */
const countGroup = (g: NavGroup) =>
  g.items.length + g.kinds.reduce((n, k) => n + k.items.length, 0);

/**
 * Category-level `<details>`. `<summary>` is the platform's own disclosure
 * control — free keyboard support (Enter/Space) and `aria-expanded` handled
 * by the browser, so there's no bespoke button+state to keep in sync.
 */
function NavCategory({
  group,
  open,
  onToggle,
  openIds,
  onToggleKind,
  isFiltering,
  active,
  activeRef,
}: {
  group: NavGroup;
  open: boolean;
  onToggle: (open: boolean) => void;
  openIds: Set<string>;
  onToggleKind: (id: string, open: boolean) => void;
  isFiltering: boolean;
  active: string | null;
  activeRef: React.RefObject<HTMLAnchorElement | null>;
}) {
  return (
    <details
      className="group/cat mb-1"
      open={open}
      onToggle={(e) => onToggle(e.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-sm px-2 py-1.5 outline-none [&::-webkit-details-marker]:hidden hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent">
        <span className="flex items-center gap-1.5 text-[12px] text-muted group-hover/cat:text-foreground">
          <Chevron />
          {group.label}
        </span>
        <span className="font-mono text-[10px] text-muted">{group.count}</span>
      </summary>

      <div className="pl-1.5">
        {group.kinds.map((k) => (
          <NavKindGroup
            key={k.id}
            kind={k}
            open={isFiltering || openIds.has(k.id)}
            onToggle={(v) => onToggleKind(k.id, v)}
            active={active}
            activeRef={activeRef}
          />
        ))}
        {group.items.length > 0 ? (
          <ul>
            {group.items.map((i) => (
              <NavLink key={i.name} item={i} active={active} activeRef={activeRef} />
            ))}
          </ul>
        ) : null}
      </div>
    </details>
  );
}

/** Kind-level `<details>`, nested one indent further than its category. */
function NavKindGroup({
  kind,
  open,
  onToggle,
  active,
  activeRef,
}: {
  kind: NavKind;
  open: boolean;
  onToggle: (open: boolean) => void;
  active: string | null;
  activeRef: React.RefObject<HTMLAnchorElement | null>;
}) {
  return (
    <details
      className="group/kind"
      open={open}
      onToggle={(e) => onToggle(e.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-sm px-2 py-1 pl-3.5 text-xs outline-none [&::-webkit-details-marker]:hidden hover:bg-surface hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent">
        <span className="flex items-center gap-1.5 text-muted group-hover/kind:text-foreground">
          <Chevron small />
          {kind.label}
        </span>
        <span className="font-mono text-[10px] text-muted">{kind.items.length}</span>
      </summary>
      <ul className="pl-3">
        {kind.items.map((i) => (
          <NavLink key={i.name} item={i} active={active} activeRef={activeRef} />
        ))}
      </ul>
    </details>
  );
}

function NavLink({
  item,
  active,
  activeRef,
}: {
  item: NavItem;
  active: string | null;
  activeRef: React.RefObject<HTMLAnchorElement | null>;
}) {
  const on = item.name === active;
  return (
    <li>
      <Link
        ref={on ? activeRef : undefined}
        href={`/preview/${item.name}/play`}
        // This sidebar lists every component, so the default fired ~126 RSC
        // prefetches on every page load — for a list the visitor picks at
        // most one item from. Before these routes were made cacheable that
        // was ~126 uncached function invocations per visit; now it is merely
        // 126 wasted CDN round trips. The target is prerendered, so the click
        // is fast without them.
        prefetch={false}
        aria-current={on ? "page" : undefined}
        className={`${LINK} ${on ? "bg-surface font-medium text-accent" : "text-muted"}`}
      >
        {item.title}
      </Link>
    </li>
  );
}

/**
 * Narrows every level of the tree to items whose name/title matches, drops
 * kinds and categories left empty by that, and leaves the rest untouched.
 * Kept out of `lib/nav-data.ts` — this operates on the client-typed query,
 * not on anything server-derivable.
 */
function filterGroups(groups: NavGroup[], query: string): NavGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;
  const matches = (i: NavItem) => i.name.includes(q) || i.title.toLowerCase().includes(q);
  return groups
    .map((g) => {
      const kinds = g.kinds
        .map((k) => ({ ...k, items: k.items.filter(matches) }))
        .filter((k) => k.items.length > 0);
      const items = g.items.filter(matches);
      return { ...g, kinds, items, count: items.length + kinds.reduce((n, k) => n + k.items.length, 0) };
    })
    .filter((g) => g.count > 0);
}

function Chevron({ small }: { small?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`${small ? "size-2.5" : "size-3"} shrink-0 -rotate-90 text-muted transition-transform duration-150 ease-out group-open/cat:rotate-0 group-open/kind:rotate-0 motion-reduce:transition-none`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

/** Same chevron path as `Chevron` above (and the Sort select in
 *  catalog-controls.tsx) — the site's one chevron glyph, just pointed left
 *  (collapse) or right (restore) instead of tied to a `<details>`'s own
 *  open/closed rotation. */
function RailChevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`size-3 shrink-0 text-muted ${direction === "left" ? "rotate-90" : "-rotate-90"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
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
