"use client";

import { useEffect, useMemo, useState } from "react";
import { RelayLane, type RelayLaneTurn } from "./component";

// A realistic parallel fan-out: an orchestrator reads a task, hands off to a
// planner, which fans out to three subagents running concurrently, then
// hands back to the orchestrator to summarize. Timestamps are relative ms
// from a synthetic run start — the demo advances its own relative clock so
// the whole thing plays out with no pointer or keyboard input, exactly the
// "genuinely ambient" case autoplay's mode: none exists to record.

const AGENTS = [
  { id: "orchestrator", label: "Orchestrator" },
  { id: "planner", label: "Planner" },
  { id: "search", label: "Search agent" },
  { id: "codegen", label: "Codegen agent" },
  { id: "reviewer", label: "Reviewer agent" },
];

interface Event {
  turnId: string;
  agentId: string;
  atMs: number;
  kind: "start" | "end";
}

const EVENTS: Event[] = [
  { turnId: "t1", agentId: "orchestrator", atMs: 0, kind: "start" },
  { turnId: "t1", agentId: "orchestrator", atMs: 1800, kind: "end" },
  { turnId: "t2", agentId: "planner", atMs: 1900, kind: "start" },
  { turnId: "t2", agentId: "planner", atMs: 3600, kind: "end" },

  // fan-out: three subagents pick up concurrently from the planner
  { turnId: "t3", agentId: "search", atMs: 3700, kind: "start" },
  { turnId: "t4", agentId: "codegen", atMs: 3800, kind: "start" },
  { turnId: "t5", agentId: "reviewer", atMs: 3900, kind: "start" },
  { turnId: "t3", agentId: "search", atMs: 6200, kind: "end" },
  { turnId: "t4", agentId: "codegen", atMs: 7800, kind: "end" },
  { turnId: "t5", agentId: "reviewer", atMs: 8400, kind: "end" },

  { turnId: "t6", agentId: "orchestrator", atMs: 8500, kind: "start" },
  { turnId: "t6", agentId: "orchestrator", atMs: 10200, kind: "end" },
  { turnId: "t7", agentId: "planner", atMs: 10300, kind: "start" },
  { turnId: "t7", agentId: "planner", atMs: 12600, kind: "end" },

  { turnId: "t8", agentId: "search", atMs: 12700, kind: "start" },
  { turnId: "t9", agentId: "codegen", atMs: 12800, kind: "start" },
  { turnId: "t8", agentId: "search", atMs: 15100, kind: "end" },
  { turnId: "t9", agentId: "codegen", atMs: 16700, kind: "end" },

  { turnId: "t10", agentId: "orchestrator", atMs: 16800, kind: "start" },
  { turnId: "t10", agentId: "orchestrator", atMs: 18600, kind: "end" },
];

const RUN_LENGTH = 18600;
const LOOP_PAUSE = 2400;
const TICK_MS = 200;

function turnsAt(elapsedMs: number): RelayLaneTurn[] {
  const byId = new Map<string, RelayLaneTurn>();
  for (const e of EVENTS) {
    if (e.atMs > elapsedMs) break;
    if (e.kind === "start") {
      byId.set(e.turnId, { id: e.turnId, agentId: e.agentId, start: e.atMs });
    } else {
      const existing = byId.get(e.turnId);
      if (existing) existing.end = e.atMs;
    }
  }
  return Array.from(byId.values());
}

// Seeded mid-fan-out, not at t=0. A rolling "now"-pinned window is empty at the
// start of a run, so a still frame taken a second after mount showed five bare
// lanes — the concurrency, the handoff connectors and the durations, i.e. the
// entire point of the component, only existed a few seconds later. Starting the
// loop where three subagents are in flight means the resting state already
// carries the idea; the loop still wraps to 0 and replays the run from the top.
const SEED_MS = 6000;

export default function RelayLaneDemo() {
  const [elapsed, setElapsed] = useState(SEED_MS);

  useEffect(() => {
    const id = window.setInterval(() => {
      setElapsed((prev) => {
        const next = prev + TICK_MS;
        return next > RUN_LENGTH + LOOP_PAUSE ? 0 : next;
      });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const clampedElapsed = Math.min(elapsed, RUN_LENGTH);
  const turns = useMemo(() => turnsAt(clampedElapsed), [clampedElapsed]);

  // a synthetic epoch anchors the relative clock into real ms so the
  // component's own now/windowMs plumbing (built for wall-clock timestamps)
  // works unmodified — the demo is the only thing that knows it's relative.
  const [epoch] = useState(() => Date.now());
  const now = epoch + clampedElapsed;
  const shiftedTurns = useMemo(
    () =>
      turns.map((t) => ({
        ...t,
        start: t.start + epoch,
        end: t.end !== undefined ? t.end + epoch : undefined,
      })),
    [turns, epoch]
  );

  const running = elapsed < RUN_LENGTH;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / timeline-agent-lanes
      </p>

      <div className="w-full max-w-2xl">
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-sm font-medium text-foreground">
            Fix flaky checkout test — orchestration
          </h2>
          <span className="font-mono text-[11px] text-muted">
            {running ? "in progress" : "settling"}
          </span>
        </div>

        <RelayLane
          agents={AGENTS}
          turns={shiftedTurns}
          now={now}
          windowMs={14000}
          label="Fix flaky checkout test — agent turn tracker"
        />
      </div>

      <p className="max-w-md text-center font-mono text-[10px] text-muted">
        orchestrator hands off to planner, planner fans out to three
        subagents running concurrently, then hands back — stepped connectors
        mark each baton pass with its duration
      </p>
    </div>
  );
}
