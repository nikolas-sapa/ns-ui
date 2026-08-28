"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// SleeperRenewalRelay — an ambient "processing/refreshing" row indicator
// sourced from mechanised sleeper-renewal trains (railway maintenance-of-way
// engineering): a crawling gang crane lifts one old sleeper clear, swings a
// new one into the gap, and clips the rail down before advancing to the next
// tie, never stopping the line for more than a single swap.
//
// The stack is a fixed 8-row visible window, each row a "sleeper" whose
// vertical size (rowSize) is the container's SMALLER measured dimension
// divided by 8, so the whole panel reads at card scale regardless of the
// host's aspect ratio. A crane carriage rides a gantry line down the left
// edge; a full lift -> swap -> drop -> clip cycle takes 1.3s per row (450ms
// departure arc, 350ms arrival arc, 500ms settled dwell — the last 150ms of
// which slides the carriage on to the next row so it is already positioned
// when that row's own lift begins). Eight rows at 1.3s/row is a 10.4s lap;
// on reaching row 7 the carriage travels straight back to row 0 and the lap
// repeats, unbounded, exactly the "wraps to the top and continues" reading.
//
// Old-vs-new is NOT a binary flag. Every row carries a continuous "wear"
// value derived straight from elapsed time since its most recent completed
// drop: 0 the instant a fresh sleeper lands, ramping back toward 1 (fully
// worn) over the ~10.4s until the crane is due back — so a viewer sees a
// visible gradient across the stack (freshest just behind the crane, most
// worn just ahead of it) rather than a hard on/off flip, and the row the
// crane is CURRENTLY lifting reads its wear from the exact same continuous
// formula, so the departing sleeper's colour is already wherever it had
// smoothly drifted to — no colour ever jumps at a phase boundary. Fill is a
// single `color-mix(in srgb, var(--ns-muted) X%, var(--foreground) (100-X)%)`
// string per row, recomputed every frame; no canvas, no JS colour math, so
// a theme flip repaints for free through the underlying custom properties.
// ---------------------------------------------------------------------------

export interface SleeperRenewalRelayProps {
  /** row / card heading above the panel */
  title?: string;
  /** mono description under the heading */
  description?: string;
  /** freeze the loop at the next settled dwell point (never mid-arc) once true */
  paused?: boolean;
  /** extra classes merged onto the rendered root element */
  className?: string;
  /** inline styles merged onto the root element */
  style?: CSSProperties;
}

const ROWS = 8;
const CYCLE_MS = 1300; // one full lift -> swap -> drop -> clip cycle per row
const RISE_MS = 250; // straight vertical lift, still directly above the gap
const SWING_MS = 200; // sideways kick out to the side wagon
const LIFT_MS = RISE_MS + SWING_MS; // 450 — the visible departure arc
const ENTER_MS = 200; // new sleeper swings in from the gantry side, elevated
const SETTLE_MS = 150; // lowers into the gap with a small clip-down bounce
const DROP_MS = ENTER_MS + SETTLE_MS; // 350 — the visible arrival arc
const DROP_START = LIFT_MS; // 450
const DWELL_START = LIFT_MS + DROP_MS; // 800
const DWELL_MS = CYCLE_MS - DWELL_START; // 500
const TRAVEL_MS = 150; // tail of the dwell — carriage slides on to next row
const LAP_MS = ROWS * CYCLE_MS; // 10400
const WEAR_SPAN_CYCLES = ROWS; // wear ramps 0..1 over one lap since renewal

// reduced-motion freeze: mid rise sub-phase of row 3's departure — old
// sleeper lifted straight up, still directly above its own gap, not yet
// kicked sideways or dropped; rows 0-2 already show a fresher wear value,
// rows 4-7 have never been reached (fully worn) — old-out / new-in-pending
// / clip-pending all visible at once.
const STATIC_ROW = 3;
const STATIC_LOCAL_T = 200;
const STATIC_ELAPSED = STATIC_ROW * CYCLE_MS + STATIC_LOCAL_T;

// mount offset so the very first live frame already shows a wear gradient
// and a mid-swing crane, distinct from the reduced-motion freeze above —
// row 5, 20ms into its 200ms swing sub-phase, rows 0-4 carrying distinct
// wear values.
const INITIAL_OFFSET_MS = 5 * CYCLE_MS + RISE_MS + 20;

const REF_ROW = 32; // reference row size used to scale stroke widths

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function easeOutCubic(t: number): number {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
}
function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function wearColor(wear: number): string {
  const muted = clamp01(wear) * 100;
  const fresh = 100 - muted;
  return `color-mix(in srgb, var(--ns-muted) ${muted.toFixed(1)}%, var(--foreground) ${fresh.toFixed(1)}%)`;
}

/** Continuous 0 (just renewed) .. 1 (fully worn, due again) wear value for
 * a row at a given elapsed time, derived from the most recent completed
 * drop (localT >= DWELL_START) that row ever had — or 1, fixed, if the
 * crane has never reached it yet (only possible during the very first
 * lap). No stored per-row state: fully reconstructible from elapsed time
 * alone, which is what keeps every frame — including a paused resume —
 * exactly continuous. */
function rowWear(row: number, elapsedMs: number): number {
  const dropOffset = row * CYCLE_MS + DWELL_START;
  const num = elapsedMs - dropOffset;
  if (num < 0) return 1;
  const lapsSinceFirstDrop = Math.floor(num / LAP_MS);
  const completionTime = dropOffset + lapsSinceFirstDrop * LAP_MS;
  const sinceMs = elapsedMs - completionTime;
  const cyclesSince = sinceMs / CYCLE_MS;
  return clamp01(cyclesSince / WEAR_SPAN_CYCLES);
}

interface Geometry {
  w: number;
  h: number;
  rowSize: number;
  scale: number;
  stackTop: number;
  gantryX: number;
  railX1: number;
  railX2: number;
  sleeperX1: number;
  sleeperX2: number;
  sleeperH: number;
}

function measureGeometry(w: number, h: number): Geometry {
  const rowSize = Math.max(1, Math.min(w, h) / ROWS);
  const scale = rowSize / REF_ROW;
  const stackHeight = rowSize * ROWS;
  const stackTop = (h - stackHeight) / 2;
  return {
    w,
    h,
    rowSize,
    scale,
    stackTop,
    gantryX: w * 0.08,
    railX1: w * 0.3,
    railX2: w * 0.7,
    sleeperX1: w * 0.14,
    sleeperX2: w * 0.86,
    sleeperH: rowSize * 0.46,
  };
}

function rowCenterY(g: Geometry, row: number): number {
  return g.stackTop + row * g.rowSize + g.rowSize / 2;
}

export function SleeperRenewalRelay({
  title = "Backfilling search index",
  description = "One row swaps at a time — old cleared, new clipped in, never stopping the line.",
  paused = false,
  className = "",
  style,
}: SleeperRenewalRelayProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gantryRef = useRef<SVGLineElement>(null);
  const railRefs = useRef<(SVGLineElement | null)[]>([]);
  const sleeperRefs = useRef<(SVGRectElement | null)[]>([]);
  const tickRefs = useRef<(SVGPathElement | null)[]>([]);
  const gapRef = useRef<SVGRectElement>(null);
  const movingRef = useRef<SVGRectElement>(null);
  const carriageRef = useRef<SVGRectElement>(null);
  const armRef = useRef<SVGLineElement>(null);
  const hookRef = useRef<SVGCircleElement>(null);
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const panel = panelRef.current;
    const svg = svgRef.current;
    if (!panel || !svg) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;
    let visible = true;
    let raf = 0;
    let startTime = performance.now() - INITIAL_OFFSET_MS;
    let frozen = false;
    let frozenElapsed = 0;
    let geom = measureGeometry(panel.clientWidth || 1, panel.clientHeight || 1);

    const setAttrs = (el: Element | null, attrs: Record<string, string>) => {
      if (!el) return;
      for (const k in attrs) el.setAttribute(k, attrs[k]!);
    };

    const layout = () => {
      const rect = panel.getBoundingClientRect();
      geom = measureGeometry(Math.max(1, rect.width), Math.max(1, rect.height));
      const { w, h, gantryX, railX1, railX2, stackTop, rowSize, scale } = geom;
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      svg.setAttribute("width", String(w));
      svg.setAttribute("height", String(h));
      const stackBottom = stackTop + rowSize * ROWS;

      setAttrs(gantryRef.current, {
        x1: String(gantryX),
        x2: String(gantryX),
        y1: String(stackTop),
        y2: String(stackBottom),
        "stroke-width": String(Math.max(0.75, 1 * scale)),
      });
      const rails = railRefs.current;
      [railX1, railX2].forEach((x, i) => {
        setAttrs(rails[i] ?? null, {
          x1: String(x),
          x2: String(x),
          y1: String(stackTop),
          y2: String(stackBottom),
          "stroke-width": String(Math.max(1, 1.25 * scale)),
        });
      });

      for (let r = 0; r < ROWS; r++) {
        const cy = rowCenterY(geom, r);
        setAttrs(sleeperRefs.current[r] ?? null, {
          x: String(geom.sleeperX1),
          y: String(cy - geom.sleeperH / 2),
          width: String(geom.sleeperX2 - geom.sleeperX1),
          height: String(geom.sleeperH),
          rx: String(Math.max(1, 2 * scale)),
        });
        setAttrs(tickRefs.current[r] ?? null, {
          d: tickPath(geom, cy, scale),
          "stroke-width": String(Math.max(0.75, 1.1 * scale)),
        });
      }
      setAttrs(gapRef.current, {
        width: String(geom.sleeperX2 - geom.sleeperX1),
        height: String(geom.sleeperH),
        rx: String(Math.max(1, 2 * scale)),
        "stroke-width": String(Math.max(0.75, 1 * scale)),
      });
      setAttrs(movingRef.current, {
        width: String(geom.sleeperX2 - geom.sleeperX1),
        height: String(geom.sleeperH),
        rx: String(Math.max(1, 2 * scale)),
      });
      setAttrs(carriageRef.current, {
        width: String(Math.max(4, 8 * scale)),
        height: String(Math.max(4, 8 * scale)),
        rx: String(Math.max(0.5, 1.5 * scale)),
      });
      setAttrs(hookRef.current, { r: String(Math.max(1, 2.4 * scale)) });
      setAttrs(armRef.current, { "stroke-width": String(Math.max(0.75, 1.5 * scale)) });
      setAttrs(carriageRef.current, { "stroke-width": String(Math.max(0.75, 1.5 * scale)) });
    };

    function tickPath(g: Geometry, cy: number, scale: number): string {
      const len = Math.max(3, 5 * scale);
      const a = `M ${g.railX1} ${cy - len / 2} L ${g.railX1} ${cy + len / 2}`;
      const b = `M ${g.railX2} ${cy - len / 2} L ${g.railX2} ${cy + len / 2}`;
      return `${a} ${b}`;
    }

    const render = (elapsedMs: number) => {
      const g = geom;
      const cycleIndex = Math.floor(elapsedMs / CYCLE_MS);
      const currentRow = ((cycleIndex % ROWS) + ROWS) % ROWS;
      const localT = elapsedMs - cycleIndex * CYCLE_MS;

      // -- carriage vertical position: rides on the active row until the
      // final TRAVEL_MS of dwell, then eases on to the next row so it is
      // already in place when that row's own lift begins.
      let carriageRow = currentRow;
      let carriageFrac = 0;
      if (localT >= DWELL_START + DWELL_MS - TRAVEL_MS) {
        carriageFrac = easeInOutCubic((localT - (DWELL_START + DWELL_MS - TRAVEL_MS)) / TRAVEL_MS);
      }
      const nextRow = (currentRow + 1) % ROWS;
      const carriageY = lerp(rowCenterY(g, carriageRow), rowCenterY(g, nextRow), carriageFrac);

      // -- static rows: continuous wear-derived fill + tick opacity --
      for (let r = 0; r < ROWS; r++) {
        const isActiveMoving = r === currentRow && localT < DWELL_START;
        const wear = rowWear(r, elapsedMs);
        const rect = sleeperRefs.current[r];
        if (rect) {
          rect.setAttribute("fill", wearColor(wear));
          rect.setAttribute("opacity", isActiveMoving ? "0" : "1");
          rect.removeAttribute("transform");
        }
        const tick = tickRefs.current[r];
        if (tick) {
          const op = clamp01((0.85 - wear) / 0.85) * 0.6;
          tick.setAttribute("opacity", String(op));
        }
      }

      // -- moving sleeper + gap outline + crane arm, only meaningful while
      // the active row is mid lift/drop --
      const restCx = (g.sleeperX1 + g.sleeperX2) / 2;
      const restCy = rowCenterY(g, currentRow);
      const sideReach = g.w * 0.22;

      let dx = 0;
      let dy = 0;
      let rot = 0;
      let opacity = 0;
      let gapOpacity = 0;
      let fill = wearColor(1);
      let hookX = restCx;
      let hookY = restCy;
      let armLen = 1;

      if (localT < LIFT_MS) {
        opacity = 1;
        fill = wearColor(rowWear(currentRow, elapsedMs));
        if (localT < RISE_MS) {
          const u = easeOutCubic(localT / RISE_MS);
          dy = -g.rowSize * 0.9 * u;
          gapOpacity = 0.35 * clamp01((localT - RISE_MS * 0.3) / (RISE_MS * 0.7));
        } else {
          const v = easeInOutCubic((localT - RISE_MS) / SWING_MS);
          dy = -g.rowSize * 0.9 + g.rowSize * 0.3 * v;
          dx = sideReach * v;
          rot = 12 * v;
          opacity = 1 - 0.85 * v;
          gapOpacity = 0.35;
        }
        hookX = restCx + dx;
        hookY = restCy + dy;
      } else if (localT < DWELL_START) {
        const local2 = localT - DROP_START;
        opacity = 1;
        if (local2 < ENTER_MS) {
          const p = easeOutCubic(local2 / ENTER_MS);
          dx = -sideReach * (1 - p);
          dy = -g.rowSize * 0.5 * (1 - p);
          rot = -8 * (1 - p);
          opacity = clamp01(local2 / (ENTER_MS * 0.25));
          const wearAtDropStart = rowWear(currentRow, startOfCycle(cycleIndex) + DROP_START);
          fill = wearColor(lerp(wearAtDropStart, 0, p));
          gapOpacity = 0.35 * (1 - p);
        } else {
          const q = easeOutCubic((local2 - ENTER_MS) / SETTLE_MS);
          dy = g.rowSize * 0.1 * Math.sin(Math.PI * q);
          rot = 3 * Math.sin(Math.PI * q) * (1 - q);
          fill = wearColor(0);
          gapOpacity = 0;
        }
        hookX = restCx + dx;
        hookY = restCy + dy;
      } else {
        // dwell: settled sleeper is the ordinary static row again; the arm
        // rests directly on it until the travel window pulls it away.
        opacity = 0;
        gapOpacity = 0;
        const dwellLocal = localT - DWELL_START;
        if (dwellLocal >= DWELL_MS - TRAVEL_MS) {
          const t = easeInOutCubic((dwellLocal - (DWELL_MS - TRAVEL_MS)) / TRAVEL_MS);
          hookX = lerp(restCx, g.gantryX, t);
          hookY = lerp(restCy - g.rowSize * 0.5, carriageY, t);
          armLen = 1 - t;
        } else {
          hookX = restCx;
          hookY = restCy - g.rowSize * 0.5;
        }
      }

      if (movingRef.current) {
        movingRef.current.setAttribute("fill", fill);
        movingRef.current.setAttribute("opacity", String(opacity));
        movingRef.current.setAttribute(
          "transform",
          `translate(${dx.toFixed(2)} ${dy.toFixed(2)}) rotate(${rot.toFixed(2)} ${restCx.toFixed(2)} ${restCy.toFixed(2)})`
        );
        movingRef.current.setAttribute("x", String(g.sleeperX1));
        movingRef.current.setAttribute("y", String(restCy - g.sleeperH / 2));
      }
      if (gapRef.current) {
        gapRef.current.setAttribute("opacity", String(gapOpacity));
        gapRef.current.setAttribute("x", String(g.sleeperX1));
        gapRef.current.setAttribute("y", String(restCy - g.sleeperH / 2));
      }

      setAttrs(carriageRef.current, {
        x: String(g.gantryX - Math.max(4, 8 * g.scale) / 2),
        y: String(carriageY - Math.max(4, 8 * g.scale) / 2),
      });
      const armOpacity = Math.max(0, Math.min(1, armLen));
      setAttrs(armRef.current, {
        x1: String(g.gantryX),
        y1: String(carriageY),
        x2: String(hookX.toFixed(2)),
        y2: String(hookY.toFixed(2)),
        opacity: String(armOpacity),
      });
      setAttrs(hookRef.current, {
        cx: String(hookX.toFixed(2)),
        cy: String(hookY.toFixed(2)),
        opacity: String(armOpacity),
      });
    };

    function startOfCycle(cycleIndex: number): number {
      return cycleIndex * CYCLE_MS;
    }

    const loop = (now: number) => {
      raf = 0;
      if (!visible) return;
      if (frozen && !pausedRef.current) {
        frozen = false;
        startTime = now - frozenElapsed;
      }
      if (!frozen) {
        const rawElapsed = now - startTime;
        const cycleIndex = Math.floor(rawElapsed / CYCLE_MS);
        const localT = rawElapsed - cycleIndex * CYCLE_MS;
        if (pausedRef.current && localT >= DWELL_START) {
          frozen = true;
          frozenElapsed = rawElapsed;
        }
      }
      const elapsed = frozen ? frozenElapsed : now - startTime;
      render(elapsed);
      raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (raf === 0 && !reduced && visible) raf = requestAnimationFrame(loop);
    };

    layout();
    if (reduced) {
      render(STATIC_ELAPSED);
    } else {
      wake();
    }

    const ro = new ResizeObserver(() => {
      layout();
      render(reduced ? STATIC_ELAPSED : frozen ? frozenElapsed : performance.now() - startTime);
    });
    ro.observe(panel);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) wake();
      else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    io.observe(panel);

    const onReducedChange = () => {
      reduced = mq.matches;
      if (reduced) {
        cancelAnimationFrame(raf);
        raf = 0;
        render(STATIC_ELAPSED);
      } else {
        startTime = performance.now();
        frozen = false;
        wake();
      }
    };
    mq.addEventListener("change", onReducedChange);

    const onVisibility = () => {
      if (document.visibilityState === "visible") wake();
      else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      io.disconnect();
      mq.removeEventListener("change", onReducedChange);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div
      className={`ns-sleeper-renewal-relay flex w-full max-w-sm flex-col gap-3 rounded-[14px] border border-border bg-background p-4 ${className}`}
      style={style}
      data-reduced-motion-freeze="mid-lift"
    >
      <div className="min-w-0">
        <h3 className="text-balance font-sans text-sm font-medium text-foreground">{title}</h3>
        <p className="mt-1 text-pretty font-mono text-xs leading-relaxed text-ns-muted">{description}</p>
      </div>
      <div
        ref={panelRef}
        role="img"
        aria-label="Row renewal in progress"
        className="relative h-56 w-full shrink-0 overflow-hidden rounded-md border border-border bg-background"
      >
        <svg ref={svgRef} aria-hidden="true" className="absolute inset-0 h-full w-full">
          <line ref={gantryRef} stroke="var(--foreground)" strokeOpacity={0.28} />
          <line ref={(el) => { railRefs.current[0] = el; }} stroke="var(--foreground)" strokeOpacity={0.4} />
          <line ref={(el) => { railRefs.current[1] = el; }} stroke="var(--foreground)" strokeOpacity={0.4} />
          {Array.from({ length: ROWS }).map((_, i) => (
            <rect key={i} ref={(el) => { sleeperRefs.current[i] = el; }} fill="var(--foreground)" />
          ))}
          {Array.from({ length: ROWS }).map((_, i) => (
            <path
              key={i}
              ref={(el) => { tickRefs.current[i] = el; }}
              stroke="var(--foreground)"
              strokeLinecap="round"
              fill="none"
            />
          ))}
          <rect
            ref={gapRef}
            fill="none"
            stroke="var(--foreground)"
            strokeDasharray="3 3"
            opacity={0}
          />
          <rect ref={movingRef} opacity={0} />
          <line ref={armRef} stroke="var(--foreground)" strokeLinecap="round" opacity={0} />
          <circle ref={hookRef} fill="var(--foreground)" opacity={0} />
          <rect ref={carriageRef} fill="none" stroke="var(--foreground)" strokeOpacity={0.7} />
        </svg>
      </div>
    </div>
  );
}

SleeperRenewalRelay.displayName = "SleeperRenewalRelay";

export default SleeperRenewalRelay;
