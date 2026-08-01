"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

// ---------------------------------------------------------------------------
// FolioTurn — pagination rendered as a row of book folios instead of bare
// numbers. Every button is a paper "card"; the current one sits 1px raised
// with a soft shadow. Each card carries a corner dog-ear built from the
// classic CSS border-triangle technique (an element with all size in
// border-width and only two adjacent border colors opaque) so it costs no
// extra markup layer — just a --curl custom property driving border-width.
//
// Three distinct curl behaviors, all on that same triangle:
//   - hovering ANY page number: its own corner dog-ear grows a few px and
//     its ink darkens (a light "this is interactive" tell).
//   - hovering prev/next: the CURRENT page's corner grows further and a
//     small preview of the destination number fades in beside it — you're
//     peeking at what prev/next would turn to, not what you're hovering.
//   - completing a turn (the `page` prop actually changes, from any
//     trigger): the outgoing page's corner grows the rest of the way while
//     the card itself gets a brief eased tilt+fade, then the new current
//     page settles into its raised resting state. A once-visited page
//     keeps a small permanent crease (a second, smaller, static triangle)
//     forever after.
//
// Keyboard is a roving-tabindex toolbar (prev, every page number, next, all
// one tab stop): ArrowLeft/ArrowRight move focus by one among the ENABLED
// controls, Home/End jump to the first/last, matching the roving pattern
// used elsewhere in this registry (dropdown-drape, accordion-latch) rather than a
// custom listbox. Enter/Space activate the focused control natively.
// `<nav aria-label>` + `aria-current="page"` on the current button is the
// only semantic layer; there is no live region because the page number
// itself, visibly raised, is the state.
//
// prefers-reduced-motion: no curl growth, no tilt/fade on turn, pages swap
// instantly — the permanent visited-crease still appears (it is not an
// animation, just a static mark) so history stays visible either way.
// ---------------------------------------------------------------------------

export interface FolioTurnProps {
  /** Current page, 1-indexed. */
  page: number;
  /** Total number of pages. */
  count: number;
  onChange: (page: number) => void;
  className?: string;
}

const TURN_MS = 280;

export function FolioTurn({ page, count, onChange, className = "" }: FolioTurnProps) {
  const [hoverPage, setHoverPage] = useState<number | null>(null);
  const [peekDir, setPeekDir] = useState<0 | -1 | 1>(0);
  const [turning, setTurning] = useState<{ from: number } | null>(null);
  const [visited, setVisited] = useState<Set<number>>(() => new Set([page]));
  const reducedRef = useRef(false);
  const prevPageRef = useRef(page);
  const turnTimerRef = useRef<number | undefined>(undefined);

  // Flat control list: index 0 = prev, 1..count = page numbers, count+1 = next.
  const total = count + 2;
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const isDisabled = (i: number) => (i === 0 && page <= 1) || (i === total - 1 && page >= count);
  const enabledIndices = Array.from({ length: total }, (_, i) => i).filter((i) => !isDisabled(i));

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onMq = () => {
      reducedRef.current = mq.matches;
    };
    mq.addEventListener("change", onMq);
    return () => mq.removeEventListener("change", onMq);
  }, []);

  useEffect(() => {
    const prev = prevPageRef.current;
    prevPageRef.current = page;
    setVisited((v) => (v.has(page) ? v : new Set(v).add(page)));
    if (prev === page) return;
    window.clearTimeout(turnTimerRef.current);
    if (reducedRef.current) return;
    setTurning({ from: prev });
    turnTimerRef.current = window.setTimeout(() => setTurning(null), TURN_MS);
    return () => window.clearTimeout(turnTimerRef.current);
  }, [page]);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>, i: number) => {
    const pos = enabledIndices.indexOf(i);
    let nextPos = -1;
    if (e.key === "ArrowLeft") nextPos = pos <= 0 ? enabledIndices.length - 1 : pos - 1;
    else if (e.key === "ArrowRight") nextPos = (pos + 1) % enabledIndices.length;
    else if (e.key === "Home") nextPos = 0;
    else if (e.key === "End") nextPos = enabledIndices.length - 1;
    if (nextPos >= 0) {
      e.preventDefault();
      btnRefs.current[enabledIndices[nextPos]!]?.focus();
    }
  };

  const go = (n: number) => {
    if (n < 1 || n > count || n === page) return;
    onChange(n);
  };

  return (
    <nav aria-label="Pagination" className={`ns-ft-nav ${className}`}>
      <style>{CSS}</style>
      <ul className="ns-ft-list">
        <li>
          <button
            ref={(el) => {
              btnRefs.current[0] = el;
            }}
            type="button"
            aria-label="Previous page"
            disabled={page <= 1}
            tabIndex={enabledIndices[0] === 0 ? 0 : -1}
            className="ns-ft-nav-btn"
            onClick={() => go(page - 1)}
            onKeyDown={(e) => onKeyDown(e, 0)}
            onPointerEnter={() => setPeekDir(-1)}
            onPointerLeave={() => setPeekDir(0)}
          >
            ‹
          </button>
        </li>
        {Array.from({ length: count }, (_, i) => i + 1).map((n) => {
          const flatIndex = n;
          const isCurrent = n === page;
          const isHover = hoverPage === n;
          const isVisited = visited.has(n) && !isCurrent;
          const isTurningFrom = turning?.from === n;
          const showNavPeek = isCurrent && peekDir !== 0;
          const peekNumber = showNavPeek ? page + peekDir : null;
          const curl = isTurningFrom ? 1 : isHover ? 0.55 : showNavPeek ? 0.7 : 0;
          return (
            <li key={n} className="ns-ft-item">
              <button
                ref={(el) => {
                  btnRefs.current[flatIndex] = el;
                }}
                type="button"
                aria-label={`Page ${n}`}
                aria-current={isCurrent ? "page" : undefined}
                tabIndex={enabledIndices[0] === flatIndex ? 0 : -1}
                className="ns-ft-page"
                data-current={isCurrent || undefined}
                data-turning={isTurningFrom || undefined}
                data-visited={isVisited || undefined}
                data-peek={showNavPeek || undefined}
                style={{ "--curl": curl } as React.CSSProperties}
                onClick={() => go(n)}
                onKeyDown={(e) => onKeyDown(e, flatIndex)}
                onPointerEnter={() => setHoverPage(n)}
                onPointerLeave={() => setHoverPage((h) => (h === n ? null : h))}
              >
                <span className="ns-ft-num">{n}</span>
                {peekNumber && peekNumber >= 1 && peekNumber <= count && (
                  <span className="ns-ft-peek" aria-hidden="true">
                    {peekNumber}
                  </span>
                )}
                <span className="ns-ft-curl" aria-hidden="true" />
                {isVisited && <span className="ns-ft-crease" aria-hidden="true" />}
              </button>
            </li>
          );
        })}
        <li>
          <button
            ref={(el) => {
              btnRefs.current[total - 1] = el;
            }}
            type="button"
            aria-label="Next page"
            disabled={page >= count}
            tabIndex={enabledIndices[0] === total - 1 ? 0 : -1}
            className="ns-ft-nav-btn"
            onClick={() => go(page + 1)}
            onKeyDown={(e) => onKeyDown(e, total - 1)}
            onPointerEnter={() => setPeekDir(1)}
            onPointerLeave={() => setPeekDir(0)}
          >
            ›
          </button>
        </li>
      </ul>
    </nav>
  );
}

const CSS = `
.ns-ft-nav{display:inline-block;}
.ns-ft-list{display:flex;align-items:flex-end;gap:6px;list-style:none;margin:0;padding:0;}
.ns-ft-nav-btn{
  display:flex;align-items:center;justify-content:center;
  width:32px;height:38px;
  border:1px solid var(--border);border-radius:4px;
  background:var(--background);color:var(--muted);
  font-size:16px;line-height:1;cursor:pointer;
  transition:color 150ms ease, border-color 150ms ease;
}
.ns-ft-nav-btn:not(:disabled):hover{color:var(--foreground);border-color:var(--muted);}
.ns-ft-nav-btn:disabled{opacity:0.35;cursor:default;}
.ns-ft-nav-btn:focus-visible{outline:2px solid var(--accent);outline-offset:1px;}

.ns-ft-item{position:relative;}
.ns-ft-page{
  --curl:0;
  position:relative;
  overflow:hidden;
  width:34px;height:40px;
  border:1px solid var(--border);border-radius:4px;
  background:var(--background);
  color:var(--muted);
  font-family:var(--font-geist-mono, ui-monospace, monospace);
  font-size:13px;
  cursor:pointer;
  transform:translateY(0);
  box-shadow:none;
  transition:color 150ms ease, transform 200ms cubic-bezier(0.16,1,0.3,1), box-shadow 200ms ease, border-color 150ms ease;
}
.ns-ft-page:hover{color:var(--foreground);border-color:var(--muted);}
.ns-ft-page:focus-visible{outline:2px solid var(--accent);outline-offset:1px;}
.ns-ft-page[data-current]{
  color:var(--foreground);
  transform:translateY(-1px);
  box-shadow:0 2px 4px -1px rgba(0,0,0,0.35);
  border-color:var(--foreground);
}
.ns-ft-page[data-turning]{
  transition:transform ${TURN_MS}ms cubic-bezier(0.55,0,0.85,0.35), opacity ${TURN_MS}ms ease;
  transform:translateY(-1px) rotateZ(-3deg) translateX(-2px);
  opacity:0.75;
}

.ns-ft-num{position:relative;z-index:1;}
.ns-ft-peek{
  position:absolute;
  top:3px;right:3px;
  font-size:9px;
  color:var(--muted);
  opacity:0;
  transition:opacity 200ms ease;
  z-index:1;
}
.ns-ft-page[data-peek] .ns-ft-peek{opacity:1;}

.ns-ft-curl{
  position:absolute;
  top:0;right:0;
  width:0;height:0;
  border-style:solid;
  border-color:transparent var(--border) transparent transparent;
  border-width:0 calc(var(--curl) * 16px) calc(var(--curl) * 16px) 0;
  transition:border-width 220ms cubic-bezier(0.22,1,0.36,1);
}

.ns-ft-crease{
  position:absolute;
  bottom:0;right:0;
  width:0;height:0;
  border-style:solid;
  border-width:0 0 7px 7px;
  border-color:transparent transparent var(--border) transparent;
}

@media (prefers-reduced-motion: reduce){
  .ns-ft-page,.ns-ft-curl,.ns-ft-peek{transition:none !important;}
}
`;
