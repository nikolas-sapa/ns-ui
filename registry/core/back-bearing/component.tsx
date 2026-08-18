"use client";

import { useEffect, useRef, useState } from "react";

// BackBearing — a sighting-compass bearing picker. A surveyor never trusts a
// single reading: the instrument always shows the fore bearing AND its
// reciprocal (+-180 deg) on the far side of the card, because a transposed
// digit only ever shows up as a back bearing that doesn't reconcile. So this
// is built like the real thing: one graduated card rotates under a FIXED
// lubber line, never a needle sweeping over a static rose. The lubber line,
// the fore readout (an always-editable Geist Mono input, not a popup) and
// the back readout never move — only the card turns, by -theta. Drag maps
// pointer atan2 to theta through a shortest signed delta (never the long way
// around), so mid-drag the card tracks the pointer 1:1; release hands the
// residual angular velocity to a second-order damped spring tuned just
// under critical (zeta ~0.85, matching confirm-dial-align's snap) so the
// card gives exactly one visible overshoot before it settles, the way a
// liquid-damped marine card behaves under real inertia. Direct-DOM refs
// drive the rotation every frame; React state carries only the committed
// theta. Zero deps, no canvas.

const K = 260; // spring stiffness, deg/s^2 per deg of displacement
const ZETA = 0.85; // just under critical -> exactly one overshoot
const C = 2 * ZETA * Math.sqrt(K);
const SLEEP_VEL = 0.5; // deg/s
const SLEEP_POS = 0.05; // deg

const CX = 120;
const CY = 120;
const R_OUTER = 104; // bezel radius
const R_TICK_OUTER = 100;
const R_MINOR_INNER = 94;
const R_MAJOR_INNER = 88;
const R_LETTER = 74;
const TICK_DEGREES = Array.from({ length: 180 }, (_, i) => i * 2);
const CARDINALS: { deg: number; letter: string }[] = [
  { deg: 0, letter: "N" },
  { deg: 90, letter: "E" },
  { deg: 180, letter: "S" },
  { deg: 270, letter: "W" },
];

function wrap360(v: number) {
  const w = v % 360;
  return w < 0 ? w + 360 : w;
}

function displayDeg(v: number) {
  let d = Math.round(v) % 360;
  if (d < 0) d += 360;
  return d;
}

function shortestDelta(from: number, to: number) {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

function polar(r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + r * Math.sin(rad), y: CY - r * Math.cos(rad) };
}

function pad3(n: number) {
  return String(n).padStart(3, "0");
}

export interface BackBearingProps {
  /** controlled bearing in degrees true, 0-359.999; omit for uncontrolled */
  value?: number;
  /** uncontrolled initial bearing in degrees true */
  defaultValue?: number;
  /** fires on every committed change (drag, keys, or typed digits) */
  onValueChange?: (value: number) => void;
  /** accessible name for the instrument, also the input's label prefix */
  label?: string;
  /** dial diameter in px. Ticks are tuned for the 240 default. */
  size?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function BackBearing({
  value,
  defaultValue = 42,
  onValueChange,
  label = "Bearing",
  size = 240,
  className = "",
}: BackBearingProps) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(() => wrap360(defaultValue));
  const current = isControlled ? wrap360(value as number) : internal;
  const currentRef = useRef(current);
  currentRef.current = current;

  const foreDisp = displayDeg(current);
  const backDisp = displayDeg(current + 180);
  const valuetext = `bearing ${pad3(foreDisp)} degrees, back bearing ${pad3(backDisp)}`;

  const commitRef = useRef<(v: number) => void>(() => {});
  commitRef.current = (v: number) => {
    if (!isControlled) setInternal(v);
    onValueChange?.(v);
  };

  const regionRef = useRef<HTMLDivElement>(null);
  const cardGroupRef = useRef<SVGGElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputFocusedRef = useRef(false);
  const [inputText, setInputText] = useState(() => pad3(displayDeg(defaultValue)));

  // keep the typed-value input in sync with committed changes that came
  // from drag or arrow keys, but never fight the caret while the user types
  useEffect(() => {
    if (!inputFocusedRef.current) setInputText(pad3(foreDisp));
  }, [foreDisp]);

  const engineRef = useRef<{
    dragStart: (e: PointerEvent) => void;
    dragMove: (e: PointerEvent) => void;
    dragEnd: () => void;
    settleTo: (theta: number) => void;
  } | null>(null);

  // -- physics engine: direct DOM writes, React state only for the commit --
  useEffect(() => {
    const region = regionRef.current;
    const cardGroup = cardGroupRef.current;
    if (!region || !cardGroup) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let committedRaw = currentRef.current; // continuous, unbounded
    let visualRaw = committedRaw;
    let vel = 0; // deg/s, drives the settle spring
    let dragging = false;
    let lastBearing = 0;
    let lastTime = 0;
    let raf = 0;
    let last = 0;

    const paint = (raw: number) => {
      cardGroup.setAttribute("transform", `rotate(${-raw} ${CX} ${CY})`);
    };
    paint(visualRaw);

    const loop = (now: number) => {
      const dt = last === 0 ? 1 / 60 : Math.min(0.05, (now - last) / 1000);
      last = now;
      const disp = visualRaw - committedRaw;
      vel += (-K * disp - C * vel) * dt;
      visualRaw += vel * dt;
      paint(visualRaw);
      if (Math.abs(vel) < SLEEP_VEL && Math.abs(visualRaw - committedRaw) < SLEEP_POS) {
        visualRaw = committedRaw;
        vel = 0;
        paint(visualRaw);
        raf = 0;
        last = 0;
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    const wake = () => {
      if (!raf && !reduced) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const pointerBearing = (e: PointerEvent) => {
      const r = region.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      return wrap360((Math.atan2(dy, dx) * 180) / Math.PI + 90);
    };

    const dragStart = (e: PointerEvent) => {
      try {
        region.setPointerCapture(e.pointerId);
      } catch {
        // synthetic pointerIds (autoplay driver) may not resolve to a live
        // pointer — drag still works without capture
      }
      dragging = true;
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
      vel = 0;
      lastBearing = pointerBearing(e);
      lastTime = performance.now();
    };

    const dragMove = (e: PointerEvent) => {
      if (!dragging) return;
      const pb = pointerBearing(e);
      const d = shortestDelta(lastBearing, pb);
      const t = performance.now();
      const mdt = Math.max(1e-3, (t - lastTime) / 1000);
      committedRaw += d;
      let theta = wrap360(committedRaw);
      if (e.shiftKey) {
        const snapped = wrap360(Math.round(theta / 22.5) * 22.5);
        committedRaw += shortestDelta(theta, snapped);
        theta = wrap360(committedRaw);
      }
      visualRaw = committedRaw;
      paint(visualRaw);
      vel = Math.max(-720, Math.min(720, 0.7 * vel + 0.3 * (d / mdt)));
      lastBearing = pb;
      lastTime = t;
      if (theta !== currentRef.current) commitRef.current(theta);
    };

    const dragEnd = () => {
      if (!dragging) return;
      dragging = false;
      if (reduced) {
        vel = 0;
        return;
      }
      // visualRaw already equals committedRaw (1:1 tracking while dragging);
      // the captured velocity alone drives the single overshoot on release
      wake();
    };

    const settleTo = (theta: number) => {
      const from = wrap360(committedRaw);
      committedRaw += shortestDelta(from, theta);
      if (reduced) {
        cancelAnimationFrame(raf);
        raf = 0;
        visualRaw = committedRaw;
        vel = 0;
        paint(visualRaw);
        return;
      }
      wake();
    };

    engineRef.current = { dragStart, dragMove, dragEnd, settleTo };

    return () => {
      cancelAnimationFrame(raf);
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    let dir = 0;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") dir = 1;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") dir = -1;
    else return;
    e.preventDefault();
    const cur = currentRef.current;
    let next: number;
    if (e.shiftKey) {
      const n = cur / 22.5;
      const idx = dir > 0 ? Math.floor(n + 1e-6) + 1 : Math.ceil(n - 1e-6) - 1;
      next = wrap360(idx * 22.5);
    } else {
      next = wrap360(cur + dir);
    }
    engineRef.current?.settleTo(next);
    commitRef.current(next);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 3);
    setInputText(digits);
    if (digits === "") return;
    const parsed = parseInt(digits, 10);
    if (Number.isNaN(parsed)) return;
    const next = wrap360(parsed);
    if (next !== currentRef.current) {
      engineRef.current?.settleTo(next);
      commitRef.current(next);
    }
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
  };

  return (
    <div
      className={`flex w-full flex-col items-center gap-4 font-mono ${className}`}
    >
      <div className="flex items-baseline gap-1">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={inputText}
          onFocus={() => {
            inputFocusedRef.current = true;
          }}
          onBlur={() => {
            inputFocusedRef.current = false;
            setInputText(pad3(displayDeg(currentRef.current)));
          }}
          onChange={onInputChange}
          onKeyDown={onInputKeyDown}
          aria-label={`${label} degrees`}
          className="w-20 rounded-sm border border-border bg-surface px-2 py-1 text-center text-2xl tabular-nums text-foreground outline-none transition-colors duration-150 hover:border-ns-muted focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
        <span aria-hidden className="text-2xl text-foreground">
          &deg;
        </span>
      </div>

      <div
        className="relative shrink-0"
        style={{ width: size, height: size }}
      >
        <div
          ref={regionRef}
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={359}
          aria-valuenow={foreDisp}
          aria-valuetext={valuetext}
          onKeyDown={onKeyDown}
          onPointerDown={(e) => {
            regionRef.current?.focus({ preventScroll: true });
            engineRef.current?.dragStart(e.nativeEvent);
          }}
          onPointerMove={(e) => engineRef.current?.dragMove(e.nativeEvent)}
          onPointerUp={() => engineRef.current?.dragEnd()}
          onPointerCancel={() => engineRef.current?.dragEnd()}
          className="group absolute inset-0 cursor-grab touch-none select-none rounded-full outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <svg
            viewBox="0 0 240 240"
            className="h-full w-full"
            aria-hidden
          >
            {/* bezel: fixed housing, never rotates */}
            <circle
              cx={CX}
              cy={CY}
              r={R_OUTER}
              className="fill-surface stroke-border transition-colors duration-150 group-hover:stroke-ns-muted"
              strokeWidth={1}
            />

            {/* graduated card: the ONLY thing that rotates, by -theta */}
            <g ref={cardGroupRef}>
              {TICK_DEGREES.map((deg) => {
                const major = deg % 10 === 0;
                const outer = polar(R_TICK_OUTER, deg);
                const inner = polar(
                  major ? R_MAJOR_INNER : R_MINOR_INNER,
                  deg
                );
                return (
                  <line
                    key={deg}
                    x1={outer.x}
                    y1={outer.y}
                    x2={inner.x}
                    y2={inner.y}
                    strokeWidth={major ? 2 : 1}
                    className={major ? "stroke-foreground" : "stroke-border"}
                  />
                );
              })}
              {CARDINALS.map(({ deg, letter }) => {
                const p = polar(R_LETTER, deg);
                return (
                  <text
                    key={letter}
                    x={p.x}
                    y={p.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={18}
                    className="select-none fill-foreground font-mono font-semibold"
                  >
                    {letter}
                  </text>
                );
              })}
            </g>

            {/* lubber line — fixed, marks where the fore bearing is read */}
            <polygon
              points="120,16 113,3 127,3"
              className="fill-foreground"
            />
            {/* back-sight index — fixed, diametrically opposite the lubber
                line, marks where the reciprocal is read */}
            <polygon
              points="120,224 114,236 126,236"
              className="fill-ns-muted"
            />
            {/* pivot — fixed */}
            <circle cx={CX} cy={CY} r={3} className="fill-foreground" />
          </svg>
        </div>
      </div>

      <div
        aria-hidden
        className="flex items-baseline gap-1.5 text-ns-muted"
      >
        <span className="text-[10px] uppercase tracking-[0.2em]">
          back bearing
        </span>
        <span className="text-sm tabular-nums">
          {pad3(backDisp)}&deg;
        </span>
      </div>
    </div>
  );
}
