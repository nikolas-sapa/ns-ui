"use client";

import { useEffect, useRef, useState } from "react";

export interface UnderInkProps {
  /** The sensitive text under the bar. Sized by the real text, so the bar never lies about length. */
  children: string;
  /** Tiny mono tag on the bar naming WHAT is hidden without revealing it — "email", "amount". */
  label?: string;
  /** ms after a hold-peek release before the ink flows back. */
  resealMs?: number;
  className?: string;
}

const HOLD_THRESHOLD_MS = 280; // press shorter than this is a click-toggle, longer is a peek

/**
 * Inline redaction. The bar is drawn over the real text (which sets the
 * width — a redaction that hides length hides less than people think, and a
 * fixed-width bar that lies about it reads as fake). Two ways in:
 * press-and-hold lifts the ink for a peek and it flows back shortly after
 * release; a plain click (or Enter/Space) latches it open until clicked
 * again. aria-pressed tracks whether the text is currently exposed.
 */
export function UnderInk({ children, label, resealMs = 900, className = "" }: UnderInkProps) {
  const [latched, setLatched] = useState(false);
  const [peeking, setPeeking] = useState(false);
  const pressStartRef = useRef(0);
  const resealRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const suppressClickRef = useRef(false);

  const revealed = latched || peeking;

  useEffect(() => () => window.clearTimeout(resealRef.current), []);

  // Escape is the panic key: seal immediately, latched or mid-peek.
  useEffect(() => {
    if (!revealed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        window.clearTimeout(resealRef.current);
        setLatched(false);
        setPeeking(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [revealed]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || latched) return;
    window.clearTimeout(resealRef.current);
    suppressClickRef.current = false; // a drag-out could leave a stale suppress behind
    pressStartRef.current = performance.now();
    setPeeking(true);
  };

  const endPress = () => {
    if (!peeking) return;
    const held = performance.now() - pressStartRef.current;
    if (held >= HOLD_THRESHOLD_MS) {
      // it was a peek: the ink takes a moment to flow back
      suppressClickRef.current = true; // the click that follows pointerup must not latch
      resealRef.current = setTimeout(() => setPeeking(false), resealMs);
    } else {
      // short press: let the click handler latch it
      setPeeking(false);
    }
  };

  const onClick = (e: React.MouseEvent) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    // e.detail === 0 → keyboard activation (Enter/Space): always a toggle
    window.clearTimeout(resealRef.current);
    setPeeking(false);
    setLatched((l) => !l);
  };

  return (
    <button
      type="button"
      aria-pressed={revealed}
      aria-label={
        revealed
          ? `Hide redacted ${label ?? "content"}`
          : `Reveal redacted ${label ?? "content"} — hold to peek, click to keep open`
      }
      onPointerDown={onPointerDown}
      onPointerUp={endPress}
      onPointerCancel={endPress}
      onPointerLeave={endPress}
      onClick={onClick}
      className={`ns-underink group relative inline-block cursor-pointer whitespace-nowrap rounded-[3px] px-[3px] align-baseline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
    >
      <style>{`
        .ns-underink .ns-underink-bar {
          transition: transform 240ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease-out;
          transform-origin: top;
        }
        .ns-underink[aria-pressed="true"] .ns-underink-bar {
          transform: scaleY(0.14) translateY(-2px);
          opacity: 0.85;
        }
        .ns-underink .ns-underink-text {
          transition: opacity 180ms ease-out 60ms;
        }
        .ns-underink:hover .ns-underink-bar { opacity: 0.82; }
        @media (prefers-reduced-motion: reduce) {
          .ns-underink .ns-underink-bar, .ns-underink .ns-underink-text { transition: none; }
        }
      `}</style>
      {/* the real text sets the width; hidden from everyone (visually + AT) while sealed */}
      <span
        data-underink-text
        aria-hidden={!revealed}
        className={`ns-underink-text relative z-0 ${revealed ? "opacity-100" : "opacity-0"}`}
      >
        {children}
      </span>
      {/* the ink: lifts to a thin overline on reveal, so the redaction never disappears — it hovers over what it was hiding */}
      <span
        aria-hidden
        className="ns-underink-bar absolute inset-0 z-10 rounded-[3px] bg-foreground"
      >
        {label && (
          // stays mounted; hidden by opacity when revealed. Unmounting it on
          // reveal removed the exact node under a centred click between
          // pointerdown and pointerup, so the browser fired no `click` and the
          // latch never happened.
          <span
            className={`flex h-full items-center justify-center overflow-hidden px-1 font-mono text-[9px] uppercase tracking-[0.18em] text-background/80 ${revealed ? "opacity-0" : "opacity-100"}`}
          >
            {label}
          </span>
        )}
      </span>
    </button>
  );
}
