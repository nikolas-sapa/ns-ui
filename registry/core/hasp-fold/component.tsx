"use client";

import { useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// HaspFold — an accordion whose sections latch shut with a visible hasp.
// Each closed header shows a small SVG hasp-and-staple on its right edge:
// a fixed U-shaped staple bracket and a hinged strap+loop that, at rest,
// hooks down over it. The whole open/close choreography is staged with
// plain CSS transitions keyed off one `data-state="open"|"closed"`
// attribute per stage (hasp / lid / content-rows) — no rAF loop, no
// per-frame React state — each stage just carries its own duration and
// transition-delay so the same state flip plays four moments in order:
//   open:  hasp swings up off the staple (spring overshoot, 0ms delay)
//          -> the header ("lid") lifts 2px (starts as the hasp is
//          settling) -> the content unfolds via the codebase's
//          grid-template-rows 0fr->1fr trick, ease-out-expo, fading
//          upward 4px (starts as the lid finishes lifting).
//   close: reverse order — content folds first, then the lid drops,
//          then the hasp drops back over the staple with a bouncier
//          cubic-bezier so it reads as a settle rather than a snap.
// Hover on a closed header slides the hasp 1px via a plain CSS :hover
// rule (no JS) — "testing the latch." Single-open by default (opening
// one closes any other); `multiple` allows independent panels. Headers
// are real <button> elements with a roving tabindex (only the active
// header is in the tab sequence; ArrowUp/Down/Home/End move focus,
// matching the drape-menu pattern), aria-expanded + aria-controls, and
// a <div role="region" aria-labelledby> panel per the standard
// disclosure pattern. prefers-reduced-motion collapses every stage's
// duration/delay to zero, so open/close still happens (nothing gets
// stuck) but as a single instant snap, hasp included.
// ---------------------------------------------------------------------------

export interface HaspFoldItem {
  id: string;
  title: ReactNode;
  content: ReactNode;
}

export interface HaspFoldProps {
  items: HaspFoldItem[];
  /** Allow more than one section open at once. Default false (single-open). */
  multiple?: boolean;
  /** Initially open item ids. */
  defaultOpen?: string[];
  className?: string;
}

function HaspIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="28"
      viewBox="0 0 16 28"
      aria-hidden="true"
      focusable="false"
      className="ns-hf-icon"
    >
      <path
        d="M4.5 17.5 v3.6 a3 3 0 0 0 6 0 v-3.6"
        fill="none"
        stroke="var(--muted)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <g className="ns-hf-hasp" data-state={open ? "open" : "closed"}>
        <circle cx="8" cy="4.5" r="1.5" fill="var(--muted)" />
        <line x1="8" y1="4.5" x2="8" y2="19.5" stroke="var(--foreground)" strokeWidth="1.5" strokeLinecap="round" />
        <rect
          x="4.6"
          y="16.5"
          width="6.8"
          height="6"
          rx="2.4"
          fill="none"
          stroke="var(--foreground)"
          strokeWidth="1.5"
        />
      </g>
    </svg>
  );
}

export function HaspFold({ items, multiple = false, defaultOpen = [], className = "" }: HaspFoldProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(defaultOpen));
  // Roving tabindex is a single active index, independent of which panels
  // are open — with `multiple`, more than one section can be open at once,
  // and deriving tabIndex from open state would then put every open header
  // in the tab sequence simultaneously instead of just one.
  const [activeIndex, setActiveIndex] = useState(0);
  const headerRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const baseId = useId().replace(/:/g, "");

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (!multiple) next.clear();
        next.add(id);
      }
      return next;
    });
  };

  const onHeaderKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    const count = items.length;
    let next = -1;
    if (e.key === "ArrowDown") next = (index + 1) % count;
    else if (e.key === "ArrowUp") next = (index - 1 + count) % count;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = count - 1;
    if (next >= 0) {
      e.preventDefault();
      setActiveIndex(next);
      headerRefs.current[next]?.focus();
    }
  };

  return (
    <div className={`ns-hf-root ${className}`}>
      <style>{CSS}</style>
      {items.map((item, i) => {
        const isOpen = openIds.has(item.id);
        const headerId = `${baseId}-h-${item.id}`;
        const panelId = `${baseId}-p-${item.id}`;
        const state = isOpen ? "open" : "closed";
        return (
          <div key={item.id} className="ns-hf-section" data-state={state}>
            <h3 className="ns-hf-h3">
              <button
                ref={(el) => {
                  headerRefs.current[i] = el;
                }}
                type="button"
                id={headerId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="ns-hf-header"
                data-state={state}
                tabIndex={i === activeIndex ? 0 : -1}
                onClick={() => {
                  setActiveIndex(i);
                  toggle(item.id);
                }}
                onFocus={() => setActiveIndex(i)}
                onKeyDown={(e) => onHeaderKeyDown(e, i)}
              >
                <span className="ns-hf-title">{item.title}</span>
                <HaspIcon open={isOpen} />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={headerId}
              className="ns-hf-rows"
              data-state={state}
            >
              <div className="ns-hf-rows-inner">
                <div className="ns-hf-content" data-state={state}>
                  {item.content}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const CSS = `
.ns-hf-root{display:flex;flex-direction:column;border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--background);}
.ns-hf-section + .ns-hf-section{border-top:1px solid var(--border);}
.ns-hf-h3{margin:0;}
.ns-hf-header{
  position:relative;
  display:flex;
  width:100%;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  padding:14px 40px 14px 16px;
  border:0;
  background:var(--background);
  color:var(--foreground);
  font-size:14px;
  text-align:left;
  cursor:pointer;
  transform:translateY(0);
  transition:transform 90ms ease-out;
  transition-delay:90ms;
}
.ns-hf-header[data-state="open"]{
  transform:translateY(-2px);
  transition-delay:130ms;
}
.ns-hf-header:hover{background:color-mix(in oklab, var(--muted) 8%, var(--background));}
.ns-hf-header:focus-visible{outline:2px solid var(--accent);outline-offset:-2px;}
.ns-hf-title{flex:1;min-width:0;}
.ns-hf-icon{position:absolute;right:12px;top:50%;transform:translateY(-50%);}

.ns-hf-hasp{transform-origin:8px 4.5px;transform:rotate(0deg);
  transition:transform 220ms cubic-bezier(0.68,-0.55,0.34,1.55);transition-delay:180ms;}
.ns-hf-hasp[data-state="open"]{transform:rotate(-58deg);
  transition:transform 200ms cubic-bezier(0.34,1.56,0.64,1);transition-delay:0ms;}
.ns-hf-header[data-state="closed"]:hover .ns-hf-hasp{transform:translateX(-1.5px);transition:transform 120ms ease-out;}

.ns-hf-rows{
  display:grid;
  grid-template-rows:0fr;
  transition:grid-template-rows 220ms cubic-bezier(0.4,0,0.2,1);
  transition-delay:0ms;
}
.ns-hf-rows[data-state="open"]{
  grid-template-rows:1fr;
  transition:grid-template-rows 300ms cubic-bezier(0.16,1,0.3,1);
  transition-delay:190ms;
}
.ns-hf-rows-inner{overflow:hidden;}
.ns-hf-content{
  padding:0 16px 16px 16px;
  color:var(--muted);
  font-size:13px;
  line-height:1.6;
  opacity:0;
  transform:translateY(4px);
  transition:opacity 120ms ease, transform 120ms ease;
  transition-delay:0ms;
}
.ns-hf-content[data-state="open"]{
  opacity:1;
  transform:translateY(0);
  transition:opacity 220ms ease, transform 220ms cubic-bezier(0.16,1,0.3,1);
  transition-delay:220ms;
}

@media (prefers-reduced-motion: reduce){
  .ns-hf-header,.ns-hf-hasp,.ns-hf-rows,.ns-hf-content{
    transition-duration:0ms !important;
    transition-delay:0ms !important;
  }
}
`;
