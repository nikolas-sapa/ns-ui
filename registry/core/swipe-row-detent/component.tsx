"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

// ---------------------------------------------------------------------------
// DetentSwipe — a swipeable list row with machined detent stops, not a free
// drag-to-reveal. Dragging left steps through two magnetic detents (archive,
// then flag) — crossing each zone's threshold "clicks" the row to that
// detent's exact position with a fast settle, rather than following the
// finger continuously. Past the second detent a hard stop resists further
// travel (diminishing-returns curve) while the row edge compresses; enough
// overtravel ARMS delete. Releasing while armed opens a 3-second undo bar
// (a burn-down bar) before the delete actually commits.
//
// Actions are `visibility: hidden` (not display:none, not unmounted) until
// their detent is reached — this correctly removes them from hit-testing
// AND the accessibility tree while resting, with zero risk of an invisible
// button intercepting a click. Enter (keyboard) invokes the handler
// directly, so keyboard activation never depends on the button itself
// being focusable at rest.
// ---------------------------------------------------------------------------

export interface DetentSwipeProps {
  /** primary row text */
  title: string;
  /** secondary row text under the title */
  subtitle?: string;
  /** called when the archive action is revealed and confirmed */
  onArchive?: () => void;
  /** called when the flag action is revealed and confirmed */
  onFlag?: () => void;
  /** called when the delete action is revealed and confirmed */
  onDelete?: () => void;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const ARCHIVE_W = 76;
const FLAG_W = 76;
const D1 = ARCHIVE_W;
const D2 = ARCHIVE_W + FLAG_W;
const OVERTRAVEL_MAX = 96;
const RESIST_K = 70;
const ARM_RAW_DELTA = D2 + 64;
const SETTLE_MS = 140;
const EASE_SETTLE = "cubic-bezier(0.2, 0.7, 0.2, 1)";
const UNDO_MS = 3000;
const DETENTS: [number, number, number] = [0, D1, D2];

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function DetentSwipe({ title, subtitle, onArchive, onFlag, onDelete, className = "" }: DetentSwipeProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const burnRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const baseOffsetRef = useRef(0);
  const downXRef = useRef(0);
  const engagedRef = useRef<0 | 1 | 2>(0);
  const armedRef = useRef(false);
  const reducedRef = useRef(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [engagedIndex, setEngagedIndex] = useState<0 | 1 | 2>(0);
  const [armed, setArmed] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onChange = () => {
      reducedRef.current = mq.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(
    () => () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    },
    []
  );

  const setX = useCallback((px: number, animate: boolean) => {
    const el = contentRef.current;
    if (!el) return;
    el.style.transition = animate && !reducedRef.current ? `transform ${SETTLE_MS}ms ${EASE_SETTLE}` : "none";
    el.style.setProperty("--dtx-x", `${-px}px`);
  }, []);

  const goRest = useCallback(
    (animate = true) => {
      engagedRef.current = 0;
      armedRef.current = false;
      setEngagedIndex(0);
      setArmed(false);
      setPendingDelete(false);
      setX(0, animate);
    },
    [setX]
  );

  const startUndo = useCallback(() => {
    setPendingDelete(true);
    setAnnounce(`Delete armed for ${title}. Undo within 3 seconds.`);
    const burn = burnRef.current;
    if (burn) {
      burn.style.transition = "none";
      burn.style.width = "100%";
      requestAnimationFrame(() => {
        burn.style.transition = reducedRef.current ? "none" : `width ${UNDO_MS}ms linear`;
        burn.style.width = "0%";
      });
    }
    undoTimerRef.current = setTimeout(() => {
      onDelete?.();
      goRest(false);
      setAnnounce(`${title} deleted.`);
    }, UNDO_MS);
  }, [goRest, onDelete, title]);

  const cancelUndo = useCallback(() => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setAnnounce(`Delete cancelled for ${title}.`);
    goRest(true);
  }, [goRest, title]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (pendingDelete) return;
      const el = contentRef.current;
      if (!el) return;
      el.setPointerCapture(e.pointerId);
      draggingRef.current = true;
      baseOffsetRef.current = DETENTS[engagedRef.current];
      downXRef.current = e.clientX;
    },
    [pendingDelete]
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      const raw = clamp(baseOffsetRef.current + (downXRef.current - e.clientX), 0, Infinity);

      if (raw <= D2) {
        const zone: 0 | 1 | 2 = raw < D1 * 0.5 ? 0 : raw < D1 + (D2 - D1) * 0.5 ? 1 : 2;
        if (zone !== engagedRef.current) {
          engagedRef.current = zone;
          setEngagedIndex(zone);
          setX(DETENTS[zone], true);
          if (zone > 0) setAnnounce(zone === 1 ? "Archive revealed." : "Flag revealed.");
        }
        if (armedRef.current) {
          armedRef.current = false;
          setArmed(false);
        }
      } else {
        const extra = raw - D2;
        const resisted = OVERTRAVEL_MAX * (1 - 1 / (1 + extra / RESIST_K));
        const nowArmed = raw >= ARM_RAW_DELTA;
        setX(D2 + resisted - (nowArmed ? 2 : 0), false);
        if (nowArmed !== armedRef.current) {
          armedRef.current = nowArmed;
          setArmed(nowArmed);
          if (nowArmed) setAnnounce("Delete armed. Release to confirm.");
        }
        if (engagedRef.current !== 2) {
          engagedRef.current = 2;
          setEngagedIndex(2);
        }
      }
    },
    [setX]
  );

  const onPointerUp = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (armedRef.current) {
      setX(D2 + OVERTRAVEL_MAX - 2, true);
      startUndo();
      return;
    }
    setX(DETENTS[engagedRef.current], true);
  }, [setX, startUndo]);

  const activate = useCallback(() => {
    if (engagedRef.current === 1) {
      onArchive?.();
      goRest(true);
    } else if (engagedRef.current === 2) {
      onFlag?.();
      goRest(true);
    }
  }, [goRest, onArchive, onFlag]);

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (pendingDelete) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        const next = clamp(engagedRef.current + 1, 0, 2) as 0 | 1 | 2;
        engagedRef.current = next;
        setEngagedIndex(next);
        setX(DETENTS[next], true);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const next = clamp(engagedRef.current - 1, 0, 2) as 0 | 1 | 2;
        engagedRef.current = next;
        setEngagedIndex(next);
        setX(DETENTS[next], true);
      } else if (e.key === "Enter") {
        e.preventDefault();
        activate();
      } else if (e.key === "Escape" && engagedRef.current !== 0) {
        e.preventDefault();
        goRest(true);
      }
    },
    [activate, goRest, pendingDelete]
  );

  const restable = engagedIndex === 0 && !armed && !pendingDelete;
  // Rendered from state, not hardcoded — a re-render (e.g. from setEngagedIndex)
  // replaces the whole inline `style` object, which would otherwise stomp the
  // ref-driven --dtx-x value from mid-drag imperative writes back to 0. Keying
  // it off `engagedIndex` means any such reset lands on the CORRECT resting
  // detent instead of always snapping back to rest.
  const contentStyle: CSSProperties & Record<string, string> = {
    transform: "translate(var(--dtx-x, 0px), var(--dtx-y, 0px))",
    "--dtx-x": `${-DETENTS[engagedIndex]}px`,
  };

  return (
    <div
      tabIndex={0}
      role="group"
      aria-label={`${title}${subtitle ? `, ${subtitle}` : ""}. Use arrow keys to reveal Archive and Flag, Enter to activate, Escape to close.`}
      onKeyDown={onKeyDown}
      // overflow-hidden lives on the INNER clip wrapper below, never on this
      // focusable element — an element clips its own focus-visible outline
      // when overflow isn't `visible` (confirmed empirically: the ring never
      // painted in a screenshot despite computed style reporting it), so the
      // outlined element and the overflow-clipping element must be different
      // nodes.
      className={`ns-dtx-wrap relative focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent ${className}`}
    >
      <style>{CSS}</style>
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announce}
      </span>

      <div className="relative overflow-hidden">
      {/* DOM/flex order is Delete, Flag, Archive (left-to-right) even though
          detent order is archive-first — the strip is right-anchored, so the
          LAST flex child sits at the row's true right edge and is uncovered
          first as content shifts left. Archive must be that last child to be
          the first thing revealed; Delete goes first so it only clears once
          content has shifted past both other actions' widths (overtravel). */}
      <div className="absolute inset-y-0 right-0 flex">
        <button
          type="button"
          onClick={() => {
            if (armed) startUndo();
          }}
          style={{ visibility: armed ? "visible" : "hidden" }}
          className="ns-dtx-action ns-dtx-delete flex w-[96px] items-center justify-center border-l font-mono text-[11px] uppercase tracking-wide focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ns-accent"
        >
          Delete
        </button>
        <button
          type="button"
          onClick={() => {
            onFlag?.();
            goRest(true);
          }}
          style={{ visibility: engagedIndex >= 2 ? "visible" : "hidden" }}
          className={`ns-dtx-action flex w-[76px] items-center justify-center border-l font-mono text-[11px] uppercase tracking-wide text-foreground hover:bg-border/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ns-accent ${
            engagedIndex >= 2 ? "border-l-foreground bg-border/20" : "border-l-border"
          }`}
        >
          Flag
        </button>
        <button
          type="button"
          onClick={() => {
            onArchive?.();
            goRest(true);
          }}
          style={{ visibility: engagedIndex >= 1 ? "visible" : "hidden" }}
          className={`ns-dtx-action flex w-[76px] items-center justify-center border-l font-mono text-[11px] uppercase tracking-wide text-foreground hover:bg-border/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ns-accent ${
            engagedIndex >= 1 ? "border-l-foreground bg-border/20" : "border-l-border"
          }`}
        >
          Archive
        </button>
      </div>

      <div
        ref={contentRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={contentStyle}
        className={`ns-dtx-content relative flex items-center gap-3 border-b border-border bg-background px-4 py-4 ${
          restable ? "ns-dtx-restable" : ""
        }`}
      >
        <span aria-hidden="true" className="ns-dtx-grip absolute left-1.5 flex flex-col gap-1 opacity-0">
          <span className="h-1 w-1 rounded-full bg-ns-muted" />
          <span className="h-1 w-1 rounded-full bg-ns-muted" />
          <span className="h-1 w-1 rounded-full bg-ns-muted" />
        </span>
        <span aria-hidden="true" className="h-9 w-9 shrink-0 rounded-full border border-border" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-foreground">{title}</span>
          {subtitle && <span className="block truncate text-xs text-ns-muted">{subtitle}</span>}
        </span>
      </div>

      {pendingDelete && (
        <div className="absolute inset-0 flex items-center justify-between border-b border-border bg-background px-4">
          <span className="font-mono text-xs text-ns-muted">{title} deleted</span>
          <button
            type="button"
            onClick={cancelUndo}
            className="font-mono text-xs text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            Undo
          </button>
          <div ref={burnRef} aria-hidden="true" className="ns-dtx-burn absolute inset-x-0 bottom-0 h-px" />
        </div>
      )}
      </div>
    </div>
  );
}

const CSS = `
.ns-dtx-restable:hover{ --dtx-y: -1px; }
.ns-dtx-restable:hover .ns-dtx-grip{ opacity: 1; }
.ns-dtx-content{ cursor: grab; touch-action: pan-y; }
.ns-dtx-content:active{ cursor: grabbing; }
.ns-dtx-grip{ transition: opacity 150ms ease-out; }
.ns-dtx-action{ transition: background-color 150ms ease-out, border-color 150ms ease-out; }
.ns-dtx-delete{ color: var(--error); border-left-color: var(--error); }
.ns-dtx-delete:hover{ background: color-mix(in srgb, var(--error) 14%, transparent); }
.ns-dtx-burn{ background: var(--error); }
@media (prefers-reduced-motion: reduce){
  .ns-dtx-grip, .ns-dtx-action { transition: none; }
}
`;

export default DetentSwipe;
