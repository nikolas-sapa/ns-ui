"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// TumblerGate — a destructive-action confirm gated on ACCURACY, the third
// axis besides hold-to-confirm's time and slide-to-shatter's distance. An
// SVG dial carries one rotating notch; it must be turned (drag, wheel, or
// arrow keys) until the notch sits within 3deg of the fixed index mark and
// HELD there for a 400ms dwell — leaving the band before the dwell completes
// is a failed catch: the dial springs out to +8deg like a safe tumbler that
// almost caught and slipped. Completing the dwell spring-snaps to exact
// zero, both ticks thicken to --foreground, and the destructive button arms
// (its one legitimate use of --accent). Because fine-motor precision is
// hostile to some users, an always-visible "type to confirm" disclosure
// offers an equivalent path, and two failed catches auto-expand it. Direct-
// DOM writes on the drag/spring hot path, React state only at the rare
// armed/failed/fallback transitions. Zero deps.

const TOL = 3; // deg — dwell capture band around the index mark
const DWELL_MS = 400;
const STEP = 2; // deg per wheel tick / arrow key
const FRICTION = 0.6; // drag angular delta damping
const SLIP_TARGET = 8; // deg — where a failed catch springs out to
const SNAP_K = 260;
const SNAP_ZETA = 0.85; // one tiny overshoot settling to exact zero
const SLIP_K = 380;
const SLIP_ZETA = 0.55; // stiffer, snappier "give"
const SETTLE_EPS = 0.05; // deg
const V_EPS = 0.3; // deg/s
const FORCE_SETTLE_MS = 700;

function wrapDeg(a: number) {
  let r = a % 360;
  if (r > 180) r -= 360;
  if (r <= -180) r += 360;
  return r;
}

export function TumblerGate({
  destructiveLabel = "Delete organization",
  doneLabel = "Deleted",
  confirmWord = "delete",
  initialAngle = 150,
  onConfirm,
  className = "",
}: {
  destructiveLabel?: ReactNode;
  doneLabel?: ReactNode;
  /** word the type-to-confirm fallback checks against, case-insensitive */
  confirmWord?: string;
  /** starting dial offset in degrees from the index mark */
  initialAngle?: number;
  onConfirm?: () => void;
  className?: string;
}) {
  const knobRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const notchGroupRef = useRef<SVGGElement>(null);
  const notchLineRef = useRef<SVGLineElement>(null);
  const indexLineRef = useRef<SVGLineElement>(null);

  const [armed, setArmed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [typedValue, setTypedValue] = useState("");
  const [announcement, setAnnouncement] = useState("");

  const armedRef = useRef(false);
  const confirmedRef = useRef(false);
  const dwellingRef = useRef(false);
  const failedRef = useRef(0);
  const fallbackOpenRef = useRef(false);
  const reducedRef = useRef(false);
  const angleRef = useRef(wrapDeg(initialAngle));
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const animRef = useRef<{
    raf: number;
    mode: "snap" | "slip" | null;
    target: number;
    v: number;
    start: number;
  }>({ raf: 0, mode: null, target: 0, v: 0, start: 0 });

  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;
  const confirmWordRef = useRef(confirmWord);
  confirmWordRef.current = confirmWord;

  // low-level DOM write: transform + native slider value + aria-valuetext.
  // never touches the dwell/slip state machine — safe to call from the
  // spring animation loop as well as the input handlers.
  const render = (angle: number) => {
    notchGroupRef.current?.setAttribute("transform", `rotate(${angle} 100 100)`);
    const input = inputRef.current;
    if (input && Math.round(input.valueAsNumber) !== Math.round(angle)) {
      input.value = String(angle);
    }
    const rounded = Math.round(angle);
    const text = armedRef.current
      ? "Unlocked"
      : `${Math.abs(rounded)} degree${Math.abs(rounded) === 1 ? "" : "s"} from unlocked`;
    input?.setAttribute("aria-valuetext", text);
  };

  const stopAnim = () => {
    if (animRef.current.raf) cancelAnimationFrame(animRef.current.raf);
    animRef.current.raf = 0;
    animRef.current.mode = null;
  };

  const animateTo = (target: number, mode: "snap" | "slip") => {
    stopAnim();
    if (reducedRef.current) {
      angleRef.current = target;
      render(target);
      return;
    }
    const st = animRef.current;
    st.mode = mode;
    st.target = target;
    st.v = 0;
    st.start = performance.now();
    let last = st.start;
    const k = mode === "snap" ? SNAP_K : SLIP_K;
    const zeta = mode === "snap" ? SNAP_ZETA : SLIP_ZETA;
    const c = 2 * zeta * Math.sqrt(k);
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const x = angleRef.current;
      st.v += (k * (target - x) - c * st.v) * dt;
      const nx = x + st.v * dt;
      angleRef.current = nx;
      render(nx);
      const settled = Math.abs(nx - target) < SETTLE_EPS && Math.abs(st.v) < V_EPS;
      const timedOut = now - st.start > FORCE_SETTLE_MS;
      if (settled || timedOut || st.mode !== mode) {
        angleRef.current = target;
        render(target);
        st.raf = 0;
        st.mode = null;
        return;
      }
      st.raf = requestAnimationFrame(step);
    };
    st.raf = requestAnimationFrame(step);
  };

  const arm = (text: string) => {
    if (armedRef.current) return;
    armedRef.current = true;
    setArmed(true);
    setAnnouncement(text);
    if (notchLineRef.current) {
      notchLineRef.current.style.stroke = "var(--foreground)";
      notchLineRef.current.style.strokeWidth = "3";
    }
    if (indexLineRef.current) {
      indexLineRef.current.style.stroke = "var(--foreground)";
      indexLineRef.current.style.strokeWidth = "3";
    }
  };

  const completeDwell = () => {
    dwellingRef.current = false;
    arm("Aligned, delete enabled.");
    animateTo(0, "snap");
  };

  const triggerSlip = () => {
    const n = failedRef.current + 1;
    failedRef.current = n;
    setFailedAttempts(n);
    if (n >= 2 && !fallbackOpenRef.current) {
      fallbackOpenRef.current = true;
      setFallbackOpen(true);
      setAnnouncement("Two failed attempts. Type to confirm is available.");
    }
    animateTo(SLIP_TARGET, "slip");
  };

  // the dial's state machine — dwell start/cancel/complete. Called only
  // from direct user input (drag, wheel, keyboard), never from the spring
  // animation loop.
  const commit = (newAngle: number) => {
    if (armedRef.current) return;
    angleRef.current = newAngle;
    render(newAngle);
    const within = Math.abs(newAngle) <= TOL;
    if (within) {
      if (!dwellingRef.current) {
        dwellingRef.current = true;
        clearTimeout(dwellTimerRef.current);
        dwellTimerRef.current = setTimeout(completeDwell, DWELL_MS);
      }
    } else if (dwellingRef.current) {
      clearTimeout(dwellTimerRef.current);
      dwellingRef.current = false;
      triggerSlip();
    }
  };

  useEffect(() => {
    const knob = knobRef.current;
    const input = inputRef.current;
    if (!knob || !input) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onMq = () => {
      reducedRef.current = mq.matches;
    };
    mq.addEventListener("change", onMq);

    const pointerAngleDeg = (e: PointerEvent) => {
      const r = knob.getBoundingClientRect();
      const rad = Math.atan2(
        e.clientY - (r.top + r.height / 2),
        e.clientX - (r.left + r.width / 2)
      );
      return (rad * 180) / Math.PI;
    };

    let dragging = false;
    let lastDeg = 0;

    const onPointerDown = (e: PointerEvent) => {
      if (armedRef.current) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      try {
        knob.setPointerCapture(e.pointerId);
      } catch {
        // synthetic pointerId — drag still works without capture
      }
      dragging = true;
      stopAnim();
      lastDeg = pointerAngleDeg(e);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging || armedRef.current) return;
      const deg = pointerAngleDeg(e);
      const delta = wrapDeg(deg - lastDeg);
      lastDeg = deg;
      commit(wrapDeg(angleRef.current + delta * FRICTION));
    };
    const onPointerEnd = () => {
      dragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      if (armedRef.current) return;
      e.preventDefault();
      stopAnim();
      const dir = e.deltaY > 0 ? -1 : 1;
      commit(wrapDeg(angleRef.current + dir * STEP));
    };
    const onInput = () => {
      if (armedRef.current) {
        input.value = String(angleRef.current);
        return;
      }
      const v = input.valueAsNumber;
      if (Number.isNaN(v)) return;
      stopAnim();
      commit(wrapDeg(v));
    };

    knob.addEventListener("pointerdown", onPointerDown);
    knob.addEventListener("pointermove", onPointerMove);
    knob.addEventListener("pointerup", onPointerEnd);
    knob.addEventListener("pointercancel", onPointerEnd);
    knob.addEventListener("lostpointercapture", onPointerEnd);
    knob.addEventListener("wheel", onWheel, { passive: false });
    input.addEventListener("input", onInput);

    render(angleRef.current);

    return () => {
      mq.removeEventListener("change", onMq);
      knob.removeEventListener("pointerdown", onPointerDown);
      knob.removeEventListener("pointermove", onPointerMove);
      knob.removeEventListener("pointerup", onPointerEnd);
      knob.removeEventListener("pointercancel", onPointerEnd);
      knob.removeEventListener("lostpointercapture", onPointerEnd);
      knob.removeEventListener("wheel", onWheel);
      input.removeEventListener("input", onInput);
      clearTimeout(dwellTimerRef.current);
      stopAnim();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConfirm = () => {
    if (!armedRef.current || confirmedRef.current) return;
    confirmedRef.current = true;
    setConfirmed(true);
    setAnnouncement("Confirmed.");
    onConfirmRef.current?.();
  };

  const handleTypedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setTypedValue(v);
    if (v.trim().toLowerCase() === confirmWordRef.current.trim().toLowerCase()) {
      arm("Confirmed, delete enabled.");
    }
  };

  return (
    <div className={`flex flex-col items-center gap-6 ${className}`}>
      <div
        ref={knobRef}
        className="tumbler-knob relative h-44 w-44 cursor-grab touch-none select-none rounded-full border border-border bg-surface active:cursor-grabbing focus-within:outline focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-accent"
      >
        <input
          ref={inputRef}
          type="range"
          role="slider"
          min={-180}
          max={180}
          step={STEP}
          defaultValue={angleRef.current}
          aria-label="Alignment dial"
          className="sr-only"
        />
        <svg viewBox="0 0 200 200" aria-hidden className="absolute inset-0 h-full w-full">
          <circle cx={100} cy={100} r={90} fill="none" stroke="var(--border)" strokeWidth={1.5} />
          <line
            ref={indexLineRef}
            x1={100}
            y1={6}
            x2={100}
            y2={26}
            stroke="var(--border)"
            strokeWidth={2}
            strokeLinecap="round"
          />
          <g ref={notchGroupRef} transform={`rotate(${angleRef.current} 100 100)`}>
            <line
              ref={notchLineRef}
              x1={100}
              y1={14}
              x2={100}
              y2={70}
              stroke="var(--border)"
              strokeWidth={2}
              strokeLinecap="round"
            />
          </g>
          <circle cx={100} cy={100} r={5} fill="var(--surface)" stroke="var(--border)" strokeWidth={1.5} />
        </svg>
      </div>

      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <button
        type="button"
        disabled={!armed || confirmed}
        onClick={handleConfirm}
        className={[
          "rounded-sm border px-5 py-2.5 text-sm font-medium transition-colors duration-150",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          "disabled:cursor-not-allowed disabled:opacity-40",
          armed
            ? "border-accent bg-surface text-foreground enabled:hover:bg-border/60"
            : "border-border bg-surface text-muted",
        ].join(" ")}
      >
        {confirmed ? doneLabel : destructiveLabel}
      </button>

      <details
        className="w-full max-w-xs text-center"
        open={fallbackOpen}
        onToggle={(e) => setFallbackOpen(e.currentTarget.open)}
      >
        <summary
          data-tumbler-toggle=""
          className="cursor-pointer select-none font-mono text-xs uppercase tracking-[0.15em] text-muted underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Type to confirm instead
        </summary>
        <div className="mt-3 flex flex-col items-center gap-1.5">
          <label htmlFor="tumbler-confirm-input" className="font-mono text-xs text-muted">
            Type &quot;{confirmWord}&quot; to enable
          </label>
          <input
            id="tumbler-confirm-input"
            data-tumbler-confirm-input=""
            type="text"
            value={typedValue}
            onChange={handleTypedChange}
            autoComplete="off"
            className="w-40 rounded-sm border border-border bg-background px-2 py-1 text-center text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </div>
      </details>

      {failedAttempts > 0 && !armed && (
        <p aria-hidden className="font-mono text-[11px] text-muted">
          {failedAttempts} failed {failedAttempts === 1 ? "attempt" : "attempts"}
        </p>
      )}
    </div>
  );
}
