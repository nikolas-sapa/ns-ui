"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

// ---------------------------------------------------------------------------
// WireFeed — live telegraph feed for multi-stage operations of unknowable
// total duration (deploys, imports, migrations). No fake percentage: every
// line is a real sub-step the caller reports as it actually starts and
// actually finishes. The active line's elapsed counter ticks at 1Hz off its
// own startedAt; a 3px underline grows toward (never reaching) full width on
// an asymptotic curve, so a stall is visually self-evident — the timer keeps
// counting and the underline keeps crawling while nothing new arrives.
// Finished steps compress to a dense 20px ledger row with their true cost
// frozen in --ns-muted and a 1px check tick drawn in; a failed step pins at
// weight 600 with an indented stderr excerpt, no color signal (this
// component's palette has no error hue). New lines slide up 8px + fade over
// 250ms ease-out-expo; a top mask fades the ledger into its own scrollback.
// role=log carries the announcements (each completed/failed step once, with
// its duration); the 1Hz counters are aria-hidden so they never chatter.
// Pure DOM + CSS/SVG, one throttled rAF loop, zero deps.
// ---------------------------------------------------------------------------

export type WireFeedStatus = "active" | "done" | "error";

export type WireFeedStep = {
  /** stable id — the row's key for the whole run, never reused across runs */
  id: string;
  /** what actually happened, e.g. "resolving deps" or "building 3/12" */
  label: string;
  status: WireFeedStatus;
  /** Date.now() ms when this step actually began */
  startedAt: number;
  /** Date.now() ms when it actually finished — required once status !== "active" */
  endedAt?: number;
  /** stderr excerpt, shown indented under a failed step only */
  detail?: string;
};

const SLIDE_MS = 250;
const COMPRESS_MS = 300;
const CHECK_MS = 220;
const UNDERLINE_TAU_MS = 9000; // time-constant of the asymptotic crawl
const ACTIVE_PAD = 7; // px, top/bottom padding while a step is live
const DONE_PAD = 2; // px, top/bottom padding once collapsed into the ledger

function formatElapsed(ms: number): string {
  const s = Math.max(0, ms) / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.floor(s - m * 60);
  return `${m}:${String(rem).padStart(2, "0")}`;
}

function CheckTick({ reduced }: { reduced: boolean }) {
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const p = pathRef.current;
    if (!p) return;
    const len = p.getTotalLength();
    p.style.transition = "none";
    p.style.strokeDasharray = `${len}`;
    p.style.strokeDashoffset = `${len}`;
    if (reduced) {
      p.style.strokeDashoffset = "0";
      return;
    }
    const raf = requestAnimationFrame(() => {
      p.style.transition = `stroke-dashoffset ${CHECK_MS}ms cubic-bezier(0.16,1,0.3,1)`;
      p.style.strokeDashoffset = "0";
    });
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return (
    <svg
      width="9"
      height="8"
      viewBox="0 0 9 8"
      aria-hidden
      className="shrink-0 text-ns-muted"
    >
      <path
        ref={pathRef}
        d="M1 4.3 L3.4 6.7 L8 1.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WireFeedRow({
  step,
  reduced,
  registerTimer,
  registerUnderline,
}: {
  step: WireFeedStep;
  reduced: boolean;
  registerTimer: (node: HTMLSpanElement | null) => void;
  registerUnderline: (node: HTMLDivElement | null) => void;
}) {
  const { label, status, startedAt, endedAt, detail } = step;
  const isDone = status === "done";
  const isError = status === "error";
  const frozen = endedAt !== undefined ? Math.max(0, endedAt - startedAt) : 0;

  return (
    <div
      className="progress-telegraph-log-row overflow-hidden"
      aria-live={isError ? "assertive" : undefined}
      aria-hidden={status === "active" ? true : undefined}
      style={{
        paddingTop: isDone ? DONE_PAD : ACTIVE_PAD,
        paddingBottom: isDone ? DONE_PAD : ACTIVE_PAD,
        transition: reduced ? "none" : `padding ${COMPRESS_MS}ms cubic-bezier(0.16,1,0.3,1)`,
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span
          className={`flex min-w-0 items-center gap-1.5 truncate ${
            isError ? "font-semibold text-foreground" : "text-foreground"
          }`}
        >
          {isDone && <CheckTick reduced={reduced} />}
          <span className="truncate">{label}</span>
        </span>

        {status === "active" ? (
          <span
            ref={registerTimer}
            aria-hidden
            className="shrink-0 tabular-nums text-foreground"
          >
            0.0s
          </span>
        ) : (
          <span
            className={`shrink-0 tabular-nums text-ns-muted ${isError ? "font-semibold" : ""}`}
          >
            {formatElapsed(frozen)}
          </span>
        )}
      </div>

      {status === "active" && (
        <div className="relative mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-border/50">
          <div
            ref={registerUnderline}
            className="absolute inset-y-0 left-0 w-0 rounded-full bg-ns-accent"
          />
        </div>
      )}

      {isError && detail && (
        <div className="mt-1.5 ml-4 whitespace-pre-wrap break-words border-l border-border pl-2 text-[11px] leading-snug text-ns-muted">
          {detail}
        </div>
      )}
    </div>
  );
}

export function WireFeed({
  steps,
  className = "",
  "aria-label": ariaLabel = "Task progress",
}: {
  /** append-only run log: add a step as "active" when it starts, then flip
   * that same id to "done"/"error" with endedAt when it finishes. Never
   * shows a step that hasn't actually started. */
  steps: WireFeedStep[];
  className?: string;
  "aria-label"?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const timerRefs = useRef(new Map<string, HTMLSpanElement>());
  const underlineRefs = useRef(new Map<string, HTMLDivElement>());
  const lastSecond = useRef(new Map<string, number>());
  const stickToBottom = useRef(true);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  // one throttled rAF: paints every active row's asymptotic underline every
  // frame and writes its elapsed counter text once per real elapsed second
  // (the 1Hz cadence the spec calls for) — sleeps entirely once nothing is
  // active, so a finished run costs nothing.
  useEffect(() => {
    const activeIds = steps.filter((s) => s.status === "active").map((s) => s.id);
    for (const id of [...lastSecond.current.keys()]) {
      if (!activeIds.includes(id)) lastSecond.current.delete(id);
    }
    if (activeIds.length === 0) return;

    let raf = 0;
    const loop = () => {
      const now = Date.now();
      for (const s of steps) {
        if (s.status !== "active") continue;
        const elapsed = Math.max(0, now - s.startedAt);

        const underline = underlineRefs.current.get(s.id);
        if (underline) {
          const pct = (elapsed / (elapsed + UNDERLINE_TAU_MS)) * 100;
          underline.style.width = `${pct}%`;
        }

        const sec = Math.floor(elapsed / 1000);
        if (lastSecond.current.get(s.id) !== sec) {
          lastSecond.current.set(s.id, sec);
          const timer = timerRefs.current.get(s.id);
          if (timer) timer.textContent = formatElapsed(elapsed);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [steps]);

  // stay pinned to the freshest line unless the caller has scrolled up to
  // review the collapsed ledger — then don't yank them back down
  useEffect(() => {
    const el = rootRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [steps]);

  const onScroll = () => {
    const el = rootRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const el = rootRef.current;
    if (!el) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      el.scrollTop += 28;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      el.scrollTop -= 28;
    }
  };

  return (
    <div
      ref={rootRef}
      role="log"
      aria-live="polite"
      aria-label={ariaLabel}
      tabIndex={0}
      onScroll={onScroll}
      onKeyDown={onKeyDown}
      className={`relative max-h-[280px] overflow-y-auto overflow-x-hidden rounded-md border border-border bg-background px-3 py-1 font-mono text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ns-accent ${className}`}
      style={{
        maskImage: "linear-gradient(to bottom, transparent 0, black 20px)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent 0, black 20px)",
      }}
    >
      <style>{`
        @keyframes progress-telegraph-log-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .progress-telegraph-log-row { animation: progress-telegraph-log-in ${SLIDE_MS}ms cubic-bezier(0.19,1,0.22,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .progress-telegraph-log-row { animation: none; }
        }
      `}</style>
      {steps.map((s) => (
        <WireFeedRow
          key={s.id}
          step={s}
          reduced={reduced}
          registerTimer={(node) => {
            if (node) timerRefs.current.set(s.id, node);
            else timerRefs.current.delete(s.id);
          }}
          registerUnderline={(node) => {
            if (node) underlineRefs.current.set(s.id, node);
            else underlineRefs.current.delete(s.id);
          }}
        />
      ))}
    </div>
  );
}
