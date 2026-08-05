"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// JackKnife — a context menu that unfolds like a pocket knife. A spine
// anchors at the trigger point (the pointer for a right-click, or the
// trigger button's own position for the accessible trigger); menu items are
// slim "blades" hinged at the spine edge, each swinging in with a staggered
// rotation from folded (~80deg, tucked flat against the spine) to open
// (0deg). Every swing is a one-shot ref-driven CSS transition (transform +
// a border-color pulse for the hairline edge highlight) — timed with a
// per-item delay for the stagger — not a continuous rAF loop. A submenu is
// the same component recursively, anchored at the parent blade's tip.
// Distinct from menu-nested-trays (telescoping trays) and dropdown-drape (cloth
// dropdown): this is a radial-fold context-menu primitive.
// ---------------------------------------------------------------------------

export interface JackKnifeItem {
  id: string;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  submenu?: JackKnifeItem[];
}

export interface JackKnifeProps {
  items: JackKnifeItem[];
  onSelect?: (id: string) => void;
  /** region that opens the menu on right-click; the trigger button always works too */
  children?: ReactNode;
  /** accessible name for the trigger button and the menu itself */
  label?: string;
  className?: string;
}

type Anchor = { x: number; y: number; side: "left" | "right" };

const OPEN_MS = 260;
const OPEN_STAGGER_MS = 38;
const CLOSE_MS = 150;
const CLOSE_STAGGER_MS = 22;
const HAIRLINE_HOLD_MS = 120;
const TYPEAHEAD_RESET_MS = 700;
const ITEM_W = 200;
const EDGE_MARGIN = 10;

function computeAnchor(x: number, y: number): Anchor {
  const side: Anchor["side"] = x + ITEM_W + EDGE_MARGIN > window.innerWidth ? "left" : "right";
  return { x, y, side };
}

function clampTop(y: number, height: number) {
  return Math.min(Math.max(EDGE_MARGIN, y), Math.max(EDGE_MARGIN, window.innerHeight - height - EDGE_MARGIN));
}

function foldItem(
  el: HTMLElement | null,
  index: number,
  opening: boolean,
  side: "left" | "right",
  reduced: boolean
) {
  if (!el) return;
  const sign = side === "right" ? -1 : 1;
  if (reduced) {
    el.style.transition = "none";
    el.style.transform = "rotate(0deg)";
    el.style.opacity = opening ? "1" : "0";
    el.style.borderColor = "var(--border)";
    return;
  }
  if (opening) {
    el.style.transition = "none";
    el.style.transform = `rotate(${sign * 80}deg)`;
    el.style.opacity = "0";
    el.style.borderColor = "var(--border)";
    el.getBoundingClientRect(); // force reflow before animating in
    const delay = index * OPEN_STAGGER_MS;
    el.style.transition = `transform ${OPEN_MS}ms cubic-bezier(0.16,1,0.3,1) ${delay}ms, opacity ${OPEN_MS * 0.7}ms linear ${delay}ms, border-color ${OPEN_MS}ms linear ${delay}ms`;
    el.style.transform = "rotate(0deg)";
    el.style.opacity = "1";
    el.style.borderColor = "var(--foreground)";
    window.setTimeout(() => {
      el.style.transition = `border-color ${HAIRLINE_HOLD_MS}ms linear`;
      el.style.borderColor = "var(--border)";
    }, delay + OPEN_MS);
  } else {
    const delay = index * CLOSE_STAGGER_MS;
    el.style.transition = `transform ${CLOSE_MS}ms cubic-bezier(0.6,0,0.84,0) ${delay}ms, opacity ${CLOSE_MS}ms linear ${delay}ms`;
    el.style.transform = `rotate(${sign * 80}deg)`;
    el.style.opacity = "0";
  }
}

interface BladesProps {
  items: JackKnifeItem[];
  anchor: Anchor;
  label: string;
  onSelect: (id: string) => void;
  onClose: (focusTrigger: boolean) => void;
  menuId: string;
}

function Blades({ items, anchor, label, onSelect, onClose, menuId }: BladesProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const reducedRef = useRef(false);
  const [reduced, setReduced] = useState(false);
  const [submenuIndex, setSubmenuIndex] = useState<number | null>(null);
  const [submenuAnchor, setSubmenuAnchor] = useState<Anchor | null>(null);
  const typeaheadRef = useRef({ buffer: "", at: 0 });

  const closableItems = useMemo(() => items.filter((it) => !it.disabled), [items]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    setReduced(mq.matches);
    const onChange = () => {
      reducedRef.current = mq.matches;
      setReduced(mq.matches);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    items.forEach((_, i) => foldItem(itemRefs.current[i] ?? null, i, true, anchor.side, reducedRef.current));
    const first = itemRefs.current.find((el, i) => el && !items[i]?.disabled);
    first?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeSelf = useCallback(
    (focusTrigger: boolean) => {
      items.forEach((_, i) => foldItem(itemRefs.current[i] ?? null, i, false, anchor.side, reducedRef.current));
      const total = reducedRef.current ? 0 : items.length * CLOSE_STAGGER_MS + CLOSE_MS;
      window.setTimeout(() => onClose(focusTrigger), total);
    },
    [items, anchor.side, onClose]
  );

  const openSubmenu = (index: number) => {
    const el = itemRefs.current[index];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = anchor.side === "right" ? rect.right - 8 : rect.left + 8;
    setSubmenuAnchor(computeAnchor(x, rect.top));
    setSubmenuIndex(index);
  };
  const closeSubmenu = () => {
    setSubmenuIndex(null);
    setSubmenuAnchor(null);
  };

  const focusByIndex = (i: number) => {
    const el = itemRefs.current[i];
    el?.focus({ preventScroll: true });
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (submenuIndex !== null) {
      // let the submenu's own handler deal with everything except closing it back here
      if (e.key === "Escape") return; // bubbles from submenu, harmless
      return;
    }
    const enabled = itemRefs.current
      .map((el, i) => ({ el, i }))
      .filter(({ el, i }) => el && !items[i]?.disabled);
    const currentIdx = enabled.findIndex(({ el }) => el === document.activeElement);

    if (e.key === "Escape") {
      e.preventDefault();
      closeSelf(true);
      return;
    }
    if (e.key === "Tab") {
      closeSelf(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = enabled[(currentIdx + 1) % enabled.length];
      if (next) focusByIndex(next.i);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = enabled[currentIdx < 0 ? enabled.length - 1 : (currentIdx - 1 + enabled.length) % enabled.length];
      if (next) focusByIndex(next.i);
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      const first = enabled[0];
      if (first) focusByIndex(first.i);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      const last = enabled[enabled.length - 1];
      if (last) focusByIndex(last.i);
      return;
    }
    if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") {
      const active = items[currentIdx >= 0 ? enabled[currentIdx]!.i : -1];
      if (active?.submenu?.length) {
        e.preventDefault();
        openSubmenu(enabled[currentIdx]!.i);
      } else if (e.key !== "ArrowRight" && active && !active.disabled) {
        e.preventDefault();
        onSelect(active.id);
      }
      return;
    }
    if (e.key === "ArrowLeft") {
      return; // top level has nowhere to go left to; submenu instance handles its own close
    }
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const now = Date.now();
      const ta = typeaheadRef.current;
      ta.buffer = now - ta.at < TYPEAHEAD_RESET_MS ? ta.buffer + e.key : e.key;
      ta.at = now;
      const match = closableItems.find((it) => it.label.toLowerCase().startsWith(ta.buffer.toLowerCase()));
      if (match) {
        const idx = items.indexOf(match);
        focusByIndex(idx);
      }
    }
  };

  const panelTop = clampTop(anchor.y, items.length * 38 + 16);
  const panelLeft = anchor.side === "right" ? anchor.x : anchor.x - ITEM_W;

  return (
    <div
      ref={panelRef}
      role="menu"
      aria-label={label}
      id={menuId}
      onKeyDown={onKeyDown}
      className="fixed z-[950] flex flex-col gap-0.5 rounded-[10px] border border-border bg-background p-1.5 shadow-lg"
      style={{ left: panelLeft, top: panelTop, width: ITEM_W }}
    >
      {items.map((item, i) => (
        <button
          key={item.id}
          ref={(el) => {
            itemRefs.current[i] = el;
          }}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          aria-disabled={item.disabled}
          aria-haspopup={item.submenu ? "menu" : undefined}
          aria-expanded={item.submenu ? submenuIndex === i : undefined}
          tabIndex={-1}
          onMouseEnter={(e: ReactMouseEvent<HTMLButtonElement>) => {
            if (item.submenu?.length) openSubmenu(i);
            else closeSubmenu();
            e.currentTarget.focus({ preventScroll: true });
          }}
          onClick={() => {
            if (item.disabled) return;
            if (item.submenu?.length) openSubmenu(i);
            else onSelect(item.id);
          }}
          className="ns-jk-blade flex origin-left items-center justify-between gap-3 rounded-[6px] border border-transparent px-2.5 py-1.5 text-left text-xs text-foreground outline-none transition-colors hover:bg-border/40 focus-visible:bg-border/40 disabled:pointer-events-none disabled:opacity-40"
        >
          <span className="truncate">{item.label}</span>
          {item.shortcut && <span className="shrink-0 font-mono text-[10px] text-ns-muted">{item.shortcut}</span>}
          {item.submenu && !item.shortcut && <span className="shrink-0 text-[10px] text-ns-muted">{"›"}</span>}
        </button>
      ))}

      {submenuIndex !== null && submenuAnchor && items[submenuIndex]?.submenu && (
        <Blades
          items={items[submenuIndex]!.submenu!}
          anchor={submenuAnchor}
          label={`${items[submenuIndex]!.label} submenu`}
          onSelect={onSelect}
          onClose={(focusTrigger) => {
            closeSubmenu();
            if (focusTrigger) focusByIndex(submenuIndex);
          }}
          menuId={`${menuId}-sub`}
        />
      )}

      {!reduced && <style>{`.ns-jk-blade{transform-box:fill-box;}`}</style>}
    </div>
  );
}

export function JackKnife({ items, onSelect, children, label = "Actions", className = "" }: JackKnifeProps) {
  const autoId = useId();
  const menuId = `jk-menu-${autoId.replace(/:/g, "")}`;

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [open, setOpen] = useState(false);

  const openAt = (x: number, y: number) => setAnchor(computeAnchor(x, y));

  useEffect(() => {
    setOpen(anchor !== null);
  }, [anchor]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      // scoped to this instance's own menu id (and its `-sub` descendants at
      // any depth) — a bare `[role="menu"]` query would match a SECOND
      // JackKnife instance's panel elsewhere on the page and incorrectly
      // treat a click inside THAT menu as "inside this one"
      const panels = document.querySelectorAll(`[id^="${menuId}"]`);
      const target = e.target as Node;
      const inside = Array.from(panels).some((p) => p.contains(target));
      if (!inside) setAnchor(null);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, menuId]);

  const handleSelect = (id: string) => {
    onSelect?.(id);
    setAnchor(null);
    triggerRef.current?.focus();
  };

  const handleClose = (focusTrigger: boolean) => {
    setAnchor(null);
    if (focusTrigger) triggerRef.current?.focus();
  };

  return (
    <div className={`relative inline-block ${className}`}>
      {children && (
        <div
          onContextMenu={(e: ReactMouseEvent) => {
            e.preventDefault();
            openAt(e.clientX, e.clientY);
          }}
        >
          {children}
        </div>
      )}

      <button
        ref={triggerRef}
        type="button"
        data-context-menu-unfold-trigger=""
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(e: ReactMouseEvent<HTMLButtonElement>) => {
          const rect = e.currentTarget.getBoundingClientRect();
          openAt(rect.left, rect.bottom + 6);
        }}
        className="mt-3 rounded-[6px] border border-border px-2.5 py-1.5 text-xs text-foreground transition-colors hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
      >
        {label}
      </button>

      {open && anchor && (
        <Blades
          items={items}
          anchor={anchor}
          label={label}
          onSelect={handleSelect}
          onClose={handleClose}
          menuId={menuId}
        />
      )}
    </div>
  );
}
