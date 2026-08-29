"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// MailbagHookExchange — a full-bleed ambient background reproducing the
// Railway Post Office (RPO) catcher-crane mail exchange (US mail trains,
// roughly 1864-1977): a trackside crane holds an outgoing mailbag on an iron
// hook; a passing train's catcher arm snags it and kicks a replacement bag
// onto the trackside net in the same motion, without the train ever
// stopping. Real engagement was well under a second and real headway
// between exchanges was minutes to hours — both are DECOUPLED here for
// legibility, not animated 1:1 (see round 9's meter-matrix-scan lesson):
// the exchange gesture is stretched to a scripted ~900ms sequence and the
// wait between exchanges is compressed to a fixed 7.0s cadence so the wait
// itself reads as anticipation rather than as a broken/idle component.
//
// ONE GOVERNING CLOCK. Everything derives from a single elapsed-seconds
// scalar `t`. Train position, arm gesture phase, and completed-exchange
// count are all pure functions of `t % CYCLE` (or, for the exchange count,
// how many CONTACT instants have passed) — there is no separate per-element
// timer to drift out of sync.
//
// ALIVE AT REST, between exchanges: the crane arm is a damped pendulum that
// never fully stops — each exchange's kick leaves it swinging at PEAK_DEG,
// decaying (tau ~0.9s) toward a PENDULUM_FLOOR_DEG resting tremor it never
// drops below, at PENDULUM_PERIOD (1.6s). Independently, a signal lamp on
// the crane post blinks at 0.5Hz (2s period) continuously, on its own
// clock — with CYCLE=7s and LAMP_PERIOD=2s the two motions' phase pairing
// at any given t0 only repeats every lcm(7,2)=14s, so back-to-back 5s
// screenshots essentially never look identical. Rail ties scroll left at a
// constant rate at all times, whether or not a train is on screen.
//
// THE EXCHANGE. CONTACT_T (derived below from the crane's x-fraction, the
// train's length fraction, and the crossing span/duration, not hardcoded)
// is the instant the train's marked engagement point reaches the crane.
// The gesture around it: 280ms swing-out (rest angle -> extended angle,
// ease-in-out), 120ms hold (hook engaged — this is the freeze-frame
// moment), 500ms swing-back (extended -> rest, ease-in-out). At the hold's
// midpoint the held-bag pattern flips (a fixed alternation, not per-frame
// randomness) and a small kicked-bag glyph streaks from the engagement
// point down into the trackside net, fading over the swing-back window —
// the visible "something left, something arrived" beat.
// ---------------------------------------------------------------------------

const CYCLE = 7.0; // seconds between exchanges — fixed cadence, not jitter
const CROSS_DURATION = 2.6; // seconds the train spends fully sweeping the frame
const ENTER_FRAC = -0.2; // train's leading edge starts here (fraction of width)
const SPAN_FRAC = 1.4; // total leading-edge travel across the crossing (fraction of width)
const CRANE_X_FRAC = 0.62; // crane position, fraction of width
const TRAIN_LEN_FRAC = 0.26; // train body length, fraction of width
const ENGAGE_OFFSET_FRAC = 0.4; // engagement marker's offset back from the train's leading edge, as a fraction of train length

// the instant the train's engagement marker aligns with the crane, derived
// (not guessed) from the geometry constants above so gesture timing and
// visual alignment can never drift apart.
const CONTACT_T =
  (CROSS_DURATION *
    (CRANE_X_FRAC + TRAIN_LEN_FRAC * ENGAGE_OFFSET_FRAC - ENTER_FRAC)) /
  SPAN_FRAC;

const SWING_OUT = 0.28;
const HOLD = 0.12;
const SWING_BACK = 0.5;
const GESTURE_START = CONTACT_T - SWING_OUT;
const GESTURE_END = GESTURE_START + SWING_OUT + HOLD + SWING_BACK;

const REST_DEG = 0; // arm hangs straight down at rest
const EXTENDED_DEG = 34; // arm swung out toward the oncoming train
const PENDULUM_PERIOD = 1.6; // seconds, matches the spec's idle-sway rate
const PENDULUM_OMEGA = (2 * Math.PI) / PENDULUM_PERIOD;
const PENDULUM_FLOOR_DEG = 2; // resting tremor amplitude, never fully still
const PENDULUM_PEAK_DEG = 18; // amplitude right after a kick
const PENDULUM_TAU = 0.9; // decay time constant, seconds

const LAMP_PERIOD = 2.0; // seconds, independent clock from CYCLE

const TIE_SPEED = 40; // px/s, constant regardless of train visibility

// the freeze frame prefers-reduced-motion lands on: mid-HOLD, arm fully
// extended, hook engaged, train mid-crossing — the single most structured
// instant the loop produces (crane, train, and both bags legible at once).
const CONTACT_FRAME = GESTURE_START + SWING_OUT + HOLD / 2;

function easeInOut(x: number): number {
  const c = x < 0 ? 0 : x > 1 ? 1 : x;
  return c * c * (3 - 2 * c);
}

/** Arm angle in degrees at gesture-relative time `g` (seconds since GESTURE_START, may be negative). */
function gestureAngle(g: number): number {
  if (g < 0 || g > SWING_OUT + HOLD + SWING_BACK) return REST_DEG;
  if (g < SWING_OUT) return REST_DEG + (EXTENDED_DEG - REST_DEG) * easeInOut(g / SWING_OUT);
  if (g < SWING_OUT + HOLD) return EXTENDED_DEG;
  const back = g - SWING_OUT - HOLD;
  return EXTENDED_DEG + (REST_DEG - EXTENDED_DEG) * easeInOut(back / SWING_BACK);
}

/** Idle pendulum tremor (degrees) added on top of the gesture angle, given seconds since the last gesture ended. */
function pendulumTremor(sincePass: number): number {
  const s = Math.max(0, sincePass);
  const amp = PENDULUM_FLOOR_DEG + (PENDULUM_PEAK_DEG - PENDULUM_FLOOR_DEG) * Math.exp(-s / PENDULUM_TAU);
  return amp * Math.sin(PENDULUM_OMEGA * s);
}

export interface MailbagHookExchangeProps {
  /** headline / CTA rendered above the field */
  children?: ReactNode;
  /** extra classes merged onto the rendered root element */
  className?: string;
  /** inline styles merged onto the root element */
  style?: React.CSSProperties;
}

export function MailbagHookExchange({ children, className = "", style }: MailbagHookExchangeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // token fields start empty; draw() below refuses to paint until
    // readTokens() has run at least once — closes rAF, resize, and the
    // reduced-motion branch as paint-before-read paths.
    let fgColor = "";
    let mutedColor = "";
    let bgColor = "";
    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      fgColor = cs.getPropertyValue("--foreground").trim();
      mutedColor = cs.getPropertyValue("--ns-muted").trim();
      bgColor = cs.getPropertyValue("--background").trim();
    };

    let w = 0;
    let h = 0;
    let sized = false;
    let visible = true;
    let raf = 0;
    let t = reduced ? CONTACT_FRAME : 0;
    let last = 0;

    const resize = () => {
      const rect = root.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        sized = false;
        return;
      }
      const isCard = !!canvas.closest("[data-autoplay-root]");
      const dpr = isCard
        ? Math.min(0.6, window.devicePixelRatio || 1)
        : Math.min(window.devicePixelRatio || 1, 1.5);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sized = true;
    };

    const draw = () => {
      if (!sized || !fgColor) return;
      ctx.clearRect(0, 0, w, h);

      const trackY = h * 0.74;
      const craneX = w * CRANE_X_FRAC;
      const craneBaseY = trackY;
      const craneHeight = Math.min(w, h) * 0.22;
      const craneTopY = craneBaseY - craneHeight;
      const armLength = Math.min(w, h) * 0.13;
      const bagSize = Math.min(w, h) * 0.045;
      const trainLength = w * TRAIN_LEN_FRAC;
      const trainHeight = Math.min(w, h) * 0.09;
      const tieSpacing = Math.max(10, Math.min(w, h) * 0.05);

      // --- rail + scrolling ties (structure, low emphasis, drawn always) ---
      ctx.strokeStyle = mutedColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, trackY);
      ctx.lineTo(w, trackY);
      ctx.stroke();

      const tieOffset = (t * TIE_SPEED) % tieSpacing;
      ctx.lineWidth = 2;
      for (let x = -tieOffset; x < w + tieSpacing; x += tieSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, trackY - 3);
        ctx.lineTo(x, trackY + 6);
        ctx.stroke();
      }

      // --- crane post + net (structure) ---
      ctx.strokeStyle = mutedColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(craneX, craneBaseY);
      ctx.lineTo(craneX, craneTopY);
      ctx.stroke();

      const netY = craneBaseY - craneHeight * 0.12;
      const netX = craneX - armLength * 0.55;
      ctx.beginPath();
      ctx.arc(netX, netY, bagSize * 0.9, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();

      // --- signal lamp (independent 0.5Hz clock, luminance only) ---
      const lampOn = Math.floor(t / (LAMP_PERIOD / 2)) % 2 === 0;
      ctx.fillStyle = lampOn ? fgColor : mutedColor;
      ctx.beginPath();
      ctx.arc(craneX, craneTopY - bagSize * 0.6, bagSize * 0.35, 0, Math.PI * 2);
      ctx.fill();

      // --- arm + hook + held bag (subject, brighter emphasis) ---
      const g = t - GESTURE_START - Math.floor((t - GESTURE_START) / CYCLE) * CYCLE;
      // g is "seconds since this cycle's GESTURE_START", wrapped into [0, CYCLE)
      const inGesture = g >= 0 && g <= SWING_OUT + HOLD + SWING_BACK;
      const armDeg = inGesture ? gestureAngle(g) : REST_DEG;
      const sincePass = inGesture ? 0 : g > SWING_OUT + HOLD + SWING_BACK ? g - (SWING_OUT + HOLD + SWING_BACK) : g + CYCLE - (SWING_OUT + HOLD + SWING_BACK);
      const tremor = inGesture ? 0 : pendulumTremor(sincePass);
      const angleRad = ((armDeg + tremor) * Math.PI) / 180;

      // arm pivots at the crane top; hooked bag hangs `armLength` from the
      // pivot at angle `angleRad` from straight-down (angle 0 = REST_DEG)
      const hookX = craneX + Math.sin(angleRad) * armLength;
      const hookY = craneTopY + Math.cos(angleRad) * armLength;

      ctx.strokeStyle = fgColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(craneX, craneTopY);
      ctx.lineTo(hookX, hookY);
      ctx.stroke();

      // completed-exchange count -> which bag pattern is currently held
      const completed = t >= CONTACT_T ? Math.floor((t - CONTACT_T) / CYCLE) + 1 : 0;
      const variant = completed % 2;

      ctx.fillStyle = fgColor;
      ctx.beginPath();
      ctx.roundRect(hookX - bagSize / 2, hookY, bagSize, bagSize * 1.15, bagSize * 0.2);
      ctx.fill();
      if (variant === 1) {
        // alternate fill pattern: a couple of thin horizontal bands, drawn
        // in the background color so it reads as a different sack, never a
        // hue change
        ctx.strokeStyle = bgColor;
        ctx.lineWidth = 1;
        for (let i = 1; i <= 2; i++) {
          const by = hookY + (bagSize * 1.15 * i) / 3;
          ctx.beginPath();
          ctx.moveTo(hookX - bagSize / 2 + 1, by);
          ctx.lineTo(hookX + bagSize / 2 - 1, by);
          ctx.stroke();
        }
      }

      // --- kicked bag streak toward the net, only during hold + swing-back ---
      if (inGesture && g >= SWING_OUT) {
        const kickG = g - SWING_OUT; // 0 at hold start, through HOLD+SWING_BACK
        const kickDur = HOLD + SWING_BACK;
        const kp = easeInOut(kickG / kickDur);
        const kx = hookX + (netX - hookX) * kp;
        const ky = hookY + (netY - hookY) * kp;
        ctx.globalAlpha = 1 - kp * 0.85;
        ctx.fillStyle = fgColor;
        ctx.beginPath();
        ctx.roundRect(kx - bagSize / 2.6, ky - bagSize * 0.5, bagSize * 0.77, bagSize * 0.9, bagSize * 0.15);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // --- train silhouette, visible only within its crossing window ---
      const phase = t - Math.floor(t / CYCLE) * CYCLE;
      if (phase < CROSS_DURATION) {
        const progress = phase / CROSS_DURATION;
        const frontX = w * ENTER_FRAC + progress * w * SPAN_FRAC;
        const rearX = frontX - trainLength;
        const topY = trackY - trainHeight;

        ctx.fillStyle = fgColor;
        ctx.beginPath();
        ctx.moveTo(rearX, trackY);
        ctx.lineTo(rearX, topY);
        ctx.lineTo(frontX - trainLength * 0.12, topY);
        ctx.lineTo(frontX, trackY - trainHeight * 0.35);
        ctx.lineTo(frontX, trackY);
        ctx.closePath();
        ctx.fill();
      }
    };

    const loop = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      t += dt;
      draw();
      if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (reduced) draw();
      }, 120);
    });
    ro.observe(root);

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        if (visible && !reduced && !raf) {
          last = 0;
          raf = requestAnimationFrame(loop);
        }
      },
      { threshold: 0 }
    );
    io.observe(root);

    const onVis = () => {
      if (!document.hidden && visible && !reduced && !raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced || !raf) draw();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    readTokens();
    resize();

    if (reduced) {
      draw();
    } else {
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`relative isolate min-h-screen w-full overflow-hidden bg-background ${className}`}
      style={style}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 block h-full w-full"
      />
      {children ? (
        <div className="relative z-10 flex min-h-screen w-full flex-col items-center justify-center gap-4 px-6 text-center">
          {children}
        </div>
      ) : null}
    </div>
  );
}
