"use client";

import { useId, useMemo, useRef, useState } from "react";

// Search input that winnows its list like grain from chaff: as the query
// narrows, non-matching rows lose their weight — drifting aside with a slight
// tumble and fading — then their slot collapses so the survivors settle
// together. Matches keep full ink with the matched span emphasized. Two-phase
// exit (drift, then collapse) is pure CSS: an outer grid-rows 1fr->0fr
// collapse delayed behind the inner drift. Combobox keyboard pattern:
// ArrowUp/Down roves an active option, Enter selects, Escape clears.

export interface ChaffWinnowItem {
  id: string;
  label: string;
  hint?: string;
}

export interface ChaffWinnowProps {
  items: ChaffWinnowItem[];
  placeholder?: string;
  /** accessible name for the search input */
  label?: string;
  onSelect?: (item: ChaffWinnowItem) => void;
  className?: string;
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-[3px] bg-border/80 px-0.5 font-medium text-foreground">
        {text.slice(i, i + query.length)}
      </mark>
      {text.slice(i + query.length)}
    </>
  );
}

export function ChaffWinnow({
  items,
  placeholder = "Search…",
  label = "Search",
  onSelect,
  className = "",
}: ChaffWinnowProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const listId = useId();
  const reduced = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  ).current;

  const q = query.trim();
  const matched = useMemo(() => {
    if (!q) return new Set(items.map((it) => it.id));
    const lq = q.toLowerCase();
    return new Set(
      items
        .filter(
          (it) =>
            it.label.toLowerCase().includes(lq) || it.hint?.toLowerCase().includes(lq),
        )
        .map((it) => it.id),
    );
  }, [items, q]);

  const visible = items.filter((it) => matched.has(it.id));
  const clampedActive = Math.min(active, visible.length - 1);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min((a < 0 ? -1 : Math.min(a, visible.length - 1)) + 1, visible.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(Math.min(a, visible.length - 1) - 1, 0));
    } else if (e.key === "Enter" && clampedActive >= 0 && visible[clampedActive]) {
      e.preventDefault();
      onSelect?.(visible[clampedActive]);
    } else if (e.key === "Escape") {
      setQuery("");
      setActive(-1);
    }
  };

  return (
    <div className={["w-full rounded-md border border-border bg-surface", className].join(" ")}>
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <svg aria-hidden width={15} height={15} viewBox="0 0 15 15" className="shrink-0 text-ns-muted">
          <circle cx={6.5} cy={6.5} r={4.5} fill="none" stroke="currentColor" strokeWidth={1.5} />
          <path d="M 10 10 L 13.5 13.5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
        </svg>
        <input
          type="text"
          role="combobox"
          aria-label={label}
          aria-expanded={visible.length > 0}
          aria-controls={listId}
          aria-activedescendant={
            clampedActive >= 0 && visible[clampedActive]
              ? `${listId}-${visible[clampedActive].id}`
              : undefined
          }
          aria-autocomplete="list"
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(-1);
          }}
          onKeyDown={onKeyDown}
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-ns-muted"
        />
        <span aria-live="polite" className="shrink-0 font-mono text-[11px] tabular-nums text-ns-muted">
          {visible.length}/{items.length}
        </span>
      </div>
      <ul id={listId} role="listbox" aria-label={label} className="py-1">
        {items.map((it) => {
          const out = !matched.has(it.id);
          const vi = visible.findIndex((v) => v.id === it.id);
          const isActive = vi >= 0 && vi === clampedActive;
          return (
            // outer: slot collapse, delayed behind the inner drift so the
            // row visibly blows aside before its space closes
            <li
              key={it.id}
              role={out ? "presentation" : "option"}
              id={out ? undefined : `${listId}-${it.id}`}
              aria-selected={out ? undefined : isActive}
              className="grid"
              style={{
                gridTemplateRows: out ? "0fr" : "1fr",
                transition: reduced
                  ? "none"
                  : `grid-template-rows 280ms cubic-bezier(0.22, 1, 0.36, 1) ${out ? "140ms" : "0ms"}`,
              }}
            >
              <div className="min-h-0 overflow-hidden">
                <div
                  onClick={out ? undefined : () => onSelect?.(it)}
                  className={[
                    "mx-1 flex items-baseline gap-3 rounded-sm px-3 py-2",
                    out ? "" : "cursor-pointer",
                    isActive ? "bg-border/60" : out ? "" : "hover:bg-border/40",
                    "transition-[background-color] duration-150",
                  ].join(" ")}
                  style={{
                    opacity: out ? 0 : 1,
                    transform: out
                      ? "translateX(14px) rotate(1.5deg)"
                      : "translateX(0) rotate(0deg)",
                    transition: reduced
                      ? "opacity 0ms"
                      : `opacity 220ms ease, transform 260ms cubic-bezier(0.55, 0, 0.55, 0.2), background-color 150ms ease`,
                  }}
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    <Highlight text={it.label} query={q} />
                  </span>
                  {it.hint ? (
                    <span className="shrink-0 font-mono text-[11px] text-ns-muted">
                      <Highlight text={it.hint} query={q} />
                    </span>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
        <li
          role="presentation"
          className="grid"
          style={{
            gridTemplateRows: visible.length === 0 ? "1fr" : "0fr",
            transition: reduced
              ? "none"
              : "grid-template-rows 280ms cubic-bezier(0.22, 1, 0.36, 1) 140ms",
          }}
        >
          <div className="min-h-0 overflow-hidden">
            <p className="px-4 py-2 font-mono text-[11px] text-ns-muted">
              nothing survives “{q}”
            </p>
          </div>
        </li>
      </ul>
    </div>
  );
}
