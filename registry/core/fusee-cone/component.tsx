"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// FuseeCone — a burn-rate alert POLICY editor built as a clock fusee. The
// error budget is the mainspring barrel; a chain rides down a tapering cone
// as budget depletes; alert sensitivity at any budget level is the cone's
// local radius at that point. You author the policy by dragging exactly 4
// control points along a monotone cubic spline (Fritsch-Carlson — the
// interpolation itself never overshoots between knots, not just at them),
// never a free-form curve: the spline's y is a burn-rate TRIP MULTIPLIER,
// and it is enforced monotone NON-INCREASING toward the empty end (index 0
// = full budget .. index 3 = exhausted) — a drag or keystroke that would
// raise a point above its predecessor (or lower it below its successor) is
// clamped to that band, the handle audibly/visually springs back, and a
// polite live region explains why. That single constraint is what forbids
// authoring a policy that gets LESS sensitive as budget runs out.
//
// One governing scalar — remaining budget — sets the chain's axial position
// on the cone. "Alert torque" = current burn multiplier x the cone's local
// radius at that position; fired/quiet, the derived multi-window rule
// table, and the chain's drawn catenary sag all come from that product (a
// value fires when the delivered torque exceeds the torque the mechanism
// would carry if burn rate exactly equalled the authored threshold there —
// algebraically just burn >= radius(x), read through the torque lens). The
// rule table is a real <table>, the screen-reader-primary surface, and
// updates only on commit (drag release / keypress), never mid-drag. The
// cone, barrel and chain are aria-hidden SVG+DOM decoration; the 4 control
// points are real role=slider elements. Replay streams a recorded burn-rate
// history through the same mechanism, spinning the barrel and stamping
// where the escapement would have tripped against the CURRENT authored
// policy. Reduced motion: the chain repositions instantly and the barrel
// stops spinning; every value still updates and everything stays usable.
// Colors are token classes only; --ns-accent appears only on drag/focus,
// never as a data-state color. DOM + SVG + CSS only, no canvas.
// ---------------------------------------------------------------------------

export interface FuseeConeProps {
  /**
   * Initial policy: 4 trip-multiplier control points in burn-rate "x"
   * units, index 0 = full-budget end .. index 3 = exhausted end. Each must
   * be <= the one before it (monotone non-increasing); an out-of-order
   * default is silently clamped down on mount rather than crashing.
   * Default [14.4, 6, 2, 1] — the two headline values from the brief.
   */
  defaultProfile?: [number, number, number, number];
  /** Fires when a control-point drag RELEASES or a keystroke commits — never mid-drag. */
  onPolicyChange?: (profile: [number, number, number, number]) => void;
  /** Initial remaining error-budget fraction, 0-100 (100 = full mainspring). */
  defaultRemainingBudgetPct?: number;
  /** Initial observed burn rate, in multiples of nominal (1x = exactly on pace to exhaust the budget at period end). */
  defaultCurrentBurnMultiplier?: number;
  /**
   * Recorded burn-rate history to stream through Replay. remainingBudgetPct
   * should be non-increasing across the array for the barrel to visibly
   * unwind. Falls back to a built-in sample incident.
   */
  replayData?: { remainingBudgetPct: number; burn: number }[];
  /** What SLO this policy protects, shown above the instrument. */
  label?: string;
  /** Extra classes merged onto the rendered root element. */
  className?: string;
}

// ---- geometry / domain constants ------------------------------------------
const CP_X = [0, 1 / 3, 2 / 3, 1] as const; // fixed axial positions of the 4 control points
const MULT_MIN = 1;
const MULT_MAX = 20;
const DEFAULT_PROFILE: [number, number, number, number] = [14.4, 6, 2, 1];

const VIEW_W = 480;
const VIEW_H = 200;
const CY = 100;
const BARREL_CX = 50;
const BARREL_R = 32;
const CONE_X0 = 118;
const CONE_X1 = 452;
const R_MIN_PIX = 3;
const R_MAX_PIX = 62;
const MAX_SAG = 24;
const CONE_SAMPLES = 40;

const TABLE_X = [0, 0.25, 0.5, 0.75, 1];
const TABLE_WINDOW = ["1h", "3h", "12h", "1d", "3d"];

const DEFAULT_REPLAY: { remainingBudgetPct: number; burn: number }[] = [
  { remainingBudgetPct: 100, burn: 1.1 },
  { remainingBudgetPct: 92, burn: 1.4 },
  { remainingBudgetPct: 80, burn: 2.6 },
  { remainingBudgetPct: 68, burn: 4.8 },
  { remainingBudgetPct: 55, burn: 3.2 },
  { remainingBudgetPct: 47, burn: 8.5 },
  { remainingBudgetPct: 40, burn: 2.1 },
  { remainingBudgetPct: 33, burn: 1.6 },
  { remainingBudgetPct: 22, burn: 5.5 },
  { remainingBudgetPct: 14, burn: 2.9 },
  { remainingBudgetPct: 8, burn: 1.3 },
  { remainingBudgetPct: 2, burn: 1.1 },
];

const SPIKE_BURN = 25; // > MULT_MAX: always trips, whatever the policy or budget position — the gate's idempotent target
const REPLAY_STEP_MS = 700;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function fmt(n: number) {
  if (!Number.isFinite(n)) return "0";
  return n >= 10 ? Math.round(n).toString() : n.toFixed(1);
}

function sanitizeProfile(arr: number[]): [number, number, number, number] {
  const c = arr.map((v) => clamp(v, MULT_MIN, MULT_MAX));
  for (let i = 1; i < 4; i++) c[i] = Math.min(c[i], c[i - 1]);
  return [c[0], c[1], c[2], c[3]];
}

// ---- monotone cubic Hermite (Fritsch-Carlson) ------------------------------
// Guarantees the interpolated curve never overshoots between knots, so a
// monotone non-increasing set of control points always produces a monotone
// non-increasing curve everywhere in between — not just at the 4 points.
function buildTangents(xs: readonly number[], ys: readonly number[]): number[] {
  const n = xs.length;
  const dx: number[] = [];
  const dy: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(xs[i + 1] - xs[i]);
    dy.push(ys[i + 1] - ys[i]);
    m.push(dx[i] === 0 ? 0 : dy[i] / dx[i]);
  }
  const t: number[] = new Array(n);
  t[0] = m[0] ?? 0;
  t[n - 1] = m[n - 2] ?? 0;
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] === 0 || m[i] === 0 || m[i - 1] * m[i] < 0) {
      t[i] = 0;
    } else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      t[i] = (w1 + w2) / (w1 / m[i - 1] + w2 / m[i]);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      t[i] = tau * a * m[i];
      t[i + 1] = tau * b * m[i];
    }
  }
  return t;
}

function evalHermite(xs: readonly number[], ys: readonly number[], t: number[], x: number): number {
  const n = xs.length;
  let i = 0;
  while (i < n - 2 && x > xs[i + 1]) i++;
  const h = xs[i + 1] - xs[i];
  const s = h === 0 ? 0 : (x - xs[i]) / h;
  const s2 = s * s;
  const s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1;
  const h10 = s3 - 2 * s2 + s;
  const h01 = -2 * s3 + 3 * s2;
  const h11 = s3 - s2;
  return h00 * ys[i] + h10 * h * t[i] + h01 * ys[i + 1] + h11 * h * t[i + 1];
}

function buildRadiusFn(ys: readonly number[]) {
  const t = buildTangents(CP_X, ys);
  return (x: number) => evalHermite(CP_X, ys, t, clamp(x, 0, 1));
}

function rPix(value: number) {
  return clamp(
    R_MIN_PIX + ((value - MULT_MIN) / (MULT_MAX - MULT_MIN)) * (R_MAX_PIX - R_MIN_PIX),
    R_MIN_PIX,
    R_MAX_PIX
  );
}

function screenX(x: number) {
  return CONE_X0 + clamp(x, 0, 1) * (CONE_X1 - CONE_X0);
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

export function FuseeCone({
  defaultProfile,
  onPolicyChange,
  defaultRemainingBudgetPct = 100,
  defaultCurrentBurnMultiplier = 3,
  replayData,
  label = "Checkout latency SLO",
  className = "",
}: FuseeConeProps) {
  const uid = useId();
  const reduced = useReducedMotion();

  const [profile, setProfile] = useState<[number, number, number, number]>(() =>
    sanitizeProfile(defaultProfile ?? DEFAULT_PROFILE)
  );
  const [remainingPct, setRemainingPct] = useState(clamp(defaultRemainingBudgetPct, 0, 100));
  const [burn, setBurn] = useState(Math.max(0, defaultCurrentBurnMultiplier));

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragPreviewValue, setDragPreviewValue] = useState<number | null>(null);
  const [springBackIndex, setSpringBackIndex] = useState<number | null>(null);
  const [announce, setAnnounce] = useState("");
  const [replaying, setReplaying] = useState(false);
  const [tripLog, setTripLog] = useState<string[]>([]);

  const trackRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null]);
  const gestureAnnouncedRef = useRef(false);
  const springTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const replayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const replayIndexRef = useRef(0);
  const firedPrevRef = useRef<boolean | null>(null);

  useEffect(
    () => () => {
      if (springTimeoutRef.current) clearTimeout(springTimeoutRef.current);
      if (replayTimerRef.current) clearInterval(replayTimerRef.current);
    },
    []
  );

  // committed policy — feeds the <table> (updated on commit only) and replay's trip test
  const radiusFn = useMemo(() => buildRadiusFn(profile), [profile]);

  // live policy — feeds the drawn cone/chain, reacting mid-drag so the shape
  // being argued about is always what's on screen, even before release
  const effectiveProfile = useMemo<[number, number, number, number]>(() => {
    if (dragIndex === null || dragPreviewValue === null) return profile;
    const next = [...profile] as [number, number, number, number];
    next[dragIndex] = dragPreviewValue;
    return next;
  }, [profile, dragIndex, dragPreviewValue]);
  const liveRadiusFn = useMemo(() => buildRadiusFn(effectiveProfile), [effectiveProfile]);

  const xCurrent = clamp(1 - remainingPct / 100, 0, 1);
  const radiusAtCurrent = liveRadiusFn(xCurrent);
  const ratio = radiusAtCurrent > 0 ? burn / radiusAtCurrent : Infinity;
  const torque = burn * radiusAtCurrent;
  const fired = ratio >= 1;

  // edge-triggered announcement on the escapement's own state changing —
  // not on every burn/budget tick, only the crossing itself
  useEffect(() => {
    if (firedPrevRef.current === null) {
      firedPrevRef.current = fired;
      return;
    }
    if (firedPrevRef.current !== fired) {
      firedPrevRef.current = fired;
      setAnnounce(
        fired
          ? `Escapement tripped — burn ${fmt(burn)}x meets or exceeds the ${fmt(radiusAtCurrent)}x threshold at ${Math.round(remainingPct)}% budget remaining.`
          : `Quiet — burn ${fmt(burn)}x is back under the ${fmt(radiusAtCurrent)}x threshold.`
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fired]);

  const commitProfile = useCallback(
    (index: number, value: number) => {
      setProfile((prev) => {
        const next = [...prev] as [number, number, number, number];
        next[index] = value;
        onPolicyChange?.(next);
        return next;
      });
    },
    [onPolicyChange]
  );

  const triggerSpringBack = useCallback((index: number, dir: "above" | "below") => {
    setSpringBackIndex(index);
    if (springTimeoutRef.current) clearTimeout(springTimeoutRef.current);
    springTimeoutRef.current = setTimeout(() => setSpringBackIndex(null), 220);
    if (!gestureAnnouncedRef.current) {
      gestureAnnouncedRef.current = true;
      setAnnounce(
        dir === "above"
          ? "Cannot raise this point above the previous one."
          : "Cannot lower this point below the next one."
      );
    }
  }, []);

  const bandMax = useCallback((i: number) => (i > 0 ? profile[i - 1] : MULT_MAX), [profile]);
  const bandMin = useCallback((i: number) => (i < 3 ? profile[i + 1] : MULT_MIN), [profile]);

  const updateFromClientY = useCallback(
    (index: number, clientY: number) => {
      const el = trackRefs.current[index];
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const frac = clamp((clientY - rect.top) / rect.height, 0, 1);
      const viewY = frac * VIEW_H;
      const wantedPix = clamp(CY - viewY, R_MIN_PIX, R_MAX_PIX);
      const wantedValue =
        MULT_MIN + ((wantedPix - R_MIN_PIX) / (R_MAX_PIX - R_MIN_PIX)) * (MULT_MAX - MULT_MIN);
      const lo = bandMin(index);
      const hi = bandMax(index);
      const clamped = clamp(wantedValue, lo, hi);
      if (Math.abs(clamped - wantedValue) > 1e-6) {
        triggerSpringBack(index, wantedValue > hi ? "above" : "below");
      }
      setDragPreviewValue(clamped);
    },
    [bandMin, bandMax, triggerSpringBack]
  );

  const onPointerDown = (index: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (replaying) return;
    e.preventDefault();
    gestureAnnouncedRef.current = false;
    trackRefs.current[index]?.setPointerCapture(e.pointerId);
    setDragIndex(index);
    setDragPreviewValue(profile[index]);
    updateFromClientY(index, e.clientY);
  };

  const onPointerMove = (index: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragIndex !== index) return;
    updateFromClientY(index, e.clientY);
  };

  const endDrag = (index: number) => () => {
    if (dragIndex !== index) return;
    setDragIndex(null);
    if (dragPreviewValue !== null) commitProfile(index, dragPreviewValue);
    setDragPreviewValue(null);
  };

  const onKeyDown = (index: number) => (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (replaying) return;
    const cur = profile[index];
    const lo = bandMin(index);
    const hi = bandMax(index);
    const STEP = 1.15;
    let next = cur;
    switch (e.key) {
      case "ArrowUp":
      case "ArrowRight":
        next = cur * STEP;
        break;
      case "ArrowDown":
      case "ArrowLeft":
        next = cur / STEP;
        break;
      case "PageUp":
        next = cur * STEP * STEP;
        break;
      case "PageDown":
        next = cur / (STEP * STEP);
        break;
      case "Home":
        next = lo;
        break;
      case "End":
        next = hi;
        break;
      default:
        return;
    }
    e.preventDefault();
    gestureAnnouncedRef.current = false;
    const clamped = clamp(next, lo, hi);
    if (Math.abs(clamped - next) > 1e-6) {
      triggerSpringBack(index, next > hi ? "above" : "below");
    }
    commitProfile(index, clamped);
  };

  const stopReplay = useCallback(() => {
    if (replayTimerRef.current) {
      clearInterval(replayTimerRef.current);
      replayTimerRef.current = null;
    }
    setReplaying(false);
  }, []);

  const startReplay = useCallback(() => {
    const data = replayData && replayData.length > 0 ? replayData : DEFAULT_REPLAY;
    replayIndexRef.current = 0;
    setTripLog([]);
    setReplaying(true);
    const stepOnce = () => {
      const sample = data[replayIndexRef.current];
      if (!sample) {
        stopReplay();
        return;
      }
      setRemainingPct(sample.remainingBudgetPct);
      setBurn(sample.burn);
      const x = clamp(1 - sample.remainingBudgetPct / 100, 0, 1);
      const threshold = radiusFn(x);
      if (sample.burn >= threshold) {
        const line = `Would have tripped at ${Math.round(sample.remainingBudgetPct)}% budget remaining — burn ${fmt(sample.burn)}x >= ${fmt(threshold)}x threshold.`;
        setTripLog((log) => [...log, line]);
        setAnnounce(line);
      }
      replayIndexRef.current += 1;
      if (replayIndexRef.current >= data.length) stopReplay();
    };
    stepOnce();
    replayTimerRef.current = setInterval(stepOnce, REPLAY_STEP_MS);
  }, [replayData, radiusFn, stopReplay]);

  // ---- diagram geometry -----------------------------------------------
  const conePoints = useMemo(() => {
    const pts: { sx: number; r: number }[] = [];
    for (let k = 0; k < CONE_SAMPLES; k++) {
      const x = k / (CONE_SAMPLES - 1);
      pts.push({ sx: screenX(x), r: rPix(liveRadiusFn(x)) });
    }
    return pts;
  }, [liveRadiusFn]);
  const coneTopD = "M " + conePoints.map((p) => `${p.sx.toFixed(1)},${(CY - p.r).toFixed(1)}`).join(" L ");
  const coneBottomD = "M " + conePoints.map((p) => `${p.sx.toFixed(1)},${(CY + p.r).toFixed(1)}`).join(" L ");

  const barrelAngle = (100 - remainingPct) * 10.8; // 3 full turns across the whole budget
  const tickX2 = BARREL_CX + (BARREL_R - 5);
  const tickY2 = CY;

  const contactX = screenX(xCurrent);
  const contactY = CY - rPix(radiusAtCurrent);
  const barrelRimX = BARREL_CX + BARREL_R;
  const barrelRimY = CY;
  const sagFrac = clamp(1 - Math.min(ratio, 1), 0.08, 1);
  const sagPix = sagFrac * MAX_SAG;
  const chainMidX = (barrelRimX + contactX) / 2;
  const chainMidY = (barrelRimY + contactY) / 2 + sagPix;
  const chainD = `M ${barrelRimX},${barrelRimY} Q ${chainMidX.toFixed(1)},${chainMidY.toFixed(1)} ${contactX.toFixed(1)},${contactY.toFixed(1)}`;

  const chainTransition = reduced ? "none" : "d 240ms cubic-bezier(0.16,1,0.3,1)";
  const barrelTransition = reduced ? "none" : "transform 480ms cubic-bezier(0.16,1,0.3,1)";

  const handleTransition = (i: number) =>
    reduced || dragIndex === i ? "none" : "top 220ms cubic-bezier(0.34,1.56,0.64,1)";

  const labelId = `${uid}-label`;
  const descId = `${uid}-desc`;

  return (
    <div className={className}>
      <style>{`
.ns-fusee-chain{transition-property:d}
.ns-fusee-barrel-tick{transition-property:transform}
@keyframes ns-fusee-springback{
  0%{transform:translate(-50%,-50%) scale(1)}
  35%{transform:translate(-50%,-50%) scale(1.4)}
  100%{transform:translate(-50%,-50%) scale(1)}
}
.ns-fusee-springback{animation:ns-fusee-springback 220ms cubic-bezier(0.34,1.56,0.64,1)}
@media (prefers-reduced-motion: reduce){
  .ns-fusee-chain,.ns-fusee-barrel-tick{transition:none !important}
  .ns-fusee-springback{animation:none !important}
}
`}</style>

      <div className="flex items-baseline justify-between gap-3">
        <span id={labelId} className="font-mono text-[11px] tracking-wide text-ns-muted">
          {label.toUpperCase()}
        </span>
        {fired ? (
          <span
            data-fusee-fired-badge
            className="rounded-full border border-foreground bg-foreground px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-background"
          >
            TRIPPED
          </span>
        ) : (
          <span
            data-fusee-quiet-badge
            className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] tracking-wide text-ns-muted"
          >
            QUIET
          </span>
        )}
      </div>

      <p className="mt-1 font-mono text-[11px] text-ns-muted">
        burn {fmt(burn)}x · {Math.round(remainingPct)}% budget remaining · needs {fmt(radiusAtCurrent)}x here
      </p>

      {/* diagram: barrel + cone + chain — decorative, all state lives in the sliders below */}
      <div className="relative mt-3 w-full" style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }} aria-hidden>
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="h-full w-full" focusable="false">
          <circle cx={BARREL_CX} cy={CY} r={BARREL_R} fill="none" className="stroke-current text-border" strokeWidth={1.5} />
          <g
            className="ns-fusee-barrel-tick"
            style={{ transformOrigin: `${BARREL_CX}px ${CY}px`, transform: `rotate(${barrelAngle}deg)`, transition: barrelTransition }}
          >
            <line
              x1={BARREL_CX}
              y1={CY}
              x2={tickX2}
              y2={tickY2}
              className="stroke-current text-ns-muted"
              strokeWidth={2}
              strokeLinecap="round"
            />
          </g>

          <path d={coneTopD} fill="none" className="stroke-current text-foreground" strokeWidth={1.5} strokeLinecap="round" />
          <path d={coneBottomD} fill="none" className="stroke-current text-foreground" strokeWidth={1.5} strokeLinecap="round" />

          <path
            d={chainD}
            fill="none"
            className="ns-fusee-chain stroke-current text-ns-muted"
            strokeWidth={2}
            strokeLinecap="round"
            style={{ transition: chainTransition }}
          />

          <circle
            cx={contactX}
            cy={contactY}
            r={4.5}
            className={fired ? "fill-current text-foreground" : "fill-none stroke-current text-border"}
            strokeWidth={fired ? 0 : 1.5}
          />
        </svg>

        {/* 4 control points — the entire accessible/interactive surface of the diagram */}
        {CP_X.map((cx, i) => {
          const val = dragIndex === i && dragPreviewValue !== null ? dragPreviewValue : profile[i];
          const yFrac = (CY - rPix(val)) / VIEW_H;
          const budgetPct = Math.round((1 - cx) * 100);
          return (
            <div
              key={i}
              ref={(el) => {
                trackRefs.current[i] = el;
              }}
              data-fusee-track={i}
              className={`absolute top-0 h-full w-9 -translate-x-1/2 touch-none select-none ${replaying ? "" : "cursor-ns-resize"}`}
              style={{ left: `${(screenX(cx) / VIEW_W) * 100}%` }}
              onPointerDown={onPointerDown(i)}
              onPointerMove={onPointerMove(i)}
              onPointerUp={endDrag(i)}
              onPointerCancel={endDrag(i)}
              onLostPointerCapture={endDrag(i)}
            >
              <div
                role="slider"
                tabIndex={0}
                aria-label={`Alert sensitivity control point ${i + 1} of 4`}
                aria-orientation="vertical"
                aria-valuemin={Number(bandMin(i).toFixed(2))}
                aria-valuemax={Number(bandMax(i).toFixed(2))}
                aria-valuenow={Number(val.toFixed(2))}
                aria-valuetext={`at ${budgetPct}% budget remaining, alert at ${val.toFixed(1)}x burn`}
                aria-disabled={replaying || undefined}
                onKeyDown={onKeyDown(i)}
                className={`absolute left-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  dragIndex === i ? "border-ns-accent bg-ns-accent" : "border-foreground/70 bg-background hover:border-foreground"
                } ${springBackIndex === i ? "ns-fusee-springback" : ""}`}
                style={{ top: `${yFrac * 100}%`, transition: handleTransition(i) }}
              />
            </div>
          );
        })}
      </div>

      {/* manual scrub controls — the governing scalars, disabled while replay owns them */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="font-mono text-[10px] tracking-wide text-ns-muted">REMAINING BUDGET</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(remainingPct)}
            disabled={replaying}
            onChange={(e) => setRemainingPct(Number(e.target.value))}
            aria-label="Remaining error budget percent"
            className="mt-1 w-full accent-ns-accent disabled:opacity-40"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] tracking-wide text-ns-muted">CURRENT BURN RATE</span>
          <input
            type="range"
            min={0}
            max={20}
            step={0.1}
            value={burn}
            disabled={replaying}
            onChange={(e) => setBurn(Number(e.target.value))}
            aria-label="Current observed burn rate multiplier"
            className="mt-1 w-full accent-ns-accent disabled:opacity-40"
          />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          data-fusee-replay-toggle
          aria-pressed={replaying}
          onClick={() => (replaying ? stopReplay() : startReplay())}
          className="rounded-sm border border-border px-3 py-1.5 font-mono text-[11px] tracking-widest text-ns-muted transition-colors duration-200 hover:border-foreground/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {replaying ? "STOP REPLAY" : "REPLAY"}
        </button>
        <button
          type="button"
          data-fusee-firetest
          disabled={replaying}
          onClick={() => setBurn(SPIKE_BURN)}
          className="rounded-sm border border-border px-3 py-1.5 font-mono text-[11px] tracking-widest text-ns-muted transition-colors duration-200 hover:border-foreground/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-40"
        >
          PREVIEW SPIKE
        </button>
      </div>

      {/* derived rule table — real HTML table, the screen-reader-primary surface */}
      <div className="mt-4 overflow-x-auto rounded-md border border-border">
        <table className="w-full border-collapse font-mono text-[11px]">
          <caption className="sr-only">Derived multi-window burn-rate alert rule table for {label}</caption>
          <thead>
            <tr className="border-b border-border text-left text-ns-muted">
              <th scope="col" className="px-3 py-2 font-medium">
                Budget remaining
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Window
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Burn multiplier
              </th>
            </tr>
          </thead>
          <tbody>
            {TABLE_X.map((x, i) => (
              <tr key={x} className={i === TABLE_X.length - 1 ? "" : "border-b border-border"}>
                <td className="px-3 py-1.5 text-foreground tabular-nums">{Math.round((1 - x) * 100)}%</td>
                <td className="px-3 py-1.5 text-foreground tabular-nums">{TABLE_WINDOW[i]}</td>
                <td className="px-3 py-1.5 text-foreground tabular-nums">{fmt(radiusFn(x))}x</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p id={descId} className="mt-2 font-mono text-[11px] text-ns-muted">
        {fired
          ? `Tripped: burn ${fmt(burn)}x meets or exceeds the ${fmt(radiusAtCurrent)}x threshold at ${Math.round(remainingPct)}% budget remaining.`
          : `Quiet: burn ${fmt(burn)}x is under the ${fmt(radiusAtCurrent)}x threshold at ${Math.round(remainingPct)}% budget remaining.`}
      </p>

      {tripLog.length > 0 ? (
        <ul className="mt-2 space-y-0.5 font-mono text-[10px] text-ns-muted">
          {tripLog.slice(-4).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      ) : null}

      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}
