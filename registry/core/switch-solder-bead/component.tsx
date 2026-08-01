"use client";

import { useEffect, useId, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// SolderBridge — a boolean switch rendered as two liquid solder beads on a
// hairline rail, trading mass through a gooey neck instead of sliding a
// thumb. Both beads sit at FIXED anchor points; only their radius (mass)
// and a connecting neck's thickness change. The gooey look (bulge, stretch,
// pinch-off) comes from the same recipe as toc-minimap-mercury: blur the whole
// liquid layer, then push contrast back up with a matrix threshold so
// anything close enough merges into one blob and anything far enough snaps
// apart cleanly — no manual blob-path math needed.
//
// `ratio` (0-1) is the fraction of the total mass sitting in the RIGHT
// bead. It defaults to 0.9 when checked, 0.1 when unchecked (a solder bead
// never fully empties), but can be passed explicitly to render a partial
// allocation independent of the boolean switch semantics — the control
// stays a switch (role=switch/aria-checked/click/Space toggle checked),
// the ratio is just what's drawn.
//
// All per-frame writes (bead radii, neck thickness) are direct DOM
// attribute/style writes via refs inside a rAF loop that only runs for the
// ~450ms of an active transition — not a persistent per-frame loop.
// prefers-reduced-motion skips the tween: the target ratio is applied
// instantly, neck never appears.
// ---------------------------------------------------------------------------

export interface SolderBridgeProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Fraction (0-1) of mass in the right bead. Overrides the checked-derived default. */
  ratio?: number;
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
}

const VIEW_W = 64;
const VIEW_H = 24;
const CY = 12;
const LEFT_X = 18;
const RIGHT_X = 46;
const RAIL_X1 = 8;
const RAIL_X2 = 56;
const R_MIN = 3.5;
const R_MAX = 8.2;
const NECK_MAX_H = 9;
const TRANSITION_MS = 450;

function radiusFor(mass: number): number {
  return R_MIN + (R_MAX - R_MIN) * Math.min(1, Math.max(0, mass));
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function defaultRatio(checked: boolean): number {
  return checked ? 0.9 : 0.1;
}

export function SolderBridge({
  checked,
  defaultChecked = false,
  onCheckedChange,
  ratio,
  disabled = false,
  "aria-label": ariaLabel = "Toggle allocation",
  className = "",
}: SolderBridgeProps) {
  const autoId = useId();
  const isControlled = checked !== undefined;
  const [uncontrolledChecked, setUncontrolledChecked] = useState(defaultChecked);
  const isChecked = isControlled ? checked : uncontrolledChecked;

  const targetRatio = ratio ?? defaultRatio(isChecked);
  // Frozen at mount — the only JSX-driven radius. Every ratio change after
  // that is a direct DOM write from the rAF tween below, never a re-render,
  // so React can't snap the shape ahead of the animation and cause a flash.
  const [initialRatio] = useState(targetRatio);

  const leftRef = useRef<SVGCircleElement | null>(null);
  const rightRef = useRef<SVGCircleElement | null>(null);
  const neckRef = useRef<SVGRectElement | null>(null);

  const currentRatioRef = useRef(initialRatio);
  const reducedRef = useRef(false);
  const rafRef = useRef(0);

  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onChange = () => (reducedRef.current = mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const paint = (r: number, neckH: number) => {
    const leftMass = 1 - r;
    const rightMass = r;
    leftRef.current?.setAttribute("r", String(radiusFor(leftMass)));
    rightRef.current?.setAttribute("r", String(radiusFor(rightMass)));
    if (neckRef.current) {
      neckRef.current.setAttribute("height", String(neckH));
      neckRef.current.setAttribute("y", String(CY - neckH / 2));
      neckRef.current.setAttribute("rx", String(neckH / 2));
      neckRef.current.style.opacity = neckH > 0.3 ? "1" : "0";
    }
  };

  // Animate whenever the target ratio changes.
  useEffect(() => {
    const from = currentRatioRef.current;
    const to = targetRatio;
    cancelAnimationFrame(rafRef.current);

    if (reducedRef.current || from === to) {
      currentRatioRef.current = to;
      paint(to, 0);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / TRANSITION_MS);
      const eased = easeInOutCubic(t);
      const r = from + (to - from) * eased;
      currentRatioRef.current = r;
      // Neck bulges mid-transition, pinches off before it completes.
      const neckPhase = Math.min(1, Math.max(0, (t - 0.08) / 0.72));
      const neckH = t < 0.08 || t > 0.8 ? 0 : Math.sin(Math.PI * neckPhase) * NECK_MAX_H;
      paint(r, neckH);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        paint(to, 0);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetRatio]);

  useEffect(() => {
    setAnnounce(ratio !== undefined ? `${Math.round(ratio * 100)}% allocated` : isChecked ? "On" : "Off");
  }, [isChecked, ratio]);

  const toggle = () => {
    if (disabled) return;
    const next = !isChecked;
    if (!isControlled) setUncontrolledChecked(next);
    onCheckedChange?.(next);
  };

  const fid = `sb-goo-${autoId.replace(/:/g, "")}`;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isChecked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={toggle}
      className={`relative inline-flex shrink-0 items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer group"
      } ${className}`}
      style={{ width: VIEW_W, height: VIEW_H }}
    >
      <style>{CSS}</style>
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announce}
      </span>

      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width={VIEW_W}
        height={VIEW_H}
        aria-hidden="true"
        focusable="false"
        className="overflow-visible"
      >
        <defs>
          <filter id={fid} x="-60%" y="-120%" width="220%" height="340%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.6" result="blur" />
            <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" />
          </filter>
        </defs>

        <line x1={RAIL_X1} y1={CY} x2={RAIL_X2} y2={CY} stroke="var(--border)" strokeWidth={1} />

        <g filter={`url(#${fid})`} fill="var(--foreground)">
          <rect ref={neckRef} x={LEFT_X + 2} y={CY} width={RIGHT_X - LEFT_X - 4} height={0} rx={0} />
          <circle ref={leftRef} cx={LEFT_X} cy={CY} r={radiusFor(1 - initialRatio)} />
          <circle ref={rightRef} cx={RIGHT_X} cy={CY} r={radiusFor(initialRatio)} />
        </g>

        <circle className="ns-sb-sheen" cx={LEFT_X - 1.6} cy={CY - 1.8} r={1.1} fill="var(--background)" />
        <circle className="ns-sb-sheen" cx={RIGHT_X - 1.6} cy={CY - 1.8} r={1.1} fill="var(--background)" />
      </svg>
    </button>
  );
}

const CSS = `
.ns-sb-sheen { opacity: 0; transition: opacity 200ms ease-out; }
.group:hover .ns-sb-sheen, .group:focus-visible .ns-sb-sheen { opacity: 0.5; }
@media (prefers-reduced-motion: reduce) {
  .ns-sb-sheen { transition: none; }
}
`;
