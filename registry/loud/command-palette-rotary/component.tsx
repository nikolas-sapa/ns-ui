"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// PeriscopeSweep — a jump switcher navigated as a 1D rotary space instead of
// a ranked list. Destinations live at fixed compass bearings (0-359deg) on an
// invisible ring; only the item under the reticle (dead center) is fully
// resolved, neighbors compress toward the edges of a ~90deg viewport slit via
// a tan-projected offset from the center bearing (x = FOCAL * tan(delta)), so
// items near the slit edge telescope outward exactly like an optical
// periscope sweeping past. A Geist Mono bearing tape scrolls linearly along
// the top, independent of the tan projection, so its motion visibly disagrees
// with the ring's nonlinear compression. Drag/wheel rotate the bearing with
// momentum (friction decay) that hands off to a critically-damped spring once
// slow enough, snapping into whichever destination is nearest — a magnetic
// detent. Arrow keys step detent-to-detent instantly (spring, no coast), and
// a click on any visible item frames + commits it the same way. Typing
// buffers a query and previews (spring-rotates to) the best label match
// WITHOUT committing — Enter commits the previewed match (or the current
// reticle item if nothing is buffered), Escape cancels a live drag/coast or
// an in-progress preview and springs back to the last committed destination.
// Committing fires onValueChange the instant a target locks in, never gated
// on the settle animation, so physics is cosmetic follow-through on an
// already-decided outcome, not the source of truth for it. Destinations
// without an explicit bearing are assigned one deterministically and
// persisted to localStorage keyed by id, so a re-mount never reshuffles
// spatial memory ("analytics lives at 120 degrees" stays true across visits).
// Direct-DOM rAF hot path (no React state per frame); pure DOM/CSS, no
// canvas; every color is a Tailwind class bound to --background/--foreground/
// --muted/--border, with --accent reserved for the one genuine interaction
// state (keyboard focus lighting up the reticle). prefers-reduced-motion: no
// coast/spring anywhere, every rotation and detent snap is instant.
// ---------------------------------------------------------------------------

const VISIBLE_HALF_DEG = 45; // half-width of the "fully legible" viewport slit
const HARD_CUTOFF_DEG = 54; // beyond this an item is invisible, never hit
const FRICTION = 2.6; // s^-1 velocity decay while coasting after release
const COAST_STOP_DEG_S = 14; // deg/s below which coasting hands off to the spring
const SPRING_K = 170; // s^-2 — magnetic-detent spring
const SPRING_ZETA = 0.92; // near-critical: one tiny settle, no wobble
const SETTLE_MS = 650; // forced-settle deadline, backstops the velocity epsilon
const DRAG_DEG_PER_PX = 0.32;
const WHEEL_DEG_PER_UNIT = 0.22;
const WHEEL_MAX_IMPULSE = 60; // deg/s clamp per wheel tick — guards trackpad spam
const TAPE_HALF_DEG = 48; // ruler window either side of center bearing
const TAPE_STEP_DEG = 10;
const TYPEAHEAD_MS = 700;
const CLICK_PX = 5; // total pointer travel under this reads as a tap, not a drag

export interface PeriscopeDestination {
  id: string;
  label: string;
  /** fixed compass bearing in degrees [0, 360). Omit to auto-assign once and persist it. */
  bearing?: number;
  /** short mono hint rendered under the label, e.g. a keyboard shortcut */
  hint?: string;
}

const DEFAULT_DESTINATIONS: PeriscopeDestination[] = [
  { id: "overview", label: "Overview", bearing: 0 },
  { id: "team", label: "Team", bearing: 40 },
  { id: "billing", label: "Billing", bearing: 80 },
  { id: "analytics", label: "Analytics", bearing: 120 },
  { id: "deployments", label: "Deployments", bearing: 165 },
  { id: "domains", label: "Domains", bearing: 210 },
  { id: "storage", label: "Storage", bearing: 250 },
  { id: "settings", label: "Settings", bearing: 300 },
];

function wrap360(deg: number) {
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
}

// deterministic PRNG — auto-assigned bearings are stable within a session
// even before the localStorage write round-trips.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

type ResolvedDestination = PeriscopeDestination & { bearing: number };

// resolves each destination to a fixed bearing: explicit bearings pass
// through, omitted ones are assigned once (evenly spaced + small jitter) and
// persisted under a per-storageKey localStorage record so they never shuffle
// across mounts. Returned in fixed bearing order (ascending).
function useResolvedDestinations(
  destinations: PeriscopeDestination[],
  storageKey: string
): ResolvedDestination[] {
  return useMemo(() => {
    const lsKey = `ns-command-palette-rotary:${storageKey}`;
    let stored: Record<string, number> = {};
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(lsKey);
        if (raw) stored = JSON.parse(raw) as Record<string, number>;
      } catch {
        /* private mode / corrupt record — fall back to fresh assignment */
      }
    }
    const rand = mulberry32(hashStr(storageKey));
    const n = destinations.length || 1;
    const toStore: Record<string, number> = {};
    const resolved: ResolvedDestination[] = destinations.map((d, i) => {
      if (typeof d.bearing === "number") return { ...d, bearing: wrap360(d.bearing) };
      const existing = stored[d.id];
      if (typeof existing === "number") return { ...d, bearing: existing };
      const base = (360 * i) / n;
      const jitter = (rand() - 0.5) * (360 / n) * 0.5;
      const bearing = Math.round(wrap360(base + jitter));
      toStore[d.id] = bearing;
      return { ...d, bearing };
    });
    if (typeof window !== "undefined" && Object.keys(toStore).length > 0) {
      try {
        window.localStorage.setItem(
          lsKey,
          JSON.stringify({ ...stored, ...toStore })
        );
      } catch {
        /* quota / private mode — positions just won't persist this session */
      }
    }
    return resolved.slice().sort((a, b) => a.bearing - b.bearing);
  }, [destinations, storageKey]);
}

export function PeriscopeSweep({
  destinations = DEFAULT_DESTINATIONS,
  value,
  defaultValue,
  onValueChange,
  label = "Jump to",
  storageKey = "default",
  className = "",
}: {
  destinations?: PeriscopeDestination[];
  /** controlled current destination id */
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  /** accessible label for the listbox */
  label?: string;
  /** localStorage namespace for auto-assigned bearings */
  storageKey?: string;
  className?: string;
}) {
  const uid = useId();
  const labelId = `${uid}-label`;
  const optId = (i: number) => `${uid}-opt-${i}`;

  const list = useResolvedDestinations(destinations, storageKey);
  const TICK_COUNT = Math.ceil((2 * TAPE_HALF_DEG) / TAPE_STEP_DEG) + 3;

  const isControlled = value !== undefined;
  const firstId = list[0]?.id ?? "";
  const [internalValue, setInternalValue] = useState(() => defaultValue ?? firstId);
  const committedId = isControlled ? (value as string) : internalValue;
  const committedIndex = Math.max(
    0,
    list.findIndex((d) => d.id === committedId)
  );

  const rootRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const tapeRef = useRef<HTMLDivElement>(null);
  const reticleRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const tickRefs = useRef<(HTMLDivElement | null)[]>([]);
  const previewChipRef = useRef<HTMLDivElement>(null);

  const listRef = useRef(list);
  listRef.current = list;
  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;
  const isControlledRef = useRef(isControlled);
  isControlledRef.current = isControlled;
  const committedIndexRef = useRef(committedIndex);
  committedIndexRef.current = committedIndex;

  const [focused, setFocused] = useState(false);
  const [committedLabel, setCommittedLabel] = useState(
    () => list[committedIndex]?.label ?? ""
  );

  const engineRef = useRef<{
    syncToCommitted: (instant: boolean) => void;
    stepPrev: () => void;
    stepNext: () => void;
  } | null>(null);

  // ---- physics + rendering engine — one mount effect, refs-only hot path --
  useEffect(() => {
    const root = rootRef.current;
    const ring = ringRef.current;
    const live = liveRef.current;
    const previewChip = previewChipRef.current;
    if (!root || !ring || !live || !previewChip) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let focal = 200;
    let pxPerDeg = 2;

    let pos = listRef.current[committedIndexRef.current]?.bearing ?? 0;
    let vel = 0; // deg/s
    let mode: "idle" | "dragging" | "coasting" | "springing" = "idle";
    let springTarget = 0;
    let springDeadline = 0;
    let raf = 0;
    let last = 0;
    let visible = true;

    let dragPointerId: number | null = null;
    let lastX = 0;
    let lastT = 0;
    let dragMoved = 0; // cumulative |dx| — under CLICK_PX means "tap", not drag
    let downItemIndex: number | null = null;

    let typeBuf = "";
    let typeTimer = 0;
    let previewing = false;

    const dests = () => listRef.current;

    // nearest real-space occurrence of a fixed bearing to a reference point
    // on the continuous (unwrapped) position line — keeps rendering from
    // popping as pos accumulates across multiple laps.
    const occurrenceNear = (bearing: number, ref: number) =>
      bearing + 360 * Math.round((ref - bearing) / 360);

    const nearestIndex = (p: number) => {
      const arr = dests();
      let bi = 0;
      let bd = Infinity;
      for (let i = 0; i < arr.length; i++) {
        const d = Math.abs(p - occurrenceNear(arr[i]!.bearing, p));
        if (d < bd) {
          bd = d;
          bi = i;
        }
      }
      return bi;
    };

    const announce = (text: string) => {
      live.textContent = text;
    };

    const commit = (i: number) => {
      const arr = dests();
      const item = arr[i];
      if (!item) return;
      if (!isControlledRef.current) setInternalValue(item.id);
      committedIndexRef.current = i;
      setCommittedLabel(item.label);
      onValueChangeRef.current?.(item.id);
      announce(`Now at ${item.label}.`);
    };

    // pure render: derives every item's transform + the tape + the live
    // aria-activedescendant from `pos` alone. Called once at mount/resize,
    // after every discrete change, and every rAF frame while non-idle.
    const render = () => {
      const arr = dests();
      const reticleIdx = nearestIndex(pos);
      root.setAttribute(
        "aria-activedescendant",
        arr[reticleIdx] ? optId(reticleIdx) : ""
      );
      for (let i = 0; i < arr.length; i++) {
        const el = itemRefs.current[i];
        if (!el) continue;
        const occ = occurrenceNear(arr[i]!.bearing, pos);
        const delta = pos - occ;
        const abs = Math.min(HARD_CUTOFF_DEG, Math.abs(delta));
        const clampedDelta = Math.sign(delta) * abs;
        const t = abs / HARD_CUTOFF_DEG; // 0 center -> 1 edge
        const scale = 1.06 - 0.5 * t * t;
        const opacity = Math.max(0, 1 - t * t * t);
        const x = focal * Math.tan(clampedDelta * (Math.PI / 180));
        el.style.transform = `translate(-50%, -50%) translateX(${x.toFixed(1)}px) scale(${scale.toFixed(3)})`;
        el.style.opacity = opacity.toFixed(3);
        el.style.pointerEvents = opacity < 0.04 ? "none" : "auto";
        el.style.zIndex = String(1000 - Math.round(abs));
        el.dataset.reticle = i === reticleIdx ? "true" : "false";
      }
      // bearing tape: linear (not tan-projected) so its motion visibly
      // disagrees with the ring's compression toward the slit edges.
      const startTick = Math.ceil((pos - TAPE_HALF_DEG) / TAPE_STEP_DEG) * TAPE_STEP_DEG;
      for (let k = 0; k < TICK_COUNT; k++) {
        const el = tickRefs.current[k];
        if (!el) continue;
        const angle = startTick + k * TAPE_STEP_DEG;
        const offset = angle - pos;
        if (offset > TAPE_HALF_DEG) {
          el.style.opacity = "0";
          continue;
        }
        const tx = offset * pxPerDeg;
        const edge = Math.min(1, Math.abs(offset) / TAPE_HALF_DEG);
        el.style.transform = `translate(-50%, -50%) translateX(${tx.toFixed(1)}px)`;
        el.style.opacity = (0.85 - 0.65 * edge).toFixed(3);
        el.textContent = String(Math.round(wrap360(angle))).padStart(3, "0");
      }
      previewChip.style.opacity = previewing && typeBuf ? "1" : "0";
      previewChip.textContent = typeBuf ? `/${typeBuf}` : "";
    };

    const wake = () => {
      if (!raf && visible && !document.hidden) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const loop = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(0.033, (now - last) / 1000) : 1 / 60;
      last = now;
      let active = false;

      if (mode === "coasting") {
        vel *= Math.exp(-FRICTION * dt);
        pos += vel * dt;
        if (Math.abs(vel) < COAST_STOP_DEG_S) {
          const i = nearestIndex(pos);
          springTarget = occurrenceNear(dests()[i]!.bearing, pos);
          commit(i);
          mode = "springing";
          springDeadline = now + SETTLE_MS;
        }
        active = true;
      } else if (mode === "springing") {
        const c = 2 * SPRING_ZETA * Math.sqrt(SPRING_K);
        vel += (-SPRING_K * (pos - springTarget) - c * vel) * dt;
        pos += vel * dt;
        if (
          now >= springDeadline ||
          (Math.abs(pos - springTarget) < 0.05 && Math.abs(vel) < 1.5)
        ) {
          pos = springTarget;
          vel = 0;
          mode = "idle";
        } else {
          active = true;
        }
      }

      render();
      if (active && visible && !document.hidden) raf = requestAnimationFrame(loop);
    };

    const stepTo = (i: number, opts: { commit: boolean; instant?: boolean }) => {
      const arr = dests();
      const item = arr[i];
      if (!item) return;
      const target = occurrenceNear(item.bearing, pos);
      if (reduced || opts.instant) {
        pos = target;
        vel = 0;
        mode = "idle";
      } else {
        springTarget = target;
        vel = 0;
        mode = "springing";
        springDeadline = performance.now() + SETTLE_MS;
      }
      if (opts.commit) commit(i);
      render();
      wake();
    };

    const cancelToCommitted = () => {
      dragPointerId = null;
      typeBuf = "";
      previewing = false;
      window.clearTimeout(typeTimer);
      stepTo(committedIndexRef.current, { commit: false });
    };

    // an item under a pointerdown is captured by index up front (not via a
    // separate onClick — pointer capture below can retarget the compatibility
    // click event unpredictably across browsers), so a release under CLICK_PX
    // of travel can commit to the exact item that was pressed.
    const indexOfEl = (el: Element | null): number | null => {
      const opt = el?.closest<HTMLElement>("[data-periscope-index]");
      const idx = opt ? Number(opt.dataset.periscopeIndex) : NaN;
      return Number.isFinite(idx) ? idx : null;
    };

    // ---- pointer: drag rotates directly; a near-zero-travel release is a
    // tap-select instead, exactly like a click but immune to pointer-capture
    // retargeting the corresponding compatibility click event ----
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== undefined && e.button !== 0) return;
      dragPointerId = e.pointerId;
      dragMoved = 0;
      downItemIndex = indexOfEl(e.target as Element | null);
      try {
        ring.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic pointerId during autoplay — driver patches this away */
      }
      mode = "dragging";
      lastX = e.clientX;
      lastT = performance.now();
      vel = 0;
      previewing = false;
      typeBuf = "";
      wake();
    };
    const onPointerMove = (e: PointerEvent) => {
      if (mode !== "dragging" || e.pointerId !== dragPointerId) return;
      const now = performance.now();
      const dt = Math.max(0.001, (now - lastT) / 1000);
      const dx = e.clientX - lastX;
      dragMoved += Math.abs(dx);
      const deg = dx * DRAG_DEG_PER_PX;
      pos += deg;
      vel = vel * 0.5 + (deg / dt) * 0.5;
      lastX = e.clientX;
      lastT = now;
      render();
    };
    const endDrag = () => {
      if (mode !== "dragging") return;
      dragPointerId = null;
      const tapped = dragMoved < CLICK_PX ? downItemIndex : null;
      downItemIndex = null;
      if (tapped !== null) {
        vel = 0;
        stepTo(tapped, { commit: true });
        return;
      }
      if (reduced) {
        const i = nearestIndex(pos);
        pos = occurrenceNear(dests()[i]!.bearing, pos);
        vel = 0;
        mode = "idle";
        commit(i);
        render();
      } else {
        mode = "coasting";
        wake();
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId !== dragPointerId) return;
      endDrag();
    };
    const onPointerCancel = (e: PointerEvent) => {
      if (e.pointerId !== dragPointerId) return;
      endDrag();
    };

    const onWheel = (e: WheelEvent) => {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (delta === 0) return;
      e.preventDefault();
      previewing = false;
      typeBuf = "";
      if (reduced) {
        const arr = dests();
        const reticleIdx = nearestIndex(pos);
        const dir = delta > 0 ? 1 : -1;
        const i = (reticleIdx + dir + arr.length) % arr.length;
        pos = occurrenceNear(arr[i]!.bearing, pos);
        vel = 0;
        mode = "idle";
        commit(i);
        render();
        return;
      }
      const impulse = Math.max(
        -WHEEL_MAX_IMPULSE,
        Math.min(WHEEL_MAX_IMPULSE, -delta * WHEEL_DEG_PER_UNIT * 6)
      );
      vel += impulse;
      mode = "coasting";
      wake();
    };

    const typeahead = (ch: string) => {
      window.clearTimeout(typeTimer);
      typeBuf += ch.toLowerCase();
      typeTimer = window.setTimeout(() => {
        typeBuf = "";
        previewing = false;
        render();
      }, TYPEAHEAD_MS);
      const arr = dests();
      const n = arr.length;
      const reticleIdx = nearestIndex(pos);
      for (let k = 0; k < n; k++) {
        const i = (reticleIdx + k) % n;
        if (arr[i]!.label.toLowerCase().startsWith(typeBuf)) {
          previewing = true;
          stepTo(i, { commit: false });
          return;
        }
      }
      render();
    };

    // shared by ArrowLeft/Right and the on-screen prev/next buttons — steps
    // the reticle to the adjacent bearing in sorted order and commits.
    const stepBy = (dir: 1 | -1) => {
      const arr = dests();
      if (arr.length === 0) return;
      const reticleIdx = nearestIndex(pos);
      previewing = false;
      typeBuf = "";
      stepTo((reticleIdx + dir + arr.length) % arr.length, { commit: true });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const reticleIdx = nearestIndex(pos);
      if (e.key === "ArrowRight") {
        e.preventDefault();
        stepBy(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        stepBy(-1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        commit(reticleIdx);
        previewing = false;
        typeBuf = "";
        render();
      } else if (e.key === "Escape") {
        if (previewing || typeBuf || mode === "dragging" || mode === "coasting") {
          e.preventDefault();
          cancelToCommitted();
        }
      } else if (e.key.length === 1 && /[a-z0-9]/i.test(e.key)) {
        e.preventDefault();
        typeahead(e.key);
      }
    };

    const resize = () => {
      const rect = ring.getBoundingClientRect();
      if (rect.width < 8) return;
      const w = rect.width;
      focal = w / 2 / Math.tan((VISIBLE_HALF_DEG * Math.PI) / 180);
      pxPerDeg = w / 2 / TAPE_HALF_DEG;
      render();
    };
    resize();

    engineRef.current = {
      syncToCommitted: (instant) => {
        stepTo(committedIndexRef.current, { commit: false, instant });
      },
      stepPrev: () => stepBy(-1),
      stepNext: () => stepBy(1),
    };

    const ro = new ResizeObserver(resize);
    ro.observe(ring);
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) wake();
    });
    io.observe(root);
    const onVis = () => {
      if (!document.hidden) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    ring.addEventListener("pointerdown", onPointerDown);
    ring.addEventListener("pointermove", onPointerMove);
    ring.addEventListener("pointerup", onPointerUp);
    ring.addEventListener("pointercancel", onPointerCancel);
    ring.addEventListener("wheel", onWheel, { passive: false });
    root.addEventListener("keydown", onKeyDown);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(typeTimer);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      ring.removeEventListener("pointerdown", onPointerDown);
      ring.removeEventListener("pointermove", onPointerMove);
      ring.removeEventListener("pointerup", onPointerUp);
      ring.removeEventListener("pointercancel", onPointerCancel);
      ring.removeEventListener("wheel", onWheel);
      root.removeEventListener("keydown", onKeyDown);
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // controlled `value` changes (or the resolved list changing) ride the same
  // spring path the internal engine already uses.
  useEffect(() => {
    engineRef.current?.syncToCommitted(false);
  }, [committedId, list]);

  return (
    <div className={`w-full ${className}`}>
      <span
        id={labelId}
        className="mb-1.5 block font-mono text-xs uppercase tracking-[0.14em] text-muted"
      >
        {label}
      </span>

      <div
        ref={rootRef}
        role="listbox"
        tabIndex={0}
        aria-labelledby={labelId}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="relative w-full select-none overflow-hidden rounded-md border border-border bg-background outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {/* Geist Mono bearing tape — linear, decorative; real names live on
            the options below for assistive tech. */}
        <div
          ref={tapeRef}
          aria-hidden
          className="relative h-8 overflow-hidden border-b border-border bg-foreground/[0.02]"
        >
          {Array.from({ length: TICK_COUNT }).map((_, k) => (
            <div
              key={k}
              ref={(el) => {
                tickRefs.current[k] = el;
              }}
              className="pointer-events-none absolute left-1/2 top-1/2 font-mono text-[10px] tabular-nums text-muted"
            >
              000
            </div>
          ))}
        </div>

        {/* stage: the ring plus the prev/next buttons overlaid on it. Buttons
            are siblings of the ring, not children — nesting them inside would
            put them under the ring's own pointerdown/drag listener, racing a
            button click against a zero-distance drag underneath it. */}
        <div className="relative">
          {/* the ring: tan-projected slit onto the destinations */}
          <div ref={ringRef} className="relative h-40 touch-none sm:h-48">
            {list.map((d, i) => (
              <div
                key={d.id}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                id={optId(i)}
                role="option"
                aria-selected={i === committedIndex}
                data-reticle="false"
                data-periscope-index={i}
                className="group absolute left-1/2 top-1/2 flex max-w-[11rem] cursor-pointer flex-col items-center gap-0.5 whitespace-nowrap rounded-md px-2 py-1 text-center will-change-transform hover:bg-foreground/[0.05]"
              >
                <span
                  className={`text-sm font-medium text-foreground sm:text-base ${
                    focused ? "group-data-[reticle=true]:text-accent" : ""
                  }`}
                >
                  {d.label}
                </span>
                {i === committedIndex ? (
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                    current
                  </span>
                ) : d.hint ? (
                  <span className="font-mono text-[10px] text-muted">{d.hint}</span>
                ) : null}
                <span aria-hidden className="font-mono text-[10px] text-muted/70">
                  {String(d.bearing).padStart(3, "0")}&deg;
                </span>
              </div>
            ))}

            {/* reticle: the fixed crosshair the ring sweeps past */}
            <div
              ref={reticleRef}
              aria-hidden
              className={`pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2 ${
                focused ? "bg-accent" : "bg-border"
              }`}
            >
              <span
                className={`absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full border-x-4 border-t-4 border-x-transparent ${
                  focused ? "border-t-accent" : "border-t-border"
                }`}
              />
            </div>

            {/* live typeahead preview chip */}
            <div
              ref={previewChipRef}
              aria-hidden
              className="pointer-events-none absolute bottom-2 right-2 rounded-sm border border-border bg-background px-2 py-1 font-mono text-[10px] text-muted opacity-0 transition-opacity"
            />
          </div>

          {/* explicit step buttons: a mouse-only, no-drag path to the exact
              same detent step arrow keys perform. Siblings of the ring, so a
              click never also starts the ring's own drag gesture. */}
          <button
            type="button"
            aria-label="Previous bearing"
            onClick={() => engineRef.current?.stepPrev()}
            className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-muted outline-none transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <svg aria-hidden viewBox="0 0 16 16" width="14" height="14" fill="none">
              <path
                d="M10 3.5L5.5 8l4.5 4.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Next bearing"
            onClick={() => engineRef.current?.stepNext()}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-muted outline-none transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <svg aria-hidden viewBox="0 0 16 16" width="14" height="14" fill="none">
              <path
                d="M6 3.5L10.5 8L6 12.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2">
          <p className="min-w-0 truncate font-mono text-[11px] text-muted">
            <span className="text-foreground">{committedLabel}</span> &middot;
            drag, wheel, or arrow keys to sweep
          </p>
          <p className="shrink-0 font-mono text-[11px] text-muted">
            enter selects &middot; esc cancels
          </p>
        </div>
      </div>

      <div ref={liveRef} aria-live="polite" className="sr-only" />
    </div>
  );
}
