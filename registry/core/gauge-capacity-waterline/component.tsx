"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

// ---------------------------------------------------------------------------
// PlimsollGauge — a capacity/legal-limit meter drawn as a ship's side-profile
// hull with Plimsoll load-line marks (TF/F/S/W), not a liquid-in-a-vessel
// meter (that's meniscus-meter's job) and not an input-strength meter (that's
// tide-gauge-password's). Two independent, small effects read as one physical
// system: the waterline (an SVG rect+line pinned to a fixed frame) rises
// directly with `value`, while the hull silhouette itself (a sibling <g>)
// sinks a few px on a separate, smaller spring — cargo settling under its own
// weight, not just a rising tide. The "S" mark sits exactly at `limit`; once
// `value` passes it, that one mark (only that one) flips to --warning amber.
// Every other mark (TF/F/W) is a fixed decorative reference line near it,
// always muted ink, never colored.
//
// Motion: a single rAF loop drives two critically-damped springs (waterline Y,
// hull sink offset) plus, only when motion is allowed, a continuous sine lap
// added on top of the waterline — its amplitude doubles while overloaded.
// prefers-reduced-motion drops the springs and the lap entirely: value/limit
// changes land as an instant discrete step, still fully legible. The
// depth-sounding line (hover or keyboard focus) is a direct, event-driven DOM
// write — two plain divs (a hairline + a mono readout chip), never SVG
// dasharray tricks, following the project's known dash/non-scaling-stroke
// trap for straight indicator lines.
// ---------------------------------------------------------------------------

export interface PlimsollGaugeProps {
  /** Current load, 0-150+ (%). Values above `limit` are overload. */
  value: number;
  /** Legal capacity limit (%) — where the "S" load line sits. Default 100. */
  limit?: number;
  className?: string;
}

const STAGE_W = 280;
const STAGE_H = 170;
const DECK_Y = 26;
const KEEL_Y = 150;
const HULL_LEFT = 34;

// Boat-shaped, not egg-shaped: a wide flat deck, sides that taper firmly
// inward, and a shallow, relatively flat keel line — a hull cross-section,
// not a lens.
const HULL_PATH =
  "M 40 26 L 260 26 C 266 26 268 34 266 48 C 262 90 246 128 210 146 C 190 154 110 154 90 146 C 54 128 38 90 34 48 C 32 34 34 26 40 26 Z";

const SPRING_K = 150;
const SPRING_ZETA = 0.85;
const SPRING_C = 2 * SPRING_ZETA * Math.sqrt(SPRING_K);
const HULL_K = 90;
const HULL_C = 2 * 0.9 * Math.sqrt(HULL_K);
const LAP_AMP = 1.6;
const LAP_AMP_OVERLOAD = 3.4;
const LAP_FREQ = 0.55; // Hz

function toY(percent: number): number {
  const y = KEEL_Y - (percent / 100) * (KEEL_Y - DECK_Y);
  return Math.min(KEEL_Y, Math.max(4, y));
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

type MarkKey = "TF" | "F" | "S" | "W";
interface Mark {
  key: MarkKey;
  percent: number;
  isLimit: boolean;
}

// toY() already clamps its own output to a sane pixel range, so these only
// need a loose guard against pathological negative/huge `limit` inputs — a
// tight ceiling here is what previously made TF and F collide at the same y.
function buildMarks(limit: number): Mark[] {
  return [
    { key: "TF", percent: clamp(limit + 28, 2, 140), isLimit: false },
    { key: "F", percent: clamp(limit + 14, 2, 140), isLimit: false },
    { key: "S", percent: clamp(limit, 2, 140), isLimit: true },
    { key: "W", percent: clamp(limit - 14, 2, 140), isLimit: false },
  ];
}

interface Spring {
  pos: number;
  v: number;
  target: number;
}

export function PlimsollGauge({ value, limit = 100, className = "" }: PlimsollGaugeProps) {
  const rootRef = useRef<HTMLButtonElement | null>(null);
  const hullGroupRef = useRef<SVGGElement | null>(null);
  const waterRectRef = useRef<SVGRectElement | null>(null);
  const waterLineRef = useRef<SVGLineElement | null>(null);
  const soundLineRef = useRef<HTMLDivElement | null>(null);
  const soundChipRef = useRef<HTMLDivElement | null>(null);

  const reducedRef = useRef(false);
  const overloadRef = useRef(false);
  const waterSpring = useRef<Spring>({ pos: toY(value), v: 0, target: toY(value) });
  const hullSpring = useRef<Spring>({ pos: 0, v: 0, target: 0 });
  const rafRef = useRef(0);
  const lastRef = useRef(0);
  const pointerXRef = useRef(STAGE_W / 2);

  const [hovering, setHovering] = useState(false);
  const [announce, setAnnounce] = useState("");
  const wasOverloadRef = useRef(false);

  const marks = buildMarks(limit);
  const overload = value > limit;
  overloadRef.current = overload;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onChange = () => {
      reducedRef.current = mq.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (overload !== wasOverloadRef.current) {
      wasOverloadRef.current = overload;
      setAnnounce(overload ? "Over capacity limit" : "Within capacity limit");
    }
  }, [overload]);

  const writeWater = (y: number) => {
    const rect = waterRectRef.current;
    const line = waterLineRef.current;
    if (rect) {
      rect.setAttribute("y", String(y));
      rect.setAttribute("height", String(Math.max(0, STAGE_H - y)));
    }
    if (line) {
      line.setAttribute("y1", String(y));
      line.setAttribute("y2", String(y));
    }
  };

  const writeHull = (offset: number) => {
    const g = hullGroupRef.current;
    if (g) g.style.transform = `translateY(${offset.toFixed(2)}px)`;
  };

  useEffect(() => {
    const targetWaterY = toY(value);
    const targetHullSink = Math.min(10, Math.max(0, (Math.min(value, 130) / 100) * 8));
    waterSpring.current.target = targetWaterY;
    hullSpring.current.target = targetHullSink;

    if (reducedRef.current) {
      waterSpring.current.pos = targetWaterY;
      waterSpring.current.v = 0;
      hullSpring.current.pos = targetHullSink;
      hullSpring.current.v = 0;
      writeWater(targetWaterY);
      writeHull(targetHullSink);
      return;
    }
    ensureLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function ensureLoop() {
    if (rafRef.current) return;
    lastRef.current = 0;
    rafRef.current = requestAnimationFrame(loop);
  }

  function loop(now: number) {
    const dt = Math.min(0.032, lastRef.current ? (now - lastRef.current) / 1000 : 1 / 60);
    lastRef.current = now;

    const w = waterSpring.current;
    const wA = SPRING_K * (w.target - w.pos) - SPRING_C * w.v;
    w.v += wA * dt;
    w.pos += w.v * dt;

    const h = hullSpring.current;
    const hA = HULL_K * (h.target - h.pos) - HULL_C * h.v;
    h.v += hA * dt;
    h.pos += h.v * dt;

    const lap = Math.sin(now / 1000 * Math.PI * 2 * LAP_FREQ) *
      (overloadRef.current ? LAP_AMP_OVERLOAD : LAP_AMP);

    writeWater(w.pos + lap);
    writeHull(h.pos);

    // the idle lap never settles, so the loop simply runs for as long as the
    // component is mounted and visible (paused via visibilitychange below)
    rafRef.current = requestAnimationFrame(loop);
  }

  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      } else if (!reducedRef.current) {
        ensureLoop();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const positionSounding = (clientX: number) => {
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const scaleX = STAGE_W / rect.width;
    const localX = clamp((clientX - rect.left) * scaleX, 10, STAGE_W - 10);
    pointerXRef.current = localX;
    const scale = rect.width / STAGE_W;
    const line = soundLineRef.current;
    const chip = soundChipRef.current;
    const topPx = 4 * scale;
    const waterYPx = waterSpring.current.pos * scale;
    if (line) {
      line.style.left = `${localX * scale}px`;
      line.style.top = `${topPx}px`;
      line.style.height = `${Math.max(0, waterYPx - topPx)}px`;
    }
    if (chip) {
      chip.style.left = `${localX * scale}px`;
      chip.style.top = `${Math.max(0, waterYPx - 20 * scale)}px`;
    }
  };

  const onEnter = (e: ReactPointerEvent<HTMLButtonElement>) => {
    setHovering(true);
    positionSounding(e.clientX);
  };
  const onMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (hovering) positionSounding(e.clientX);
  };
  const onLeave = () => setHovering(false);
  const onFocus = () => {
    setHovering(true);
    const root = rootRef.current;
    if (root) {
      const rect = root.getBoundingClientRect();
      positionSounding(rect.left + rect.width / 2);
    }
  };
  const onBlur = () => setHovering(false);

  const roundedValue = Math.round(value);
  const ariaLabel = `Capacity gauge: ${roundedValue}% of ${limit}% legal limit${overload ? ", over limit" : ""}`;

  return (
    <button
      type="button"
      ref={rootRef}
      aria-label={ariaLabel}
      onPointerEnter={onEnter}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      className={`relative block rounded-[12px] border border-border bg-surface p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
      style={{ width: STAGE_W, height: STAGE_H }}
    >
      <style>{CSS}</style>
      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>

      <svg
        viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
        width="100%"
        height="100%"
        aria-hidden="true"
        focusable="false"
        className="block"
      >
        <g ref={hullGroupRef} className="ns-pg-hull">
          <path d={HULL_PATH} fill="var(--foreground)" fillOpacity={0.05} stroke="var(--foreground)" strokeWidth={1.25} />
          {marks.map((m) => {
            const y = toY(m.percent);
            const flip = m.isLimit && overload;
            const color = flip ? "var(--warning)" : "var(--muted)";
            return (
              <g key={m.key} className="ns-pg-mark">
                <line
                  x1={HULL_LEFT - 16}
                  x2={HULL_LEFT}
                  y1={y}
                  y2={y}
                  stroke={color}
                  strokeWidth={m.isLimit ? 1.75 : 1}
                />
                <text
                  x={HULL_LEFT - 20}
                  y={y + 3}
                  fontSize={9}
                  textAnchor="end"
                  fill={color}
                  className="font-mono"
                  style={{ fontWeight: m.isLimit ? 700 : 400 }}
                >
                  {m.key}
                </text>
              </g>
            );
          })}
        </g>

        <line ref={waterLineRef} x1={0} x2={STAGE_W} y1={toY(value)} y2={toY(value)} stroke="var(--foreground)" strokeOpacity={0.45} strokeWidth={1} />
        <rect
          ref={waterRectRef}
          x={0}
          y={toY(value)}
          width={STAGE_W}
          height={Math.max(0, STAGE_H - toY(value))}
          fill="var(--foreground)"
          fillOpacity={0.08}
        />
      </svg>

      <div
        ref={soundLineRef}
        aria-hidden="true"
        className="pointer-events-none absolute w-px bg-foreground/60"
        style={{ opacity: hovering ? 1 : 0 }}
      />
      <div
        ref={soundChipRef}
        aria-hidden="true"
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-[6px] border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-foreground shadow-sm"
        style={{ opacity: hovering ? 1 : 0 }}
      >
        {roundedValue}%
      </div>
    </button>
  );
}

export const CSS = `
.ns-pg-hull{transform-box:fill-box;transform-origin:center;}
@media (prefers-reduced-motion: reduce){
  .ns-pg-hull{transition:none !important;}
}
`;
