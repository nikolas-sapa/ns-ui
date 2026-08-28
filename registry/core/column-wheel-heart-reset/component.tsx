"use client";

import { useEffect, useId, useRef } from "react";

// ---------------------------------------------------------------------------
// ColumnWheelHeartReset — a self-cycling "confirmed, and ready again"
// feedback chip built as a chronograph's column wheel + heart-cam reset.
//
// A chronograph's column wheel is a small toothed wheel with radial
// pillars; each pusher press indexes it one notch (a classic layout uses 6
// columns, 60deg per index) and each notch engages a different lever
// (start / stop / reset) as a jumper spring rides into the valley between
// pillars. Reset engages a heart-shaped cam fixed to the seconds pinion: a
// hammer snaps against the heart's point and the cam's asymmetric profile
// forces the pinion to rotate to EXACTLY zero regardless of where it
// stopped — a genuinely self-correcting mechanical return, not an animated
// tween back to a known value.
//
// ONE CLOCK (computeFrame, a pure function of ms-into-cycle) drives every
// moving part; the rAF loop only ever writes the resulting angles straight
// to SVG group refs (no React state on the hot path). idle demo cycle:
// 4.5s, 6 column-wheel steps of 0.75s each. Steps 0-3 are the RUN phase —
// the wheel index (and its jumper) advance every 0.75s while a thin
// seconds-style needle, geared to the same shaft as the heart cam beneath
// it, sweeps CONTINUOUSLY at RUN_STEP_DEG/step. RUN_STEP_DEG (128deg) is
// deliberately not a divisor of 360: after 4 run steps the needle+cam sit
// at 512deg mod 360 = 152deg, nowhere near zero, so the reset step's snap
// back to 0 is a real, visible correction rather than a coincidence of the
// numbers lining up. The hammer's rest pose during RUN already sits at its
// ordinary disengaged clearance off the cam; step 4 is RESET: over its
// first 250ms the hammer eases further away into a windup (a real
// departure), then over the next 200ms swings back down through that rest
// clearance and on into contact while the needle+cam group snaps from
// 152deg to 0deg on the SAME clock, so the two visibly complete together,
// at hammer contact — never before it. Step 5 is HOLD: hammer stays
// engaged at contact, needle stays at zero, a beat of stillness before the
// wheel indexes into the next RUN phase, which eases the hammer back off
// contact to its rest clearance in its first 150ms, and the cycle repeats.
//
// TOKENS: column wheel and the running needle+cam (structural, ambient
// "it's alive" motion) render in var(--ns-muted); the hammer and — since it
// is the one climactic moment — a brief opacity lift on the heart cam's tip
// at the instant of contact render in var(--foreground). CSS custom
// properties cascade on their own, so plain var(--token) references in the
// SVG markup repaint for free on a theme switch; no getComputedStyle/
// MutationObserver plumbing is needed here (that machinery exists for
// canvas/WebGL, which read tokens into raw pixel values once and otherwise
// never see a theme change). var(--border) is never used as a stroke.
// var(--ns-accent) never appears — there is no pointer highlight to reserve
// it for.
// ---------------------------------------------------------------------------

export interface ColumnWheelHeartResetProps {
  /** sr-only label announced on each reset. @default "Saved" */
  label?: string;
  /** px, the rendered square size. @default 96 */
  size?: number;
  /** change this value to fire one reset immediately instead of waiting for the idle cycle. */
  trigger?: number | string;
  /** Freezes the mechanism on its current frame without unmounting. */
  paused?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const CYCLE_MS = 4500;
const STEP_MS = 750; // 4.5s / 6 columns
const RUN_STEPS = 4; // steps 0..3
const RESET_STEP = 4;
const RUN_START_MS = 0;
const RESET_START_MS = RUN_STEPS * STEP_MS; // 3000
const HOLD_START_MS = (RESET_STEP + 1) * STEP_MS; // 3750
const RUN_STEP_DEG = 128; // not a divisor of 360 — see header note
const LIFT_MS = 250;
const STRIKE_MS = 200;
const REARM_MS = 150; // eases the hammer back off contact as the next RUN phase begins
// hammerAngle is authored as an offset from CONTACT (the hammer's drawn
// resting pose already points at the cam's tip): 0 = engaged/touching,
// REST = the ordinary disengaged clearance the arm holds through RUN, and
// WINDUP is a further pull-away during the reset's lift sub-phase — the
// visible "departure" before the strike swings it back down through REST
// and on into contact, the "arrival".
const HAMMER_ENGAGE_DEG = 0;
const HAMMER_REST_DEG = 26;
const HAMMER_WINDUP_DEG = 34;
const FLASH_MS = 200; // foreground opacity pulse on the heart cam's tip
const WHEEL_SNAP_MS = 200; // fast-settle window for each column index step

// The frozen reduced-motion frame: mid-strike — hammer at its full windup,
// needle/cam just starting the snap toward zero. The single most
// information-dense frame (wheel step, hammer engaged, needle mid-
// transition, all at once), never t0, which can land on a plain run-phase
// frame with no mechanism visible at all.
const STATIC_MS = RESET_START_MS + LIFT_MS;

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}
function easeInCubic(x: number): number {
  return x * x * x;
}
function smoothstep(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - t * 2);
}

interface Frame {
  wheelIdx: number;
  wheelAngle: number; // deg
  needleAngle: number; // deg, shared by the needle and the heart cam beneath it
  hammerAngle: number; // deg offset from contact — see the constants above
  flash: number; // 0..1, foreground opacity lift on the cam tip
  resetting: boolean;
}

function computeFrame(msIntoCycle: number): Frame {
  const wheelIdx = Math.min(5, Math.floor(msIntoCycle / STEP_MS));
  const wheelStepLocal = msIntoCycle - wheelIdx * STEP_MS;
  const wheelAngle = wheelIdx * 60 + smoothstep(wheelStepLocal / WHEEL_SNAP_MS) * 60;

  if (msIntoCycle < RESET_START_MS) {
    // RUN — needle+cam sweep continuously, geared to the run clock alone.
    // The hammer eases off contact back to its ordinary rest clearance in
    // the first REARM_MS of the run phase (closing the loop after the
    // previous cycle's HOLD left it engaged), then holds at REST.
    const needleAngle = (msIntoCycle / STEP_MS) * RUN_STEP_DEG;
    const hammerAngle =
      msIntoCycle < REARM_MS
        ? HAMMER_REST_DEG * easeOutCubic(msIntoCycle / REARM_MS)
        : HAMMER_REST_DEG;
    return { wheelIdx, wheelAngle, needleAngle, hammerAngle, flash: 0, resetting: false };
  }

  if (msIntoCycle < HOLD_START_MS) {
    // RESET — windup (departure), then strike-and-snap together (arrival),
    // landing exactly in sync at hammer contact.
    const local = msIntoCycle - RESET_START_MS;
    const runEndAngle = RUN_STEPS * RUN_STEP_DEG; // 512 -> 152 once wrapped for display
    if (local < LIFT_MS) {
      const t = easeOutCubic(local / LIFT_MS);
      const hammerAngle = HAMMER_REST_DEG + (HAMMER_WINDUP_DEG - HAMMER_REST_DEG) * t;
      return { wheelIdx, wheelAngle, needleAngle: runEndAngle, hammerAngle, flash: 0, resetting: true };
    }
    const strikeLocal = local - LIFT_MS;
    if (strikeLocal < STRIKE_MS) {
      const t = easeInCubic(strikeLocal / STRIKE_MS);
      const hammerAngle = HAMMER_WINDUP_DEG + (HAMMER_ENGAGE_DEG - HAMMER_WINDUP_DEG) * t;
      const needleAngle = runEndAngle * (1 - t);
      return { wheelIdx, wheelAngle, needleAngle, hammerAngle, flash: 0, resetting: true };
    }
    // held engaged for the remainder of the reset step, flash decaying
    const flashLocal = strikeLocal - STRIKE_MS;
    const flash = Math.max(0, 1 - flashLocal / FLASH_MS);
    return { wheelIdx, wheelAngle, needleAngle: 0, hammerAngle: HAMMER_ENGAGE_DEG, flash, resetting: true };
  }

  // HOLD — engaged and at rest, a beat before the next run phase
  return { wheelIdx, wheelAngle, needleAngle: 0, hammerAngle: HAMMER_ENGAGE_DEG, flash: 0, resetting: false };
}

function wrapDeg(a: number): number {
  return ((a % 360) + 360) % 360;
}

export function ColumnWheelHeartReset({
  label = "Saved",
  size = 96,
  trigger,
  paused,
  className = "",
  style,
}: ColumnWheelHeartResetProps) {
  const uid = useId();
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const wheelRef = useRef<SVGGElement | null>(null);
  const needleRef = useRef<SVGGElement | null>(null);
  const hammerRef = useRef<SVGGElement | null>(null);
  const flashRef = useRef<SVGCircleElement | null>(null);
  const liveRef = useRef<HTMLSpanElement | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const triggerRef = useRef(trigger);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    let disposed = false;
    let running = false;
    let raf = 0;
    let lastMs = 0;
    let simMs = 0;
    let staticMode = false;
    let wasResetting = false;
    let announced = false;

    const applyFrame = (f: Frame) => {
      if (wheelRef.current) wheelRef.current.style.transform = `rotate(${f.wheelAngle}deg)`;
      if (needleRef.current) needleRef.current.style.transform = `rotate(${wrapDeg(f.needleAngle)}deg)`;
      if (hammerRef.current) hammerRef.current.style.transform = `rotate(${f.hammerAngle}deg)`;
      if (flashRef.current) flashRef.current.style.opacity = String(f.flash * 0.55);
      // announce once per completed reset, not every frame of it
      if (f.resetting && !wasResetting) announced = false;
      if (!f.resetting && wasResetting && !announced && liveRef.current) {
        announced = true;
        liveRef.current.textContent = label;
      }
      wasResetting = f.resetting;
    };

    const draw = (ms: number) => applyFrame(computeFrame(ms));

    const loop = (nowMs: number) => {
      if (!running) return;
      const dt = Math.min(50, lastMs ? nowMs - lastMs : 16.7);
      lastMs = nowMs;
      simMs = (simMs + dt) % CYCLE_MS;
      draw(simMs);
      raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (running || disposed || staticMode) return;
      running = true;
      lastMs = 0;
      raf = requestAnimationFrame(loop);
    };
    const sleep = () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;
    const applyMode = () => {
      if (reduced || pausedRef.current) {
        staticMode = true;
        sleep();
        draw(reduced ? STATIC_MS : simMs);
      } else {
        staticMode = false;
        wake();
      }
    };
    const onMq = () => {
      reduced = mq.matches;
      applyMode();
    };
    mq.addEventListener("change", onMq);

    let onScreen = true;
    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((en) => en.isIntersecting);
        if (!onScreen) sleep();
        else if (!staticMode && !document.hidden) wake();
      },
      { threshold: 0 }
    );
    io.observe(wrap);

    const onVis = () => {
      if (document.hidden) sleep();
      else if (!staticMode && onScreen) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    // an external `trigger` change jumps straight to the reset-engage phase
    // instead of waiting on the idle cycle, then resumes the ordinary loop
    let lastPolledPaused = pausedRef.current;
    let lastPolledTrigger = triggerRef.current;
    const poll = window.setInterval(() => {
      if (pausedRef.current !== lastPolledPaused) {
        lastPolledPaused = pausedRef.current;
        applyMode();
      }
      if (triggerRef.current !== lastPolledTrigger) {
        lastPolledTrigger = triggerRef.current;
        simMs = RESET_START_MS;
        if (staticMode) draw(simMs);
        else wake();
      }
    }, 100);

    applyMode();

    return () => {
      disposed = true;
      sleep();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      mq.removeEventListener("change", onMq);
      window.clearInterval(poll);
    };
  }, [label]);

  useEffect(() => {
    triggerRef.current = trigger;
  }, [trigger]);

  return (
    <span
      ref={wrapRef}
      data-column-wheel-heart-reset={uid}
      role="status"
      aria-live="polite"
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size, ...style }}
    >
      <span ref={liveRef} className="sr-only" />
      <svg viewBox="0 0 200 200" width={size} height={size} aria-hidden="true" focusable="false">
        {/* column wheel — a hexagonal ring of 6 pillars, indexed one notch
            (60deg) per idle step, with a fixed jumper mark showing engagement */}
        <g transform="translate(58 148)">
          <g ref={wheelRef} style={{ transformOrigin: "0px 0px" }}>
            {Array.from({ length: 6 }, (_, i) => {
              const a = (i / 6) * Math.PI * 2;
              const x = Math.cos(a) * 22;
              const y = Math.sin(a) * 22;
              return (
                <circle key={i} cx={x} cy={y} r={3.2} fill="var(--ns-muted)" />
              );
            })}
            <polygon
              points={Array.from({ length: 6 }, (_, i) => {
                const a = (i / 6) * Math.PI * 2;
                return `${(Math.cos(a) * 22).toFixed(2)},${(Math.sin(a) * 22).toFixed(2)}`;
              }).join(" ")}
              fill="none"
              stroke="var(--ns-muted)"
              strokeWidth={1.4}
            />
          </g>
          {/* fixed jumper spring, always pointing straight up at the ring */}
          <path d="M0 -30 L-3 -24 L3 -24 Z" fill="var(--ns-muted)" />
        </g>

        {/* heart cam + needle, sharing one shaft/rotation */}
        <g transform="translate(112 66)">
          <g ref={needleRef} style={{ transformOrigin: "0px 0px" }}>
            {/* heart-shaped cam */}
            <path
              d="M0 -30 C -16 -30 -22 -14 -8 -2 C -3 3 0 10 0 18 C 0 10 3 3 8 -2 C 22 -14 16 -30 0 -30 Z"
              fill="none"
              stroke="var(--foreground)"
              strokeWidth={1.6}
              strokeLinejoin="round"
            />
            {/* thin seconds-style needle, tip at the cam's point */}
            <line x1="0" y1="0" x2="0" y2="-30" stroke="var(--ns-muted)" strokeWidth={1.1} strokeLinecap="round" />
          </g>
          {/* flash: a brief foreground opacity lift localized to the cam's
              point, driven straight by computeFrame's flash value */}
          <circle ref={flashRef} cx="0" cy="-30" r={5} fill="var(--foreground)" opacity={0} />
        </g>

        {/* hammer — fixed pivot at (140,22); its base (unrotated) line
            already points straight at the heart cam's tip at (112,36), so
            hammerAngle=0 IS contact, and every positive offset swings the
            tip away along an arc from there */}
        <g transform="translate(140 22)">
          <g ref={hammerRef} style={{ transformOrigin: "0px 0px" }}>
            <line x1="0" y1="0" x2="-28" y2="14" stroke="var(--foreground)" strokeWidth={2.2} strokeLinecap="round" />
          </g>
          <circle cx="0" cy="0" r={2.4} fill="var(--foreground)" />
        </g>
      </svg>
    </span>
  );
}

ColumnWheelHeartReset.displayName = "ColumnWheelHeartReset";
