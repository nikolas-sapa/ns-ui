"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// DashpotLatch — destructive-action confirm gated on gesture VELOCITY, not
// press duration. The handle never tracks the pointer's absolute position;
// it only integrates the pointer's velocity through a simulated viscous
// damper: handleVelocity = min(pointerVelocity, vMax), so a flick (fast
// motion, released almost immediately) only ever earns a sliver of progress
// before it oozes back home, and a mid-drag yank (instantaneous speed past
// 3x vMax) actively BLEEDS progress backward at oozeRate even while still
// held down. Only a slow, sustained pull — velocity capped, never exceeding
// the overspeed threshold, sustained until the fill saturates and holds for
// a final 200ms — commits. That is the whole distinguishing idea versus a
// hold-to-confirm control: this gates on the velocity profile of a MOVING
// gesture (same distance, covered fast, fails; covered slowly, succeeds),
// not on how long a static press is held.
//
// The keyboard path mirrors the same gate rather than sidestepping it: hold
// Enter/Space for kbHoldMs (default 1500ms) with a visible countdown ring;
// releasing early recoils exactly like an under-speed pointer release, so
// repeated tapping just keeps resetting the ring. A polite aria-live region
// announces 25/50/75% crossings — the drag/hold physics is a layer on top
// of one real <button>, so screen reader users get plain progress text
// against an ordinary control, not a shape they can't perceive.
//
// Direct-DOM on the hot path (handle transform, fill width/color, ring
// dashoffset) written once per rAF tick; React state only changes at the
// confirmed transition. prefers-reduced-motion keeps the velocity gate
// itself (it is the safety mechanism, not decoration) and only drops the
// overspeed shudder.
// ---------------------------------------------------------------------------

const V_MAX_DEFAULT = 80; // px/s — the damper's speed ceiling
const OOZE_DEFAULT = 40; // px/s — recoil / bleed-back rate
const OVERSPEED_MULT = 3; // pointer speed above this * vMax bleeds progress
const KB_HOLD_DEFAULT = 1500; // ms — keyboard-hold gate duration
const COMMIT_HOLD_MS = 200; // ms the fill must sit at 100% before it commits
const STALE_MS = 120; // no fresh pointermove sample in this long => velocity 0
const RING_R = 15;
const RING_C = 2 * Math.PI * RING_R;
const ANNOUNCE_STEPS = [25, 50, 75];

type Mode = "idle" | "dragging" | "recoil" | "kbhold";

export interface DashpotLatchProps {
  /** Visible label on the rail while armed. */
  label?: ReactNode;
  /** Replaces the label once the gesture commits. */
  confirmedLabel?: ReactNode;
  /** Accessible name for the handle button; defaults to a string form of `label`. */
  "aria-label"?: string;
  /** Fires once, the instant the 200ms (pointer) or kbHoldMs (keyboard) hold completes. */
  onConfirm?: () => void;
  /** Damper speed ceiling, px/s. */
  vMax?: number;
  /** Recoil / overspeed-bleed rate, px/s. */
  oozeRate?: number;
  /** Keyboard hold-to-confirm duration, ms. */
  kbHoldMs?: number;
  /** Hint copy under the rail; also wired as aria-describedby. */
  hint?: ReactNode;
  className?: string;
}

export function DashpotLatch({
  label = "Delete account",
  confirmedLabel = "Deleted",
  "aria-label": ariaLabelProp,
  onConfirm,
  vMax = V_MAX_DEFAULT,
  oozeRate = OOZE_DEFAULT,
  kbHoldMs = KB_HOLD_DEFAULT,
  hint = "Pull slowly to confirm — quick pulls and yanks ooze back to start.",
  className = "",
}: DashpotLatchProps) {
  const hintId = useId();
  const liveId = useId();
  const railRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const liveRef = useRef<HTMLSpanElement>(null);
  const [confirmed, setConfirmed] = useState(false);

  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;
  const cfgRef = useRef({ vMax, oozeRate, kbHoldMs });
  cfgRef.current = { vMax, oozeRate, kbHoldMs };

  const stateRef = useRef({
    mode: "idle" as Mode,
    p: 0, // progress 0..1, the ONLY thing that decides handle position
    distance: 200, // px — measured span the handle travels (rail - handle width)
    smoothVel: 0, // px/s, EMA of pointer velocity samples
    lastRawX: 0,
    lastRawT: 0,
    lastMoveAt: -Infinity,
    holdMs: 0, // consecutive ms spent pinned at p>=1 (pointer path)
    kbStart: 0,
    shudder: 0,
    announced: 0,
    confirmed: false,
    reduced: false,
    visible: true,
    raf: 0,
    last: 0,
  });

  useEffect(() => {
    const s = stateRef.current;
    const rail = railRef.current;
    const handle = handleRef.current;
    const fill = fillRef.current;
    const ring = ringRef.current;
    if (!rail || !handle || !fill || !ring) return;

    const announce = (text: string) => {
      if (liveRef.current) liveRef.current.textContent = text;
    };

    const render = () => {
      const px = s.p * s.distance;
      const jitter = !s.reduced && s.shudder > 0.002 ? (Math.random() - 0.5) * 2 * 3 * s.shudder : 0;
      handle.style.transform = `translate(${(px + jitter).toFixed(2)}px, -50%)`;
      fill.style.width = `${Math.max(0, Math.min(100, s.p * 100)).toFixed(2)}%`;
      const committed = s.p >= 0.9;
      fill.classList.toggle("bg-accent/60", committed);
      fill.classList.toggle("bg-muted/50", !committed);
      ring.style.strokeDashoffset = `${RING_C * (1 - s.p)}`;
      ring.setAttribute("stroke", committed ? "var(--accent)" : "var(--border)");
    };

    const settle = (mode: Mode) => {
      s.mode = mode;
      s.raf = 0;
      render();
    };

    const commit = () => {
      s.p = 1;
      s.confirmed = true;
      s.mode = "idle";
      render();
      announce(typeof confirmedLabel === "string" ? confirmedLabel : "Confirmed");
      setConfirmed(true);
      onConfirmRef.current?.();
    };

    const maybeAnnounceProgress = () => {
      const pct = s.p * 100;
      for (const step of ANNOUNCE_STEPS) {
        if (pct >= step && s.announced < step) {
          s.announced = step;
          announce(`${step}% — keep pulling slowly`);
        }
      }
      if (s.p <= 0.001) s.announced = 0;
    };

    const tick = (now: number) => {
      const rawMs = now - s.last;
      const dtMs = Math.min(64, rawMs);
      s.last = now;
      const dt = dtMs / 1000;
      const { vMax: vm, oozeRate: oz } = cfgRef.current;

      if (s.mode === "dragging") {
        const fresh = now - s.lastMoveAt <= STALE_MS;
        const vel = fresh ? s.smoothVel : 0;
        const overspeed = Math.abs(vel) > vm * OVERSPEED_MULT;
        if (overspeed) {
          s.p -= (oz / s.distance) * dt;
          s.shudder = 1;
          s.holdMs = 0;
        } else {
          const capped = Math.max(-vm, Math.min(vm, vel));
          s.p += (capped / s.distance) * dt;
          s.shudder *= Math.exp(-dt * 10);
        }
        s.p = Math.max(0, Math.min(1, s.p));
        maybeAnnounceProgress();
        if (s.p >= 1) {
          s.holdMs += dtMs;
          if (s.holdMs >= COMMIT_HOLD_MS) {
            commit();
            return;
          }
        } else {
          s.holdMs = 0;
        }
      } else if (s.mode === "recoil") {
        s.p -= (oz / s.distance) * dt;
        s.shudder *= Math.exp(-dt * 10);
        if (s.p <= 0) {
          s.p = 0;
          s.shudder = 0;
          maybeAnnounceProgress();
          render();
          settle("idle");
          return;
        }
        maybeAnnounceProgress();
      } else if (s.mode === "kbhold") {
        const elapsed = now - s.kbStart;
        s.p = Math.max(0, Math.min(1, elapsed / cfgRef.current.kbHoldMs));
        maybeAnnounceProgress();
        if (s.p >= 1) {
          commit();
          return;
        }
      } else {
        render();
        settle("idle");
        return;
      }

      render();
      if (s.visible) {
        s.raf = requestAnimationFrame(tick);
      } else {
        s.raf = 0;
      }
    };

    const wake = () => {
      if (s.raf || !s.visible) return;
      s.last = performance.now();
      s.raf = requestAnimationFrame(tick);
    };

    const startDrag = (clientX: number) => {
      if (s.confirmed) return;
      s.mode = "dragging";
      s.lastRawX = clientX;
      s.lastRawT = performance.now();
      s.lastMoveAt = -Infinity; // no move sample yet this gesture: velocity 0 until one arrives
      s.smoothVel = 0;
      s.holdMs = 0;
      wake();
    };

    const endDrag = () => {
      if (s.mode !== "dragging") return;
      if (s.p > 0) {
        s.mode = "recoil";
      } else {
        s.mode = "idle";
      }
      wake();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (s.confirmed) return;
      handle.setPointerCapture(e.pointerId);
      startDrag(e.clientX);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (s.mode !== "dragging") return;
      const now = performance.now();
      const dtRaw = Math.max(4, now - s.lastRawT);
      const dxRaw = e.clientX - s.lastRawX;
      const inst = (dxRaw / dtRaw) * 1000;
      s.smoothVel = s.smoothVel * 0.65 + inst * 0.35;
      s.lastRawX = e.clientX;
      s.lastRawT = now;
      s.lastMoveAt = now;
    };
    const onPointerEnd = () => endDrag();

    // Blur can interrupt either input path (alt-tab mid-drag, or mid keyboard
    // hold) — treat both the same as a normal early release.
    const onBlur = () => {
      if (s.mode === "dragging") {
        endDrag();
      } else if (s.mode === "kbhold") {
        s.mode = s.p > 0 ? "recoil" : "idle";
        wake();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (s.confirmed) return;
      if ((e.key === "Enter" || e.key === " ") && !e.repeat && s.mode !== "kbhold") {
        e.preventDefault();
        s.mode = "kbhold";
        s.kbStart = performance.now();
        s.holdMs = 0;
        wake();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if ((e.key === "Enter" || e.key === " ") && s.mode === "kbhold") {
        s.mode = s.p > 0 ? "recoil" : "idle";
        wake();
      }
    };

    handle.addEventListener("pointerdown", onPointerDown);
    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", onPointerEnd);
    handle.addEventListener("pointercancel", onPointerEnd);
    handle.addEventListener("lostpointercapture", onPointerEnd);
    handle.addEventListener("keydown", onKeyDown);
    handle.addEventListener("keyup", onKeyUp);
    handle.addEventListener("blur", onBlur);

    const ro = new ResizeObserver(() => {
      const railW = rail.getBoundingClientRect().width;
      const handleW = handle.getBoundingClientRect().width;
      s.distance = Math.max(1, railW - handleW);
      render();
    });
    ro.observe(rail);

    const io = new IntersectionObserver(([entry]) => {
      s.visible = entry.isIntersecting;
      if (s.visible) wake();
      else if (s.raf) {
        cancelAnimationFrame(s.raf);
        s.raf = 0;
      }
    });
    io.observe(rail);

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMq = () => {
      s.reduced = mq.matches;
    };
    onMq();
    mq.addEventListener("change", onMq);

    render();

    return () => {
      cancelAnimationFrame(s.raf);
      s.raf = 0;
      ro.disconnect();
      io.disconnect();
      mq.removeEventListener("change", onMq);
      handle.removeEventListener("pointerdown", onPointerDown);
      handle.removeEventListener("pointermove", onPointerMove);
      handle.removeEventListener("pointerup", onPointerEnd);
      handle.removeEventListener("pointercancel", onPointerEnd);
      handle.removeEventListener("lostpointercapture", onPointerEnd);
      handle.removeEventListener("keydown", onKeyDown);
      handle.removeEventListener("keyup", onKeyUp);
      handle.removeEventListener("blur", onBlur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmedLabel]);

  const accessibleLabel =
    ariaLabelProp ?? (typeof label === "string" ? label : "Confirm destructive action");

  return (
    <div className={["w-full max-w-sm", className].join(" ")}>
      <div
        ref={railRef}
        data-dashpot-rail
        className="relative h-12 w-full select-none rounded-full border border-border bg-background"
      >
        <div
          ref={fillRef}
          aria-hidden
          className="bg-muted/50 absolute inset-y-0 left-0 rounded-full"
          style={{ width: "0%" }}
        />
        <span className="relative z-10 flex h-full select-none items-center justify-center px-4 text-sm font-medium text-foreground">
          {confirmed ? confirmedLabel : label}
        </span>
        <button
          ref={handleRef}
          type="button"
          disabled={confirmed}
          aria-label={confirmed ? `${accessibleLabel} — confirmed` : accessibleLabel}
          aria-describedby={hintId}
          className={[
            "absolute left-0 top-1/2 z-20 flex h-9 w-9 touch-none items-center justify-center",
            "rounded-full border border-border bg-background",
            "hover:border-muted hover:bg-border/40",
            "disabled:pointer-events-none disabled:opacity-60",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          ].join(" ")}
          style={{ transform: "translate(0px, -50%)" }}
        >
          <svg width={36} height={36} viewBox="0 0 36 36" aria-hidden className="pointer-events-none">
            <circle cx={18} cy={18} r={RING_R} fill="none" stroke="var(--border)" strokeWidth={2} />
            <circle
              ref={ringRef}
              cx={18}
              cy={18}
              r={RING_R}
              fill="none"
              stroke="var(--border)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C}
              transform="rotate(-90 18 18)"
            />
          </svg>
        </button>
      </div>
      <p id={hintId} className="mt-2 text-xs text-muted">
        {hint}
      </p>
      <span id={liveId} ref={liveRef} role="status" aria-live="polite" className="sr-only" />
    </div>
  );
}
