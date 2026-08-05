"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// WindSpool — an indeterminate/determinate loader that never lies about
// elapsed time. While `total` is unknown, thread visibly winds onto a spool
// at a steady real-time cadence (one layer roughly every 700ms, radius
// growing logarithmically so a long wait stays compact instead of looping a
// spinner that erases how long you've waited). The instant `total` arrives,
// the SAME coil converts in place: a dashed ghost ring pops to the radius
// that represents 100%, and the wound thread re-scopes to loaded/total of
// that ring — one continuous object across the indeterminate -> determinate
// handoff, never a spinner swapped for a bar. Pure SVG + CSS, one rAF loop,
// direct-DOM attribute writes on pre-rendered nodes; React state only
// changes on discrete transitions (phase flips, rounded aria fields),
// never per frame.
// ---------------------------------------------------------------------------

const RING_MS = 700; // real ms per indeterminate thread-layer tick
const CORE_R = 15; // hub radius (inside the two flanges)
const MAX_R = 84; // visual radius standing in for "100% of total"
const PITCH = 3.4; // px between wound layers
const LOG_A = 11.5; // radius(n) = CORE_R + LOG_A * ln(1 + n) while indeterminate
const N_LAYERS = Math.ceil((MAX_R - CORE_R) / PITCH) + 2;

const CX = 108;
const CY = 92;
const ANCHOR_X = 196;
const ANCHOR_Y = 20;
const FEED_ANGLE = (-52 * Math.PI) / 180; // fixed feed direction (rad)
const WOBBLE_RAD = (4.5 * Math.PI) / 180;
const WOBBLE_MS = 2600;

// spring constants (critically-damped-ish, house style: k = stiffness s^-2,
// c = 2*zeta*sqrt(k))
const RADIUS_K = 90;
const RADIUS_C = 2 * 0.62 * Math.sqrt(RADIUS_K); // small overshoot per layer
const GHOST_K = 130;
const GHOST_C = 2 * 0.68 * Math.sqrt(GHOST_K);
const SNIP_K = 150;
const SNIP_C = 2 * 0.55 * Math.sqrt(SNIP_K); // a little recoil past the snip

function springStep(
  pos: number,
  vel: number,
  target: number,
  k: number,
  c: number,
  dt: number
): [number, number] {
  const acc = -k * (pos - target) - c * vel;
  const nv = vel + acc * dt;
  return [pos + nv * dt, nv];
}

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  if (n < 1024) return `${Math.round(n)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10} ${units[u]}`;
}

function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} second${s === 1 ? "" : "s"}`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}

export type WindSpoolProps = {
  /** total size in bytes once known; leave undefined while indeterminate */
  total?: number;
  /** bytes accumulated so far; only meaningful once `total` is known */
  loaded?: number;
  className?: string;
  "aria-label"?: string;
};

export function WindSpool({
  total,
  loaded = 0,
  className = "",
  "aria-label": ariaLabel = "Loading",
}: WindSpoolProps) {
  const layersRef = useRef<(SVGCircleElement | null)[]>([]);
  const ghostRef = useRef<SVGCircleElement>(null);
  const feedRef = useRef<SVGLineElement>(null);
  const captionRef = useRef<HTMLSpanElement>(null);

  const totalRef = useRef(total);
  const loadedRef = useRef(loaded);
  const wakeRef = useRef<(() => void) | null>(null);

  const initialKnown = total != null && total > 0;
  const initialPct = initialKnown
    ? Math.round(Math.min(100, Math.max(0, (loaded / (total as number)) * 100)))
    : 0;

  const [phase, setPhase] = useState<"indeterminate" | "determinate">(
    initialKnown ? "determinate" : "indeterminate"
  );
  const [valueNow, setValueNow] = useState<number | undefined>(
    initialKnown ? initialPct : undefined
  );
  const [valueText, setValueText] = useState(
    initialKnown
      ? `Loading, ${initialPct} percent of ${formatBytes(total as number)}`
      : "Loading"
  );
  const [announce, setAnnounce] = useState("");
  const [captionText, setCaptionText] = useState(
    initialKnown ? `${initialPct}% of ${formatBytes(total as number)}` : "winding…"
  );

  useEffect(() => {
    totalRef.current = total;
    loadedRef.current = loaded;
    wakeRef.current?.();
  }, [total, loaded]);

  useEffect(() => {
    const ghost = ghostRef.current;
    const feed = feedRef.current;
    if (!ghost || !feed) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let raf = 0;
    let last = 0;
    let indeterminateStart = performance.now();

    const knownAtMount = totalRef.current != null && totalRef.current > 0;
    const initialFraction = knownAtMount
      ? Math.min(1, Math.max(0, loadedRef.current / (totalRef.current as number)))
      : 0;

    let ringCount = 0;
    let ringAcc = 0; // ms accumulated toward the next 700ms tick
    let radius = knownAtMount ? CORE_R + (MAX_R - CORE_R) * initialFraction : CORE_R;
    let radiusVel = 0;
    let growTarget = radius;

    let known = knownAtMount;
    let ghostR = knownAtMount ? MAX_R : 0;
    let ghostVel = 0;

    let snipT = 0; // 0 = feed fully extended, 1 = fully retracted
    let snipVel = 0;
    let snipping = false;
    let settled = false;

    let lastAnnouncedSec = -10;

    const paintLayers = () => {
      const nVisible = Math.max(0, Math.floor((radius - CORE_R) / PITCH));
      for (let i = 0; i < N_LAYERS; i++) {
        const el = layersRef.current[i];
        if (!el) continue;
        if (i < nVisible) {
          el.setAttribute("r", String(CORE_R + PITCH * (i + 1)));
          el.style.opacity = "1";
        } else {
          el.style.opacity = "0";
        }
      }
    };

    const paintGhost = () => {
      ghost.setAttribute("r", String(Math.max(0.001, ghostR)));
      ghost.style.opacity = ghostR > 0.5 ? String(Math.min(1, ghostR / MAX_R)) : "0";
    };

    const paintFeed = (now: number) => {
      if (settled) {
        feed.style.opacity = "0";
        return;
      }
      const wobble = reduced
        ? 0
        : Math.sin(((now - indeterminateStart) / WOBBLE_MS) * Math.PI * 2) *
          WOBBLE_RAD;
      const angle = FEED_ANGLE + (snipping ? 0 : wobble);
      const t = Math.min(1.15, snipT);
      // attach point rides the current coil edge, then eases toward the
      // anchor as snipT climbs, so the line visibly shortens into the recoil
      const attachR = radius + 3;
      const ax = CX + Math.cos(angle) * attachR;
      const ay = CY + Math.sin(angle) * attachR;
      const x2 = ax + (ANCHOR_X - ax) * t;
      const y2 = ay + (ANCHOR_Y - ay) * t;
      feed.setAttribute("x1", String(ANCHOR_X));
      feed.setAttribute("y1", String(ANCHOR_Y));
      feed.setAttribute("x2", String(x2));
      feed.setAttribute("y2", String(y2));
      // stays visible through the overshoot; the `settled` guard above is
      // what finally hides it, once the recoil has actually resettled
      feed.style.opacity = "1";
    };

    const wake = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };
    wakeRef.current = wake;

    const loop = (now: number) => {
      const dt = last === 0 ? 1 / 60 : Math.min(0.05, (now - last) / 1000);
      last = now;

      const t = totalRef.current;
      const ld = loadedRef.current;
      const knownNow = t != null && t > 0;

      if (knownNow !== known) {
        known = knownNow;
        if (knownNow) {
          setPhase("determinate");
          const pct = Math.round(Math.min(100, Math.max(0, (ld / (t as number)) * 100)));
          setAnnounce(`Loading, ${pct} percent of ${formatBytes(t as number)}`);
        } else {
          // a fresh indeterminate run started — bank nothing, restart clean
          ringCount = 0;
          ringAcc = 0;
          radius = CORE_R;
          radiusVel = 0;
          growTarget = CORE_R;
          indeterminateStart = now;
          lastAnnouncedSec = -10;
          setPhase("indeterminate");
          setValueNow(undefined);
          setValueText("Loading");
        }
        settled = false;
        snipping = false;
        snipT = 0;
        snipVel = 0;
      }

      if (!knownNow) {
        ringAcc += dt * 1000;
        while (ringAcc >= RING_MS) {
          ringAcc -= RING_MS;
          ringCount += 1;
          growTarget = CORE_R + LOG_A * Math.log1p(ringCount);
          if (reduced) radius = growTarget;
        }
        if (!reduced) {
          [radius, radiusVel] = springStep(
            radius,
            radiusVel,
            growTarget,
            RADIUS_K,
            RADIUS_C,
            dt
          );
        }

        const elapsedSec = (now - indeterminateStart) / 1000;
        if (elapsedSec - lastAnnouncedSec >= 10) {
          lastAnnouncedSec = elapsedSec;
          setValueText(`Loading, ${formatElapsed(elapsedSec * 1000)} elapsed`);
        }

        if (reduced) {
          ghostR = 0;
          ghostVel = 0;
        } else {
          [ghostR, ghostVel] = springStep(ghostR, ghostVel, 0, GHOST_K, GHOST_C, dt);
        }

        setCaptionText(`winding — ${formatElapsed(elapsedSec * 1000)}`);
      } else {
        const total_ = t as number;
        const fraction = Math.min(1, Math.max(0, ld / total_));
        growTarget = CORE_R + (MAX_R - CORE_R) * fraction;
        if (reduced) {
          radius = growTarget;
        } else {
          [radius, radiusVel] = springStep(
            radius,
            radiusVel,
            growTarget,
            RADIUS_K,
            RADIUS_C,
            dt
          );
        }

        if (reduced) {
          ghostR = MAX_R;
        } else {
          [ghostR, ghostVel] = springStep(ghostR, ghostVel, MAX_R, GHOST_K, GHOST_C, dt);
        }

        const pct = Math.round(fraction * 100);
        setValueNow(pct);
        setValueText(`Loading, ${pct} percent of ${formatBytes(total_)}`);
        setCaptionText(`${pct}% of ${formatBytes(total_)}`);

        if (fraction >= 1 && !snipping) {
          snipping = true;
        }
        if (snipping) {
          if (reduced) {
            snipT = 1;
          } else {
            [snipT, snipVel] = springStep(snipT, snipVel, 1, SNIP_K, SNIP_C, dt);
          }
        }
      }

      paintLayers();
      paintGhost();
      paintFeed(now);

      const radiusDone = Math.abs(radius - growTarget) < 0.05 && Math.abs(radiusVel) < 0.05;
      const ghostDone =
        (!knownNow && ghostR < 0.05) || (knownNow && Math.abs(ghostR - MAX_R) < 0.05);
      const snipDone =
        snipping && (reduced || (Math.abs(snipT - 1) < 0.01 && Math.abs(snipVel) < 0.02));
      if (knownNow && radiusDone && ghostDone && snipping && snipDone) {
        settled = true;
        feed.style.opacity = "0";
      }

      raf = settled && knownNow ? 0 : requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      wakeRef.current = null;
    };
    // mount-once engine; total/loaded are read live via refs each frame
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={phase === "determinate" ? 0 : undefined}
      aria-valuemax={phase === "determinate" ? 100 : undefined}
      aria-valuenow={phase === "determinate" ? valueNow : undefined}
      aria-valuetext={valueText}
      className={`inline-flex flex-col items-center gap-2 ${className}`}
    >
      <svg
        viewBox="0 0 216 184"
        width={216}
        height={184}
        aria-hidden="true"
        className="max-w-full"
      >
        {/* feed line: taut thread entering from a fixed anchor */}
        <line
          ref={feedRef}
          x1={ANCHOR_X}
          y1={ANCHOR_Y}
          x2={ANCHOR_X}
          y2={ANCHOR_Y}
          stroke="var(--foreground)"
          strokeWidth={1}
          style={{ transition: "opacity 260ms ease-out" }}
        />

        {/* ghost ring: the final wound radius, revealed the moment total is known */}
        <circle
          ref={ghostRef}
          cx={CX}
          cy={CY}
          r={0.001}
          fill="none"
          stroke="var(--ns-muted)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />

        {/* wound thread: concentric layers, drawn back-to-front */}
        <g>
          {Array.from({ length: N_LAYERS }, (_, i) => (
            <circle
              key={i}
              ref={(el) => {
                layersRef.current[i] = el;
              }}
              cx={CX}
              cy={CY}
              r={CORE_R}
              fill="none"
              stroke="var(--foreground)"
              strokeWidth={1}
              style={{ opacity: 0 }}
            />
          ))}
        </g>

        {/* spool hub: two flanges */}
        <circle cx={CX} cy={CY} r={CORE_R} fill="none" stroke="var(--border)" strokeWidth={1} />
        <circle cx={CX} cy={CY} r={CORE_R - 5} fill="none" stroke="var(--border)" strokeWidth={1} />
      </svg>

      <span
        ref={captionRef}
        aria-hidden="true"
        data-wind-caption
        data-phase={phase}
        className="font-mono text-[11px] tracking-wide text-ns-muted"
      >
        {captionText}
      </span>

      <div aria-live="polite" className="sr-only">
        {announce}
      </div>
    </div>
  );
}
