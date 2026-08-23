"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// MeniscusMeter — a quota (storage, API budget, seats) rendered as liquid in
// a thin open-top vessel, where the fill's top-edge CURVATURE, not its level,
// carries the reading. Under the soft limit the level rises normally and the
// edge is concave (wets the walls, dips at center — climbs higher at the
// walls than the middle, same physical tell as water in a narrow glass tube).
// Exactly at the soft limit it flattens. Between soft and hard the level
// pins at the rim and the edge inverts to convex, bulging progressively
// higher above the rim as the value approaches the hard cap — visibly
// overfull, still held by surface tension, no color change required to read
// "tolerated but over." The instant value crosses the hard limit a bead
// detaches from the outer wall and eases down under gravity, then a static
// 1px --ns-muted stain remains — the crossing becomes a permanent mark, not
// just a momentary state. The whole shape is one SVG cubic bezier: fixed
// endpoints at the current level, two shared control points whose y-offset
// from that level is the single scalar that walks concave -> flat -> convex.
// A CSS transition on `d` with a back-out (overshoot) timing function is the
// "soft spring" — one wobble past the target, then it settles, no JS
// simulation loop needed. `role=meter` carries the real semantics (SVG is
// aria-hidden); a Geist Mono numeric readout beside the vessel means
// curvature is never the only signal. Every stroke/fill is a token-driven
// Tailwind class (text-border/text-ns-muted/text-foreground/text-ns-accent) at
// low opacity — no hex, no canvas, no getComputedStyle needed since nothing
// here is a raster surface.
// ---------------------------------------------------------------------------

export interface MeniscusMeterProps {
  /** current usage, same unit as softLimit/hardLimit */
  value: number;
  /** the soft threshold — the vessel's rim; reaching it flattens the surface */
  softLimit: number;
  /** the hard cap — crossing it detaches a bead and leaves a stain */
  hardLimit: number;
  /** unit suffix for every readout, e.g. "%", "GB", "seats" (default "%") */
  unit?: string;
  /** what's being metered, shown above the vessel, e.g. "Storage" */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

type Zone = "headroom" | "grace" | "spill";

// vessel geometry, SVG viewBox units
const VIEW_W = 96;
const VIEW_H = 168;
const WALL_L = 30;
const WALL_R = 66;
const RIM_Y = 34;
const FLOOR_Y = 142;
const MAX_CONCAVE = 9; // control-point dip at value = 0 (deep headroom)
const MAX_CONVEX = 20; // control-point rise at value = hardLimit (max dome)
// a two-control-point cubic's midpoint sits at 0.25*end + 0.75*control, so a
// concave dip of MAX_CONCAVE bows the visible trough ~0.75*MAX_CONCAVE below
// the wall-anchor point — reserve that much clearance above FLOOR_Y so an
// empty vessel's dipped meniscus never renders below the drawn floor line.
const LEVEL_FLOOR_Y = FLOOR_Y - Math.ceil(MAX_CONCAVE * 0.75) - 3;
const BEAD_X = WALL_R + 4;
const DRIP_LEN = 46; // stain length below the rim

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function fmt(n: number) {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (Number.isInteger(n) || abs >= 100) return Math.round(n).toString();
  return n.toFixed(1);
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

function zoneAnnounce(zone: Zone) {
  if (zone === "spill") return "over hard limit — overflowing";
  if (zone === "grace") return "over soft limit — still held";
  return "within soft limit";
}

function zoneShort(zone: Zone) {
  if (zone === "spill") return "over hard limit";
  if (zone === "grace") return "over soft limit";
  return "under soft limit";
}

function surface(value: number, softLimit: number, hardLimit: number) {
  const soft = Math.max(1e-6, softLimit);
  const hard = Math.max(soft + 1e-6, hardLimit);
  let levelY: number;
  let curveOffset: number; // positive = convex dome, negative = concave dip
  let zone: Zone;
  if (value <= soft) {
    const t = clamp(value / soft, 0, 1); // 0 empty -> 1 at rim
    levelY = LEVEL_FLOOR_Y - t * (LEVEL_FLOOR_Y - RIM_Y);
    curveOffset = -MAX_CONCAVE * (1 - t);
    zone = "headroom";
  } else {
    levelY = RIM_Y; // pinned — the level itself never rises further
    const t = clamp((value - soft) / (hard - soft), 0, 1);
    curveOffset = MAX_CONVEX * t;
    zone = value >= hard ? "spill" : "grace";
  }
  return { levelY, curveOffset, zone };
}

function surfacePath(levelY: number, curveOffset: number) {
  const cpY = levelY - curveOffset;
  const cp1x = WALL_L + (WALL_R - WALL_L) * 0.33;
  const cp2x = WALL_L + (WALL_R - WALL_L) * 0.67;
  return `M ${WALL_L} ${levelY} C ${cp1x} ${cpY} ${cp2x} ${cpY} ${WALL_R} ${levelY}`;
}

function fillPath(levelY: number, curveOffset: number) {
  return `${surfacePath(levelY, curveOffset)} L ${WALL_R} ${FLOOR_Y} L ${WALL_L} ${FLOOR_Y} Z`;
}

export function MeniscusMeter({
  value,
  softLimit,
  hardLimit,
  unit = "%",
  label = "Usage",
  className = "",
}: MeniscusMeterProps) {
  const uid = useId();
  const reduced = useReducedMotion();
  const { levelY, curveOffset, zone } = useMemo(
    () => surface(value, softLimit, hardLimit),
    [value, softLimit, hardLimit]
  );

  const prevZoneRef = useRef<Zone>(zone);
  const [stained, setStained] = useState(zone === "spill");
  const [beadTick, setBeadTick] = useState(0);
  const [announce, setAnnounce] = useState(() => zoneAnnounce(zone));

  useEffect(() => {
    const prev = prevZoneRef.current;
    if (prev !== zone) {
      setAnnounce(zoneAnnounce(zone));
      if (zone === "spill") {
        setStained(true);
        if (prev !== "spill") setBeadTick((k) => k + 1);
      } else if (zone === "headroom") {
        setStained(false);
      }
      prevZoneRef.current = zone;
    }
  }, [zone]);

  const labelId = `${uid}-label`;
  const liveId = `${uid}-live`;
  const unitSuffix = unit === "%" ? "%" : unit ? ` ${unit}` : "";
  const valueText = `${fmt(value)}${unitSuffix}, ${zoneShort(zone)}`;
  const d = fillPath(levelY, curveOffset);
  const surfaceD = surfacePath(levelY, curveOffset);

  return (
    <div className={className}>
      <style>{`
.ns-meniscus-fill,.ns-meniscus-surface{transition:d 700ms cubic-bezier(0.34,1.56,0.64,1)}
@keyframes ns-meniscus-drip{
  0%{transform:translateY(0);opacity:1}
  70%{opacity:1}
  100%{transform:translateY(${DRIP_LEN}px);opacity:0}
}
.ns-meniscus-bead{animation:ns-meniscus-drip 900ms cubic-bezier(0.55,0,0.85,0.35) 1}
@media (prefers-reduced-motion: reduce){
  .ns-meniscus-fill,.ns-meniscus-surface{transition-duration:140ms;transition-timing-function:linear}
  .ns-meniscus-bead{animation:none}
}
`}</style>

      <div className="flex items-baseline justify-between gap-3">
        <span id={labelId} className="font-mono text-[11px] tracking-wide text-ns-muted">
          {label.toUpperCase()}
        </span>
        <span
          className={
            "font-mono text-[11px] tracking-wide text-foreground " +
            (zone !== "headroom" ? "font-semibold" : "")
          }
        >
          {zoneShort(zone)}
        </span>
      </div>

      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tabular-nums text-foreground">
          {fmt(value)}
          {unit === "%" ? "%" : ""}
        </span>
        <span className="font-mono text-xs text-ns-muted">
          / {fmt(hardLimit)}
          {unit !== "%" ? ` ${unit}` : ""} cap
        </span>
      </div>

      <div
        role="meter"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={hardLimit}
        aria-valuenow={value}
        aria-valuetext={valueText}
        className="mt-3 flex justify-center"
      >
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="h-[168px] w-[96px]"
          aria-hidden
          focusable="false"
        >
          {/* floor */}
          <line
            x1={WALL_L}
            x2={WALL_R}
            y1={FLOOR_Y}
            y2={FLOOR_Y}
            className="stroke-current text-border"
            strokeWidth={1.5}
          />
          {/* liquid body, fill under the meniscus curve */}
          <path d={d} className="ns-meniscus-fill fill-current text-foreground opacity-[0.14]" />
          {/* surface line, more opaque than the body fill */}
          <path
            d={surfaceD}
            fill="none"
            className="ns-meniscus-surface stroke-current text-foreground"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          {/* walls, stop exactly at the rim so a grace-zone dome visibly rises
              into open space above them, unconfined */}
          <line
            x1={WALL_L}
            x2={WALL_L}
            y1={RIM_Y}
            y2={FLOOR_Y}
            className="stroke-current text-border"
            strokeWidth={2}
          />
          <line
            x1={WALL_R}
            x2={WALL_R}
            y1={RIM_Y}
            y2={FLOOR_Y}
            className="stroke-current text-border"
            strokeWidth={2}
          />
          {/* rim lip ticks */}
          <line
            x1={WALL_L - 3}
            x2={WALL_L + 3}
            y1={RIM_Y}
            y2={RIM_Y}
            className="stroke-current text-border"
            strokeWidth={1.5}
          />
          <line
            x1={WALL_R - 3}
            x2={WALL_R + 3}
            y1={RIM_Y}
            y2={RIM_Y}
            className="stroke-current text-border"
            strokeWidth={1.5}
          />
          {/* stain — static, left by the hard-limit crossing */}
          {stained ? (
            <line
              x1={BEAD_X}
              x2={BEAD_X}
              y1={RIM_Y}
              y2={RIM_Y + DRIP_LEN}
              className="stroke-current text-ns-muted opacity-60"
              strokeWidth={1}
            />
          ) : null}
          {/* bead — one-shot drop animation replayed via key on each crossing */}
          {!reduced && beadTick > 0 ? (
            <circle
              key={beadTick}
              cx={BEAD_X}
              cy={RIM_Y}
              r={2.25}
              className="ns-meniscus-bead fill-current text-ns-muted"
            />
          ) : null}
        </svg>
      </div>

      <p className="mt-2 text-center font-mono text-[11px] text-ns-muted">
        {zone === "spill"
          ? "held — overflow marked on the glass"
          : zone === "grace"
            ? "over the soft limit, still tolerated"
            : `${fmt(Math.max(0, softLimit - value))}${unitSuffix} of headroom left`}
      </p>

      <span id={liveId} role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}
