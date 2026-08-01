"use client";

import { LiquidCollar } from "./component";

// Self-driving: the liquid band animates on its own (no rAF-only-on-hover
// gating), so the demo needs no synthetic input to prove it's alive. Hover
// or press the hero button to see the metal react.
export default function LiquidCollarDemo() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-14 bg-background px-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          ns-ui / liquid-collar
        </p>
        <p className="text-xs text-muted">
          Molten chrome wrapping a control — press it, the metal pools toward your cursor.
        </p>
      </div>
      <div className="flex flex-col items-center gap-10">
        <LiquidCollar variant="pill" radius={14} ringWidth={20} className="card-focus">
          <button
            style={{ borderRadius: 14 }}
            className="bg-surface px-12 py-5 text-base font-medium text-foreground"
          >
            Continue
          </button>
        </LiquidCollar>
        <LiquidCollar variant="circle" ringWidth={10}>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-sm font-medium text-foreground">
            AB
          </div>
        </LiquidCollar>
      </div>
    </div>
  );
}
