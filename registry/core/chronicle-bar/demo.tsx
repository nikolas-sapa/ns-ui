"use client";

import { useEffect, useRef, useState } from "react";
import { ChronicleBar } from "./component";

const PHASES = [
  { at: 12, label: "FONTS" },
  { at: 38, label: "SHADERS" },
  { at: 71, label: "SCENE" },
  { at: 100, label: "READY" },
];

export default function ChronicleBarDemo() {
  const [value, setValue] = useState(0);
  const [run, setRun] = useState(0);
  const pausedRef = useRef(false);

  // simulated build: uneven forward steps, a hold at 100, then a fresh run
  useEffect(() => {
    let t = 0;
    let v = 0;
    let holdUntil = 0;
    setValue(0);
    const step = () => {
      const now = performance.now();
      if (!pausedRef.current) {
        if (v >= 100) {
          if (holdUntil === 0) {
            holdUntil = now + 2600;
          } else if (now >= holdUntil) {
            v = 0;
            holdUntil = 0;
            setValue(0);
          }
        } else {
          v = Math.min(100, v + 2.5 + Math.random() * 8.5);
          setValue(v);
        }
      }
      t = window.setTimeout(step, 340 + Math.random() * 400);
    };
    t = window.setTimeout(step, 500);
    return () => window.clearTimeout(t);
  }, [run]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-12 px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / chronicle-bar
      </p>

      <div
        className="w-full max-w-xl rounded-xl border border-border bg-surface px-8 py-10"
        onPointerEnter={() => {
          pausedRef.current = true;
        }}
        onPointerLeave={() => {
          pausedRef.current = false;
        }}
      >
        <ChronicleBar
          value={value}
          phases={PHASES}
          aria-label="Simulated build progress"
        />
      </div>

      <div className="flex flex-col items-center gap-4">
        <button
          onClick={() => setRun((r) => r + 1)}
          className="rounded-sm border border-border px-4 py-2 font-mono text-xs text-muted transition-colors duration-150 hover:border-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          restart build
        </button>
        <p className="font-mono text-[10px] text-muted">hover the bar to pause</p>
      </div>
    </div>
  );
}
