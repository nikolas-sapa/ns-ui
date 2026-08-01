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
// BowWake — drag-to-reorder where the dragged row pushes a continuous falloff
// field through its neighbors instead of snapping them onto a hard placeholder
// line. Every other row's transform is a function of its distance to the
// dragged card's live center: translateY reflows it into the slot the card
// would land in, translateX shoulders it up to 10px sideways (smoothstep
// falloff over 1.5 row heights) so the gap it will drop into visibly reads as
// the widest point of the wake before the card ever arrives. The dragged card
// gets a 1.01 scale and a velocity-deepened shadow; on release the wake
// collapses inward first (neighbors are already converging on their slots)
// and the card itself settles last, on a short hold, into one underdamped
// spring with a single overshoot. Positions are refs-only, written per-frame
// on a direct-DOM rAF loop that sleeps once every row is at rest — no canvas,
// DOM + CSS transforms only. Distinct from flock-stack: nothing here trails a
// leader, every neighbor reacts independently to a field around one dragged
// card. Full keyboard reorder ships alongside: a grip button arms discrete
// mode (aria-pressed), arrow keys step the row through the same slots with a
// position announcement, and Escape restores the pre-pickup order. Reduced
// motion turns the field off entirely: rows reflow instantly and a plain
// dashed placeholder marks the drop slot instead.
// ---------------------------------------------------------------------------

export interface BowWakeItem {
  id: string;
  label: string;
  subtitle?: string;
}

export interface BowWakeProps {
  items: BowWakeItem[];
  /** fires whenever the committed order changes — drag drop or a keyboard step */
  onReorder?: (items: BowWakeItem[]) => void;
  className?: string;
  "aria-label"?: string;
}

const ROW_H = 56;
const ROW_GAP = 8;
const STEP = ROW_H + ROW_GAP;
const WAKE_X = 10; // px, max lateral shoulder
const WAKE_RADIUS = STEP * 1.5; // smoothstep falloff distance
const DRAG_THRESHOLD = 4; // px of travel before a pointerdown becomes a live drag
const NEIGHBOR_K = 220;
const NEIGHBOR_C = 2 * 0.92 * Math.sqrt(NEIGHBOR_K); // near-critical, no overshoot
const SETTLE_K = 170;
const SETTLE_C = 2 * 0.58 * Math.sqrt(SETTLE_K); // underdamped — one overshoot
const SETTLE_HOLD_MS = 90; // wake collapses before the dragged card starts settling
const REST_EPS = 0.3;
const REST_VEPS = 2;

function smoothstep(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function buildLiveOrder(base: string[], dragId: string, insertionIndex: number): string[] {
  const rest = base.filter((id) => id !== dragId);
  const clamped = Math.min(rest.length, Math.max(0, insertionIndex));
  rest.splice(clamped, 0, dragId);
  return rest;
}

type Phys = { x: number; y: number; vx: number; vy: number; scale: number };

type DragState = {
  id: string;
  pointerId: number;
  grabOffsetY: number;
  startClientY: number;
  active: boolean;
  baseOrder: string[];
  topY: number;
  insertionIndex: number;
  lastY: number;
  lastT: number;
  vY: number;
};

type SettleState = { startAt: number; targetSlot: number };

function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <circle cx="9" cy="6" r="1.6" />
      <circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" />
      <circle cx="15" cy="18" r="1.6" />
    </svg>
  );
}

export function BowWake({
  items,
  onReorder,
  className = "",
  "aria-label": ariaLabel = "Reorderable list",
}: BowWakeProps) {
  const itemsById = useMemo(() => {
    const m = new Map<string, BowWakeItem>();
    for (const it of items) m.set(it.id, it);
    return m;
  }, [items]);

  const [order, setOrder] = useState<string[]>(() => items.map((i) => i.id));
  const [armedId, setArmedId] = useState<string | null>(null);
  const [liveMsg, setLiveMsg] = useState("");
  const [reduced, setReduced] = useState(false);

  const orderRef = useRef(order);
  orderRef.current = order;
  const armedIdRef = useRef<string | null>(null);
  armedIdRef.current = armedId;
  const reducedRef = useRef(false);
  reducedRef.current = reduced;
  const pickupOrderRef = useRef<string[] | null>(null);
  const firstReorder = useRef(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const placeholderRef = useRef<HTMLDivElement>(null);
  const physRef = useRef<Map<string, Phys>>(new Map());
  const dragRef = useRef<DragState | null>(null);
  const settleRef = useRef<Map<string, SettleState>>(new Map());
  const suppressClickRef = useRef(false);
  const rafRef = useRef(0);
  const lastFrameRef = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // announce committed reorders (drag drop or keyboard step), never on mount
  useEffect(() => {
    if (firstReorder.current) {
      firstReorder.current = false;
      return;
    }
    onReorder?.(order.map((id) => itemsById.get(id)).filter((x): x is BowWakeItem => !!x));
  }, [order, itemsById, onReorder]);

  const writeTransform = useCallback((id: string, p: Phys) => {
    const el = rowRefs.current.get(id);
    if (!el) return;
    el.style.transform = `translate3d(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px, 0) scale(${p.scale.toFixed(3)})`;
  }, []);

  const ensureLoop = useCallback(() => {
    if (rafRef.current) return;
    lastFrameRef.current = 0;
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  // Seed physics for ids that don't have a record yet (mount, or items added)
  // and write their transform synchronously before paint — otherwise every
  // row sits at the browser's default (0,0) for one frame and the whole list
  // reads as a single stacked card until the rAF loop happens to run.
  useLayoutEffect(() => {
    const phys = physRef.current;
    order.forEach((id, i) => {
      let p = phys.get(id);
      if (!p) {
        p = { x: 0, y: i * STEP, vx: 0, vy: 0, scale: 1 };
        phys.set(id, p);
      }
      writeTransform(id, p);
    });
    for (const id of Array.from(phys.keys())) {
      if (!itemsById.has(id)) phys.delete(id);
    }
    ensureLoop();
  }, [order, itemsById, writeTransform, ensureLoop]);

  // dragged-row-only visuals (lift shadow, stacking order) reset the moment
  // a drag ends, whichever way it ends — the settle spring below only owns x/y
  const resetDragVisual = useCallback((id: string) => {
    const el = rowRefs.current.get(id);
    if (!el) return;
    el.style.zIndex = "10";
    el.style.setProperty("--bw-lift", "0.35");
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- loop reads refs, deps stable across renders
  function loop(now: number) {
    rafRef.current = 0;
    const dt = lastFrameRef.current ? Math.min(0.032, (now - lastFrameRef.current) / 1000) : 1 / 60;
    lastFrameRef.current = now;

    const ord = orderRef.current;
    const drag = dragRef.current;
    const phys = physRef.current;
    let settled = true;

    const liveOrder = drag && drag.active ? buildLiveOrder(drag.baseOrder, drag.id, drag.insertionIndex) : null;

    if (drag && drag.active) {
      const p = phys.get(drag.id);
      if (p) {
        p.x = 0;
        p.y = drag.topY;
        p.vx = 0;
        p.vy = 0;
        const shadowLift = Math.min(1, Math.abs(drag.vY) / 900);
        const el = rowRefs.current.get(drag.id);
        if (el) {
          el.style.setProperty("--bw-lift", (0.35 + shadowLift * 0.65).toFixed(2));
          el.style.zIndex = "30";
        }
        if (!reducedRef.current) {
          p.scale += (1.01 - p.scale) * Math.min(1, 16 * dt);
        } else {
          p.scale = 1;
        }
        writeTransform(drag.id, p);
      }
      settled = false;

      const ph = placeholderRef.current;
      if (ph && reducedRef.current) {
        ph.style.display = "block";
        ph.style.transform = `translate3d(0, ${(drag.insertionIndex * STEP).toFixed(2)}px, 0)`;
      } else if (ph) {
        ph.style.display = "none";
      }
    } else {
      const ph = placeholderRef.current;
      if (ph) ph.style.display = "none";
    }

    for (const id of ord) {
      if (drag && drag.active && id === drag.id) continue;
      const p = phys.get(id);
      if (!p) continue;

      let targetX = 0;
      let targetY: number;

      if (liveOrder && drag) {
        const slot = liveOrder.indexOf(id);
        targetY = slot * STEP;
        const dist = Math.abs(p.y - drag.topY);
        const falloff = reducedRef.current ? 0 : smoothstep(1 - dist / WAKE_RADIUS);
        const sign = p.y < drag.topY ? -1 : 1;
        targetX = sign * WAKE_X * falloff;
      } else {
        targetY = ord.indexOf(id) * STEP;
      }

      const settle = !drag ? settleRef.current.get(id) : undefined;
      if (settle) {
        if (now < settle.startAt) {
          p.vx = 0;
          p.vy = 0;
          settled = false;
        } else {
          const targetSlotY = settle.targetSlot * STEP;
          if (reducedRef.current) {
            p.x = 0;
            p.y = targetSlotY;
            p.vx = 0;
            p.vy = 0;
            p.scale = 1;
            settleRef.current.delete(id);
          } else {
            const ax = -SETTLE_K * (p.x - 0) - SETTLE_C * p.vx;
            const ay = -SETTLE_K * (p.y - targetSlotY) - SETTLE_C * p.vy;
            p.vx += ax * dt;
            p.vy += ay * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.scale += (1 - p.scale) * Math.min(1, 10 * dt);
            if (Math.abs(p.x) < REST_EPS && Math.abs(p.y - targetSlotY) < REST_EPS && Math.abs(p.vx) < REST_VEPS && Math.abs(p.vy) < REST_VEPS) {
              p.x = 0;
              p.y = targetSlotY;
              p.vx = 0;
              p.vy = 0;
              p.scale = 1;
              settleRef.current.delete(id);
            } else {
              settled = false;
            }
          }
        }
        writeTransform(id, p);
        continue;
      }

      if (reducedRef.current) {
        p.x = 0;
        p.y = targetY;
        p.vx = 0;
        p.vy = 0;
        p.scale = 1;
      } else {
        const ax = -NEIGHBOR_K * (p.x - targetX) - NEIGHBOR_C * p.vx;
        const ay = -NEIGHBOR_K * (p.y - targetY) - NEIGHBOR_C * p.vy;
        p.vx += ax * dt;
        p.vy += ay * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.scale += (1 - p.scale) * Math.min(1, 12 * dt);
        if (Math.abs(p.x - targetX) > REST_EPS || Math.abs(p.y - targetY) > REST_EPS || Math.abs(p.vx) > REST_VEPS || Math.abs(p.vy) > REST_VEPS) {
          settled = false;
        }
      }
      const el = rowRefs.current.get(id);
      if (el) el.style.zIndex = "10";
      writeTransform(id, p);
    }

    if (!settled || (drag && drag.active)) {
      rafRef.current = requestAnimationFrame(loop);
    }
  }

  const beginDrag = useCallback(
    (id: string, e: ReactPointerEvent<HTMLButtonElement>) => {
      if (armedIdRef.current) return; // no live drag while another row is keyboard-armed
      const container = containerRef.current;
      const row = rowRefs.current.get(id);
      if (!container || !row) return;
      const rowTop = row.getBoundingClientRect().top;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        id,
        pointerId: e.pointerId,
        grabOffsetY: e.clientY - rowTop,
        startClientY: e.clientY,
        active: false,
        baseOrder: orderRef.current.slice(),
        topY: rowTop - container.getBoundingClientRect().top,
        insertionIndex: orderRef.current.indexOf(id),
        lastY: 0,
        lastT: 0,
        vY: 0,
      };
    },
    []
  );

  const moveDrag = useCallback(
    (id: string, e: ReactPointerEvent<HTMLButtonElement>) => {
      const d = dragRef.current;
      if (!d || d.id !== id || d.pointerId !== e.pointerId) return;
      const container = containerRef.current;
      if (!container) return;

      if (!d.active && Math.abs(e.clientY - d.startClientY) > DRAG_THRESHOLD) {
        d.active = true;
        suppressClickRef.current = true;
        ensureLoop();
      }
      if (!d.active) return;

      const n = d.baseOrder.length;
      const maxTop = Math.max(0, (n - 1) * STEP);
      const containerTop = container.getBoundingClientRect().top;
      const rawTop = e.clientY - containerTop - d.grabOffsetY;
      d.topY = Math.min(maxTop, Math.max(0, rawTop));
      d.insertionIndex = Math.min(n - 1, Math.max(0, Math.round(d.topY / STEP)));

      const now = performance.now();
      if (d.lastT) {
        const dt = (now - d.lastT) / 1000;
        if (dt > 0.001) d.vY = (d.topY - d.lastY) / dt;
      }
      d.lastY = d.topY;
      d.lastT = now;
      ensureLoop();
    },
    [ensureLoop]
  );

  const endDrag = useCallback(
    (id: string, e: ReactPointerEvent<HTMLButtonElement>, cancelled: boolean) => {
      const d = dragRef.current;
      if (!d || d.id !== id || d.pointerId !== e.pointerId) return;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      dragRef.current = null;

      if (!d.active) return; // it was a click-length press; the click handler arms it
      resetDragVisual(id);

      if (cancelled) {
        settleRef.current.set(id, { startAt: 0, targetSlot: d.baseOrder.indexOf(id) });
        ensureLoop();
        return;
      }

      const finalOrder = buildLiveOrder(d.baseOrder, id, d.insertionIndex);
      settleRef.current.set(id, { startAt: performance.now() + SETTLE_HOLD_MS, targetSlot: finalOrder.indexOf(id) });
      setOrder(finalOrder);
      ensureLoop();
    },
    [ensureLoop, resetDragVisual]
  );

  const armOrDrop = useCallback(
    (id: string) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return;
      }
      if (armedIdRef.current && armedIdRef.current !== id) return; // another row already armed

      if (armedIdRef.current === id) {
        const idx = orderRef.current.indexOf(id);
        setLiveMsg(`Dropped. ${itemsById.get(id)?.label ?? ""}, now at position ${idx + 1} of ${orderRef.current.length}.`);
        setArmedId(null);
        pickupOrderRef.current = null;
      } else {
        pickupOrderRef.current = orderRef.current.slice();
        setArmedId(id);
        const idx = orderRef.current.indexOf(id);
        setLiveMsg(
          `Grabbed ${itemsById.get(id)?.label ?? ""}. Now at position ${idx + 1} of ${orderRef.current.length}. Use arrow keys to move, space to drop, escape to cancel.`
        );
      }
    },
    [itemsById]
  );

  const onHandleKeyDown = useCallback(
    (id: string, e: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (armedIdRef.current !== id) return;
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      const cur = orderRef.current;
      const idx = cur.indexOf(id);
      const swapWith = e.key === "ArrowUp" ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= cur.length) return;
      const next = cur.slice();
      next[idx] = cur[swapWith];
      next[swapWith] = cur[idx];
      setOrder(next);
      settleRef.current.set(id, { startAt: 0, targetSlot: swapWith });
      const otherId = cur[swapWith];
      settleRef.current.set(otherId, { startAt: 0, targetSlot: idx });
      setLiveMsg(`${itemsById.get(id)?.label ?? ""}, now at position ${swapWith + 1} of ${cur.length}.`);
      ensureLoop();
    },
    [ensureLoop, itemsById]
  );

  // Escape: cancel a live pointer drag, or restore the pre-pickup order while
  // keyboard-armed. Deliberately global (not scoped to focus) — the operation
  // is "in flight" regardless of where focus lands in between.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      const d = dragRef.current;
      if (d) {
        if (d.active) {
          resetDragVisual(d.id);
          settleRef.current.set(d.id, { startAt: 0, targetSlot: d.baseOrder.indexOf(d.id) });
          ensureLoop();
        }
        dragRef.current = null;
        return;
      }
      const armed = armedIdRef.current;
      if (!armed) return;
      const restore = pickupOrderRef.current;
      if (restore) setOrder(restore);
      const idx = restore ? restore.indexOf(armed) : 0;
      setLiveMsg(`Reorder cancelled. ${itemsById.get(armed)?.label ?? ""} restored to position ${idx + 1} of ${restore?.length ?? 0}.`);
      setArmedId(null);
      pickupOrderRef.current = null;
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [itemsById, ensureLoop, resetDragVisual]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const containerHeight = Math.max(ROW_H, order.length * STEP - ROW_GAP);

  return (
    <div
      className={`relative ${className}`}
      role="list"
      aria-label={ariaLabel}
      style={{ height: containerHeight }}
      ref={containerRef}
    >
      <div aria-live="polite" role="status" className="sr-only">
        {liveMsg}
      </div>

      <div
        ref={placeholderRef}
        aria-hidden="true"
        style={{ display: "none", height: ROW_H }}
        className="pointer-events-none absolute inset-x-0 top-0 rounded-md border border-dashed border-border/70"
      />

      {order.map((id, rowIdx) => {
        const item = itemsById.get(id);
        if (!item) return null;
        const pos = order.indexOf(id) + 1;
        const isArmed = armedId === id;
        return (
          <div
            key={id}
            ref={(el) => {
              if (el) rowRefs.current.set(id, el);
              else rowRefs.current.delete(id);
            }}
            role="listitem"
            className="absolute inset-x-0 top-0 will-change-transform"
            style={{ height: ROW_H, "--bw-lift": 0.35 } as React.CSSProperties}
          >
            <div
              className={`flex h-full items-center gap-3 rounded-md border bg-surface px-3 transition-colors duration-150 ${
                isArmed ? "border-accent" : "border-border hover:border-foreground/20"
              }`}
              style={{
                boxShadow: `0 calc(6px + 10px * var(--bw-lift)) calc(16px + 10px * var(--bw-lift)) calc(-8px - 2px * var(--bw-lift)) rgba(0,0,0,calc(0.22 + 0.18 * var(--bw-lift)))`,
              }}
            >
              <button
                type="button"
                data-bow-handle
                data-bow-row={rowIdx}
                aria-pressed={isArmed}
                aria-label={`${isArmed ? "Grabbed. " : ""}Reorder ${item.label}. Position ${pos} of ${order.length}.`}
                onPointerDown={(e) => beginDrag(id, e)}
                onPointerMove={(e) => moveDrag(id, e)}
                onPointerUp={(e) => endDrag(id, e, false)}
                onPointerCancel={(e) => endDrag(id, e, true)}
                onClick={() => armOrDrop(id)}
                onKeyDown={(e) => onHandleKeyDown(id, e)}
                className={`flex shrink-0 cursor-grab touch-none select-none items-center justify-center rounded-sm p-1.5 text-muted transition-colors duration-150 hover:bg-foreground/10 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:cursor-grabbing ${
                  isArmed ? "bg-accent/10 text-accent" : ""
                }`}
              >
                <GripIcon />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{item.label}</p>
                {item.subtitle ? (
                  <p className="truncate font-mono text-xs text-muted">{item.subtitle}</p>
                ) : null}
              </div>
              <span className="shrink-0 rounded-full border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted">
                {pos}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
