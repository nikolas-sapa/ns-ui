"use client";

import { useEffect, useId, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// RunningBelay — a deploy pipeline drawn as a climbing pitch. Stages are
// protection anchors bolted along a vertical SVG line; the current deploy is
// the climber-end of a rope clipped through every passed anchor. The segment
// between the last clipped anchor and the leader bows with a quadratic
// bezier control offset of `headroom * 24px` (24px at 96px stage spacing
// reads as slack; the same offset never exceeds 28px, past which the curve
// would cross its own anchor line and stop reading as clipped through) — so
// headroom approaching 0 pulls the rope visibly taut before an automated
// abort fires. Advancement is a linear climb on ease-out-expo; passing an
// anchor clips through with a one-frame carabiner-ring flash, no per-stage
// celebration. ARREST (fall arrest / rollback) is computed only as the
// greatest passed anchor and is a single translate of the leader there, with
// one overshoot-and-settle spring on the leader — never a stage-by-stage
// reverse walk, because a rollback is not a tidy reverse deploy and
// animating it as one teaches a false mental model. The catch itself also
// draws a second, dashed rope segment pinned taut (the same 28px hard-capped
// bow as the live rope) between the target anchor and where the leader fell
// from, fading out over the spring's own duration as it settles — the rope
// visibly taking the load, not just a dot relocating. Pure DOM + SVG + CSS,
// every ink a token, no canvas.
// ---------------------------------------------------------------------------

export type BelayStageStatus = "pending" | "active" | "passed" | "failed";

export interface BelayStage {
  /** stable id, also what onArrest reports back */
  id: string;
  /** short stage name, e.g. "build", "canary", "10%" */
  label: string;
  status: BelayStageStatus;
  /** shown next to the stage and read out in the arrest target description */
  timestamp?: string;
}

export interface RunningBelayProps {
  /** pipeline stages, bottom of the pitch to the top — e.g. build..canary..100% */
  stages: BelayStage[];
  /** 0..1 aggregated canary-health margin; drives how much the live rope bows */
  headroom: number;
  /** fires with the stage id the arrest fell back to */
  onArrest?: (targetStageId: string) => void;
  /** accessible name for the pipeline group */
  ariaLabel?: string;
  className?: string;
}

const SPACING = 96; // px between anchors
const RAIL_W = 40; // px, the SVG rail column
const LINE_X = RAIL_W / 2;
const ANCHOR_R = 5;
const BOW_MAX = 24; // px, at headroom = 1
const BOW_CAP = 28; // px, hard ceiling — past this the curve crosses the line
const CLIMB_MS = 600;
const CLIMB_EASE = "cubic-bezier(0.16,1,0.3,1)"; // ease-out-expo
const SPRING_MS = 700;
const SPRING_EASE = "cubic-bezier(0.34,1.56,0.64,1)"; // overshoot + settle
const CLIP_FLASH_MS = 150;
const ARREST_FLASH_MS = 500;

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** the frontmost stage the deploy is currently at — the active one, or the
 *  furthest passed stage once nothing is active */
function naturalLeaderIndex(stages: BelayStage[]): number {
  const active = stages.findIndex((s) => s.status === "active");
  if (active !== -1) return active;
  let idx = 0;
  stages.forEach((s, i) => {
    if (s.status === "passed") idx = i;
  });
  return idx;
}

/** the arrest target: the greatest passed anchor, full stop. -1 if none. */
function greatestPassedIndex(stages: BelayStage[]): number {
  let idx = -1;
  stages.forEach((s, i) => {
    if (s.status === "passed" && i > idx) idx = i;
  });
  return idx;
}

export function RunningBelay({
  stages,
  headroom,
  onArrest,
  ariaLabel = "Deploy pipeline",
  className = "",
}: RunningBelayProps) {
  const uid = useId();
  const reduced = useReducedMotion();
  const n = stages.length;
  const totalH = Math.max(1, n) * SPACING;

  const natural = naturalLeaderIndex(stages);
  const lastPassed = greatestPassedIndex(stages);

  // arrestedIdx is a local, optimistic override — released the moment the
  // caller's own stages prop confirms the deploy is actually back there.
  const [arrestedIdx, setArrestedIdx] = useState<number | null>(null);
  const [springOn, setSpringOn] = useState(false);
  const springTimeout = useRef<number | undefined>(undefined);
  // the leader's position the instant BEFORE a fall — kept only for the
  // duration of the spring, so the catch has a rope to show the load on.
  const [fallFromIdx, setFallFromIdx] = useState<number | null>(null);
  const [fallFading, setFallFading] = useState(false);
  const fallFadeFrame = useRef<number | undefined>(undefined);
  const [arrestFlashIdx, setArrestFlashIdx] = useState<number | null>(null);
  const arrestFlashTimeout = useRef<number | undefined>(undefined);
  const [assertiveMsg, setAssertiveMsg] = useState("");

  useEffect(() => {
    if (arrestedIdx !== null && natural === arrestedIdx) setArrestedIdx(null);
  }, [natural, arrestedIdx]);

  const leaderIndex = arrestedIdx ?? natural;

  // polite announcement whenever a stage's own status changes
  const prevStages = useRef(stages);
  const [politeMsg, setPoliteMsg] = useState("");
  useEffect(() => {
    const prev = prevStages.current;
    prevStages.current = stages;
    if (prev === stages) return;
    for (let i = 0; i < stages.length; i++) {
      const p = prev[i];
      const s = stages[i];
      if (p && s && p.status !== s.status) {
        setPoliteMsg(`${s.label} is now ${s.status}${s.timestamp ? `, ${s.timestamp}` : ""}.`);
      }
    }
  }, [stages]);

  // one-frame carabiner-ring flash the instant an anchor newly becomes passed
  const passedSeen = useRef<Set<number>>(new Set());
  const [clipFlashIdx, setClipFlashIdx] = useState<number | null>(null);
  const clipFlashTimeout = useRef<number | undefined>(undefined);
  useEffect(() => {
    const prevSeen = passedSeen.current;
    const nextSeen = new Set<number>();
    let fresh: number | null = null;
    stages.forEach((s, i) => {
      if (s.status === "passed") {
        nextSeen.add(i);
        if (!prevSeen.has(i)) fresh = i;
      }
    });
    passedSeen.current = nextSeen;
    if (fresh !== null && !reduced) {
      setClipFlashIdx(fresh);
      window.clearTimeout(clipFlashTimeout.current);
      clipFlashTimeout.current = window.setTimeout(() => setClipFlashIdx(null), CLIP_FLASH_MS);
    }
  }, [stages, reduced]);

  useEffect(
    () => () => {
      window.clearTimeout(springTimeout.current);
      window.clearTimeout(arrestFlashTimeout.current);
      window.clearTimeout(clipFlashTimeout.current);
      window.cancelAnimationFrame(fallFadeFrame.current ?? -1);
    },
    []
  );

  const targetStage = lastPassed >= 0 ? stages[lastPassed] : null;

  function handleArrest() {
    if (lastPassed < 0 || !targetStage) return;
    const fellFrom = reduced ? null : leaderIndex;
    setFallFromIdx(fellFrom);
    setFallFading(false);
    window.cancelAnimationFrame(fallFadeFrame.current ?? -1);
    if (fellFrom !== null) {
      // mount the taut catch-rope at full opacity, then flip to the CSS
      // transition target on the next frame so it fades out OVER the
      // spring's duration rather than vanishing with it.
      fallFadeFrame.current = window.requestAnimationFrame(() => setFallFading(true));
    }
    setArrestedIdx(lastPassed);
    setSpringOn(true);
    window.clearTimeout(springTimeout.current);
    springTimeout.current = window.setTimeout(() => {
      setSpringOn(false);
      setFallFromIdx(null);
      setFallFading(false);
    }, SPRING_MS);
    setArrestFlashIdx(lastPassed);
    window.clearTimeout(arrestFlashTimeout.current);
    arrestFlashTimeout.current = window.setTimeout(() => setArrestFlashIdx(null), ARREST_FLASH_MS);
    setAssertiveMsg(
      `Arrested. Rolled back to ${targetStage.label} cohort, deployed ${targetStage.timestamp ?? "unknown time"}.`
    );
    onArrest?.(targetStage.id);
  }

  const describeId = `${uid}-target`;
  const targetDesc =
    lastPassed < 0 || !targetStage
      ? "No healthy checkpoint recorded yet — arrest has nothing to fall back to."
      : `Rolls back to ${targetStage.label} cohort, deployed ${targetStage.timestamp ?? "unknown time"}.`;

  const yFor = (i: number) => i * SPACING + SPACING / 2;

  const solidSegments: Array<{ y0: number; y1: number }> = [];
  for (let i = 0; i < n - 1; i++) {
    if (stages[i]?.status === "passed" && stages[i + 1]?.status === "passed") {
      solidSegments.push({ y0: yFor(i), y1: yFor(i + 1) });
    }
  }

  const showLive = lastPassed >= 0 && leaderIndex > lastPassed;
  const bowOffset = reduced ? 0 : clamp(clamp(headroom, 0, 1) * BOW_MAX, 0, BOW_CAP);
  const liveY0 = lastPassed >= 0 ? yFor(lastPassed) : 0;
  const liveY1 = yFor(leaderIndex);
  const liveMidY = (liveY0 + liveY1) / 2;
  const liveD = `M ${LINE_X} ${liveY0} Q ${LINE_X + bowOffset} ${liveMidY} ${LINE_X} ${liveY1}`;

  // the catch-rope: only exists for the SPRING_MS of an arrest, pinned
  // between the target anchor and where the leader fell from, bowed to the
  // same hard-capped 28px — the rope taking the full load, then fading as
  // it settles. Never drawn under reduced motion (fallFromIdx stays null).
  const fallD =
    fallFromIdx !== null && fallFromIdx > lastPassed
      ? (() => {
          const y0 = yFor(lastPassed);
          const y1 = yFor(fallFromIdx);
          const midY = (y0 + y1) / 2;
          return `M ${LINE_X} ${y0} Q ${LINE_X + BOW_CAP} ${midY} ${LINE_X} ${y1}`;
        })()
      : null;

  const leaderTransition = reduced
    ? "none"
    : `transform ${springOn ? SPRING_MS : CLIMB_MS}ms ${springOn ? SPRING_EASE : CLIMB_EASE}`;

  return (
    <div
      className={className}
      role="group"
      aria-label={ariaLabel}
      data-belay-state={arrestedIdx !== null ? "arrested" : "armed"}
    >
      <style>{`
@media (prefers-reduced-motion: reduce){
  .ns-rb-leader{transition:none !important}
  .ns-rb-clip{transition:none !important}
}
`}</style>

      <div className="relative w-full">
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0"
          width={RAIL_W}
          height={totalH}
          viewBox={`0 0 ${RAIL_W} ${totalH}`}
        >
          {/* the permanent conduit — always fully visible */}
          <line x1={LINE_X} y1={yFor(0)} x2={LINE_X} y2={yFor(Math.max(0, n - 1))} stroke="var(--border)" strokeWidth={1} />

          {solidSegments.map((seg, i) => (
            <line
              key={i}
              x1={LINE_X}
              y1={seg.y0}
              x2={LINE_X}
              y2={seg.y1}
              stroke="var(--foreground)"
              strokeWidth={1.5}
            />
          ))}

          {showLive && (
            <path d={liveD} fill="none" stroke="var(--foreground)" strokeOpacity={0.65} strokeWidth={1.5} />
          )}

          {fallD && (
            <path
              d={fallD}
              fill="none"
              stroke="var(--foreground)"
              strokeWidth={1.5}
              strokeDasharray="2 3"
              style={{
                opacity: fallFading ? 0 : 0.9,
                transition: reduced ? "none" : `opacity ${SPRING_MS}ms ease-out`,
              }}
            />
          )}

          {stages.map((s, i) => {
            const y = yFor(i);
            const passed = s.status === "passed";
            const failed = s.status === "failed";
            const isActiveAnchor = i === natural && s.status === "active";
            const clipping = clipFlashIdx === i;
            const flashing = arrestFlashIdx === i;
            return (
              <g key={s.id} transform={`translate(${LINE_X}, ${y})`}>
                {failed ? (
                  <>
                    <line x1={-ANCHOR_R} y1={-ANCHOR_R} x2={ANCHOR_R} y2={ANCHOR_R} stroke="var(--foreground)" strokeWidth={1.5} />
                    <line x1={-ANCHOR_R} y1={ANCHOR_R} x2={ANCHOR_R} y2={-ANCHOR_R} stroke="var(--foreground)" strokeWidth={1.5} />
                  </>
                ) : isActiveAnchor ? (
                  <circle r={ANCHOR_R} fill="none" stroke="var(--foreground)" strokeWidth={1.5} />
                ) : (
                  <circle r={ANCHOR_R} fill={passed ? "var(--foreground)" : "var(--border)"} />
                )}
                {passed && (
                  <ellipse
                    className="ns-rb-clip"
                    cx={0}
                    cy={0}
                    rx={ANCHOR_R + 4}
                    ry={ANCHOR_R + 2}
                    fill="none"
                    stroke="var(--foreground)"
                    strokeWidth={1}
                    opacity={clipping ? 1 : 0.5}
                    style={{ transition: reduced ? "none" : "opacity 140ms ease-out" }}
                  />
                )}
                {flashing && (
                  <circle r={ANCHOR_R + 6} fill="none" stroke="var(--foreground)" strokeWidth={1} opacity={0.85} />
                )}
              </g>
            );
          })}

          <g
            className="ns-rb-leader"
            style={{
              transform: `translate(${LINE_X}px, ${yFor(leaderIndex)}px)`,
              transition: leaderTransition,
            }}
          >
            <circle r={6} fill="var(--background)" stroke="var(--foreground)" strokeWidth={2} />
            <circle r={2} fill="var(--foreground)" />
          </g>
        </svg>

        <ol className="relative m-0 list-none p-0" style={{ paddingLeft: RAIL_W + 16 }}>
          {stages.map((s, i) => {
            const isCurrent = i === leaderIndex;
            return (
              <li
                key={s.id}
                aria-current={isCurrent ? "step" : undefined}
                className="flex flex-col justify-center gap-0.5"
                style={{ height: SPACING }}
              >
                <span className="font-sans text-sm text-foreground">{s.label}</span>
                <span className="font-mono text-[11px] text-ns-muted">
                  {s.status}
                  {s.timestamp ? ` · ${s.timestamp}` : ""}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
        <p className="font-mono text-[11px] text-ns-muted">
          headroom {Math.round(clamp(headroom, 0, 1) * 100)}%
        </p>
        <button
          type="button"
          data-belay-arrest
          disabled={lastPassed < 0}
          aria-describedby={describeId}
          onClick={handleArrest}
          className="rounded-[6px] border border-border px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent disabled:pointer-events-none disabled:opacity-40"
        >
          Arrest rollout
        </button>
      </div>
      <span id={describeId} className="sr-only">
        {targetDesc}
      </span>

      <p aria-live="polite" className="sr-only">
        {politeMsg}
      </p>
      <p aria-live="assertive" className="sr-only">
        {assertiveMsg}
      </p>
    </div>
  );
}
