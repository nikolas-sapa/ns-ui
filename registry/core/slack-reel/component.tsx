"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// SlackReel — an inline loader that reads as cord paid out between two spools
// rather than a bar. The left spool pays line out (the cord sags into a
// quadratic catenary), the right spool takes it up (the cord snaps taut).
// Indeterminate mode rocks the slack on a fixed loop. Determinate mode
// derives slack from the VELOCITY of value changes, not the value itself —
// recent throughput reads as sag, and a stalled request (no new value for a
// beat) visibly stops paying out line and goes taut on its own, which a
// spinner has no way to express. Tick marks on both spools counter-rotate to
// track progress across a bounded sweep (never a full turn, so the reading
// never wraps back on itself). One direct-DOM rAF loop owns the cord path
// and tick rotations; React state only carries the aria-live announcement.
// ---------------------------------------------------------------------------

const H = 18; // svg viewBox height, fixed regardless of width
const PAD = 8; // spool center inset from each edge
const SPOOL_R = 5; // 10px spool circles
const CENTER_Y = 9;
const MAX_SLACK = 6; // px, control-point sag ceiling
const TICK_REACH = 0.9; // fraction of SPOOL_R the tick line reaches

const PAYOUT_MS = 700;
const REEL_MS = 400;
const REST_MS = 260;
const CYCLE_MS = PAYOUT_MS + REEL_MS + REST_MS;
const ROCK_DEG = 46; // indeterminate tick rock amplitude

const STALL_MS = 350; // no new value inside this window reads as stalled
const VELOCITY_TO_SLACK = 0.9; // px of slack per %/s of recent throughput
const SLACK_RATE = 7; // 1/s — how fast displayed slack chases its target
const VEL_SMOOTH = 6; // 1/s — velocity smoothing/decay rate
const SNAP_K = 900; // completion-wobble spring stiffness, s^-2
const SNAP_C = 2 * 0.5 * Math.sqrt(SNAP_K); // zeta 0.5 — one clean overshoot
const FADE_MS = 550; // resting dim after the snap settles
const REST_OPACITY = 0.42;
const ANGLE_SWEEP = 300; // deg, determinate tick sweep across 0-100 (never wraps)

const easeInCubic = (p: number) => p * p * p;
const easeOutExpo = (p: number) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));

export interface SlackReelProps {
  /** progress 0-100 (controlled); omit for indeterminate (busy, no known duration) */
  value?: number;
  className?: string;
  "aria-label"?: string;
}

export function SlackReel({
  value,
  className = "",
  "aria-label": ariaLabel = "Loading",
}: SlackReelProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const leftCircleRef = useRef<SVGCircleElement>(null);
  const rightCircleRef = useRef<SVGCircleElement>(null);
  const leftTickRef = useRef<SVGLineElement>(null);
  const rightTickRef = useRef<SVGLineElement>(null);
  const groupRef = useRef<SVGGElement>(null);

  const pushRef = useRef<((v: number | undefined) => void) | null>(null);
  const [liveText, setLiveText] = useState("Loading");

  const determinate = typeof value === "number";
  const clamped = determinate ? Math.min(100, Math.max(0, value as number)) : 0;

  useEffect(() => {
    const root = rootRef.current;
    const svg = svgRef.current;
    const path = pathRef.current;
    const leftC = leftCircleRef.current;
    const rightC = rightCircleRef.current;
    const leftT = leftTickRef.current;
    const rightT = rightTickRef.current;
    const group = groupRef.current;
    if (!root || !svg || !path || !leftC || !rightC || !leftT || !rightT || !group) {
      return;
    }

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let w = root.clientWidth || 40;
    let raf = 0;

    // hot-path state — locals only, the rAF loop (or the reduced-motion
    // push path) is the sole writer of the SVG attributes below
    let slack = 0;
    let slackV = 0; // spring velocity for the completion snap
    let snapping = false;
    let fadeStart = -1;
    let restOpacity = 1;
    let lastFrame = -1;
    let lastVal = clamped;
    let lastValAt = performance.now();
    let velocity = 0; // %/s, smoothed
    let currentValue = determinate ? clamped : 0;
    let done = determinate && clamped >= 100;
    let lastAnnouncedDecile = -1;
    let doneAnnounced = done;
    let cycleStart = -1; // indeterminate loop origin

    const setGeom = () => {
      w = root.clientWidth || 40;
      svg.setAttribute("viewBox", `0 0 ${w} ${H}`);
      const lcx = PAD;
      const rcx = w - PAD;
      leftC.setAttribute("cx", String(lcx));
      leftC.setAttribute("cy", String(CENTER_Y));
      rightC.setAttribute("cx", String(rcx));
      rightC.setAttribute("cy", String(CENTER_Y));
      leftT.setAttribute("x1", String(lcx));
      leftT.setAttribute("y1", String(CENTER_Y));
      rightT.setAttribute("x1", String(rcx));
      rightT.setAttribute("y1", String(CENTER_Y));
    };

    // paints the cord path (sag = s) and both spool ticks (mirrored by angle,
    // in degrees measured from the tick's upright rest position)
    const draw = (angle: number, s: number) => {
      const x1 = PAD + SPOOL_R;
      const x2 = w - PAD - SPOOL_R;
      const cx = (x1 + x2) / 2;
      const cy = CENTER_Y + s;
      path.setAttribute(
        "d",
        `M ${x1} ${CENTER_Y} Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${x2} ${CENTER_Y}`
      );

      const la = (-angle * Math.PI) / 180;
      const ra = (angle * Math.PI) / 180;
      const reach = SPOOL_R * TICK_REACH;
      leftT.setAttribute("x2", (PAD + Math.sin(la) * reach).toFixed(2));
      leftT.setAttribute("y2", (CENTER_Y - Math.cos(la) * reach).toFixed(2));
      rightT.setAttribute("x2", (w - PAD + Math.sin(ra) * reach).toFixed(2));
      rightT.setAttribute("y2", (CENTER_Y - Math.cos(ra) * reach).toFixed(2));
    };

    setGeom();

    if (reduced) {
      // Static everywhere: rotation off (ticks stay upright), the cord holds
      // a tri-state sag (taut at 0%, sagged mid-run, taut again at done/busy
      // resolves instantly) and a slow CSS opacity pulse is the only motion,
      // applied while loading and dropped once done.
      const staticSlack = () =>
        determinate && (currentValue <= 0 || currentValue >= 100) ? 0 : MAX_SLACK * 0.4;

      const redrawStatic = () => draw(0, staticSlack());
      redrawStatic();
      group.classList.toggle("ns-slackreel-pulse", !done);
      group.style.opacity = done ? String(REST_OPACITY) : "1";

      const pushReduced = (v: number | undefined) => {
        const nv = typeof v === "number" ? Math.min(100, Math.max(0, v)) : 0;
        const wasDone = done;
        currentValue = nv;
        done = determinate ? nv >= 100 : false;
        if (done && !wasDone) setLiveText("Done");
        if (!done && wasDone) setLiveText("Loading");
        group.classList.toggle("ns-slackreel-pulse", !done);
        group.style.opacity = done ? String(REST_OPACITY) : "1";
        redrawStatic();
      };
      pushRef.current = determinate ? pushReduced : null;

      const ro = new ResizeObserver(() => {
        setGeom();
        redrawStatic();
      });
      ro.observe(root);
      return () => {
        ro.disconnect();
        pushRef.current = null;
      };
    }

    const wake = () => {
      if (raf === 0) raf = requestAnimationFrame(loop);
    };

    const loop = (now: number) => {
      let busy = false;

      if (!determinate) {
        // indeterminate: a fixed pay-out / reel-in / rest cycle, forever —
        // this is the whole component's job while it's mounted
        if (cycleStart < 0) cycleStart = now;
        const t = (now - cycleStart) % CYCLE_MS;
        let s: number;
        if (t < PAYOUT_MS) {
          s = MAX_SLACK * easeInCubic(t / PAYOUT_MS);
        } else if (t < PAYOUT_MS + REEL_MS) {
          s = MAX_SLACK * (1 - easeOutExpo((t - PAYOUT_MS) / REEL_MS));
        } else {
          s = 0;
        }
        slack = s;
        draw((s / MAX_SLACK) * ROCK_DEG, slack);
        raf = requestAnimationFrame(loop);
        return;
      }

      const dt =
        lastFrame < 0 ? 1 / 60 : Math.min(0.1, Math.max(0, (now - lastFrame) / 1000));
      lastFrame = now;

      // no fresh value inside STALL_MS reads as stalled: velocity decays to
      // zero on its own, so the cord goes taut even with no further prop
      // writes at all — a spinner cannot express "stopped", this can
      if (now - lastValAt > STALL_MS) {
        velocity += (0 - velocity) * Math.min(1, VEL_SMOOTH * dt);
        busy = busy || Math.abs(velocity) > 0.02;
      }

      if (!snapping) {
        const target = done
          ? 0
          : Math.min(MAX_SLACK, Math.max(0, velocity * VELOCITY_TO_SLACK));
        const before = slack;
        slack += (target - slack) * Math.min(1, SLACK_RATE * dt);
        if (Math.abs(target - slack) < 0.02) slack = target;
        if (slack !== before) busy = true;
      }

      if (done && !snapping && Math.abs(slack) > 0.05) {
        snapping = true;
        slackV = 0;
      }

      if (snapping) {
        const a = -SNAP_K * slack - SNAP_C * slackV;
        slackV += a * dt;
        slack += slackV * dt;
        busy = true;
        if (Math.abs(slack) < 0.05 && Math.abs(slackV) < 0.5) {
          slack = 0;
          slackV = 0;
          snapping = false;
          fadeStart = now;
        }
      }

      if (fadeStart >= 0) {
        const p = Math.min(1, (now - fadeStart) / FADE_MS);
        restOpacity = 1 - (1 - REST_OPACITY) * p;
        group.style.opacity = restOpacity.toFixed(3);
        if (p < 1) busy = true;
      }

      const angle = (currentValue / 100) * ANGLE_SWEEP - ANGLE_SWEEP / 2;
      draw(angle, slack);

      raf = busy ? requestAnimationFrame(loop) : 0; // sleep once fully settled
    };

    const pushDeterminate = (v: number | undefined) => {
      const now = performance.now();
      const nv = typeof v === "number" ? Math.min(100, Math.max(0, v)) : 0;
      const dt = Math.max(0.001, (now - lastValAt) / 1000);
      const instV = (nv - lastVal) / dt;
      velocity += (instV - velocity) * Math.min(1, VEL_SMOOTH * dt);
      lastVal = nv;
      lastValAt = now;
      currentValue = nv;

      if (nv < 100 && done) {
        // a fresh run: undo the resting dim and re-arm the ledger
        done = false;
        doneAnnounced = false;
        lastAnnouncedDecile = -1;
        fadeStart = -1;
        restOpacity = 1;
        group.style.opacity = "1";
        setLiveText("Loading");
      }
      if (nv >= 100) done = true;

      const decile = Math.floor(nv / 10);
      if (nv < 100 && decile !== lastAnnouncedDecile) {
        lastAnnouncedDecile = decile;
        if (decile > 0) setLiveText(`${decile * 10}% loaded`);
      }
      if (nv >= 100 && !doneAnnounced) {
        doneAnnounced = true;
        setLiveText("Done");
      }
      wake();
    };

    pushRef.current = determinate ? pushDeterminate : null;

    draw(
      determinate ? (clamped / 100) * ANGLE_SWEEP - ANGLE_SWEEP / 2 : 0,
      0
    );
    wake();

    const ro = new ResizeObserver(() => {
      setGeom();
      wake();
    });
    ro.observe(root);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      pushRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- driver keyed on mode, values flow through pushRef
  }, [determinate]);

  useEffect(() => {
    pushRef.current?.(value);
  }, [value]);

  const ariaProps = determinate
    ? {
        "aria-valuemin": 0,
        "aria-valuemax": 100,
        "aria-valuenow": Math.round(clamped),
      }
    : {};

  return (
    <div
      ref={rootRef}
      role="progressbar"
      aria-label={ariaLabel}
      {...ariaProps}
      className={`inline-block align-middle ${className}`}
    >
      <style>{`@keyframes ns-slackreel-pulse{0%,100%{opacity:1}50%{opacity:.55}}
.ns-slackreel-pulse{animation:ns-slackreel-pulse 2.4s ease-in-out infinite}`}</style>
      <svg
        ref={svgRef}
        width="100%"
        height={H}
        preserveAspectRatio="none"
        aria-hidden
      >
        <g ref={groupRef}>
          <path
            ref={pathRef}
            fill="none"
            style={{ stroke: "var(--foreground)" }}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          <circle
            ref={leftCircleRef}
            r={SPOOL_R}
            fill="none"
            style={{ stroke: "var(--border)" }}
            strokeWidth={1.5}
          />
          <circle
            ref={rightCircleRef}
            r={SPOOL_R}
            fill="none"
            style={{ stroke: "var(--border)" }}
            strokeWidth={1.5}
          />
          <line
            ref={leftTickRef}
            style={{ stroke: "var(--foreground)" }}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          <line
            ref={rightTickRef}
            style={{ stroke: "var(--foreground)" }}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        </g>
      </svg>
      <span aria-live="polite" className="sr-only">
        {liveText}
      </span>
    </div>
  );
}
