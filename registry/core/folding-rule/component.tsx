"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

export type RuleNode = {
  id: string;
  label: string;
  children?: RuleNode[];
};

// Tree whose branches unfold like a carpenter's folding rule: each child
// group is a hinged segment that swings open around a visible pivot, rows
// unfolding in sequence down the segment. Collapse snaps shut fast, no
// stagger — a rule folds quicker than it opens.
export function FoldingRule({
  nodes,
  defaultExpanded = [],
  className = "",
}: {
  nodes: RuleNode[];
  /** ids expanded on first render */
  defaultExpanded?: string[];
  className?: string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(defaultExpanded)
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [focused, setFocused] = useState<string>(() => nodes[0]?.id ?? "");
  const treeRef = useRef<HTMLDivElement>(null);
  const reduced = useRef(false);
  useEffect(() => {
    reduced.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
  }, []);

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // the visible rows in document order, with parent links for Left-arrow
  const visible: { node: RuleNode; parent: RuleNode | null }[] = [];
  const walk = (list: RuleNode[], parent: RuleNode | null) => {
    for (const node of list) {
      visible.push({ node, parent });
      if (node.children && expanded.has(node.id)) walk(node.children, node);
    }
  };
  walk(nodes, null);

  const focusItem = (id: string) => {
    setFocused(id);
    // roving tabindex — focus the row element directly
    treeRef.current
      ?.querySelector<HTMLElement>(`[data-rule-id="${CSS.escape(id)}"]`)
      ?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = visible.findIndex((v) => v.node.id === focused);
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
          if (!expanded.has(node.id)) toggle(node.id);
          else focusItem(node.children[0].id);
        }
        break;
      case "ArrowLeft":
        if (node.children?.length && expanded.has(node.id)) toggle(node.id);
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
        setSelected(node.id);
        break;
      default:
        handled = false;
    }
    if (handled) e.preventDefault();
  };

  return (
    <div
      ref={treeRef}
      role="tree"
      aria-label="File tree"
      className={`font-mono text-[13px] ${className}`}
      onKeyDown={onKeyDown}
    >
      {nodes.map((node) => (
        <Branch
          key={node.id}
          node={node}
          depth={0}
          expanded={expanded}
          selected={selected}
          focused={focused}
          reduced={reduced}
          onToggle={toggle}
          onSelect={(id) => {
            setSelected(id);
            setFocused(id);
          }}
        />
      ))}
    </div>
  );
}

function Branch({
  node,
  depth,
  expanded,
  selected,
  focused,
  reduced,
  onToggle,
  onSelect,
}: {
  node: RuleNode;
  depth: number;
  expanded: Set<string>;
  selected: string | null;
  focused: string;
  reduced: { current: boolean };
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const hasChildren = !!node.children?.length;
  const isOpen = hasChildren && expanded.has(node.id);
  const isSelected = selected === node.id;

  return (
    <div
      role="treeitem"
      aria-expanded={hasChildren ? isOpen : undefined}
      aria-selected={isSelected}
      data-rule-id={node.id}
      tabIndex={focused === node.id ? 0 : -1}
      onClick={(e) => {
        e.stopPropagation();
        if (hasChildren) onToggle(node.id);
        onSelect(node.id);
      }}
      className="group/item cursor-pointer outline-none"
    >
      <div
        className={`flex items-center gap-1.5 rounded-sm px-2 py-1.5 transition-colors duration-150 group-focus-visible/item:outline-2 group-focus-visible/item:-outline-offset-2 group-focus-visible/item:outline-accent ${
          isSelected
            ? "bg-surface text-foreground"
            : "text-muted hover:bg-surface hover:text-foreground"
        }`}
        style={{ paddingLeft: `${8 + depth * 20}px` }}
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
          <span
            aria-hidden="true"
            className="block h-1 w-1 shrink-0 rounded-full bg-border"
            style={{ marginLeft: 4, marginRight: 4 }}
          />
        )}
        <span className="truncate">{node.label}</span>
      </div>

      {hasChildren && (
        <div
          className="grid"
          style={{
            gridTemplateRows: isOpen ? "1fr" : "0fr",
            transition: reduced.current
              ? "none"
              : `grid-template-rows ${isOpen ? 360 : 200}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          }}
        >
          <div
            className="min-h-0 overflow-hidden"
            style={{ perspective: "700px" }}
          >
            {/* the hinged segment: swings open around the joint at its top */}
            <div
              role="group"
              className="relative"
              style={{
                transformOrigin: "top center",
                transform: reduced.current
                  ? "none"
                  : isOpen
                    ? "rotateX(0deg)"
                    : "rotateX(-58deg)",
                opacity: isOpen ? 1 : 0,
                transition: reduced.current
                  ? "none"
                  : isOpen
                    ? "transform 360ms cubic-bezier(0.34, 1.4, 0.64, 1), opacity 200ms ease-out"
                    : "transform 200ms cubic-bezier(0.55, 0, 0.85, 0.4), opacity 160ms ease-in",
              }}
            >
              {/* hinge pivot + segment edge rule */}
              <span
                aria-hidden="true"
                className="absolute bottom-1 top-0 w-px bg-border"
                style={{ left: `${13 + depth * 20 + 8}px` }}
              />
              <span
                aria-hidden="true"
                className="absolute top-0.5 h-[5px] w-[5px] rounded-full border border-muted bg-surface"
                style={{ left: `${13 + depth * 20 + 6}px` }}
              />
              {node.children!.map((child, i) => (
                <div
                  key={child.id}
                  style={
                    reduced.current
                      ? undefined
                      : {
                          transformOrigin: "top center",
                          transform: isOpen
                            ? "rotateX(0deg)"
                            : "rotateX(-28deg)",
                          opacity: isOpen ? 1 : 0,
                          transition: isOpen
                            ? `transform 300ms cubic-bezier(0.34, 1.4, 0.64, 1) ${60 + i * 45}ms, opacity 180ms ease-out ${60 + i * 45}ms`
                            : "transform 150ms ease-in, opacity 120ms ease-in",
                        }
                  }
                >
                  <Branch
                    node={child}
                    depth={depth + 1}
                    expanded={expanded}
                    selected={selected}
                    focused={focused}
                    reduced={reduced}
                    onToggle={onToggle}
                    onSelect={onSelect}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
