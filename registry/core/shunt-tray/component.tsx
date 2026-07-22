"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

// ---------------------------------------------------------------------------
// ShuntTray — nested menus as telescoping card-catalog trays. Opening a
// submenu never spawns a floating panel beside the parent: it shunts the
// parent tray back (scale(0.97^depth), transform-origin on its own left
// edge — the exposed rail — so the sliver's position is scale-independent
// and only the tray's body recedes away behind the child) and dims it under
// a --muted-tinted film, while the child tray slides in from the right on
// the same rails to translateX(depth * 12px) — a fixed, index-keyed resting
// offset, not a per-open delta. Because every tray's rest offset only
// depends on its own depth, and scale pivots on that same left edge instead
// of moving it, the stack always exposes exactly a 12px sliver of every
// ancestor between its neighbor's offset and its own, regardless of how many
// levels are open beneath it — a live breadcrumb of menu depth.
// Each exposed sliver is covered by a real, separately-focusable button
// (absolutely positioned over that 12px strip, outside the ancestor tray's
// DOM so `inert` on the tray can't swallow it) labeled "Back to {level}";
// clicking it reverses every tray deeper than its target simultaneously,
// each on a 30ms stagger (deepest first) as they slide back to
// translateX(100%) and unmount. One composite layer per tray, transform +
// opacity only, ease-out-expo timing throughout.
//
// A11y: role=menu per tray, role=menuitem per row. ArrowRight/Enter on an
// item with children opens its subtray and moves focus to that subtray's
// first item; ArrowLeft/Escape shunts back one level and restores focus to
// the item that opened the level being left. Every tray that isn't the
// current top gets aria-hidden + inert, so Tab/AT can never land behind the
// active tray — the edge buttons live outside that inert subtree, so they
// stay reachable. prefers-reduced-motion drops the slide/scale/stagger
// entirely: level changes commit synchronously and only the ancestor dim
// film crossfades, over 100ms; the edge buttons render unchanged either way.
// Zero dependencies, DOM + CSS only — no canvas.
// ---------------------------------------------------------------------------

export type ShuntTrayItem = {
  /** stable id — also the React key and the row's data-item-id */
  id: string;
  label: string;
  /** rendered right-aligned in font-mono, e.g. a count or shortcut */
  hint?: string;
  /** presence of items (even []) renders this row as a submenu opener */
  items?: ShuntTrayItem[];
};

export type ShuntTrayProps = {
  /** accessible name of the root tray; also the "Back to {label}" text once it's an ancestor */
  label: string;
  items: ShuntTrayItem[];
  /** fires when a leaf row (no `items`) is activated */
  onSelect?: (item: ShuntTrayItem, path: ShuntTrayItem[]) => void;
  width?: number;
  height?: number;
  className?: string;
};

const EDGE = 12; // px sliver reveal per ancestor level
const RECEDE_MS = 280;
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)"; // ease-out-expo
const STAGGER_MS = 30;
const SCALE_STEP = 0.97;

function scaleFor(k: number) {
  return Math.pow(SCALE_STEP, k);
}

type Level = { label: string; items: ShuntTrayItem[] };

export function ShuntTray({
  label,
  items,
  onSelect,
  width = 300,
  height = 360,
  className = "",
}: ShuntTrayProps) {
  const [path, setPath] = useState<ShuntTrayItem[]>([]);
  const [enteringDepth, setEnteringDepth] = useState<number | null>(null);
  const [poppingToDepth, setPoppingToDepth] = useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const pendingFocusRef = useRef<{ level: number; id: string } | null>(null);
  const lastActionRef = useRef<"open" | "back" | null>(null);
  const rafRef = useRef<number[]>([]);
  const commitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRenderRef = useRef(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(
    () => () => {
      rafRef.current.forEach(cancelAnimationFrame);
      if (commitTimeoutRef.current) clearTimeout(commitTimeoutRef.current);
    },
    []
  );

  const levels = useMemo<Level[]>(() => {
    const base: Level[] = [{ label, items }];
    for (const step of path) base.push({ label: step.label, items: step.items ?? [] });
    return base;
  }, [label, items, path]);

  const committedDepth = levels.length - 1;
  const targetDepth = poppingToDepth ?? committedDepth;

  // Focus + live-region: fires once a change actually settles — never on
  // mount, and never mid-cascade (poppingToDepth re-fires this once it clears).
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    if (poppingToDepth !== null) return;
    const container = containerRef.current;
    const pending = pendingFocusRef.current;
    if (pending) {
      pendingFocusRef.current = null;
      const el = container?.querySelector<HTMLElement>(
        `[data-shunt-level="${pending.level}"] [data-item-id="${CSS.escape(pending.id)}"]`
      );
      el?.focus();
    } else if (lastActionRef.current === "open") {
      const el = container?.querySelector<HTMLElement>(
        `[data-shunt-level="${committedDepth}"] [role="menuitem"]`
      );
      el?.focus();
    }
    lastActionRef.current = null;
    setAnnouncement(`Now showing ${levels[committedDepth].label}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- levels/committedDepth move together
  }, [committedDepth, poppingToDepth]);

  const openChild = useCallback(
    (item: ShuntTrayItem) => {
      if (!item.items || poppingToDepth !== null || enteringDepth !== null) return;
      lastActionRef.current = "open";
      const nextDepth = path.length + 1;
      setPath((p) => [...p, item]);
      if (reducedMotion) return;
      setEnteringDepth(nextDepth);
      const r1 = requestAnimationFrame(() => {
        const r2 = requestAnimationFrame(() => setEnteringDepth(null));
        rafRef.current.push(r2);
      });
      rafRef.current.push(r1);
    },
    [path.length, poppingToDepth, enteringDepth, reducedMotion]
  );

  const shuntTo = useCallback(
    (depth: number) => {
      if (depth >= committedDepth || poppingToDepth !== null || enteringDepth !== null) return;
      const focusId = path[depth]?.id;
      if (focusId) pendingFocusRef.current = { level: depth, id: focusId };
      if (reducedMotion) {
        setPath((p) => p.slice(0, depth));
        return;
      }
      setPoppingToDepth(depth);
      const exitingCount = committedDepth - depth;
      const total = (exitingCount - 1) * STAGGER_MS + RECEDE_MS + 20;
      if (commitTimeoutRef.current) clearTimeout(commitTimeoutRef.current);
      commitTimeoutRef.current = setTimeout(() => {
        setPath((p) => p.slice(0, depth));
        setPoppingToDepth(null);
      }, total);
    },
    [committedDepth, path, poppingToDepth, enteringDepth, reducedMotion]
  );

  const goBack = useCallback(() => {
    if (committedDepth === 0) return;
    shuntTo(committedDepth - 1);
  }, [committedDepth, shuntTo]);

  const handleSelect = useCallback(
    (item: ShuntTrayItem) => onSelect?.(item, path),
    [onSelect, path]
  );

  return (
    <div
      ref={containerRef}
      className={`relative isolate overflow-hidden rounded-md bg-background ${className}`}
      style={{ width, height }}
    >
      {levels.map((level, i) => {
        const exiting = poppingToDepth !== null && i > targetDepth;
        const isTopmost = i === targetDepth;
        const entering = enteringDepth === i;
        const inertNow = !isTopmost;
        const k = exiting ? 0 : Math.max(0, targetDepth - i);
        const transform =
          entering || exiting ? "translateX(100%) scale(1)" : `translateX(${i * EDGE}px) scale(${scaleFor(k)})`;
        const delayMs = exiting ? (committedDepth - i) * STAGGER_MS : 0;

        return (
          <div
            key={i}
            role="menu"
            aria-label={level.label}
            aria-hidden={inertNow || undefined}
            inert={inertNow || undefined}
            data-shunt-level={i}
            className="absolute inset-0 flex flex-col overflow-hidden rounded-md border border-border bg-surface transition-transform will-change-transform motion-reduce:transition-none"
            style={{
              transform,
              transformOrigin: "left center",
              transitionDuration: `${RECEDE_MS}ms`,
              transitionTimingFunction: EASE,
              transitionDelay: `${delayMs}ms`,
              zIndex: i + 1,
            }}
          >
            <div className="flex-1 overflow-y-auto p-1.5">
              {level.items.map((item) => (
                <ShuntRow
                  key={item.id}
                  item={item}
                  isLevelActive={isTopmost}
                  isOpen={committedDepth > i && path[i]?.id === item.id}
                  onOpen={openChild}
                  onSelect={handleSelect}
                  onBack={goBack}
                />
              ))}
              {level.items.length === 0 && (
                <p className="px-3 py-6 text-center text-xs text-muted">No items</p>
              )}
            </div>
            {!isTopmost && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-md bg-muted/20 transition-opacity duration-150 motion-reduce:duration-100"
              />
            )}
          </div>
        );
      })}

      {Array.from({ length: targetDepth }, (_, i) => (
        <button
          key={`edge-${i}`}
          type="button"
          aria-label={`Back to ${levels[i].label}`}
          onClick={() => shuntTo(i)}
          className="absolute inset-y-0 z-[100] bg-transparent transition-colors hover:bg-foreground/5 focus-visible:bg-foreground/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
          style={{ left: i * EDGE, width: EDGE }}
        />
      ))}

      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}

function ShuntRow({
  item,
  isLevelActive,
  isOpen,
  onOpen,
  onSelect,
  onBack,
}: {
  item: ShuntTrayItem;
  isLevelActive: boolean;
  isOpen: boolean;
  onOpen: (item: ShuntTrayItem) => void;
  onSelect: (item: ShuntTrayItem) => void;
  onBack: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const hasChildren = !!item.items;

  function handleKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>) {
    switch (e.key) {
      case "ArrowRight":
        if (hasChildren) {
          e.preventDefault();
          onOpen(item);
        }
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (hasChildren) onOpen(item);
        else onSelect(item);
        break;
      case "ArrowLeft":
      case "Escape":
        e.preventDefault();
        onBack();
        break;
      case "ArrowDown":
      case "ArrowUp": {
        e.preventDefault();
        const menu = ref.current?.closest('[role="menu"]');
        if (!menu) return;
        const siblings = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]'));
        const idx = siblings.indexOf(ref.current!);
        if (idx === -1) return;
        const next = e.key === "ArrowDown" ? (idx + 1) % siblings.length : (idx - 1 + siblings.length) % siblings.length;
        siblings[next]?.focus();
        break;
      }
      default:
        break;
    }
  }

  return (
    <button
      ref={ref}
      type="button"
      role="menuitem"
      data-item-id={item.id}
      aria-haspopup={hasChildren ? "menu" : undefined}
      aria-expanded={hasChildren ? isOpen : undefined}
      tabIndex={isLevelActive ? 0 : -1}
      onClick={() => (hasChildren ? onOpen(item) : onSelect(item))}
      onKeyDown={handleKeyDown}
      className="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-background focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
    >
      <span className="flex-1 truncate">{item.label}</span>
      {item.hint && <span className="font-mono text-xs text-muted">{item.hint}</span>}
      {hasChildren && (
        <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-muted">
          <path
            d="M6 3l5 5-5 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
