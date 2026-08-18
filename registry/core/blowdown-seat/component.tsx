"use client";

import { useEffect, useId, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// BlowdownSeat — a rate-limiter shed-threshold configurator drawn as a
// spring safety valve cutaway. One governing scalar, P = liveRate / capacity
// (as a %), drives everything: the disc stays seated below `pop`, lifts the
// instant P crosses `pop`, and — this is the whole point — does NOT reseat
// the moment P dips back under `pop`. It only reseats once P falls below the
// separate, lower `reseat` mark. That gap is real hysteresis, not two labels
// on one number: while lifted, `lifted` is pinned true for any P between
// `reseat` and `pop`, exactly like this registry's meter-threshold-trip
// latch, except here the "latch" is a continuously-varying physical lift
// (proportional to how far P sits above `reseat`) rather than a binary pin.
//
// The two thresholds are two real <input type="range"> handles (role=slider
// for free) dragged along a shared vertical pressure ruler — pop above,
// reseat below. A drawn "blowdown ring" spans the gap between them and
// visibly compresses as reseat is dragged up toward pop; it cannot compress
// past a 3-percentage-point floor. That floor is mechanical, not cosmetic:
// each handle's own min/max attribute is pinned live to the OTHER handle's
// current value +/-3 (mirroring slider-range-shear's mutual-clamp
// technique), so keyboard stepping can never build a sub-3% gap either — the
// only way to reach a single-threshold config is to not use this component.
// Pointer drag on the ruler picks whichever handle is nearer, exactly like
// slider-range-shear's proximity arbitration, then clamps to the same floor.
//
// Vent flow, and the shed counter, are both derived from lift — no separate
// state to keep in sync. A crossing-detection effect (edge-triggered off
// `liveRate`, mirroring meter-threshold-trip's latch/re-arm effect) is the
// only thing that ever flips `lifted`; between crossings, lift height and
// shed rate track P continuously so the valve reads as one mechanism, not a
// meter driving a separate counter. The polite live region announces only
// the two edge crossings (vent open / vent closed, with the shed count for
// that cycle) — never a per-frame update, so it stays legible under a
// realistic +/-2% noisy signal. The valve drawing itself is aria-hidden; the
// two range inputs plus that live region plus a plain-language status
// paragraph carry the entire accessible surface. DOM+SVG+CSS only, no
// canvas — every stroke/fill is a token utility class, no hex.
// ---------------------------------------------------------------------------

export interface BlowdownSeatProps {
  /** upstream capacity, requests/sec — 100% on the pressure ruler */
  capacity?: number;
  /** live incoming request rate, requests/sec. P = liveRate / capacity drives the whole mechanism. */
  liveRate: number;
  /** shed-start threshold, % of capacity (controlled) */
  pop?: number;
  /** uncontrolled initial shed-start threshold, % of capacity (default 85) */
  defaultPop?: number;
  /** shed-stop threshold, % of capacity (controlled) — mechanically clamped to at most pop - 3 */
  reseat?: number;
  /** uncontrolled initial shed-stop threshold, % of capacity (default 79) */
  defaultReseat?: number;
  /** called with the new pop %, on drag or keyboard commit */
  onPopChange?: (pct: number) => void;
  /** called with the new reseat %, on drag or keyboard commit */
  onReseatChange?: (pct: number) => void;
  /** ceiling of the pressure ruler, % of capacity (default 130) */
  scaleMax?: number;
  /** label above the diagram, e.g. "Gateway limiter" */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

// geometry, SVG viewBox units. Rendered at a fixed pixel height equal to
// VIEW_H (see the <svg> below) so pointer math never needs a scale factor.
const VIEW_W = 240;
const VIEW_H = 300;
const RULER_X = 54;
const Y_TOP = 26; // scaleMax's y
const Y_BOT = 256; // 0's y
const VALVE_X = 168;
const BODY_TOP_Y = 44;
const BODY_BOT_Y = 256;
const BONNET_TOP_Y = BODY_TOP_Y - 28;
const SEAT_Y = 204;
const MAX_LIFT = 40; // px the disc can rise above the seat, fully lifted
const SPRING_TOP_Y = 92;
const NOZZLE_X1 = VALVE_X + 38;
const NOZZLE_X2 = NOZZLE_X1 + 34;
const MIN_GAP = 3; // percentage points — the hysteresis floor, hard constant

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function buildZigzag(x: number, y0: number, y1: number, loops: number, amp: number) {
  const n = loops * 2;
  const pts: string[] = [`${x} ${y0}`];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const y = y0 + (y1 - y0) * t;
    const xx = x + (i % 2 === 1 ? amp : -amp);
    pts.push(`${xx.toFixed(1)} ${y.toFixed(1)}`);
  }
  pts.push(`${x} ${y1}`);
  return pts.join(" L ");
}
const SPRING_D = `M ${buildZigzag(VALVE_X, SPRING_TOP_Y, SEAT_Y - 10, 5, 9)}`;

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

type Handle = "pop" | "reseat";
type LiftKind = "lift" | "settle" | "track";

function liftTransition(kind: LiftKind, reduced: boolean) {
  if (reduced) return { transitionDuration: "0ms" };
  if (kind === "lift") {
    // stiff spring popping off the seat — brief overshoot
    return { transitionDuration: "260ms", transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" };
  }
  if (kind === "settle") {
    // slower, no-overshoot settle back onto the seat
    return { transitionDuration: "520ms", transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" };
  }
  return { transitionDuration: "180ms", transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" };
}

export function BlowdownSeat({
  capacity = 1000,
  liveRate,
  pop,
  defaultPop = 85,
  reseat,
  defaultReseat = 79,
  onPopChange,
  onReseatChange,
  scaleMax = 130,
  label = "Gateway limiter",
  className = "",
}: BlowdownSeatProps) {
  const uid = useId();
  const reduced = useReducedMotion();

  const isPopControlled = pop !== undefined;
  const [popState, setPopState] = useState(() => clamp(defaultPop, MIN_GAP, scaleMax));
  const popValue = isPopControlled ? (pop as number) : popState;
  const popRef = useRef(popValue);
  popRef.current = popValue;

  const isReseatControlled = reseat !== undefined;
  const [reseatState, setReseatState] = useState(() =>
    clamp(defaultReseat, 0, clamp(defaultPop, MIN_GAP, scaleMax) - MIN_GAP)
  );
  const reseatValue = isReseatControlled ? (reseat as number) : reseatState;
  const reseatRef = useRef(reseatValue);
  reseatRef.current = reseatValue;

  // defensive clamp: whatever pop/reseat come in as (drag, keyboard, or a
  // misbehaving controlled parent), reseat never gets to sit within 3 points
  // of pop by the time it reaches the physics or the drawing.
  const popEff = clamp(popValue, MIN_GAP, scaleMax);
  const reseatEff = clamp(reseatValue, 0, popEff - MIN_GAP);

  const P = capacity > 0 ? (liveRate / capacity) * 100 : 0;

  const [lifted, setLifted] = useState(() => P >= popEff);
  const [liftKind, setLiftKind] = useState<LiftKind>("track");
  const [shedCycle, setShedCycle] = useState(0);
  const [shedTotal, setShedTotal] = useState(0);
  const [announce, setAnnounce] = useState("");
  const [activeHandle, setActiveHandle] = useState<Handle | null>(null);
  const [focusedHandle, setFocusedHandle] = useState<Handle | null>(null);

  const liftedRef = useRef<boolean | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const shedCycleRef = useRef(0);
  const shedTotalRef = useRef(0);

  const popInputRef = useRef<HTMLInputElement>(null);
  const reseatInputRef = useRef<HTMLInputElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const activeDragRef = useRef<Handle | null>(null);

  const fmtRps = (pct: number) => Math.round((capacity * pct) / 100);

  // -- crossing detection + shed accumulation, edge-triggered off liveRate --
  useEffect(() => {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const p = capacity > 0 ? (liveRate / capacity) * 100 : 0;

    if (liftedRef.current === null) {
      // bootstrap: adopt the mount-time state with no spurious animation or
      // announcement, same reasoning as meter-threshold-trip's mountedRef.
      liftedRef.current = p >= popEff;
      lastTsRef.current = now;
      return;
    }

    const wasLifted = liftedRef.current;
    const dt = lastTsRef.current == null ? 0 : Math.min(0.5, Math.max(0, (now - lastTsRef.current) / 1000));
    lastTsRef.current = now;

    // shed flow for the interval that just elapsed, under whichever state
    // was true through it — not the post-crossing state.
    if (wasLifted) {
      const liftFrac = clamp(0.22 + 0.78 * clamp((p - reseatEff) / Math.max(1, scaleMax - reseatEff), 0, 1), 0, 1);
      const excessRps = Math.max(0, liveRate - (capacity * reseatEff) / 100);
      const sheddedRps = excessRps * liftFrac;
      const add = sheddedRps * dt;
      if (add > 0) {
        shedCycleRef.current += add;
        shedTotalRef.current += add;
        setShedCycle(Math.round(shedCycleRef.current));
        setShedTotal(Math.round(shedTotalRef.current));
      }
    }

    let nowLifted = wasLifted;
    if (!wasLifted && p >= popEff) {
      nowLifted = true;
      setLiftKind("lift");
      shedCycleRef.current = 0;
      setShedCycle(0);
      setAnnounce(`Vent open — shedding above ${fmtRps(popEff)} rps.`);
    } else if (wasLifted && p < reseatEff) {
      nowLifted = false;
      setLiftKind("settle");
      setAnnounce(
        `Vent closed — resumed below ${fmtRps(reseatEff)} rps. Shed ${Math.round(shedCycleRef.current)} requests this vent, ${Math.round(shedTotalRef.current)} total.`
      );
    } else {
      setLiftKind("track");
    }

    if (nowLifted !== wasLifted) {
      liftedRef.current = nowLifted;
      setLifted(nowLifted);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveRate, popEff, reseatEff, capacity, scaleMax]);

  const yFor = (v: number) => Y_TOP + (1 - clamp(v, 0, scaleMax) / scaleMax) * (Y_BOT - Y_TOP);
  const valueFromY = (y: number) => scaleMax * clamp((Y_BOT - y) / (Y_BOT - Y_TOP), 0, 1);
  const quantize = (v: number) => Math.round(clamp(v, 0, scaleMax));

  const commit = (which: Handle, v: number) => {
    if (which === "pop") {
      const next = clamp(v, reseatRef.current + MIN_GAP, scaleMax);
      if (next === popRef.current) return;
      popRef.current = next;
      if (!isPopControlled) setPopState(next);
      onPopChange?.(next);
    } else {
      const next = clamp(v, 0, popRef.current - MIN_GAP);
      if (next === reseatRef.current) return;
      reseatRef.current = next;
      if (!isReseatControlled) setReseatState(next);
      onReseatChange?.(next);
    }
  };

  const pickHandle = (y: number): Handle => {
    const dPop = Math.abs(y - yFor(popRef.current));
    const dReseat = Math.abs(y - yFor(reseatRef.current));
    return dPop <= dReseat ? "pop" : "reseat";
  };

  const svgYFromClient = (clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const scaleY = VIEW_H / Math.max(1, rect.height);
    return (clientY - rect.top) * scaleY;
  };

  const onRulerPointerDown = (e: React.PointerEvent<SVGRectElement>) => {
    const y = svgYFromClient(e.clientY);
    const which = pickHandle(y);
    activeDragRef.current = which;
    setActiveHandle(which);
    e.currentTarget.setPointerCapture(e.pointerId);
    (which === "pop" ? popInputRef : reseatInputRef).current?.focus({ preventScroll: true });
    commit(which, quantize(valueFromY(y)));
    e.preventDefault();
  };
  const onRulerPointerMove = (e: React.PointerEvent<SVGRectElement>) => {
    const which = activeDragRef.current;
    if (!which) return;
    const y = svgYFromClient(e.clientY);
    commit(which, quantize(valueFromY(y)));
  };
  const endRulerDrag = () => {
    activeDragRef.current = null;
    setActiveHandle(null);
  };

  const onFocusVisible = (which: Handle) => (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.matches(":focus-visible")) setFocusedHandle(which);
  };
  const onBlurHandle = (which: Handle) => () => {
    setFocusedHandle((h) => (h === which ? null : h));
  };

  const liftFrac = lifted
    ? clamp(0.22 + 0.78 * clamp((P - reseatEff) / Math.max(1, scaleMax - reseatEff), 0, 1), 0, 1)
    : 0;
  const liftPx = liftFrac * MAX_LIFT;
  const discStyle: React.CSSProperties = {
    transform: `translateY(${(-liftPx).toFixed(2)}px)`,
    ...liftTransition(liftKind, reduced),
  };
  const springStyle: React.CSSProperties = {
    transform: `scaleY(${(1 - liftFrac * 0.32).toFixed(3)})`,
    transformOrigin: `${VALVE_X}px ${SPRING_TOP_Y}px`,
    ...liftTransition(liftKind, reduced),
  };

  const ventDurMs = Math.max(340, Math.round(1300 - liftFrac * 900));

  const popEngaged = activeHandle === "pop" || focusedHandle === "pop";
  const reseatEngaged = activeHandle === "reseat" || focusedHandle === "reseat";

  const yPop = yFor(popEff);
  const yReseat = yFor(reseatEff);
  const yLive = yFor(clamp(P, 0, scaleMax));

  const descId = `${uid}-desc`;
  const liveId = `${uid}-live`;

  const statusText = lifted
    ? `Venting — ${shedCycle} shed this cycle (${shedTotal} total). Resumes below ${fmtRps(reseatEff)} rps.`
    : `Seated — sheds above ${fmtRps(popEff)} rps, resumes below ${fmtRps(reseatEff)} rps.`;

  const popValuetext = `sheds above ${fmtRps(popEff)} rps, resumes below ${fmtRps(reseatEff)} rps`;
  const reseatValuetext = `resumes below ${fmtRps(reseatEff)} rps, sheds above ${fmtRps(popEff)} rps`;

  return (
    <div className={className}>
      <style>{`
.ns-blowdown-glyph{animation:ns-blowdown-vent var(--ns-vent-dur,900ms) linear infinite}
@keyframes ns-blowdown-vent{
  0%{transform:translateX(0);opacity:0}
  18%{opacity:1}
  82%{opacity:1}
  100%{transform:translateX(${NOZZLE_X2 - NOZZLE_X1 - 8}px);opacity:0}
}
@media (prefers-reduced-motion: reduce){
  .ns-blowdown-glyph{animation:none !important;opacity:1}
}
`}</style>

      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[11px] tracking-wide text-ns-muted">{label.toUpperCase()}</span>
        <span className="font-mono text-[11px] tracking-wide text-foreground">
          {lifted ? "VENTING" : "SEATED"}
        </span>
      </div>

      <div className="mt-1 flex items-baseline gap-3">
        <span className="text-2xl font-semibold tabular-nums text-foreground">
          {Math.round(liveRate)}
          <span className="ml-1 text-sm font-normal text-ns-muted">rps</span>
        </span>
        <span className="font-mono text-xs tabular-nums text-ns-muted">{Math.round(P)}% of capacity</span>
      </div>

      <div className="mt-3 flex gap-3">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="h-[300px] w-full"
          aria-hidden
          focusable="false"
        >
          {/* ---- pressure ruler: live P, pop/reseat handles, blowdown ring ---- */}
          <line
            x1={RULER_X}
            x2={RULER_X}
            y1={Y_TOP}
            y2={Y_BOT}
            className="stroke-current text-border"
            strokeWidth={1}
          />
          {[0, 50, 100, scaleMax].map((tick) =>
            tick <= scaleMax ? (
              <g key={tick}>
                <line
                  x1={RULER_X - 4}
                  x2={RULER_X + 4}
                  y1={yFor(tick)}
                  y2={yFor(tick)}
                  className="stroke-current text-border"
                  strokeWidth={1}
                />
                <text
                  x={RULER_X - 8}
                  y={yFor(tick) + 3}
                  textAnchor="end"
                  className="fill-current font-mono text-[8px] text-ns-muted"
                >
                  {tick}
                </text>
              </g>
            ) : null
          )}

          {/* blowdown ring — compresses to exactly the pop/reseat gap */}
          <rect
            x={RULER_X - 9}
            y={yPop}
            width={18}
            height={Math.max(2, yReseat - yPop)}
            rx={3}
            fill="var(--ns-muted)"
            stroke="var(--border)"
            opacity={0.35}
            strokeWidth={1}
          />

          {/* live pressure marker + dashed guide toward the valve */}
          <line
            x1={RULER_X + 14}
            x2={VALVE_X - 42}
            y1={yLive}
            y2={yLive}
            className="stroke-current text-border"
            strokeWidth={1}
            strokeDasharray="2 3"
            opacity={0.6}
          />
          <circle cx={RULER_X} cy={yLive} r={3.5} className="fill-current text-foreground" />

          {/* handles */}
          <g
            style={{
              transform: `translate(${RULER_X - (popEngaged ? 26 : 22)}px, ${yPop}px)`,
              transition: "transform 150ms ease-out",
            }}
          >
            <rect
              x={0}
              y={-4}
              width={popEngaged ? 22 : 18}
              height={8}
              rx={2}
              className={popEngaged ? "fill-current text-foreground" : "fill-current text-foreground opacity-70"}
            />
            {popEngaged && (
              <rect
                x={-2}
                y={-6}
                width={(popEngaged ? 22 : 18) + 4}
                height={12}
                rx={3}
                fill="none"
                className="stroke-current text-ns-accent"
                strokeWidth={2}
              />
            )}
          </g>
          <g
            style={{
              transform: `translate(${RULER_X - (reseatEngaged ? 26 : 22)}px, ${yReseat}px)`,
              transition: "transform 150ms ease-out",
            }}
          >
            <rect
              x={0}
              y={-4}
              width={reseatEngaged ? 22 : 18}
              height={8}
              rx={2}
              fill="none"
              className="stroke-current text-foreground"
              strokeWidth={reseatEngaged ? 2.5 : 1.5}
            />
            {reseatEngaged && (
              <rect
                x={-2}
                y={-6}
                width={(reseatEngaged ? 22 : 18) + 4}
                height={12}
                rx={3}
                fill="none"
                className="stroke-current text-ns-accent"
                strokeWidth={2}
              />
            )}
          </g>

          {/* invisible hit target carrying pointer drag for both handles */}
          <rect
            data-blowdown-seat-track
            x={RULER_X - 30}
            y={Y_TOP - 12}
            width={60}
            height={Y_BOT - Y_TOP + 24}
            fill="transparent"
            className="cursor-grab"
            onPointerDown={onRulerPointerDown}
            onPointerMove={onRulerPointerMove}
            onPointerUp={endRulerDrag}
            onPointerCancel={endRulerDrag}
          />

          {/* ---- valve cutaway ---- */}
          <rect
            x={VALVE_X - 40}
            y={BODY_TOP_Y}
            width={80}
            height={BODY_BOT_Y - BODY_TOP_Y}
            rx={10}
            fill="none"
            className="stroke-current text-border"
            strokeWidth={1.5}
          />
          <rect
            x={VALVE_X - 16}
            y={BONNET_TOP_Y}
            width={32}
            height={BODY_TOP_Y - BONNET_TOP_Y}
            fill="none"
            className="stroke-current text-border"
            strokeWidth={1.5}
          />
          <rect
            x={VALVE_X - 14}
            y={BODY_BOT_Y}
            width={28}
            height={22}
            fill="none"
            className="stroke-current text-border"
            strokeWidth={1.5}
          />

          {/* spring — compresses as the disc lifts */}
          <g style={springStyle}>
            <path d={SPRING_D} fill="none" className="stroke-current text-foreground" strokeWidth={1.5} />
          </g>

          {/* seat rim */}
          <line
            x1={VALVE_X - 32}
            x2={VALVE_X - 18}
            y1={SEAT_Y + 5}
            y2={SEAT_Y + 5}
            className="stroke-current text-border"
            strokeWidth={2}
          />
          <line
            x1={VALVE_X + 18}
            x2={VALVE_X + 32}
            y1={SEAT_Y + 5}
            y2={SEAT_Y + 5}
            className="stroke-current text-border"
            strokeWidth={2}
          />

          {/* disc */}
          <g style={discStyle}>
            <rect
              x={VALVE_X - 28}
              y={SEAT_Y}
              width={56}
              height={9}
              rx={3}
              className={lifted ? "fill-current text-foreground" : "fill-current text-foreground opacity-80"}
            />
          </g>

          {/* vent nozzle */}
          <rect
            x={NOZZLE_X1}
            y={SEAT_Y - 9}
            width={NOZZLE_X2 - NOZZLE_X1}
            height={18}
            fill="none"
            className="stroke-current text-border"
            strokeWidth={1.5}
          />
          {lifted && (
            <g data-blowdown-seat-vent-open>
              {[0, 1, 2].map((i) => (
                <text
                  key={i}
                  x={NOZZLE_X1 + 5}
                  y={SEAT_Y + 4}
                  className="ns-blowdown-glyph fill-current font-mono text-[9px] text-foreground"
                  style={
                    {
                      animationDelay: `${i * (ventDurMs / 3)}ms`,
                      "--ns-vent-dur": `${ventDurMs}ms`,
                    } as React.CSSProperties
                  }
                >
                  &#183;
                </text>
              ))}
            </g>
          )}

          {/* inlet flow arrow */}
          <path
            d={`M ${VALVE_X} ${BODY_BOT_Y + 20} L ${VALVE_X} ${BODY_BOT_Y + 6} M ${VALVE_X - 4} ${BODY_BOT_Y + 11} L ${VALVE_X} ${BODY_BOT_Y + 5} L ${VALVE_X + 4} ${BODY_BOT_Y + 11}`}
            fill="none"
            className="stroke-current text-ns-muted"
            strokeWidth={1.3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-ns-muted">
        <span>reseat {fmtRps(reseatEff)} rps</span>
        <span>pop {fmtRps(popEff)} rps</span>
      </div>

      {/* real, focusable range inputs — the entire keyboard/a11y surface */}
      <div className="mt-2 flex flex-col gap-2">
        <label className="flex items-center justify-between gap-3 font-mono text-[11px] text-ns-muted">
          <span>Shed-start (pop)</span>
          <input
            ref={popInputRef}
            type="range"
            min={reseatEff + MIN_GAP}
            max={scaleMax}
            step={1}
            value={Math.round(popEff)}
            aria-valuetext={popValuetext}
            aria-describedby={descId}
            onChange={(e) => commit("pop", Number(e.target.value))}
            onFocus={onFocusVisible("pop")}
            onBlur={onBlurHandle("pop")}
            className="w-32 accent-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          />
        </label>
        <label className="flex items-center justify-between gap-3 font-mono text-[11px] text-ns-muted">
          <span>Shed-stop (reseat)</span>
          <input
            ref={reseatInputRef}
            type="range"
            min={0}
            max={popEff - MIN_GAP}
            step={1}
            value={Math.round(reseatEff)}
            aria-valuetext={reseatValuetext}
            aria-describedby={descId}
            onChange={(e) => commit("reseat", Number(e.target.value))}
            onFocus={onFocusVisible("reseat")}
            onBlur={onBlurHandle("reseat")}
            className="w-32 accent-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          />
        </label>
      </div>

      <p id={descId} className="mt-2 text-center font-mono text-[11px] text-ns-muted">
        {statusText}
      </p>

      <span id={liveId} role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}
