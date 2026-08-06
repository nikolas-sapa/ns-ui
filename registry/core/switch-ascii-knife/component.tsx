"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// ThrowSwitch — an accessible switch drawn entirely in box-drawing and block
// characters, in the register of a physical knife switch: `[━━━●──]` style,
// where the filled run is the blade already thrown from its left-hand pivot
// up to the handle knob, and the rest of the track is open (unthrown) rail.
// The throw animates one cell of that run at a time (never a slide), and the
// handle glyph itself cycles through a short rotation sequence while it is
// mid-transit, settling to a solid circle the instant it lands on a cell.
// A printed OFF / ON legend sits in the same font-mono row, flanking the
// track, brightened on whichever side is currently active.
// ---------------------------------------------------------------------------

const CELLS = 6; // interior track cells, excluding the brackets
const BEAT_MS = 70; // ms per cell the blade advances
const HEAVY = "━";
const LIGHT = "─";
const SETTLED = "●";
const ROT = ["◐", "◓", "◑", "◒"];

export interface ThrowSwitchProps {
  /** controlled state; omit for uncontrolled */
  checked?: boolean;
  /** uncontrolled initial state. Default false. */
  defaultChecked?: boolean;
  /** called with the new state after a toggle */
  onCheckedChange?: (checked: boolean) => void;
  /** blocks the switch */
  disabled?: boolean;
  /** extra classes merged onto the rendered root element */
  className?: string;
  /** accessible name for the switch */
  "aria-label"?: string;
}

export function ThrowSwitch({
  checked,
  defaultChecked = false,
  onCheckedChange,
  disabled = false,
  className = "",
  "aria-label": ariaLabel = "Toggle",
}: ThrowSwitchProps) {
  const cellRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const posRef = useRef(0); // current handle cell, 0..CELLS-1
  const mountedRef = useRef(false);

  const isControlled = checked !== undefined;
  const [internal, setInternal] = useState(defaultChecked);
  const isChecked = isControlled ? checked : internal;

  const render = (pos: number, settled: boolean, rotFrame: string | null) => {
    for (let i = 0; i < CELLS; i++) {
      const el = cellRefs.current[i];
      if (!el) continue;
      if (i < pos) {
        el.textContent = HEAVY;
        el.className = "text-foreground";
      } else if (i === pos) {
        el.textContent = settled ? SETTLED : rotFrame ?? SETTLED;
        el.className = "text-foreground font-semibold";
      } else {
        el.textContent = LIGHT;
        el.className = "text-ns-muted";
      }
    }
  };

  useEffect(() => {
    const target = isChecked ? CELLS - 1 : 0;

    if (!mountedRef.current) {
      mountedRef.current = true;
      posRef.current = target;
      render(target, true, null);
      return;
    }

    if (posRef.current === target) {
      render(target, true, null);
      return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      posRef.current = target;
      render(target, true, null);
      return;
    }

    const start = posRef.current;
    const dir = target > start ? 1 : -1;
    const totalSteps = Math.abs(target - start);
    const totalMs = totalSteps * BEAT_MS;
    const startTime = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const stepFloat = Math.min(totalSteps, elapsed / BEAT_MS);
      const stepIndex = Math.floor(stepFloat);
      const currentPos = start + dir * stepIndex;
      const arrived = stepIndex >= totalSteps;
      const within = stepFloat - stepIndex;
      const rotFrame = arrived ? null : ROT[Math.floor(within * ROT.length) % ROT.length]!;
      render(currentPos, arrived, rotFrame);
      if (elapsed < totalMs) {
        raf = requestAnimationFrame(tick);
      } else {
        posRef.current = target;
        render(target, true, null);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isChecked]);

  const toggle = () => {
    if (disabled) return;
    const next = !isChecked;
    if (!isControlled) setInternal(next);
    onCheckedChange?.(next);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isChecked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={toggle}
      className={`group inline-flex items-center gap-2 rounded-sm px-1.5 py-0.5 font-mono text-sm tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ns-accent ${
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:bg-surface"
      } ${className}`}
    >
      <span aria-hidden="true" className={isChecked ? "text-ns-muted" : "text-foreground font-semibold"}>
        OFF
      </span>
      <span
        aria-hidden="true"
        className="text-foreground transition-colors group-hover:text-ns-accent"
      >
        [
        {Array.from({ length: CELLS }).map((_, i) => (
          <span
            key={i}
            ref={(el) => {
              cellRefs.current[i] = el;
            }}
          />
        ))}
        ]
      </span>
      <span aria-hidden="true" className={isChecked ? "text-foreground font-semibold" : "text-ns-muted"}>
        ON
      </span>
    </button>
  );
}
