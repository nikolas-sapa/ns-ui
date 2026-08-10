"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

// ---------------------------------------------------------------------------
// ThumbNotch — a jump index literally die-cut into a scroll surface's right
// edge, like the thumb index of a hardback dictionary, instead of a floating
// A-Z rail sitting on top of the content (that's listbox-sticky-groups'
// job — it pins passed HEADERS as content scrolls under them; this component
// never moves a header, it carves the edge itself and the carving encodes
// progress even at rest, with nothing scrolling).
//
// MECHANISM: the scroll panel gets a clip-path: path(...) cut from its own
// right edge — one concave semicircular bite per group, y-positions spread
// evenly down the panel's measured height (ResizeObserver), radius larger
// for the on-screen group so depth alone reads as "you are here" with no
// scrollbar. A second layer (the nav, a later DOM sibling so it paints on
// top with zero z-index juggling) renders one real <button> per group,
// centered exactly on the seam between panel and nav so its circle covers
// the bite — the letter appears to sit "inside the cut" without depending
// on clip-path hit-testing quirks for interaction: buttons are always the
// real, always-focusable target, the clip-path is presentation-only.
//
// Offsets for the scroll target come from each group header's plain
// `.offsetTop` relative to the (position:relative) content wrapper — NOT
// getBoundingClientRect, and NOT the header while it might be mid-shear:
// offsetTop is defined by layout (the `position` chain), so a `transform`
// applied to the content wrapper for the shear animation never perturbs it.
//
// SCRUB: pointerdown on any notch captures the pointer (setPointerCapture),
// so a press-drag along the edge keeps reporting to the same handler no
// matter which notch (or gap between notches) is physically under the
// finger — the drag maps clientY against the nav's own measured rect to the
// nearest group index every move. A loupe pill (fixed position, follows the
// pointer, aria-hidden — it's decoration, not the announcement) previews the
// letter; a visually-hidden aria-live region gets the same letter but only
// on CHANGE, never once per pixel of movement.
//
// COMMIT ("shear"): on release (or a plain click, or Enter/Space, or typing
// the letter — see below) the content wrapper eases out (translateY + fade,
// ease-in, ~150ms), scrollTop jumps under cover of that fade after a 30ms
// beat, then eases back in from the opposite side on ease-out-expo — read as
// riffling the book open rather than a bare scrollTo. A 150ms de-dupe guard
// absorbs the click that a pointer tap or Enter/Space fires right after the
// pointerup/typeahead commit already ran, so it never double-plays.
// prefers-reduced-motion replaces all of that with a direct scrollTop write.
//
// A11Y: every notch is a real <button aria-label="Jump to {letter}">
// inside a <nav aria-label>; the scroll panel keeps the same typeahead a
// native <select> gives you — typing a letter runs the exact same commit a
// notch tap would, so keyboard users never need the notches at all. The
// panel is tabIndex=0/role="region" so it's independently keyboard-
// scrollable even with no notch focused. Colors are --background/
// --foreground/--ns-muted/--border only for the resting read; --ns-accent
// appears only on focus rings and the drag-only loupe pill, never as a
// static "current group" color.
// ---------------------------------------------------------------------------

const EASE_OUT_EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";
const SHEAR_OUT_MS = 150;
const SHEAR_DELAY_MS = 30;
const SHEAR_IN_MS = 320;
const TYPEAHEAD_MS = 500;
const COMMIT_DEDUPE_MS = 150;

const EDGE_INSET = 20; // px top/bottom margin before the first/last notch
const PANEL_R_BASE = 7; // px — clip-path bite radius, resting group
const PANEL_R_ACTIVE = 11; // px — clip-path bite radius, on-screen group
const BTN_R_BASE = 8; // px — notch button radius, resting group
const BTN_R_ACTIVE = 12; // px — notch button radius, on-screen group
const NAV_W = 30; // px — reserved column the notches protrude into

export interface ThumbNotchItem {
  id: string;
  label: string;
  sublabel?: string;
}

export interface ThumbNotchGroup {
  id: string;
  /** short edge label, usually a single letter — this is what gets cut into the edge */
  letter: string;
  items: ThumbNotchItem[];
}

const CONTACT_GROUPS: { letter: string; names: [string, string][] }[] = [
  { letter: "A", names: [["Ada Okoye", "Design"], ["Amir Farhat", "Sales"]] },
  {
    letter: "B",
    names: [
      ["Beatrix Lund", "Support"],
      ["Bram Vos", "Engineering"],
      ["Bianca Reyes", "Ops"],
    ],
  },
  { letter: "C", names: [["Carmen Silva", "Design"], ["Cyrus Bakhtiar", "Finance"]] },
  {
    letter: "D",
    names: [
      ["Dana Kowalski", "Engineering"],
      ["Dmitri Orlov", "Sales"],
      ["Doreen Ashby", "Support"],
    ],
  },
  { letter: "E", names: [["Elif Kaya", "Ops"], ["Ezra Newman", "Engineering"]] },
  { letter: "F", names: [["Farah Idris", "Design"], ["Finn Ostrander", "Sales"]] },
  {
    letter: "G",
    names: [
      ["Greta Solheim", "Finance"],
      ["Gustavo Peña", "Engineering"],
    ],
  },
  { letter: "H", names: [["Hana Suzuki", "Support"], ["Hugo Berg", "Ops"]] },
  { letter: "I", names: [["Imani Cole", "Sales"]] },
  {
    letter: "J",
    names: [
      ["Jael Botha", "Design"],
      ["Jonas Weiss", "Engineering"],
      ["Junko Ito", "Finance"],
    ],
  },
  { letter: "K", names: [["Karim Haddad", "Ops"], ["Kirsten Aas", "Support"]] },
  { letter: "L", names: [["Lena Marchetti", "Engineering"], ["Luuk de Vries", "Sales"]] },
  {
    letter: "M",
    names: [
      ["Mateus Rocha", "Design"],
      ["Miriam Cohen", "Finance"],
      ["Musa Diallo", "Ops"],
    ],
  },
  { letter: "N", names: [["Nadia Petrov", "Support"], ["Noor Hassan", "Engineering"]] },
  { letter: "O", names: [["Oskar Lindqvist", "Sales"]] },
  { letter: "P", names: [["Priya Nair", "Design"], ["Pieter Claes", "Finance"]] },
  {
    letter: "R",
    names: [
      ["Rafaela Souza", "Ops"],
      ["Ravi Chandran", "Engineering"],
    ],
  },
  { letter: "S", names: [["Sanne Bakker", "Support"], ["Sami Toivanen", "Sales"]] },
  { letter: "T", names: [["Tariq Younis", "Design"], ["Tove Nystrom", "Finance"]] },
  { letter: "V", names: [["Valentina Ruiz", "Engineering"], ["Viggo Haas", "Ops"]] },
  { letter: "W", names: [["Wren Ashcombe", "Support"]] },
];

const DEFAULT_GROUPS: ThumbNotchGroup[] = CONTACT_GROUPS.map((g) => ({
  id: g.letter.toLowerCase(),
  letter: g.letter,
  items: g.names.map(([name, sublabel]) => ({
    id: `${g.letter.toLowerCase()}-${name.toLowerCase().replace(/[^a-z]+/g, "-")}`,
    label: name,
    sublabel,
  })),
}));

interface NotchPosition {
  y: number;
  panelR: number;
  btnR: number;
}

export function ThumbNotch({
  groups = DEFAULT_GROUPS,
  label = "Contacts",
  navLabel = "Alphabet index",
  height = 420,
  onJump,
  className = "",
}: {
  groups?: ThumbNotchGroup[];
  /** accessible name for the scrollable list region */
  label?: string;
  /** accessible name for the notch nav landmark */
  navLabel?: string;
  height?: number;
  onJump?: (groupId: string) => void;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const headerRefs = useRef<Map<number, HTMLElement>>(new Map());
  const offsetsRef = useRef<number[]>([]);
  const reducedRef = useRef(false);
  const dragRectRef = useRef<DOMRect | null>(null);
  const animRef = useRef<{ cancel: () => void }>({ cancel: () => {} });
  const lastCommitRef = useRef<{ id: string; t: number }>({ id: "", t: 0 });
  const typeRef = useRef<{ buf: string; timer: number }>({ buf: "", timer: 0 });

  const [box, setBox] = useState({ w: 0, h: height });
  const [activeIndex, setActiveIndex] = useState(0);
  const [drag, setDrag] = useState<{ index: number; x: number; y: number } | null>(null);
  const [liveMsg, setLiveMsg] = useState("");

  // -- reduced motion -------------------------------------------------------
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onChange = () => {
      reducedRef.current = mq.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // -- measure the panel (drives the clip-path + notch geometry) -----------
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // -- group start offsets, immune to the shear transform (offsetTop, not
  // getBoundingClientRect) --------------------------------------------------
  useLayoutEffect(() => {
    offsetsRef.current = groups.map((_, gi) => headerRefs.current.get(gi)?.offsetTop ?? 0);
  }, [groups, box.w, box.h]);

  // -- which group is "on screen" right now, for the resting notch depths --
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const recompute = () => {
      raf = 0;
      const offs = offsetsRef.current;
      const st = el.scrollTop;
      let idx = 0;
      for (let i = 0; i < offs.length; i++) {
        if ((offs[i] ?? 0) <= st + 2) idx = i;
        else break;
      }
      setActiveIndex(idx);
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(recompute);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    recompute();
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [groups]);

  useEffect(() => {
    return () => {
      window.clearTimeout(typeRef.current.timer);
      animRef.current.cancel();
    };
  }, []);

  // -- notch geometry: evenly spread y-positions, deeper radius on the
  // on-screen group ----------------------------------------------------------
  const positions = useMemo<NotchPosition[]>(() => {
    const n = groups.length;
    if (n === 0 || box.h <= 0) return [];
    const usable = Math.max(0, box.h - EDGE_INSET * 2);
    const rawStep = n > 1 ? usable / (n - 1) : 0;
    const minStep = PANEL_R_ACTIVE + PANEL_R_BASE + 6;
    const step = Math.max(rawStep, minStep);
    return groups.map((_, i) => {
      const isActive = i === activeIndex;
      return {
        y: EDGE_INSET + i * step,
        panelR: isActive ? PANEL_R_ACTIVE : PANEL_R_BASE,
        btnR: isActive ? BTN_R_ACTIVE : BTN_R_BASE,
      };
    });
  }, [groups, box.h, activeIndex]);

  // -- clip-path cut from the panel's own right edge, one bite per group ---
  const clipPath = useMemo(() => {
    const w = box.w;
    const h = box.h;
    if (w <= 0 || h <= 0 || positions.length === 0) return undefined;
    let d = `M0,0 L${w},0 `;
    for (const p of positions) {
      const top = Math.max(0, p.y - p.panelR);
      const bottom = Math.min(h, p.y + p.panelR);
      d += `L${w},${top} A${p.panelR},${p.panelR} 0 0 0 ${w},${bottom} `;
    }
    d += `L${w},${h} L0,${h} Z`;
    return `path("${d}")`;
  }, [positions, box.w, box.h]);

  // -- shear commit: eases the content out, jumps scrollTop under cover,
  // eases the arrival in from the opposite side -----------------------------
  const commit = useCallback(
    (gi: number) => {
      const group = groups[gi];
      const listEl = scrollRef.current;
      const innerEl = innerRef.current;
      if (!group || !listEl || !innerEl) return;

      const now = Date.now();
      if (lastCommitRef.current.id === group.id && now - lastCommitRef.current.t < COMMIT_DEDUPE_MS) {
        return;
      }
      lastCommitRef.current = { id: group.id, t: now };

      const max = Math.max(0, listEl.scrollHeight - listEl.clientHeight);
      const target = Math.min(offsetsRef.current[gi] ?? 0, max);
      const current = listEl.scrollTop;
      const dir = target > current ? 1 : target < current ? -1 : 0;

      animRef.current.cancel();
      onJump?.(group.id);

      if (reducedRef.current || dir === 0) {
        listEl.scrollTop = target;
        return;
      }

      let cancelled = false;
      innerEl.style.transition = `transform ${SHEAR_OUT_MS}ms ease-in, opacity ${SHEAR_OUT_MS}ms ease-in`;
      innerEl.style.transform = `translateY(${dir > 0 ? -10 : 10}px)`;
      innerEl.style.opacity = "0";

      const outTimer = window.setTimeout(() => {
        if (cancelled) return;
        listEl.scrollTop = target;
        innerEl.style.transition = "none";
        innerEl.style.transform = `translateY(${dir > 0 ? 10 : -10}px)`;
        // force a reflow so the next transition actually starts from here
        void innerEl.offsetHeight;
        const raf = requestAnimationFrame(() => {
          if (cancelled) return;
          innerEl.style.transition = `transform ${SHEAR_IN_MS}ms ${EASE_OUT_EXPO}, opacity ${Math.round(
            SHEAR_IN_MS * 0.7
          )}ms ease-out`;
          innerEl.style.transform = "translateY(0)";
          innerEl.style.opacity = "1";
        });
        animRef.current.cancel = () => {
          cancelled = true;
          cancelAnimationFrame(raf);
        };
      }, SHEAR_DELAY_MS);

      animRef.current.cancel = () => {
        cancelled = true;
        window.clearTimeout(outTimer);
      };
    },
    [groups, onJump]
  );

  // -- native-select-style typeahead on the scroll panel itself: the exact
  // same commit a notch tap would run, so keyboard users never need the
  // notches ------------------------------------------------------------------
  const onRegionKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key.length !== 1 || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = typeRef.current;
    t.buf += e.key.toLowerCase();
    window.clearTimeout(t.timer);
    t.timer = window.setTimeout(() => {
      t.buf = "";
    }, TYPEAHEAD_MS);
    const idx = groups.findIndex((g) => g.letter.toLowerCase().startsWith(t.buf));
    if (idx >= 0) {
      e.preventDefault();
      commit(idx);
    }
  };

  // -- scrub: pointer capture keeps reporting to the notch that started the
  // drag no matter what's physically under the finger ----------------------
  const indexForClientY = (clientY: number) => {
    const rect = dragRectRef.current;
    if (!rect || positions.length === 0) return activeIndex;
    const rel = clientY - rect.top;
    let best = 0;
    let bestDist = Infinity;
    positions.forEach((p, i) => {
      const d = Math.abs(p.y - rel);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  };

  const onNotchPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const nav = navRef.current;
    if (!nav) return;
    dragRectRef.current = nav.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    const idx = indexForClientY(e.clientY);
    setDrag({ index: idx, x: e.clientX, y: e.clientY });
    const g = groups[idx];
    if (g) setLiveMsg(`Jump to ${g.letter}`);
  };

  const onNotchPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    setDrag((prev) => {
      if (!prev) return prev;
      const idx = indexForClientY(e.clientY);
      if (idx !== prev.index) {
        const g = groups[idx];
        if (g) setLiveMsg(`Jump to ${g.letter}`);
      }
      return { index: idx, x: e.clientX, y: e.clientY };
    });
  };

  const endDrag = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDrag((prev) => {
      if (prev) commit(prev.index);
      return null;
    });
  };

  const dragLetter = drag ? groups[drag.index]?.letter : undefined;

  return (
    <div className={className}>
      <div
        className="relative flex w-full max-w-sm"
        style={{ height }}
      >
        <div
          ref={scrollRef}
          role="region"
          aria-label={label}
          tabIndex={0}
          onKeyDown={onRegionKeyDown}
          className="relative min-w-0 flex-1 overflow-y-auto overscroll-contain rounded-md border border-border bg-background outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-inset [&::-webkit-scrollbar]:hidden"
          style={{ clipPath }}
        >
          <div ref={innerRef} className="relative">
            {groups.map((g, gi) => (
              <div key={g.id} role="group" aria-label={`${g.letter} — ${g.items.length} contact${g.items.length === 1 ? "" : "s"}`}>
                <p
                  ref={(el) => {
                    if (el) headerRefs.current.set(gi, el);
                    else headerRefs.current.delete(gi);
                  }}
                  aria-hidden
                  className="px-4 pb-1 pt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-ns-muted first:pt-3"
                >
                  {g.letter}
                </p>
                <ul>
                  {g.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-baseline justify-between gap-3 border-b border-border/60 px-4 py-2 text-sm text-foreground last:border-b-0"
                    >
                      <span className="truncate">{item.label}</span>
                      {item.sublabel ? (
                        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-ns-muted">
                          {item.sublabel}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <nav
          ref={navRef}
          aria-label={navLabel}
          className="relative shrink-0 touch-none select-none"
          style={{ width: NAV_W }}
        >
          {groups.map((g, gi) => {
            const pos = positions[gi];
            if (!pos) return null;
            const isActive = gi === activeIndex;
            const isDragging = drag?.index === gi;
            const d = pos.btnR * 2;
            return (
              <button
                key={g.id}
                type="button"
                aria-label={`Jump to ${g.letter}`}
                onClick={() => commit(gi)}
                onPointerDown={onNotchPointerDown}
                onPointerMove={onNotchPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                style={{
                  top: pos.y,
                  left: 0,
                  width: d,
                  height: d,
                }}
                className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border font-mono outline-none transition-[color,font-size,border-color] duration-150 hover:border-foreground/50 focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none ${
                  isActive
                    ? "border-border bg-background text-[11px] font-semibold text-foreground"
                    : "border-border/70 bg-background text-[9px] text-ns-muted"
                } ${isDragging ? "border-ns-accent" : ""}`}
              >
                {g.letter}
              </button>
            );
          })}
        </nav>
      </div>

      {drag ? (
        <div
          aria-hidden
          className="pointer-events-none fixed z-50 -translate-x-[calc(100%+14px)] -translate-y-1/2 rounded-full border border-ns-accent bg-background px-3 py-1.5 font-mono text-sm font-semibold text-foreground shadow-md"
          style={{ left: drag.x, top: drag.y }}
        >
          {dragLetter}
        </div>
      ) : null}

      <p aria-live="polite" className="sr-only">
        {liveMsg}
      </p>
    </div>
  );
}
