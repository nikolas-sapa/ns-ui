"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";

// ---------------------------------------------------------------------------
// CardFlick — a per-letter hover/click flourish where each character is an
// index card on a spindle: the face flicks back over its top edge and out of
// view while a duplicate of the same letter, tucked underneath, flicks up
// into its place — staggered across the word from a configurable origin.
//
// Rather than approximate spring motion with a cubic-bezier (which can only
// ever curve, not overshoot-and-settle with the right feel per stiffness/
// damping combination) this numerically integrates a damped harmonic
// oscillator once per trigger and bakes the samples straight into a WAAPI
// keyframe list — the physics is literally in the keyframes, not in the
// easing function. Only the trigger and the one-time reset run through
// React; every animated frame is native Element.animate().
// ---------------------------------------------------------------------------

export interface CardFlickProps {
  /** the text to animate, one Animation pair per character */
  text: string;
  className?: string;
  /** classes applied to every individual letter span */
  letterClassName?: string;
  /** what starts the flick */
  trigger?: "hover" | "click";
  /** seconds between adjacent letters starting */
  stagger?: number;
  /** where the stagger wave originates */
  from?: "start" | "end" | "center";
  /** spring stiffness — higher settles faster */
  stiffness?: number;
  /** spring damping — lower overshoots more */
  damping?: number;
  onSettle?: () => void;
}

const MASS = 1;
const SAMPLES = 26;

// Integrates x'' = -(stiffness/mass)(x-1) - (damping/mass)x' from x=0,v=0 at
// dt=1/240 until it settles near 1, then resamples to a fixed keyframe count
// so every trigger produces the same number of WAAPI offsets regardless of
// how long the physical settle actually takes.
function springKeyframeValues(stiffness: number, damping: number): { values: number[]; durationMs: number } {
  const dt = 1 / 240;
  let x = 0;
  let v = 0;
  let t = 0;
  const raw: number[] = [0];
  const maxT = 1.6;
  while (t < maxT) {
    const accel = (-stiffness * (x - 1) - damping * v) / MASS;
    v += accel * dt;
    x += v * dt;
    t += dt;
    raw.push(x);
    if (Math.abs(x - 1) < 0.004 && Math.abs(v) < 0.02) break;
  }
  const values: number[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const pos = (i / (SAMPLES - 1)) * (raw.length - 1);
    values.push(raw[Math.round(pos)] ?? 1);
  }
  return { values, durationMs: Math.max(180, Math.round(t * 1000)) };
}

function staggerDelay(index: number, count: number, from: "start" | "end" | "center", per: number): number {
  if (from === "end") return (count - 1 - index) * per;
  if (from === "center") {
    const mid = (count - 1) / 2;
    return Math.abs(index - mid) * per;
  }
  return index * per;
}

export function CardFlick({
  text,
  className = "",
  letterClassName,
  trigger = "hover",
  stagger = 0.035,
  from = "start",
  stiffness = 210,
  damping = 15,
  onSettle,
}: CardFlickProps) {
  const chars = Array.from(text);
  const springRef = useRef(springKeyframeValues(stiffness, damping));
  springRef.current = springKeyframeValues(stiffness, damping);
  const playersRef = useRef<(() => void)[]>([]);
  const blockedRef = useRef(false);
  const reducedRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onChange = () => {
      reducedRef.current = mq.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const registerPlayer = useCallback((i: number, fn: () => void) => {
    playersRef.current[i] = fn;
  }, []);

  const fire = useCallback(() => {
    if (blockedRef.current) return;
    // Flicking every letter over its top edge is exactly the kind of motion
    // prefers-reduced-motion exists for — skip the spring entirely rather
    // than just slowing it down; the letters stay put and settle instantly.
    if (reducedRef.current) {
      onSettle?.();
      return;
    }
    blockedRef.current = true;
    for (const play of playersRef.current) play?.();
    const totalMs =
      springRef.current.durationMs +
      staggerDelay(chars.length - 1, chars.length, from, stagger * 1000) +
      40;
    window.setTimeout(() => {
      blockedRef.current = false;
      onSettle?.();
    }, totalMs);
  }, [chars.length, from, stagger, onSettle]);

  return (
    <span
      role="text"
      aria-label={text}
      data-cardflick
      className={`inline-flex cursor-default select-none items-center justify-center ${className}`}
      onPointerEnter={trigger === "hover" ? fire : undefined}
      onClick={trigger === "click" ? fire : undefined}
    >
      {chars.map((c, i) => (
        <LetterMount
          key={i}
          char={c}
          index={i}
          count={chars.length}
          from={from}
          stagger={stagger}
          letterClassName={letterClassName}
          springRef={springRef}
          register={registerPlayer}
        />
      ))}
    </span>
  );
}

// Owns one letter's front/echo DOM nodes and registers its imperative
// animate() closure with the parent, so CardFlick can fire every letter's
// animation from a single trigger without lifting animation state into React.
function LetterMount({
  char,
  index,
  count,
  from,
  stagger,
  letterClassName,
  springRef,
  register,
}: {
  char: string;
  index: number;
  count: number;
  from: "start" | "end" | "center";
  stagger: number;
  letterClassName?: string;
  springRef: RefObject<{ values: number[]; durationMs: number }>;
  register: (i: number, fn: () => void) => void;
}) {
  const frontRef = useRef<HTMLSpanElement>(null);
  const echoRef = useRef<HTMLSpanElement>(null);
  const delayMs = staggerDelay(index, count, from, stagger * 1000);

  const play = useCallback(() => {
    const front = frontRef.current;
    const echo = echoRef.current;
    const spring = springRef.current;
    if (!front || !echo || !spring) return;

    const frontFrames = spring.values.map((p, i) => ({
      offset: i / (spring.values.length - 1),
      transform: `rotateX(${(-100 * p).toFixed(2)}deg) translateY(${(-6 * p).toFixed(2)}px)`,
      opacity: Math.max(0, (1 - p)).toFixed(3),
      filter: `blur(${Math.max(0, 4 * p).toFixed(2)}px)`,
    }));
    const echoFrames = spring.values.map((p, i) => ({
      offset: i / (spring.values.length - 1),
      transform: `rotateX(${(80 * (1 - p)).toFixed(2)}deg) translateY(${(6 * (1 - p)).toFixed(2)}px) scale(${(0.85 + 0.15 * p).toFixed(3)})`,
      opacity: Math.max(0, Math.min(1, p)).toFixed(3),
      filter: `blur(${Math.max(0, 4 * (1 - p)).toFixed(2)}px)`,
    }));

    const opts: KeyframeAnimationOptions = {
      duration: spring.durationMs,
      delay: delayMs,
      fill: "forwards",
      easing: "linear",
    };
    const frontAnim = front.animate(frontFrames, opts);
    const echoAnim = echo.animate(echoFrames, opts);

    Promise.allSettled([frontAnim.finished, echoAnim.finished]).then(() => {
      front.animate(
        [{ transform: "rotateX(0deg) translateY(0px)", opacity: 1, filter: "blur(0px)" }],
        { duration: 0, fill: "forwards" }
      );
      echo.animate(
        [{ transform: "rotateX(80deg) translateY(6px) scale(0.85)", opacity: 0, filter: "blur(4px)" }],
        { duration: 0, fill: "forwards" }
      );
    });
  }, [delayMs, springRef]);

  register(index, play);

  return (
    <span className="relative inline-flex whitespace-pre" style={{ perspective: "480px" }}>
      <span
        ref={frontRef}
        aria-hidden
        className={`inline-block ${letterClassName ?? ""}`}
        style={{ transformOrigin: "bottom center", backfaceVisibility: "hidden" }}
      >
        {char}
      </span>
      <span
        ref={echoRef}
        aria-hidden
        className={`absolute inset-0 inline-block ${letterClassName ?? ""}`}
        style={{
          transformOrigin: "top center",
          backfaceVisibility: "hidden",
          transform: "rotateX(80deg) translateY(6px) scale(0.85)",
          opacity: 0,
          filter: "blur(4px)",
        }}
      >
        {char}
      </span>
    </span>
  );
}
