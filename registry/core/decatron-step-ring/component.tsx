"use client";

import { useEffect, useMemo, useRef } from "react";

// ---------------------------------------------------------------------------
// DecatronStepRing — a circular step/cyclic-position indicator modelled on a
// decatron cold-cathode counting tube: ten main-cathode stations arranged
// radially, with a guide-electrode station interleaved between each pair.
// Real decatrons never jump the glow discharge straight from one cathode to
// the next — a guide electrode between them is pulsed first and the glow
// visibly stretches partway onto it, then the next main cathode's pulse
// completes the transfer and the glow snaps fully home. That two-phase
// "stretch, then snap" is the entire mechanic; everything below exists to
// keep it legible at one station per 1.4s.
//
// Geometry is fixed inside a 200x200 viewBox (mainAngle(k) = -90 + k*36deg,
// guideAngle(k) = mainAngle(k) + 18deg, ring radius = 38% of the viewBox),
// so `preserveAspectRatio="xMidYMid meet"` alone derives the ring from
// whichever dimension of the container is smaller — no ResizeObserver
// needed for layout, only a zero-size guard before the paint loop starts.
//
// All ink is CSS custom properties read natively by the SVG (fill/stop-color
// set via `var(--token)` in `style`, exactly the pattern auxin-canal uses)
// so theme swaps repaint for free with no getComputedStyle round trip and no
// pre-paint race. Unlit nodes are `color-mix(in oklch, var(--foreground)
// 38%, var(--background))` rather than a fixed low-opacity foreground — a
// blend anchored to both theme tokens instead of one, so the ring reads as
// ten dots at a consistent contrast in both themes rather than nearly
// vanishing in light theme the way a flat low-alpha dot would.
//
// Only opacity/radius on the lit elements move per frame (direct attribute
// writes on refs, no React state on the hot path): a small litCore + halo
// per main cathode, and one stretched halo ellipse per guide gap, spanning
// the two main cathodes it sits between.
// ---------------------------------------------------------------------------

const STATIONS = 10;
const STEP_MS = 1400;
const GUIDE_FRAC = 0.3; // first 30% of a step is the guide-transfer phase
const NOISE_HZ = 2; // idle plasma noise on the lit halo
const NOISE_AMP = 0.08; // +-8% halo radius

const VB = 200;
const CENTER = VB / 2;
const RING_R = VB * 0.38;
const MAIN_DOT_R = RING_R * 0.04;
const GUIDE_DOT_R = MAIN_DOT_R * 0.85;
const LIT_CORE_R = MAIN_DOT_R * 1.2;
const HALO_R = RING_R * 0.14;

interface Pt {
  x: number;
  y: number;
}

// Rounded to a fixed precision so server (Node/V8) and client (browser JS
// engine) trig results can never differ at the last float bit and produce
// a hydration-mismatching attribute string — geometry is otherwise static.
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function polar(angleDeg: number, r: number): Pt {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: round4(CENTER + r * Math.cos(rad)), y: round4(CENTER + r * Math.sin(rad)) };
}

interface StretchEllipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rotate: number;
}

interface RingGeometry {
  mainPos: Pt[];
  guidePos: Pt[];
  stretch: StretchEllipse[];
}

function buildGeometry(): RingGeometry {
  const mainAngle = (k: number) => -90 + k * (360 / STATIONS);
  const mainPos = Array.from({ length: STATIONS }, (_, k) => polar(mainAngle(k), RING_R));
  const guidePos = Array.from({ length: STATIONS }, (_, k) =>
    polar(mainAngle(k) + 360 / STATIONS / 2, RING_R)
  );
  const stretch = Array.from({ length: STATIONS }, (_, k) => {
    const a = mainPos[k]!;
    const b = mainPos[(k + 1) % STATIONS]!;
    const center = guidePos[k]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    const rotate = round4((Math.atan2(dy, dx) * 180) / Math.PI);
    return {
      cx: center.x,
      cy: center.y,
      rx: round4(dist / 2 + HALO_R * 0.3),
      ry: round4(HALO_R * 0.5),
      rotate,
    };
  });
  return { mainPos, guidePos, stretch };
}

export interface DecatronStepRingProps {
  /** external station index (0-based) to home on; omit for a free-running,
   * self-advancing counter (the showpiece default). */
  activeStep?: number;
  /** accessible label announced when `activeStep` is provided */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function DecatronStepRing({ activeStep, label = "Step", className = "" }: DecatronStepRingProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const litCoreRefs = useRef<(SVGCircleElement | null)[]>([]);
  const haloRefs = useRef<(SVGCircleElement | null)[]>([]);
  const guideRefs = useRef<(SVGEllipseElement | null)[]>([]);

  const geometry = useMemo(buildGeometry, []);
  const controlled = activeStep !== undefined;
  const activeStepRef = useRef(activeStep);
  activeStepRef.current = activeStep;

  useEffect(() => {
    const root = rootRef.current;
    const svg = svgRef.current;
    if (!root || !svg) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let disposed = false;
    let visible = true;
    let raf = 0;
    let start = 0;

    // controlled-mode hop state: home is the settled station, a pending
    // target advances one hop per STEP_MS along the shortest direction
    // rather than teleporting.
    let home = ((activeStepRef.current ?? 0) % STATIONS + STATIONS) % STATIONS;
    let dir = 1;
    let hopsRemaining = 0;
    let hopStartElapsed = 0;

    const queueTo = (target: number, elapsed: number) => {
      const t = ((target % STATIONS) + STATIONS) % STATIONS;
      const diff = (t - home + STATIONS) % STATIONS;
      if (diff === 0) {
        hopsRemaining = 0;
        return;
      }
      dir = diff <= STATIONS / 2 ? 1 : -1;
      hopsRemaining = dir === 1 ? diff : STATIONS - diff;
      hopStartElapsed = elapsed;
    };

    const setNode = (refs: (SVGGraphicsElement | null)[], i: number, opacity: number, r?: number) => {
      const el = refs[i];
      if (!el) return;
      el.setAttribute("opacity", opacity.toFixed(3));
      if (r !== undefined) el.setAttribute("r", r.toFixed(2));
    };

    const render = (current: number, next: number, progress: number, noise: number) => {
      const mainBrightness = new Array<number>(STATIONS).fill(0);
      const guideBrightness = new Array<number>(STATIONS).fill(0);

      if (progress <= 0) {
        mainBrightness[current] = 1;
      } else if (progress < GUIDE_FRAC) {
        mainBrightness[current] = 1;
        guideBrightness[current] = (progress / GUIDE_FRAC) * 0.7;
      } else {
        const t3 = (progress - GUIDE_FRAC) / (1 - GUIDE_FRAC);
        mainBrightness[current] = 1 - t3;
        mainBrightness[next] = t3;
        guideBrightness[current] = 0.7 * (1 - t3);
      }

      for (let k = 0; k < STATIONS; k++) {
        const b = mainBrightness[k] ?? 0;
        setNode(litCoreRefs.current, k, b);
        const haloR = b > 0.02 ? HALO_R * noise : HALO_R;
        setNode(haloRefs.current, k, b * 0.9, haloR);
        const g = guideBrightness[k] ?? 0;
        setNode(guideRefs.current, k, (g / 0.7) * 0.85);
      }
    };

    const frame = (elapsed: number) => {
      const noise = 1 + NOISE_AMP * Math.sin(elapsed * 0.001 * 2 * Math.PI * NOISE_HZ);

      if (!controlled) {
        const totalSteps = elapsed / STEP_MS;
        const stepIndex = Math.floor(totalSteps);
        const progress = totalSteps - stepIndex;
        const current = ((stepIndex % STATIONS) + STATIONS) % STATIONS;
        const next = (current + 1) % STATIONS;
        render(current, next, progress, noise);
        return;
      }

      if (hopsRemaining <= 0) {
        render(home, home, 0, noise);
        return;
      }
      const local = elapsed - hopStartElapsed;
      let progress = Math.min(1, local / STEP_MS);
      const next = (home + dir + STATIONS) % STATIONS;
      if (progress >= 1) {
        home = next;
        hopsRemaining -= 1;
        hopStartElapsed = elapsed;
        progress = 0;
      }
      render(home, dir === 1 ? next : (home - 1 + STATIONS) % STATIONS, progress, noise);
    };

    const loop = (now: number) => {
      if (start === 0) start = now;
      frame(now - start);
      if (!disposed && visible) raf = requestAnimationFrame(loop);
      else raf = 0;
    };

    if (reduced) {
      // deliberately non-t0 frame: 15% into a step, mid guide-phase stretch,
      // so both the ring layout and the two-phase transfer read at a glance.
      render(0, 1, 0.15, 1);
    } else {
      raf = requestAnimationFrame(loop);
    }

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !raf && !reduced && !disposed) {
        start = 0;
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(root);

    // controlled-mode prop watcher: re-queue toward the latest activeStep
    // whenever it changes, without restarting the whole rAF loop.
    let lastSeenTarget = activeStepRef.current;
    const watch = () => {
      if (disposed) return;
      if (controlled && activeStepRef.current !== lastSeenTarget) {
        lastSeenTarget = activeStepRef.current;
        queueTo(activeStepRef.current ?? 0, performance.now() - start);
      }
    };
    const watchId = controlled ? window.setInterval(watch, 100) : 0;

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      io.disconnect();
      if (watchId) window.clearInterval(watchId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlled]);

  const dimFill = "color-mix(in oklch, var(--foreground) 38%, var(--background))";

  return (
    <div
      ref={rootRef}
      role={controlled ? "progressbar" : undefined}
      aria-label={controlled ? label : undefined}
      aria-valuemin={controlled ? 1 : undefined}
      aria-valuemax={controlled ? STATIONS : undefined}
      aria-valuenow={controlled ? ((activeStep ?? 0) % STATIONS) + 1 : undefined}
      className={`relative aspect-square w-full ${className}`}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB} ${VB}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        focusable="false"
        className="h-full w-full"
      >
        <defs>
          <radialGradient id="decatron-glow">
            <stop offset="0%" style={{ stopColor: "var(--foreground)", stopOpacity: 0.9 }} />
            <stop offset="55%" style={{ stopColor: "var(--foreground)", stopOpacity: 0.35 }} />
            <stop offset="100%" style={{ stopColor: "var(--foreground)", stopOpacity: 0 }} />
          </radialGradient>
        </defs>

        {/* rest-state ring: twenty dim dots, always drawn, never touched by rAF */}
        {geometry.mainPos.map((p, i) => (
          <circle key={`m-dim-${i}`} cx={p.x} cy={p.y} r={MAIN_DOT_R} style={{ fill: dimFill }} />
        ))}
        {geometry.guidePos.map((p, i) => (
          <circle key={`g-dim-${i}`} cx={p.x} cy={p.y} r={GUIDE_DOT_R} style={{ fill: dimFill }} />
        ))}

        {/* guide-phase stretch: one soft ellipse per gap, opacity-driven */}
        {geometry.stretch.map((s, i) => (
          <ellipse
            key={`g-halo-${i}`}
            ref={(el) => {
              guideRefs.current[i] = el;
            }}
            cx={s.cx}
            cy={s.cy}
            rx={s.rx}
            ry={s.ry}
            transform={`rotate(${s.rotate} ${s.cx} ${s.cy})`}
            opacity={0}
            fill="url(#decatron-glow)"
          />
        ))}

        {/* main-phase halo + lit core, one pair per cathode */}
        {geometry.mainPos.map((p, i) => (
          <circle
            key={`m-halo-${i}`}
            ref={(el) => {
              haloRefs.current[i] = el;
            }}
            cx={p.x}
            cy={p.y}
            r={HALO_R}
            opacity={0}
            fill="url(#decatron-glow)"
          />
        ))}
        {geometry.mainPos.map((p, i) => (
          <circle
            key={`m-core-${i}`}
            ref={(el) => {
              litCoreRefs.current[i] = el;
            }}
            cx={p.x}
            cy={p.y}
            r={LIT_CORE_R}
            opacity={0}
            style={{ fill: "var(--foreground)" }}
          />
        ))}
      </svg>
    </div>
  );
}
