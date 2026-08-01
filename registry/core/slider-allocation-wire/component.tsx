"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// CatenarySplit — a two-way allocation slider built as a slack wire between
// two labeled anchors. The bead's position along the wire sets the RATIO
// (left share vs right share); the wire's SAG encodes a second, independent
// variable — the unallocated remainder — so a taut straight wire reads as
// "fully committed" and a deep droop reads as "budget still on the table".
// Mechanism: an SVG quadratic bezier whose control-point depth is
// proportional to the unallocated fraction, rebuilt every frame; the bead is
// positioned by genuine arc-length parameterization (sampled table, not raw
// parametric t) so it slides evenly along whatever shape the wire currently
// has. A wheel/pinch on the wire, or dragging the paired "Total allocated"
// track, winches the total; easing toward a taut wire plays two decaying
// tension oscillations when it lands fully committed. Direct-DOM rAF hot
// path — React state only holds the committed integer values, per-frame
// geometry lives in refs/locals and is written straight to the DOM.
// ---------------------------------------------------------------------------

const VB_W = 400; // svg viewBox width (units, not px — scaled to the box)
const VB_H = 120;
const ANCHOR_X = 30; // inset of each anchor from the viewBox edges
const WIRE_Y = 46; // baseline y both anchors sit on
const MAX_DEPTH = 44; // control-point sag at fully unallocated (total = 0)
const SAMPLES = 48; // arc-length table resolution

const RATIO_K = 220; // keyboard/glide spring, s^-2 (critically-ish damped)
const RATIO_ZETA = 0.9;
const DEPTH_K = 130; // sag spring when NOT snapping taut
const DEPTH_ZETA = 1.0;
const TAUT_MS = 900; // scripted tension-wobble window when total hits 100
const TAUT_DECAY = 3.4;
const TAUT_CYCLES = 2; // exactly two damped oscillations
const SETTLE_MS = 1200; // forced-settle deadline for any pending motion

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

interface Pt {
  x: number;
  y: number;
}

function quadPoint(p0: Pt, p1: Pt, p2: Pt, t: number): Pt {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  };
}

interface ArcTable {
  xs: number[];
  ys: number[];
  lens: number[];
  total: number;
}

// Samples the current quadratic bezier into an arc-length lookup table. Since
// both anchors sit at the same y and the control point's x is always their
// midpoint, x(t) is monotonic — the table doubles as an x -> arc-length map.
function buildTable(p0: Pt, p1: Pt, p2: Pt): ArcTable {
  const xs: number[] = [p0.x];
  const ys: number[] = [p0.y];
  const lens: number[] = [0];
  let prevX = p0.x;
  let prevY = p0.y;
  let acc = 0;
  for (let i = 1; i <= SAMPLES; i++) {
    const { x, y } = quadPoint(p0, p1, p2, i / SAMPLES);
    acc += Math.hypot(x - prevX, y - prevY);
    xs.push(x);
    ys.push(y);
    lens.push(acc);
    prevX = x;
    prevY = y;
  }
  return { xs, ys, lens, total: Math.max(1e-6, acc) };
}

// Point at a given arc-length fraction (0..1) — genuine arc-length walk, not
// a lerp on parametric t.
function pointAtFraction(table: ArcTable, f: number): Pt {
  const target = clamp(f, 0, 1) * table.total;
  const { xs, ys, lens } = table;
  for (let i = 1; i < lens.length; i++) {
    if (lens[i] >= target) {
      const span = lens[i] - lens[i - 1];
      const u = span > 1e-6 ? (target - lens[i - 1]) / span : 0;
      return {
        x: xs[i - 1] + (xs[i] - xs[i - 1]) * u,
        y: ys[i - 1] + (ys[i] - ys[i - 1]) * u,
      };
    }
  }
  const last = lens.length - 1;
  return { x: xs[last], y: ys[last] };
}

// Inverse: arc-length fraction nearest a given x (binary search — x is
// monotonic by construction). Used to map a pointer position on the wire
// back to a ratio.
function fractionForX(table: ArcTable, x: number): number {
  const { xs, lens } = table;
  const hi0 = xs.length - 1;
  if (x <= xs[0]) return 0;
  if (x >= xs[hi0]) return 1;
  let lo = 0;
  let hi = hi0;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] < x) lo = mid;
    else hi = mid;
  }
  const span = xs[hi] - xs[lo];
  const u = span > 1e-6 ? (x - xs[lo]) / span : 0;
  const len = lens[lo] + (lens[hi] - lens[lo]) * u;
  return clamp(len / table.total, 0, 1);
}

export interface CatenarySplitProps {
  /** label for the left anchor, e.g. "Compute" */
  leftLabel?: string;
  /** label for the right anchor, e.g. "Storage" */
  rightLabel?: string;
  /** controlled split ratio, 0-100 (% of the committed total given to left) */
  ratio?: number;
  defaultRatio?: number;
  /** controlled total committed, 0-100 (% of budget not left on the table) */
  total?: number;
  defaultTotal?: number;
  onRatioChange?: (v: number) => void;
  onTotalChange?: (v: number) => void;
  className?: string;
}

export function CatenarySplit({
  leftLabel = "Compute",
  rightLabel = "Storage",
  ratio,
  defaultRatio = 60,
  total,
  defaultTotal = 65,
  onRatioChange,
  onTotalChange,
  className = "",
}: CatenarySplitProps) {
  const isRatioControlled = ratio !== undefined;
  const [ratioInternal, setRatioInternal] = useState(() =>
    clamp(defaultRatio, 0, 100)
  );
  const ratioValue = isRatioControlled ? (ratio as number) : ratioInternal;
  const ratioRef = useRef(ratioValue);
  ratioRef.current = ratioValue;

  const isTotalControlled = total !== undefined;
  const [totalInternal, setTotalInternal] = useState(() =>
    clamp(defaultTotal, 0, 100)
  );
  const totalValue = isTotalControlled ? (total as number) : totalInternal;
  const totalRef = useRef(totalValue);
  totalRef.current = totalValue;

  const [ratioActive, setRatioActive] = useState(false); // focus or drag
  const [totalActive, setTotalActive] = useState(false);

  const commitRatioRef = useRef<(v: number) => void>(() => {});
  commitRatioRef.current = (v: number) => {
    const q = clamp(Math.round(v), 0, 100);
    if (q === ratioRef.current) return;
    if (!isRatioControlled) setRatioInternal(q);
    onRatioChange?.(q);
  };
  const commitTotalRef = useRef<(v: number) => void>(() => {});
  commitTotalRef.current = (v: number) => {
    const q = clamp(Math.round(v), 0, 100);
    if (q === totalRef.current) return;
    if (!isTotalControlled) setTotalInternal(q);
    onTotalChange?.(q);
  };

  const wireBoxRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const beadRef = useRef<HTMLDivElement>(null);
  const leftPctRef = useRef<HTMLSpanElement>(null);
  const rightPctRef = useRef<HTMLSpanElement>(null);
  const totalTrackRef = useRef<HTMLDivElement>(null);
  const totalFillRef = useRef<HTMLDivElement>(null);
  const totalHandleRef = useRef<HTMLDivElement>(null);
  const totalCaptionRef = useRef<HTMLSpanElement>(null);

  const engineRef = useRef<{
    beadDragStart: (clientX: number) => void;
    beadDragMove: (clientX: number) => void;
    beadDragEnd: () => void;
    totalDragStart: (clientX: number) => void;
    totalDragMove: (clientX: number) => void;
    totalDragEnd: () => void;
    wheelTotal: (deltaPercent: number) => void;
    syncRatio: (v: number) => void;
    syncTotal: (v: number) => void;
  } | null>(null);

  useEffect(() => {
    const wireBox = wireBoxRef.current;
    const path = pathRef.current;
    const bead = beadRef.current;
    const leftPct = leftPctRef.current;
    const rightPct = rightPctRef.current;
    const totalTrack = totalTrackRef.current;
    const totalFill = totalFillRef.current;
    const totalHandle = totalHandleRef.current;
    const totalCaption = totalCaptionRef.current;
    if (
      !wireBox ||
      !path ||
      !bead ||
      !leftPct ||
      !rightPct ||
      !totalTrack ||
      !totalFill ||
      !totalHandle ||
      !totalCaption
    )
      return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let raf = 0;
    let last = 0;
    let visible = true;
    let scaleX = 1;
    let scaleY = 1;
    let sized = false;

    // -- hot-path state ------------------------------------------------------
    let aRatio = ratioRef.current; // animated ratio (0-100), what the bead reads
    let rv = 0; // ratio velocity
    let ratioTarget = ratioRef.current;
    let draggingRatio = false;
    let committedRatio = ratioRef.current; // dedupes onRatioChange during a drag

    let aDepth = MAX_DEPTH * (1 - totalRef.current / 100);
    let dv = 0; // depth velocity
    let depthTarget = aDepth;
    let tautAt = -1; // performance.now() when a taut-snap wobble started, -1 = none
    let tautFrom = 0;
    let draggingTotal = false;
    // hot-path mirror of the committed total, for immediate render feedback —
    // kept separate from totalRef (the React-state mirror) so drag/wheel
    // handlers never race the commit function's own dedup check
    let liveTotal = totalRef.current;

    let deadline = 0;

    const anchors = () => ({
      p0: { x: ANCHOR_X, y: WIRE_Y },
      p2: { x: VB_W - ANCHOR_X, y: WIRE_Y },
    });

    const tableFor = (depth: number) => {
      const { p0, p2 } = anchors();
      const p1 = { x: (p0.x + p2.x) / 2, y: WIRE_Y + depth };
      return { table: buildTable(p0, p1, p2), p0, p1, p2 };
    };

    const render = () => {
      const { table, p0, p1, p2 } = tableFor(aDepth);
      path.setAttribute(
        "d",
        `M ${p0.x} ${p0.y} Q ${p1.x} ${p1.y} ${p2.x} ${p2.y}`
      );
      const bp = pointAtFraction(table, aRatio / 100);
      bead.style.transform = `translate3d(${(bp.x * scaleX).toFixed(2)}px, ${(
        bp.y * scaleY
      ).toFixed(2)}px, 0) translate(-50%, -50%)`;

      const leftRounded = Math.round(aRatio);
      leftPct.textContent = `${leftRounded}%`;
      rightPct.textContent = `${100 - leftRounded}%`;

      const totalRounded = clamp(Math.round(liveTotal), 0, 100);
      totalCaption.textContent = `${totalRounded}%`;
      totalFill.style.width = `${totalRounded}%`;
      totalHandle.style.left = `${totalRounded}%`;
    };

    const resize = () => {
      const rect = wireBox.getBoundingClientRect();
      if (rect.width < 40 || rect.height < 20) {
        sized = false;
        return;
      }
      scaleX = rect.width / VB_W;
      scaleY = rect.height / VB_H;
      sized = true;
      render();
    };
    resize();

    const loop = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(0.033, (now - last) / 1000) : 1 / 60;
      last = now;
      let active = false;

      // ratio: pinned to pointer while dragging, otherwise a plain glide
      if (!draggingRatio) {
        const c = 2 * RATIO_ZETA * Math.sqrt(RATIO_K);
        rv += (-RATIO_K * (aRatio - ratioTarget) - c * rv) * dt;
        aRatio += rv * dt;
        if (Math.abs(aRatio - ratioTarget) < 0.05 && Math.abs(rv) < 0.5) {
          aRatio = ratioTarget;
          rv = 0;
        } else active = true;
      }

      // depth: either the scripted taut-snap wobble, or a plain damped glide
      if (tautAt >= 0) {
        const p = clamp((now - tautAt) / TAUT_MS, 0, 1);
        if (p >= 1) {
          aDepth = 0;
          dv = 0;
          tautAt = -1;
        } else {
          aDepth =
            tautFrom *
            Math.exp(-TAUT_DECAY * p) *
            Math.cos(2 * Math.PI * TAUT_CYCLES * p);
          active = true;
        }
      } else {
        // eases toward depthTarget on EVERY total-changing path, including a
        // live drag on the paired track — winching reads as mechanical drag,
        // never a jump cut, so the spring keeps running while draggingTotal
        // is true instead of freezing until pointer-up
        const c = 2 * DEPTH_ZETA * Math.sqrt(DEPTH_K);
        dv += (-DEPTH_K * (aDepth - depthTarget) - c * dv) * dt;
        aDepth += dv * dt;
        if (Math.abs(aDepth - depthTarget) < 0.05 && Math.abs(dv) < 0.5) {
          aDepth = depthTarget;
          dv = 0;
        } else active = true;
      }

      if (active && now > deadline) {
        aRatio = ratioTarget;
        rv = 0;
        if (tautAt < 0) {
          aDepth = depthTarget;
          dv = 0;
        }
        active = false;
      }

      if (sized) render();
      if (active && visible && !document.hidden) {
        raf = requestAnimationFrame(loop);
      }
    };

    const wake = () => {
      if (!raf && sized) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const armDeadline = () => {
      deadline = performance.now() + SETTLE_MS;
    };

    const setRatioTarget = (v: number) => {
      ratioTarget = v;
      if (reduced) {
        aRatio = v;
        rv = 0;
        if (sized) render();
        return;
      }
      armDeadline();
      wake();
    };

    // Every path that changes the total (drag on the paired track, wheel/
    // pinch on the wire, keyboard) routes through here so the sag always
    // eases rather than teleporting — including while actively dragging the
    // total track, so "winching" reads as mechanical, not instant. That is
    // also what lets the taut-snap wobble fire on drag: the transition is
    // detected the moment the eased depth's TARGET reaches zero, while the
    // animated depth itself is still mid-glide and has real energy to decay.
    const setTotalTarget = (v: number) => {
      const wasFull = depthTarget <= 0.01;
      depthTarget = MAX_DEPTH * (1 - v / 100);
      const nowFull = depthTarget <= 0.01;
      if (reduced) {
        aDepth = depthTarget;
        dv = 0;
        tautAt = -1;
        if (sized) render();
        return;
      }
      if (nowFull && !wasFull && tautAt < 0) {
        // landing on a fully-committed total plucks the wire taut — two
        // decaying tension oscillations from wherever the sag currently is
        tautFrom = aDepth;
        tautAt = performance.now();
      }
      armDeadline();
      wake();
    };

    // -- bead drag: arc-length projection of the pointer onto the CURRENT
    // curve shape, so the bead genuinely rides whatever sag is on screen --
    const beadDragStart = (clientX: number) => {
      if (!sized) return;
      draggingRatio = true;
      beadDragMove(clientX);
    };
    const beadDragMove = (clientX: number) => {
      if (!sized || !draggingRatio) return;
      const rect = wireBox.getBoundingClientRect();
      const x = (clientX - rect.left) / scaleX;
      const { table } = tableFor(aDepth);
      const f = fractionForX(table, x);
      aRatio = f * 100;
      rv = 0;
      const q = clamp(Math.round(aRatio), 0, 100);
      ratioTarget = q;
      if (q !== committedRatio) {
        committedRatio = q;
        commitRatioRef.current(q);
      }
      armDeadline();
      if (sized) render();
    };
    const beadDragEnd = () => {
      if (!draggingRatio) return;
      draggingRatio = false;
      ratioTarget = clamp(Math.round(aRatio), 0, 100);
      aRatio = ratioTarget;
      armDeadline();
      wake();
    };

    // -- total drag: linear along the paired track ---------------------------
    const totalDragStart = (clientX: number) => {
      if (!sized) return;
      draggingTotal = true;
      totalDragMove(clientX);
    };
    const totalDragMove = (clientX: number) => {
      if (!draggingTotal) return;
      const rect = totalTrack.getBoundingClientRect();
      const f = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
      const v = clamp(Math.round(f * 100), 0, 100);
      liveTotal = v; // reflected immediately for the caption/fill/handle
      commitTotalRef.current(v);
      setTotalTarget(v); // eases like every other total-changing path
    };
    const totalDragEnd = () => {
      if (!draggingTotal) return;
      draggingTotal = false;
      setTotalTarget(liveTotal); // idempotent — already the drag target
    };

    const wheelTotal = (deltaPercent: number) => {
      const next = clamp(Math.round(liveTotal + deltaPercent), 0, 100);
      if (next === liveTotal) return;
      liveTotal = next;
      commitTotalRef.current(next);
      setTotalTarget(next);
    };

    // external/keyboard commits: glide to the new value unless that axis is
    // mid-drag, in which case the pointer already owns it this frame
    const syncRatio = (v: number) => {
      if (draggingRatio) return;
      committedRatio = v;
      setRatioTarget(v);
    };
    const syncTotal = (v: number) => {
      if (draggingTotal) return;
      liveTotal = v;
      setTotalTarget(v);
    };

    engineRef.current = {
      beadDragStart,
      beadDragMove,
      beadDragEnd,
      totalDragStart,
      totalDragMove,
      totalDragEnd,
      wheelTotal,
      syncRatio,
      syncTotal,
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wireBox);
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) wake();
    });
    io.observe(wireBox);
    const onVis = () => {
      if (!document.hidden) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    // React registers wheel listeners as passive by default, so a synthetic
    // onWheel prop can never call preventDefault without throwing — bind a
    // real non-passive listener instead so scroll/pinch on the wire can
    // actually consume the gesture instead of also scrolling the page.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // trackpad pinch reports as a wheel event with ctrlKey set
      const scale = e.ctrlKey ? 0.6 : 0.15;
      engineRef.current?.wheelTotal(-e.deltaY * scale);
    };
    wireBox.addEventListener("wheel", onWheel, { passive: false });

    // keep the animated targets aligned with external/committed value changes
    setRatioTarget(ratioRef.current);
    setTotalTarget(totalRef.current);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      wireBox.removeEventListener("wheel", onWheel);
      engineRef.current = null;
    };
    // mount-only: geometry constants are module-level, external value syncs
    // are handled by the effects below via engineRef.syncRatio/syncTotal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // external/keyboard ratio and total changes glide toward the new value
  // (a live drag on that same axis already owns the frame and is skipped)
  useEffect(() => {
    engineRef.current?.syncRatio(ratioValue);
  }, [ratioValue]);
  useEffect(() => {
    engineRef.current?.syncTotal(totalValue);
  }, [totalValue]);

  // -- keyboard: bead ("Split") ----------------------------------------------
  const onBeadKeyDown = (e: React.KeyboardEvent) => {
    const v = ratioRef.current;
    let next: number | null = null;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = v + 1;
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = v - 1;
        break;
      case "PageUp":
        next = v + 10;
        break;
      case "PageDown":
        next = v - 10;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = 100;
        break;
      default:
        return;
    }
    e.preventDefault();
    next = clamp(next, 0, 100);
    if (next !== v) commitRatioRef.current(next);
  };

  // -- keyboard: "Total allocated" -------------------------------------------
  const onTotalKeyDown = (e: React.KeyboardEvent) => {
    const v = totalRef.current;
    let next: number | null = null;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = v + 1;
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = v - 1;
        break;
      case "PageUp":
        next = v + 10;
        break;
      case "PageDown":
        next = v - 10;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = 100;
        break;
      default:
        return;
    }
    e.preventDefault();
    next = clamp(next, 0, 100);
    if (next !== v) commitTotalRef.current(next);
  };

  const leftPctNow = Math.round(ratioValue);
  const rightPctNow = 100 - leftPctNow;
  const totalNow = Math.round(totalValue);
  const beadValueText = `${leftPctNow}% ${leftLabel.toLowerCase()}, ${rightPctNow}% ${rightLabel.toLowerCase()}`;
  const totalValueText = `${totalNow}% of budget allocated`;

  return (
    <div className={`w-full select-none ${className}`}>
      <div
        ref={wireBoxRef}
        className="group relative h-28 w-full touch-none"
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          beadRef.current?.focus({ preventScroll: true });
          engineRef.current?.beadDragStart(e.clientX);
          setRatioActive(true);
        }}
        onPointerMove={(e) => engineRef.current?.beadDragMove(e.clientX)}
        onPointerUp={() => {
          engineRef.current?.beadDragEnd();
          setRatioActive(false);
        }}
        onPointerCancel={() => {
          engineRef.current?.beadDragEnd();
          setRatioActive(false);
        }}
      >
        <svg
          aria-hidden
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full cursor-ew-resize"
        >
          <path
            ref={pathRef}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          <circle cx={ANCHOR_X} cy={WIRE_Y} r={3} fill="var(--border)" />
          <circle
            cx={VB_W - ANCHOR_X}
            cy={WIRE_Y}
            r={3}
            fill="var(--border)"
          />
        </svg>

        <div
          ref={beadRef}
          role="slider"
          tabIndex={0}
          aria-label="Split"
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={leftPctNow}
          aria-valuetext={beadValueText}
          onKeyDown={onBeadKeyDown}
          onFocus={() => setRatioActive(true)}
          onBlur={() => setRatioActive(false)}
          className="absolute left-0 top-0 h-7 w-7 cursor-grab rounded-full outline-none will-change-transform active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span
            aria-hidden
            data-active={ratioActive}
            className="absolute inset-[3px] rounded-full border border-border bg-background transition-colors duration-150 group-hover:border-foreground/40 data-[active=true]:border-accent"
          />
          <span
            aria-hidden
            className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
          />
        </div>
      </div>

      <div className="flex items-start justify-between px-0.5 pt-1 font-mono">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted">{leftLabel}</span>
          <span
            ref={leftPctRef}
            className="tabular-nums text-sm text-foreground"
          >
            {leftPctNow}%
          </span>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-xs text-muted">{rightLabel}</span>
          <span
            ref={rightPctRef}
            className="tabular-nums text-sm text-foreground"
          >
            {rightPctNow}%
          </span>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between pb-1.5">
          <span className="font-mono text-xs text-muted">
            Total allocated
          </span>
          <span
            ref={totalCaptionRef}
            className="font-mono text-xs tabular-nums text-muted"
          >
            {totalNow}%
          </span>
        </div>
        <div
          ref={totalTrackRef}
          role="slider"
          tabIndex={0}
          aria-label="Total allocated"
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={totalNow}
          aria-valuetext={totalValueText}
          onKeyDown={onTotalKeyDown}
          onFocus={() => setTotalActive(true)}
          onBlur={() => setTotalActive(false)}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            engineRef.current?.totalDragStart(e.clientX);
            setTotalActive(true);
          }}
          onPointerMove={(e) => engineRef.current?.totalDragMove(e.clientX)}
          onPointerUp={() => {
            engineRef.current?.totalDragEnd();
            setTotalActive(false);
          }}
          onPointerCancel={() => {
            engineRef.current?.totalDragEnd();
            setTotalActive(false);
          }}
          className="relative h-4 w-full cursor-ew-resize touch-none outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="absolute left-0 top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-border" />
          <div
            ref={totalFillRef}
            className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-foreground/70"
            style={{ width: `${totalNow}%` }}
          />
          <div
            ref={totalHandleRef}
            data-active={totalActive}
            style={{ left: `${totalNow}%` }}
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-background transition-colors duration-150 data-[active=true]:border-accent"
          />
        </div>
      </div>
    </div>
  );
}
