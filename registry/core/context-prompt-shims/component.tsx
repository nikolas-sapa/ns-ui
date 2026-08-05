"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

// ---------------------------------------------------------------------------
// ShimFit — prompt composition as fitting machinist's shims into a gap of
// fixed height (the context window). Every section (system / tools / memory
// / retrieved docs / user message) is a real DOM row whose height maps to its
// token count; stack order IS prompt order, reordered by drag or by a full
// keyboard listbox pattern (Space lifts, arrows move, Space drops) with FLIP
// transforms on every reorder. Remaining budget is a real empty clearance
// region above the stack, never a percentage bar. Inserting a tray candidate
// that would blow the budget elastically compresses the stack, springs the
// candidate back to the tray, pulses the largest truncatable row's edge, and
// opens a persistent "thin this one" remedy — no error string, a visible
// non-fit plus a suggested fix. Pure DOM/CSS, no canvas.
// ---------------------------------------------------------------------------

export interface ShimSection {
  id: string;
  label: string;
  tokens: number;
  /** may be offered as the trim target when an insert overflows */
  truncatable?: boolean;
  /** floor tokens can't be trimmed below; defaults to 30% of initial tokens */
  minTokens?: number;
}

export interface ShimFitProps {
  /** total context-window budget, in tokens */
  budget?: number;
  /** initial stack, top-to-bottom = prompt order */
  sections?: ShimSection[];
  /** candidates waiting in the tray, not yet part of the prompt */
  candidates?: ShimSection[];
  /** px per token for row height (min 8px floor still applies) */
  scale?: number;
  className?: string;
  "aria-label"?: string;
}

// Floor a row at 16px, not 8px: an 8px row cannot contain its own ~14px label,
// so a thin row (e.g. a 120-token message) let its centered text bleed past the
// row and — being the last row, flush at the frame's clipped bottom edge — get
// severed by the frame's overflow-hidden. 16px holds the (hairline-sized) label
// cleanly; the stack still fits with clearance to spare.
const MIN_ROW_PX = 16;
const HAIRLINE_PX = 18;
const COMPRESS_MS = 120;
const FLIP_MS = 320;
const FLIP_EASE = "cubic-bezier(0.22,1,0.36,1)";
const PULSE_MS = 620;
const SUGGEST_DISMISS_MS = 9000;

const DEFAULT_SECTIONS: ShimSection[] = [
  { id: "system", label: "System prompt", tokens: 1200 },
  { id: "tools", label: "Tool definitions", tokens: 900, truncatable: true, minTokens: 300 },
  { id: "memory", label: "Memory", tokens: 1800, truncatable: true, minTokens: 400 },
  { id: "history", label: "Conversation history", tokens: 2400, truncatable: true, minTokens: 600 },
  { id: "user", label: "User message", tokens: 120 },
];

const DEFAULT_CANDIDATES: ShimSection[] = [
  { id: "incident", label: "Retrieved: incident postmortem", tokens: 2200, truncatable: true, minTokens: 500 },
  { id: "styleguide", label: "Retrieved: style guide excerpt", tokens: 500, truncatable: true, minTokens: 150 },
];

function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

// sum of rect heights (measured at drag start, heights don't change mid-drag)
// for every id preceding `id` in `order` — used to cancel out the dragged
// row's own DOM-flow shift when it swaps past a neighbor, so the transform
// keeps tracking the pointer instead of jumping by the neighbor's height.
function cumHeightBefore(order: string[], id: string, rects: Map<string, DOMRect>): number {
  let sum = 0;
  for (const oid of order) {
    if (oid === id) break;
    const r = rects.get(oid);
    if (r) sum += r.height;
  }
  return sum;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

const GripIcon = () => (
  <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden>
    <circle cx="2.5" cy="2.5" r="1.4" />
    <circle cx="7.5" cy="2.5" r="1.4" />
    <circle cx="2.5" cy="7" r="1.4" />
    <circle cx="7.5" cy="7" r="1.4" />
    <circle cx="2.5" cy="11.5" r="1.4" />
    <circle cx="7.5" cy="11.5" r="1.4" />
  </svg>
);

type Rejection = {
  /** candidate that failed to insert */
  attemptedLabel: string;
  attemptedTokens: number;
  overBy: number;
  /** id of the row offered up as the trim target, if any is truncatable */
  suggestFor: string | null;
};

type DragState = {
  id: string;
  pointerId: number;
  startClientY: number;
  startRects: Map<string, DOMRect>;
  order: string[];
  /** live order as currently displayed; updates whenever a swap commits */
  currentOrder: string[];
  currentOrderKey: string;
  /** cumHeightBefore(order, id, startRects) at drag start — the zero-drift baseline */
  baseCum: number;
};

export function ShimFit({
  budget = 8000,
  sections = DEFAULT_SECTIONS,
  candidates = DEFAULT_CANDIDATES,
  scale = 0.06,
  className = "",
  "aria-label": ariaLabel = "Prompt composition",
}: ShimFitProps) {
  const reduced = useReducedMotion();
  const listboxId = useId();

  const [stack, setStack] = useState<ShimSection[]>(sections);
  const [tray, setTray] = useState<ShimSection[]>(candidates);
  const [liftedId, setLiftedId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "");
  const [announce, setAnnounce] = useState("");
  const [alertMsg, setAlertMsg] = useState("");
  const [rejection, setRejection] = useState<Rejection | null>(null);
  const [pulseId, setPulseId] = useState<string | null>(null);
  const [compressed, setCompressed] = useState(false);
  const [bounceTrayId, setBounceTrayId] = useState<string | null>(null);

  const stackRef = useRef(stack);
  stackRef.current = stack;
  const rowElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const dragRef = useRef<DragState | null>(null);
  const pendingFlipRef = useRef<{ prevRects: Map<string, DOMRect>; skip?: string } | null>(null);
  const pendingEnterRef = useRef<string | null>(null);
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const pulseTimerRef = useRef<number | null>(null);
  const compressTimerRef = useRef<number | null>(null);
  const bounceTimerRef = useRef<number | null>(null);
  const suggestTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (pulseTimerRef.current) window.clearTimeout(pulseTimerRef.current);
      if (compressTimerRef.current) window.clearTimeout(compressTimerRef.current);
      if (bounceTimerRef.current) window.clearTimeout(bounceTimerRef.current);
      if (suggestTimerRef.current) window.clearTimeout(suggestTimerRef.current);
    },
    []
  );

  const registerRow = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) rowElsRef.current.set(id, el);
    else rowElsRef.current.delete(id);
  }, []);

  const rowHeight = useCallback((tokens: number) => Math.max(MIN_ROW_PX, tokens * scale), [scale]);

  const totalUsed = useMemo(() => stack.reduce((s, x) => s + x.tokens, 0), [stack]);
  const remaining = budget - totalUsed;
  const frameHeight = Math.max(120, budget * scale);
  const usedHeight = useMemo(
    () => stack.reduce((s, x) => s + rowHeight(x.tokens), 0),
    [stack, rowHeight]
  );
  const clearance = Math.max(0, frameHeight - usedHeight);

  // ---- FLIP: capture rects before a reorder, invert+play after DOM commit --
  const playFlip = useCallback((prevRects: Map<string, DOMRect>, skip?: string) => {
    for (const [id, el] of rowElsRef.current) {
      if (id === skip) continue;
      const before = prevRects.get(id);
      if (!before) continue;
      const after = el.getBoundingClientRect();
      const dy = before.top - after.top;
      if (Math.abs(dy) < 0.5) continue;
      if (reducedRef.current) continue;
      el.style.transition = "none";
      el.style.transform = `translateY(${dy}px)`;
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      el.getBoundingClientRect(); // flush before re-enabling transition
      requestAnimationFrame(() => {
        el.style.transition = `transform ${FLIP_MS}ms ${FLIP_EASE}`;
        el.style.transform = "";
      });
    }
  }, []);

  useEffect(() => {
    const pending = pendingFlipRef.current;
    if (pending) {
      pendingFlipRef.current = null;
      playFlip(pending.prevRects, pending.skip);
    }
    const enterId = pendingEnterRef.current;
    if (enterId) {
      pendingEnterRef.current = null;
      const el = rowElsRef.current.get(enterId);
      if (el && !reducedRef.current) {
        el.style.transition = "none";
        el.style.opacity = "0";
        el.style.transform = `${el.style.transform || ""} translateY(6px)`.trim();
        el.getBoundingClientRect(); // flush
        requestAnimationFrame(() => {
          el.style.transition = `opacity 220ms ease-out, transform ${FLIP_MS}ms ${FLIP_EASE}`;
          el.style.opacity = "1";
          el.style.transform = "";
        });
      }
    }
  }, [stack, playFlip]);

  const captureRects = useCallback((skip?: string) => {
    const rects = new Map<string, DOMRect>();
    for (const s of stackRef.current) {
      if (s.id === skip) continue;
      const el = rowElsRef.current.get(s.id);
      if (el) rects.set(s.id, el.getBoundingClientRect());
    }
    return rects;
  }, []);

  const announceMove = useCallback(
    (id: string, order: ShimSection[]) => {
      const idx = order.findIndex((s) => s.id === id);
      const s = order[idx];
      if (!s) return;
      const used = order.reduce((sum, x) => sum + x.tokens, 0);
      setAnnounce(
        `${s.label.toLowerCase()}, position ${idx + 1} of ${order.length}, ${fmt(s.tokens)} tokens, ${fmt(
          budget - used
        )} remaining`
      );
    },
    [budget]
  );

  // -------------------------------------------------------------------------
  // keyboard: full reorderable-listbox pattern
  // -------------------------------------------------------------------------
  const moveFocus = useCallback((id: string, dir: -1 | 1) => {
    const order = stackRef.current;
    const idx = order.findIndex((s) => s.id === id);
    const next = order[idx + dir];
    if (next) setActiveId(next.id);
  }, []);

  const moveLifted = useCallback(
    (id: string, dir: -1 | 1) => {
      const order = stackRef.current;
      const idx = order.findIndex((s) => s.id === id);
      const newIdx = idx + dir;
      if (idx < 0 || newIdx < 0 || newIdx >= order.length) return;
      const prevRects = captureRects();
      const next = order.slice();
      const [item] = next.splice(idx, 1);
      next.splice(newIdx, 0, item);
      pendingFlipRef.current = { prevRects };
      setStack(next);
      announceMove(id, next);
    },
    [captureRects, announceMove]
  );

  const handleRowKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>, id: string) => {
      switch (e.key) {
        case " ":
        case "Spacebar":
          e.preventDefault();
          if (liftedId === id) {
            setLiftedId(null);
            const idx = stackRef.current.findIndex((s) => s.id === id);
            const s = stackRef.current[idx];
            if (s) setAnnounce(`${s.label.toLowerCase()} dropped at position ${idx + 1} of ${stackRef.current.length}`);
          } else {
            setLiftedId(id);
            const idx = stackRef.current.findIndex((s) => s.id === id);
            const s = stackRef.current[idx];
            if (s)
              setAnnounce(
                `${s.label.toLowerCase()} grabbed, position ${idx + 1} of ${stackRef.current.length}, ${fmt(s.tokens)} tokens`
              );
          }
          break;
        case "ArrowDown":
          e.preventDefault();
          if (liftedId === id) moveLifted(id, 1);
          else moveFocus(id, 1);
          break;
        case "ArrowUp":
          e.preventDefault();
          if (liftedId === id) moveLifted(id, -1);
          else moveFocus(id, -1);
          break;
        case "Escape":
          if (liftedId === id) {
            e.preventDefault();
            setLiftedId(null);
            setAnnounce(`${stackRef.current.find((s) => s.id === id)?.label.toLowerCase() ?? ""} drop cancelled`);
          }
          break;
      }
    },
    [liftedId, moveLifted, moveFocus]
  );

  // -------------------------------------------------------------------------
  // pointer drag reorder — grip is decorative/aria-hidden, keyboard already
  // covers reordering fully; live-swap by comparing the dragged center to
  // the other rows' rects captured once at drag start (heights don't change
  // mid-drag, only order does)
  // -------------------------------------------------------------------------
  const beginDrag = useCallback(
    (id: string, e: ReactPointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const startRects = new Map<string, DOMRect>();
      for (const s of stackRef.current) {
        const el = rowElsRef.current.get(s.id);
        if (el) startRects.set(s.id, el.getBoundingClientRect());
      }
      const order = stackRef.current.map((s) => s.id);
      dragRef.current = {
        id,
        pointerId: e.pointerId,
        startClientY: e.clientY,
        startRects,
        order,
        currentOrder: order,
        currentOrderKey: order.join(","),
        baseCum: cumHeightBefore(order, id, startRects),
      };
      setLiftedId(id);
      const el = rowElsRef.current.get(id);
      if (el) {
        el.style.transition = "none";
        el.style.zIndex = "10";
        el.style.boxShadow = "0 10px 22px -10px rgba(0,0,0,0.35)";
      }
    },
    []
  );

  const moveDrag = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const el = rowElsRef.current.get(drag.id);
    if (!el) return;
    const startRect = drag.startRects.get(drag.id);
    if (!startRect) return;
    const deltaY = e.clientY - drag.startClientY;
    const draggedCenter = startRect.top + startRect.height / 2 + deltaY;
    const others = drag.order.filter((x) => x !== drag.id);
    let targetIndex = others.length;
    for (let i = 0; i < others.length; i++) {
      const r = drag.startRects.get(others[i]);
      if (!r) continue;
      if (draggedCenter < r.top + r.height / 2) {
        targetIndex = i;
        break;
      }
    }
    const newOrder = [...others.slice(0, targetIndex), drag.id, ...others.slice(targetIndex)];
    const key = newOrder.join(",");
    if (key !== drag.currentOrderKey) {
      drag.currentOrderKey = key;
      drag.currentOrder = newOrder;
      const prevRects = captureRects(drag.id);
      pendingFlipRef.current = { prevRects, skip: drag.id };
      setStack((prev) => {
        const byId = new Map(prev.map((s) => [s.id, s]));
        return newOrder.map((oid) => byId.get(oid)!).filter(Boolean);
      });
    }

    // the dragged row's own natural (untransformed) top shifts by however
    // much it has swapped past its neighbors so far — cancel that drift out
    // so the row keeps tracking the pointer 1:1 instead of jumping by the
    // swapped neighbor's height every time the order commits.
    const drift = cumHeightBefore(drag.currentOrder, drag.id, drag.startRects) - drag.baseCum;
    el.style.transform = `translateY(${deltaY - drift}px)`;
  }, [captureRects]);

  const endDrag = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    const el = rowElsRef.current.get(drag.id);
    if (el) {
      el.style.transition = reducedRef.current ? "none" : `transform ${FLIP_MS}ms ${FLIP_EASE}, box-shadow 200ms ease-out`;
      el.style.transform = "";
      el.style.boxShadow = "";
      el.style.zIndex = "";
    }
    setLiftedId(null);
    announceMove(drag.id, stackRef.current);
  }, [announceMove]);

  // -------------------------------------------------------------------------
  // insert from tray — the signature over-budget moment
  // -------------------------------------------------------------------------
  const clearRejection = useCallback(() => {
    setRejection(null);
    if (suggestTimerRef.current) {
      window.clearTimeout(suggestTimerRef.current);
      suggestTimerRef.current = null;
    }
  }, []);

  const attemptInsert = useCallback(
    (candidateId: string) => {
      const candidate = tray.find((c) => c.id === candidateId);
      if (!candidate) return;
      const currentUsed = stackRef.current.reduce((s, x) => s + x.tokens, 0);
      const fits = currentUsed + candidate.tokens <= budget;

      if (fits) {
        clearRejection();
        const prevRects = captureRects();
        // retrieved docs land just ahead of the final turn, not tacked on
        // at the very end of the prompt
        const insertAt = Math.max(0, stackRef.current.length - 1);
        const next = stackRef.current.slice();
        next.splice(insertAt, 0, candidate);
        pendingFlipRef.current = { prevRects };
        pendingEnterRef.current = candidate.id;
        setStack(next);
        setTray((prev) => prev.filter((c) => c.id !== candidateId));
        setAnnounce(
          `${candidate.label.toLowerCase()} added, position ${insertAt + 1} of ${next.length}, ${fmt(
            candidate.tokens
          )} tokens, ${fmt(budget - (currentUsed + candidate.tokens))} remaining`
        );
        return;
      }

      const overBy = currentUsed + candidate.tokens - budget;
      const truncatables = stackRef.current.filter((s) => s.truncatable);
      const suggestion = truncatables.length
        ? truncatables.reduce((a, b) => (b.tokens > a.tokens ? b : a))
        : null;

      setRejection({
        attemptedLabel: candidate.label,
        attemptedTokens: candidate.tokens,
        overBy,
        suggestFor: suggestion?.id ?? null,
      });
      setAlertMsg(
        suggestion
          ? `Doesn't fit: ${candidate.label} needs ${fmt(overBy)} more tokens than the ${fmt(
              remaining
            )} free. Thin ${suggestion.label} to make room.`
          : `Doesn't fit: ${candidate.label} needs ${fmt(overBy)} more tokens than the ${fmt(remaining)} free.`
      );
      if (suggestTimerRef.current) window.clearTimeout(suggestTimerRef.current);
      suggestTimerRef.current = window.setTimeout(clearRejection, SUGGEST_DISMISS_MS);

      if (!reducedRef.current) {
        setCompressed(true);
        if (compressTimerRef.current) window.clearTimeout(compressTimerRef.current);
        compressTimerRef.current = window.setTimeout(() => setCompressed(false), COMPRESS_MS);

        setBounceTrayId(candidateId);
        if (bounceTimerRef.current) window.clearTimeout(bounceTimerRef.current);
        bounceTimerRef.current = window.setTimeout(() => setBounceTrayId(null), 420);

        if (suggestion) {
          setPulseId(suggestion.id);
          if (pulseTimerRef.current) window.clearTimeout(pulseTimerRef.current);
          pulseTimerRef.current = window.setTimeout(() => setPulseId(null), PULSE_MS);
        }
      }
    },
    [tray, budget, remaining, captureRects, clearRejection]
  );

  const trimSection = useCallback(
    (id: string, newTokens: number) => {
      setStack((prev) =>
        prev.map((s) => {
          if (s.id !== id) return s;
          const floor = s.minTokens ?? Math.round(s.tokens * 0.3);
          return { ...s, tokens: Math.max(floor, Math.round(newTokens)) };
        })
      );
    },
    []
  );

  const trimToFit = useCallback(
    (r: Rejection) => {
      const target = stackRef.current.find((s) => s.id === r.suggestFor);
      if (!target) return;
      const floor = target.minTokens ?? Math.round(target.tokens * 0.3);
      const wanted = target.tokens - r.overBy;
      const nextTokens = Math.max(floor, wanted);
      trimSection(target.id, nextTokens);
      setAnnounce(`${target.label.toLowerCase()} trimmed to ${fmt(nextTokens)} tokens`);
      clearRejection();
    },
    [trimSection, clearRejection]
  );

  const trimThird = useCallback(
    (r: Rejection) => {
      const target = stackRef.current.find((s) => s.id === r.suggestFor);
      if (!target) return;
      const nextTokens = target.tokens * 0.7;
      const floor = target.minTokens ?? Math.round(target.tokens * 0.3);
      trimSection(target.id, Math.max(floor, nextTokens));
      setAnnounce(`${target.label.toLowerCase()} trimmed by 30%`);
      clearRejection();
    },
    [trimSection, clearRejection]
  );

  const suggestSection = rejection ? stack.find((s) => s.id === rejection.suggestFor) ?? null : null;

  return (
    <div className={`flex flex-col gap-4 font-sans ${className}`}>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <p className="sr-only" role="alert">
        {alertMsg}
      </p>

      <div className="flex items-baseline justify-between font-mono text-[11px] text-ns-muted">
        <span>budget {fmt(budget)} tok</span>
        <span className={remaining < 0 ? "text-foreground font-semibold" : ""}>
          {fmt(Math.max(0, remaining))} tok free
        </span>
      </div>

      <div className="overflow-hidden rounded-md border border-border" style={{ height: frameHeight }}>
        {/* clearance: the genuinely empty part of the gap, drawn as real space */}
        <div
          aria-hidden
          className="flex items-start justify-center border-b border-dashed border-border/70"
          style={{ height: clearance }}
        >
          {clearance > 22 ? (
            <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-ns-muted/70">
              clearance
            </span>
          ) : null}
        </div>

        <div
          role="listbox"
          id={listboxId}
          aria-label={ariaLabel}
          aria-orientation="vertical"
          className="flex flex-col transition-transform"
          style={{
            transformOrigin: "bottom",
            transform: compressed ? "scaleY(0.98)" : "scaleY(1)",
            transitionDuration: compressed ? `${COMPRESS_MS}ms` : "160ms",
            transitionTimingFunction: FLIP_EASE,
          }}
        >
          {stack.map((s) => {
            const h = rowHeight(s.tokens);
            const hairline = h < HAIRLINE_PX;
            const isLifted = liftedId === s.id;
            const isPulsing = pulseId === s.id;
            return (
              <div
                key={s.id}
                ref={(el) => registerRow(s.id, el)}
                role="option"
                aria-roledescription="prompt section"
                aria-selected={isLifted}
                tabIndex={activeId === s.id ? 0 : -1}
                onFocus={() => setActiveId(s.id)}
                onKeyDown={(e) => handleRowKeyDown(e, s.id)}
                data-shim-row
                className={`relative flex items-center gap-2 border-t bg-ns-muted/8 px-2 outline-none transition-colors hover:bg-ns-muted/16 focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-inset ${
                  isLifted ? "border-t-ns-accent bg-ns-accent/5" : isPulsing ? "border-t-foreground" : "border-t-border"
                } ${isPulsing && !reduced ? "context-prompt-shims-pulse" : ""}`}
                style={{ height: h }}
              >
                <div
                  aria-hidden="true"
                  className="flex shrink-0 cursor-grab touch-none items-center justify-center self-stretch overflow-hidden px-0.5 text-ns-muted/60 active:cursor-grabbing"
                  style={hairline ? { transform: `scale(${Math.min(1, Math.max(0.5, h / 14))})` } : undefined}
                  onPointerDown={(e) => beginDrag(s.id, e)}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                >
                  <GripIcon />
                </div>
                <span className={`min-w-0 flex-1 truncate text-foreground ${hairline ? "text-[10px]" : "text-xs"}`}>
                  {s.label}
                </span>
                <span
                  className={`shrink-0 font-mono tabular-nums text-ns-muted ${hairline ? "text-[9px]" : "text-[10px]"}`}
                >
                  {fmt(s.tokens)}
                </span>
                {reduced && rejection?.suggestFor === s.id ? (
                  <span
                    aria-hidden
                    className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-foreground"
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {rejection ? (
        <div
          role="group"
          aria-label="Truncation suggestion"
          data-shim-suggestion
          className="flex flex-wrap items-center gap-2 rounded-md border border-foreground/25 bg-surface px-3 py-2"
        >
          <p className="flex-1 text-xs leading-snug text-foreground">
            <strong>{rejection.attemptedLabel}</strong> needs {fmt(rejection.overBy)} more tokens than fits.
            {suggestSection ? (
              <>
                {" "}
                Thin <strong>{suggestSection.label}</strong>?
              </>
            ) : null}
          </p>
          {suggestSection ? (
            <>
              <button
                type="button"
                onClick={() => trimToFit(rejection)}
                className="rounded-sm px-2 py-1 text-[11px] font-medium text-foreground outline-none transition-colors hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ns-accent"
              >
                Trim to fit
              </button>
              <button
                type="button"
                onClick={() => trimThird(rejection)}
                className="rounded-sm px-2 py-1 text-[11px] text-ns-muted outline-none transition-colors hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ns-accent"
              >
                Trim 30%
              </button>
            </>
          ) : null}
          <button
            type="button"
            aria-label="Dismiss suggestion"
            onClick={clearRejection}
            className="rounded-sm p-1 text-ns-muted outline-none transition-colors hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ns-accent"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : null}

      {tray.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ns-muted">Tray</span>
          <div className="flex flex-col gap-1.5">
            {tray.map((c) => {
              const bouncing = bounceTrayId === c.id && !reduced;
              const overflows = totalUsed + c.tokens > budget;
              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-2 rounded-sm border border-border bg-background px-2.5 py-1.5 transition-transform ${
                    bouncing ? "context-prompt-shims-bounce" : ""
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate text-xs text-foreground">{c.label}</span>
                  <span className="shrink-0 font-mono text-[10px] tabular-nums text-ns-muted">{fmt(c.tokens)}</span>
                  <button
                    type="button"
                    data-shim-insert
                    data-shim-insert-id={c.id}
                    {...(overflows ? { "data-shim-insert-oversized": "" } : {})}
                    onClick={() => attemptInsert(c.id)}
                    aria-label={`Insert ${c.label} (${fmt(c.tokens)} tokens)`}
                    className="shrink-0 rounded-sm border border-border px-2 py-1 text-[11px] font-medium text-foreground outline-none transition-colors hover:border-ns-accent hover:text-ns-accent focus-visible:ring-2 focus-visible:ring-ns-accent"
                  >
                    Insert
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <style>{`
        @keyframes context-prompt-shims-pulse-kf {
          0% { border-top-color: var(--border); }
          30% { border-top-color: var(--foreground); }
          100% { border-top-color: var(--border); }
        }
        .context-prompt-shims-pulse { animation: context-prompt-shims-pulse-kf ${PULSE_MS}ms ease-out 1; }
        @keyframes context-prompt-shims-bounce-kf {
          0% { transform: translateY(0) scale(1); }
          30% { transform: translateY(-6px) scale(1.02); }
          60% { transform: translateY(2px) scale(0.99); }
          100% { transform: translateY(0) scale(1); }
        }
        .context-prompt-shims-bounce { animation: context-prompt-shims-bounce-kf 420ms ${FLIP_EASE} 1; }
        @media (prefers-reduced-motion: reduce) {
          .context-prompt-shims-pulse, .context-prompt-shims-bounce { animation: none; }
        }
      `}</style>
    </div>
  );
}
