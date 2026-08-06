"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

// A breadcrumb that gives way from the middle. When the trail can't fit, the
// root and the last two levels survive and everything between them folds into
// one "…" button that opens a menu of the hidden levels — so nothing is lost
// to keyboard or assistive tech, it just moves.
//
// Every width used by the fit calculation is read from a second, hidden copy
// of the FULL uncollapsed trail (absolute, visibility:hidden, nowrap) that sits
// outside flow and never changes size. Measuring the visible list instead is
// the classic way to break this: collapsing shrinks the measured content, which
// says "it fits", which expands, which overflows — permanent jitter at any
// width near the threshold. The "…" chip's own width is in the ghost layer and
// in the budget, and everything is remeasured once on document.fonts.ready
// because a webfont swap moves every number.
//
// The current level carries a 2px accent underline that sweeps 0 → text width
// whenever the last crumb's id changes (the span is keyed on it, so arriving
// somewhere new re-runs the sweep). Reduced motion renders it at full width
// with no transition and mounts the menu with no fade.

export type Crumb = {
  id: string;
  label: string;
  /** Renders an <a>. Omit and the crumb renders a <button>. */
  href?: string;
};

export interface WornPathProps {
  /** Ordered root → current. The last item is the current page. */
  items: Crumb[];
  /** Rendered between crumbs. Default "/". */
  separator?: ReactNode;
  /** Crumbs at the head that can never collapse. Default 1. */
  minVisibleHead?: number;
  /** Crumbs at the tail that can never collapse, current included. Default 2. */
  minVisibleTail?: number;
  /** called when a non-current crumb is activated */
  onNavigate?: (item: Crumb, index: number) => void;
  /** accessible name for the breadcrumb nav */
  ariaLabel?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

// re-expanding costs 24px more room than staying collapsed, so a container
// resting exactly on the threshold settles instead of oscillating
const HYSTERESIS = 24;

const crumbClass = (current: boolean) =>
  current
    ? "whitespace-nowrap px-1 py-0.5 text-sm font-medium text-foreground"
    : [
        "whitespace-nowrap rounded-sm px-1 py-0.5 text-sm text-ns-muted",
        "transition-colors duration-150 ease-out",
        "hover:bg-surface hover:text-foreground",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ns-accent",
      ].join(" ");

export function WornPath({
  items,
  separator = "/",
  minVisibleHead = 1,
  minVisibleTail = 2,
  onNavigate,
  ariaLabel = "Breadcrumb",
  className = "",
}: WornPathProps) {
  const rootRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const ghostItemsRef = useRef<(HTMLLIElement | null)[]>([]);
  const ghostSepRef = useRef<HTMLLIElement>(null);
  const ghostMoreRef = useRef<HTMLLIElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const [hidden, setHidden] = useState<number[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // viewport coords for the portaled menu — the "…" trigger lives inside an
  // overflow-hidden <ol> (that clip is load-bearing: it's what keeps the
  // collapsing trail from flashing wide before a resize settles), so the menu
  // itself renders through a portal into <body> instead of being clipped with it
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  // read inside callbacks that must not churn on every parent render
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;

  // identity-independent signature: an inline `items={[...]}` literal in the
  // parent must not restart the observer on every render
  const signature = items.map((i) => `${i.id}${i.label}`).join("");

  const measure = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const avail = list.clientWidth;
    if (!avail) return;

    const n = itemsRef.current.length;
    const w = ghostItemsRef.current.slice(0, n).map((el) => el?.getBoundingClientRect().width ?? 0);
    if (w.length < n || w.some((x) => x === 0)) return; // not laid out yet
    const sep = ghostSepRef.current?.getBoundingClientRect().width ?? 0;
    const more = ghostMoreRef.current?.getBoundingClientRect().width ?? 0;

    const wasCollapsed = hiddenRef.current.length > 0;
    const budget = avail - (wasCollapsed ? HYSTERESIS : 0);

    const full = w.reduce((a, b) => a + b, 0) + sep * Math.max(0, n - 1);
    let next: number[] = [];

    if (full > budget) {
      // candidates are everything the head/tail guarantees don't protect,
      // ordered from the middle outward
      const first = Math.max(0, minVisibleHead);
      const last = n - 1 - Math.max(0, minVisibleTail);
      const mid = Math.floor(n / 2);
      const candidates: number[] = [];
      for (let i = first; i <= last; i++) candidates.push(i);
      candidates.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || a - b);

      const drop = new Set<number>();
      for (const idx of candidates) {
        drop.add(idx);
        // shown = surviving crumbs + the "…" chip, so separators = shown - 1
        const shown = n - drop.size + 1;
        const width =
          w.reduce((a, b, i) => (drop.has(i) ? a : a + b), 0) + more + sep * (shown - 1);
        if (width <= budget) break;
      }
      next = [...drop].sort((a, b) => a - b);
    }

    // identical result → no setState, so the observer can never feed itself
    const prev = hiddenRef.current;
    if (prev.length === next.length && prev.every((v, i) => v === next[i])) return;
    hiddenRef.current = next;
    setHidden(next);
  }, [minVisibleHead, minVisibleTail]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(root);

    // a webfont swap after first paint invalidates every width above
    let live = true;
    if (document.fonts) {
      document.fonts.ready.then(() => {
        if (live) measure();
      });
    }

    return () => {
      live = false;
      ro.disconnect();
    };
  }, [measure, signature]);

  const hiddenSet = useMemo(() => new Set(hidden), [hidden]);
  const hiddenItems = useMemo(
    () => items.map((item, i) => ({ item, i })).filter(({ i }) => hiddenSet.has(i)),
    [items, hiddenSet]
  );

  // nothing left to show in the menu — close it rather than strand a popover
  useEffect(() => {
    if (!hiddenItems.length) setOpen(false);
  }, [hiddenItems.length]);

  useEffect(() => {
    if (!open) return;
    setActive(0);
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || moreBtnRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  // the menu is portaled to <body> (see menuPos comment above), so its
  // position has to be read off the trigger explicitly instead of relying on
  // CSS `absolute` + a positioned ancestor
  useEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    const place = () => {
      const rect = moreBtnRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuPos({ top: rect.bottom + 8, left: rect.left });
    };
    place();
    window.addEventListener("resize", place);
    document.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      document.removeEventListener("scroll", place, true);
    };
  }, [open]);

  // roving tabindex: exactly one menuitem is tabbable and it holds focus.
  // The menu now mounts a tick after `open` flips true (menuPos arrives via
  // its own effect, see above), so menuRef is still null on the render this
  // effect first sees — `menuReady` (a boolean, not the menuPos object) is
  // what re-fires it once the menu is actually in the DOM. Using menuPos
  // itself here would refire on every scroll/resize reposition and yank
  // focus back to item 0 mid-scroll.
  const menuReady = menuPos !== null;
  useEffect(() => {
    if (!open) return;
    const el = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]')[active];
    el?.focus();
  }, [open, active, menuReady]);

  const closeMenu = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) moreBtnRef.current?.focus();
  }, []);

  const onMenuKeyDown = (e: ReactKeyboardEvent) => {
    const count = hiddenItems.length;
    if (!count) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => (i + 1) % count);
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => (i - 1 + count) % count);
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(count - 1);
        break;
      case "Escape":
        e.preventDefault();
        closeMenu(true);
        break;
      case "Tab":
        // let focus move on naturally, just don't leave a popover behind
        closeMenu(false);
        break;
    }
  };

  const navigate = (item: Crumb, index: number) => {
    onNavigate?.(item, index);
  };

  const lastIndex = items.length - 1;

  const renderCrumb = (item: Crumb, index: number) => {
    if (index === lastIndex) {
      return <CurrentCrumb key={item.id} label={item.label} />;
    }
    const cls = crumbClass(false);
    return item.href ? (
      <a href={item.href} className={cls} onClick={() => navigate(item, index)}>
        {item.label}
      </a>
    ) : (
      <button type="button" className={cls} onClick={() => navigate(item, index)}>
        {item.label}
      </button>
    );
  };

  // walk the whole trail once, emitting the "…" chip in the slot the hidden
  // run vacated so the collapse reads as a fold, not a truncation
  const row: ReactNode[] = [];
  let moreEmitted = false;
  items.forEach((item, index) => {
    if (hiddenSet.has(index)) {
      if (moreEmitted) return;
      moreEmitted = true;
      row.push(
        <li key="ns-wp-more" className="flex items-center">
          <button
            ref={moreBtnRef}
            type="button"
            data-ns-wp-more
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={open ? menuId : undefined}
            aria-label={`Show ${hiddenItems.length} hidden level${hiddenItems.length === 1 ? "" : "s"}`}
            onClick={() => setOpen((o) => !o)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setOpen(true);
              } else if (e.key === "Escape" && open) {
                setOpen(false);
              }
            }}
            className={[
              "ns-wp-more rounded-sm border border-border px-1.5 py-0.5 text-sm leading-none text-ns-muted",
              "transition-colors duration-150 ease-out",
              "hover:border-ns-accent hover:bg-surface hover:text-foreground",
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ns-accent",
            ].join(" ")}
          >
            …
          </button>
          {open && hiddenItems.length > 0 && menuPos && typeof document !== "undefined"
            ? createPortal(
                <div
                  ref={menuRef}
                  id={menuId}
                  role="menu"
                  aria-label="Hidden levels"
                  onKeyDown={onMenuKeyDown}
                  style={{ top: menuPos.top, left: menuPos.left }}
                  className={[
                    "ns-wp-menu fixed z-50 min-w-[11rem] rounded-md",
                    "border border-border bg-surface p-1 shadow-lg",
                  ].join(" ")}
                >
                  {hiddenItems.map(({ item: hiddenItem, i }, pos) => {
                    const itemCls = [
                      "block w-full rounded-sm px-2 py-1.5 text-left text-sm text-ns-muted",
                      "transition-colors duration-150 ease-out",
                      "hover:bg-background hover:text-foreground",
                      "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ns-accent",
                    ].join(" ");
                    const common = {
                      role: "menuitem" as const,
                      tabIndex: pos === active ? 0 : -1,
                      className: itemCls,
                      onFocus: () => setActive(pos),
                      onClick: () => {
                        navigate(hiddenItem, i);
                        closeMenu(true);
                      },
                    };
                    return hiddenItem.href ? (
                      <a key={hiddenItem.id} href={hiddenItem.href} {...common}>
                        {hiddenItem.label}
                      </a>
                    ) : (
                      <button key={hiddenItem.id} type="button" {...common}>
                        {hiddenItem.label}
                      </button>
                    );
                  })}
                </div>,
                document.body
              )
            : null}
        </li>
      );
      return;
    }
    row.push(
      <li key={item.id} className="flex items-center">
        {renderCrumb(item, index)}
      </li>
    );
  });

  // separators are their own presentational items, so one measured separator
  // width covers every gap in the fit calculation
  const withSeparators: ReactNode[] = [];
  row.forEach((node, i) => {
    if (i > 0) {
      withSeparators.push(
        <li key={`sep-${i}`} aria-hidden className="select-none px-2 text-sm text-ns-muted">
          {separator}
        </li>
      );
    }
    withSeparators.push(node);
  });

  return (
    <nav
      ref={rootRef}
      aria-label={ariaLabel}
      className={["relative w-full min-w-0", className].join(" ")}
    >
      <style>{`
.ns-wp-rule{transition:width 260ms cubic-bezier(0.16,1,0.3,1)}
.ns-wp-menu{animation:ns-wp-menu-in 160ms cubic-bezier(0.16,1,0.3,1) both}
@keyframes ns-wp-menu-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){
  .ns-wp-rule{transition:none}
  .ns-wp-menu{animation:none}
}`}</style>

      <ol
        ref={listRef}
        className="flex min-w-0 flex-nowrap items-center overflow-hidden px-0.5 pb-1.5 pt-0.5"
      >
        {withSeparators}
      </ol>

      {/* The measurement layer: the full trail at its natural width, plus one
          separator and one "…" chip. Out of flow, so collapsing the visible
          list cannot change a single number read from here. Kept after the
          real list in DOM order so it is never the first interactive element
          anything walks to. */}
      <ol
        aria-hidden
        className="pointer-events-none invisible absolute left-0 top-0 flex flex-nowrap items-center whitespace-nowrap"
      >
        {items.map((item, index) => (
          <li
            key={item.id}
            ref={(el) => {
              ghostItemsRef.current[index] = el;
            }}
            className="flex items-center"
          >
            <span className={crumbClass(index === lastIndex)}>{item.label}</span>
          </li>
        ))}
        <li ref={ghostSepRef} className="select-none px-2 text-sm">
          {separator}
        </li>
        <li ref={ghostMoreRef} className="flex items-center">
          <span className="ns-wp-more rounded-sm border border-border px-1.5 py-0.5 text-sm leading-none">
            …
          </span>
        </li>
      </ol>
    </nav>
  );
}

// Keyed on the current id by the caller, so arriving at a new level remounts
// this and replays the sweep. Reduced motion snaps it to full width instead.
function CurrentCrumb({ label }: { label: string }) {
  const ruleRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ruleRef.current;
    if (!el) return;
    el.style.width = "0%";
    const id = requestAnimationFrame(() => {
      if (ruleRef.current) ruleRef.current.style.width = "100%";
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <span aria-current="page" className={crumbClass(true)}>
      {/* the rule measures the text, not the crumb's padding box */}
      <span className="relative inline-block">
        {label}
        <span
          ref={ruleRef}
          aria-hidden
          style={{ width: 0 }}
          className="ns-wp-rule absolute bottom-[-3px] left-0 h-[2px] rounded-[1px] bg-ns-accent"
        />
      </span>
    </span>
  );
}
