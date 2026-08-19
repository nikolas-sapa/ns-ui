"use client";

import { useEffect, useId, useRef, useState } from "react";

// TorsionRetry — a retry button that is honest about its rate limit. Idle and
// charged are the only pressable states; a failure winds a torsion spring: a
// 1.5px --foreground arc grows 0->360deg around the icon's --border track on
// LINEAR timing matched exactly to the real backoff delay (no fake easing —
// the visual duration IS the enforced cooldown), while the refresh glyph
// rotates slowly backward as if under tension. Reaching full wind snaps the
// button to "charged": the icon pops with one damped-spring overshoot, the
// glyph un-tenses 5deg forward (a permanent correction, not a bounce-back),
// and the button gains --ns-accent text/border as its one legitimate accent use.
// Every failure also drops a permanent 2px --ns-muted notch tick at a fixed
// angular slot on the ring (1st failure always the same slot, 2nd always the
// next, etc.) — a live history of the episode, not just its current backoff.
// A successful retry resolves the episode: notches and attempt count reset,
// the ring goes fully quiet. Hot-path values (arc offset, glyph rotation,
// settle-spring) are written directly to refs every frame; React state only
// carries status/attempt/caption, so re-renders stay coarse. Under
// prefers-reduced-motion the arc advances in discrete steps with no glyph
// rotation and no overshoot. Zero dependencies, DOM + SVG + CSS only.

export interface TorsionRetryProps {
  /** called when the user presses Retry once idle/charged; resolve/return
   *  false (or throw) to report failure, anything else counts as success */
  onRetry?: () => Promise<boolean> | boolean;
  /** wind duration for the first failure, ms (default 4000 — a real cooldown) */
  baseDelayMs?: number;
  /** multiplier applied per additional consecutive failure (default 2) */
  factor?: number;
  /** upper bound on wind duration regardless of attempt count (default 60000) */
  maxDelayMs?: number;
  /** fixed angular slots the ring can notch before saturating (default 8) —
   *  the attempt count in the text description is never capped, only the ring */
  maxNotches?: number;
  /** button label in the idle/charged state (default "Retry") */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

type Status = "idle" | "checking" | "winding" | "charged";

const SIZE = 28;
const CENTER = SIZE / 2;
const TRACK_R = 10.5;
const CIRCUMFERENCE = 2 * Math.PI * TRACK_R;
const NOTCH_INNER = 11.25;
const NOTCH_OUTER = 13.25;
const ROTATE_DEG_PER_SEC = 26; // slow backward tension while winding
const REDUCED_STEPS = 10; // discrete arc steps under prefers-reduced-motion
const DT_MAX = 0.05; // s — clamp tab-switch/frame-stall jumps

// settle spring (icon pop + glyph un-tense), same recipe family as
// confirm-hold-ink's proven "pop" constants — underdamped, one visible bounce
const SETTLE_K = 300;
const SETTLE_C = 12;

function computeDelay(attempt: number, base: number, factor: number, max: number) {
  return Math.min(max, base * Math.pow(factor, Math.max(0, attempt - 1)));
}

function notchAngleDeg(i: number, count: number) {
  return (i + 0.5) * (360 / count);
}

function RefreshGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M11.5 4.2A5 5 0 1 0 12.4 8.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M11.6 1.6v3h-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TorsionRetry({
  onRetry,
  baseDelayMs = 4000,
  factor = 2,
  maxDelayMs = 60000,
  maxNotches = 8,
  label = "Retry",
  className = "",
}: TorsionRetryProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const arcRef = useRef<SVGCircleElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);
  const glyphRef = useRef<HTMLSpanElement>(null);
  const descId = useId();

  const [status, setStatus] = useState<Status>("idle");
  const [attempt, setAttempt] = useState(0);
  const [caption, setCaption] = useState("Ready");

  const onRetryRef = useRef(onRetry);
  onRetryRef.current = onRetry;
  const cfgRef = useRef({ baseDelayMs, factor, maxDelayMs });
  cfgRef.current = { baseDelayMs, factor, maxDelayMs };

  // hot-path state — refs only, never triggers a render
  const s = useRef({
    status: "idle" as Status,
    attempt: 0,
    delay: 0,
    windStart: 0,
    lastFrame: 0,
    glyphDeg: 0, // accumulated rotation, direct-written to glyphRef
    reduced: false,
    lastStep: -1,
    lastAnnouncedSec: -1,
    raf: 0,
    pausedAt: 0,
    // settle spring — icon scale + glyph nudge, run once per charge
    settling: false,
    scaleV: 1,
    scaleVel: 0,
    nudgeV: 0,
    nudgeVel: 0,
  }).current;

  useEffect(() => {
    const btn = btnRef.current;
    const arc = arcRef.current;
    const icon = iconRef.current;
    const glyph = glyphRef.current;
    if (!btn || !arc || !icon || !glyph) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    s.reduced = mq.matches;
    const onMq = () => {
      s.reduced = mq.matches;
    };
    mq.addEventListener("change", onMq);

    const applyGlyph = (deg: number) => {
      glyph.style.transform = s.reduced ? "" : `rotate(${deg}deg)`;
    };
    const applyArc = (progress: number) => {
      arc.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - progress));
    };
    const applyIconScale = (scale: number) => {
      icon.style.transform = scale === 1 ? "" : `scale(${scale})`;
    };

    const secondsCaption = (remainingMs: number, attemptNum: number) => {
      const secs = Math.max(0, Math.ceil(remainingMs / 1000));
      return `Retry available in ${secs} second${secs === 1 ? "" : "s"}, attempt ${attemptNum}`;
    };

    const stopRaf = () => {
      if (s.raf) cancelAnimationFrame(s.raf);
      s.raf = 0;
    };

    const settleTick = (now: number) => {
      const dt = Math.min(DT_MAX, (now - s.lastFrame) / 1000);
      s.lastFrame = now;

      s.scaleVel += ((1 - s.scaleV) * SETTLE_K - SETTLE_C * s.scaleVel) * dt;
      s.scaleV += s.scaleVel * dt;
      s.nudgeVel += ((5 - s.nudgeV) * SETTLE_K - SETTLE_C * s.nudgeVel) * dt;
      s.nudgeV += s.nudgeVel * dt;

      applyIconScale(s.reduced ? 1 : s.scaleV);
      applyGlyph(s.glyphDeg + s.nudgeV);

      const done =
        Math.abs(s.scaleV - 1) < 0.001 &&
        Math.abs(s.scaleVel) < 0.01 &&
        Math.abs(s.nudgeV - 5) < 0.05 &&
        Math.abs(s.nudgeVel) < 0.05;

      if (done || s.reduced) {
        s.scaleV = 1;
        s.nudgeV = 5;
        s.glyphDeg += 5;
        applyIconScale(1);
        applyGlyph(s.glyphDeg);
        s.settling = false;
        s.raf = 0;
        return;
      }
      s.raf = requestAnimationFrame(settleTick);
    };

    const startSettle = () => {
      s.settling = true;
      s.scaleV = 0.97;
      s.scaleVel = 0.6;
      s.nudgeV = 0;
      s.nudgeVel = 40; // deg/s kick — matches the spring's own timescale
      s.lastFrame = performance.now();
      stopRaf();
      s.raf = requestAnimationFrame(settleTick);
    };

    const windTick = (now: number) => {
      const elapsed = now - s.windStart;
      const dt = Math.min(DT_MAX, (now - s.lastFrame) / 1000);
      s.lastFrame = now;
      const progress = Math.min(1, s.delay > 0 ? elapsed / s.delay : 1);

      if (s.reduced) {
        const step = Math.min(REDUCED_STEPS, Math.floor(progress * REDUCED_STEPS));
        if (step !== s.lastStep) {
          s.lastStep = step;
          applyArc(step / REDUCED_STEPS);
        }
      } else {
        applyArc(progress);
        s.glyphDeg -= ROTATE_DEG_PER_SEC * dt;
        applyGlyph(s.glyphDeg);
      }

      const remaining = Math.max(0, s.delay - elapsed);
      const sec = Math.ceil(remaining / 1000);
      if (sec !== s.lastAnnouncedSec) {
        s.lastAnnouncedSec = sec;
        setCaption(secondsCaption(remaining, s.attempt));
      }

      if (progress >= 1) {
        s.status = "charged";
        setStatus("charged");
        setCaption("Retry available now");
        applyArc(1);
        s.raf = 0;
        if (s.reduced) {
          s.glyphDeg += 5;
          applyGlyph(s.glyphDeg);
        } else {
          startSettle();
        }
        return;
      }
      s.raf = requestAnimationFrame(windTick);
    };

    const startWind = (attemptNum: number) => {
      const { baseDelayMs: b, factor: f, maxDelayMs: m } = cfgRef.current;
      const delay = computeDelay(attemptNum, b, f, m);
      s.attempt = attemptNum;
      s.delay = delay;
      s.windStart = performance.now();
      s.lastFrame = s.windStart;
      s.lastStep = -1;
      s.lastAnnouncedSec = -1;
      s.status = "winding";
      setStatus("winding");
      applyArc(0);
      stopRaf();
      s.raf = requestAnimationFrame(windTick);
    };

    const handleClick = () => {
      if (s.status !== "idle" && s.status !== "charged") return;
      stopRaf();
      s.status = "checking";
      setStatus("checking");
      setCaption("Retrying…");
      Promise.resolve()
        .then(() => onRetryRef.current?.())
        .then(
          (ok) => {
            if (ok !== false) {
              s.attempt = 0;
              setAttempt(0);
              s.status = "idle";
              setStatus("idle");
              setCaption("Ready");
              applyArc(0);
            } else {
              const next = s.attempt + 1;
              setAttempt(next);
              startWind(next);
            }
          },
          () => {
            const next = s.attempt + 1;
            setAttempt(next);
            startWind(next);
          }
        );
    };

    btn.addEventListener("click", handleClick);

    // pause the wind clock while the tab is hidden — resume without losing
    // the elapsed progress by shifting windStart forward by the paused span
    const onVisibility = () => {
      if (document.hidden) {
        if (s.raf) {
          stopRaf();
          s.pausedAt = performance.now();
        }
      } else if (s.pausedAt) {
        const gap = performance.now() - s.pausedAt;
        s.pausedAt = 0;
        if (s.status === "winding") {
          s.windStart += gap;
          s.lastFrame = performance.now();
          s.raf = requestAnimationFrame(windTick);
        } else if (s.settling) {
          s.lastFrame = performance.now();
          s.raf = requestAnimationFrame(settleTick);
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      btn.removeEventListener("click", handleClick);
      document.removeEventListener("visibilitychange", onVisibility);
      mq.removeEventListener("change", onMq);
      stopRaf();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const notchCount = Math.min(attempt, maxNotches);
  const busy = status === "checking" || status === "winding";

  return (
    <div className={`inline-flex flex-col items-start gap-1.5 ${className}`}>
      <button
        ref={btnRef}
        type="button"
        data-torsion-retry
        disabled={busy}
        aria-describedby={descId}
        className={[
          "ns-brb-btn inline-flex items-center gap-2 rounded-sm border px-3 py-1.5 text-sm font-medium",
          "border-border bg-background text-foreground",
          "hover:border-ns-muted hover:bg-border/60",
          "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-background",
          "transition-colors duration-150 motion-reduce:transition-none",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent",
          status === "charged" ? "border-ns-accent text-ns-accent" : "",
        ].join(" ")}
      >
        <span
          ref={iconRef}
          className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center"
        >
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            aria-hidden="true"
            className="absolute inset-0"
          >
            <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
              <circle
                cx={CENTER}
                cy={CENTER}
                r={TRACK_R}
                fill="none"
                stroke="var(--border)"
                strokeWidth={1.5}
              />
              {Array.from({ length: notchCount }, (_, i) => {
                const rad = (notchAngleDeg(i, maxNotches) * Math.PI) / 180;
                const x1 = CENTER + Math.cos(rad) * NOTCH_INNER;
                const y1 = CENTER + Math.sin(rad) * NOTCH_INNER;
                const x2 = CENTER + Math.cos(rad) * NOTCH_OUTER;
                const y2 = CENTER + Math.sin(rad) * NOTCH_OUTER;
                return (
                  <line
                    key={i}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="var(--ns-muted)"
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                );
              })}
              <circle
                ref={arcRef}
                cx={CENTER}
                cy={CENTER}
                r={TRACK_R}
                fill="none"
                stroke="var(--foreground)"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={CIRCUMFERENCE}
              />
            </g>
          </svg>
          <span ref={glyphRef} className="relative flex text-foreground">
            <RefreshGlyph />
          </span>
        </span>
        <span>{label}</span>
      </button>

      <p
        id={descId}
        aria-live="polite"
        aria-atomic="true"
        className="min-h-[1em] font-mono text-[11px] leading-tight text-ns-muted"
      >
        {busy ? <span data-torsion-armed>{caption}</span> : caption}
      </p>
    </div>
  );
}
