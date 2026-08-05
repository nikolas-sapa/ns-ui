"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

// A file/nav tree whose indent guides are one living root system instead of
// static per-level border-left rules. Expanding a node doesn't just reveal
// its children — it grows a real SVG path down from that node's own junction
// (its chevron), a rounded 6px elbow branching into each child row, the tip
// advancing over ~240ms of ease-out-expo. Children are not staggered on a
// generic timer: each row's opacity/translateY reveal is delayed by exactly
// how far along the path its own elbow sits, using the true inverse of the
// draw easing (not a linear split of the duration) — a linear delay would
// have every row arrive under a front-loaded expo curve, i.e. behind the tip
// it's supposedly tracking. Collapse reverses the same path back into the
// junction while rows fade first.
//
// The overlay is per expanded parent, not one global path for the whole
// tree — that's the correct read of "grows from the parent junction": a
// nested expansion draws its own short root from its own parent's tip,
// composing recursively into what reads as one continuous system. Row
// centers are measured (ResizeObserver on the children block), never
// assumed fixed, because any descendant expanding changes the height of
// the rows above it.
//
// Semantics are the plain WAI-ARIA tree pattern: role=tree/treeitem/group,
// roving tabindex, ArrowRight opens-then-dives, ArrowLeft closes-then-climbs,
// Home/End, type-ahead, aria-level/aria-expanded/aria-selected. There is no
// nested <button> or <a> anywhere in a row — the disclosure chevron is a
// decorative aria-hidden mark, and expand/select both live on the treeitem's
// own click/Enter/Space. Stroke is --border at rest; the one branch whose
// direct children include the currently focused row switches to --ns-muted, so
// the guide itself answers "what belongs to what" as you move through it.
// Zero dependencies, no canvas. prefers-reduced-motion renders every path at
// full length and every row already in place, no draw, no stagger.

export type TaprootNode = {
  id: string;
  label: string;
  children?: TaprootNode[];
};

export interface TaprootTraceProps {
  /** Accessible name for the tree, e.g. "Project files". */
  label: string;
  nodes: TaprootNode[];
  /** Node ids expanded on first render, statically — no draw-in animation for these. */
  defaultExpandedIds?: string[];
  className?: string;
  id?: string;
}

type Phase = "open" | "closed" | "entering" | "leaving";

const DRAW_MS = 240;
const CLOSE_MS = 200;
const BASE_INDENT = 8;
const ROW_INDENT = 20;
const CHEVRON_HALF = 6;
const ELBOW_R = 6;
const STEM_WIDTH = 1.5;
const DRAW_EASE = "cubic-bezier(0.16, 1, 0.3, 1)"; // ease-out-expo approximation
const TYPEAHEAD_MS = 600;

/** Inverse of the true ease-out-expo curve y = 1 - 2^(-10x): x = -log2(1-y)/10.
 *  Used to convert "this row sits at fraction f of the path's length" into
 *  "the tip reaches it at this many ms into the DRAW_MS transition" — a
 *  linear f * DRAW_MS would put every row behind the tip, since the curve
 *  itself is heavily front-loaded. */
function easeOutExpoInverse(f: number): number {
  const c = Math.min(0.995, Math.max(0, f));
  return -Math.log2(1 - c) / 10;
}

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

type VisibleEntry = { node: TaprootNode; parent: TaprootNode | null; depth: number };

function flattenVisible(nodes: TaprootNode[], expandedIds: Set<string>): VisibleEntry[] {
  const out: VisibleEntry[] = [];
  const walk = (list: TaprootNode[], parent: TaprootNode | null, depth: number) => {
    for (const node of list) {
      out.push({ node, parent, depth });
      if (node.children?.length && expandedIds.has(node.id)) walk(node.children, node, depth + 1);
    }
  };
  walk(nodes, null, 0);
  return out;
}

export function TaprootTrace({
  label,
  nodes,
  defaultExpandedIds = [],
  className = "",
  id,
}: TaprootTraceProps) {
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
      ?.querySelector<HTMLElement>(`[data-taproot-row="${CSS.escape(nodeId)}"]`)
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

  return (
    <div id={id} className={className}>
      <style>{`
.ns-tt-item{outline:none}
.ns-tt-item:focus-visible > .ns-tt-row{outline:2px solid var(--ns-accent);outline-offset:-2px}
@media (prefers-reduced-motion: reduce){
  .ns-tt-row,.ns-tt-chevron,.ns-tt-path{transition:none !important}
}
`}</style>
      <div
        ref={treeRef}
        id={autoId}
        role="tree"
        aria-label={label}
        className="select-none font-mono text-[13px] leading-5 text-foreground"
        onKeyDown={onKeyDown}
      >
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
            onRowRef={undefined}
          />
        ))}
      </div>
    </div>
  );
}

interface TreeItemProps {
  node: TaprootNode;
  depth: number;
  expandedIds: Set<string>;
  selectedId: string | null;
  focusedId: string;
  reducedMotion: boolean;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  /** ms into this row's parent's draw animation that the tip reaches its elbow */
  revealDelayMs: number;
  /** the parent branch's current phase — drives whether this row is shown */
  revealPhase: Phase;
  onRowRef: ((el: HTMLDivElement | null) => void) | undefined;
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
  onRowRef,
}: TreeItemProps) {
  const hasChildren = !!node.children?.length;
  const isOpenTarget = hasChildren && expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const isFocused = focusedId === node.id;
  const highlightBranch = hasChildren && node.children!.some((c) => c.id === focusedId);

  const [mounted, setMounted] = useState(isOpenTarget);
  const [phase, setPhase] = useState<Phase>(isOpenTarget ? "open" : "closed");
  const didMount = useRef(false);
  const mountedRef = useRef(isOpenTarget);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const rafId = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    if (isOpenTarget) {
      window.clearTimeout(closeTimer.current);
      if (!mountedRef.current) {
        mountedRef.current = true;
        setMounted(true);
        if (reducedMotion) {
          setPhase("open");
        } else {
          setPhase("entering");
          // a single rAF can land in the same paint as this render (the
          // browser never actually shows the "entering" frame, so the
          // transition has no committed "from" value to animate away
          // from) — nest two so "entering" is guaranteed one real paint
          // before flipping to "open".
          rafId.current = requestAnimationFrame(() => {
            rafId.current = requestAnimationFrame(() => setPhase("open"));
          });
        }
      } else {
        setPhase("open");
      }
    } else if (mountedRef.current) {
      if (reducedMotion) {
        mountedRef.current = false;
        setMounted(false);
        setPhase("closed");
      } else {
        setPhase("leaving");
        closeTimer.current = setTimeout(() => {
          mountedRef.current = false;
          setMounted(false);
          setPhase("closed");
        }, CLOSE_MS);
      }
    }
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [isOpenTarget, reducedMotion]);

  useEffect(
    () => () => {
      window.clearTimeout(closeTimer.current);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    },
    []
  );

  const rowRef = useRef<HTMLDivElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const childRowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [centers, setCenters] = useState<number[]>([]);

  const measure = useCallback(() => {
    const wrap = blockRef.current;
    if (!wrap) return;
    const wrapTop = wrap.getBoundingClientRect().top;
    const next = childRowRefs.current.map((el) => {
      if (!el) return 0;
      const r = el.getBoundingClientRect();
      return r.top - wrapTop + r.height / 2;
    });
    setCenters((prev) => {
      if (prev.length === next.length && prev.every((v, idx) => Math.abs(v - next[idx]) < 0.5)) {
        return prev;
      }
      return next;
    });
  }, []);

  useLayoutEffect(() => {
    if (!mounted || !hasChildren) return;
    measure();
    const wrap = blockRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [mounted, hasChildren, measure, node.children?.length]);

  const stemX = BASE_INDENT + depth * ROW_INDENT + CHEVRON_HALF;

  const geometry = useMemo(() => {
    if (centers.length === 0) return { stemD: "", ticks: [] as { d: string; delayMs: number }[] };
    let prevY = 0;
    let cum = 0;
    const stemParts: string[] = [`M ${stemX} 0`];
    const rawTicks: { d: string; cum: number }[] = [];
    for (const cy of centers) {
      const bendY = Math.max(prevY, cy - ELBOW_R);
      stemParts.push(`L ${stemX} ${bendY}`);
      cum += bendY - prevY;
      const tickD = `M ${stemX} ${bendY} Q ${stemX} ${cy} ${stemX + ELBOW_R} ${cy}`;
      cum += ELBOW_R * 1.05; // quarter-turn arc length approximation
      rawTicks.push({ d: tickD, cum });
      prevY = cy;
    }
    const total = cum || 1;
    return {
      stemD: stemParts.join(" "),
      ticks: rawTicks.map((t) => ({
        d: t.d,
        delayMs: DRAW_MS * easeOutExpoInverse(t.cum / total),
      })),
    };
  }, [centers, stemX]);

  const dashOffset = phase === "open" ? 0 : 1;
  const stemStyle: CSSProperties | undefined = reducedMotion
    ? undefined
    : {
        transitionProperty: "stroke-dashoffset",
        transitionDuration: `${phase === "leaving" ? CLOSE_MS : DRAW_MS}ms`,
        transitionTimingFunction: phase === "leaving" ? "ease-in" : DRAW_EASE,
      };

  const rowStyle: CSSProperties = {
    paddingLeft: BASE_INDENT + depth * ROW_INDENT,
  };
  const revealStyle: CSSProperties = reducedMotion
    ? {}
    : {
        opacity: revealPhase === "open" ? 1 : 0,
        transform: revealPhase === "open" ? "translateY(0)" : "translateY(-4px)",
        transitionProperty: "opacity, transform",
        transitionDuration: revealPhase === "leaving" ? "120ms" : "180ms",
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
      ref={(el) => {
        rowRef.current = el;
        onRowRef?.(el);
      }}
      data-taproot-row={node.id}
      role="treeitem"
      aria-expanded={hasChildren ? isOpenTarget : undefined}
      aria-selected={isSelected}
      aria-level={depth + 1}
      tabIndex={isFocused ? 0 : -1}
      onClick={handleClick}
      className="ns-tt-item rounded-sm"
      style={{ ...revealStyle }}
    >
      <div
        className={[
          "ns-tt-row flex cursor-pointer items-center gap-1.5 rounded-sm py-1 pr-2 transition-colors duration-150 ease-out",
          isSelected ? "bg-surface text-foreground" : "text-ns-muted hover:bg-surface hover:text-foreground",
        ].join(" ")}
        style={rowStyle}
      >
        {hasChildren ? (
          <svg
            viewBox="0 0 12 12"
            aria-hidden="true"
            className="ns-tt-chevron h-3 w-3 shrink-0 transition-transform duration-200 ease-out"
            style={{ transform: isOpenTarget ? "rotate(90deg)" : "rotate(0deg)" }}
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

      {mounted && hasChildren && (
        <div ref={blockRef} role="group" className="relative">
          {/* z-10: each child row's own wrapper carries a non-"none" transform
              (the reveal translateY, even at rest it's translateY(0)) which
              promotes it into its own stacking context — without an explicit
              z-index here this absolutely-positioned guide would paint BEHIND
              those row wrappers in DOM order, so a selected/hovered row's
              opaque background (drawn by its own row div, full row width)
              would cover the stem segment running down to the NEXT sibling's
              elbow, which physically passes through this row's box. Raising
              the guide above the rows (still pointer-events-none, so clicks
              pass straight through to the row beneath) keeps the line
              continuous instead of getting cut by whichever row is selected. */}
          <svg
            aria-hidden="true"
            focusable="false"
            className="pointer-events-none absolute inset-0 z-10 h-full w-full"
          >
            <path
              d={geometry.stemD}
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={dashOffset}
              fill="none"
              stroke="currentColor"
              strokeWidth={STEM_WIDTH}
              strokeLinecap="round"
              className={["ns-tt-path", highlightBranch ? "text-ns-muted" : "text-border"].join(" ")}
              style={stemStyle}
            />
            {geometry.ticks.map((t, i) => (
              <path
                key={i}
                d={t.d}
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={dashOffset}
                fill="none"
                stroke="currentColor"
                strokeWidth={STEM_WIDTH}
                strokeLinecap="round"
                className={["ns-tt-path", highlightBranch ? "text-ns-muted" : "text-border"].join(" ")}
                style={
                  reducedMotion
                    ? undefined
                    : {
                        transitionProperty: "stroke-dashoffset",
                        transitionDuration: "110ms",
                        transitionTimingFunction: DRAW_EASE,
                        transitionDelay: phase === "open" ? `${t.delayMs}ms` : "0ms",
                      }
                }
              />
            ))}
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
              revealDelayMs={geometry.ticks[i]?.delayMs ?? 0}
              revealPhase={phase}
              onRowRef={(el) => {
                childRowRefs.current[i] = el;
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
