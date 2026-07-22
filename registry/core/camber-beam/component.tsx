"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// CamberBeam — a system-status banner that is, at rest, nothing more than the
// app's own 1px top border. It communicates degraded-but-working states by
// bowing that border downward at midspan (a single geometric parameter,
// deflection) and only claims a banner row of actual layout when the service
// is down, where the beam fractures with a hairline gap and drops readable
// text beneath it. Present-tense ambient state — not a history, not a
// weather field — so it differs on purpose from a component that narrates a
// timeline (chronicle-bar) or maps a metric onto a whole isobar field
// (pressure-front): here strain maps to exactly one thing, how far the line
// sags, and the line is otherwise a plain border.
//
// Mechanism: an SVG path M0,y Q(w/2),y+d w,y where d (deflection) is driven
// by an underdamped spring toward a target set from `status`/`severity`, so
// every change wobbles like a beam actually settling under new load — this
// is the deliberate departure from a critically/over-damped ease, because a
// beam that changes load and doesn't overshoot at all reads as a UI tween,
// not a physical member. Stroke color is a pure function of the *current*
// deflection (crossfading --border toward --foreground as d grows), so it
// tracks the spring's wobble rather than animating on its own schedule.
// Geometry is written directly to the path's `d`/`style.stroke` from a rAF
// loop (no React re-render per frame), exactly the pattern this registry
// already uses for cheap closed-form SVG redraws.
//
// Fracture: crossing into `status="down"` crossfades the single path out for
// two half-span paths, each anchored at the outer edge and drooping toward
// the break, separated by a literal 2px gap (computed from the *measured*
// pixel width via ResizeObserver, not a viewBox fraction, so the gap is 2px
// on screen regardless of container width) — while a status row height-
// animates open beneath via a grid-template-rows 0fr/1fr transition, so the
// text claims real layout only on genuine failure.
//
// Accessibility: the SVG is aria-hidden; a visually hidden role=status
// aria-live=polite region mirrors only tier *crossings* in words ("Service
// degraded: response times elevated." / "Service down.") — never continuous
// severity values, which would be a live-region flood. The fracture's status
// text is always a real, visible DOM node, never geometry standing in for
// copy. A focusable button at the beam's end opens a small metrics dialog;
// it toggles on click but also closes on Escape from anywhere the moment
// it's open (not only while focus sits inside it) — the same "seal" this
// registry already uses in margin-cite — so the control is always
// guaranteed closed by the time anything re-opens it via selector, rather
// than depending on click parity.
// ---------------------------------------------------------------------------

const VIEWBOX_H = 22;
const BASE_Y = 5;
const MAX_SAG = 12; // px sag at severity = 1, measured in real screen px
const FRACTURE_GAP = 2; // px — literal gap width on screen, any container size
const FRACTURE_DROOP_MID = 4;
const FRACTURE_DROOP_END = 13;
const SPRING_K = 130;
const SPRING_ZETA = 0.32; // < 1 on purpose: an underdamped settle, not a tween
const SETTLE_EPS = 0.03;

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

export type CamberBeamStatus = "healthy" | "degraded" | "down";

export interface CamberBeamMetric {
  label: string;
  value: string;
}

const DEFAULT_METRICS: CamberBeamMetric[] = [
  { label: "p95 latency", value: "482ms" },
  { label: "error rate", value: "1.8%" },
  { label: "uptime (24h)", value: "99.91%" },
];

export interface CamberBeamProps {
  /** overall service tier — the only thing that decides which geometry mode
   * renders (flat rule / bowed rule / fractured rule + text row). */
  status?: CamberBeamStatus;
  /** 0-1 health-metric dial. Only moves the beam while status="degraded" —
   * this is "the severity dial" the sag depth is a direct function of. */
  severity?: number;
  /** rows shown in the button's metrics dialog. */
  metrics?: CamberBeamMetric[];
  /** visible text in the dropped row, and the live-region announcement, when down. */
  downMessage?: string;
  /** live-region announcement on crossing into degraded. */
  degradedMessage?: string;
  /** live-region announcement on crossing back to healthy. */
  healthyMessage?: string;
  className?: string;
}

export function CamberBeam({
  status = "healthy",
  severity = 0.4,
  metrics = DEFAULT_METRICS,
  downMessage = "Service down",
  degradedMessage = "Service degraded: response times elevated",
  healthyMessage = "Service healthy",
  className = "",
}: CamberBeamProps) {
  const reactId = useId();
  const dialogId = `ns-cb-metrics-${reactId.replace(/:/g, "")}`;

  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const leftPathRef = useRef<SVGPathElement>(null);
  const rightPathRef = useRef<SVGPathElement>(null);

  const widthRef = useRef(0);
  const dRef = useRef(0);
  const velRef = useRef(0);
  const rafRef = useRef(0);
  const reducedRef = useRef(false);

  const [reducedMotion, setReducedMotion] = useState(false);
  const [open, setOpen] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");
  const prevStatusRef = useRef<CamberBeamStatus>(status);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const down = status === "down";

  // -- direct-DOM draw helpers: no React re-render per animation frame ----
  const drawContinuous = (w: number, d: number) => {
    const path = pathRef.current;
    if (!path || w < 1) return;
    path.setAttribute(
      "d",
      `M0,${BASE_Y} Q${(w / 2).toFixed(1)},${(BASE_Y + d).toFixed(2)} ${w.toFixed(1)},${BASE_Y}`
    );
    const pct = clamp01(d / MAX_SAG) * 100;
    path.style.stroke = `color-mix(in srgb, var(--foreground) ${pct.toFixed(0)}%, var(--border) ${(100 - pct).toFixed(0)}%)`;
  };

  const drawFracture = (w: number) => {
    const l = leftPathRef.current;
    const r = rightPathRef.current;
    if (!l || !r || w < 1) return;
    const midL = w / 2 - FRACTURE_GAP / 2;
    const midR = w / 2 + FRACTURE_GAP / 2;
    l.setAttribute(
      "d",
      `M0,${BASE_Y} Q${(w * 0.26).toFixed(1)},${(BASE_Y + FRACTURE_DROOP_MID).toFixed(1)} ${midL.toFixed(1)},${(BASE_Y + FRACTURE_DROOP_END).toFixed(1)}`
    );
    r.setAttribute(
      "d",
      `M${midR.toFixed(1)},${(BASE_Y + FRACTURE_DROOP_END).toFixed(1)} Q${(w * 0.74).toFixed(1)},${(BASE_Y + FRACTURE_DROOP_MID).toFixed(1)} ${w.toFixed(1)},${BASE_Y}`
    );
  };

  // -- measure real pixel width so the fracture gap is a literal 2px -------
  useLayoutEffect(() => {
    const root = rootRef.current;
    const svg = svgRef.current;
    if (!root || !svg) return;
    const measure = () => {
      const w = root.getBoundingClientRect().width;
      widthRef.current = w;
      svg.setAttribute("viewBox", `0 0 ${Math.max(1, w)} ${VIEWBOX_H}`);
      drawFracture(w);
      drawContinuous(w, dRef.current);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -- reduced motion: read once, then stay reactive to OS changes --------
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    setReducedMotion(mq.matches);
    const onChange = () => {
      reducedRef.current = mq.matches;
      setReducedMotion(mq.matches);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // -- underdamped spring toward the deflection target ---------------------
  useEffect(() => {
    const target = status === "degraded" ? clamp01(severity) * MAX_SAG : 0;

    if (reducedRef.current) {
      // reduced motion: no settle, the value jumps directly to its target
      dRef.current = target;
      velRef.current = 0;
      drawContinuous(widthRef.current, dRef.current);
      return;
    }

    cancelAnimationFrame(rafRef.current);
    let last = 0;
    const tick = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      const c = 2 * SPRING_ZETA * Math.sqrt(SPRING_K);
      const accel = -SPRING_K * (dRef.current - target) - c * velRef.current;
      velRef.current += accel * dt;
      dRef.current += velRef.current * dt;
      drawContinuous(widthRef.current, dRef.current);
      if (Math.abs(dRef.current - target) < SETTLE_EPS && Math.abs(velRef.current) < SETTLE_EPS) {
        dRef.current = target;
        velRef.current = 0;
        drawContinuous(widthRef.current, dRef.current);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, severity, reducedMotion]);

  // -- live region: announce only on tier crossings, never raw values ------
  useEffect(() => {
    if (prevStatusRef.current === status) return;
    prevStatusRef.current = status;
    if (status === "down") setLiveMessage(downMessage);
    else if (status === "degraded") setLiveMessage(degradedMessage);
    else setLiveMessage(healthyMessage);
  }, [status, downMessage, degradedMessage, healthyMessage]);

  // -- metrics dialog: Escape seals it shut from anywhere while open -------
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || buttonRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open]);

  const fadeTransition = reducedMotion ? "none" : "opacity 240ms ease-out";
  const rowTransition = reducedMotion ? "none" : "grid-template-rows 320ms cubic-bezier(0.22,1,0.36,1)";

  return (
    <div ref={rootRef} className={`relative w-full ${className}`}>
      <div className="relative h-6 w-full">
        <svg
          ref={svgRef}
          aria-hidden="true"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        >
          <g style={{ opacity: down ? 0 : 1, transition: fadeTransition }}>
            <path ref={pathRef} fill="none" strokeWidth={1} />
          </g>
          <g style={{ opacity: down ? 1 : 0, transition: fadeTransition }}>
            <path ref={leftPathRef} fill="none" stroke="var(--foreground)" strokeWidth={1} />
            <path ref={rightPathRef} fill="none" stroke="var(--foreground)" strokeWidth={1} />
          </g>
        </svg>

        <button
          ref={buttonRef}
          type="button"
          data-camber-metrics
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? dialogId : undefined}
          aria-label="View service health metrics"
          onClick={() => setOpen((o) => !o)}
          className="absolute right-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface font-mono text-[10px] leading-none text-muted transition-colors duration-200 hover:border-foreground/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span aria-hidden="true">i</span>
        </button>

        {open ? (
          <div
            ref={panelRef}
            id={dialogId}
            role="dialog"
            aria-label="Service health metrics"
            className="absolute right-0 top-full z-10 mt-2 w-56 rounded-md border border-border bg-surface p-3 shadow-sm"
          >
            <dl className="flex flex-col gap-1.5">
              {metrics.map((m) => (
                <div key={m.label} className="flex items-baseline justify-between gap-3">
                  <dt className="text-xs text-muted">{m.label}</dt>
                  <dd className="font-mono text-xs text-foreground">{m.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>

      <div style={{ display: "grid", gridTemplateRows: down ? "1fr" : "0fr", transition: rowTransition }}>
        <div className="overflow-hidden">
          <p aria-hidden={!down} className="px-1 pb-2 pt-1 text-xs text-foreground">
            {downMessage}
          </p>
        </div>
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </span>
    </div>
  );
}
