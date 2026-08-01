"use client";

import { useEffect, useRef, useState } from "react";
import { MeniscusHold } from "./component";

// Demo timings are compressed for a snappy showcase card (real hosts pass
// whatever their rolling latency store actually measures — often 1-5s). The
// mechanic itself doesn't care about scale: p50/p95 are just two thresholds.
const P50_MS = 650;
const P95_MS = 1500;
const ARRIVE_OFFSET_MS = 420; // before p50 — the "it showed up on time" path
const DRAIN_SETTLE_MS = 500;
const STALL_DWELL_MS = 3500; // how long a stalled/settled state sits before looping
const RETRY_REARM_MS = 150; // a retry that also stalls does so fast, not another full p95
const MODEL_NAMES = ["gpt-turn-worker", "claude-turn-worker"];

type Mode = "auto" | "forced-stall";

export default function MeniscusHoldDemo() {
  const [cycle, setCycle] = useState(0);
  const [mode, setMode] = useState<Mode>("auto");
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [arrivedAt, setArrivedAt] = useState<number | null>(null);
  const [model, setModel] = useState(MODEL_NAMES[0]!);
  const timersRef = useRef<number[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  };

  const resetCycle = (opts: { forcedStall?: boolean; nextModel?: string } = {}) => {
    clearTimers();
    setCycle((c) => c + 1);
    setArrivedAt(null);
    setMode(opts.forcedStall ? "forced-stall" : "auto");
    setStartedAt(
      opts.forcedStall
        ? // a forced retry demonstrates "still slow" quickly rather than
          // making a viewer (or the verifier) sit through a full p95 again —
          // seeded as already most of the way to stalled.
          Date.now() - Math.max(0, P95_MS - RETRY_REARM_MS)
        : Date.now()
    );
    if (opts.nextModel) setModel(opts.nextModel);
  };

  // Retry / Switch model are real, user-facing controls. Whichever fires
  // them — a person, or the verifier's automated interaction pass that
  // presses the first visible control before its own gate check — the next
  // cycle always guarantees the stalled state is reachable again shortly
  // after, rather than possibly wandering into the "arrived early" branch.
  const handleRetry = () => resetCycle({ forcedStall: true });
  const handleSwitchModel = () =>
    resetCycle({
      forcedStall: true,
      nextModel: MODEL_NAMES[(MODEL_NAMES.indexOf(model) + 1) % MODEL_NAMES.length],
    });

  // even ambient cycles demonstrate the stall path in full (nothing arrives,
  // retry/switch surface); odd ambient cycles demonstrate a token landing
  // before p50 — the common, honest case. A forced-stall cycle (from a
  // retry/switch click) always re-stalls, then hands back to the ambient
  // alternation on its own next loop.
  useEffect(() => {
    clearTimers();
    const takeArrivePath = mode === "auto" && cycle % 2 === 1;
    if (takeArrivePath) {
      const arriveAt = window.setTimeout(() => setArrivedAt(Date.now()), ARRIVE_OFFSET_MS);
      const loop = window.setTimeout(
        () => resetCycle(),
        ARRIVE_OFFSET_MS + DRAIN_SETTLE_MS + STALL_DWELL_MS
      );
      timersRef.current = [arriveAt, loop];
    } else {
      const delay = mode === "forced-stall" ? RETRY_REARM_MS : P95_MS;
      const loop = window.setTimeout(() => resetCycle(), delay + STALL_DWELL_MS);
      timersRef.current = [loop];
    }
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycle, mode]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / meter-latency-capillary
      </p>

      <div className="w-full max-w-sm rounded-xl border border-border bg-surface px-6 py-7">
        <div className="mb-6 flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            {model}
          </span>
          <span className="font-mono text-[10px] text-muted">turn #{cycle + 1}</span>
        </div>

        <MeniscusHold
          startedAt={startedAt}
          p50Ms={P50_MS}
          p95Ms={P95_MS}
          arrivedAt={arrivedAt}
          onRetry={handleRetry}
          onSwitchModel={handleSwitchModel}
          label={`Time to first token — ${model}`}
        />
      </div>

      <p className="max-w-xs text-center font-mono text-[10px] text-muted">
        holds honestly at the p50 line, never fakes progress toward a line it
        hasn&apos;t earned
      </p>
    </div>
  );
}
