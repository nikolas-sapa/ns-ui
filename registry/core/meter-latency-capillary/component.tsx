"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// MeniscusHold — time-to-first-token rendered as calibrated capillary rise.
// A narrow tube fills toward a scribed line marking the historical p50
// first-token latency for this model/tool combo; the rise is eased so the
// meniscus reaches that line exactly when a response typically lands. It
// never fakes progress past what it can justify: reaching the p50 line with
// nothing having arrived doesn't keep climbing toward "done" — the liquid
// HOLDS there and trembles (an honest "still waiting, later than usual"
// signal) while a second scribe line for p95 fades in above it. Past p95 the
// tremble stops — trembling forever would itself be a lie about how confident
// the wait still is — and a stall affordance (retry / switch model) surfaces.
// First token landing (`arrivedAt` set) drains the tube fast, ease-out-expo,
// from wherever the level currently sits.
//
// Three states, three honest phrases, announced only on the transition
// between them (role=status, not a running commentary):
//   waiting -> "Waiting, typically N seconds."
//   slow    -> "Taking longer than usual."
//   stalled -> "May be stalled, retry available."
// Distinct from status-glyph-cadence (liveness — the connection is alive, no
// notion of "how long is normal") and password-strength-tide (liquid level
// encodes input strength, not elapsed-time-vs-percentile). This is the only
// one of the three built from a calibrated latency distribution.
//
// Timing is derived from `startedAt`/`p50Ms`/`p95Ms` via two scheduled
// setTimeouts (not a rAF poll — there's nothing to simulate physically here,
// just two thresholds), so a late mount (component created a few hundred ms
// after the real request began) still lands on the correct phase and eases
// in for whatever time remains, rather than replaying the whole rise from
// zero. Pure DOM + CSS + SVG: the fill is a div, the meniscus is a 1-path SVG
// riding its top edge, both colored from --foreground/--ns-muted, no canvas.
// prefers-reduced-motion drops the rise/tremor/fade entirely and swaps in a
// static three-segment strip (within-normal / slow / stalled) — the same
// phase machine, same announcements, nothing depends on perceiving motion.
// ---------------------------------------------------------------------------

export type MeniscusPhase = "waiting" | "slow" | "stalled" | "arrived";

const TUBE_H = 48; // px, per spec
const TUBE_W = 6; // px, per spec
const DRAIN_MS = 380;
const DRAIN_EASE = "cubic-bezier(0.16,1,0.3,1)"; // ease-out-expo
const RISE_EASE = "cubic-bezier(0.22,1,0.36,1)"; // gentle decelerate, distinct from drain
const P95_FADE_MS_FLOOR = 250;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function fmtSeconds(ms: number): string {
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  return (safe / 1000).toFixed(1);
}

// which of the two timed phases (ignoring `arrivedAt`) a given elapsed-ms
// falls in, for a p50/p95 pair
function timedPhase(elapsedMs: number, p50Ms: number, p95Ms: number): "waiting" | "slow" | "stalled" {
  if (elapsedMs < p50Ms) return "waiting";
  if (elapsedMs < p95Ms) return "slow";
  return "stalled";
}

const CSS = `
.ns-mh-tremor { animation: ns-mh-tremor 500ms ease-in-out infinite; }
@keyframes ns-mh-tremor {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(0.5px); }
}
@media (prefers-reduced-motion: reduce) {
  .ns-mh-tremor { animation: none; }
}
`;

export interface MeniscusHoldProps {
  /** ms epoch timestamp this request/turn began. Defaults to Date.now() at mount. */
  startedAt?: number;
  /** historical p50 (typical) first-token latency in ms, e.g. from a rolling latency store */
  p50Ms: number;
  /** historical p95 first-token latency in ms — should be greater than p50Ms */
  p95Ms: number;
  /** ms epoch timestamp the first token actually arrived; null/undefined while still waiting */
  arrivedAt?: number | null;
  /** fired when the user presses Retry after a stall */
  onRetry?: () => void;
  /** fired when the user presses "Switch model" after a stall */
  onSwitchModel?: () => void;
  /** accessible name for the root status region. Default "Time to first token" */
  label?: string;
  className?: string;
}

export function MeniscusHold({
  startedAt,
  p50Ms,
  p95Ms,
  arrivedAt,
  onRetry,
  onSwitchModel,
  label = "Time to first token",
  className = "",
}: MeniscusHoldProps) {
  const reduced = useReducedMotion();
  const [autoStart] = useState(() => Date.now());
  const start = startedAt ?? autoStart;
  const safeP50 = p50Ms > 0 ? p50Ms : 1;
  const safeP95 = p95Ms > safeP50 ? p95Ms : safeP50 + 1;

  const [timed, setTimed] = useState<"waiting" | "slow" | "stalled">(() =>
    timedPhase(Date.now() - start, safeP50, safeP95)
  );

  // re-arm the two threshold timers whenever a new request starts. A late
  // mount schedules only whatever time remains, so a component created
  // 300ms into a request still crosses p50 300ms early, not late.
  useEffect(() => {
    const elapsed = Date.now() - start;
    setTimed(timedPhase(elapsed, safeP50, safeP95));
    const toSlow = safeP50 - elapsed;
    const toStalled = safeP95 - elapsed;
    const timers: number[] = [];
    if (toSlow > 0) {
      timers.push(window.setTimeout(() => setTimed("slow"), toSlow));
    }
    if (toStalled > 0) {
      timers.push(window.setTimeout(() => setTimed("stalled"), toStalled));
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, safeP50, safeP95]);

  const phase: MeniscusPhase = arrivedAt ? "arrived" : timed;

  // fill height, as a fraction of the tube, held at the p50 line once
  // reached — it never keeps climbing toward p95, that would be fake
  // progress. p95 anchors the very top of the tube.
  const p50Frac = Math.max(0, Math.min(1, safeP50 / safeP95));
  const elapsedAtMount = Date.now() - start;
  const riseRemainMs = Math.max(0, safeP50 - elapsedAtMount);

  let fillFrac: number;
  let fillMs: number;
  let fillEase: string;
  if (phase === "arrived") {
    fillFrac = 0;
    fillMs = reduced ? 0 : DRAIN_MS;
    fillEase = DRAIN_EASE;
  } else if (phase === "waiting") {
    fillFrac = p50Frac;
    fillMs = reduced ? 0 : riseRemainMs;
    fillEase = RISE_EASE;
  } else {
    // slow or stalled: held at the p50 line, no further rise
    fillFrac = p50Frac;
    fillMs = 0;
    fillEase = RISE_EASE;
  }

  // p95 tick fades in across the "slow" window, complete by the time
  // "stalled" arrives; instant under reduced motion (still legible, just
  // not animated).
  const p95FadeMs = Math.max(P95_FADE_MS_FLOOR, safeP95 - safeP50);
  // driven by the underlying timed phase, not the arrived overlay — a token
  // that lands before p50 was ever reached should never suddenly reveal a
  // mark it hadn't earned yet.
  const p95Visible = timed !== "waiting";

  // announce only on transition, never a running commentary on the level
  const [liveText, setLiveText] = useState("");
  const lastAnnouncedRef = useRef<MeniscusPhase | null>(null);
  useEffect(() => {
    if (lastAnnouncedRef.current === phase) return;
    lastAnnouncedRef.current = phase;
    if (phase === "waiting") {
      setLiveText(`Waiting, typically ${fmtSeconds(safeP50)} seconds.`);
    } else if (phase === "slow") {
      setLiveText("Taking longer than usual.");
    } else if (phase === "stalled") {
      setLiveText("May be stalled, retry available.");
    } else {
      setLiveText("Response arrived.");
    }
  }, [phase, safeP50]);

  const p50Label = `${fmtSeconds(safeP50)}s`;
  const p95Label = `${fmtSeconds(safeP95)}s`;

  const captionText =
    phase === "waiting"
      ? "waiting"
      : phase === "slow"
        ? "slower than usual"
        : phase === "stalled"
          ? "may be stalled"
          : "arrived";

  return (
    <div
      data-meniscus-root
      role="group"
      aria-label={label}
      className={`inline-flex items-start gap-4 ${className}`}
    >
      <style>{CSS}</style>

      {/* the visual tube/tick apparatus (or its reduced-motion stand-in) —
          a dedicated, spatially disjoint hook for tooling: it never overlaps
          the retry/switch buttons rendered in the sibling column below, so
          clicking it (inert — there is no handler here) can never
          accidentally land on a button that only exists once stalled. */}
      <div data-meniscus-display>
        {reduced ? (
          <ReducedIndicator phase={phase} />
        ) : (
          <div className="flex items-end" style={{ height: TUBE_H }}>
            {/* the tube */}
            <div
              className="relative rounded-sm border border-border"
              style={{ width: TUBE_W, height: TUBE_H }}
            >
              <div className="absolute inset-0 overflow-hidden rounded-sm">
                <div
                  aria-hidden
                  className="absolute inset-x-0 bottom-0"
                  style={{
                    height: `${fillFrac * 100}%`,
                    backgroundColor: "var(--ns-muted)",
                    opacity: 0.25,
                    transition: `height ${fillMs}ms ${fillEase}`,
                  }}
                />
              </div>

              {/* meniscus — a small concave curve riding the fill's top edge,
                  a sibling of the clipped layer so it's never cut off */}
              <div
                aria-hidden
                className={phase === "slow" ? "ns-mh-tremor" : ""}
                style={{
                  position: "absolute",
                  left: -1,
                  right: -1,
                  bottom: `calc(${fillFrac * 100}% - 2px)`,
                  height: 4,
                  transition: `bottom ${fillMs}ms ${fillEase}`,
                }}
              >
                <svg width={TUBE_W + 2} height={4} viewBox="0 0 8 4" style={{ display: "block" }}>
                  <path
                    d="M0,0.5 Q4,3.2 8,0.5"
                    fill="none"
                    stroke="var(--foreground)"
                    strokeWidth="1"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>

            {/* scribe marks + labels */}
            <div className="relative ml-2" style={{ height: TUBE_H, width: 34 }}>
              <Tick bottomFrac={p50Frac} label={p50Label} opacity={1} />
              <Tick
                bottomFrac={1}
                label={p95Label}
                opacity={p95Visible ? 1 : 0}
                transitionMs={reduced ? 0 : p95FadeMs}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ns-muted">
          {captionText}
        </span>

        {phase === "stalled" && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-meniscus-retry
              onClick={onRetry}
              className="rounded-sm border border-border px-2 py-1 font-mono text-[11px] text-foreground transition-colors hover:bg-foreground/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ns-accent"
            >
              Retry
            </button>
            <button
              type="button"
              data-meniscus-switch
              onClick={onSwitchModel}
              className="rounded-sm border border-border px-2 py-1 font-mono text-[11px] text-ns-muted transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ns-accent"
            >
              Switch model
            </button>
          </div>
        )}
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {liveText}
      </p>
    </div>
  );
}

function Tick({
  bottomFrac,
  label,
  opacity,
  transitionMs = 0,
}: {
  bottomFrac: number;
  label: string;
  opacity: number;
  transitionMs?: number;
}) {
  return (
    <div
      aria-hidden
      className="absolute left-0 flex items-center gap-1"
      style={{
        bottom: `calc(${bottomFrac * 100}% - 0.5px)`,
        opacity,
        transition: `opacity ${transitionMs}ms linear`,
      }}
    >
      <span className="block" style={{ width: 5, height: 1, backgroundColor: "var(--foreground)" }} />
      <span className="whitespace-nowrap font-mono text-[9px] text-ns-muted">{label}</span>
    </div>
  );
}

// Static, motion-free fallback: three fixed segments, the current phase lit
// from --ns-muted to --foreground. Same phase machine drives this branch —
// nothing here depends on perceiving a rise or a tremble.
function ReducedIndicator({ phase }: { phase: MeniscusPhase }) {
  const segments: { key: "waiting" | "slow" | "stalled"; text: string }[] = [
    { key: "waiting", text: "normal" },
    { key: "slow", text: "slow" },
    { key: "stalled", text: "stalled" },
  ];
  const activeKey = phase === "arrived" ? null : phase;
  return (
    <div className="flex items-end gap-1" style={{ height: TUBE_H }}>
      {segments.map((seg) => {
        const active = seg.key === activeKey;
        return (
          <div key={seg.key} className="flex flex-col items-center gap-1">
            <div
              className="rounded-sm border border-border"
              style={{
                width: TUBE_W,
                height: TUBE_H - 10,
                backgroundColor: active ? "var(--foreground)" : "var(--ns-muted)",
                opacity: active ? 0.55 : 0.15,
              }}
            />
            <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-ns-muted">
              {seg.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}
