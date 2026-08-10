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
// StarchShear — a film-strip thumbnail scrubber made of a shear-thickening
// material. Thumbnails are laid out in a fixed track; a single "drive" value
// (the raw, always-instantaneous scroll target driven by the pointer or a
// keyboard jump) is chased down the strip through a chain of overdamped
// couplings, one per neighbor, node[0] -> drive, node[i] -> node[i-1].
//
// The coupling rate itself is not constant: a fast-attack / slow-release
// envelope tracks |d(drive)/dt| (rendered scroll speed) and maps it to the
// chain's relaxation rate. Low envelope -> low rate -> each node visibly
// trails the one before it, a cascading lag down the strip (the liquid
// regime). High envelope -> high rate -> every node closes its gap inside
// a frame or two, so the whole strip reads as one rigid slab (the locked
// regime). There is no spring/overshoot — an overdamped, monotonic settle
// reads as fluid, not bouncy, which is the point of a "liquid" material.
//
// The chain is pure visual settle. Selection (aria-selected / the accent
// ring) is derived straight from `drive` every frame (nearest-to-viewport-
// center), independent of how far the visual chain has caught up — dragging
// commits ahead of the strip visually finishing its flow, exactly like a
// viscous material catching up to where it was already struck.
//
// Keyboard is the deliberate example of both regimes with no pointer at
// all: ArrowLeft/ArrowRight step one item and force the chain into the
// soft/fluid rate for that settle (a visible one-item cascade); Home/End
// jump to either end and force the chain into the stiff/locked rate (the
// whole strip leaps as one piece). A short click (no meaningful drag
// distance) on a thumbnail selects it directly through the same soft path.
//
// At rest every node also carries a *static* ±SAG_PX translateY, peaking at
// the strip's center and easing to zero at both ends — a fixed sine sag,
// never animated — which is the tell that the material is fluid even when
// nothing is being dragged. prefers-reduced-motion removes the chain, the
// envelope, and the sag entirely: drive is applied to every node directly,
// every frame, i.e. plain instant scrolling.
// ---------------------------------------------------------------------------

export interface StarchShearItem {
  id: string;
  label: string;
  caption?: string;
}

export interface StarchShearProps {
  items: StarchShearItem[];
  /** Controlled active index. Omit for uncontrolled (see defaultValue). */
  value?: number;
  /** Initial active index when uncontrolled. Default 0. */
  defaultValue?: number;
  onValueChange?: (index: number) => void;
  /** Accessible name for the listbox. Default "Film strip". */
  label?: string;
  className?: string;
}

const ITEM_W = 88;
const ITEM_H = 68;
const GAP = 8;
const STEP = ITEM_W + GAP;
const SAG_PX = 2;

const V_REF = 1.4; // px/ms envelope value that maps to full lock
const ATTACK_RATE = 0.09; // per-ms, fast: envelope closes to a rising speed almost immediately
const RELEASE_RATE = 0.0022; // per-ms, slow: envelope bleeds off a falling speed gradually
const LAMBDA_SOFT = 0.006; // per-ms chain relaxation rate at zero shear (visible cascade)
const LAMBDA_STIFF = 0.9; // per-ms chain relaxation rate at full shear (locked slab)
const EPS_PX = 0.05;
const EPS_V = 0.01;
const CLICK_SLOP = 6; // px of pointer travel below which a release counts as a select-click
const MAX_DT = 48; // ms, clamp to avoid a huge jump after a background tab
const IDLE_AMP_PX = 1.6; // idle wobble fed into node[0]'s chase target, not into `drive` itself
const IDLE_PERIOD_MS = 7000; // one full breathe cycle

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function StarchShear({
  items,
  value: controlledValue,
  defaultValue = 0,
  onValueChange,
  label = "Film strip",
  className = "",
}: StarchShearProps) {
  const uid = useId().replace(/:/g, "");
  const n = items.length;
  const clampIdx = useCallback((i: number) => clamp(i, 0, Math.max(0, n - 1)), [n]);

  const [internalIndex, setInternalIndex] = useState(() => clamp(defaultValue, 0, Math.max(0, n - 1)));
  const activeIndex = clampIdx(controlledValue ?? internalIndex);

  const listboxRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);

  const driveRef = useRef(0);
  const lastDriveRef = useRef(0);
  const renderedRef = useRef<number[]>([]);
  const envelopeRef = useRef(0);
  const lastTimeRef = useRef(0);
  const runningRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const draggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const pointerStartXRef = useRef(0);
  const pointerStartDriveRef = useRef(0);
  const pointerTravelRef = useRef(0);

  const viewportWidthRef = useRef(0);
  const reducedRef = useRef(false);
  const lastCommittedRef = useRef(activeIndex);
  const initializedRef = useRef(false);

  const trackWidth = n > 0 ? n * STEP - GAP : 0;

  // ±SAG_PX: -SAG_PX at both ends, +SAG_PX at the center — a literal 2px
  // peak-to-peak sag toward the middle of the strip, not a 0..2px ramp.
  const sagFor = useMemo(() => {
    return (i: number) => (n > 1 ? SAG_PX * (2 * Math.sin((Math.PI * i) / (n - 1)) - 1) : 0);
  }, [n]);

  const commit = useCallback(
    (idx: number) => {
      lastCommittedRef.current = idx;
      onValueChange?.(idx);
      if (controlledValue === undefined) setInternalIndex(idx);
    },
    [controlledValue, onValueChange]
  );

  const maxDrive = useCallback(() => Math.max(0, trackWidth - viewportWidthRef.current), [trackWidth]);

  const indexToDrive = useCallback(
    (idx: number) => {
      const center = idx * STEP + ITEM_W / 2;
      const vw = viewportWidthRef.current;
      return clamp(center - vw / 2, 0, maxDrive());
    },
    [maxDrive]
  );

  const driveToIndex = useCallback(
    (drive: number) => {
      const vw = viewportWidthRef.current;
      const centerX = drive + vw / 2;
      return clampIdx(Math.round((centerX - ITEM_W / 2) / STEP));
    },
    [clampIdx]
  );

  const writeItem = useCallback((i: number, x: number, y: number) => {
    const el = itemRefs.current[i];
    if (!el) return;
    el.style.transform = `translateX(${(-x).toFixed(2)}px) translateY(${y.toFixed(2)}px)`;
  }, []);

  const wake = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    lastTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(frameRef.current);
  }, []);

  // frameRef indirection lets `frame` close over the latest callbacks
  // (indexToDrive/driveToIndex/writeItem/commit) without re-subscribing the
  // rAF loop itself, and without listing a mutually-recursive function in
  // its own dependency array.
  const frameRef = useRef<(now: number) => void>(() => {});

  useEffect(() => {
    frameRef.current = (now: number) => {
      const dt = Math.min(MAX_DT, Math.max(0, now - lastTimeRef.current));
      lastTimeRef.current = now;
      const drive = driveRef.current;
      const arr = renderedRef.current;

      let maxDelta = 0;

      if (reducedRef.current) {
        for (let i = 0; i < n; i++) {
          arr[i] = drive;
          writeItem(i, drive, 0);
        }
        envelopeRef.current = 0;
      } else {
        const instV = dt > 0 ? Math.abs(drive - lastDriveRef.current) / dt : 0;
        const env = envelopeRef.current;
        envelopeRef.current =
          instV > env
            ? env + (instV - env) * (1 - Math.exp(-ATTACK_RATE * dt))
            : env + (instV - env) * (1 - Math.exp(-RELEASE_RATE * dt));

        const t = clamp(envelopeRef.current / V_REF, 0, 1);
        const lambda = LAMBDA_SOFT + (LAMBDA_STIFF - LAMBDA_SOFT) * t;
        const alpha = 1 - Math.exp(-lambda * dt);

        // At rest (no drag, envelope decayed to ~0) node[0] chases a slow
        // sine offset instead of `drive` exactly — the same overdamped
        // coupling then carries a gentle lag down the chain, unprompted.
        // `drive`/`lastDriveRef` and the committed index below are never
        // touched by this: the wobble is purely a visual settle target, so
        // selection can't drift while idle.
        const idleWobble = draggingRef.current
          ? 0
          : IDLE_AMP_PX * Math.sin((now * 2 * Math.PI) / IDLE_PERIOD_MS);
        let prev = drive + idleWobble;
        for (let i = 0; i < n; i++) {
          const gap = prev - arr[i];
          arr[i] += gap * alpha;
          maxDelta = Math.max(maxDelta, Math.abs(prev - arr[i]));
          prev = arr[i];
          writeItem(i, arr[i], sagFor(i));
        }
      }

      lastDriveRef.current = drive;

      const idx = driveToIndex(drive);
      if (idx !== lastCommittedRef.current) commit(idx);

      // Reduced motion never has anything left to chase (arr already equals
      // drive above), so it's the only case allowed to actually stop the
      // loop. Otherwise the idle wobble means there's always something to
      // settle toward next frame — ambient motion keeps the loop alive
      // continuously, gated only by tab visibility for cost.
      const settled = reducedRef.current && maxDelta < EPS_PX && envelopeRef.current < EPS_V;
      if (!settled && !document.hidden) {
        rafRef.current = requestAnimationFrame(frameRef.current);
      } else {
        runningRef.current = false;
      }
    };
  }, [n, sagFor, writeItem, driveToIndex, commit]);

  const jumpTo = useCallback(
    (idx: number, regime: "soft" | "stiff") => {
      const target = indexToDrive(clampIdx(idx));
      driveRef.current = target;
      lastDriveRef.current = target;
      envelopeRef.current = regime === "soft" ? 0 : V_REF * 2;
      commit(clampIdx(idx));
      wake();
    },
    [indexToDrive, clampIdx, commit, wake]
  );

  // Mount: measure viewport, seed drive/rendered arrays at the initial
  // index with no animation, and keep re-measuring on resize.
  useEffect(() => {
    const el = listboxRef.current;
    if (!el) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onMotionChange = () => {
      reducedRef.current = mq.matches;
      if (!mq.matches) wake();
    };
    mq.addEventListener("change", onMotionChange);

    const seed = () => {
      const w = el.getBoundingClientRect().width;
      if (w <= 0) return;
      viewportWidthRef.current = w;
      const drive = indexToDrive(activeIndex);
      driveRef.current = drive;
      lastDriveRef.current = drive;
      lastCommittedRef.current = activeIndex;
      const arr = new Array(n).fill(drive);
      renderedRef.current = arr;
      for (let i = 0; i < n; i++) writeItem(i, drive, reducedRef.current ? 0 : sagFor(i));
      initializedRef.current = true;
      if (!reducedRef.current) wake(); // idle wobble starts immediately at rest
    };
    seed();

    const ro = new ResizeObserver(() => {
      const w = el.getBoundingClientRect().width;
      if (w <= 0) return;
      viewportWidthRef.current = w;
      driveRef.current = clamp(driveRef.current, 0, maxDrive());
      wake();
    });
    ro.observe(el);

    // the frame loop stops scheduling itself while the tab is hidden (see
    // frameRef above); this is what starts it back up.
    const onVisibility = () => {
      if (!document.hidden && !reducedRef.current) wake();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mq.removeEventListener("change", onMotionChange);
      document.removeEventListener("visibilitychange", onVisibility);
      ro.disconnect();
    };
    // seeded once per item-count change; controlled `value` sync handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  // Controlled `value` changes from outside a drag/keypress: locked regime,
  // same as Home/End — a caller setting the index isn't a scrub gesture.
  useEffect(() => {
    if (controlledValue === undefined) return;
    if (!initializedRef.current) return;
    if (draggingRef.current) return;
    const idx = clampIdx(controlledValue);
    if (idx === lastCommittedRef.current) return;
    jumpTo(idx, "stiff");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledValue]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = listboxRef.current;
    if (!el || n === 0) return;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // synthetic pointerId (e.g. a demo-dispatched PointerEvent) matches no
      // live pointer outside the autoplay driver's shim; nothing to do.
    }
    pointerIdRef.current = e.pointerId;
    draggingRef.current = true;
    pointerTravelRef.current = 0;
    pointerStartXRef.current = e.clientX;
    pointerStartDriveRef.current = driveRef.current;
    wake();
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || pointerIdRef.current !== e.pointerId) return;
    const dx = e.clientX - pointerStartXRef.current;
    pointerTravelRef.current = Math.max(pointerTravelRef.current, Math.abs(dx));
    driveRef.current = clamp(pointerStartDriveRef.current - dx, 0, maxDrive());
    wake();
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    draggingRef.current = false;
    pointerIdRef.current = null;
    try {
      listboxRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // pointer already released/invalid; nothing to clean up
    }
    if (pointerTravelRef.current < CLICK_SLOP && listboxRef.current) {
      const rect = listboxRef.current.getBoundingClientRect();
      const x = clamp(e.clientX - rect.left, 0, rect.width);
      const idx = clampIdx(Math.floor((x + driveRef.current) / STEP));
      jumpTo(idx, "soft");
    } else {
      wake();
    }
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (n === 0) return;
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        jumpTo(activeIndex - 1, "soft");
        break;
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        jumpTo(activeIndex + 1, "soft");
        break;
      case "Home":
        e.preventDefault();
        jumpTo(0, "stiff");
        break;
      case "End":
        e.preventDefault();
        jumpTo(n - 1, "stiff");
        break;
      default:
        break;
    }
  };

  const optionId = (i: number) => `ns-shear-opt-${uid}-${i}`;

  return (
    <div className={`relative ${className}`}>
      <style>{CSS}</style>
      <div
        ref={listboxRef}
        role="listbox"
        tabIndex={0}
        aria-label={label}
        aria-activedescendant={n > 0 ? optionId(activeIndex) : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="ns-shear-viewport relative block w-full cursor-grab touch-pan-y select-none overflow-hidden rounded-[12px] border border-border bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/60 active:cursor-grabbing"
        style={{ height: ITEM_H + 16 }}
      >
        <div role="presentation" className="relative h-full" style={{ width: trackWidth }}>
          {items.map((item, i) => {
            const selected = i === activeIndex;
            return (
              <div
                key={item.id}
                id={optionId(i)}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                role="option"
                aria-selected={selected}
                aria-label={item.label}
                className="ns-shear-item absolute top-2 flex flex-col items-center justify-center gap-1 overflow-hidden rounded-[6px] border border-border bg-background transition-colors duration-150 hover:border-foreground/30 motion-reduce:transition-none"
                style={{
                  left: i * STEP,
                  width: ITEM_W,
                  height: ITEM_H,
                  boxShadow: selected ? "0 0 0 2px var(--ns-accent)" : undefined,
                }}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 16"
                  className="h-6 w-9 opacity-40"
                  style={{ color: "var(--ns-muted)" }}
                >
                  {/* viewfinder corners, not a mountain silhouette: the
                      earlier two-peak path filled solid between its ends
                      (single closed polygon, valley short of the baseline)
                      and read as a stray play-triangle rather than a photo
                      placeholder. Four open corner brackets can't be
                      mistaken for anything but "this is a frame". */}
                  <path
                    d="M2 2 L2 6 M2 2 L7 2 M22 2 L22 6 M22 2 L17 2 M2 14 L2 10 M2 14 L7 14 M22 14 L22 10 M22 14 L17 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                  />
                </svg>
                {item.caption ? (
                  <span className="font-mono text-[9px] tabular-nums text-ns-muted">{item.caption}</span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const CSS = `
.ns-shear-item{will-change:transform;}
@media (prefers-reduced-motion: reduce){
  .ns-shear-item{transition:none !important;}
}
`;
