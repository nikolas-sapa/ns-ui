"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// PlumbTrue — a success moment built on a plumb bob instead of confetti or a
// checkmark draw. Pressing the trigger stands in for the real event (payment
// confirmed, deploy finished, form accepted) firing *before* any motion plays:
// the accessible announcement and onConfirm fire synchronously at the press,
// then a bob drops from a fixed anchor on a fine string (translateY, gravity
// ease-in, a hard stop at full string length — no bounce in the length
// itself), and the sudden stop kicks it into a pendulum swing (rotate about
// the anchor) that decays through a few honest diminishing oscillations
// (closed-form damped cosine, recomputed every frame — no keyframe list) back
// to hanging dead straight. The card carries a second, fixed vertical datum
// line at the same x as the anchor: while swinging, the string visibly
// diverges from it; the moment the swing decays to rest the two are
// collinear — that coincidence *is* the verification, not a separate symbol.
// Only then does a level line draw outward from the bob's tip in both
// directions (stroke-dashoffset, ease-out-expo) and the success text rises
// and fades onto it. Two faint echo copies of the string+bob, tinted via
// color-mix, trail the first swing and fade out — an optional motion-blur
// read, never load-bearing.
//
// The pendulum's continuous per-frame pose is written straight to SVG
// attributes/style via refs (no React state on that path); the few discrete
// phase changes (armed -> settled, live-region text, button label) go through
// React state since they render only a handful of times per mount. Reduced
// motion skips the drop/swing/echoes entirely and snaps straight to the
// settled pose — the level line and text are simply already there, per the
// brief's "reduced motion renders the bob at rest, line and text already
// placed." Every color is a var(--token) reference read straight off the
// cascade (SVG attribute values resolve CSS custom properties natively), so
// there is nothing to re-derive on theme change.
// ---------------------------------------------------------------------------

export interface PlumbTrueProps {
  /** small line above the trigger, shown only while pending */
  pendingCopy?: string;
  /** label on the trigger button before it's pressed */
  pendingLabel?: string;
  /** label shown on the button while the bob is dropping/swinging */
  armingLabel?: string;
  /** announced immediately (role=status) and set onto the level line at rest */
  successMessage?: string;
  /** label the same button carries once settled — the real next action */
  nextActionLabel?: string;
  /** fires synchronously at press, before any motion — this *is* the event */
  onConfirm?: () => void;
  /** fires when the settled button is pressed */
  onNextAction?: () => void;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

type Phase = "pending" | "active" | "settled";

// -- geometry (SVG user units, viewBox 0 0 240 160) --------------------------
const VB_W = 240;
const VB_H = 160;
const ANCHOR_X = 120;
const ANCHOR_Y = 16;
const STRING_LEN = 92;
// bob: a small teardrop, local origin at its attach point, tip pointing down
const BOB_PATH = "M -6 4 A 6 6 0 1 1 6 4 Q 6 15 0 21 Q -6 15 -6 4 Z";
const BOB_TIP_Y = 21; // local y of the tip, relative to the bob's attach point
const LEVEL_Y = ANCHOR_Y + STRING_LEN + BOB_TIP_Y; // world y the level line draws at
const LEVEL_HALF = 84; // px the level line reaches left/right of center
const DATUM_TOP = 30;
const DATUM_BOTTOM = 126;

// -- timing/physics -----------------------------------------------------------
const DROP_MS = 200; // straight fall, ease-in, hard stop at STRING_LEN
const SWING_MS = 950; // pendulum decay window after the stop
const SWING_AMP = 15; // deg, deflection right at the stop (the "overshoot")
const SWING_PERIOD = 330; // ms per oscillation (~2.9 cycles over SWING_MS)
const SWING_TAU = 260; // ms, exponential decay time-constant
const ECHO_FADE_MS = 500; // ghost trail only reads during the first swing
const LEVEL_MS = 260; // ease-out-expo level-line draw
const TEXT_MS = 300; // success text fade + rise

function easeInQuad(t: number) {
  return t * t;
}

export function PlumbTrue({
  pendingCopy = "Order total $49.00",
  pendingLabel = "Confirm payment",
  armingLabel = "Confirming…",
  successMessage = "Payment confirmed",
  nextActionLabel = "View receipt",
  onConfirm,
  onNextAction,
  className = "",
}: PlumbTrueProps) {
  const [phase, setPhase] = useState<Phase>("pending");
  const [reduced, setReduced] = useState(false);
  const [live, setLive] = useState("");

  const phaseRef = useRef<Phase>("pending");
  const reducedRef = useRef(false);
  const rafRef = useRef(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasSettled = useRef(false);

  const groupRef = useRef<SVGGElement>(null);
  const stringRef = useRef<SVGLineElement>(null);
  const bobRef = useRef<SVGPathElement>(null);
  const echo1GroupRef = useRef<SVGGElement>(null);
  const echo1StringRef = useRef<SVGLineElement>(null);
  const echo1BobRef = useRef<SVGPathElement>(null);
  const echo2GroupRef = useRef<SVGGElement>(null);
  const echo2StringRef = useRef<SVGLineElement>(null);
  const echo2BobRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      reducedRef.current = mq.matches;
      setReduced(mq.matches);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // move focus onto the primary next action once settled, so a screen reader
  // (or a keyboard user who never looked away) lands where the flow expects
  useEffect(() => {
    if (phase === "settled" && !wasSettled.current) {
      wasSettled.current = true;
      buttonRef.current?.focus();
    }
  }, [phase]);

  function applyPose(l: number, thetaDeg: number) {
    const s = stringRef.current;
    const b = bobRef.current;
    const g = groupRef.current;
    if (s) s.setAttribute("y2", String(ANCHOR_Y + l));
    if (b) b.setAttribute("transform", `translate(${ANCHOR_X} ${ANCHOR_Y + l})`);
    if (g) g.style.transform = `rotate(${thetaDeg.toFixed(3)}deg)`;
  }

  function applyEcho(
    groupEl: SVGGElement | null,
    stringEl: SVGLineElement | null,
    bobEl: SVGPathElement | null,
    thetaDeg: number,
    opacity: number
  ) {
    if (stringEl) stringEl.setAttribute("y2", String(ANCHOR_Y + STRING_LEN));
    if (bobEl) bobEl.setAttribute("transform", `translate(${ANCHOR_X} ${ANCHOR_Y + STRING_LEN})`);
    if (groupEl) {
      groupEl.style.transform = `rotate(${thetaDeg.toFixed(3)}deg)`;
      groupEl.style.opacity = opacity.toFixed(3);
    }
  }

  function snapSettled() {
    applyPose(STRING_LEN, 0);
    applyEcho(echo1GroupRef.current, echo1StringRef.current, echo1BobRef.current, 0, 0);
    applyEcho(echo2GroupRef.current, echo2StringRef.current, echo2BobRef.current, 0, 0);
  }

  function startAnimation() {
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      if (elapsed < DROP_MS) {
        const l = STRING_LEN * easeInQuad(elapsed / DROP_MS);
        applyPose(l, 0);
      } else if (elapsed < DROP_MS + SWING_MS) {
        const tt = elapsed - DROP_MS;
        const theta =
          SWING_AMP * Math.exp(-tt / SWING_TAU) * Math.cos((2 * Math.PI * tt) / SWING_PERIOD);
        applyPose(STRING_LEN, theta);

        const echoOpacity = Math.max(0, 1 - tt / ECHO_FADE_MS) * 0.2;
        for (const lag of [40, 80] as const) {
          const et = Math.max(0, tt - lag);
          const etheta =
            SWING_AMP * Math.exp(-et / SWING_TAU) * Math.cos((2 * Math.PI * et) / SWING_PERIOD);
          if (lag === 40) {
            applyEcho(echo1GroupRef.current, echo1StringRef.current, echo1BobRef.current, etheta, echoOpacity);
          } else {
            applyEcho(echo2GroupRef.current, echo2StringRef.current, echo2BobRef.current, etheta, echoOpacity * 0.6);
          }
        }
      } else {
        snapSettled();
        phaseRef.current = "settled";
        setPhase("settled");
        rafRef.current = 0;
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function confirm() {
    if (phaseRef.current !== "pending") return; // irreversible: one press decides it
    phaseRef.current = "active";
    setPhase("active");
    // the real event happens now, in full, regardless of what the instrument
    // goes on to draw — announcement and callback are never gated on motion
    setLive(successMessage);
    onConfirm?.();
    if (reducedRef.current) {
      snapSettled();
      phaseRef.current = "settled";
      setPhase("settled");
    } else {
      startAnimation();
    }
  }

  function handleClick() {
    if (phaseRef.current === "pending") confirm();
    else if (phaseRef.current === "settled") onNextAction?.();
    // mid-swing presses are inert: the outcome is already decided
  }

  const settled = phase === "settled";
  const textTop = (LEVEL_Y / VB_H) * 100;
  const buttonLabel = phase === "pending" ? pendingLabel : settled ? nextActionLabel : armingLabel;

  return (
    <div className={`rounded-md border border-border bg-background p-6 ${className}`}>
      <div
        className="relative mx-auto mb-1 w-full max-w-[220px]"
        style={{ aspectRatio: `${VB_W} / ${VB_H}` }}
      >
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          {/* mount bracket + pivot */}
          <line
            x1={ANCHOR_X - 15}
            y1={ANCHOR_Y - 8}
            x2={ANCHOR_X + 15}
            y2={ANCHOR_Y - 8}
            stroke="var(--border)"
            strokeWidth="1"
          />
          <circle cx={ANCHOR_X} cy={ANCHOR_Y} r="2" fill="var(--border)" />

          {/* etched vertical datum — the fixed reference the bob must agree with */}
          <line
            x1={ANCHOR_X}
            y1={DATUM_TOP}
            x2={ANCHOR_X}
            y2={DATUM_BOTTOM}
            stroke="var(--border)"
            strokeWidth="1"
            strokeDasharray="1 3"
          />
          <line x1={ANCHOR_X - 5} y1={DATUM_TOP} x2={ANCHOR_X + 5} y2={DATUM_TOP} stroke="var(--border)" strokeWidth="1" />
          <line
            x1={ANCHOR_X - 5}
            y1={DATUM_BOTTOM}
            x2={ANCHOR_X + 5}
            y2={DATUM_BOTTOM}
            stroke="var(--border)"
            strokeWidth="1"
          />

          {/* ghost echoes — faint motion-blur read on the first swing only */}
          <g ref={echo1GroupRef} style={{ transformOrigin: `${ANCHOR_X}px ${ANCHOR_Y}px`, opacity: 0 }}>
            <line
              ref={echo1StringRef}
              x1={ANCHOR_X}
              y1={ANCHOR_Y}
              x2={ANCHOR_X}
              y2={ANCHOR_Y}
              stroke="color-mix(in srgb, var(--ns-muted) 20%, transparent)"
              strokeWidth="1"
            />
            <path ref={echo1BobRef} d={BOB_PATH} fill="color-mix(in srgb, var(--foreground) 20%, transparent)" />
          </g>
          <g ref={echo2GroupRef} style={{ transformOrigin: `${ANCHOR_X}px ${ANCHOR_Y}px`, opacity: 0 }}>
            <line
              ref={echo2StringRef}
              x1={ANCHOR_X}
              y1={ANCHOR_Y}
              x2={ANCHOR_X}
              y2={ANCHOR_Y}
              stroke="color-mix(in srgb, var(--ns-muted) 20%, transparent)"
              strokeWidth="1"
            />
            <path ref={echo2BobRef} d={BOB_PATH} fill="color-mix(in srgb, var(--foreground) 20%, transparent)" />
          </g>

          {/* the bob itself: fine string + filled teardrop, rotating about the anchor */}
          <g ref={groupRef} style={{ transformOrigin: `${ANCHOR_X}px ${ANCHOR_Y}px` }}>
            <line ref={stringRef} x1={ANCHOR_X} y1={ANCHOR_Y} x2={ANCHOR_X} y2={ANCHOR_Y} stroke="var(--ns-muted)" strokeWidth="1" />
            <path ref={bobRef} d={BOB_PATH} fill="var(--foreground)" transform={`translate(${ANCHOR_X} ${ANCHOR_Y})`} />
          </g>

          {/* level line — draws outward from the tip in both directions once settled */}
          <line
            x1={ANCHOR_X}
            y1={LEVEL_Y}
            x2={ANCHOR_X - LEVEL_HALF}
            y2={LEVEL_Y}
            stroke="var(--foreground)"
            strokeWidth="1"
            strokeDasharray={LEVEL_HALF}
            strokeDashoffset={settled ? 0 : LEVEL_HALF}
            style={{ transition: reduced ? "none" : `stroke-dashoffset ${LEVEL_MS}ms cubic-bezier(0.16,1,0.3,1)` }}
          />
          <line
            x1={ANCHOR_X}
            y1={LEVEL_Y}
            x2={ANCHOR_X + LEVEL_HALF}
            y2={LEVEL_Y}
            stroke="var(--foreground)"
            strokeWidth="1"
            strokeDasharray={LEVEL_HALF}
            strokeDashoffset={settled ? 0 : LEVEL_HALF}
            style={{ transition: reduced ? "none" : `stroke-dashoffset ${LEVEL_MS}ms cubic-bezier(0.16,1,0.3,1)` }}
          />
        </svg>

        {/* real DOM success text — sits just below the level line, clear of the
            resting bob (which occupies the space directly above the tip), and
            rises the last 8px up into that resting spot as it fades in */}
        <div
          className="pointer-events-none absolute left-1/2 w-[85%] -translate-x-1/2 pt-2 text-center"
          style={{ top: `${textTop}%` }}
        >
          <span
            data-plumb-success
            aria-hidden={settled ? undefined : "true"}
            className="pointer-events-auto inline-block text-sm font-semibold text-foreground sm:text-base"
            style={{
              opacity: settled ? 1 : 0,
              transform: `translateY(${settled ? 0 : 8}px)`,
              transition: reduced ? "none" : `opacity ${TEXT_MS}ms ease-out, transform ${TEXT_MS}ms cubic-bezier(0.16,1,0.3,1)`,
            }}
          >
            {successMessage}
          </span>
        </div>
      </div>

      <p
        className="text-center text-sm text-ns-muted"
        style={{ opacity: phase === "pending" ? 1 : 0, transition: "opacity 200ms ease-out" }}
      >
        {pendingCopy}
      </p>

      <div className="mt-4 flex justify-center">
        <button
          ref={buttonRef}
          type="button"
          onClick={handleClick}
          className="rounded-sm border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-border/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        >
          {buttonLabel}
        </button>
      </div>

      {/* announced immediately at confirm() — never delayed for the instrument */}
      <p role="status" aria-live="polite" className="sr-only">
        {live}
      </p>
    </div>
  );
}
