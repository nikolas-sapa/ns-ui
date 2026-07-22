"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// LockFlight — a wizard stepper built as a flight of canal locks. Each step is
// a chamber (overflow-hidden, flex-1); the current chamber's water sits at
// the top. Advancing means the NEXT chamber's level — a 1px --foreground
// line — climbs to meet it: on a valid attempt it climbs the full way over
// ~600ms ease-out-expo, then (only once the two levels have visibly
// equalized) the shared gate — the chamber's left border, split into two
// halves — parts 4px up/down with a small spring overshoot, and the active
// highlight glides through the opening into the new chamber. That highlight
// is not a straight bar: it's a single SVG route (see buildConnectorPath)
// threaded along the bottom of the whole flight, one continuous --border
// path that dips into a shallow rounded notch at every internal gate and
// curls up around the outer border at the flight's own two ends — Team's
// left edge, Review's right edge — instead of terminating in a flat clipped
// stub. A second copy of that same path, stroked --accent and windowed to
// roughly one chamber's length via stroke-dasharray/dashoffset (normalized
// with pathLength=1), is the actual "you are here" marker: it slides along
// the route exactly one window per step, so at rest it never covers more
// than about one chamber's stretch of pipe — accent stays the sparing,
// current-position signal, --border carries the route's shape everywhere
// else. The whole shape is bounded by its own viewBox (plus an explicit
// overflow-hidden on the <svg> itself), not by a wrapper clipping an
// over-wide rectangle. On an INVALID attempt the level still climbs, but
// only to the step's own validation progress, stalling short of the gate
// line — the stall itself is the explanation, no toast required; a modest
// inline status line (kept permanently mounted for reliable aria-live,
// invisible until it has something to say) carries the same reason to
// anyone who can't see the water. Going back drains the chambers ahead of
// the new position and reseals their gates with a slower, heavier ease-in —
// no spring, no highlight glide. Only the immediately-next chamber ever runs
// the equalization mechanism; steps further out are always locked until the
// flight is worked one gate at a time. Reduced motion: levels snap
// instantly, the gate split and spring are skipped, plain dividers stand in
// their place, and the highlight window jumps with no delay.
// ---------------------------------------------------------------------------

const FILL_MS = 600; // ease-out-expo climb, forward or stall
const FILL_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const DRAIN_MS = 950; // heavier ease-in, going back
const DRAIN_EASE = "cubic-bezier(0.7, 0, 0.84, 0)";
const GATE_MS = 260;
const GATE_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)"; // spring overshoot
const GATE_DELAY = 480; // let the levels visibly equalize first
const GATE_CLOSE_MS = 200;
const HIGHLIGHT_MS = 460;
const HIGHLIGHT_DELAY = 560; // glides through just after the gate parts
const DENY_MS = 420;
const DEFAULT_STALL = 0.35;

// connector route geometry, SVG viewBox units. VBH mirrors the chamber's
// real 64px height 1:1 (h-16), so every y-value below is already a real
// pixel offset; VBW is an arbitrary wide basis for x (percent-of-row-width
// math, same spirit as the old translateX(current * 100%)) — preserveAspectRatio
// "none" stretches it to the row's actual width, whatever that is.
const CONNECTOR_VBW = 1000;
const CONNECTOR_VBH = 64;
const CONNECTOR_BASE_Y = 60; // resting baseline, hugging the bottom edge
const CONNECTOR_GATE_Y = 48; // shallow rise into an internal gate's notch
const CONNECTOR_HOOK_Y = 38; // deeper rise for the two outer border-curls
const CONNECTOR_GATE_RUN = 20; // half-width of a gate notch's rounded run
const CONNECTOR_HOOK_RUN = 36; // half-width of an outer curl's rounded run

/**
 * One continuous path for the whole row: starts curling up the LEFT border
 * of chamber 0, runs the baseline, dips into a rounded notch at every
 * internal gate boundary (echoing that gate's own split-border position),
 * then curls up the RIGHT border of the last chamber. Every point is
 * clamped to stay strictly between the two curls and never cross a
 * neighboring boundary, so the shape is bounded by construction for any
 * step count — no wrapper overflow-hidden is doing that work.
 */
function buildConnectorPath(n: number): string {
  const steps = Math.max(n, 1);
  const w = CONNECTOR_VBW;
  const bx = (i: number) => (w * i) / steps;
  const half = bx(1) / 2;
  const hookRun = Math.max(4, Math.min(CONNECTOR_HOOK_RUN, half));
  const gateRun = Math.max(3, Math.min(CONNECTOR_GATE_RUN, half - 2, hookRun));

  const d: string[] = [
    `M 0 ${CONNECTOR_HOOK_Y}`,
    `Q 0 ${CONNECTOR_BASE_Y} ${hookRun} ${CONNECTOR_BASE_Y}`,
  ];

  for (let i = 1; i < steps; i++) {
    const x = bx(i);
    d.push(`L ${x - gateRun} ${CONNECTOR_BASE_Y}`);
    d.push(`Q ${x} ${CONNECTOR_BASE_Y} ${x} ${CONNECTOR_GATE_Y}`);
    d.push(`Q ${x} ${CONNECTOR_BASE_Y} ${x + gateRun} ${CONNECTOR_BASE_Y}`);
  }

  d.push(`L ${w - hookRun} ${CONNECTOR_BASE_Y}`);
  d.push(`Q ${w} ${CONNECTOR_BASE_Y} ${w} ${CONNECTOR_HOOK_Y}`);
  return d.join(" ");
}

export interface LockFlightStep {
  id: string;
  label: string;
  /** Whether this step currently satisfies what's needed to advance past it. Default true. */
  valid?: boolean;
  /** 0-1 partial validation progress, shown as a stalled water level when `valid` is false. Default 0.35. */
  progress?: number;
  /** Reason surfaced (status line + aria-describedby) when this step blocks advancing. */
  blockedMessage?: string;
  /** Step body, rendered for the active step only. */
  content?: ReactNode;
}

export interface LockFlightProps {
  steps: LockFlightStep[];
  /** controlled current step index; omit for uncontrolled */
  index?: number;
  defaultIndex?: number;
  onIndexChange?: (index: number) => void;
  /** fires once when the final step is completed (Finish, while valid) */
  onComplete?: () => void;
  ariaLabel?: string;
  className?: string;
}

export function LockFlight({
  steps,
  index,
  defaultIndex = 0,
  onIndexChange,
  onComplete,
  ariaLabel = "Onboarding steps",
  className = "",
}: LockFlightProps) {
  const uid = useId();
  const n = steps.length;
  const clampIdx = (i: number) => Math.min(Math.max(i, 0), Math.max(n - 1, 0));

  const isControlled = index !== undefined;
  const [internalIndex, setInternalIndex] = useState(() => clampIdx(defaultIndex));
  const current = clampIdx(isControlled ? (index as number) : internalIndex);

  // steps already reached are permanently clickable, independent of the
  // physical water level below (which only ever shows "current or ahead")
  const [maxReached, setMaxReached] = useState(current);
  useEffect(() => {
    setMaxReached((m) => Math.max(m, current));
  }, [current]);

  const prevRef = useRef(current);
  const direction: "forward" | "back" | "none" =
    current > prevRef.current ? "forward" : current < prevRef.current ? "back" : "none";
  useEffect(() => {
    prevRef.current = current;
  }, [current]);

  const [stall, setStall] = useState<{ index: number; level: number } | null>(null);
  const [denyKey, setDenyKey] = useState(0);
  const [status, setStatus] = useState("");
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // a stall only ever describes the chamber immediately ahead of `current` —
  // once the flight actually reaches it (or moves elsewhere) it's stale
  useEffect(() => {
    setStall((s) => (s && s.index <= current ? null : s));
  }, [current]);

  const commit = (next: number) => {
    if (!isControlled) setInternalIndex(next);
    onIndexChange?.(next);
  };

  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const attemptAdvance = () => {
    const isLast = current === n - 1;
    const step = steps[current];
    const blocked = step?.valid === false;

    if (blocked) {
      if (!isLast) {
        setStall({ index: current + 1, level: step?.progress ?? DEFAULT_STALL });
      }
      setDenyKey((k) => k + 1);
      setStatus(
        isLast
          ? `Finish blocked: ${step?.blockedMessage ?? "this step isn't complete yet"}`
          : `Step ${current + 2} of ${n}, blocked: ${step?.blockedMessage ?? "this step isn't complete yet"}`
      );
      return;
    }

    setStall(null);
    if (isLast) {
      setStatus("All steps complete.");
      onComplete?.();
      return;
    }
    const target = current + 1;
    setStatus(`Step ${target + 1} of ${n} unlocked.`);
    commit(target);
  };

  const goTo = (i: number) => {
    if (i === current) return;
    if (i <= maxReached) {
      setStall(null);
      setStatus(`Step ${i + 1} of ${n}.`);
      commit(i);
      return;
    }
    if (i === current + 1) {
      attemptAdvance();
      return;
    }
    setDenyKey((k) => k + 1);
    setStatus(`Step ${i + 1} of ${n} is locked until step ${current + 2} is reached.`);
  };

  const goBack = () => {
    if (current === 0) return;
    setStall(null);
    setStatus(`Step ${current} of ${n}.`);
    commit(current - 1);
  };

  const onNavKeyDown = (e: React.KeyboardEvent<HTMLOListElement>) => {
    const idx = btnRefs.current.findIndex((b) => b === document.activeElement);
    const focused = idx === -1 ? current : idx;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        btnRefs.current[Math.min(focused + 1, n - 1)]?.focus();
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        btnRefs.current[Math.max(focused - 1, 0)]?.focus();
        break;
      case "Home":
        e.preventDefault();
        btnRefs.current[0]?.focus();
        break;
      case "End":
        e.preventDefault();
        btnRefs.current[n - 1]?.focus();
        break;
    }
  };

  const fillDuration = reduced ? 0 : direction === "back" ? DRAIN_MS : FILL_MS;
  const fillEase = direction === "back" ? DRAIN_EASE : FILL_EASE;
  const step = steps[current];
  const isLast = current === n - 1;

  // connector: one route for the whole row (memoized on step count only —
  // its shape never depends on `current`), plus the accent window's
  // position/length along it. `unit` is 1/n of the route's *normalized*
  // length (pathLength=1), so the window's nominal start always lands
  // exactly on a chamber boundary. The nominal length is padded 20% so a
  // curl or notch never reads as a stub cut short mid-curve — but padding
  // only ever pushes the window's start EARLIER (never its end past 1):
  // the dasharray period equals the path's full normalized length, so
  // letting the end run past 1 would wrap the pattern and light a stray
  // sliver back at the path's start. Clamping the end and re-deriving the
  // start from it means the last chamber's window bites a little further
  // back into the previous straight run instead — same harmless bleed,
  // just anchored the other way at the one boundary where it matters.
  const connectorPath = useMemo(() => buildConnectorPath(n), [n]);
  const connectorUnit = 1 / Math.max(n, 1);
  const nominalWindow = n <= 1 ? 1 : connectorUnit * 1.2;
  const windowEnd = Math.min(1, current * connectorUnit + nominalWindow);
  const windowStart = Math.max(0, windowEnd - nominalWindow);
  const connectorWindow = windowEnd - windowStart;
  const connectorOffset = -windowStart;

  return (
    <div className={`w-full rounded-md border border-border bg-surface ${className}`}>
      <style>{`
        @keyframes ns-lf-deny {
          0% { transform: translateY(0); opacity: 0.85; }
          35% { transform: translateY(-3px); opacity: 1; }
          100% { transform: translateY(0); opacity: 0; }
        }
        .ns-lf-deny { animation: ns-lf-deny ${DENY_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        @media (prefers-reduced-motion: reduce) {
          .ns-lf-deny { animation: none; opacity: 0; }
        }
      `}</style>

      <nav aria-label={ariaLabel} className="border-b border-border">
        <div className="relative isolate">
          <ol onKeyDown={onNavKeyDown} className="flex items-stretch">
            {steps.map((s, i) => {
              const reached = i <= current;
              const isCurrent = i === current;
              const unlocked = i <= maxReached;
              const locked = !unlocked && !isCurrent;
              const level = reached ? 1 : stall?.index === i ? stall.level : 0;
              const gateOpen = i > 0 && i <= current;
              const descId = `${uid}-desc-${i}`;
              const blockedText =
                i === current + 1
                  ? `Step ${i + 1} of ${n}, blocked: ${step?.blockedMessage ?? "the current step isn't complete"}`
                  : `Step ${i + 1} of ${n} is locked until step ${current + 2} is reached.`;
              const isStalling = stall?.index === i;
              const gateStyle = (offset: number): React.CSSProperties => {
                if (reduced) {
                  return { transform: "translateY(0)", transitionDuration: "0ms" };
                }
                if (direction === "forward" || gateOpen) {
                  return {
                    transform: gateOpen ? `translateY(${offset}px)` : "translateY(0)",
                    transitionProperty: "transform",
                    transitionDuration: `${GATE_MS}ms`,
                    transitionTimingFunction: GATE_EASE,
                    transitionDelay: gateOpen ? `${GATE_DELAY}ms` : "0ms",
                  };
                }
                return {
                  transform: "translateY(0)",
                  transitionProperty: "transform",
                  transitionDuration: `${GATE_CLOSE_MS}ms`,
                  transitionTimingFunction: "ease-in",
                  transitionDelay: "0ms",
                };
              };

              return (
                <li key={s.id} className="min-w-0 flex-1">
                  <button
                    ref={(el) => {
                      btnRefs.current[i] = el;
                    }}
                    type="button"
                    data-lockflight-step={i}
                    data-locked={locked ? "true" : undefined}
                    aria-current={isCurrent ? "step" : undefined}
                    aria-disabled={locked ? "true" : undefined}
                    aria-describedby={locked ? descId : undefined}
                    onClick={() => goTo(i)}
                    className={[
                      "relative block h-16 w-full overflow-hidden text-left outline-none transition-colors",
                      "hover:bg-foreground/[0.03] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
                    ].join(" ")}
                  >
                    {/* chamber water: fill body + 1px meniscus, driven purely by translateY */}
                    <span
                      aria-hidden
                      className="absolute inset-0"
                      style={{
                        transform: `translateY(${(1 - level) * 100}%)`,
                        transitionProperty: "transform",
                        transitionDuration: `${isStalling ? (reduced ? 0 : FILL_MS) : fillDuration}ms`,
                        transitionTimingFunction: isStalling ? FILL_EASE : fillEase,
                      }}
                    >
                      <span className="absolute inset-x-0 top-0 bottom-[-100%] bg-foreground/[0.06]" />
                      <span className="absolute inset-x-0 top-0 h-px bg-foreground/50" />
                      {isStalling ? (
                        <span
                          key={denyKey}
                          aria-hidden
                          className="ns-lf-deny absolute inset-x-0 top-0 h-px bg-foreground"
                        />
                      ) : null}
                    </span>

                    {/* the shared gate: this chamber's left border, split in two */}
                    {i > 0 ? (
                      <>
                        <span
                          aria-hidden
                          className="absolute left-0 top-0 h-1/2 w-px bg-border"
                          style={gateStyle(-4)}
                        />
                        <span
                          aria-hidden
                          className="absolute left-0 bottom-0 h-1/2 w-px bg-border"
                          style={gateStyle(4)}
                        />
                      </>
                    ) : null}

                    <span className="relative z-10 flex h-full flex-col justify-between p-2.5">
                      <span
                        className={`font-mono text-[10px] uppercase tracking-[0.15em] ${
                          isCurrent ? "text-foreground" : "text-muted"
                        }`}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span
                        className={`truncate text-sm ${
                          isCurrent
                            ? "font-medium text-foreground"
                            : locked
                              ? "text-muted"
                              : "text-foreground"
                        }`}
                      >
                        {s.label}
                      </span>
                    </span>
                  </button>

                  {locked ? (
                    <span id={descId} className="sr-only">
                      {blockedText}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>

          {/* the connector: a real route, not a bar. -z-10 (inside this div's
              `isolate` stacking context) keeps both paths painted behind every
              chamber button, which are themselves `relative` (z-index:auto) and
              would otherwise win paint order simply by coming later in the DOM.
              The svg's own viewBox + explicit overflow-hidden bound the shape —
              no ancestor clip is doing that work. vectorEffect="non-scaling-stroke"
              keeps both strokes a crisp, undistorted 2px on screen regardless of
              preserveAspectRatio="none" stretching x and y by different factors. */}
          <svg
            aria-hidden
            focusable="false"
            viewBox={`0 0 ${CONNECTOR_VBW} ${CONNECTOR_VBH}`}
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 -z-10 h-full w-full overflow-hidden"
          >
            {/* the route itself: always fully drawn, --border, the pipe every
                chamber shares whether or not you've reached it yet */}
            <path
              d={connectorPath}
              fill="none"
              vectorEffect="non-scaling-stroke"
              strokeWidth={2}
              strokeLinecap="round"
              className="stroke-current text-border"
            />
            {/* the "you are here" marker: --accent, windowed to ~one chamber's
                length of the SAME route via a normalized (pathLength=1)
                dasharray/dashoffset, so it slides along the curls and notches
                instead of jumping between flat rectangles */}
            <path
              d={connectorPath}
              fill="none"
              vectorEffect="non-scaling-stroke"
              strokeWidth={2}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={`${connectorWindow} ${Math.max(0, 1 - connectorWindow)}`}
              strokeDashoffset={connectorOffset}
              className="stroke-current text-accent"
              style={{
                transitionProperty: "stroke-dashoffset",
                transitionDuration: `${reduced ? 0 : HIGHLIGHT_MS}ms`,
                transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
                transitionDelay: `${reduced || direction !== "forward" ? 0 : HIGHLIGHT_DELAY}ms`,
              }}
            />
          </svg>
        </div>
      </nav>

      {/* status: permanently mounted (screen readers must already be
          watching an aria-live region for a mount-time update to be
          reliably announced) but invisible until it has something to say —
          the water stall is the primary explanation, this is the backup */}
      <p
        role="status"
        aria-live="polite"
        data-lockflight-status
        className={`mx-4 min-h-[1.25rem] py-2 font-mono text-[11px] transition-opacity duration-200 ${
          status ? "text-muted opacity-100" : "opacity-0"
        }`}
      >
        {status}
      </p>

      <div className="border-t border-border p-5" role="group" aria-labelledby={`${uid}-heading`}>
        <h3 id={`${uid}-heading`} className="text-sm font-semibold text-foreground">
          {step?.label}
        </h3>
        {step?.content ? <div className="mt-3 text-sm text-muted">{step.content}</div> : null}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border p-4">
        <button
          type="button"
          onClick={goBack}
          disabled={current === 0}
          className="rounded-sm border border-border bg-background px-4 py-2 text-sm text-foreground outline-none transition-colors hover:enabled:bg-foreground/[0.06] focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          Back
        </button>
        <button
          type="button"
          data-lockflight-continue
          onClick={attemptAdvance}
          className="rounded-sm border border-border bg-foreground px-4 py-2 text-sm font-medium text-background outline-none transition-colors hover:bg-foreground/90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          {isLast ? "Finish" : "Continue"}
        </button>
      </div>
    </div>
  );
}
