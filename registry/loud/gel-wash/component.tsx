"use client";

import { useEffect, useRef, useState } from "react";

// A page preloader built like a stage lantern: three coloured gels stacked in
// front of an opaque blackout, breathing while the page is not ready, then
// pulled off the lantern one at a time when it is. The blackout leaves first,
// so the last thing the visitor sees is coloured light sweeping across real
// content rather than a panel disappearing.
//
// Colour is the point here (this is the loud collection) but it is three fixed
// stage gels, not a palette: blue, cyan, magenta, screened over the background
// token in dark and multiplied in light so both themes stay legible.
const GELS = [
  { color: "#006bff", x: "22%", y: "34%", exit: 720 },
  { color: "#00d4ff", x: "74%", y: "26%", exit: 880 },
  { color: "#ff2fb0", x: "48%", y: "76%", exit: 1040 },
];

const BLACKOUT_EXIT = 560;
const TOTAL = 1040 + 220;

export function GelWash({
  ready,
  minMs = 900,
  label = "Loading",
  onDone,
}: {
  /** flip true when the page's own work is finished */
  ready: boolean;
  /** floor on how long the wash stays up, so a fast load doesn't flash */
  minMs?: number;
  label?: string;
  onDone?: () => void;
}) {
  const [phase, setPhase] = useState<"up" | "leaving" | "gone">("up");
  const mountedAt = useRef(performance.now());

  // Hold until BOTH the caller is ready and the floor has elapsed — a 40ms load
  // that flashes a curtain reads as a bug, not as polish.
  useEffect(() => {
    if (!ready || phase !== "up") return;
    const wait = Math.max(0, minMs - (performance.now() - mountedAt.current));
    const id = window.setTimeout(() => setPhase("leaving"), wait);
    return () => window.clearTimeout(id);
  }, [ready, minMs, phase]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = window.setTimeout(
      () => {
        setPhase("gone");
        onDone?.();
      },
      reduce ? 0 : TOTAL,
    );
    return () => window.clearTimeout(id);
  }, [phase, onDone]);

  // The page behind must not scroll under the wash, and the scrollbar's width
  // is compensated so the layout doesn't jump sideways when the lock releases.
  useEffect(() => {
    if (phase === "gone") return;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevPad = body.style.paddingRight;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPad;
    };
  }, [phase]);

  if (phase === "gone") return null;
  const leaving = phase === "leaving";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={!leaving}
      className="fixed inset-0 z-50 overflow-hidden [@media(prefers-reduced-motion:reduce)]:transition-none"
      style={{ pointerEvents: leaving ? "none" : "auto" }}
    >
      {/* blackout — the only opaque layer, and the first one pulled. The label
          rides it out rather than lingering over content the page owns again. */}
      <div
        className="absolute inset-0 bg-background transition-transform ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none"
        style={{
          transitionDuration: `${BLACKOUT_EXIT}ms`,
          transform: leaving ? "translateY(-100%)" : "translateY(0)",
        }}
      >
        <span className="absolute bottom-8 left-8 font-mono text-[11px] uppercase tracking-[0.2em] text-foreground/70">
          {label}
        </span>
      </div>
      {GELS.map((gel, i) => (
        <div
          key={gel.color}
          aria-hidden
          className="absolute inset-0 mix-blend-multiply transition-transform ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none dark:mix-blend-screen"
          style={{
            transitionDuration: `${gel.exit}ms`,
            transitionDelay: leaving ? `${i * 90}ms` : "0ms",
            transform: leaving ? "translateY(-115%)" : "translateY(0)",
            background: `radial-gradient(60% 55% at ${gel.x} ${gel.y}, ${gel.color} 0%, ${gel.color}00 72%)`,
            // Breathing while it waits: opacity only, so nothing reflows and the
            // three gels drift out of phase with each other.
            animation: leaving ? "none" : `gel-breathe ${2600 + i * 700}ms ease-in-out ${i * 240}ms infinite`,
            opacity: 0.85,
          }}
        />
      ))}
      <style>{`
        @keyframes gel-breathe {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes gel-breathe { 0%, 100% { opacity: 0.85; } }
        }
      `}</style>
    </div>
  );
}
