"use client";

import { useEffect, useRef } from "react";
import { DetentSwipe } from "./component";

// Self-driving: the first row is dragged open via real PointerEvents on a
// loop (archive detent, then flag detent, then closed) so screenshots always
// catch a genuinely revealed, hittable action — the other three rows sit
// idle for scale/context. No pointer/keyboard input from a viewer is ever
// required.
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

async function dragBy(el: HTMLElement, deltaRaw: number, steps = 14) {
  const rect = el.getBoundingClientRect();
  const startX = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  firePointer(el, "pointerdown", startX, y);
  for (let i = 1; i <= steps; i++) {
    await wait(16);
    firePointer(el, "pointermove", startX - (deltaRaw * i) / steps, y);
  }
  await wait(10);
  firePointer(el, "pointerup", startX - deltaRaw, y);
}

const ROWS = [
  { title: "Priya Chandra", subtitle: "Renewal terms attached for Q3 — take a look before Friday" },
  { title: "Ops Digest", subtitle: "Nightly build passed, 2 flaky tests quarantined" },
  { title: "Marcus Webb", subtitle: "Following up on the detent feel — does it click enough?" },
  { title: "Billing", subtitle: "Your statement is ready to view" },
];

export default function DetentSwipeDemo() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;

    async function loop() {
      const root = containerRef.current;
      if (!root) return;
      await wait(350);
      while (!isCancelled()) {
        const el = root.querySelector<HTMLElement>(".ns-dtx-content");
        if (!el) return;
        await dragBy(el, 80); // -> archive detent
        await wait(4200);
        if (isCancelled()) return;
        await dragBy(el, 60); // -> flag detent
        await wait(4200);
        if (isCancelled()) return;
        await dragBy(el, -136); // -> back to rest
        await wait(1400);
      }
    }

    void loop();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">ns-ui / detent-swipe</p>

      <div ref={containerRef} className="w-full max-w-md overflow-hidden rounded-[12px] border border-border">
        {ROWS.map((row) => (
          <DetentSwipe key={row.title} title={row.title} subtitle={row.subtitle} />
        ))}
      </div>

      <p className="max-w-md text-center text-xs text-muted">
        Drag a row left — it clicks through Archive and Flag detents, then
        resists and arms Delete past the hard stop, with a 3s undo before it
        commits.
      </p>
    </div>
  );
}
