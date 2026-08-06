"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

// ---------------------------------------------------------------------------
// ShortFuse — an undo toast whose remaining lifetime IS its border. A 1px
// hairline along the bottom edge is an SVG line whose stroke-dashoffset
// animates linearly from 0 -> 100 (pathLength-normalized) over `duration`, so
// the unburnt portion visibly shortens from the right edge toward the left. A
// 3px ember dot tracks the burn front via a mirrored `left` animation. Both
// run on the Web Animations API so pause/resume is exactly `.pause()`/`.play()`
// — no manual timers to desync, and `.currentTime` stays truthful for free.
//
// Hover or keyboard focus pauses both animations and springs the ember's
// scale down (k=300, zeta=0.7) — a physical pinch, not an invisible timer
// stopping somewhere off-screen. Escape or the fuse running out dismisses.
// Undo reads the current burn progress, cancels the forward animations, and
// plays a reverse pair (same duration/4, ease-out-expo) back to unburnt
// before the toast exits. Colors: --border for the unburnt line, --foreground
// for the ember, --ns-accent only on the Undo button — the toast surface is
// --background with a 1px --border and 12px radius.
//
// prefers-reduced-motion: the line depletes in discrete steps (stepped
// easing, no ember animation at all — it's hidden), and Undo snaps back
// instantly rather than replaying the reverse-burn.
// ---------------------------------------------------------------------------

const EASE_OUT_EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";
const SPRING_K = 300; // s^-2 — ember pinch stiffness
const SPRING_ZETA = 0.7; // damping ratio, slight settle overshoot
const EMBER_REST_SCALE = 1;
const EMBER_PAUSE_SCALE = 0.45;
const EXIT_MS = 180;

type Phase = "burning" | "reversing" | "exiting" | "gone";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function animationElapsedMs(anim: Animation | null): number {
  const ct = anim?.currentTime;
  return typeof ct === "number" ? ct : 0;
}

export interface ShortFuseProps {
  /** The undo-able message, e.g. "Message archived". Required. */
  message: string;
  /** Label on the action button. Default "Undo". */
  actionLabel?: string;
  /** Total fuse life in ms before it auto-dismisses. Default 6000. */
  duration?: number;
  /** Fires once the reverse-burn and exit finish after Undo is pressed. */
  onUndo?: () => void;
  /** Fires once the exit finishes after the fuse burns out, or Escape. */
  onDismiss?: () => void;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function ShortFuse({
  message,
  actionLabel = "Undo",
  duration = 6000,
  onUndo,
  onDismiss,
  className = "",
}: ShortFuseProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<SVGLineElement>(null);
  const emberRef = useRef<HTMLSpanElement>(null);

  const lineAnimRef = useRef<Animation | null>(null);
  const emberAnimRef = useRef<Animation | null>(null);
  const phaseRef = useRef<Phase>("burning");

  // ember spring (rAF), independent of the WAAPI position animation
  const scaleRef = useRef(EMBER_REST_SCALE);
  const scaleVelRef = useRef(0);
  const springTargetRef = useRef(EMBER_REST_SCALE);
  const springRafRef = useRef(0);
  const springLastRef = useRef(0);

  // latest callbacks by ref so the mount effect never needs to re-run when a
  // caller passes a fresh inline function every render
  const onUndoRef = useRef(onUndo);
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onUndoRef.current = onUndo;
  }, [onUndo]);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  const [phase, setPhase] = useState<Phase>("burning");
  const [description, setDescription] = useState(
    () => `Auto-dismisses in ${Math.round(duration / 1000)}s unless undone.`
  );

  const autoId = useId();
  const descId = `sf-desc-${autoId}`;

  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  // -- ember spring loop -----------------------------------------------------
  const wakeSpring = useCallback(() => {
    if (springRafRef.current) return;
    springLastRef.current = performance.now();
    const step = (now: number) => {
      const dt = Math.min(Math.max((now - springLastRef.current) / 1000, 0), 0.032);
      springLastRef.current = now;
      const c = 2 * SPRING_ZETA * Math.sqrt(SPRING_K);
      const target = springTargetRef.current;
      const x = scaleRef.current;
      const v = scaleVelRef.current;
      const a = SPRING_K * (target - x) - c * v;
      const nv = v + a * dt;
      const nx = x + nv * dt;
      scaleRef.current = nx;
      scaleVelRef.current = nv;
      const el = emberRef.current;
      if (el) el.style.transform = `translate(-50%, -50%) scale(${nx})`;
      if (Math.abs(target - nx) > 0.002 || Math.abs(nv) > 0.01) {
        springRafRef.current = requestAnimationFrame(step);
      } else {
        scaleRef.current = target;
        if (el) el.style.transform = `translate(-50%, -50%) scale(${target})`;
        springRafRef.current = 0;
      }
    };
    springRafRef.current = requestAnimationFrame(step);
  }, []);

  // -- exit + settle ----------------------------------------------------------
  const finishExit = useCallback(
    (reason: "undone" | "dismissed") => {
      setPhaseBoth("gone");
      if (reason === "undone") onUndoRef.current?.();
      else onDismissRef.current?.();
    },
    [setPhaseBoth]
  );

  const runExit = useCallback(
    (reason: "undone" | "dismissed") => {
      setPhaseBoth("exiting");
      const root = rootRef.current;
      if (!root || typeof root.animate !== "function") {
        finishExit(reason);
        return;
      }
      const reduced = prefersReducedMotion();
      const anim = root.animate(
        [
          { transform: "translateX(0)", opacity: 1 },
          { transform: "translateX(12px)", opacity: 0 },
        ],
        { duration: reduced ? 1 : EXIT_MS, easing: "ease-out", fill: "forwards" }
      );
      anim.finished.then(() => finishExit(reason)).catch(() => finishExit(reason));
    },
    [finishExit, setPhaseBoth]
  );

  // -- mount: set up the two forward burn animations --------------------------
  useEffect(() => {
    const line = lineRef.current;
    const ember = emberRef.current;
    if (!line) return;
    const reduced = prefersReducedMotion();

    line.style.strokeDasharray = "100";
    line.style.strokeDashoffset = "0";
    const easing = reduced ? "steps(8, end)" : "linear";

    const lineAnim = line.animate(
      [{ strokeDashoffset: "0" }, { strokeDashoffset: "100" }],
      { duration, easing, fill: "forwards" }
    );
    lineAnimRef.current = lineAnim;

    let emberAnim: Animation | null = null;
    if (!reduced && ember) {
      emberAnim = ember.animate([{ left: "100%" }, { left: "0%" }], {
        duration,
        easing,
        fill: "forwards",
      });
      emberAnimRef.current = emberAnim;
    }

    let cancelled = false;
    lineAnim.finished
      .then(() => {
        if (!cancelled && phaseRef.current === "burning") runExit("dismissed");
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      lineAnim.cancel();
      emberAnim?.cancel();
      if (springRafRef.current) {
        cancelAnimationFrame(springRafRef.current);
        springRafRef.current = 0;
      }
    };
    // duration is the only value this timeline actually depends on; onUndo /
    // onDismiss are read from refs (via runExit -> finishExit) so a fresh
    // inline prop from the caller never restarts the burn.
  }, [duration, runExit]);

  // -- pause / resume on hover or focus ----------------------------------------
  const updateDescription = useCallback(
    (paused: boolean) => {
      const remaining = Math.max(
        0,
        Math.round((duration - animationElapsedMs(lineAnimRef.current)) / 1000)
      );
      setDescription(
        paused
          ? `Paused. ${remaining}s remaining unless undone.`
          : `Auto-dismisses in ${remaining}s unless undone.`
      );
    },
    [duration]
  );

  const setPaused = useCallback(
    (paused: boolean) => {
      if (phaseRef.current !== "burning") return;
      if (prefersReducedMotion()) return; // stepped depletion has no pause affordance
      lineAnimRef.current?.[paused ? "pause" : "play"]();
      emberAnimRef.current?.[paused ? "pause" : "play"]();
      springTargetRef.current = paused ? EMBER_PAUSE_SCALE : EMBER_REST_SCALE;
      wakeSpring();
      updateDescription(paused);
    },
    [updateDescription, wakeSpring]
  );

  const handleUndo = useCallback(() => {
    if (phaseRef.current !== "burning") return;
    const reduced = prefersReducedMotion();
    const elapsed = animationElapsedMs(lineAnimRef.current);
    const dashoffsetNow = Math.min(100, Math.max(0, (elapsed / duration) * 100));

    lineAnimRef.current?.cancel();
    emberAnimRef.current?.cancel();
    setPhaseBoth("reversing");

    const line = lineRef.current;
    const ember = emberRef.current;
    const revDuration = reduced ? 1 : Math.max(140, elapsed / 4);
    const revEasing = reduced ? "linear" : EASE_OUT_EXPO;

    const revLine = line?.animate(
      [{ strokeDashoffset: `${dashoffsetNow}` }, { strokeDashoffset: "0" }],
      { duration: revDuration, easing: revEasing, fill: "forwards" }
    );
    if (!reduced && ember) {
      ember.animate(
        [{ left: `${100 - dashoffsetNow}%` }, { left: "100%" }],
        { duration: revDuration, easing: revEasing, fill: "forwards" }
      );
    }
    springTargetRef.current = EMBER_REST_SCALE;
    wakeSpring();

    if (revLine) {
      revLine.finished.then(() => runExit("undone")).catch(() => runExit("undone"));
    } else {
      runExit("undone");
    }
  }, [duration, runExit, setPhaseBoth, wakeSpring]);

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape" && phaseRef.current === "burning") {
        e.stopPropagation();
        lineAnimRef.current?.pause();
        emberAnimRef.current?.pause();
        runExit("dismissed");
      }
    },
    [runExit]
  );

  if (phase === "gone") return null;

  return (
    <div
      ref={rootRef}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-describedby={descId}
      tabIndex={0}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget as Node)) setPaused(false);
      }}
      onKeyDown={handleKeyDown}
      className={`relative w-full max-w-sm overflow-hidden rounded-[12px] border border-border bg-background px-4 py-3 pb-4 text-foreground focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-border ${className}`}
    >
      <div className="flex items-start gap-3">
        <p className="min-w-0 flex-1 text-sm leading-snug">{message}</p>
        <button
          type="button"
          data-toast-undo-fuse-undo=""
          onClick={handleUndo}
          className="shrink-0 cursor-pointer rounded-[6px] px-2 py-1 text-xs font-medium tracking-wide text-ns-accent transition-opacity duration-150 hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        >
          {actionLabel}
        </button>
      </div>

      <span id={descId} className="sr-only">
        {description}
      </span>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] overflow-visible"
      >
        <svg
          className="absolute inset-0 h-full w-full overflow-visible"
          viewBox="0 0 100 3"
          preserveAspectRatio="none"
        >
          <line
            ref={lineRef}
            x1="0"
            y1="1.5"
            x2="100"
            y2="1.5"
            stroke="var(--border)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            pathLength={100}
          />
        </svg>
        <span
          ref={emberRef}
          className="absolute top-1/2 h-[3px] w-[3px] rounded-full bg-foreground motion-reduce:hidden"
          style={{ left: "100%", transform: "translate(-50%, -50%) scale(1)" }}
        />
      </div>
    </div>
  );
}
