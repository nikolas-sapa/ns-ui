"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Press-and-hold destructive action: a ring traces the border while held,
// drains back if released early, confirms when it closes. Ring uses the
// semantic error color — this is for destructive actions.
export function HoldToConfirm({
  children,
  confirmedLabel = "Done",
  holdMs = 1200,
  onConfirm,
  className = "",
}: {
  children: ReactNode;
  confirmedLabel?: ReactNode;
  holdMs?: number;
  onConfirm?: () => void;
  className?: string;
}) {
  const ringRef = useRef<SVGRectElement>(null);
  const [confirmed, setConfirmed] = useState(false);
  const state = useRef({ progress: 0, holding: false, raf: 0, last: 0, done: false });

  useEffect(() => {
    const s = state.current;
    return () => cancelAnimationFrame(s.raf);
  }, []);

  const render = () => {
    if (ringRef.current) {
      ringRef.current.style.strokeDashoffset = String(100 - state.current.progress * 100);
    }
  };

  const tick = (now: number) => {
    const s = state.current;
    const dt = now - s.last;
    s.last = now;
    // fill while held, drain at 2.5x when released
    s.progress += s.holding ? dt / holdMs : (-dt / holdMs) * 2.5;
    s.progress = Math.max(0, Math.min(1, s.progress));
    render();
    if (s.progress >= 1 && !s.done) {
      s.done = true;
      setConfirmed(true);
      onConfirm?.();
      return;
    }
    if ((s.holding || s.progress > 0) && !s.done) {
      s.raf = requestAnimationFrame(tick);
    }
  };

  const start = () => {
    const s = state.current;
    if (s.done) return;
    s.holding = true;
    s.last = performance.now();
    cancelAnimationFrame(s.raf);
    s.raf = requestAnimationFrame(tick);
  };
  const stop = () => {
    state.current.holding = false;
  };

  return (
    <button
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") stop();
      }}
      className={[
        "relative inline-flex select-none items-center justify-center rounded-sm border border-border bg-surface px-5 py-2.5 text-sm font-medium text-foreground",
        "hover:border-muted/60 hover:brightness-110",
        "transition-[transform,border-color,filter] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-[0.98]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        confirmed ? "scale-[1.02]" : "",
        className,
      ].join(" ")}
    >
      <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
        <rect
          ref={ringRef}
          x="1"
          y="1"
          rx="6"
          pathLength={100}
          style={{
            width: "calc(100% - 2px)",
            height: "calc(100% - 2px)",
            fill: "none",
            stroke: "var(--error, #ea001d)",
            strokeWidth: 2,
            strokeDasharray: 100,
            strokeDashoffset: 100,
            strokeLinecap: "round",
          }}
        />
      </svg>
      <span className="relative">{confirmed ? confirmedLabel : children}</span>
    </button>
  );
}
