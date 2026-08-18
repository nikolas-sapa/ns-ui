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
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// PinRegister — a map layer panel drawn as registered acetate separations
// instead of a checkbox list. Every sheet's transform derives from ONE
// governing scalar x (0 = flat pile, 1 = fully fanned), driven by hover/focus
// anywhere in the panel: translateY = index * 14px * x, inside a single
// shared 2-axis skew on the stack wrapper (the isometric tilt) — no
// per-sheet rotation, one skew and one scalar is the whole motion budget.
// Two pin dots are drawn once, fixed in the panel, never moved by x or by
// toggling — that fixed screen position IS the registration: every ACTIVE
// sheet's translateX stays 0 at any explode value, literally locked to the
// pins. Toggling a layer off does not fade it out (an invisible overlay is a
// checkbox, not a separation) — it translates the sheet 24px right, off the
// pin line, to a parked slot at 35% opacity, still fully legible and still
// occupying its place in the fan. One `order` array is both the visual stack
// order and the draw order of the composite preview beneath it, so the two
// can never disagree. Reordering — drag on the sheet itself, or Alt+Arrow —
// reshuffles that one array; every sheet (dragged or not) is a continuous
// spring toward its live target, so a drag-in-progress previews the reflow
// before it commits. Reduced motion pins x at 0 (sheets sit flush, no fan)
// and parked sheets simply offset with no animation — the isometric read is
// pure presentation, never load-bearing. DOM + SVG + CSS only, no canvas.
// Distinct from light-table: that component stacks film to visually compare
// content; this one treats z-order as a draggable physical fact and keeps a
// disabled layer parked-but-visible rather than gone, so you never lose the
// read on what you're missing.
// ---------------------------------------------------------------------------

export interface PinRegisterLayer {
  id: string;
  label: string;
  /** initial visibility; defaults true */
  active?: boolean;
  /** small line-work swatch for this layer — stroke="currentColor", viewBox 0 0 120 80 */
  swatch: ReactNode;
}

export interface PinRegisterProps {
  layers: PinRegisterLayer[];
  /** fires with the active layer ids, bottom-to-top draw order, on any toggle or reorder */
  onChange?: (activeIds: string[]) => void;
  className?: string;
  "aria-label"?: string;
}

const STEP_Y = 14; // px per stack index, scaled by explode x
const PARK_X = 24; // px a parked sheet sits off the pin line
const PARK_OPACITY = 0.35;
const DRAG_THRESHOLD = 4; // px of travel before a pointerdown becomes a live drag

const X_K = 190;
const X_C = 2 * 0.92 * Math.sqrt(X_K); // near-critical — explode settles without overshoot
const Y_K = 240;
const Y_C = 2 * 0.86 * Math.sqrt(Y_K); // slight underdamp — the "200ms spring" reorder feel
const LERP_RATE = 11; // 1/s, for parkX + opacity — simple exponential ease, not a spring
const REST_EPS = 0.05;
const REST_VEPS = 0.4;

type Phys = { y: number; vy: number; parkX: number; opacity: number };

type DragState = {
  id: string;
  pointerId: number;
  startClientY: number;
  startY: number;
  followY: number;
  active: boolean;
  baseOrder: string[];
  insertionIndex: number;
};

function PinIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
      <circle cx="5" cy="5" r="3.4" fill="var(--background)" stroke="var(--ns-muted)" strokeWidth="1.4" />
      <circle cx="5" cy="5" r="1.1" fill="var(--ns-muted)" />
    </svg>
  );
}

function GripGlyph() {
  return (
    <svg width="8" height="14" viewBox="0 0 8 14" aria-hidden="true" focusable="false" className="shrink-0 opacity-60">
      <circle cx="1.5" cy="2" r="1" fill="currentColor" />
      <circle cx="6.5" cy="2" r="1" fill="currentColor" />
      <circle cx="1.5" cy="7" r="1" fill="currentColor" />
      <circle cx="6.5" cy="7" r="1" fill="currentColor" />
      <circle cx="1.5" cy="12" r="1" fill="currentColor" />
      <circle cx="6.5" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

export function PinRegister({
  layers,
  onChange,
  className = "",
  "aria-label": ariaLabel = "Map layers",
}: PinRegisterProps) {
  const layersById = useMemo(() => {
    const m = new Map<string, PinRegisterLayer>();
    for (const l of layers) m.set(l.id, l);
    return m;
  }, [layers]);

  const [order, setOrder] = useState<string[]>(() => layers.map((l) => l.id));
  const [active, setActive] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(layers.map((l) => [l.id, l.active !== false]))
  );
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [liveMsg, setLiveMsg] = useState("");

  const orderRef = useRef(order);
  orderRef.current = order;
  const activeRef = useRef(active);
  activeRef.current = active;
  const reducedRef = useRef(false);
  reducedRef.current = reduced;
  const hoverOrFocusRef = useRef(false);
  hoverOrFocusRef.current = hovered || focusWithin;
  const firstChange = useRef(true);

  const panelRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const physRef = useRef<Map<string, Phys>>(new Map());
  const xRef = useRef({ v: 0, dv: 0 });
  const dragRef = useRef<DragState | null>(null);
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

  useEffect(() => {
    if (firstChange.current) {
      firstChange.current = false;
      return;
    }
    onChange?.(order.filter((id) => active[id]));
  }, [order, active, onChange]);

  const writeRow = useCallback((id: string, idx: number, p: Phys) => {
    const el = rowRefs.current.get(id);
    if (!el) return;
    el.style.transform = `translate3d(${p.parkX.toFixed(2)}px, ${p.y.toFixed(2)}px, 0)`;
    el.style.opacity = p.opacity.toFixed(3);
    el.style.zIndex = String(100 - idx);
  }, []);

  const ensureLoop = useCallback(() => {
    if (rafRef.current) return;
    lastFrameRef.current = 0;
    rafRef.current = requestAnimationFrame(loop);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loop is a stable module-scoped function below
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- loop reads refs, deps stable across renders
  function loop(now: number) {
    rafRef.current = 0;
    const dt = lastFrameRef.current ? Math.min(0.032, (now - lastFrameRef.current) / 1000) : 1 / 60;
    lastFrameRef.current = now;

    const phys = physRef.current;
    let settled = true;

    // one governing scalar: the panel's explode factor
    const xTarget = reducedRef.current ? 0 : hoverOrFocusRef.current ? 1 : 0;
    const xs = xRef.current;
    if (reducedRef.current) {
      xs.v = 0;
      xs.dv = 0;
    } else {
      const ax = -X_K * (xs.v - xTarget) - X_C * xs.dv;
      xs.dv += ax * dt;
      xs.v += xs.dv * dt;
      if (Math.abs(xs.v - xTarget) > 0.0015 || Math.abs(xs.dv) > 0.01) settled = false;
      else {
        xs.v = xTarget;
        xs.dv = 0;
      }
    }
    const x = xs.v;

    const drag = dragRef.current;
    const liveOrder =
      drag && drag.active
        ? (() => {
            const rest = drag.baseOrder.filter((id) => id !== drag.id);
            const clamped = Math.min(rest.length, Math.max(0, drag.insertionIndex));
            rest.splice(clamped, 0, drag.id);
            return rest;
          })()
        : orderRef.current;

    liveOrder.forEach((id, idx) => {
      let p = phys.get(id);
      if (!p) {
        p = { y: idx * STEP_Y, vy: 0, parkX: activeRef.current[id] ? 0 : PARK_X, opacity: activeRef.current[id] ? 1 : PARK_OPACITY };
        phys.set(id, p);
      }

      const isDragged = !!drag && drag.active && drag.id === id;
      const targetParkX = activeRef.current[id] ? 0 : PARK_X;
      const targetOpacity = activeRef.current[id] ? 1 : PARK_OPACITY;

      if (reducedRef.current) {
        p.y = isDragged ? drag!.followY : idx * STEP_Y * x; // x is 0 under reduced motion
        p.parkX = targetParkX;
        p.opacity = targetOpacity;
        p.vy = 0;
      } else {
        if (isDragged) {
          p.y = drag!.followY;
          p.vy = 0;
        } else {
          const targetY = idx * STEP_Y * x;
          const ay = -Y_K * (p.y - targetY) - Y_C * p.vy;
          p.vy += ay * dt;
          p.y += p.vy * dt;
          if (Math.abs(p.y - targetY) > REST_EPS || Math.abs(p.vy) > REST_VEPS) settled = false;
        }
        const lerp = 1 - Math.exp(-LERP_RATE * dt);
        p.parkX += (targetParkX - p.parkX) * lerp;
        p.opacity += (targetOpacity - p.opacity) * lerp;
        if (Math.abs(p.parkX - targetParkX) > 0.05 || Math.abs(p.opacity - targetOpacity) > 0.002) settled = false;
      }

      writeRow(id, idx, p);
    });

    if (!settled || (drag && drag.active)) {
      rafRef.current = requestAnimationFrame(loop);
    }
  }

  // seed + write synchronously before paint so rows don't sit at (0,0) for a frame
  useLayoutEffect(() => {
    const phys = physRef.current;
    order.forEach((id, idx) => {
      if (!phys.has(id)) {
        phys.set(id, { y: idx * STEP_Y, vy: 0, parkX: active[id] ? 0 : PARK_X, opacity: active[id] ? 1 : PARK_OPACITY });
      }
      writeRow(id, idx, phys.get(id)!);
    });
    for (const id of Array.from(phys.keys())) {
      if (!layersById.has(id)) phys.delete(id);
    }
    ensureLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, active, layersById, writeRow, ensureLoop]);

  useEffect(() => {
    ensureLoop();
  }, [hovered, focusWithin, reduced, ensureLoop]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const toggle = useCallback(
    (id: string) => {
      const label = layersById.get(id)?.label ?? "";
      setActive((prev) => {
        const next = { ...prev, [id]: !prev[id] };
        setLiveMsg(next[id] ? `${label} layer on.` : `${label} layer off, parked.`);
        return next;
      });
      ensureLoop();
    },
    [layersById, ensureLoop]
  );

  const reorder = useCallback(
    (id: string, dir: -1 | 1) => {
      const cur = orderRef.current;
      const idx = cur.indexOf(id);
      const swapWith = idx + dir;
      if (swapWith < 0 || swapWith >= cur.length) return;
      const next = cur.slice();
      next[idx] = cur[swapWith];
      next[swapWith] = cur[idx];
      const neighborLabel = layersById.get(cur[swapWith])?.label ?? "";
      const label = layersById.get(id)?.label ?? "";
      setOrder(next);
      setLiveMsg(
        `${label} moved ${dir < 0 ? "above" : "below"} ${neighborLabel}, position ${swapWith + 1} of ${cur.length}.`
      );
      ensureLoop();
    },
    [layersById, ensureLoop]
  );

  const beginDrag = useCallback((id: string, e: ReactPointerEvent<HTMLButtonElement>) => {
    const startY = physRef.current.get(id)?.y ?? 0;
    dragRef.current = {
      id,
      pointerId: e.pointerId,
      startClientY: e.clientY,
      startY,
      followY: startY,
      active: false,
      baseOrder: orderRef.current.slice(),
      insertionIndex: orderRef.current.indexOf(id),
    };
  }, []);

  const moveDrag = useCallback(
    (id: string, e: ReactPointerEvent<HTMLButtonElement>) => {
      const d = dragRef.current;
      if (!d || d.id !== id || d.pointerId !== e.pointerId) return;
      const deltaY = e.clientY - d.startClientY;

      if (!d.active && Math.abs(deltaY) > DRAG_THRESHOLD) {
        d.active = true;
        suppressClickRef.current = true;
        setDraggingId(id);
        e.currentTarget.setPointerCapture(e.pointerId);
        ensureLoop();
      }
      if (!d.active) return;

      d.followY = d.startY + deltaY;

      // rect-based hit test: how many other rows currently sit above the pointer
      const others = d.baseOrder.filter((oid) => oid !== id);
      let insertionIndex = others.length;
      for (let i = 0; i < others.length; i++) {
        const el = rowRefs.current.get(others[i]);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) {
          insertionIndex = i;
          break;
        }
      }
      d.insertionIndex = insertionIndex;
      ensureLoop();
    },
    [ensureLoop]
  );

  const endDrag = useCallback(
    (id: string, e: ReactPointerEvent<HTMLButtonElement>) => {
      const d = dragRef.current;
      if (!d || d.id !== id || d.pointerId !== e.pointerId) return;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      dragRef.current = null;
      setDraggingId(null);
      if (!d.active) return;

      const rest = d.baseOrder.filter((oid) => oid !== id);
      const clamped = Math.min(rest.length, Math.max(0, d.insertionIndex));
      rest.splice(clamped, 0, id);
      setOrder(rest);
      const idx = rest.indexOf(id);
      const label = layersById.get(id)?.label ?? "";
      setLiveMsg(`${label}, now at position ${idx + 1} of ${rest.length}.`);
      ensureLoop();
    },
    [ensureLoop, layersById]
  );

  const onRowKeyDown = useCallback(
    (id: string, e: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (!e.altKey) return;
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      reorder(id, e.key === "ArrowUp" ? -1 : 1);
    },
    [reorder]
  );

  const onClick = useCallback(
    (id: string) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return;
      }
      toggle(id);
    },
    [toggle]
  );

  const panelHeight = Math.max(48, layers.length * STEP_Y + 44);

  return (
    <div
      className={`flex flex-col gap-4 sm:flex-row sm:items-start ${className}`}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocusWithin(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusWithin(false);
      }}
    >
      <div aria-live="polite" role="status" className="sr-only">
        {liveMsg}
      </div>

      <div
        ref={panelRef}
        data-pr-panel
        role="list"
        aria-label={ariaLabel}
        className="relative flex-1 select-none rounded-md border border-border bg-background p-4"
        style={{ height: panelHeight }}
      >
        <div
          className="relative h-full"
          style={{ transform: "skewX(-6deg) skewY(2deg)", transformOrigin: "8px 8px" }}
        >
          <div className="pointer-events-none absolute left-[15px] top-[7px] z-[200] flex gap-6">
            <PinIcon />
            <PinIcon />
          </div>

          {order.map((id, idx) => {
            const layer = layersById.get(id);
            if (!layer) return null;
            const isActive = !!active[id];
            const isDragging = draggingId === id;
            const pos = order.indexOf(id) + 1;
            return (
              <div
                key={id}
                ref={(el) => {
                  if (el) rowRefs.current.set(id, el);
                  else rowRefs.current.delete(id);
                }}
                role="listitem"
                className="absolute left-6 right-2 top-1 will-change-transform"
                style={{ height: 40 }}
              >
                <button
                  type="button"
                  data-pr-sheet
                  data-pr-row={idx}
                  aria-pressed={isActive}
                  aria-label={`${layer.label} layer, ${isActive ? "visible" : "off, parked"}. Position ${pos} of ${order.length}.`}
                  onPointerDown={(e) => beginDrag(id, e)}
                  onPointerMove={(e) => moveDrag(id, e)}
                  onPointerUp={(e) => endDrag(id, e)}
                  onPointerCancel={(e) => endDrag(id, e)}
                  onClick={() => onClick(id)}
                  onKeyDown={(e) => onRowKeyDown(id, e)}
                  className={`flex h-full w-full cursor-grab touch-none items-center gap-2 rounded-md border bg-surface/90 px-2.5 text-left shadow-[0_3px_10px_rgba(0,0,0,0.16)] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent active:cursor-grabbing ${
                    isDragging ? "border-ns-accent" : "border-border hover:border-foreground/30"
                  }`}
                >
                  <GripGlyph />
                  <span className={isActive ? "text-ns-muted" : "text-ns-muted/70"}>{layer.swatch}</span>
                  <span
                    className={`min-w-0 flex-1 truncate text-xs font-medium ${
                      isActive ? "text-foreground" : "text-ns-muted"
                    }`}
                  >
                    {layer.label}
                  </span>
                  {!isActive ? (
                    <span className="shrink-0 rounded-full border border-border bg-background px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-ns-muted">
                      parked
                    </span>
                  ) : null}
                  <span className="shrink-0 rounded-full border border-border bg-background px-1.5 py-0.5 font-mono text-[9px] text-ns-muted">
                    {pos}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="flex shrink-0 flex-col gap-2 sm:w-32"
        aria-hidden="true"
      >
        <p className="font-mono text-[10px] uppercase tracking-wide text-ns-muted">Composite</p>
        <div className="relative aspect-square w-full overflow-hidden rounded-md border border-border bg-background">
          {order.map((id, idx) => {
            const layer = layersById.get(id);
            if (!layer) return null;
            const isActive = !!active[id];
            // index 0 is the sheet nearest the viewer in the physical stack
            // (translateY pinned at 0) — it draws LAST here too, on top of
            // the composite, so the two orderings never disagree.
            return (
              <div
                key={id}
                className="absolute inset-0 flex items-center justify-center text-ns-muted transition-opacity duration-200"
                style={{ opacity: isActive ? 0.85 : 0, zIndex: order.length - idx }}
              >
                {layer.swatch}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
