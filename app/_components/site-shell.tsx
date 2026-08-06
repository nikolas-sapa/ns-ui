"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { locate, type NavGroup, type NavItem, type NavKind } from "@/lib/nav-data";
import { SIDEBAR_HIDDEN_KEY } from "@/lib/sidebar";
import { McpPopup } from "./mcp-popup";
import { SiteAuth } from "./site-auth";
import { SiteFooter } from "./site-footer";
import { ThemeToggle } from "./theme-toggle";
import { CommandPalette, SearchIcon } from "./command-palette";

/**
 * The persistent left sidebar, and the one rule that keeps it from breaking
 * the quality gate:
 *
 * `/preview/<name>` (the BARE route) is what `scripts/verify.ts` and
 * `scripts/record.ts` screenshot, and what `DemoStage` embeds in an iframe on
 * `/components/<name>`. `/preview/<name>/embed` is the cacheable card
 * thumbnail every catalog and featured card loads. Both must stay naked
 * component pages — the gate grabs "the first visible interactive element"
 * for its hover/press/focus diff, and a sidebar full of links would hand it a
 * nav link instead. So those two shapes render children with no chrome at
 * all. (`/preview/<name>/play` no longer exists — folded into
 * `/components/<name>`, see that route's docblock — so there is no third
 * shape to exclude here.)
 *
 * `/embed` has to be listed explicitly: it is a deeper path, so the original
 * single-segment pattern rejected it and every card rendered the full sidebar
 * inside its own iframe (caught by screenshot, after the DOM check passed).
 */
const isBarePreview = (pathname: string) =>
  /^\/preview\/[^/]+(?:\/embed)?$/.test(pathname);

const LINK =
  "block truncate rounded-sm px-2 py-1 text-sm outline-none transition-colors hover:bg-surface hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none";

/** The Install/Theming/Categories/…/Status row at the foot of the sidebar.
 *  Rows are packed tight (measured: 12px horizontal gap, 6px vertical gap
 *  between wrapped rows), so the ::after here is capped at half of each —
 *  the honest ceiling given the row's own spacing, not a full 44px target.
 *  Measured before/after: ~46-66x16.5 -> ~58-78x22.5. */
const BOTTOM_BAR_LINK =
  "relative rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none after:absolute after:-inset-x-[6px] after:-inset-y-[3px] after:content-['']";

/** Same grouping the footer uses (site-footer.tsx's `COLUMNS`) so the two
 *  surfaces never disagree about what belongs together — Browse / Build
 *  with it / For AI agents collapse into this compact bar, plus the items
 *  the footer deliberately omits (Guidelines, Submit, Status are content/
 *  process links, filed under Community; Sign in is an account action, not
 *  content, so it stays out of any group — rendered by <SiteAuth /> below,
 *  unchanged). No column headers here (that's footer-weight for a ~300-row
 *  tree); groups are read by a `·` separator instead, the lightest thing
 *  that still breaks the run into scannable chunks. */
const BOTTOM_BAR_GROUPS: { href: string; label: string }[][] = [
  [
    { href: "/categories", label: "Categories" },
    { href: "/changelog", label: "Changelog" },
  ],
  [
    { href: "/install", label: "Install" },
    { href: "/theming", label: "Theming" },
  ],
  [
    { href: "/writing", label: "Writing" },
    { href: "/community", label: "Community" },
    { href: "/connect", label: "Connect" },
    { href: "/guidelines", label: "Guidelines" },
    { href: "/submit", label: "Submit" },
    { href: "/status", label: "Status" },
  ],
];

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
  const [cmdkOpen, setCmdkOpen] = useState(false);

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
  const mainRef = useRef<HTMLDivElement | null>(null);
  const isFiltering = query.trim().length > 0;

  // Both the playground and the component detail page point at the same
  // component, so both should light up the tree.
  const active = /^\/(?:preview|components)\/([^/]+)/.exec(pathname)?.[1] ?? null;
  // Narrower than `active`: that also matches the `/preview/<name>` shapes
  // (bare fixture, playground), where the row is styled active but the link
  // still goes somewhere else. `aria-current="page"` should only fire on the
  // canonical `/components/<name>` page itself — computed once here (one
  // `usePathname` read for the whole tree) rather than inside every one of
  // the ~300 `NavLink`s, which used to each subscribe to the router's own
  // pathname and so all re-rendered on *any* navigation, active tree or not.
  const isOnComponentPage = pathname.startsWith("/components/");

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

  // ⌘K / Ctrl+K opens the command palette from anywhere on the page —
  // registered here rather than inside CommandPalette itself, since it has
  // to fire while that component is unmounted (cmdkOpen === false).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      setCmdkOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Move focus to the page's own heading on every route change — otherwise
  // focus silently stays wherever the link that was just clicked sat in the
  // DOM (or, for the skip link below, on the sidebar itself), which is not
  // where a keyboard or screen-reader visitor actually landed. Skipped on
  // first mount: that's a hard navigation/reload, and stealing focus from
  // wherever the visitor already put it (a hash link, an autofocused field)
  // would be the opposite of helpful.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const container = mainRef.current;
    if (!container) return;
    const heading = container.querySelector<HTMLElement>("h1") ?? container;
    if (heading !== container && !heading.hasAttribute("tabindex")) {
      heading.setAttribute("tabindex", "-1");
    }
    heading.focus();
  }, [pathname]);

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
      {/* First focusable element on every chrome-wrapped page — jumps a
          keyboard visitor straight past the sidebar's ~300 links to the
          actual page content, instead of tabbing through the whole tree
          every single visit. */}
      <a
        href="#main"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-50 focus-visible:rounded-sm focus-visible:bg-ns-accent focus-visible:px-3 focus-visible:py-2 focus-visible:text-sm focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Skip to main content
      </a>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="site-nav"
        className="fixed left-3 top-3 z-50 inline-flex h-11 w-11 items-center justify-center rounded-md border border-border bg-background text-ns-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent lg:hidden transition-colors"
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
        className={`fixed inset-y-0 left-0 z-40 flex w-[17rem] flex-col border-r border-border bg-background transition-[transform,translate,visibility] lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 motion-reduce:transition-none ${
          open ? "translate-x-0" : "-translate-x-full invisible lg:visible"
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
          <span className="absolute inset-x-0 top-0 h-24 animate-[nav-trace_9s_ease-in-out_infinite] bg-gradient-to-b from-transparent via-ns-accent/40 to-transparent" />
        </span>

        {/* pl-14 clears the fixed mobile toggle button (44px, left-3 top-3),
            which otherwise sits directly on top of the wordmark once the
            drawer is open. Not needed at lg — the toggle is hidden there.
            pt-7 does the same vertically: the button's 56px footprint (top-3 +
            44px) otherwise overlapped the filter field below, clipping its
            top-left corner. pt-6 lands flush, so pt-7 for visible daylight. */}
        <div className="flex items-center justify-between gap-2 pb-3 pl-14 pr-4 pt-7 lg:pl-4 lg:pt-5">
          <Link
            href="/"
            className="rounded-sm font-mono text-sm tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ns-accent"
          >
            ns-ui
          </Link>
          <div className="flex items-center gap-2.5">
            {/* Grown alongside the old ⌘K trigger that used to sit here
                (size-8 -> size-9, icon size-3.5 -> size-4). Now that the
                trigger has moved to its own full-width row below, this is
                back to being one of two controls in the cluster rather than
                three, which is the room it was missing. */}
            <ThemeToggle />
            <span className="font-mono text-[11px] text-ns-muted">{total}</span>
            {/* Desktop-only: collapses the whole sidebar, not a section
                inside it — do not confuse with Expand all / Collapse all
                below, which never remove the nav itself. Hidden below `lg`
                because the mobile drawer already has its own close
                affordance (the hamburger button above); this would just be
                a second, redundant way to dismiss the same panel there.
                ::after grows the click region only — capped at half the gap
                to the theme toggle on its left, generous vertically like its
                row siblings — 24x24 -> ~36x44. Re-measured after the ⌘K
                trigger left this row: nothing to its left now but the theme
                toggle + count, well clear either way. */}
            <button
              type="button"
              onClick={() => setSidebarHiddenPersisted(true)}
              aria-expanded={mounted ? !sidebarHidden : undefined}
              aria-controls="site-nav"
              className="relative hidden size-6 shrink-0 items-center justify-center rounded-sm text-ns-muted outline-none transition-colors hover:bg-surface hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none lg:inline-flex after:absolute after:-inset-x-[6px] after:-inset-y-[10px] after:content-['']"
            >
              <span className="sr-only">Hide sidebar</span>
              <RailChevron direction="left" />
            </button>
          </div>
        </div>

        <div className="px-4 pb-3">
          {/* Site-wide jump-to (command-palette.tsx), redesigned as a proper
              search field rather than a scaled-up chip: full-width, bordered,
              magnifier left, muted placeholder, ⌘K hint right-aligned — the
              pattern shadcn/Linear/Vercel/Radix docs all converge on for this
              exact job. It is a <button>, not an <input readOnly>: a real
              input would take a text caret, break Space-to-activate and
              fight the global ⌘K listener below, where a button gets
              Enter/Space for free and needs no extra wiring. Measured (visual
              box): 322x44 at the sidebar's 17rem width. */}
          <button
            type="button"
            onClick={() => setCmdkOpen(true)}
            aria-label="Search components and pages"
            className="search-trace-field group/cmdk relative flex w-full items-center gap-2 rounded-md border border-border bg-surface px-3 py-2.5 text-left text-sm text-ns-muted outline-none transition-colors hover:border-ns-accent/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none"
          >
            <SearchIcon className="size-4 shrink-0" />
            <span className="flex-1 truncate">Search components…</span>
            <kbd className="hidden shrink-0 rounded-sm border border-border bg-background px-1.5 py-0.5 font-mono text-[11px] text-ns-muted transition-colors group-hover/cmdk:border-ns-accent/40 motion-reduce:transition-none sm:inline">
              ⌘K
            </kbd>
            <span aria-hidden className="search-trace pointer-events-none motion-reduce:hidden" />
          </button>
        </div>

        {/* The tree's own filter — visually subordinate to the search field
            above (borderless, funnel glyph, small type) rather than a second
            bordered box that reads as the same control twice. This project
            already got bitten once by exactly that: two near-identical
            bordered search fields (this one and the catalog's) with nothing
            on screen saying they answer different questions — see the
            comment this replaced. Grouped below with Expand/Collapse, its
            fellow tree controls, instead of living up in the header cluster. */}
        <div className="px-4 pb-1.5">
          <div className="relative flex items-center gap-1.5 rounded-sm text-ns-muted focus-within:text-foreground">
            <FunnelIcon className="size-3 shrink-0" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              // Same Escape-to-clear as the catalog search, so the two
              // near-identical fields don't answer the same key differently.
              onKeyDown={(e) => {
                if (e.key === "Escape" && query) {
                  setQuery("");
                  e.currentTarget.blur();
                }
              }}
              placeholder="Filter sidebar"
              aria-label="Filter sidebar"
              className="w-full bg-transparent py-1 text-xs outline-none placeholder:text-ns-muted"
            />
          </div>
        </div>

        {/* Bulk controls — at 223 items across up to three levels, hunting
            down every chevron by hand is the wrong default interaction. */}
        <div className="flex items-center gap-3 px-4 pb-2 font-mono text-[10px] uppercase tracking-wider text-ns-muted">
          {/* Expand all is a one-off "show me everything right now", not a
              standing preference — it doesn't persist, so the tree is back
              to normal on the next visit. Collapse all is the opposite kind
              of click (a deliberate reset) and does persist. */}
          <button
            type="button"
            onClick={() => setOpenIds(new Set(allIds))}
            className="rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none"
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
            className="rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none"
          >
            Collapse all
          </button>
        </div>

        {/* data-lenis-prevent: this tree scrolls independently of the page
            (min-h-0 flex-1 overflow-y-auto). Without the attribute, the
            window-level Lenis instance in the root layout would eat wheel
            events over the sidebar and scroll the page behind it instead of
            the nav tree. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-6" data-lenis-prevent>
          {isFiltering && shown === 0 ? (
            <p className="px-2 py-3 text-sm text-ns-muted">No match.</p>
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
              isOnComponentPage={isOnComponentPage}
              activeRef={activeRef}
            />
          ))}
        </div>

        {/* flex-wrap so a long signed-in name/email drops to its own line
            (SiteAuth's `basis-full` below) instead of overflowing past the
            sidebar's fixed width — it never affects Changelog/Writing/Connect
            themselves, which stay on the first line at any name length. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border px-4 py-3 font-mono text-[11px] text-ns-muted">
          {BOTTOM_BAR_GROUPS.map((group, gi) => (
            <span key={gi} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {gi > 0 ? <span aria-hidden className="text-ns-muted/40">·</span> : null}
              {group.map((link) => (
                <Link key={link.href} href={link.href} className={BOTTOM_BAR_LINK}>
                  {link.label}
                </Link>
              ))}
            </span>
          ))}
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
        className="sidebar-restore fixed left-0 top-4 z-40 h-11 w-6 items-center justify-center rounded-r-md border border-l-0 border-border bg-background text-ns-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none"
      >
        <span className="sr-only">Show sidebar</span>
        <RailChevron direction="right" />
      </button>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* The skip link above and the route-change focus effect both target
            this — `tabIndex={-1}` makes it (or, more often, the first `h1`
            inside it) programmatically focusable without adding it to the
            normal Tab order. */}
        <div id="main" ref={mainRef} tabIndex={-1} className="min-w-0 flex-1 outline-none">
          {children}
        </div>
        <SiteFooter />
      </div>

      {/* /connect is where this popup would send someone — pointless there.
          Every /preview/<name> shape (bare route + /embed, the screenshot
          gate and every card's iframe) already returned above this point. */}
      {pathname !== "/connect" ? <McpPopup /> : null}

      <CommandPalette open={cmdkOpen} onClose={() => setCmdkOpen(false)} />
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
  isOnComponentPage,
  activeRef,
}: {
  group: NavGroup;
  open: boolean;
  onToggle: (open: boolean) => void;
  openIds: Set<string>;
  onToggleKind: (id: string, open: boolean) => void;
  isFiltering: boolean;
  active: string | null;
  isOnComponentPage: boolean;
  activeRef: React.RefObject<HTMLAnchorElement | null>;
}) {
  return (
    <details
      className="group/cat mb-1"
      open={open}
      onToggle={(e) => onToggle(e.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-sm px-2 py-1.5 outline-none transition-colors [&::-webkit-details-marker]:hidden hover:bg-surface focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none">
        <span className="flex items-center gap-1.5 text-[12px] text-ns-muted transition-colors group-hover/cat:text-foreground motion-reduce:transition-none">
          <Chevron />
          {group.label}
        </span>
        <span className="font-mono text-[10px] text-ns-muted">{group.count}</span>
      </summary>

      <div className="pl-1.5">
        {group.kinds.map((k) => (
          <NavKindGroup
            key={k.id}
            kind={k}
            open={isFiltering || openIds.has(k.id)}
            onToggle={(v) => onToggleKind(k.id, v)}
            active={active}
            isOnComponentPage={isOnComponentPage}
            activeRef={activeRef}
          />
        ))}
        {group.items.length > 0 ? (
          <ul>
            {group.items.map((i) => (
              <NavLink
                key={i.name}
                item={i}
                isActiveItem={i.name === active}
                isCurrentPage={isOnComponentPage && i.name === active}
                activeRef={activeRef}
              />
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
  isOnComponentPage,
  activeRef,
}: {
  kind: NavKind;
  open: boolean;
  onToggle: (open: boolean) => void;
  active: string | null;
  isOnComponentPage: boolean;
  activeRef: React.RefObject<HTMLAnchorElement | null>;
}) {
  return (
    <details
      className="group/kind"
      open={open}
      onToggle={(e) => onToggle(e.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-sm px-2 py-1 pl-3.5 text-xs outline-none transition-colors [&::-webkit-details-marker]:hidden hover:bg-surface hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none">
        <span className="flex items-center gap-1.5 text-ns-muted transition-colors group-hover/kind:text-foreground motion-reduce:transition-none">
          <Chevron small />
          {kind.label}
        </span>
        <span className="font-mono text-[10px] text-ns-muted">{kind.items.length}</span>
      </summary>
      <ul className="pl-3">
        {kind.items.map((i) => (
          <NavLink
            key={i.name}
            item={i}
            isActiveItem={i.name === active}
            isCurrentPage={isOnComponentPage && i.name === active}
            activeRef={activeRef}
          />
        ))}
      </ul>
    </details>
  );
}

/**
 * Wrapped in `memo` and given only booleans a caller has already reduced
 * per-item (`isActiveItem`, `isCurrentPage`) instead of the raw `active`
 * string/`pathname` every prior version compared internally: passing the raw
 * value meant *every* one of the ~300 rendered links got a "changed" prop on
 * any navigation (the string itself always differs), so memo could never
 * bail. With a boolean, only the (at most two) links whose own membership
 * actually flipped receive a different prop; the rest see the exact same
 * `false` they had before and skip re-rendering entirely. This also drops
 * this component's own `usePathname()` call, which subscribed all ~300
 * instances to the router directly and forced every one of them to update on
 * *any* route change regardless of props — memoizing alone would not have
 * fixed that.
 */
const NavLink = memo(function NavLink({
  item,
  isActiveItem,
  isCurrentPage,
  activeRef,
}: {
  item: NavItem;
  isActiveItem: boolean;
  isCurrentPage: boolean;
  activeRef: React.RefObject<HTMLAnchorElement | null>;
}) {
  return (
    <li>
      <Link
        ref={isActiveItem ? activeRef : undefined}
        href={`/components/${item.name}`}
        // This sidebar lists every component, so the default fired ~126 RSC
        // prefetches on every page load — for a list the visitor picks at
        // most one item from. Before these routes were made cacheable that
        // was ~126 uncached function invocations per visit; keeping it off
        // matters again now the target is /components/<name>, which reads
        // searchParams and so is not served from the prerender manifest.
        prefetch={false}
        aria-current={isCurrentPage ? "page" : undefined}
        className={`${LINK} ${isActiveItem ? "bg-surface font-medium text-ns-accent" : "text-ns-muted"}`}
      >
        {item.title}
      </Link>
    </li>
  );
});

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
      className={`${small ? "size-2.5" : "size-3"} shrink-0 -rotate-90 text-ns-muted transition-transform duration-150 ease-out group-open/cat:rotate-0 group-open/kind:rotate-0 motion-reduce:transition-none`}
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
      className={`size-3 shrink-0 text-ns-muted ${direction === "left" ? "rotate-90" : "-rotate-90"}`}
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

/** The tree filter's glyph — deliberately not `SearchIcon` (command-palette.tsx),
 *  so the two fields never read as the same control by icon alone: this one
 *  narrows a list already on screen, that one jumps somewhere else. */
function FunnelIcon({ className = "size-3" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 3h11l-4 5v4l-3 1.5V8L2.5 3Z" />
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
