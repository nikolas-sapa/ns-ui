"use client";

import { useEffect, useRef } from "react";
import { MatCrop } from "./component";

// Self-driving: drags the right mat edge in and out via real PointerEvents
// (catching the grid-while-dragging state), then cycles through the ratio
// presets so the settle transition is visible — no pointer/keyboard input
// from a viewer is ever required.
function firePointer(el: Element, type: string, x: number, y: number) {
  el.dispatchEvent(
    new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, clientX: x, clientY: y, pointerType: "mouse" })
  );
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function dragHandle(handle: Element, stage: Element, dxTotal: number, steps = 16) {
  const rect = handle.getBoundingClientRect();
  const startX = rect.left + rect.width / 2;
  const startY = rect.top + rect.height / 2;
  firePointer(handle, "pointerdown", startX, startY);
  for (let i = 1; i <= steps; i++) {
    await wait(16);
    firePointer(stage, "pointermove", startX + (dxTotal * i) / steps, startY);
  }
  await wait(10);
  firePointer(stage, "pointerup", startX + dxTotal, startY);
}

export default function MatCropDemo() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;

    async function loop() {
      const root = containerRef.current;
      if (!root) return;
      const stage = root.querySelector(".ns-mc-stage");
      if (!stage) return;

      await wait(500);
      while (!isCancelled()) {
        const rightGrip = root.querySelector('[aria-label="Right edge"]');
        if (rightGrip && !isCancelled()) await dragHandle(rightGrip, stage, -50);
        await wait(1400);
        if (isCancelled()) break;

        const btn169 = Array.from(root.querySelectorAll("button")).find((b) => b.textContent === "16:9");
        btn169?.click();
        await wait(2600);
        if (isCancelled()) break;

        const btn11 = Array.from(root.querySelectorAll("button")).find((b) => b.textContent === "1:1");
        btn11?.click();
        await wait(2600);
        if (isCancelled()) break;

        const topGrip = root.querySelector('[aria-label="Top edge"]');
        if (topGrip && !isCancelled()) await dragHandle(topGrip, stage, 0);
        await wait(1200);

        const btnFree = Array.from(root.querySelectorAll("button")).find((b) => b.textContent === "Free");
        btnFree?.click();
        await wait(2400);
      }
    }

    void loop();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / image-crop-mat</p>

      <div ref={containerRef}>
        <MatCrop />
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        Drag a mat edge or corner to define the crop; a rule-of-thirds grid
        appears only while dragging. Ratio presets snap the mats to a settle.
      </p>
    </div>
  );
}
