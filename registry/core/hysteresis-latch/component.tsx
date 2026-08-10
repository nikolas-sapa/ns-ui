"use client";

import { useEffect, useId, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// HysteresisLatch — a toggle with directional memory, modeled on a magnetic
// hysteresis (B-H) loop instead of a bolted-on confirm dialog. A thin SVG
// loop ghosts under the thumb: two logistic branches at --ns-muted ~30%
// opacity, one inflecting at 40% of travel (the ON branch), one at 85% (the
// OFF branch) — the same two fractions the drag mechanics enforce, so the
// decoration explains the asymmetry instead of just decorating it.
//
// Dragging toward ON tracks the pointer ~1:1 and commits the instant it
// crosses the 40% coercive point, then a short, light spring finishes the
// slide. Dragging toward OFF maps the pointer through a concave (sub-linear)
// curve so the thumb visibly "sticks" behind the pointer — real movement,
// small visual response — and only commits once the raw drag has covered
// 85% of the distance, at which point a heavier, slower spring finishes the
// release. Releasing before either threshold relaxes the thumb back along
// whichever branch it was on; nothing commits.
//
// A plain click always turns ON instantly (the cheap direction needs no
// ceremony) but, when already ON, only ARMS the off-intent — a transient
// status badge, no state change — the actual OFF transition still requires
// a completed drag. Keyboard users get the identical asymmetry honestly
// expressed: Space turns ON immediately; Space while ON arms a 3s confirm
// window (aria-live prompts for a confirming Enter), Escape or a timeout
// cancels it. Reduced motion drops both springs and keeps the thresholds —
// commits and relaxes land as instant steps.
//
// Direct-DOM refs for the drag/spring hot path; React state only for
// checked, the armed badge, and the confirm-pending prompt.
// ---------------------------------------------------------------------------

const TRACK_W = 84;
const TRACK_H = 36;
const THUMB = 28;
const INSET = 4;
const TRAVEL = TRACK_W - THUMB - INSET * 2; // 48

const ON_COERCIVE = 0.4;
const OFF_COERCIVE = 0.85;
const OFF_GAMMA = 2.4; // sub-linear "stick" exponent for the OFF drag

const DRAG_SLOP = 4; // px of pointer movement before a press counts as a drag

const SPRING_LIGHT = { k: 260, zeta: 0.78 }; // ON commit — short, light
const SPRING_HEAVY = { k: 55, zeta: 1.05 }; // OFF commit — heavier, slower

const CONFIRM_MS = 3000; // keyboard Space-then-Enter window
const ARM_MS = 3000; // pointer click-to-arm badge lifetime

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// Decorative loop geometry — two logistic branches over a fixed design-space
// viewBox, inflecting at the same fractions as the drag coercive points.
// Computed once at module scope; independent of any instance or resize.
const LOOP_W = 100;
const LOOP_H = 40;
const LOOP_MARGIN = 8;
function sigmoid(t: number, c: number, k: number) {
  return 1 / (1 + Math.exp(-k * (t - c)));
}
function branchPoints(c: number) {
  const pts: string[] = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    const v = sigmoid(t, c, 11);
    const x = t * LOOP_W;
    const y = LOOP_MARGIN + (LOOP_H - 2 * LOOP_MARGIN) * (1 - v);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return pts.join(" ");
}
const LOOP_ON = branchPoints(ON_COERCIVE);
const LOOP_OFF = branchPoints(OFF_COERCIVE);

export interface HysteresisLatchProps {
  /** controlled state; omit for uncontrolled */
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

export function HysteresisLatch({
  checked,
  defaultChecked = false,
  onCheckedChange,
  disabled = false,
  className = "",
  "aria-label": ariaLabel = "Toggle",
}: HysteresisLatchProps) {
  const descId = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);

  const isControlled = checked !== undefined;
  const [internal, setInternal] = useState(defaultChecked);
  const isChecked = isControlled ? checked : internal;
  const checkedRef = useRef(isChecked);
  checkedRef.current = isChecked;

  const [armed, setArmed] = useState(false);
  const [confirmPending, setConfirmPending] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const commitRef = useRef<(next: boolean) => void>(() => {});
  commitRef.current = (next: boolean) => {
    checkedRef.current = next;
    if (!isControlled) setInternal(next);
    onCheckedChange?.(next);
  };

  const engineRef = useRef<{
    dragStart: (clientX: number) => void;
    dragMove: (clientX: number) => void;
    dragEnd: () => boolean; // returns whether the pointer actually moved
    transition: (on: boolean) => void;
  } | null>(null);

  // -- drag / spring engine: direct DOM, refs only, never React state ------
  useEffect(() => {
    const btn = btnRef.current;
    const thumb = thumbRef.current;
    if (!btn || !thumb) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let x = checkedRef.current ? TRAVEL : 0;
    let v = 0;
    let target = x;
    let spring = SPRING_LIGHT;
    let raf = 0;
    let last = 0;
    let current = checkedRef.current; // last boolean the engine has settled toward

    let dragging = false;
    let dragMode: "on" | "off" | null = null;
    let startClientX = 0;
    let moved = false;

    const setX = (px: number) => {
      x = px;
      thumb.style.transform = `translateX(${px.toFixed(2)}px)`;
    };
    setX(x);

    const loop = (now: number) => {
      raf = 0;
      const dt = Math.min(0.032, last ? (now - last) / 1000 : 1 / 60);
      last = now;
      const c = 2 * spring.zeta * Math.sqrt(spring.k);
      v += (-spring.k * (x - target) - c * v) * dt;
      const nx = x + v * dt;
      setX(nx);
      if (Math.abs(nx - target) < 0.15 && Math.abs(v) < 1) {
        setX(target);
        v = 0;
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    const wake = () => {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    const settle = (px: number, sp: typeof SPRING_LIGHT) => {
      target = px;
      spring = sp;
      if (reduced) {
        cancelAnimationFrame(raf);
        raf = 0;
        v = 0;
        setX(px);
        return;
      }
      wake();
    };

    const transition = (on: boolean) => {
      if (on === current) return;
      current = on;
      settle(on ? TRAVEL : 0, on ? SPRING_LIGHT : SPRING_HEAVY);
    };

    const dragStart = (clientX: number) => {
      if (disabledRef.current) return;
      cancelAnimationFrame(raf);
      raf = 0;
      v = 0;
      dragging = true;
      moved = false;
      startClientX = clientX;
      dragMode = checkedRef.current ? "off" : "on";
    };

    const dragMove = (clientX: number) => {
      if (!dragging || disabledRef.current) return;
      if (Math.abs(clientX - startClientX) > DRAG_SLOP) moved = true;
      const rect = btn.getBoundingClientRect();
      const p = clamp01(
        (clientX - rect.left - THUMB / 2) / Math.max(1, TRAVEL)
      );

      if (dragMode === "on") {
        setX(p * TRAVEL);
        if (p >= ON_COERCIVE) {
          dragging = false;
          dragMode = null;
          commitRef.current(true);
        }
      } else if (dragMode === "off") {
        const off = 1 - p;
        const visOff = Math.pow(clamp01(off), OFF_GAMMA);
        setX(TRAVEL * (1 - visOff));
        if (off >= OFF_COERCIVE) {
          dragging = false;
          dragMode = null;
          commitRef.current(false);
        }
      }
    };

    const dragEnd = () => {
      const wasMoved = moved;
      if (dragging) {
        dragging = false;
        // released before threshold — relax back to whichever anchor this
        // drag started from (nothing committed)
        settle(checkedRef.current ? TRAVEL : 0, SPRING_LIGHT);
      }
      dragMode = null;
      return wasMoved;
    };

    engineRef.current = { dragStart, dragMove, dragEnd, transition };

    return () => {
      cancelAnimationFrame(raf);
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.transition(isChecked);
  }, [isChecked]);

  useEffect(
    () => () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      if (armTimerRef.current) clearTimeout(armTimerRef.current);
    },
    []
  );

  const arm = () => {
    setArmed(true);
    if (armTimerRef.current) clearTimeout(armTimerRef.current);
    armTimerRef.current = setTimeout(() => setArmed(false), ARM_MS);
  };
  const clearArm = () => {
    setArmed(false);
    if (armTimerRef.current) {
      clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
    }
  };
  const cancelConfirm = () => {
    setConfirmPending(false);
    if (confirmTimerRef.current) {
      clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = null;
    }
  };

  const suppressClickRef = useRef(false);

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || e.repeat) return;
    if (e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      if (!isChecked) {
        clearArm();
        commitRef.current(true);
      } else {
        setConfirmPending(true);
        if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
        confirmTimerRef.current = setTimeout(
          () => setConfirmPending(false),
          CONFIRM_MS
        );
      }
    } else if (e.key === "Enter") {
      if (isChecked && confirmPending) {
        e.preventDefault();
        cancelConfirm();
        commitRef.current(false);
      }
    } else if (e.key === "Escape") {
      if (confirmPending) {
        e.preventDefault();
        cancelConfirm();
      }
    }
  };

  return (
    <div className={`inline-flex flex-col items-start gap-1.5 ${className}`}>
      <button
        ref={btnRef}
        type="button"
        role="switch"
        aria-checked={isChecked}
        aria-label={ariaLabel}
        aria-describedby={descId}
        disabled={disabled}
        style={{ width: TRACK_W, height: TRACK_H }}
        onPointerDown={(e) => {
          if (disabled) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          engineRef.current?.dragStart(e.clientX);
        }}
        onPointerMove={(e) => engineRef.current?.dragMove(e.clientX)}
        onPointerUp={() => {
          const moved = engineRef.current?.dragEnd() ?? false;
          suppressClickRef.current = moved;
        }}
        onPointerCancel={() => {
          engineRef.current?.dragEnd();
        }}
        onClick={() => {
          if (disabled) return;
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }
          if (!isChecked) {
            clearArm();
            commitRef.current(true);
          } else {
            arm();
          }
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          cancelConfirm();
          clearArm();
        }}
        className={[
          "relative shrink-0 touch-none select-none rounded-full border outline-none",
          "transition-colors duration-200 motion-reduce:transition-none",
          "focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isChecked ? "border-foreground/50" : "border-border",
          "bg-background",
          disabled
            ? "cursor-not-allowed opacity-40"
            : "cursor-pointer hover:border-foreground",
        ].join(" ")}
      >
        <svg
          aria-hidden
          viewBox={`0 0 ${LOOP_W} ${LOOP_H}`}
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          <polyline
            points={LOOP_ON}
            fill="none"
            className="text-ns-muted"
            stroke="currentColor"
            strokeWidth={0.9}
            strokeOpacity={0.3}
          />
          <polyline
            points={LOOP_OFF}
            fill="none"
            className="text-ns-muted"
            stroke="currentColor"
            strokeWidth={0.9}
            strokeOpacity={0.3}
          />
        </svg>
        <span
          ref={thumbRef}
          aria-hidden
          className={[
            "absolute top-1/2 -translate-y-1/2 rounded-full border will-change-transform",
            isChecked
              ? "border-foreground bg-foreground"
              : "border-foreground/70 bg-background",
          ].join(" ")}
          style={{ left: INSET, width: THUMB, height: THUMB }}
        />
      </button>

      {armed ? (
        <span
          data-armed-badge
          role="status"
          className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground"
        >
          Armed — drag the thumb to confirm off
        </span>
      ) : null}

      <p
        id={descId}
        aria-live="polite"
        className="max-w-[16rem] text-xs text-ns-muted"
      >
        {confirmPending
          ? "Press Enter to confirm turning off."
          : "Turning on is instant. Turning off resists — drag past the far edge, or press Space then Enter."}
      </p>
    </div>
  );
}
