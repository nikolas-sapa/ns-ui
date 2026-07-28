"use client";

import { useEffect, useRef, useState } from "react";
import { SolderBridge } from "./component";

// Self-driving toggle loop plus a second, non-interactive instance pinned to
// a partial `ratio` to show that prop independent of the boolean switch.
const SCRIPT: boolean[] = [false, true, false, true];

export default function SolderBridgeDemo() {
  const [step, setStep] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const checked = SCRIPT[step % SCRIPT.length]!;

  useEffect(() => {
    timerRef.current = setTimeout(() => setStep((s) => s + 1), 2200);
    return () => clearTimeout(timerRef.current);
  }, [step]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / solder-bridge
      </p>

      <div className="flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3">
          <SolderBridge checked={checked} aria-label="Route traffic to secondary" />
          <p className="font-mono text-[11px] uppercase tracking-wide text-muted">
            {checked ? "on — 90% routed right" : "off — 90% routed left"}
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <SolderBridge ratio={0.35} aria-label="Cache allocation" />
          <p className="font-mono text-[11px] uppercase tracking-wide text-muted">
            ratio=0.35 — partial allocation
          </p>
        </div>
      </div>

      <p className="max-w-md text-center text-xs text-muted">
        Click or press Space to toggle. Mass melts across the neck and
        pinches off; the ratio prop renders any partial split directly.
      </p>
    </div>
  );
}
