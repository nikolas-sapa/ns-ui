"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

// ---------------------------------------------------------------------------
// GnomonSet — a time picker as a flat sundial. Two concentric draggable
// rings (role="slider" each): the outer sets the hour, the inner sets
// minutes in 5-minute detents. A gnomon shadow (a soft blurred wedge)
// points at the current hour; its LENGTH is what tells AM from PM (short =
// high sun = AM, long = PM), not a separate control — dragging the hour
// ring continuously past the 12 mark rolls the hour past 11 -> 12 and the
// shadow lengthens, exactly like a real day turning into a real night.
//
// Dragging is the animation hot path: pointermove accumulates a float hour
// (or minute) in a ref and writes the wedge/tick/readout DOM directly —
// no React state per pointer event. The drag's FINAL value is the only
// thing that ever reaches React state (on pointerup), so a keyboard arrow
// press (which legitimately re-renders from state) can never fight a
// stale mid-drag DOM write.
// ---------------------------------------------------------------------------

export interface GnomonSetProps {
  /** 0-23, controlled. */
  hour?: number;
  /** 0-59, controlled — only 5-minute values are reachable via the UI. */
  minute?: number;
  defaultHour?: number;
  defaultMinute?: number;
  onChange?: (hour: number, minute: number) => void;
  className?: string;
}

const VIEW = 160;
const C = 80;
const R_OUT_TICK_OUT = 66;
const R_OUT_TICK_IN = 59;
const R_NUMERAL = 48;
const R_OUT_HIT = 62;
const OUT_BAND = 18;
const R_IN_TICK_OUT = 36;
const R_IN_TICK_IN = 31;
const R_IN_HIT = 34;
const IN_BAND = 12;
const SHADOW_AM = 32;
const SHADOW_PM = 58;
const WEDGE_HALF_DEG = 6;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
// Rounded to a fixed precision: server (Node) and client (browser) trig can
// differ in the last bit or two, which is enough to fail hydration when the
// raw float is serialized into the SSR-ed markup. A few decimals of pixel
// precision is plenty for a 160-unit dial and makes both renders identical.
function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
function pointAt(angleDeg: number, r: number): [number, number] {
  const rad = toRad(angleDeg);
  return [round(C + r * Math.cos(rad)), round(C + r * Math.sin(rad))];
}
function hourAngle(hour24: number): number {
  return -90 + (hour24 % 12) * 30;
}
function minuteAngle(minute: number): number {
  return -90 + (minute / 5) * 30;
}
function shortestDelta(a: number, b: number): number {
  return ((((a - b + 540) % 360) + 360) % 360) - 180;
}
function wrap(n: number, mod: number): number {
  return ((n % mod) + mod) % mod;
}

function wedgePoints(angleDeg: number, length: number): string {
  const [tx, ty] = pointAt(angleDeg, length);
  const [lx, ly] = pointAt(angleDeg - WEDGE_HALF_DEG, length * 0.86);
  const [rx, ry] = pointAt(angleDeg + WEDGE_HALF_DEG, length * 0.86);
  return `${C},${C} ${lx},${ly} ${tx},${ty} ${rx},${ry}`;
}

function formatReadout(hour24: number, minute: number): string {
  const h12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const mm = String(minute).padStart(2, "0");
  const meridiem = hour24 < 12 ? "AM" : "PM";
  return `${String(h12).padStart(2, "0")}:${mm} ${meridiem}`;
}

export function GnomonSet({
  hour,
  minute,
  defaultHour = 9,
  defaultMinute = 0,
  onChange,
  className = "",
}: GnomonSetProps) {
  const autoId = useId();
  const fid = `gs-blur-${autoId.replace(/:/g, "")}`;

  const isControlled = hour !== undefined && minute !== undefined;
  const [uHour, setUHour] = useState(defaultHour);
  const [uMinute, setUMinute] = useState(defaultMinute);
  const curHour = isControlled ? hour! : uHour;
  const curMinute = isControlled ? minute! : uMinute;

  const wedgeRef = useRef<SVGPolygonElement | null>(null);
  const meridiemRef = useRef<SVGTextElement | null>(null);
  const readoutRef = useRef<HTMLSpanElement | null>(null);
  const hourHandleRef = useRef<SVGCircleElement | null>(null);
  const minuteHandleRef = useRef<SVGCircleElement | null>(null);
  const outerRingRef = useRef<SVGCircleElement | null>(null);
  const innerRingRef = useRef<SVGCircleElement | null>(null);
  const hoverTickRef = useRef<SVGLineElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const dragHourFloat = useRef(curHour);
  const dragMinuteFloat = useRef(curMinute);
  const prevAngleRef = useRef(0);
  const draggingRef = useRef<"hour" | "minute" | null>(null);
  const [announce, setAnnounce] = useState("");

  const paint = (h: number, m: number) => {
    const hAngle = hourAngle(h);
    const length = h < 12 ? SHADOW_AM : SHADOW_PM;
    wedgeRef.current?.setAttribute("points", wedgePoints(hAngle, length));
    const [hx, hy] = pointAt(hAngle, R_OUT_HIT);
    hourHandleRef.current?.setAttribute("cx", String(hx));
    hourHandleRef.current?.setAttribute("cy", String(hy));
    const mAngle = minuteAngle(m);
    const [mx, my] = pointAt(mAngle, R_IN_HIT);
    minuteHandleRef.current?.setAttribute("cx", String(mx));
    minuteHandleRef.current?.setAttribute("cy", String(my));
    if (meridiemRef.current) meridiemRef.current.textContent = h < 12 ? "AM" : "PM";
    if (readoutRef.current) readoutRef.current.textContent = formatReadout(h, m);
    outerRingRef.current?.setAttribute("aria-valuenow", String(h));
    outerRingRef.current?.setAttribute(
      "aria-valuetext",
      `${h % 12 === 0 ? 12 : h % 12} o'clock ${h < 12 ? "AM" : "PM"}`
    );
    innerRingRef.current?.setAttribute("aria-valuenow", String(m));
    innerRingRef.current?.setAttribute("aria-valuetext", `${m} minutes`);
  };

  useEffect(() => paint(curHour, curMinute), [curHour, curMinute]);

  const commit = (h: number, m: number) => {
    if (!isControlled) {
      setUHour(h);
      setUMinute(m);
    }
    onChange?.(h, m);
    setAnnounce(formatReadout(h, m));
  };

  // One getBoundingClientRect() per event, in SVG-local (viewBox) coordinates.
  const toLocal = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const scale = VIEW / rect.width;
    return { x: (clientX - rect.left) * scale, y: (clientY - rect.top) * scale };
  };

  const angleFromEvent = (e: PointerEvent | ReactPointerEvent) => {
    const p = toLocal(e.clientX, e.clientY);
    if (!p) return 0;
    return (Math.atan2(p.y - C, p.x - C) * 180) / Math.PI;
  };

  const startDrag = (which: "hour" | "minute") => (e: ReactPointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    draggingRef.current = which;
    dragHourFloat.current = curHour;
    dragMinuteFloat.current = curMinute;
    prevAngleRef.current = angleFromEvent(e);
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const which = draggingRef.current;
      if (!which) return;
      const angle = angleFromEvent(e);
      const delta = shortestDelta(angle, prevAngleRef.current);
      prevAngleRef.current = angle;
      if (which === "hour") {
        dragHourFloat.current += delta / 30;
        const h = wrap(Math.round(dragHourFloat.current), 24);
        paint(h, Math.round(dragMinuteFloat.current / 5) * 5);
      } else {
        dragMinuteFloat.current += (delta / 30) * 5;
        const m = wrap(Math.round(dragMinuteFloat.current / 5) * 5, 60);
        paint(wrap(Math.round(dragHourFloat.current), 24), m);
      }
    };
    const onUp = () => {
      const which = draggingRef.current;
      if (!which) return;
      draggingRef.current = null;
      const h = wrap(Math.round(dragHourFloat.current), 24);
      const m = wrap(Math.round(dragMinuteFloat.current / 5) * 5, 60);
      commit(h, m);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isControlled]);

  const onHoverMove = (e: ReactPointerEvent) => {
    if (e.pointerType === "touch") return;
    const p = toLocal(e.clientX, e.clientY);
    if (!p) return;
    const angle = (Math.atan2(p.y - C, p.x - C) * 180) / Math.PI;
    const dist = Math.hypot(p.x - C, p.y - C);
    const [x1, y1] = pointAt(angle, dist - 4);
    const [x2, y2] = pointAt(angle, dist + 6);
    const tick = hoverTickRef.current;
    if (tick) {
      tick.setAttribute("x1", String(x1));
      tick.setAttribute("y1", String(y1));
      tick.setAttribute("x2", String(x2));
      tick.setAttribute("y2", String(y2));
      tick.style.opacity = "1";
    }
  };
  const onHoverLeave = () => {
    if (hoverTickRef.current) hoverTickRef.current.style.opacity = "0";
  };

  const stepHour = (delta: number) => {
    const h = wrap(curHour + delta, 24);
    commit(h, curMinute);
  };
  const stepMinute = (delta: number) => {
    const m = wrap(curMinute + delta * 5, 60);
    commit(curHour, m);
  };

  return (
    <div className={`inline-flex flex-col items-center gap-4 ${className}`}>
      <style>{CSS}</style>
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announce}
      </span>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        width={VIEW}
        height={VIEW}
        className="ns-gs-dial"
        onPointerMove={onHoverMove}
        onPointerLeave={onHoverLeave}
      >
        <defs>
          <filter id={fid} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="1.6" />
          </filter>
        </defs>

        <circle cx={C} cy={C} r={R_OUT_TICK_OUT} fill="none" stroke="var(--border)" strokeWidth={1} />
        <circle cx={C} cy={C} r={R_IN_TICK_OUT} fill="none" stroke="var(--border)" strokeWidth={1} />

        <g aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => {
            const a = -90 + i * 30;
            const [x1, y1] = pointAt(a, R_OUT_TICK_IN);
            const [x2, y2] = pointAt(a, R_OUT_TICK_OUT);
            const [nx, ny] = pointAt(a, R_NUMERAL);
            return (
              <g key={i}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--muted)" strokeWidth={1} />
                <text x={nx} y={ny + 3} textAnchor="middle" className="font-mono" style={{ fontSize: 8 }} fill="var(--muted)">
                  {i === 0 ? 12 : i}
                </text>
              </g>
            );
          })}
          {Array.from({ length: 12 }, (_, i) => {
            const a = -90 + i * 30;
            const [x1, y1] = pointAt(a, R_IN_TICK_IN);
            const [x2, y2] = pointAt(a, R_IN_TICK_OUT);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--muted)" strokeWidth={0.75} />;
          })}
          <line ref={hoverTickRef} stroke="var(--foreground)" strokeWidth={1} opacity={0} className="ns-gs-hovertick" />
        </g>

        <polygon
          ref={wedgeRef}
          points={wedgePoints(hourAngle(curHour), curHour < 12 ? SHADOW_AM : SHADOW_PM)}
          fill="var(--foreground)"
          opacity={0.3}
          filter={`url(#${fid})`}
          className="ns-gs-wedge"
          aria-hidden="true"
        />
        <circle cx={C} cy={C} r={2.5} fill="var(--foreground)" aria-hidden="true" />
        <text ref={meridiemRef} x={C} y={C + 16} textAnchor="middle" className="font-mono" style={{ fontSize: 7 }} fill="var(--foreground)" aria-hidden="true">
          {curHour < 12 ? "AM" : "PM"}
        </text>

        <circle
          ref={outerRingRef}
          role="slider"
          tabIndex={0}
          aria-label="Hour"
          aria-valuemin={0}
          aria-valuemax={23}
          aria-valuenow={curHour}
          aria-valuetext={`${curHour % 12 === 0 ? 12 : curHour % 12} o'clock ${curHour < 12 ? "AM" : "PM"}`}
          cx={C}
          cy={C}
          r={R_OUT_HIT}
          fill="none"
          stroke="transparent"
          strokeWidth={OUT_BAND}
          pointerEvents="stroke"
          className="ns-gs-ring"
          onPointerDown={startDrag("hour")}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowUp") {
              e.preventDefault();
              stepHour(1);
            } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
              e.preventDefault();
              stepHour(-1);
            } else if (e.key === "Home") {
              e.preventDefault();
              commit(0, curMinute);
            } else if (e.key === "End") {
              e.preventDefault();
              commit(12, curMinute);
            }
          }}
        />
        <circle
          ref={innerRingRef}
          role="slider"
          tabIndex={0}
          aria-label="Minute"
          aria-valuemin={0}
          aria-valuemax={55}
          aria-valuenow={curMinute}
          aria-valuetext={`${curMinute} minutes`}
          cx={C}
          cy={C}
          r={R_IN_HIT}
          fill="none"
          stroke="transparent"
          strokeWidth={IN_BAND}
          pointerEvents="stroke"
          className="ns-gs-ring"
          onPointerDown={startDrag("minute")}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowUp") {
              e.preventDefault();
              stepMinute(1);
            } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
              e.preventDefault();
              stepMinute(-1);
            } else if (e.key === "Home") {
              e.preventDefault();
              commit(curHour, 0);
            } else if (e.key === "End") {
              e.preventDefault();
              commit(curHour, 55);
            }
          }}
        />

        <circle ref={hourHandleRef} cx={pointAt(hourAngle(curHour), R_OUT_HIT)[0]} cy={pointAt(hourAngle(curHour), R_OUT_HIT)[1]} r={3.5} fill="var(--foreground)" aria-hidden="true" />
        <circle
          ref={minuteHandleRef}
          cx={pointAt(minuteAngle(curMinute), R_IN_HIT)[0]}
          cy={pointAt(minuteAngle(curMinute), R_IN_HIT)[1]}
          r={2.6}
          fill="var(--background)"
          stroke="var(--foreground)"
          strokeWidth={1.4}
          aria-hidden="true"
        />
      </svg>

      <span ref={readoutRef} className="font-mono text-3xl tabular-nums text-foreground">
        {formatReadout(curHour, curMinute)}
      </span>
    </div>
  );
}

const CSS = `
.ns-gs-ring { cursor: pointer; outline: none; touch-action: none; }
.ns-gs-ring:focus-visible { stroke: color-mix(in srgb, var(--accent) 22%, transparent); }
.ns-gs-wedge { transition: opacity 150ms ease-out; }
.ns-gs-dial:hover .ns-gs-wedge { opacity: 0.42; }
.ns-gs-hovertick { transition: opacity 150ms ease-out; }
@media (prefers-reduced-motion: reduce) {
  .ns-gs-wedge, .ns-gs-hovertick { transition: none; }
}
`;
