"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

// A file/nav/org tree whose indent guides are a rack rail — one straight,
// per-depth SVG line stroked in --border running behind each column of rows —
// and whose keyboard focus is a small mechanical carriage that physically
// rides that rail between rows. Unlike a tree that just toggles a static
// border-left rule, this one gives the current position a real vehicle: an
// inline-SVG rounded square with two tooth notches, absolutely positioned
// over the tree and sprung (transform, overshoot easing) to the focused
// row's y and the focused depth's rail column x, every ArrowUp/Down/Left/
// Right. Because the carriage's coordinates fall out analytically from the
// flattened visible-row index and depth (fixed row height, fixed indent
// step), it never needs to measure the DOM — which also means it can never
// drift out of sync with the list a keyboard navigator is actually walking.
//
// Expanding a node reveals its children instantly in the DOM, but the rail
// for that block draws downward via the pathLength/strokeDasharray/
// strokeDashoffset trick over ~200ms ease-out-expo, while the children
// themselves stagger a fade-in at a flat 20ms/row so they read as freshly
// attached to their parent rather than simply appearing. Collapsing is the
// state's mirror image and is deliberately instantaneous (no leave
// animation) — that keeps the analytic layout the carriage relies on always
// exactly in sync with what's on screen, with nothing fading out underneath
// while the row grid above/below has already reflowed.
//
// Semantics are the plain WAI-ARIA tree pattern: role=tree/treeitem/group,
// roving tabindex, ArrowRight opens-then-dives, ArrowLeft closes-then-climbs,
// Home/End, type-ahead, aria-level/aria-expanded/aria-selected. There is no
// nested <button> or <a> in a row — the chevron is a decorative aria-hidden
// mark, and the treeitem itself is the whole interactive surface. The
// carriage is purely decorative (aria-hidden, pointer-events:none): it is a
// visual mirror of the real roving-tabindex DOM focus, so a screen reader
// still announces rows natively regardless of whether the carriage has
// finished springing to them. Zero dependencies, no canvas, every color a
// token (--background --foreground --muted --border --accent).
// prefers-reduced-motion (read live via matchMedia) makes the carriage
// teleport instead of spring and every rail render at full length with no
// draw-in.

export type CogRailNode = {
  id: string;
  label: string;
  children?: CogRailNode[];
};

export interface CogRailProps {
  /** Accessible name for the tree, e.g. "Project files". */
  label: string;
  nodes: CogRailNode[];
  /** Node ids expanded on first render, statically — no draw-in for these. */
  defaultExpandedIds?: string[];
  className?: string;
  id?: string;
}

type Phase = "entering" | "open";

const ROW_HEIGHT = 28;
const BASE_INDENT = 10;
const ROW_INDENT = 20;
const RAIL_OFFSET = 6;
const CARRIAGE_SIZE = 20;
const DRAW_MS = 200;
const STAGGER_MS = 20;
const REVEAL_MS = 160;
const CARRIAGE_MS = 260;
const SPRING_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const DRAW_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const TYPEAHEAD_MS = 600;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

type VisibleEntry = { node: CogRailNode; parent: CogRailNode | null; depth: number };

function flattenVisible(nodes: CogRailNode[], expandedIds: Set<string>): VisibleEntry[] {
  const out: VisibleEntry[] = [];
  const walk = (list: CogRailNode[], parent: CogRailNode | null, depth: number) => {
    for (const node of list) {
      out.push({ node, parent, depth });
      if (node.children?.length && expandedIds.has(node.id)) walk(node.children, node, depth + 1);
    }
  };
  walk(nodes, null, 0);
  return out;
}

export function CogRail({ label, nodes, defaultExpandedIds = [], className = "", id }: CogRailProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(defaultExpandedIds));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string>(() => nodes[0]?.id ?? "");
  const treeRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const typeahead = useRef({ buffer: "", timer: 0 });
  const autoId = useId();

  const toggle = useCallback((nodeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const select = useCallback((nodeId: string) => {
    setSelectedId(nodeId);
    setFocusedId(nodeId);
  }, []);

  const visible = useMemo(() => flattenVisible(nodes, expandedIds), [nodes, expandedIds]);

  const focusItem = useCallback((nodeId: string) => {
    setFocusedId(nodeId);
    treeRef.current
      ?.querySelector<HTMLElement>(`[data-cog-rail-row="${CSS.escape(nodeId)}"]`)
      ?.focus();
  }, []);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const i = visible.findIndex((v) => v.node.id === focusedId);
    if (i === -1) return;
    const { node, parent } = visible[i];
    let handled = true;
    switch (e.key) {
      case "ArrowDown":
        if (i < visible.length - 1) focusItem(visible[i + 1].node.id);
        break;
      case "ArrowUp":
        if (i > 0) focusItem(visible[i - 1].node.id);
        break;
      case "ArrowRight":
        if (node.children?.length) {
          if (!expandedIds.has(node.id)) toggle(node.id);
          else focusItem(node.children[0].id);
        }
        break;
      case "ArrowLeft":
        if (node.children?.length && expandedIds.has(node.id)) toggle(node.id);
        else if (parent) focusItem(parent.id);
        break;
      case "Home":
        if (visible.length) focusItem(visible[0].node.id);
        break;
      case "End":
        if (visible.length) focusItem(visible[visible.length - 1].node.id);
        break;
      case "Enter":
      case " ":
        if (node.children?.length) toggle(node.id);
        select(node.id);
        break;
      default: {
        if (e.key.length === 1 && /[a-z0-9]/i.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const ta = typeahead.current;
          window.clearTimeout(ta.timer);
          ta.buffer += e.key.toLowerCase();
          ta.timer = window.setTimeout(() => {
            ta.buffer = "";
          }, TYPEAHEAD_MS);
          const n = visible.length;
          for (let step = 1; step <= n; step++) {
            const idx = (i + step) % n;
            if (visible[idx].node.label.toLowerCase().startsWith(ta.buffer)) {
              focusItem(visible[idx].node.id);
              break;
            }
          }
        } else {
          handled = false;
        }
      }
    }
    if (handled) e.preventDefault();
  };

  useEffect(() => {
    const ta = typeahead.current;
    return () => window.clearTimeout(ta.timer);
  }, []);

  // The carriage's position falls straight out of the flattened visible
  // list: row index -> y (fixed row height), depth -> x (fixed indent
  // step), the same coordinates every row's own rail column already uses.
  // No measurement, so it can never disagree with what focusItem just did.
  const focusedIndex = visible.findIndex((v) => v.node.id === focusedId);
  const focusedDepth = focusedIndex >= 0 ? visible[focusedIndex].depth : 0;
  const carriageTop = Math.max(focusedIndex, 0) * ROW_HEIGHT + (ROW_HEIGHT - CARRIAGE_SIZE) / 2;
  const carriageLeft = BASE_INDENT + focusedDepth * ROW_INDENT + RAIL_OFFSET - CARRIAGE_SIZE / 2;

  return (
    <div id={id} className={className}>
      <style>{`
.ns-cr-item{outline:none}
.ns-cr-item:focus-visible > .ns-cr-row{outline:2px solid var(--accent);outline-offset:-2px}
@media (prefers-reduced-motion: reduce){
  .ns-cr-carriage,.ns-cr-rail,.ns-cr-reveal{transition:none !important}
}
`}</style>
      <div
        ref={treeRef}
        id={autoId}
        role="tree"
        aria-label={label}
        className="relative select-none font-mono text-[13px] leading-5 text-foreground"
        onKeyDown={onKeyDown}
      >
        {visible.length > 0 && (
          <svg
            aria-hidden="true"
            focusable="false"
            className="ns-cr-carriage pointer-events-none absolute left-0 top-0 z-10"
            width={CARRIAGE_SIZE}
            height={CARRIAGE_SIZE}
            viewBox="0 0 20 20"
            style={{
              transform: `translate(${carriageLeft}px, ${carriageTop}px)`,
              transition: reducedMotion ? "none" : `transform ${CARRIAGE_MS}ms ${SPRING_EASE}`,
            }}
          >
            {/* 1 viewBox unit = 1px here, so rx=6 is a literal 6px radius */}
            <rect x="2" y="2" width="16" height="16" rx="6" style={{ fill: "var(--foreground)" }} />
            <rect x="0" y="8" width="3" height="4" rx="1" style={{ fill: "var(--background)" }} />
            <rect x="17" y="8" width="3" height="4" rx="1" style={{ fill: "var(--background)" }} />
          </svg>
        )}
        {nodes.map((node) => (
          <TreeItem
            key={node.id}
            node={node}
            depth={0}
            expandedIds={expandedIds}
            selectedId={selectedId}
            focusedId={focusedId}
            reducedMotion={reducedMotion}
            onToggle={toggle}
            onSelect={select}
            revealDelayMs={0}
            revealPhase="open"
          />
        ))}
      </div>
    </div>
  );
}

interface TreeItemProps {
  node: CogRailNode;
  depth: number;
  expandedIds: Set<string>;
  selectedId: string | null;
  focusedId: string;
  reducedMotion: boolean;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  /** ms this row's own fade-in is delayed by, relative to its siblings */
  revealDelayMs: number;
  /** the parent block's current phase — drives whether this row is settled */
  revealPhase: Phase;
}

function TreeItem({
  node,
  depth,
  expandedIds,
  selectedId,
  focusedId,
  reducedMotion,
  onToggle,
  onSelect,
  revealDelayMs,
  revealPhase,
}: TreeItemProps) {
  const hasChildren = !!node.children?.length;
  const isOpen = hasChildren && expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const isFocused = focusedId === node.id;
  const highlightRail = hasChildren && node.children!.some((c) => c.id === focusedId);

  // Only the *opening* transition is animated: collapse removes the block
  // from the DOM in the same commit that expandedIds changes, so the
  // analytic row-index math the carriage (and ArrowUp/Down) relies on is
  // never briefly out of step with a still-fading subtree underneath it.
  const [phase, setPhase] = useState<Phase>("open");
  const wasOpenRef = useRef(isOpen);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = isOpen;
    if (!isOpen) return;
    if (!wasOpen && !reducedMotion) {
      setPhase("entering");
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = requestAnimationFrame(() => setPhase("open"));
      });
      return () => {
        if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
      };
    }
    setPhase("open");
    return undefined;
  }, [isOpen, reducedMotion]);

  const railX = BASE_INDENT + (depth + 1) * ROW_INDENT + RAIL_OFFSET;
  const dashOffset = phase === "open" ? 0 : 1;
  const railStyle: CSSProperties | undefined = reducedMotion
    ? undefined
    : {
        transitionProperty: "stroke-dashoffset",
        transitionDuration: `${DRAW_MS}ms`,
        transitionTimingFunction: DRAW_EASE,
      };

  const rowStyle: CSSProperties = {
    height: ROW_HEIGHT,
    paddingLeft: BASE_INDENT + depth * ROW_INDENT,
  };

  const revealStyle: CSSProperties = reducedMotion
    ? {}
    : {
        opacity: revealPhase === "open" ? 1 : 0,
        transform: revealPhase === "open" ? "translateY(0)" : "translateY(-4px)",
        transitionProperty: "opacity, transform",
        transitionDuration: `${REVEAL_MS}ms`,
        transitionDelay: revealPhase === "open" ? `${revealDelayMs}ms` : "0ms",
        transitionTimingFunction: DRAW_EASE,
      };

  const handleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.focus();
    onSelect(node.id);
    if (hasChildren) onToggle(node.id);
  };

  return (
    <div
      data-cog-rail-row={node.id}
      role="treeitem"
      aria-expanded={hasChildren ? isOpen : undefined}
      aria-selected={isSelected}
      aria-level={depth + 1}
      tabIndex={isFocused ? 0 : -1}
      onClick={handleClick}
      className="ns-cr-item ns-cr-reveal rounded-sm"
      style={revealStyle}
    >
      <div
        className={[
          "ns-cr-row flex cursor-pointer items-center gap-1.5 rounded-sm pr-2 transition-colors duration-150 ease-out",
          isSelected ? "bg-border/50 text-foreground" : "text-muted hover:bg-border/25 hover:text-foreground",
        ].join(" ")}
        style={rowStyle}
      >
        {hasChildren ? (
          <svg
            viewBox="0 0 12 12"
            aria-hidden="true"
            className="h-3 w-3 shrink-0 transition-transform duration-200 ease-out"
            style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}
          >
            <path
              d="M4.5 2.5 8 6l-3.5 3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <span aria-hidden="true" className="block h-1 w-1 shrink-0 rounded-full bg-border" />
        )}
        <span className="truncate">{node.label}</span>
      </div>

      {isOpen && hasChildren && (
        <div role="group" className="relative">
          <svg aria-hidden="true" focusable="false" className="pointer-events-none absolute inset-0 h-full w-full">
            <line
              x1={railX}
              x2={railX}
              y1={0}
              y2="100%"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={dashOffset}
              stroke="currentColor"
              strokeWidth={1}
              strokeLinecap="round"
              className={["ns-cr-rail", highlightRail ? "text-muted" : "text-border"].join(" ")}
              style={railStyle}
            />
          </svg>
          {node.children!.map((child, i) => (
            <TreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              selectedId={selectedId}
              focusedId={focusedId}
              reducedMotion={reducedMotion}
              onToggle={onToggle}
              onSelect={onSelect}
              revealDelayMs={i * STAGGER_MS}
              revealPhase={phase}
            />
          ))}
        </div>
      )}
    </div>
  );
}
