"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

// ---------------------------------------------------------------------------
// TachoDisc — a day of security activity (sign-ins, permission grants,
// revocations) drawn as one polar disc: 24 hours mapped to 360 degrees under
// a fixed stylus at 12 o'clock, every event scribed at its true time-of-day
// angle. Radius encodes category (sign-ins outer, grants middle, revocations
// inner, the last drawn as a punched hole rather than a line). Older days sit
// behind as smaller, dimmer discs sharing the same rotation, so the same
// time-of-day lines up radially across nights. A faint hour graduation —
// ticks every hour, numerals at 00/06/12/18 — shares that same rotation
// rather than sitting fixed under the stylus, so a tick always sits at its
// own true hour angle and reads as chart paper under the event ink.
//
// ONE governing scalar drives the whole disc: `discAngle`, the real
// time-of-day angle of "now". Every mark's screen position is its true
// timestamp angle plus that single rotation — nothing is laid out by index,
// so a credential-stuffing run (many failures seconds apart) piles into a
// visibly dense arc instead of being spread evenly like ordinary traffic.
// That's the whole point: even-spacing-by-index would hide exactly the
// pattern this exists to show.
//
// The disc is an index onto a real list, not a decoration standing alone:
// - The event list (time / actor / action / result, all text) is the primary
//   semantic surface. All disc marks are aria-hidden.
// - Hovering or arrow-stepping a list row rotates a faint sector highlight to
//   that event's angle on the disc.
// - The disc itself is role="slider": dragging it (or arrowing it while
//   focused, event-to-event, not minute-by-minute) finds the nearest event
//   and scrolls the list to it, updating aria-valuetext with a live readout.
// - Live-arriving failures draw in with a 90ms scribe and announce through a
//   single coalesced aria-live region ("N failed sign-ins in the last
//   minute"), never one announcement per mark. A revocation is a true hole
//   (background fill + border ring) that appears whole in one frame — no
//   scribe, it isn't an arrival, it's an absence.
// ---------------------------------------------------------------------------

export interface SecurityEvent {
  id: string;
  /** ms since epoch */
  time: number;
  category: "sign-in" | "grant" | "revocation";
  actor: string;
  action: string;
  result: "success" | "failed" | "revoked";
}

export interface TachoDiscProps {
  /** every event in the visible window — today plus however many prior days feed the dimmer stacked discs. */
  events: SecurityEvent[];
  /** how many prior days render as dimmer discs behind today's. Default 2. */
  historyDays?: number;
  /** current instant; defaults to an internally ticking clock. Pass to control/test. */
  now?: number;
  /** accessible label stem, e.g. "Security activity". */
  label?: string;
  className?: string;
}

const DAY_MS = 86_400_000;
const MIN_PER_DAY = 1440;

const BANDS: Record<SecurityEvent["category"], { r: number; seg: number }> = {
  "sign-in": { r: 118, seg: 15 },
  grant: { r: 87, seg: 13 },
  revocation: { r: 55, seg: 0 },
};
const CX = 140;
const CY = 140;
const DISC_R = 132;
const HOLE_R = 5;

// hour graduation — chart paper under the event ink, drawn once at true,
// unrotated hour angles and sharing the same group rotation as every event
// mark (see discAngle below): a tick sits exactly where a same-hour event
// would land, at every rotation, not just when "now" happens to be that
// hour. Faint minor ticks every hour, a slightly longer major tick plus a
// numeral at the four cardinal hours.
const GRAD_R_OUTER = DISC_R;
const GRAD_R_MINOR = DISC_R - 4;
const GRAD_R_MAJOR = DISC_R - 8;
const GRAD_LABEL_R = DISC_R + 11;
const HOUR_TICKS = Array.from({ length: 24 }, (_, h) => ({
  hour: h,
  angle: (h / 24) * 360,
  major: h % 6 === 0,
}));

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function minutesOfDay(ms: number): number {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

function angleForMs(ms: number): number {
  return (minutesOfDay(ms) / MIN_PER_DAY) * 360;
}

function polar(r: number, angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CX + r * Math.sin(rad), y: CY - r * Math.cos(rad) };
}

function angDist(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function formatClock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function nearbyFailedCount(events: SecurityEvent[], atMinutes: number, windowMin: number): number {
  let n = 0;
  for (const e of events) {
    if (e.result !== "failed") continue;
    if (angDist((minutesOfDay(e.time) / MIN_PER_DAY) * 360, (atMinutes / MIN_PER_DAY) * 360) <= (windowMin / MIN_PER_DAY) * 360) {
      n++;
    }
  }
  return n;
}

// -- draw-in mark for a live-arriving failure: undrawn -> drawn over 90ms,
// via an imperative stroke-dashoffset transition (never React state on the
// per-mark hot path, matching the ref-write idiom used across the registry).
function ScribeLine({
  x1,
  y1,
  x2,
  y2,
  live,
  reduced,
  width,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  live: boolean;
  reduced: boolean;
  width: number;
}) {
  const ref = useRef<SVGLineElement | null>(null);
  const scribedRef = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !live || reduced || scribedRef.current) return;
    scribedRef.current = true;
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    el.style.strokeDasharray = `${len}`;
    el.style.strokeDashoffset = `${len}`;
    const id = requestAnimationFrame(() => {
      el.style.transition = "stroke-dashoffset 90ms ease-out";
      el.style.strokeDashoffset = "0";
    });
    return () => cancelAnimationFrame(id);
  }, [live, reduced, x1, y1, x2, y2]);
  return <line ref={ref} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--foreground)" strokeWidth={width} strokeLinecap="round" />;
}

export function TachoDisc({ events, historyDays = 2, now: controlledNow, label = "Security activity", className = "" }: TachoDiscProps) {
  const [internalNow, setInternalNow] = useState(() => Date.now());
  const nowMs = controlledNow ?? internalNow;

  const reducedRef = useRef(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    setReduced(mq.matches);
    const onChange = () => {
      reducedRef.current = mq.matches;
      setReduced(mq.matches);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (controlledNow !== undefined) return;
    const id = window.setInterval(() => setInternalNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, [controlledNow]);

  const todayStart = useMemo(() => startOfDay(nowMs), [nowMs]);

  // group by day offset (0 = today) once; drawn oldest-first so today paints on top.
  const layers = useMemo(() => {
    const byOffset = new Map<number, SecurityEvent[]>();
    for (const e of events) {
      const offset = Math.floor((todayStart - startOfDay(e.time)) / DAY_MS);
      if (offset < 0 || offset > historyDays) continue;
      const arr = byOffset.get(offset) ?? [];
      arr.push(e);
      byOffset.set(offset, arr);
    }
    const out: { offset: number; events: SecurityEvent[] }[] = [];
    for (let o = historyDays; o >= 0; o--) {
      out.push({ offset: o, events: (byOffset.get(o) ?? []).slice().sort((a, b) => a.time - b.time) });
    }
    return out;
  }, [events, todayStart, historyDays]);

  const todayEvents = layers[layers.length - 1]?.events ?? [];

  // -- shared index: the disc IS the list's index, not a separate widget --
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [tabStop, setTabStop] = useState(0);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const scrollToIndex = useCallback((i: number, immediate = false) => {
    itemRefs.current[i]?.scrollIntoView({
      block: "nearest",
      behavior: reducedRef.current || immediate ? "auto" : "smooth",
    });
  }, []);

  // -- live arrivals: track which ids have been seen so only genuinely new
  // failure marks scribe in; the initial mount never animates. --
  const seenIdsRef = useRef<Set<string> | null>(null);
  const [liveIds, setLiveIds] = useState<Set<string>>(new Set());
  const [liveMessage, setLiveMessage] = useState("");
  const pendingFailuresRef = useRef(0);
  const announceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announceParityRef = useRef(false);

  useEffect(() => {
    const seen = seenIdsRef.current;
    if (seen === null) {
      seenIdsRef.current = new Set(events.map((e) => e.id));
      return;
    }
    const fresh: string[] = [];
    for (const e of events) {
      if (!seen.has(e.id)) {
        seen.add(e.id);
        fresh.push(e.id);
        if (e.result === "failed") pendingFailuresRef.current += 1;
      }
    }
    if (fresh.length > 0) {
      setLiveIds((prev) => {
        const next = new Set(prev);
        for (const id of fresh) next.add(id);
        return next;
      });
    }
    // clear-and-reschedule: every arrival pushes the window out, so one burst
    // (however long it runs) resolves to exactly one announcement, not one
    // per arrival and not a truncated first window plus a trailing one.
    if (pendingFailuresRef.current > 0) {
      if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
      announceTimerRef.current = setTimeout(() => {
        const n = pendingFailuresRef.current;
        pendingFailuresRef.current = 0;
        announceTimerRef.current = null;
        // a zero-width toggle forces a real text-node change even when the
        // message repeats verbatim across bursts — that's what actually
        // re-triggers the announcement (see autosave-ratchet).
        announceParityRef.current = !announceParityRef.current;
        setLiveMessage(`${n} failed sign-in${n === 1 ? "" : "s"} in the last minute${announceParityRef.current ? "​" : ""}`);
      }, 700);
    }
  }, [events]);

  useEffect(() => {
    return () => {
      if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
    };
  }, []);

  const discAngle = useMemo(() => -angleForMs(nowMs), [nowMs]);

  const activeEvent = activeIndex !== null ? todayEvents[activeIndex] : undefined;

  const failuresLastHour = useMemo(() => nearbyFailedCount(todayEvents, minutesOfDay(nowMs), 60), [todayEvents, nowMs]);

  const valueNow = activeEvent ? Math.round(minutesOfDay(activeEvent.time)) : Math.round(minutesOfDay(nowMs));
  const valueText = activeEvent
    ? scrubbing
      ? `scrubbing ${formatClock(activeEvent.time)}, ${nearbyFailedCount(todayEvents, minutesOfDay(activeEvent.time), 30)} failed sign-ins nearby`
      : `${formatClock(activeEvent.time)}, ${activeEvent.actor}, ${activeEvent.action}, ${activeEvent.result}`
    : `now ${formatClock(nowMs)}, ${failuresLastHour} failed sign-in${failuresLastHour === 1 ? "" : "s"} in the last hour`;

  const setActive = useCallback(
    (i: number | null, scroll = true, immediate = false) => {
      setActiveIndex(i);
      if (i !== null && scroll) scrollToIndex(i, immediate);
    },
    [scrollToIndex]
  );

  const nearestIndexAtAngle = useCallback(
    (screenAngle: number, radius: number) => {
      if (todayEvents.length === 0) return null;
      const trueAngle = (((screenAngle - discAngle) % 360) + 360) % 360;
      let bestCategory: SecurityEvent["category"] = "sign-in";
      let bestDr = Infinity;
      (Object.keys(BANDS) as SecurityEvent["category"][]).forEach((cat) => {
        const dr = Math.abs(radius - BANDS[cat].r);
        if (dr < bestDr) {
          bestDr = dr;
          bestCategory = cat;
        }
      });
      let candidates = todayEvents.map((e, i) => ({ e, i })).filter(({ e }) => e.category === bestCategory);
      if (candidates.length === 0) candidates = todayEvents.map((e, i) => ({ e, i }));
      let best = candidates[0]!;
      let bestDist = Infinity;
      for (const c of candidates) {
        const d = angDist(angleForMs(c.e.time), trueAngle);
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      return best.i;
    },
    [todayEvents, discAngle]
  );

  // The interactive box: role="slider" and every pointer/keyboard handler
  // live on this plain <div>, not the <svg> — a focus-visible outline on an
  // SVG root is unverifiable across browsers, so the SVG below is purely
  // aria-hidden decoration sized to fill this box.
  const discBoxRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const angleFromPointer = (clientX: number, clientY: number) => {
    const rect = discBoxRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const scale = 280 / rect.width;
    const x = (clientX - rect.left) * scale - CX;
    const y = (clientY - rect.top) * scale - CY;
    let deg = (Math.atan2(x, -y) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    return { deg, radius: Math.hypot(x, y) };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    discBoxRef.current?.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setScrubbing(true);
    const p = angleFromPointer(e.clientX, e.clientY);
    if (p) {
      const idx = nearestIndexAtAngle(p.deg, p.radius);
      if (idx !== null) setActive(idx, true, true);
    }
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    // live hover preview (not just active drags) — the disc is an index, so
    // sweeping it with the pointer should rotate the highlight the same way
    // hovering the list does, even before a drag starts. But a hover sweep
    // (not dragging) must only move the highlight, never re-target the list's
    // scroll position on every ~30Hz sample — only an actual drag scrolls,
    // and it scrolls immediately (no smooth re-target chase mid-gesture).
    const p = angleFromPointer(e.clientX, e.clientY);
    if (p) {
      const idx = nearestIndexAtAngle(p.deg, p.radius);
      if (idx !== null) setActive(idx, draggingRef.current, true);
    }
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setScrubbing(false);
    discBoxRef.current?.releasePointerCapture(e.pointerId);
  };

  const onDiscKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (todayEvents.length === 0) return;
    const step = (delta: number) => {
      e.preventDefault();
      const base = activeIndex ?? 0;
      const next = clamp(base + delta, 0, todayEvents.length - 1);
      setActive(next);
    };
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowDown":
        step(-1);
        break;
      case "ArrowRight":
      case "ArrowUp":
        step(1);
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(todayEvents.length - 1);
        break;
      default:
        break;
    }
  };

  const onListKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>, i: number) => {
    const move = (next: number) => {
      e.preventDefault();
      const clamped = clamp(next, 0, todayEvents.length - 1);
      setTabStop(clamped);
      setActiveIndex(clamped);
      itemRefs.current[clamped]?.focus();
    };
    switch (e.key) {
      case "ArrowDown":
        move(i + 1);
        break;
      case "ArrowUp":
        move(i - 1);
        break;
      case "Home":
        move(0);
        break;
      case "End":
        move(todayEvents.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div className={`flex flex-col gap-6 sm:flex-row sm:items-start ${className}`}>
      <style>{CSS}</style>

      <div
        ref={discBoxRef}
        data-tacho-disc=""
        role="slider"
        tabIndex={0}
        aria-label={`${label} disc`}
        aria-valuemin={0}
        aria-valuemax={MIN_PER_DAY - 1}
        aria-valuenow={valueNow}
        aria-valuetext={valueText}
        className="ns-tacho-disc h-64 w-64 shrink-0 touch-none select-none rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ns-accent"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onDiscKeyDown}
      >
      <svg viewBox="-16 -16 312 312" aria-hidden="true" className="block h-full w-full">
        <circle cx={CX} cy={CY} r={DISC_R} fill="none" stroke="var(--border)" strokeWidth={1} aria-hidden="true" />

        {/* fixed stylus at 12 o'clock — outside the rotating group, never moves */}
        <g aria-hidden="true">
          <polygon points={`${CX - 5},4 ${CX + 5},4 ${CX},15`} fill="var(--foreground)" />
          <line x1={CX} y1={15} x2={CX} y2={28} stroke="var(--foreground)" strokeWidth={2} />
        </g>

        {/* the one governing scalar: discAngle. every layer below shares this rotation. */}
        <g transform={`rotate(${discAngle} ${CX} ${CY})`} className={reduced ? "" : "ns-tacho-rotate"} aria-hidden="true">
          {/* hour graduation — chart paper, drawn under the event ink and rotating
              with it so a tick always sits at its own true hour angle. */}
          <g>
            {HOUR_TICKS.map(({ hour, angle, major }) => {
              const inner = polar(major ? GRAD_R_MAJOR : GRAD_R_MINOR, angle);
              const outer = polar(GRAD_R_OUTER, angle);
              return (
                <g key={hour}>
                  <line
                    x1={inner.x}
                    y1={inner.y}
                    x2={outer.x}
                    y2={outer.y}
                    stroke="var(--ns-muted)"
                    strokeWidth={major ? 1 : 0.5}
                    strokeOpacity={major ? 0.6 : 0.35}
                  />
                  {major && (
                    <g transform={`rotate(${-discAngle} ${polar(GRAD_LABEL_R, angle).x} ${polar(GRAD_LABEL_R, angle).y})`}>
                      <text
                        x={polar(GRAD_LABEL_R, angle).x}
                        y={polar(GRAD_LABEL_R, angle).y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="var(--ns-muted)"
                        fontSize={9}
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {String(hour).padStart(2, "0")}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>

          {layers.map(({ offset, events: dayEvents }) => {
            const isToday = offset === 0;
            const layerScale = 1 - offset * 0.13;
            const opacity = isToday ? 1 : Math.max(0.16, 0.5 - offset * 0.15);
            return (
              <g key={offset} opacity={opacity}>
                {dayEvents.map((ev) => {
                  const angle = angleForMs(ev.time);
                  if (ev.category === "revocation") {
                    const r = BANDS.revocation.r * layerScale;
                    const p = polar(r, angle);
                    return (
                      <circle
                        key={ev.id}
                        cx={p.x}
                        cy={p.y}
                        r={HOLE_R * layerScale}
                        fill="var(--background)"
                        stroke="var(--border)"
                        strokeWidth={1.5}
                      />
                    );
                  }
                  const band = BANDS[ev.category];
                  const r = band.r * layerScale;
                  const seg = band.seg * layerScale;
                  const p1 = polar(r - seg / 2, angle);
                  const p2 = polar(r + seg / 2, angle);
                  const failed = ev.result === "failed";
                  if (isToday && failed) {
                    return (
                      <ScribeLine
                        key={ev.id}
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        width={8}
                        live={liveIds.has(ev.id)}
                        reduced={reduced}
                      />
                    );
                  }
                  return (
                    <line
                      key={ev.id}
                      x1={p1.x}
                      y1={p1.y}
                      x2={p2.x}
                      y2={p2.y}
                      stroke="var(--foreground)"
                      strokeWidth={failed ? 8 : 3}
                      strokeLinecap="round"
                    />
                  );
                })}
                {isToday && activeEvent && (
                  <line
                    x1={CX}
                    y1={CY}
                    x2={polar(DISC_R - 4, angleForMs(activeEvent.time)).x}
                    y2={polar(DISC_R - 4, angleForMs(activeEvent.time)).y}
                    stroke="var(--ns-accent)"
                    strokeWidth={16}
                    strokeOpacity={0.1}
                    strokeLinecap="round"
                  />
                )}
              </g>
            );
          })}
        </g>
      </svg>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-medium text-foreground">{label}</h3>
          <span className="font-mono text-xs tabular-nums text-ns-muted">last 24h · now {formatClock(nowMs)}</span>
        </div>

        <ul
          role="list"
          aria-label={`${label} events, last 24 hours`}
          className="ns-tacho-list flex max-h-72 flex-col gap-1 overflow-y-auto rounded-[12px] border border-border bg-background p-1"
        >
          {todayEvents.length === 0 && <li className="px-3 py-4 text-sm text-ns-muted">No activity in the last 24 hours.</li>}
          {todayEvents.map((ev, i) => {
            const isActive = activeIndex === i;
            return (
              <li key={ev.id}>
                <button
                  type="button"
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  tabIndex={tabStop === i ? 0 : -1}
                  aria-current={isActive ? "true" : undefined}
                  aria-label={`${formatClock(ev.time)}, ${ev.actor}, ${ev.action}, ${ev.result}`}
                  className={`ns-tacho-row flex w-full items-center gap-3 rounded-[6px] px-2 py-1.5 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent ${
                    isActive ? "ns-tacho-row-active" : ""
                  }`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => {
                    setTabStop(i);
                    setActiveIndex(i);
                  }}
                  onKeyDown={(e) => onListKeyDown(e, i)}
                >
                  <span aria-hidden="true" className="w-3 shrink-0 text-center text-foreground">
                    {isActive ? "›" : ""}
                  </span>
                  <time className={`w-12 shrink-0 font-mono text-xs tabular-nums text-ns-muted ${isActive ? "font-semibold" : ""}`}>
                    {formatClock(ev.time)}
                  </time>
                  <span className={`w-44 shrink-0 truncate text-foreground ${isActive ? "font-semibold" : ""}`}>{ev.actor}</span>
                  <span className="min-w-0 flex-1 truncate text-ns-muted">{ev.action}</span>
                  <span
                    className={`shrink-0 font-mono text-xs uppercase tracking-wide ${
                      ev.result === "failed" ? "text-foreground" : "text-ns-muted"
                    }`}
                  >
                    {ev.result}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {liveMessage}
        </div>
      </div>
    </div>
  );
}

const CSS = `
.ns-tacho-rotate{ transition: transform 60s linear; }
.ns-tacho-row-active{ background-color: var(--border); }
@media (prefers-reduced-motion: reduce){
  .ns-tacho-rotate{ transition: none !important; }
}
`;
