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
// SiphonLift — bulk transfer between two lists as a siphon, not N drags and
// not an opaque "Move 14 items" button. Multi-select items in the source
// listbox, then drag just ONE of them across into the destination panel.
// That single drag PRIMES the siphon: a thin SVG cubic-bezier tube (1px
// --border stroke) is drawn from the dragged row's edge to the drop point,
// and every other selected item then flows through that same fixed tube on
// its own, one at a time, staggered ~90-100ms, with no further dragging.
// Each transferring item collapses to a small --foreground bead whose
// position is read off the path with real getPointAtLength() every frame
// (not a CSS offset-path animation) so the tube itself IS the live progress
// UI — an onlooker can count beads in flight and see exactly how much is
// left, which a single "Move 14 items" button can never show. The bead's
// easing is ease-in-out-cubic: slow off the source row, fast through the
// middle of the arc, slow into the destination — "ease-in at pickup, ease-
// out at delivery" as one curve. A source row height-collapses (CSS grid-
// template-rows 1fr -> 0fr, ease-out-expo) the instant its bead departs;
// a destination row grows in (a forwards-filled keyframe from 0fr) the
// instant its bead lands.
//
// The flow is interruptible mid-transfer: clicking the small stop control
// riding at the tube's midpoint ("Stop transfer") breaks the seal. The tube
// snaps with a short elastic recoil (a stroke-width/opacity keyframe on the
// path itself), any beads already mid-flight reverse and coast back to the
// source at the same speed they'd traveled, and every item that hadn't yet
// had its turn simply stays put — it never actually left, so there's
// nothing to undo for it. This is deliberately different from a drag-and-
// drop reorder: after the first drag, no further pointer input drives
// anything, and different from a single ballistic fling: this is a
// sustained, cancellable STREAM, not one object's flight.
//
// A11y: the source list is a real listbox (role=listbox
// aria-multiselectable, options carry aria-selected, roving tabindex,
// Arrow/Home/End navigation, Space/Enter toggles). A "Move selected to
// [target]" button starts the identical primed flow without any drag at
// all — the keyboard path is not a lesser version of the mouse path, it's
// the same state machine entered a different way. Progress is announced
// via aria-live=polite, throttled to at most once a second, with the final
// count always delivered regardless of throttle. The stop control is a
// real <button> (focusable, "Stop transfer" accessible name) so cancelling
// mid-flow never requires a pointer. prefers-reduced-motion: beads still
// travel in their scheduled order (so the aria-live narration keeps making
// sense) but with no per-frame animation — each item resolves instantly on
// its turn — and every CSS transition/keyframe here is disabled. No
// canvas: this is DOM (listboxes, rows) + one SVG overlay (path + bead
// circles) + CSS only.
// ---------------------------------------------------------------------------

export interface SiphonItem {
  id: string;
  label: string;
  hint?: string;
}

export interface SiphonLiftProps {
  /** the full pool of items; anything not in defaultDestinationIds starts in the source list */
  items: SiphonItem[];
  /** ids from `items` that start already in the destination list */
  defaultDestinationIds?: string[];
  /** ids from `items` that start pre-selected in the source list */
  defaultSelectedIds?: string[];
  /** accessible name for the source list */
  sourceLabel?: string;
  /** accessible name for the destination list */
  destinationLabel?: string;
  /** fires once, when a flow drains successfully, with the ids that made it across in order */
  onTransfer?: (ids: string[]) => void;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

interface BeadRuntime {
  id: string;
  circle: SVGCircleElement | null;
  phase: "forward" | "reverse";
  startAt: number;
  duration: number;
  fromT?: number;
}

interface FlowEngine {
  length: number;
  queue: string[];
  beads: BeadRuntime[];
  deliveredIds: Set<string>;
  cancelledIds: Set<string>;
  sealed: boolean;
  total: number;
}

interface DragState {
  id: string;
  queue: string[];
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
}

const TRAVEL_MS = 640;
const STAGGER_MS = 100;
const REDUCED_STAGGER_MS = 44;
const LINGER_MS = 480;
const FADE_MS = 260;
const LIVE_THROTTLE_MS = 1000;
const BEAD_R = 4;
const DRAG_THRESHOLD = 6;

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function useReducedMotion() {
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

function buildTubePath(sx: number, sy: number, ex: number, ey: number) {
  const midX = (sx + ex) / 2;
  const bow = Math.min(56, Math.max(20, Math.abs(ex - sx) * 0.12 + 20));
  return `M ${sx.toFixed(1)} ${sy.toFixed(1)} C ${midX.toFixed(1)} ${(sy - bow).toFixed(1)}, ${midX.toFixed(1)} ${(ey - bow).toFixed(1)}, ${ex.toFixed(1)} ${ey.toFixed(1)}`;
}

export function SiphonLift({
  items,
  defaultDestinationIds = [],
  defaultSelectedIds = [],
  sourceLabel = "Available",
  destinationLabel = "Assigned",
  onTransfer,
  className,
}: SiphonLiftProps) {
  const baseId = useId();
  const reducedMotion = useReducedMotion();

  const itemsById = useMemo(() => new Map(items.map((it) => [it.id, it])), [items]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- only used to seed initial state once
  const initial = useMemo(() => {
    const destSet = new Set(defaultDestinationIds);
    return {
      source: items.filter((it) => !destSet.has(it.id)),
      dest: items.filter((it) => destSet.has(it.id)),
    };
  }, []);

  const [sourceItems, setSourceItems] = useState<SiphonItem[]>(initial.source);
  const [destItems, setDestItems] = useState<SiphonItem[]>(initial.dest);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(defaultSelectedIds));
  const [activeId, setActiveId] = useState<string | null>(initial.source[0]?.id ?? null);

  const [departing, setDeparting] = useState<Set<string>>(new Set());
  const [entering, setEntering] = useState<Set<string>>(new Set());

  const [flowActive, setFlowActive] = useState(false);
  const [sealed, setSealed] = useState(false);
  const [recoil, setRecoil] = useState(false);
  const [fading, setFading] = useState(false);
  const [tubeD, setTubeD] = useState<string | null>(null);
  const [stopPos, setStopPos] = useState<{ x: number; y: number } | null>(null);
  const [total, setTotal] = useState(0);
  const [delivered, setDelivered] = useState(0);
  const [liveMessage, setLiveMessage] = useState("");
  const [dragGhost, setDragGhost] = useState<{ x: number; y: number; count: number } | null>(null);
  const [overDestination, setOverDestination] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const sourceListRef = useRef<HTMLUListElement>(null);
  const destPanelRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const rowRefs = useRef<Map<string, HTMLLIElement>>(new Map());

  const engineRef = useRef<FlowEngine | null>(null);
  const engineStartRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastAnnounceRef = useRef(0);
  const dragStateRef = useRef<DragState | null>(null);
  const justDraggedRef = useRef(false);
  const selectedRef = useRef<Set<string>>(selected);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  // stop the bead rAF loop on unmount — the loop otherwise keeps scheduling
  // itself indefinitely while a flow is mid-drain
  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (activeId && sourceItems.some((it) => it.id === activeId)) return;
    setActiveId(sourceItems[0]?.id ?? null);
  }, [sourceItems, activeId]);

  const toLocal = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const announce = useCallback(
    (count: number, tot: number, final = false) => {
      const now = performance.now();
      if (!final && now - lastAnnounceRef.current < LIVE_THROTTLE_MS) return;
      lastAnnounceRef.current = now;
      setLiveMessage(
        final
          ? `Moved ${count} of ${tot} to ${destinationLabel}.`
          : `Moving ${count} of ${tot} to ${destinationLabel}.`,
      );
    },
    [destinationLabel],
  );

  const deliverItem = useCallback(
    (id: string) => {
      const item = itemsById.get(id);
      setSourceItems((prev) => prev.filter((it) => it.id !== id));
      setSelected((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setDeparting((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (item) {
        setDestItems((prev) => [...prev, item]);
        setEntering((prev) => new Set(prev).add(id));
      }
    },
    [itemsById],
  );

  const cancelItem = useCallback((id: string) => {
    setDeparting((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const finalizeFlow = useCallback(
    (engine: FlowEngine) => {
      if (engine.sealed) {
        setLiveMessage(
          `Transfer stopped. ${engine.deliveredIds.size} moved, ${engine.cancelledIds.size} returned to ${sourceLabel}.`,
        );
      } else {
        setLiveMessage(`Moved ${engine.total} of ${engine.total} to ${destinationLabel}.`);
        onTransfer?.(Array.from(engine.deliveredIds));
      }
      const lingerMs = reducedMotion ? 60 : LINGER_MS;
      const fadeMs = reducedMotion ? 0 : FADE_MS;
      window.setTimeout(() => {
        setFading(true);
        window.setTimeout(() => {
          setFlowActive(false);
          setSealed(false);
          setFading(false);
          setTubeD(null);
          setStopPos(null);
          setTotal(0);
          setDelivered(0);
          engineRef.current = null;
        }, fadeMs);
      }, lingerMs);
    },
    [destinationLabel, sourceLabel, onTransfer, reducedMotion],
  );

  const tick = useCallback(() => {
    const engine = engineRef.current;
    const path = pathRef.current;
    const svg = svgRef.current;
    if (!engine || !path || !svg) {
      rafRef.current = null;
      return;
    }
    const now = performance.now();
    const stagger = reducedMotion ? REDUCED_STAGGER_MS : STAGGER_MS;
    const perItemMs = reducedMotion ? 1 : TRAVEL_MS;

    while (engine.queue.length && !engine.sealed) {
      const startedSoFar = engine.total - engine.queue.length;
      const scheduledStart = engineStartRef.current + startedSoFar * stagger;
      if (now < scheduledStart) break;
      const id = engine.queue.shift();
      if (!id) break;
      setDeparting((prev) => new Set(prev).add(id));
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("r", String(BEAD_R));
      circle.setAttribute("class", "sl-bead");
      const start = path.getPointAtLength(0);
      circle.setAttribute("cx", String(start.x));
      circle.setAttribute("cy", String(start.y));
      svg.appendChild(circle);
      engine.beads.push({ id, circle, phase: "forward", startAt: now, duration: perItemMs });
    }

    for (let i = engine.beads.length - 1; i >= 0; i--) {
      const bead = engine.beads[i];

      if (bead.phase === "forward" && engine.sealed) {
        const elapsed = now - bead.startAt;
        const t = Math.min(1, elapsed / bead.duration);
        const traveled = easeInOutCubic(t);
        bead.phase = "reverse";
        bead.fromT = traveled;
        bead.startAt = now;
        bead.duration = Math.max(120, bead.duration * traveled);
      }

      if (bead.phase === "forward") {
        const elapsed = now - bead.startAt;
        const t = Math.min(1, elapsed / bead.duration);
        const eased = easeInOutCubic(t);
        const pt = path.getPointAtLength(eased * engine.length);
        bead.circle?.setAttribute("cx", String(pt.x));
        bead.circle?.setAttribute("cy", String(pt.y));
        if (t >= 1) {
          bead.circle?.remove();
          engine.beads.splice(i, 1);
          engine.deliveredIds.add(bead.id);
          deliverItem(bead.id);
          announce(engine.deliveredIds.size, engine.total);
        }
      } else {
        const elapsed = now - bead.startAt;
        const t = Math.min(1, elapsed / bead.duration);
        const fromT = bead.fromT ?? 1;
        const posT = fromT * (1 - t);
        const pt = path.getPointAtLength(posT * engine.length);
        bead.circle?.setAttribute("cx", String(pt.x));
        bead.circle?.setAttribute("cy", String(pt.y));
        if (t >= 1) {
          bead.circle?.remove();
          engine.beads.splice(i, 1);
          engine.cancelledIds.add(bead.id);
          cancelItem(bead.id);
        }
      }
    }

    if (engine.queue.length === 0 && engine.beads.length === 0) {
      rafRef.current = null;
      finalizeFlow(engine);
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [reducedMotion, deliverItem, cancelItem, announce, finalizeFlow]);

  const primeFlow = useCallback(
    (queueIds: string[], srcPoint: { x: number; y: number }, dstPoint: { x: number; y: number }) => {
      if (!queueIds.length || engineRef.current) return;
      const svg = svgRef.current;
      const path = pathRef.current;
      if (!svg || !path) return;

      const d = buildTubePath(srcPoint.x, srcPoint.y, dstPoint.x, dstPoint.y);
      path.setAttribute("d", d);
      const length = path.getTotalLength();
      const mid = path.getPointAtLength(length * 0.5);

      engineRef.current = {
        length,
        queue: queueIds.slice(),
        beads: [],
        deliveredIds: new Set(),
        cancelledIds: new Set(),
        sealed: false,
        total: queueIds.length,
      };
      engineStartRef.current = performance.now();

      setTubeD(d);
      setStopPos({ x: mid.x, y: mid.y });
      setFlowActive(true);
      setSealed(false);
      setFading(false);
      setTotal(queueIds.length);
      setDelivered(0);
      lastAnnounceRef.current = 0;
      announce(0, queueIds.length);

      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(tick);
      }
    },
    [announce, tick],
  );

  // delivered is derived from engine state for rendering the progress caption
  useEffect(() => {
    if (!flowActive) return;
    const interval = window.setInterval(() => {
      const engine = engineRef.current;
      if (engine) setDelivered(engine.deliveredIds.size);
    }, 120);
    return () => window.clearInterval(interval);
  }, [flowActive]);

  const breakSeal = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || engine.sealed) return;
    engine.sealed = true;
    for (const id of engine.queue) engine.cancelledIds.add(id);
    engine.queue = [];
    setSealed(true);
    setRecoil(true);
    window.setTimeout(() => setRecoil(false), 420);
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allSourceSelected = sourceItems.length > 0 && sourceItems.every((it) => selected.has(it.id));

  const toggleSelectAll = useCallback(() => {
    setSelected((prev) => {
      if (sourceItems.length > 0 && sourceItems.every((it) => prev.has(it.id))) {
        return new Set();
      }
      return new Set(sourceItems.map((it) => it.id));
    });
  }, [sourceItems]);

  const onRowPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLLIElement>, id: string) => {
      if (flowActive) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const row = rowRefs.current.get(id);
      if (!row) return;
      try {
        row.setPointerCapture(e.pointerId);
      } catch {
        // ignore — some environments (synthetic pointerIds) reject capture
      }
      const wasSelected = selectedRef.current.has(id);
      const base = wasSelected ? selectedRef.current : new Set(selectedRef.current).add(id);
      dragStateRef.current = {
        id,
        queue: [id, ...Array.from(base).filter((x) => x !== id)],
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
      };
      if (!wasSelected) {
        selectedRef.current = base;
        setSelected(base);
      }
    },
    [flowActive],
  );

  const onRowPointerMove = useCallback((e: ReactPointerEvent<HTMLLIElement>) => {
    const drag = dragStateRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (!drag.moved) {
      const dist = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
      if (dist < DRAG_THRESHOLD) return;
      drag.moved = true;
    }
    setDragGhost({ x: e.clientX + 14, y: e.clientY + 14, count: drag.queue.length });
    const rect = destPanelRef.current?.getBoundingClientRect();
    const isOver = !!rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
    setOverDestination((prev) => (prev === isOver ? prev : isOver));
  }, []);

  const onRowPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLLIElement>) => {
      const drag = dragStateRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      dragStateRef.current = null;
      setDragGhost(null);
      setOverDestination(false);
      const row = rowRefs.current.get(drag.id);
      try {
        row?.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }

      if (!drag.moved) return; // plain click/tap — onClick handles the toggle
      justDraggedRef.current = true;

      const destRect = destPanelRef.current?.getBoundingClientRect();
      const srcRect = row?.getBoundingClientRect();
      const isOver =
        !!destRect &&
        e.clientX >= destRect.left &&
        e.clientX <= destRect.right &&
        e.clientY >= destRect.top &&
        e.clientY <= destRect.bottom;
      if (!isOver || !destRect || !srcRect) return;

      const srcPoint = toLocal(srcRect.right, srcRect.top + srcRect.height / 2);
      const dstPoint = toLocal(
        Math.min(Math.max(e.clientX, destRect.left + 16), destRect.right - 16),
        Math.min(Math.max(e.clientY, destRect.top + 16), destRect.bottom - 16),
      );
      primeFlow(drag.queue, srcPoint, dstPoint);
    },
    [toLocal, primeFlow],
  );

  const onRowClick = useCallback(
    (id: string) => {
      if (justDraggedRef.current) {
        justDraggedRef.current = false;
        return;
      }
      if (flowActive) return;
      toggleSelect(id);
    },
    [flowActive, toggleSelect],
  );

  const onListKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLUListElement>) => {
      if (flowActive) return;
      const ids = sourceItems.map((it) => it.id);
      if (!ids.length) return;
      const idx = activeId ? ids.indexOf(activeId) : -1;
      const focusIndex = (i: number) => {
        const id = ids[i];
        setActiveId(id);
        rowRefs.current.get(id)?.focus();
      };
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          focusIndex(Math.min(ids.length - 1, idx + 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          focusIndex(Math.max(0, idx - 1));
          break;
        case "Home":
          e.preventDefault();
          focusIndex(0);
          break;
        case "End":
          e.preventDefault();
          focusIndex(ids.length - 1);
          break;
        case " ":
        case "Enter":
          e.preventDefault();
          if (activeId) toggleSelect(activeId);
          break;
        default:
          break;
      }
    },
    [sourceItems, activeId, flowActive, toggleSelect],
  );

  const onMoveClick = useCallback(() => {
    if (flowActive || selected.size === 0) return;
    const ids = Array.from(selected);
    const draggedId = ids[0];
    const row = rowRefs.current.get(draggedId);
    const srcRect = row?.getBoundingClientRect() ?? sourceListRef.current?.getBoundingClientRect();
    const dstRect = destPanelRef.current?.getBoundingClientRect();
    if (!srcRect || !dstRect) return;
    const srcPoint = toLocal(srcRect.right, srcRect.top + srcRect.height / 2);
    const dstPoint = toLocal(dstRect.left + dstRect.width / 2, dstRect.top + dstRect.height / 2);
    primeFlow(ids, srcPoint, dstPoint);
  }, [flowActive, selected, toLocal, primeFlow]);

  return (
    <div ref={containerRef} className={["sl-root relative", className].filter(Boolean).join(" ")}>
      <style>{`
.sl-root .sl-src-row{display:grid;grid-template-rows:1fr;transition:grid-template-rows 300ms cubic-bezier(0.19,1,0.22,1);}
.sl-root .sl-src-row > div{overflow:hidden;min-height:0;transition:opacity 180ms ease-out;}
.sl-root .sl-src-row[data-departing]{grid-template-rows:0fr;}
.sl-root .sl-src-row[data-departing] > div{opacity:0;}
.sl-root .sl-dest-row{display:grid;grid-template-rows:1fr;}
.sl-root .sl-dest-row > div{overflow:hidden;min-height:0;}
@keyframes sl-enter{from{grid-template-rows:0fr;opacity:0;}to{grid-template-rows:1fr;opacity:1;}}
.sl-root .sl-dest-row[data-entering]{animation:sl-enter 320ms cubic-bezier(0.34,1.4,0.64,1) forwards;}
.sl-root .sl-src-row{outline:none;border-radius:6px;}
.sl-root .sl-src-row:focus-visible{box-shadow:0 0 0 2px var(--surface),0 0 0 4px var(--ns-accent);}
.sl-root .sl-check{display:inline-flex;flex:none;align-items:center;justify-content:center;width:18px;height:18px;border-radius:6px;border:1px solid var(--border);color:var(--background);transition:background-color 140ms ease-out,border-color 140ms ease-out;}
.sl-root .sl-check-on{background:var(--foreground);border-color:var(--foreground);}
.sl-root .sl-tube-path{fill:none;stroke:var(--border);stroke-width:1;transition:opacity ${FADE_MS}ms ease-out;}
.sl-root .sl-tube-fading{opacity:0;}
.sl-root .sl-bead{fill:var(--foreground);}
@keyframes sl-recoil{0%{stroke-width:1;opacity:1;}25%{stroke-width:2.6;opacity:0.35;}55%{stroke-width:0.4;opacity:1;}100%{stroke-width:1;opacity:1;}}
.sl-root .sl-tube-recoil{animation:sl-recoil 420ms cubic-bezier(0.34,1.56,0.64,1);}
.sl-root .sl-stop-btn{width:26px;height:26px;display:flex;align-items:center;justify-content:center;}
.sl-root .sl-stop-icon{width:8px;height:8px;background:var(--foreground);}
@media (prefers-reduced-motion: reduce){
  .sl-root .sl-src-row,
  .sl-root .sl-src-row > div,
  .sl-root .sl-dest-row,
  .sl-root .sl-tube-path,
  .sl-root .sl-check{transition:none !important;animation:none !important;}
}
`}</style>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="sl-panel overflow-hidden rounded-md border border-border bg-surface">
          <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{sourceLabel}</h3>
              <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ns-muted">
                {selected.size} selected
              </p>
            </div>
            <button
              type="button"
              disabled={flowActive || sourceItems.length === 0}
              onClick={toggleSelectAll}
              className="shrink-0 rounded-sm border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground outline-none transition-colors hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none"
            >
              {allSourceSelected ? "Clear selection" : "Select all"}
            </button>
          </div>
          <ul
            ref={sourceListRef}
            role="listbox"
            aria-multiselectable="true"
            aria-label={sourceLabel}
            onKeyDown={onListKeyDown}
            className={`max-h-80 overflow-y-auto p-1.5 transition-opacity ${flowActive ? "opacity-70" : ""}`}
          >
            {sourceItems.map((item) => {
              const isSelected = selected.has(item.id);
              const isDeparting = departing.has(item.id);
              return (
                <li
                  key={item.id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(item.id, el);
                    else rowRefs.current.delete(item.id);
                  }}
                  id={`${baseId}-src-${item.id}`}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={item.id === activeId ? 0 : -1}
                  data-departing={isDeparting ? "true" : undefined}
                  onPointerDown={(e) => onRowPointerDown(e, item.id)}
                  onPointerMove={onRowPointerMove}
                  onPointerUp={onRowPointerUp}
                  onPointerCancel={onRowPointerUp}
                  onClick={() => onRowClick(item.id)}
                  onFocus={() => setActiveId(item.id)}
                  className={`sl-src-row select-none ${flowActive ? "cursor-default" : "cursor-grab active:cursor-grabbing"}`}
                >
                  <div className="flex items-center gap-2.5 rounded-sm px-2.5 py-2">
                    <span aria-hidden className={`sl-check ${isSelected ? "sl-check-on" : ""}`}>
                      {isSelected ? (
                        <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3">
                          <path
                            d="M3.5 8.5l3 3 6-6.5"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{item.label}</span>
                    {item.hint ? (
                      <span className="shrink-0 font-mono text-[11px] text-ns-muted">{item.hint}</span>
                    ) : null}
                  </div>
                </li>
              );
            })}
            {sourceItems.length === 0 ? (
              <li className="px-2.5 py-6 text-center text-xs text-ns-muted">All items moved.</li>
            ) : null}
          </ul>
        </div>

        <div
          ref={destPanelRef}
          className={`sl-panel overflow-hidden rounded-md border bg-surface transition-colors ${
            overDestination ? "border-ns-accent" : "border-border"
          }`}
        >
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">{destinationLabel}</h3>
            <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ns-muted">
              {destItems.length} here
            </p>
          </div>
          <ul aria-label={destinationLabel} className="max-h-80 overflow-y-auto p-1.5">
            {destItems.map((item) => (
              <li
                key={item.id}
                data-entering={entering.has(item.id) ? "true" : undefined}
                onAnimationEnd={() =>
                  setEntering((prev) => {
                    if (!prev.has(item.id)) return prev;
                    const next = new Set(prev);
                    next.delete(item.id);
                    return next;
                  })
                }
                className="sl-dest-row"
              >
                <div className="flex items-center gap-2.5 px-2.5 py-2">
                  <span aria-hidden className="sl-check sl-check-on">
                    <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3">
                      <path
                        d="M3.5 8.5l3 3 6-6.5"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{item.label}</span>
                  {item.hint ? (
                    <span className="shrink-0 font-mono text-[11px] text-ns-muted">{item.hint}</span>
                  ) : null}
                </div>
              </li>
            ))}
            {destItems.length === 0 ? (
              <li className="px-2.5 py-6 text-center text-xs text-ns-muted">Nothing here yet.</li>
            ) : null}
          </ul>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] text-ns-muted">
          {flowActive
            ? sealed
              ? `Stopping — ${delivered} of ${total} made it across.`
              : `Moving ${delivered} of ${total}…`
            : "Drag a selected item across, or use the command."}
        </p>
        <button
          type="button"
          data-sl-move
          disabled={flowActive || selected.size === 0}
          onClick={onMoveClick}
          className="rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground outline-none transition-colors hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none"
        >
          Move selected to {destinationLabel}
        </button>
      </div>

      <p aria-live="polite" className="sr-only">
        {liveMessage}
      </p>

      <svg
        ref={svgRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 h-full w-full overflow-visible"
        viewBox={`0 0 ${size.w || 1} ${size.h || 1}`}
        preserveAspectRatio="none"
      >
        {tubeD ? (
          <path
            ref={pathRef}
            d={tubeD}
            className={`sl-tube-path ${fading ? "sl-tube-fading" : ""} ${recoil ? "sl-tube-recoil" : ""}`}
          />
        ) : (
          <path ref={pathRef} d="" className="sl-tube-path" style={{ opacity: 0 }} />
        )}
      </svg>

      {flowActive && stopPos ? (
        <button
          type="button"
          data-sl-stop
          aria-label="Stop transfer"
          onClick={breakSeal}
          style={{ left: stopPos.x, top: stopPos.y }}
          className="sl-stop-btn absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-surface text-foreground outline-none transition-colors hover:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span aria-hidden className="sl-stop-icon" />
        </button>
      ) : null}

      {dragGhost ? (
        <div
          aria-hidden
          className="pointer-events-none fixed z-50 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground"
          style={{ left: dragGhost.x, top: dragGhost.y }}
        >
          {dragGhost.count} {dragGhost.count === 1 ? "item" : "items"}
        </div>
      ) : null}
    </div>
  );
}
