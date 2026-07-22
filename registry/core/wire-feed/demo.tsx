"use client";

import { useEffect, useRef, useState } from "react";
import { WireFeed, type WireFeedStep } from "./component";

type ScriptStep = {
  label: string;
  ms: number;
  ticks?: { every: number; count: number; format: (n: number) => string };
};

const SCRIPT: ScriptStep[] = [
  { label: "resolving dependencies", ms: 1300 },
  { label: "fetching packages (142)", ms: 2100 },
  { label: "type-checking", ms: 1700 },
  {
    label: "building 1/12",
    ms: 4500,
    ticks: { every: 375, count: 12, format: (n) => `building ${n}/12` },
  },
  { label: "bundling assets", ms: 2500 },
  { label: "verifying checksums", ms: 5200 },
  { label: "uploading artifact", ms: 1800 },
  { label: "promoting to production", ms: 1100 },
];

const FAIL_LABEL = "verifying checksums";
const FAIL_DETAIL =
  "sha256 mismatch: expected 9f2a1c..d04e, got 3bd881..77f2\n  at verifyArtifact (deploy/verify.ts:42)";
const HOLD_AFTER_END_MS = 2800;

export default function WireFeedDemo() {
  const [steps, setSteps] = useState<WireFeedStep[]>([]);
  const [run, setRun] = useState(0);
  const pausedRef = useRef(false);

  // scripted run: real steps arrive one at a time with real elapsed cost;
  // every other run fails partway through "verifying checksums" so both the
  // done-ledger and the pinned-failure state demonstrate themselves without
  // needing input.
  useEffect(() => {
    let raf = 0;
    let idx = 0;
    let stepStart = performance.now();
    let tickN = 1;
    let lastTickAt = performance.now();
    let curId = `r${run}-0`;
    let phase: "running" | "settled" = "running";
    let doneAt = 0;
    const shouldFail = run % 2 === 1;

    const beginStep = (i: number, now: number) => {
      idx = i;
      const sc = SCRIPT[i]!;
      stepStart = now;
      tickN = 1;
      lastTickAt = now;
      curId = `r${run}-${i}`;
      setSteps((prev) => [
        ...prev,
        { id: curId, label: sc.label, status: "active", startedAt: Date.now() },
      ]);
    };

    const finishStep = (asError: boolean) => {
      const endedAt = Date.now();
      setSteps((prev) =>
        prev.map((s) =>
          s.id === curId
            ? {
                ...s,
                status: asError ? "error" : "done",
                endedAt,
                detail: asError ? FAIL_DETAIL : undefined,
              }
            : s
        )
      );
    };

    setSteps([]);
    beginStep(0, performance.now());

    const loop = (now: number) => {
      if (phase === "running" && !pausedRef.current) {
        const sc = SCRIPT[idx]!;
        const isFailStep = shouldFail && sc.label === FAIL_LABEL;
        const target = isFailStep ? Math.min(sc.ms, 3200) : sc.ms;
        const elapsed = now - stepStart;

        if (sc.ticks && now - lastTickAt >= sc.ticks.every && tickN < sc.ticks.count) {
          tickN += 1;
          lastTickAt = now;
          const label = sc.ticks.format(tickN);
          setSteps((prev) => prev.map((s) => (s.id === curId ? { ...s, label } : s)));
        }

        if (elapsed >= target) {
          if (isFailStep) {
            finishStep(true);
            phase = "settled";
            doneAt = now;
          } else if (idx < SCRIPT.length - 1) {
            finishStep(false);
            beginStep(idx + 1, now);
          } else {
            finishStep(false);
            phase = "settled";
            doneAt = now;
          }
        }
      }

      if (phase === "settled" && !pausedRef.current && now - doneAt > HOLD_AFTER_END_MS) {
        setRun((r) => r + 1);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(raf);
  }, [run]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / wire-feed
      </p>

      <div
        className="w-full max-w-md"
        onPointerEnter={() => {
          pausedRef.current = true;
        }}
        onPointerLeave={() => {
          pausedRef.current = false;
        }}
      >
        <WireFeed steps={steps} aria-label="Deploy progress" />
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          onClick={() => setRun((r) => r + 1)}
          className="rounded-sm border border-border px-4 py-2 font-mono text-xs text-muted transition-colors duration-150 hover:border-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          restart deploy
        </button>
        <p className="font-mono text-[10px] text-muted">
          hover the feed to pause · focus it and use arrow keys to review the ledger
        </p>
      </div>
    </div>
  );
}
