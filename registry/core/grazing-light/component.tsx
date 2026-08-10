"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// GrazingLight — a feature card whose icon and heading are blind-embossed
// into the surface: no fill color change, just a pair of 1px light/dark
// text-shadows offset by cos/sin of ONE angle, --rake-angle. At rest that
// angle eases through a slow 24s circuit (ease-in-out per 90deg quadrant, so
// it lingers at each compass point) — the relief brightens and vanishes as
// the simulated light rakes across, with zero layout motion. On pointermove
// anywhere over the grid, every card computes its OWN bearing to the cursor
// (atan2 of cursor-minus-center) and springs its angle there — the whole
// grid reads as one lit surface tracking a single light source, not N
// independent hover effects.
//
// Mechanism, driven by one number: each frame writes --rake-angle (deg) on
// the card root, then derives cos/sin of that angle once and applies it to
// (a) the heading's dual text-shadow bevel, (b) two feDropShadow primitives
// stacked in the icon's SVG filter — literal duplicates of the same offset,
// not a CSS approximation — and (c) a one-sided inset box-shadow standing in
// for the card border catching the same light. All three are recomputed
// from that one angle every tick; nothing else on the card moves.
//
// GrazingLightGrid is an optional wrapping provider: it runs the ONE rAF
// loop and the ONE pointermove listener for however many cards it contains
// (matching MagneticDock's single-loop idiom elsewhere in this repo) and
// broadcasts {idle angle, pointer position} to every subscribed card each
// frame — the shared clock is what keeps the idle circuit phase-coherent
// across cards that may have mounted at different times. A card rendered
// without a GrazingLightGrid ancestor falls back to running the identical
// math on its own loop, scoped to its own bounding box, so it still works
// standalone.
//
// A11y: the card is a single <a>, its accessible name comes from the real
// heading + body text (never hidden behind the emboss) — remove the shadows
// entirely and the text is still fully legible; the emboss only adds
// texture; it never IS the text. Hover/focus affordance is a plain
// border-color shift (interaction-only --ns-accent), never the rake itself,
// so "which card is interactive" is never answered by the moving light.
// prefers-reduced-motion pins the rake at 315deg and skips every listener.
// ---------------------------------------------------------------------------

interface TickPayload {
  idleAngleDeg: number;
  pointer: { x: number; y: number } | null;
}

type TickFn = (payload: TickPayload) => void;

interface GridApi {
  subscribe(fn: TickFn): () => void;
}

const GridContext = createContext<GridApi | null>(null);

const IDLE_PERIOD_MS = 24000;
const QUADRANT_MS = IDLE_PERIOD_MS / 4;
const REDUCED_ANGLE_DEG = 315;
const SPRING = 0.12;
const DEG_TO_RAD = Math.PI / 180;

function easeInOutCubic(f: number): number {
  return f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2;
}

/** Angle (deg) of the 24s idle circuit at a given elapsed ms: 4 quadrants of
 * 90deg each, eased in-out per quadrant so the light lingers near every
 * compass point instead of sweeping at constant speed. */
function idleAngleAt(elapsedMs: number): number {
  const t = ((elapsedMs % IDLE_PERIOD_MS) + IDLE_PERIOD_MS) % IDLE_PERIOD_MS;
  const quadrant = Math.floor(t / QUADRANT_MS);
  const f = (t - quadrant * QUADRANT_MS) / QUADRANT_MS;
  return quadrant * 90 + easeInOutCubic(f) * 90;
}

/** Shortest signed delta (deg, -180..180) from `from` to `to`, so a spring
 * never takes the long way around the circle. */
function shortestDelta(from: number, to: number): number {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ---------------------------------------------------------------------------
// Card — declared before the grid provider below purely so this file's
// PROP-SHAPE SCANNER (scripts/build-llms.ts), which greps for the first
// `export interface *Props` in the file, resolves to the primary
// component's props (GrazingLightCardProps) rather than the wrapper's.
// No runtime meaning to the position — same convention as
// registry/core/tooltip-delay-group/component.tsx.
// ---------------------------------------------------------------------------

export interface GrazingLightCardProps {
  /** Card heading — embossed, still full-contrast plain text underneath. */
  heading: string;
  /** Supporting copy. Never embossed, always flat and fully legible. */
  body: string;
  /** The card is a single link; this is its destination. */
  href: string;
  /** Icon content: one or more <path>/<g> nodes drawn in a 0 0 24 24
   * viewBox, fill="currentColor". Defaults to a built-in sparkle glyph. */
  icon?: ReactNode;
  className?: string;
}

const DEFAULT_ICON_PATH =
  "M12 3c.6 3.4 1.7 5.6 3 7 1.4 1.3 3.6 2.4 7 3-3.4.6-5.6 1.7-7 3-1.3 1.4-2.4 3.6-3 7-.6-3.4-1.7-5.6-3-7-1.4-1.3-3.6-2.4-7-3 3.4-.6 5.6-1.7 7-3 1.3-1.4 2.4-3.6 3-7z";

export function GrazingLightCard({ heading, body, href, icon, className = "" }: GrazingLightCardProps) {
  const reactId = useId().replace(/:/g, "");
  const filterId = `ns-gl-filter-${reactId}`;
  const rootRef = useRef<HTMLAnchorElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const lightShadowRef = useRef<SVGFEDropShadowElement>(null);
  const darkShadowRef = useRef<SVGFEDropShadowElement>(null);
  const angleRef = useRef(REDUCED_ANGLE_DEG);
  const grid = useContext(GridContext);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const paint = (deg: number) => {
      const rad = deg * DEG_TO_RAD;
      const cosA = Math.cos(rad);
      const sinA = Math.sin(rad);
      root.style.setProperty("--rake-angle", `${deg.toFixed(1)}deg`);
      if (headingRef.current) {
        headingRef.current.style.textShadow =
          `${(-cosA).toFixed(2)}px ${(-sinA).toFixed(2)}px 0 var(--border), ` +
          `${cosA.toFixed(2)}px ${sinA.toFixed(2)}px 0 var(--ns-muted)`;
      }
      lightShadowRef.current?.setAttribute("dx", (-cosA).toFixed(2));
      lightShadowRef.current?.setAttribute("dy", (-sinA).toFixed(2));
      darkShadowRef.current?.setAttribute("dx", cosA.toFixed(2));
      darkShadowRef.current?.setAttribute("dy", sinA.toFixed(2));
      root.style.boxShadow = `inset ${(-cosA * 1.5).toFixed(2)}px ${(-sinA * 1.5).toFixed(2)}px 0 0 color-mix(in srgb, var(--foreground) 14%, transparent)`;
    };

    if (prefersReducedMotion()) {
      angleRef.current = REDUCED_ANGLE_DEG;
      paint(REDUCED_ANGLE_DEG);
      return;
    }

    const tick = ({ idleAngleDeg, pointer }: TickPayload) => {
      const rect = root.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const target = pointer
        ? (((Math.atan2(pointer.y - cy, pointer.x - cx) * 180) / Math.PI) + 360) % 360
        : idleAngleDeg;
      const delta = shortestDelta(angleRef.current, target);
      angleRef.current = (angleRef.current + delta * SPRING + 360) % 360;
      paint(angleRef.current);
    };

    if (grid) {
      return grid.subscribe(tick);
    }

    // Standalone fallback: no GrazingLightGrid ancestor, so this card runs
    // the identical idle-circuit + bearing-spring math on its own loop,
    // tracking pointer movement over its own box only.
    const origin = performance.now();
    let pointer: { x: number; y: number } | null = null;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      pointer = { x: e.clientX, y: e.clientY };
    };
    const onLeave = () => {
      pointer = null;
    };
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    const loop = () => {
      tick({ idleAngleDeg: idleAngleAt(performance.now() - origin), pointer });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
    };
  }, [grid]);

  return (
    <a
      ref={rootRef}
      href={href}
      className={`ns-gl-card relative flex flex-col gap-3 rounded-lg border border-border bg-background p-6 no-underline transition-colors duration-200 hover:border-ns-accent/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ns-accent ${className}`}
      style={{ ["--rake-angle" as string]: `${REDUCED_ANGLE_DEG}deg` }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true" className="text-foreground">
        <defs>
          <filter id={filterId} x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow
              ref={lightShadowRef}
              dx="0"
              dy="0"
              stdDeviation="0"
              floodColor="var(--border)"
              floodOpacity="0.9"
            />
            <feDropShadow
              ref={darkShadowRef}
              dx="0"
              dy="0"
              stdDeviation="0"
              floodColor="var(--ns-muted)"
              floodOpacity="0.9"
            />
          </filter>
        </defs>
        <g style={{ filter: `url(#${filterId})` }} fill="currentColor">
          {icon ?? <path d={DEFAULT_ICON_PATH} />}
        </g>
      </svg>
      <h3 ref={headingRef} className="text-base font-semibold tracking-tight text-foreground">
        {heading}
      </h3>
      <p className="text-sm leading-relaxed text-ns-muted">{body}</p>
    </a>
  );
}

export default GrazingLightCard;

// ---------------------------------------------------------------------------
// Grid provider — one rAF loop, one pointermove listener, N subscribers.
// ---------------------------------------------------------------------------

export interface GrazingLightGridProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onPointerMove" | "onPointerLeave"> {
  children: ReactNode;
}

export function GrazingLightGrid({ children, className = "", ...rest }: GrazingLightGridProps) {
  const subsRef = useRef<Set<TickFn>>(new Set());
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const apiRef = useRef<GridApi>({
    subscribe(fn: TickFn) {
      subsRef.current.add(fn);
      return () => {
        subsRef.current.delete(fn);
      };
    },
  });

  useEffect(() => {
    if (prefersReducedMotion()) return; // subscribers detect this themselves and skip ticks entirely
    const origin = performance.now();
    let raf = 0;
    const loop = () => {
      const idleAngleDeg = idleAngleAt(performance.now() - origin);
      const payload: TickPayload = { idleAngleDeg, pointer: pointerRef.current };
      subsRef.current.forEach((fn) => fn(payload));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointerRef.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerLeave = () => {
    pointerRef.current = null;
  };

  return (
    <GridContext.Provider value={apiRef.current}>
      <div {...rest} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave} className={className}>
        {children}
      </div>
    </GridContext.Provider>
  );
}
