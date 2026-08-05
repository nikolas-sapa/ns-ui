"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import registry from "@/registry.json";

type Result = { href: string; label: string; hint?: string };

/** Every non-component destination worth jumping to directly — the sidebar's
 *  own footer row (site-shell.tsx), minus Submit/Guidelines/Status, which
 *  are one click from Community/Categories and would just pad the list. */
const ROUTES: Result[] = [
  { href: "/", label: "Catalog", hint: "Home" },
  { href: "/categories", label: "Categories" },
  { href: "/changelog", label: "Changelog" },
  { href: "/writing", label: "Writing" },
  { href: "/community", label: "Community" },
  { href: "/guidelines", label: "Guidelines" },
  { href: "/submit", label: "Submit a component" },
  { href: "/connect", label: "Connect" },
  { href: "/status", label: "Status" },
];

const MAX_RESULTS = 8;

/** Same substring match the sidebar's own filter uses (site-shell.tsx's
 *  `filterGroups`) — one matching rule for "does this query hit this item"
 *  across the sidebar tree, the catalog grid and this palette, rather than a
 *  second, differently-tuned search living only here. */
const matches = (haystack: string, q: string) => haystack.toLowerCase().includes(q);

/**
 * Site-wide jump-to — every component plus every top-level route, searched
 * by name/title. `/` already focuses the homepage's own catalog search
 * (catalog-controls.tsx), but that only exists on `/`; this is reachable
 * from any page (any `/components/<name>`, `/categories`, `/community`,
 * `/status`…) and additionally knows about the site's routes, not just
 * components. Mounted once from `SiteShell` — same reasoning as `McpPopup`:
 * one instance covers every non-bare-preview page for free.
 *
 * `open`/`onClose` are owned by `SiteShell`, not this component — the ⌘K
 * shortcut has to work from anywhere on the page, including while this is
 * unmounted, so the listener that opens it already has to live one level up
 * regardless. Keeping open-state up there too means there's exactly one
 * source of truth for it, the same split `SiteShell` already uses for its
 * mobile drawer (`open`) and sidebar-hidden state.
 */
export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const router = useRouter();

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Empty query: the routes are the useful "where can I go" list —
      // 298 components with no filter would just be the catalog in
      // registry order, not a meaningful default.
      return ROUTES.slice(0, MAX_RESULTS);
    }
    const routeHits = ROUTES.filter((r) => matches(r.label, q));
    const componentHits: Result[] = [];
    for (const item of registry.items) {
      if (componentHits.length + routeHits.length >= MAX_RESULTS) break;
      if (matches(item.name, q) || matches(item.title, q)) {
        componentHits.push({
          href: `/components/${item.name}`,
          label: item.title,
          hint: "Component",
        });
      }
    }
    return [...routeHits, ...componentHits].slice(0, MAX_RESULTS);
  }, [query]);

  const close = useCallback(() => {
    setQuery("");
    setActiveIndex(0);
    onClose();
    returnFocusRef.current?.focus();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    // Captured on the same tick the dialog opens — SiteShell's own trigger
    // (or whatever else had focus when ⌘K fired) is where focus goes back
    // to on close.
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    // Deferred a frame — the dialog isn't in the DOM yet on the same tick
    // `open` flips true.
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => setActiveIndex(0), [query]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const target = results[activeIndex];
        if (target) {
          close();
          router.push(target.href);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, results, activeIndex, close, router]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={close}
      className="fixed inset-0 z-50 flex items-start justify-center bg-background/70 px-4 pt-[12vh] motion-safe:animate-[cmdk-in_120ms_ease-out]"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Jump to a component or page"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-md border border-border bg-background shadow-lg"
      >
        <div className="search-trace-field relative border-b border-border">
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-list"
            aria-activedescendant={results[activeIndex] ? `cmdk-${activeIndex}` : undefined}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to a component or page…"
            aria-label="Jump to a component or page"
            autoComplete="off"
            spellCheck={false}
            className="w-full bg-transparent px-4 py-3.5 text-sm text-foreground outline-none placeholder:text-ns-muted"
          />
          <span aria-hidden className="search-trace pointer-events-none motion-reduce:hidden" />
        </div>

        <ul id="cmdk-list" ref={listRef} role="listbox" className="max-h-80 overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-ns-muted">No match.</li>
          ) : (
            results.map((r, i) => (
              <li key={r.href} data-index={i}>
                <button
                  id={`cmdk-${i}`}
                  type="button"
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => {
                    close();
                    router.push(r.href);
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm outline-none transition-colors motion-reduce:transition-none ${
                    i === activeIndex ? "bg-surface text-foreground" : "text-ns-muted hover:bg-surface hover:text-foreground"
                  }`}
                >
                  <span className="truncate">{r.label}</span>
                  {r.hint ? (
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-ns-muted">
                      {r.hint}
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="flex items-center gap-3 border-t border-border px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-ns-muted">
          <span>↑↓ Navigate</span>
          <span>↵ Open</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
}

/** Same search glyph `SiteShell` uses on its own trigger button, exported so
 *  that button matches this dialog's icon exactly. */
export function SearchIcon({ className = "size-3" }: { className?: string }) {
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
      <circle cx="7" cy="7" r="4.5" />
      <path d="M13.5 13.5L10.8 10.8" />
    </svg>
  );
}
