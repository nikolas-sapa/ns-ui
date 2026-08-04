"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// WipBoard — a kanban board whose column frames are real box-drawing glyphs.
// Each column header reads `┌─ In Progress ───── 3/3 ─┐`; when the card count
// exceeds the limit the counter gains a `▲1` suffix and the whole frame
// switches from the resting muted ink to the accent token. Dragging a card
// renders a ╌╌╌╌ placeholder at the live insertion point and drives the TARGET
// column's counter with the PREDICTED count while the card is still in the air.
// Over-limit drops are allowed: a WIP limit is a policy signal, not a lock, and
// `onOverLimit` lets the consumer decide. Plain React state, no rAF loop and no
// canvas; the only motion is a 120ms FLIP transform on card reflow, skipped
// entirely under prefers-reduced-motion.
// ---------------------------------------------------------------------------

export interface WipCard {
  id: string;
  /** short issue key rendered at the head of the row, e.g. "ATL-214" */
  ref?: string;
  title: string;
  /** right-aligned trailing note: assignee, age, review count */
  meta?: string;
}

export interface WipColumn {
  id: string;
  title: string;
  /** the column's WIP limit — the denominator of the header counter */
  limit: number;
  cards: WipCard[];
}

export interface WipBoardProps {
  columns: WipColumn[];
  /** column width in monospace character cells (the frame tiles to exactly this) */
  width?: number;
  /** fires on every committed move, pointer or keyboard */
  onChange?: (columns: WipColumn[]) => void;
  /** fires per commit for the receiving column: `over` is count - limit, 0 when within policy */
  onOverLimit?: (columnId: string, over: number) => void;
  className?: string;
  "aria-label"?: string;
}

const DRAG_THRESHOLD = 4; // px of travel before a pointerdown becomes a live drag
const REFLOW_MS = 120;
const DASH = "╌";
// the resting frame ink. NOT `text-border` — --border is tuned for 1px
// hairlines and is invisible as type on the light theme (#ebebeb on #ffffff),
// which would leave the box-drawing frame — the whole point of the component —
// blank at rest. A muted tint reads in both themes and still sits below the
// card text in the hierarchy.
const FRAME_INK = "text-muted/55";

/** `┌─ In Progress ───────── 3/3 ─┐` — exactly `width` characters wide. */
function headerLine(title: string, count: number, limit: number, width: number) {
  const over = Math.max(0, count - limit);
  const label = over > 0 ? `${count}/${limit} ▲${over}` : `${count}/${limit}`;
  const rule = "─".repeat(Math.max(1, width - 8 - title.length - label.length));
  return `┌─ ${title} ${rule} ${label} ─┐`;
}

function moveCard(
  cols: WipColumn[],
  cardId: string,
  toColId: string,
  toIndex: number
): WipColumn[] {
  let card: WipCard | undefined;
  const stripped = cols.map((c) => {
    const found = c.cards.find((x) => x.id === cardId);
    if (!found) return c;
    card = found;
    return { ...c, cards: c.cards.filter((x) => x.id !== cardId) };
  });
  if (!card) return cols;
  const picked = card;
  return stripped.map((c) => {
    if (c.id !== toColId) return c;
    const i = Math.min(c.cards.length, Math.max(0, toIndex));
    return { ...c, cards: [...c.cards.slice(0, i), picked, ...c.cards.slice(i)] };
  });
}

type Drop = { col: string; index: number };

type DragState = {
  id: string;
  fromCol: string;
  pointerId: number;
  offsetX: number;
  offsetY: number;
  startX: number;
  startY: number;
  active: boolean;
  width: number;
  /** column boxes cached at pickup — recomputing them mid-drag would chase the placeholder */
  colRects: { id: string; left: number; right: number }[];
  /** per-column card mid-Y cached at pickup, in committed order */
  cardMids: Map<string, { id: string; mid: number }[]>;
};

export function WipBoard({
  columns,
  width = 34,
  onChange,
  onOverLimit,
  className = "",
  "aria-label": ariaLabel = "Kanban board with WIP limits",
}: WipBoardProps) {
  const [cols, setCols] = useState<WipColumn[]>(columns);
  const [drop, setDrop] = useState<Drop | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [liveMsg, setLiveMsg] = useState("");

  const colsRef = useRef(cols);
  colsRef.current = cols;
  const dragRef = useRef<DragState | null>(null);
  const dropRef = useRef<Drop | null>(null);
  dropRef.current = drop;

  const boardRef = useRef<HTMLDivElement>(null);
  const colEls = useRef<Map<string, HTMLDivElement>>(new Map());
  const cardEls = useRef<Map<string, HTMLButtonElement>>(new Map());
  const prevRects = useRef<Map<string, DOMRect>>(new Map());
  const focusNext = useRef<string | null>(null);
  const reducedRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      reducedRef.current = mq.matches;
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // FLIP: cards live in normal flow, so a commit is measured before/after and
  // played back as one short transform. Never runs mid-drag (the lifted card is
  // position:fixed and its neighbours have already collapsed) or under
  // reduced motion, where the reflow is simply instant.
  useLayoutEffect(() => {
    const next = new Map<string, DOMRect>();
    cardEls.current.forEach((el, id) => next.set(id, el.getBoundingClientRect()));
    if (!reducedRef.current && !dragRef.current) {
      next.forEach((r, id) => {
        const p = prevRects.current.get(id);
        const el = cardEls.current.get(id);
        if (!p || !el) return;
        const dx = p.left - r.left;
        const dy = p.top - r.top;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
        el.style.transition = "none";
        el.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;
        requestAnimationFrame(() => {
          if (!el.isConnected) return;
          el.style.transition = `transform ${REFLOW_MS}ms cubic-bezier(0.2, 0, 0, 1)`;
          el.style.transform = "";
        });
      });
    }
    prevRects.current = next;
  });

  useEffect(() => {
    const id = focusNext.current;
    if (!id) return;
    focusNext.current = null;
    cardEls.current.get(id)?.focus();
  }, [cols]);

  const announce = useCallback(
    (card: WipCard, next: WipColumn[], toColId: string) => {
      const col = next.find((c) => c.id === toColId);
      if (!col) return;
      const count = col.cards.length;
      const over = Math.max(0, count - col.limit);
      setLiveMsg(
        `Moved ${card.title} to ${col.title}. ${count} of ${col.limit}` +
          (over > 0 ? `, over limit by ${over}.` : ", within limit.")
      );
      onOverLimit?.(col.id, over);
    },
    [onOverLimit]
  );

  const commit = useCallback(
    (cardId: string, toColId: string, toIndex: number, refocus: boolean) => {
      const prev = colsRef.current;
      const card = prev.flatMap((c) => c.cards).find((x) => x.id === cardId);
      const next = moveCard(prev, cardId, toColId, toIndex);
      setCols(next);
      onChange?.(next);
      if (card) announce(card, next, toColId);
      if (refocus) focusNext.current = cardId;
    },
    [announce, onChange]
  );

  const liftEnd = useCallback((id: string) => {
    const el = cardEls.current.get(id);
    if (!el) return;
    el.style.position = "";
    el.style.left = "";
    el.style.top = "";
    el.style.width = "";
    el.style.zIndex = "";
    el.style.transition = "";
    el.style.transform = "";
  }, []);

  // Move/up live on the document, not on the card. A real pointer would be
  // retargeted to the card by its own pointer capture, but the preview driver
  // dispatches synthetic events to whatever it hit-tests under the cursor — so
  // a card-scoped handler goes silent the moment the pointer crosses into
  // another column. Document listeners receive both, and the drag survives.
  const moveHandler = useRef<((e: PointerEvent) => void) | null>(null);
  const upHandler = useRef<((e: PointerEvent) => void) | null>(null);

  const detach = useCallback(() => {
    if (moveHandler.current) document.removeEventListener("pointermove", moveHandler.current);
    if (upHandler.current) {
      document.removeEventListener("pointerup", upHandler.current);
      document.removeEventListener("pointercancel", upHandler.current);
    }
    moveHandler.current = null;
    upHandler.current = null;
  }, []);

  const cancelDrag = useCallback(() => {
    detach();
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    // Escape ends the drag with no pointerup coming, so the capture the card
    // took on pointerdown has to be handed back explicitly or the card keeps
    // swallowing the pointer stream until the button is physically released.
    const el = cardEls.current.get(d.id);
    if (el?.hasPointerCapture(d.pointerId)) el.releasePointerCapture(d.pointerId);
    if (d.active) liftEnd(d.id);
    setDragId(null);
    setDrop(null);
  }, [detach, liftEnd]);

  const handleMove = useCallback((e: PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const el = cardEls.current.get(d.id);
    if (!el) return;

    if (!d.active) {
      const moved = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
      if (moved <= DRAG_THRESHOLD) return;
      d.active = true;
      el.style.transition = "none";
      el.style.transform = "";
      el.style.position = "fixed";
      el.style.width = `${d.width}px`;
      el.style.zIndex = "30";
      setDragId(d.id);
    }

    el.style.left = `${e.clientX - d.offsetX}px`;
    el.style.top = `${e.clientY - d.offsetY}px`;

    // target column: the box the pointer is inside, else the nearest edge
    let colId = d.colRects[0]?.id ?? d.fromCol;
    let best = Infinity;
    for (const c of d.colRects) {
      const dist = e.clientX < c.left ? c.left - e.clientX : e.clientX > c.right ? e.clientX - c.right : 0;
      if (dist < best) {
        best = dist;
        colId = c.id;
      }
    }
    const mids = (d.cardMids.get(colId) ?? []).filter((m) => m.id !== d.id);
    let index = 0;
    while (index < mids.length && mids[index].mid < e.clientY) index++;

    const cur = dropRef.current;
    if (!cur || cur.col !== colId || cur.index !== index) setDrop({ col: colId, index });
  }, []);

  const handleUp = useCallback(
    (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      detach();
      const card = cardEls.current.get(d.id);
      if (card?.hasPointerCapture(e.pointerId)) card.releasePointerCapture(e.pointerId);
      const target = dropRef.current;
      const wasActive = d.active;
      dragRef.current = null;
      if (wasActive) liftEnd(d.id);
      setDragId(null);
      setDrop(null);
      if (wasActive && target && e.type !== "pointercancel") {
        commit(d.id, target.col, target.index, false);
      }
    },
    [commit, detach, liftEnd]
  );

  const onPointerDown = useCallback(
    (cardId: string, colId: string, e: ReactPointerEvent<HTMLButtonElement>) => {
      const board = boardRef.current;
      if (!board || e.button !== 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      e.currentTarget.setPointerCapture(e.pointerId);

      const colRects = colsRef.current.map((c) => {
        const el = colEls.current.get(c.id);
        const r = el?.getBoundingClientRect();
        return { id: c.id, left: r?.left ?? 0, right: r?.right ?? 0 };
      });
      const cardMids = new Map<string, { id: string; mid: number }[]>();
      for (const c of colsRef.current) {
        cardMids.set(
          c.id,
          c.cards.map((card) => {
            const r = cardEls.current.get(card.id)?.getBoundingClientRect();
            return { id: card.id, mid: r ? r.top + r.height / 2 : 0 };
          })
        );
      }

      dragRef.current = {
        id: cardId,
        fromCol: colId,
        pointerId: e.pointerId,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        startX: e.clientX,
        startY: e.clientY,
        active: false,
        width: rect.width,
        colRects,
        cardMids,
      };

      detach();
      moveHandler.current = handleMove;
      upHandler.current = handleUp;
      document.addEventListener("pointermove", handleMove);
      document.addEventListener("pointerup", handleUp);
      document.addEventListener("pointercancel", handleUp);
    },
    [detach, handleMove, handleUp]
  );

  // a drag can outlive the component (unmount mid-flight); never leave the
  // document listening to a handler whose state is gone
  useEffect(() => detach, [detach]);

  // Escape is a document listener, not a key handler on the card: the drag is
  // in flight regardless of where focus happens to sit.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && dragRef.current) cancelDrag();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [cancelDrag]);

  const onCardKeyDown = useCallback(
    (cardId: string, colId: string, e: ReactKeyboardEvent<HTMLButtonElement>) => {
      const cur = colsRef.current;
      const ci = cur.findIndex((c) => c.id === colId);
      if (ci < 0) return;
      const idx = cur[ci].cards.findIndex((x) => x.id === cardId);
      if (idx < 0) return;

      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const to = ci + (e.key === "ArrowLeft" ? -1 : 1);
        if (to < 0 || to >= cur.length) return;
        e.preventDefault();
        commit(cardId, cur[to].id, Math.min(idx, cur[to].cards.length), true);
        return;
      }
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        const to = idx + (e.key === "ArrowUp" ? -1 : 1);
        if (to < 0 || to >= cur[ci].cards.length) return;
        e.preventDefault();
        commit(cardId, colId, to, true);
      }
    },
    [commit]
  );

  const rowCount = Math.max(1, ...cols.map((c) => c.cards.length)) + 1;
  const blank = `│${" ".repeat(Math.max(0, width - 2))}│`;
  const footer = `└${"─".repeat(Math.max(0, width - 2))}┘`;

  return (
    <div
      ref={boardRef}
      data-board
      role="group"
      aria-label={ariaLabel}
      className={`flex select-none items-start gap-3 font-mono text-xs leading-[1.7] ${className}`}
    >
      <div aria-live="polite" role="status" className="sr-only">
        {liveMsg}
      </div>

      {cols.map((col) => {
        const isSource = dragId != null && col.cards.some((c) => c.id === dragId);
        const isTarget = drop?.col === col.id;
        // the predicted count: the lifted card has already left its source
        // column and is already counted by whichever column it is over
        const count = col.cards.length - (isSource ? 1 : 0) + (isTarget ? 1 : 0);
        const over = Math.max(0, count - col.limit);
        const rows: ReactNode[] = [];
        const placeholder = (
          <div key="ph" className="flex whitespace-pre text-accent">
            <span aria-hidden>│</span>
            <span aria-hidden className="min-w-0 flex-1 overflow-hidden px-1">
              {DASH.repeat(Math.max(0, width - 4))}
            </span>
            <span aria-hidden>│</span>
          </div>
        );
        // `slot` counts only the rows that actually occupy space: the lifted
        // card is position:fixed, so it stays in the DOM (its pointer capture
        // depends on it) but its slot has already collapsed.
        let slot = 0;
        let placed = false;

        col.cards.forEach((card, i) => {
          if (isTarget && drop && !placed && slot === drop.index) {
            rows.push(placeholder);
            placed = true;
          }
          if (card.id !== dragId) slot++;
          rows.push(
            // the lifted card is position:fixed, so its row must stop occupying
            // a line too — otherwise the source column stands one row taller
            // than its neighbours and the footers stop aligning mid-drag.
            // `overflow-hidden` here cannot clip the card: no ancestor is
            // transformed, so a fixed descendant escapes this box.
            <div
              key={card.id}
              className={`flex whitespace-pre ${dragId === card.id ? "h-0 overflow-hidden" : ""}`}
            >
              <span aria-hidden>│</span>
              <button
                type="button"
                ref={(el) => {
                  if (el) cardEls.current.set(card.id, el);
                  else cardEls.current.delete(card.id);
                }}
                data-card={card.id}
                aria-label={`${card.title}${card.ref ? `, ${card.ref}` : ""}. ${col.title}, position ${
                  i + 1
                } of ${col.cards.length}, column at ${col.cards.length} of ${col.limit}. Arrow keys move and reorder.`}
                onPointerDown={(e) => onPointerDown(card.id, col.id, e)}
                onKeyDown={(e) => onCardKeyDown(card.id, col.id, e)}
                className={`flex min-w-0 flex-1 cursor-grab touch-none items-baseline gap-2 rounded-sm px-1 text-left text-muted transition-colors duration-150 hover:bg-surface hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent active:cursor-grabbing ${
                  dragId === card.id ? "bg-surface text-foreground" : ""
                }`}
              >
                {card.ref ? <span className="shrink-0 opacity-60">{card.ref}</span> : null}
                <span className="min-w-0 flex-1 truncate">{card.title}</span>
                {card.meta ? <span className="shrink-0 opacity-60">{card.meta}</span> : null}
              </button>
              <span aria-hidden>│</span>
            </div>
          );
        });

        // insertion past the last card
        if (isTarget && drop && !placed) {
          rows.push(placeholder);
          placed = true;
        }

        const occupied = slot + (placed ? 1 : 0);
        for (let i = occupied; i < rowCount; i++) {
          rows.push(
            <div key={`b${i}`} aria-hidden className="whitespace-pre">
              {blank}
            </div>
          );
        }

        return (
          <div
            key={col.id}
            ref={(el) => {
              if (el) colEls.current.set(col.id, el);
              else colEls.current.delete(col.id);
            }}
            data-column={col.id}
            data-over={over > 0 ? "true" : undefined}
            role="group"
            aria-label={`${col.title}, ${col.cards.length} of ${col.limit}${
              col.cards.length > col.limit ? `, over limit by ${col.cards.length - col.limit}` : ""
            }`}
            style={{ width: `${width}ch` }}
            className={`shrink-0 transition-colors duration-150 ${over > 0 ? "text-accent" : FRAME_INK}`}
          >
            <div className="whitespace-pre" aria-hidden>
              {headerLine(col.title, count, col.limit, width)}
            </div>
            <div aria-hidden className="whitespace-pre">
              {blank}
            </div>
            {rows}
            <div className="whitespace-pre" aria-hidden>
              {footer}
            </div>
          </div>
        );
      })}
    </div>
  );
}
