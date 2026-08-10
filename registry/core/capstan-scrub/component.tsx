"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

// ---------------------------------------------------------------------------
// CapstanScrub — a numeric scrubber shaped as a winch drum. Drag in circles
// around it: the pointer's angle accumulates into `wound` (radians of rope
// laid on the drum, >= 0), and the effective value-per-radian rate decays as
// baseRate * e^(-mu*wound) with mu = ln(8)/2*pi, so every full revolution of
// accumulated winding divides sensitivity by ~8x — one wrap is coarse
// travel, three is surgical, all in the same continuous gesture across up to
// six orders of magnitude. Wound rope is drawn as concentric arcs stacking
// inward from the drum's flange (settled wraps in --border, the forming one
// in --foreground with a free rope-end line reaching to the live pointer).
// Reversing direction pays the wound back out toward zero before it can
// build in the new direction — real line coming off a spool, not a mode
// switch — which is why the rate stays fine for a beat after a reversal and
// only coarsens once enough rope has actually paid out. Direct-DOM refs
// drive the drag hot path (arc `d`, handle position, rope line, readout
// text); React state (`wound`, the committed value) only updates at drag
// end and on keyboard, matching this repo's other drag-heavy dials.
// Keyboard: arrows step at the current gear, PageUp/PageDown add or remove
// one whole wrap (announced), Home rewinds to gear 1. No canvas, no hex —
// every stroke is currentColor via the five shared tokens.
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;
const MU = Math.log(8) / TAU; // one full wrap (2*PI rad) divides rate by 8x
const MAX_WRAPS = 8; // ceiling: 8 wraps -> 8^8 (~16.8M x) precision floor
const MAX_WOUND = MAX_WRAPS * TAU;
const VIEW = 220;
const C = 110;
const DRUM_R = 92; // static outer flange
const WRAP_START_R = 84; // radius of the first (outermost) settled wrap
const WRAP_PITCH = 8;
const HUB_R = 20;

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
function toDeg(rad: number) {
  return (rad * 180) / Math.PI;
}
function radDelta(a: number, b: number) {
  // shortest signed delta a - b, radians, range (-PI, PI]
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d <= -Math.PI) d += TAU;
  return d;
}
function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}
function arcPath(cx: number, cy: number, r: number, startDeg: number, sweepDeg: number) {
  const [x1, y1] = polar(cx, cy, r, startDeg);
  const [x2, y2] = polar(cx, cy, r, startDeg + sweepDeg);
  const largeArc = Math.abs(sweepDeg) > 180 ? 1 : 0;
  const sweepFlag = sweepDeg >= 0 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} ${sweepFlag} ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}
function gearLabel(multiplier: number) {
  return `×${multiplier.toLocaleString()}`;
}

export interface CapstanScrubProps {
  /** controlled value; omit for uncontrolled */
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  /** finest resolvable increment — the quantization grid and the arrow-key floor */
  step?: number;
  /** accessible name, also shown as the eyebrow caption */
  label?: string;
  unit?: string;
  formatValue?: (value: number) => string;
  onValueChange?: (value: number) => void;
  className?: string;
}

export function CapstanScrub({
  value,
  defaultValue = 0,
  min = 0,
  max = 10_000_000,
  step = 1,
  label = "Value",
  unit,
  formatValue,
  onValueChange,
  className = "",
}: CapstanScrubProps) {
  const safeStep = step > 0 ? step : 1;
  const safeMax = max > min ? max : min + safeStep * 100;
  const range = safeMax - min;
  const coarseStep = Math.max(safeStep, range / 48); // value per revolution at gear 1
  const baseRate = coarseStep / TAU; // value per radian at gear 1
  const decimals = (() => {
    const s = String(safeStep);
    const i = s.indexOf(".");
    return i === -1 ? 0 : s.length - i - 1;
  })();

  const quantize = (v: number) => {
    const q = min + Math.round((v - min) / safeStep) * safeStep;
    return Number(clamp(q, min, safeMax).toFixed(6));
  };

  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(() => quantize(defaultValue));
  const current = isControlled ? quantize(value as number) : internal;
  const currentRef = useRef(current);
  currentRef.current = current;

  const fmt =
    formatValue ??
    ((v: number) =>
      `${v.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}${unit ? ` ${unit}` : ""}`);

  const [wound, setWound] = useState(0); // React-visible mirror, updated at commit points
  const woundRef = useRef(0);
  const windDirRef = useRef(0); // -1 | 0 | +1 — direction currently building the wind
  const draggingRef = useRef(false);
  const rawRef = useRef(current); // continuous unquantized value while winding
  const prevAngleRef = useRef(0);
  const [announce, setAnnounce] = useState("");

  const svgRef = useRef<SVGSVGElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);
  const gearRef = useRef<HTMLSpanElement>(null);
  const partialRef = useRef<SVGPathElement>(null);
  const handleRef = useRef<SVGCircleElement>(null);
  const ropeRef = useRef<SVGLineElement>(null);
  const wrapRefs = useRef<(SVGCircleElement | null)[]>([]);

  const commitRef = useRef<(v: number) => void>(() => {});
  commitRef.current = (v: number) => {
    if (!isControlled) setInternal(v);
    onValueChange?.(v);
  };

  const wrapWhole = Math.min(MAX_WRAPS, Math.floor(wound / TAU + 1e-9));
  const gearMultiplier = Math.pow(8, wrapWhole);

  const valueText = () => {
    const w = Math.min(MAX_WRAPS, Math.floor(woundRef.current / TAU + 1e-9));
    const g = Math.pow(8, w);
    const wraps = w === 1 ? "1 wrap" : `${w} wraps`;
    return `${fmt(currentRef.current)} — precision ${gearLabel(g)}, ${wraps}`;
  };

  // paints every derived visual from refs — the drag hot path, no React state
  const paint = (angleForRopeDeg?: number, pointerLocal?: [number, number]) => {
    const w = woundRef.current;
    const whole = Math.min(MAX_WRAPS, Math.floor(w / TAU + 1e-9));
    const frac = (w % TAU) / TAU;
    const dir = windDirRef.current || 1;

    wrapRefs.current.forEach((el, i) => {
      if (el) el.style.opacity = i < whole ? "1" : "0";
    });

    const partialR = Math.max(HUB_R - WRAP_PITCH, WRAP_START_R - whole * WRAP_PITCH);
    if (partialRef.current) {
      if (frac > 0.002) {
        partialRef.current.setAttribute("d", arcPath(C, C, partialR, -90, dir * frac * 360));
        partialRef.current.style.opacity = "1";
      } else {
        partialRef.current.style.opacity = "0";
      }
    }

    const handleAngle = angleForRopeDeg ?? -90 + dir * frac * 360;
    const [hx, hy] = polar(C, C, partialR, handleAngle);
    handleRef.current?.setAttribute("cx", hx.toFixed(2));
    handleRef.current?.setAttribute("cy", hy.toFixed(2));

    if (ropeRef.current) {
      if (pointerLocal) {
        ropeRef.current.setAttribute("x1", hx.toFixed(2));
        ropeRef.current.setAttribute("y1", hy.toFixed(2));
        ropeRef.current.setAttribute("x2", pointerLocal[0].toFixed(2));
        ropeRef.current.setAttribute("y2", pointerLocal[1].toFixed(2));
        ropeRef.current.style.opacity = "1";
      } else {
        ropeRef.current.style.opacity = "0";
      }
    }

    if (readoutRef.current) readoutRef.current.textContent = fmt(currentRef.current);
    if (gearRef.current) gearRef.current.textContent = gearLabel(Math.pow(8, whole));

    const track = trackRef.current;
    if (track) {
      track.setAttribute("aria-valuenow", String(currentRef.current));
      track.setAttribute("aria-valuetext", valueText());
    }
  };

  useEffect(() => {
    paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, wound]);

  const toLocal = (clientX: number, clientY: number): [number, number] | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return [((clientX - rect.left) * VIEW) / rect.width, ((clientY - rect.top) * VIEW) / rect.height];
  };

  const applyDelta = (dPhi: number) => {
    if (!dPhi) return;
    const before = woundRef.current;
    const rate = baseRate * Math.exp(-MU * before);
    rawRef.current = clamp(rawRef.current + dPhi * rate, min, safeMax);

    let dir = windDirRef.current;
    const s = Math.sign(dPhi);
    if (dir === 0 || s === dir) {
      dir = dir === 0 ? s : dir;
      woundRef.current = Math.min(MAX_WOUND, before + Math.abs(dPhi));
    } else {
      const payOut = Math.abs(dPhi);
      if (payOut <= before) {
        woundRef.current = before - payOut;
      } else {
        dir = s;
        woundRef.current = Math.min(MAX_WOUND, payOut - before);
      }
    }
    windDirRef.current = dir;

    const q = quantize(rawRef.current);
    if (q !== currentRef.current) {
      currentRef.current = q;
      commitRef.current(q);
    }
  };

  const endDrag = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setWound(woundRef.current);
    paint();
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const p = toLocal(e.clientX, e.clientY);
    if (!p) return;
    trackRef.current?.setPointerCapture(e.pointerId);
    trackRef.current?.focus({ preventScroll: true });
    draggingRef.current = true;
    rawRef.current = currentRef.current;
    prevAngleRef.current = Math.atan2(p[1] - C, p[0] - C);
    paint(toDeg(prevAngleRef.current), p);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const p = toLocal(e.clientX, e.clientY);
    if (!p) return;
    const angle = Math.atan2(p[1] - C, p[0] - C);
    applyDelta(radDelta(angle, prevAngleRef.current));
    prevAngleRef.current = angle;
    paint(toDeg(angle), p);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const whole = Math.min(MAX_WRAPS, Math.floor(woundRef.current / TAU + 1e-9));
    const keyStep = Math.max(safeStep, coarseStep / Math.pow(8, whole));
    let next: number | null = null;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = currentRef.current + keyStep;
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = currentRef.current - keyStep;
        break;
      case "PageUp": {
        e.preventDefault();
        woundRef.current = Math.min(MAX_WOUND, woundRef.current + TAU);
        if (windDirRef.current === 0) windDirRef.current = 1;
        rawRef.current = currentRef.current;
        const w = Math.min(MAX_WRAPS, Math.floor(woundRef.current / TAU + 1e-9));
        setWound(woundRef.current);
        setAnnounce(
          w >= MAX_WRAPS
            ? `precision ${gearLabel(Math.pow(8, w))}, maximum`
            : `precision ${gearLabel(Math.pow(8, w))}`
        );
        return;
      }
      case "PageDown": {
        e.preventDefault();
        woundRef.current = Math.max(0, woundRef.current - TAU);
        if (woundRef.current === 0) windDirRef.current = 0;
        rawRef.current = currentRef.current;
        const w = Math.floor(woundRef.current / TAU + 1e-9);
        setWound(woundRef.current);
        setAnnounce(w > 0 ? `precision ${gearLabel(Math.pow(8, w))}` : "precision ×1, unwound");
        return;
      }
      case "Home":
        e.preventDefault();
        woundRef.current = 0;
        windDirRef.current = 0;
        rawRef.current = currentRef.current;
        setWound(0);
        setAnnounce("wraps reset, precision ×1");
        return;
      default:
        return;
    }
    e.preventDefault();
    next = quantize(next);
    if (next !== currentRef.current) {
      currentRef.current = next;
      rawRef.current = next;
      commitRef.current(next);
      paint();
    }
  };

  const wraps = Array.from({ length: MAX_WRAPS }, (_, i) => i);

  return (
    <div
      className={`w-full max-w-xs rounded-lg border border-border bg-surface p-4 font-mono ${className}`}
    >
      <div className="flex items-baseline justify-between gap-3 pb-3">
        <span className="text-[10px] uppercase tracking-[0.2em] text-ns-muted">{label}</span>
        <span aria-hidden className="text-[10px] tabular-nums text-ns-muted">
          {gearLabel(gearMultiplier)}
        </span>
      </div>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={safeMax}
        aria-valuenow={current}
        aria-valuetext={valueText()}
        data-capstan-track
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="relative mx-auto block aspect-square w-full max-w-[240px] touch-none select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          className="block h-full w-full cursor-grab active:cursor-grabbing"
          aria-hidden
        >
          <circle
            cx={C}
            cy={C}
            r={DRUM_R}
            className="text-border"
            stroke="currentColor"
            strokeWidth={1}
            fill="none"
          />
          {wraps.map((i) => (
            <circle
              key={i}
              ref={(el) => {
                wrapRefs.current[i] = el;
              }}
              cx={C}
              cy={C}
              r={WRAP_START_R - i * WRAP_PITCH}
              className="text-border"
              stroke="currentColor"
              strokeWidth={1.5}
              fill="none"
              style={{ opacity: i < wrapWhole ? 1 : 0, transition: "opacity 150ms" }}
            />
          ))}
          <line
            ref={ropeRef}
            className="text-foreground/50"
            stroke="currentColor"
            strokeWidth={1}
            strokeDasharray="2 3"
            style={{ opacity: 0 }}
          />
          <path
            ref={partialRef}
            className="text-foreground"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="none"
            style={{ opacity: 0 }}
          />
          <circle ref={handleRef} r={4} className="text-foreground" fill="currentColor" />
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span ref={readoutRef} className="text-2xl font-semibold tabular-nums text-foreground">
            {fmt(current)}
          </span>
          {unit ? <span className="text-[10px] text-ns-muted">{unit}</span> : null}
          <span ref={gearRef} className="text-[10px] tabular-nums text-ns-muted">
            {gearLabel(gearMultiplier)}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 font-mono text-[10px] text-ns-muted">
        <span>drag in circles to wind · reverse pays out</span>
        <span aria-hidden className="tabular-nums">
          {wrapWhole}/{MAX_WRAPS} wraps
        </span>
      </div>

      <div aria-live="polite" className="sr-only">
        {announce}
      </div>
    </div>
  );
}
