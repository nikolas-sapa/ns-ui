"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// PneumaticCarrierDispatch — a dispatch/job-queue tray drawn as a pneumatic
// tube transport (bank teller line, hospital lab network): a loaded carrier
// launches on blower pressure, cruises near top speed, then brakes against a
// trapped air cushion at the receiving end and thunks softly into a catch
// tray. Three independent lanes run staggered, self-timed cycles — each
// lane's carrier sits loaded at its station, launches, flies, settles into
// the shared tray, then reloads and waits for its next dispatch — so no
// external "value" prop is required for the loop to stay alive.
//
// Per-lane motion is a pure function of elapsed ms since that lane's launch
// (launch accel -> cruise -> cushion decel -> settle bounce), reused
// verbatim by the live rAF loop and by the reduced-motion path, which fast-
// forwards the same step function with a seeded RNG until the tray reaches a
// legible mid-fill state and a carrier has just settled, then stops and
// renders once. All geometry is imperative `setAttribute` writes on a fixed
// pool of SVG elements (3 carriers + 6 tray pips) — React state never
// touches the 60fps path.
// ---------------------------------------------------------------------------

const LANE_COUNT = 3;
const TRAY_SLOTS = 6;

const DISPATCH_INTERVAL = 2600; // ms — average time between a lane's launches
const DISPATCH_JITTER = 0.15; // +/- fraction of DISPATCH_INTERVAL

const LAUNCH_MS = 180; // 0 -> 0.85*cruise velocity, ease-in
const CRUISE_END_MS = 790; // constant-velocity cruise ends here
const CUSHION_END_MS = 1050; // trapped air-cushion decel ends here (arrival)
const SETTLE_END_MS = 1140; // thunk micro-bounce ends here

const LAUNCH_LEN = 0.18; // fraction of tube length covered by launch phase
const CRUISE_LEN_END = 0.88; // + cruise phase brings it to 88%
const CUSHION_TAU = 70; // ms — cushion decay time constant

const BOUNCE_PX = 3; // thunk overshoot
const FLASH_MS = 220; // tray-pip arrival flash duration

const PREROLL_MS = 21000; // tape/tray never empty at t0
const REDUCED_TARGET_FILLED = 4; // freeze once this many tray pips are lit

function smoothstep(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fraction (0..1) of tube length covered, as a pure function of elapsed ms
 * since launch. Shared by the live loop and the reduced-motion simulate
 * pass. Clamped at 1 once the cushion phase ends (arrival). */
function lenFraction(elapsed: number): number {
  if (elapsed <= 0) return 0;
  if (elapsed <= LAUNCH_MS) {
    const t = elapsed / LAUNCH_MS;
    return LAUNCH_LEN * t * t; // ease-in accel
  }
  if (elapsed <= CRUISE_END_MS) {
    const t = (elapsed - LAUNCH_MS) / (CRUISE_END_MS - LAUNCH_MS);
    return LAUNCH_LEN + (CRUISE_LEN_END - LAUNCH_LEN) * t; // constant velocity
  }
  if (elapsed <= CUSHION_END_MS) {
    const span = CUSHION_END_MS - CRUISE_END_MS;
    const u = (elapsed - CRUISE_END_MS) / span;
    const k = span / CUSHION_TAU;
    const raw = 1 - Math.exp(-u * k);
    const rawMax = 1 - Math.exp(-k);
    const norm = rawMax > 0 ? raw / rawMax : 1;
    return CRUISE_LEN_END + (1 - CRUISE_LEN_END) * norm; // cushion decel
  }
  return 1;
}

/** Vertical thunk offset (px) for ms elapsed since the cushion phase ended
 * (i.e. since arrival at the tray). 0 outside [0, SETTLE_END_MS-CUSHION_END_MS]. */
function bounceOffset(sinceArrival: number): number {
  const span = SETTLE_END_MS - CUSHION_END_MS;
  if (sinceArrival < 0 || sinceArrival > span) return 0;
  const u = sinceArrival / span;
  return BOUNCE_PX * Math.exp(-4.5 * u) * Math.cos(2 * Math.PI * 1.6 * u);
}

interface LaneState {
  cycleLen: number; // ms — this lane's current jittered dispatch interval
  clock: number; // ms — elapsed within the current cycle, 0 at launch
}

interface PipState {
  filled: boolean;
  flashStart: number; // ms on the shared clock, -Infinity if never flashed
}

export interface PneumaticCarrierDispatchProps {
  /** shown above the tube run as a small mono label */
  label?: string;
  /** hover-triggered "N in transit / M delivered" readout */
  showReadout?: boolean;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function PneumaticCarrierDispatch({
  label = "DISPATCH",
  showReadout = true,
  className = "",
}: PneumaticCarrierDispatchProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tubeGroupRef = useRef<SVGGElement>(null);
  const carrierRefs = useRef<(SVGRectElement | null)[]>([]);
  const pipRefs = useRef<(SVGRectElement | null)[]>([]);
  const [hovered, setHovered] = useState(false);
  const [readout, setReadout] = useState({ inTransit: 0, delivered: 0 });

  useEffect(() => {
    const root = rootRef.current;
    const svg = svgRef.current;
    const tubeGroup = tubeGroupRef.current;
    if (!root || !svg || !tubeGroup) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let disposed = false;
    let visible = true;
    let raf = 0;
    let last = 0;

    let W = 0;
    let H = 0;
    let stationX = 0;
    let trayX = 0;
    let laneY: number[] = [];
    let carrierW = 8;
    let carrierH = 5;

    const lanes: LaneState[] = Array.from({ length: LANE_COUNT }, () => ({ cycleLen: DISPATCH_INTERVAL, clock: 0 }));
    const pips: PipState[] = Array.from({ length: TRAY_SLOTS }, () => ({ filled: false, flashStart: -Infinity }));
    let deliveredCount = 0;
    let clock = 0; // ms, running total since mount/resize

    const rollInterval = (rand: () => number) =>
      DISPATCH_INTERVAL * (1 + (rand() * 2 - 1) * DISPATCH_JITTER);

    const measure = () => {
      const rect = root.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      const S = Math.max(1, Math.min(W, H));
      stationX = Math.max(14, W * 0.1);
      trayX = W * 0.78;
      const laneMargin = H * 0.14;
      const laneSpan = H - laneMargin * 2;
      laneY = Array.from({ length: LANE_COUNT }, (_, i) => laneMargin + (laneSpan * i) / (LANE_COUNT - 1));
      carrierH = Math.max(4, Math.min(S * 0.05, 9));
      carrierW = carrierH * 2.1;
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    };

    /** Advance one lane's clock by dtMs. Returns true if a carrier arrived
     * (crossed CUSHION_END_MS) during this step — the tray-pip trigger. */
    const advanceLane = (lane: LaneState, dtMs: number, rand: () => number): boolean => {
      const prev = lane.clock;
      lane.clock += dtMs;
      const arrived = prev < CUSHION_END_MS && lane.clock >= CUSHION_END_MS;
      if (lane.clock >= lane.cycleLen) {
        lane.clock -= lane.cycleLen;
        lane.cycleLen = rollInterval(rand);
      }
      return arrived;
    };

    const advance = (dtMs: number, rand: () => number) => {
      for (const lane of lanes) {
        if (advanceLane(lane, dtMs, rand)) {
          deliveredCount += 1;
          const slot = pips[(deliveredCount - 1) % TRAY_SLOTS];
          if (slot) {
            slot.filled = true;
            slot.flashStart = clock;
          }
        }
      }
    };

    const render = (nowMs: number) => {
      let inTransit = 0;
      for (let i = 0; i < LANE_COUNT; i++) {
        const lane = lanes[i];
        const el = carrierRefs.current[i];
        if (!lane || !el) continue;
        const flying = lane.clock <= SETTLE_END_MS;
        if (flying) inTransit += 1;
        const frac = flying ? lenFraction(lane.clock) : 1;
        const x = flying ? stationX + frac * (trayX - stationX) : stationX;
        const y = laneY[i] ?? H / 2;
        const bounce = lane.clock > CUSHION_END_MS ? bounceOffset(lane.clock - CUSHION_END_MS) : 0;
        el.setAttribute(
          "transform",
          `translate(${(x - carrierW / 2).toFixed(1)} ${(y - carrierH / 2 + bounce).toFixed(1)})`,
        );
        el.setAttribute("opacity", flying ? "1" : "0.55");
      }
      for (let i = 0; i < TRAY_SLOTS; i++) {
        const pip = pips[i];
        const el = pipRefs.current[i];
        if (!pip || !el) continue;
        if (!pip.filled) {
          el.setAttribute("opacity", "0");
          continue;
        }
        const sinceFlash = nowMs - pip.flashStart;
        const flash = sinceFlash >= 0 && sinceFlash < FLASH_MS ? 1 - smoothstep(sinceFlash / FLASH_MS) : 0;
        el.setAttribute("opacity", String(0.55 + 0.45 * flash));
      }
      setReadout((r) => (r.inTransit === inTransit && r.delivered === deliveredCount ? r : { inTransit, delivered: deliveredCount }));
    };

    const buildStaticShapes = () => {
      while (tubeGroup.firstChild) tubeGroup.removeChild(tubeGroup.firstChild);
      const ns = "http://www.w3.org/2000/svg";

      for (let i = 0; i < LANE_COUNT; i++) {
        const y = laneY[i] ?? H / 2;
        const tube = document.createElementNS(ns, "line");
        tube.setAttribute("x1", stationX.toFixed(1));
        tube.setAttribute("x2", trayX.toFixed(1));
        tube.setAttribute("y1", y.toFixed(1));
        tube.setAttribute("y2", y.toFixed(1));
        tube.setAttribute("stroke", "var(--ns-muted)");
        tube.setAttribute("stroke-width", String(carrierH * 1.3));
        tube.setAttribute("stroke-linecap", "round");
        tube.setAttribute("opacity", "0.4");
        tubeGroup.appendChild(tube);

        const station = document.createElementNS(ns, "rect");
        const stW = carrierW * 0.9;
        const stH = carrierH * 2.2;
        station.setAttribute("x", (stationX - stW / 2).toFixed(1));
        station.setAttribute("y", (y - stH / 2).toFixed(1));
        station.setAttribute("width", stW.toFixed(1));
        station.setAttribute("height", stH.toFixed(1));
        station.setAttribute("fill", "none");
        station.setAttribute("stroke", "var(--border)");
        station.setAttribute("stroke-width", "1");
        tubeGroup.appendChild(station);
      }

      const trayTop = (laneY[0] ?? 0) - carrierH * 2;
      const trayBottom = (laneY[laneY.length - 1] ?? H) + carrierH * 2;
      const tray = document.createElementNS(ns, "rect");
      tray.setAttribute("x", (trayX - carrierW * 0.4).toFixed(1));
      tray.setAttribute("y", trayTop.toFixed(1));
      tray.setAttribute("width", (W - trayX + carrierW * 0.4 - 4).toFixed(1));
      tray.setAttribute("height", (trayBottom - trayTop).toFixed(1));
      tray.setAttribute("fill", "none");
      tray.setAttribute("stroke", "var(--border)");
      tray.setAttribute("stroke-width", "1");
      tray.setAttribute("rx", "2");
      tubeGroup.appendChild(tray);
    };

    const layoutCarriersAndPips = () => {
      for (let i = 0; i < LANE_COUNT; i++) {
        const el = carrierRefs.current[i];
        if (!el) continue;
        el.setAttribute("width", carrierW.toFixed(1));
        el.setAttribute("height", carrierH.toFixed(1));
      }
      const trayTop = (laneY[0] ?? 0) - carrierH * 2;
      const trayBottom = (laneY[laneY.length - 1] ?? H) + carrierH * 2;
      const trayInnerX = trayX - carrierW * 0.4 + 4;
      const trayInnerW = W - trayX + carrierW * 0.4 - 12;
      const cols = 3;
      const rows = Math.ceil(TRAY_SLOTS / cols);
      const cellW = trayInnerW / cols;
      const cellH = (trayBottom - trayTop) / (rows + 1);
      for (let i = 0; i < TRAY_SLOTS; i++) {
        const el = pipRefs.current[i];
        if (!el) continue;
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = trayInnerX + cellW * (col + 0.5);
        const cy = trayTop + cellH * (row + 1);
        el.setAttribute("x", (cx - 2.5).toFixed(1));
        el.setAttribute("y", (cy - 2.5).toFixed(1));
      }
    };

    const resetAndBuild = () => {
      measure();
      buildStaticShapes();
      layoutCarriersAndPips();
    };

    const startLive = () => {
      resetAndBuild();
      const rand = Math.random;
      for (let i = 0; i < LANE_COUNT; i++) {
        lanes[i] = { cycleLen: rollInterval(rand), clock: -(i * (DISPATCH_INTERVAL / LANE_COUNT)) };
        // negative starting clock staggers lanes; advance() below will wrap
        // any negative values forward as the pre-roll runs.
        if (lanes[i]!.clock < 0) lanes[i]!.clock += lanes[i]!.cycleLen;
      }
      for (const p of pips) {
        p.filled = false;
        p.flashStart = -Infinity;
      }
      deliveredCount = 0;
      clock = 0;
      let t = 0;
      const step = 16;
      while (t < PREROLL_MS) {
        advance(step, rand);
        clock = t;
        t += step;
      }
      clock = t;
      last = 0;
      render(clock);
      if (!raf) raf = requestAnimationFrame(loop);
    };

    const loop = (now: number) => {
      raf = 0;
      if (!visible) return;
      if (last === 0) last = now;
      const dt = Math.min(80, now - last);
      last = now;
      clock += dt;
      advance(dt, Math.random);
      render(clock);
      raf = requestAnimationFrame(loop);
    };

    const runReduced = () => {
      resetAndBuild();
      const rand = mulberry32(0x9c17a2f1);
      for (let i = 0; i < LANE_COUNT; i++) {
        lanes[i] = { cycleLen: rollInterval(rand), clock: 0 };
      }
      for (const p of pips) {
        p.filled = false;
        p.flashStart = -Infinity;
      }
      deliveredCount = 0;
      let t = 0;
      const dt = 8;
      const hardCap = 60000;
      while (t < hardCap && deliveredCount < REDUCED_TARGET_FILLED) {
        advance(dt, rand);
        t += dt;
        clock = t;
      }
      render(clock);
    };

    if (reduced) {
      runReduced();
    } else {
      startLive();
    }

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (disposed) return;
        cancelAnimationFrame(raf);
        raf = 0;
        if (reduced) runReduced();
        else startLive();
      }, 120);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(root);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !reduced && !raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(root);

    document.fonts?.ready?.then(() => {
      if (!disposed) onResize();
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      window.clearTimeout(resizeTimer);
      ro.disconnect();
      io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={rootRef}
      className={`relative overflow-hidden rounded-md border border-border bg-surface ${className}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center justify-between px-4 pt-3">
        <p className="font-mono text-[11px] tracking-widest text-ns-muted">{label}</p>
        {showReadout && (
          <p
            className="font-mono text-[11px] text-ns-muted transition-opacity duration-200"
            style={{ opacity: hovered ? 1 : 0 }}
          >
            {readout.inTransit} in transit / <span className="text-foreground">{readout.delivered}</span> delivered
          </p>
        )}
      </div>
      <svg ref={svgRef} className="h-full w-full" style={{ minHeight: 160 }} aria-hidden="true" focusable="false">
        <g ref={tubeGroupRef} />
        <g>
          {Array.from({ length: LANE_COUNT }).map((_, i) => (
            <rect
              key={i}
              ref={(el) => {
                carrierRefs.current[i] = el;
              }}
              width={0}
              height={0}
              rx={2}
              fill="var(--foreground)"
              opacity={0}
            />
          ))}
        </g>
        <g>
          {Array.from({ length: TRAY_SLOTS }).map((_, i) => (
            <rect
              key={i}
              ref={(el) => {
                pipRefs.current[i] = el;
              }}
              width={5}
              height={5}
              rx={1}
              fill="var(--foreground)"
              opacity={0}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
