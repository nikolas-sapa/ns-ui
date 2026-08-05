"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

// ---------------------------------------------------------------------------
// TremorTrace — multi-user typing/presence as a live seismograph strip. One
// row per participant: a hairline SVG polyline that scrolls slowly leftward,
// spiking with amplitude proportional to that person's REAL keystroke
// cadence, decaying flat on pause, ending in a small terminal tick when they
// disconnect. Every number on screen originates from a real event the
// consumer feeds in (pulse() per throttled keystroke, `status` per presence
// update) — this component holds no rhythm of its own, unlike text-ekg-baseline's
// internal bpm timer. It never sees keystroke content, only that one
// occurred, coarse enough it can't leak timing beyond "someone is typing".
//
// Ring buffer: 31 fixed x-slots per row (30 visible + 1 incoming off the
// right edge), ticked every ~200ms (~5Hz). Scrolling is one CSS transform on
// a <g>, not per-frame point recomputation: each tick snaps the group back
// to translateX(0) instantly, shifts the buffer, appends the new sample,
// redraws the polyline's `points` attribute once, then animates
// translateX(-step) over the same 200ms until the next tick — a standard
// treadmill scroll, cheap and GPU-friendly. All of this happens on refs;
// React state only drives row list membership, status styling and the
// announced text.
// ---------------------------------------------------------------------------

export type TremorStatus = "typing" | "idle" | "disconnected";

export interface TremorUser {
  id: string;
  name: string;
  status: TremorStatus;
}

export interface TremorTraceHandle {
  /**
   * Register one throttled keystroke event for a user. Call this from a real
   * input handler — already throttled upstream is fine, this further buckets
   * calls into ~5Hz ticks itself. Never pass keystroke content, only the
   * fact one happened; cadence (count per tick), not timing, is the signal.
   */
  pulse: (userId: string) => void;
}

export interface TremorTraceProps {
  users: TremorUser[];
  className?: string;
}

const POINTS = 30;
const TICK_MS = 200; // ~5Hz sampling
const VIEW_W = 360;
const VIEW_H = 24;
const BASE_Y = VIEW_H / 2;
const AMP_PX = 9; // max spike half-height
const STEP = VIEW_W / POINTS;
const EXPECTED_PULSES = 2; // pulses/tick treated as "fully active" cadence
const RISE = 0.6;
const DECAY = Math.pow(2, -10 * (TICK_MS / 1000)); // ease-out-expo decay per tick

// Distinct fixed opacity per row so several traces are legible without color
// — this repo's token set has no red/green to spend on "who is who".
const OPACITY_STEPS = [1, 0.72, 0.5, 0.34];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function flatPoints() {
  const pts: string[] = [];
  for (let i = 0; i <= POINTS; i++) pts.push(`${(i * STEP).toFixed(2)},${BASE_Y}`);
  return pts.join(" ");
}

interface TraceRowProps {
  name: string;
  status: TremorStatus;
  opacity: number;
  reducedMotion: boolean;
  counterRef: { current: number };
}

function TraceRow({ name, status, opacity, reducedMotion, counterRef }: TraceRowProps) {
  const groupRef = useRef<SVGGElement | null>(null);
  const polylineRef = useRef<SVGPolylineElement | null>(null);
  const markerRef = useRef<SVGLineElement | null>(null);

  const bufferRef = useRef<number[]>(Array(POINTS + 1).fill(0));
  const terminalFlagRef = useRef<number[]>(Array(POINTS + 1).fill(0));
  const ampRef = useRef(0);
  const parityRef = useRef(0);
  const endedRef = useRef(false);
  const statusRef = useRef<TremorStatus>(status);
  statusRef.current = status;

  const draw = () => {
    const poly = polylineRef.current;
    if (poly) {
      let pts = "";
      const buf = bufferRef.current;
      for (let i = 0; i < buf.length; i++) {
        pts += `${(i * STEP).toFixed(2)},${(BASE_Y - buf[i] * AMP_PX).toFixed(2)} `;
      }
      poly.setAttribute("points", pts.trim());
    }
    const marker = markerRef.current;
    if (marker) {
      const flags = terminalFlagRef.current;
      const idx = flags.lastIndexOf(1);
      if (idx === -1) {
        marker.style.opacity = "0";
      } else {
        const x = (idx * STEP).toFixed(2);
        marker.setAttribute("x1", x);
        marker.setAttribute("x2", x);
        marker.style.opacity = "1";
      }
    }
  };

  useEffect(() => {
    draw();
    // reduced motion: freeze flat, no interval at all — legibility never
    // depends on motion running.
    if (reducedMotion) {
      // a disconnected peer still gets its static terminal mark even at rest.
      if (status === "disconnected") {
        terminalFlagRef.current[POINTS] = 1;
        endedRef.current = true;
        draw();
      }
      return;
    }

    const id = setInterval(() => {
      const g = groupRef.current;
      if (!g) return;

      // snap the previous tick's animation back to rest, instantly
      g.style.transition = "none";
      g.style.transform = "translateX(0px)";

      bufferRef.current.shift();
      terminalFlagRef.current.shift();

      let value = 0;
      let flag = 0;

      if (endedRef.current) {
        value = 0; // a peer that has left produces no further cadence
      } else if (statusRef.current === "disconnected") {
        flag = 1; // the small terminal tick, once
        endedRef.current = true;
      } else {
        const count = counterRef.current;
        counterRef.current = 0;
        const target = Math.min(1, count / EXPECTED_PULSES);
        ampRef.current = count > 0 ? lerp(ampRef.current, target, RISE) : ampRef.current * DECAY;
        if (ampRef.current < 0.015) ampRef.current = 0;
        parityRef.current ^= 1;
        const sign = parityRef.current ? 1 : -1;
        const wobble = 0.65 + 0.35 * Math.random();
        value = ampRef.current * sign * wobble;
      }

      bufferRef.current.push(value);
      terminalFlagRef.current.push(flag);
      draw();

      // force reflow so the transition below actually animates from 0
      void g.getBoundingClientRect();
      g.style.transition = `transform ${TICK_MS}ms linear`;
      g.style.transform = `translateX(-${STEP}px)`;
    }, TICK_MS);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion, status]);

  const showTypingTag = reducedMotion && status === "typing";
  const showEndedLabel = status === "disconnected";

  return (
    <div className="flex items-center gap-3" style={{ opacity }}>
      <span
        className={[
          "w-16 shrink-0 truncate font-mono text-[11px]",
          showEndedLabel ? "text-ns-muted" : "text-foreground",
        ].join(" ")}
      >
        {name}
      </span>

      <div
        className="h-4 min-w-0 flex-1"
        style={{
          maskImage: "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
        }}
      >
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          className="h-full w-full text-foreground"
          aria-hidden="true"
        >
          <g ref={groupRef}>
            <polyline
              ref={polylineRef}
              points={flatPoints()}
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <line
              ref={markerRef}
              x1={VIEW_W}
              x2={VIEW_W}
              y1={BASE_Y - AMP_PX}
              y2={BASE_Y + AMP_PX}
              stroke="currentColor"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
              style={{ opacity: 0 }}
            />
          </g>
        </svg>
      </div>

      {showTypingTag ? (
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-ns-muted">
          typing
        </span>
      ) : null}
    </div>
  );
}

export const TremorTrace = forwardRef<TremorTraceHandle, TremorTraceProps>(function TremorTrace(
  { users, className = "" },
  ref
) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const countersRef = useRef<Map<string, { current: number }>>(new Map());
  const prevStatusRef = useRef<Map<string, TremorStatus>>(new Map());

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      pulse(userId: string) {
        const counters = countersRef.current;
        let c = counters.get(userId);
        if (!c) {
          c = { current: 0 };
          counters.set(userId, c);
        }
        c.current += 1;
      },
    }),
    []
  );

  useEffect(() => {
    const prev = prevStatusRef.current;
    let msg = "";
    for (const u of users) {
      const before = prev.get(u.id);
      if (before === undefined) {
        prev.set(u.id, u.status);
        continue; // never announce the initial mount state
      }
      if (before !== u.status) {
        if (u.status === "typing") msg = `${u.name} started typing`;
        else if (u.status === "disconnected") msg = `${u.name} left`;
        else if (u.status === "idle" && before === "typing") msg = `${u.name} stopped`;
        prev.set(u.id, u.status);
      }
    }
    if (msg) setAnnouncement(msg);
  }, [users]);

  function counterFor(id: string) {
    const counters = countersRef.current;
    let c = counters.get(id);
    if (!c) {
      c = { current: 0 };
      counters.set(id, c);
    }
    return c;
  }

  return (
    <div className={["w-full rounded-md border border-border bg-surface p-4", className].join(" ")}>
      <div className="flex flex-col gap-3">
        {users.map((u, i) => (
          <TraceRow
            key={u.id}
            name={u.name}
            status={u.status}
            opacity={OPACITY_STEPS[i % OPACITY_STEPS.length]}
            reducedMotion={reducedMotion}
            counterRef={counterFor(u.id)}
          />
        ))}
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
});
