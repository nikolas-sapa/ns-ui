"use client";

import { useId, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// PeckedRing — a geofence radius editor whose circle is drawn in pecked
// (dashed) chart line-work where each dash equals a fixed 100m of ground
// circumference, not a fixed pixel length. One governing scalar, r (radius
// in metres). dashCount = round(2*pi*r / DASH_METERS); the SVG circle's
// stroke-dasharray is a [dashLen, gapLen] pair computed so that
// dashCount * (dashLen+gapLen) === circumferencePx EXACTLY — the pattern
// always closes around the ring with no seam, because segment length is
// derived FROM the integer dash count, never assumed. That forbids the
// tempting fixed-pixel dasharray, whose dashes mean nothing and shear at
// the seam once the radius no longer divides evenly into it.
//
// Because dashCount ~= circumference_m / DASH_METERS and circumference_m =
// 2*pi*r, per-dash pixel spacing collapses to ~DASH_METERS/metersPerPixel —
// almost independent of r. It only depends on the map's scale, exactly as
// a real scale bar would: change metersPerPixel and every dash re-spaces:
// the stroke never re-spaces "for comfort". Below MIN_SPACING_PX the dashes
// would be closer than they can be told apart, so the ring switches to
// BUNDLE_FACTOR-dash bundles (one dash = 1000m of ground) rather than
// lying with a denser pattern that no longer means anything.
//
// On every dash-count crossing (continuous while dragging — a new dash is
// born roughly every DASH_METERS/(2*pi) metres of radius) the segment
// pair eases to its new length over RESPACE_MS via a plain CSS transition
// on stroke-dasharray: instant re-spacing shimmers like moire against the
// pecked pattern, slower detaches the ring from the dragging hand. Every
// 10th dash (each full "index" of the current unit, 1km normally, 10km
// bundled) gets a heavier radial tick line, independent of the dash stroke
// itself. Handle border is the only accent-tinted stroke, and only on
// hover/focus/drag. DOM + SVG + CSS only — no canvas.
// ---------------------------------------------------------------------------

const DASH_METERS = 100; // ground distance one dash subtends, fixed by design
const BUNDLE_FACTOR = 10; // dashes per bundle once spacing gets too tight
const MIN_SPACING_PX = 3; // below this, bundle rather than blur
// respace duration lives as a literal Tailwind class (duration-[120ms]) on
// the ring circle below, not a JS constant — arbitrary-value utilities are
// picked up by Tailwind's static scanner, not by interpolating a variable.
const DASH_DUTY = 0.6; // dash-to-gap ratio within one segment

const CX = 150;
const CY = 150;
const PAD = 26;
const MAX_PX_RADIUS = 150 - PAD; // 124
const MIN_PX_RADIUS = 6;

function polar(rPx: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + rPx * Math.cos(rad), y: CY + rPx * Math.sin(rad) };
}

function formatRadius(rMeters: number) {
  return rMeters >= 1000
    ? `${(rMeters / 1000).toFixed(1)} km`
    : `${Math.round(rMeters)} m`;
}

function formatArea(rMeters: number) {
  const areaM2 = Math.PI * rMeters * rMeters;
  if (areaM2 >= 1e6) {
    const km2 = areaM2 / 1e6;
    return `${km2.toFixed(km2 >= 10 ? 0 : 1)} km²`;
  }
  return `${Math.round(areaM2)} m²`;
}

function computeGeometry(rMeters: number, metersPerPixel: number) {
  const pxRadius = Math.min(
    MAX_PX_RADIUS,
    Math.max(MIN_PX_RADIUS, rMeters / metersPerPixel)
  );
  const circumferencePx = 2 * Math.PI * pxRadius;
  const circumferenceM = 2 * Math.PI * rMeters;

  let unitMeters = DASH_METERS;
  let dashCount = Math.max(1, Math.round(circumferenceM / unitMeters));
  let spacingPx = circumferencePx / dashCount;
  let bundled = false;

  if (spacingPx < MIN_SPACING_PX) {
    unitMeters = DASH_METERS * BUNDLE_FACTOR;
    dashCount = Math.max(1, Math.round(circumferenceM / unitMeters));
    spacingPx = circumferencePx / dashCount;
    bundled = true;
  }

  const dashLen = spacingPx * DASH_DUTY;
  const gapLen = spacingPx * (1 - DASH_DUTY);
  const tickEvery = 10; // every 10th dash = one "index" (1km, or 10km bundled)
  const tickAngles: number[] = [];
  for (let i = 0; i < dashCount; i += tickEvery) {
    tickAngles.push((i / dashCount) * 360);
  }

  return {
    pxRadius,
    dashCount,
    dashLen,
    gapLen,
    bundled,
    unitMeters,
    tickAngles,
  };
}

export interface PeckedRingProps {
  /** controlled radius in metres; omit for uncontrolled */
  value?: number;
  /** uncontrolled initial radius in metres */
  defaultValue?: number;
  /** minimum radius, metres */
  min?: number;
  /** maximum radius, metres */
  max?: number;
  /** ground metres represented by one pixel — the map's scale */
  metersPerPixel?: number;
  /** accessible name, shared by the slider and the numeric input */
  label?: string;
  /** called with the new radius (metres) on every drag/keyboard/typed change */
  onValueChange?: (value: number) => void;
  /** rendered svg diameter, px */
  size?: number;
  /** id applied to the slider region (drag target for autoplay/tests) */
  id?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function PeckedRing({
  value,
  defaultValue = 1400,
  min = 100,
  max = 2500,
  metersPerPixel = 20,
  label = "Alert radius",
  onValueChange,
  size = 280,
  id,
  className = "",
}: PeckedRingProps) {
  const isControlled = value !== undefined;
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const [internal, setInternal] = useState(() => clamp(defaultValue));
  const r = isControlled ? clamp(value as number) : internal;
  const currentRef = useRef(r);
  currentRef.current = r;

  const commit = (next: number) => {
    const c = clamp(Math.round(next));
    if (c === currentRef.current) return;
    if (!isControlled) setInternal(c);
    onValueChange?.(c);
  };

  const geom = useMemo(
    () => computeGeometry(r, metersPerPixel),
    [r, metersPerPixel]
  );

  const labelId = useId();
  const regionRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const pointerToRadius = (clientX: number, clientY: number) => {
    const el = regionRef.current;
    if (!el) return currentRef.current;
    const rect = el.getBoundingClientRect();
    const scale = rect.width / size; // css box may differ from viewBox units
    const dx = (clientX - (rect.left + rect.width / 2)) / scale;
    const dy = (clientY - (rect.top + rect.height / 2)) / scale;
    const distPx = Math.hypot(dx, dy);
    return distPx * metersPerPixel;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    regionRef.current?.setPointerCapture(e.pointerId);
    regionRef.current?.focus({ preventScroll: true });
    draggingRef.current = true;
    commit(pointerToRadius(e.clientX, e.clientY));
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    commit(pointerToRadius(e.clientX, e.clientY));
  };
  const endDrag = () => {
    draggingRef.current = false;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? DASH_METERS * BUNDLE_FACTOR : DASH_METERS;
    let next: number | null = null;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = currentRef.current + step;
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = currentRef.current - step;
        break;
      case "Home":
        next = min;
        break;
      case "End":
        next = max;
        break;
      default:
        return;
    }
    e.preventDefault();
    commit(next);
  };

  const [inputText, setInputText] = useState(() => String(Math.round(r)));
  const inputFocusedRef = useRef(false);
  if (!inputFocusedRef.current) {
    const wanted = String(Math.round(r));
    if (inputText !== wanted) setInputText(wanted);
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/[^\d]/g, "").slice(0, 6);
    setInputText(digits);
    if (digits === "") return;
    commit(parseInt(digits, 10));
  };

  const handle = polar(geom.pxRadius, -90); // fixed bearing, north
  const readoutPos = polar(geom.pxRadius + 16, -90);
  const valuetext = `${formatRadius(r)} radius, area ${formatArea(r)}`;

  return (
    <div className={`w-full max-w-sm font-mono ${className}`}>
      <div className="flex items-baseline justify-between gap-3 pb-3">
        <span
          id={labelId}
          className="text-[10px] uppercase tracking-[0.2em] text-ns-muted"
        >
          {label}
        </span>
        <div className="flex items-baseline gap-1">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            aria-labelledby={labelId}
            value={inputText}
            onFocus={() => {
              inputFocusedRef.current = true;
            }}
            onBlur={() => {
              inputFocusedRef.current = false;
              setInputText(String(Math.round(currentRef.current)));
            }}
            onChange={onInputChange}
            className="w-20 rounded-sm border border-border bg-background px-2 py-1 text-right text-sm tabular-nums text-foreground outline-none transition-colors duration-150 hover:border-ns-muted focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          />
          <span aria-hidden className="text-xs text-ns-muted">
            m
          </span>
        </div>
      </div>

      <div
        ref={regionRef}
        id={id}
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Math.round(r)}
        aria-valuetext={valuetext}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="group relative mx-auto block touch-none select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        style={{ width: size, height: size, cursor: "grab" }}
      >
        <svg viewBox="0 0 300 300" className="h-full w-full" aria-hidden>
          {/* the ring itself: one circle, pecked dasharray recomputed each
              render from dashCount so it always closes with no seam */}
          <circle
            cx={CX}
            cy={CY}
            r={geom.pxRadius}
            fill="none"
            className="text-foreground transition-[stroke-dasharray] duration-[120ms] ease-out motion-reduce:transition-none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="butt"
            style={{
              strokeDasharray: `${geom.dashLen}px ${geom.gapLen}px`,
            }}
          />

          {/* heavier radial ticks at every 10th dash — the 1km (or, once
              bundled, 10km) index */}
          {geom.tickAngles.map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const inner = geom.pxRadius - 7;
            const outer = geom.pxRadius + 7;
            return (
              <line
                key={deg}
                x1={CX + inner * cos}
                y1={CY + inner * sin}
                x2={CX + outer * cos}
                y2={CY + outer * sin}
                className="text-foreground"
                stroke="currentColor"
                strokeWidth={2}
              />
            );
          })}

          {/* derived area, dead centre, muted — never the governing value */}
          <text
            x={CX}
            y={CY}
            textAnchor="middle"
            dominantBaseline="central"
            className="select-none fill-ns-muted"
            style={{ fontSize: 12 }}
          >
            {formatArea(r)}
          </text>

          {/* radius readout, rides the handle */}
          <text
            x={readoutPos.x}
            y={readoutPos.y}
            textAnchor="middle"
            dominantBaseline="central"
            className="select-none fill-foreground font-semibold"
            style={{ fontSize: 12, paintOrder: "stroke" }}
            stroke="var(--background)"
            strokeWidth={4}
          >
            {formatRadius(r)}
          </text>

          {/* handle — the only element whose border may tint toward accent,
              and only on hover/focus/drag */}
          <circle
            cx={handle.x}
            cy={handle.y}
            r={7}
            className="fill-background stroke-border transition-colors duration-150 group-hover:stroke-ns-accent group-focus-visible:stroke-ns-accent group-active:stroke-ns-accent"
            strokeWidth={2}
          />
        </svg>
      </div>

      <div className="flex items-center justify-between pt-2 text-[10px] text-ns-muted">
        <span>
          {geom.bundled
            ? `bundled ×${BUNDLE_FACTOR} — ${geom.dashCount} dashes`
            : `${geom.dashCount} dashes × ${DASH_METERS}m`}
        </span>
        <span aria-hidden className="tabular-nums">
          arrows ±{DASH_METERS}m · shift ±{DASH_METERS * BUNDLE_FACTOR}m
        </span>
      </div>
    </div>
  );
}
