"use client";

import { useEffect, useRef } from "react";
import { DeedStroke } from "./component";

// Self-driving: dispatches real PointerEvents at the canvas to draw a
// signature, waits out the witness replay, confirms, pauses on the
// embossed "Authorized" state, clears, and repeats — no pointer/keyboard
// input from a viewer is ever in the loop, so screenshots always catch a
// meaningful mid-interaction state.
function firePointer(el: Element, type: string, x: number, y: number) {
  el.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      clientX: x,
      clientY: y,
      pointerType: "mouse",
    })
  );
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function signCanvas(canvas: HTMLCanvasElement, cancelled: () => boolean) {
  const rect = canvas.getBoundingClientRect();
  const baseY = rect.top + rect.height * 0.55;
  const steps = 36;
  const pts: [number, number][] = Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const x = rect.left + 20 + t * (rect.width - 40);
    const y = baseY + Math.sin(t * Math.PI * 2.6) * 16 * Math.sin(t * Math.PI);
    return [x, y];
  });
  const first = pts[0]!;
  firePointer(canvas, "pointerdown", first[0], first[1]);
  for (let i = 1; i < pts.length; i++) {
    if (cancelled()) return;
    await wait(14);
    const p = pts[i]!;
    firePointer(canvas, "pointermove", p[0], p[1]);
  }
  const last = pts[pts.length - 1]!;
  firePointer(canvas, "pointerup", last[0], last[1]);
}

export default function DeedStrokeDemo() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;

    async function loop() {
      const root = containerRef.current;
      if (!root) return;
      while (!isCancelled()) {
        await wait(1300);
        if (isCancelled()) break;
        const canvas = root.querySelector("canvas");
        if (canvas) await signCanvas(canvas, isCancelled);
        await wait(1100); // witness replay settles, Confirm unlocks
        if (isCancelled()) break;
        const confirmBtn = Array.from(root.querySelectorAll("button")).find(
          (b) => b.textContent === "Confirm"
        );
        confirmBtn?.click();
        await wait(2400); // hold the embossed "Authorized" state
        if (isCancelled()) break;
        const clearBtn = Array.from(root.querySelectorAll("button")).find(
          (b) => b.textContent === "Clear"
        );
        clearBtn?.click();
        await wait(900);
      }
    }

    void loop();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / signature-consent</p>

      <div ref={containerRef}>
        <DeedStroke />
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        Draw to sign, or switch to typing your name. A witness replay retraces
        the stroke at a steady pace before Confirm unlocks.
      </p>
    </div>
  );
}
