"use client";

import { useEffect, useRef, useState } from "react";
import { StarchShear, type StarchShearItem } from "./component";

const ITEMS: StarchShearItem[] = Array.from({ length: 12 }, (_, i) => ({
  id: `frame-${i}`,
  label: `Frame ${i + 1}`,
  caption: `0:${String((i + 1) * 4).padStart(2, "0")}`,
}));

function dispatchPointer(el: Element, type: string, clientX: number) {
  const rect = el.getBoundingClientRect();
  el.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      isPrimary: true,
      clientX,
      clientY: rect.top + rect.height / 2,
    })
  );
}

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Slow, many small samples spaced well apart in time -> low px/ms per
// sample -> the envelope stays low -> the chain visibly cascades.
async function runSlowDrag(el: Element) {
  const rect = el.getBoundingClientRect();
  const startX = rect.left + rect.width * 0.12;
  dispatchPointer(el, "pointerdown", startX);
  for (let i = 1; i <= 10; i++) {
    await wait(90);
    dispatchPointer(el, "pointermove", startX + i * 9);
  }
  await wait(90);
  dispatchPointer(el, "pointerup", startX + 10 * 9);
}

// One large jump in a couple of fast samples -> high px/ms -> the envelope
// spikes -> the chain locks and the strip moves as one piece.
async function runFastDrag(el: Element) {
  const rect = el.getBoundingClientRect();
  const startX = rect.left + rect.width * 0.25;
  dispatchPointer(el, "pointerdown", startX);
  await wait(16);
  dispatchPointer(el, "pointermove", startX + rect.width * 0.5);
  await wait(16);
  dispatchPointer(el, "pointerup", startX + rect.width * 0.5);
}

export default function StarchShearDemo() {
  const [index, setIndex] = useState(1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function cycle() {
      while (!cancelledRef.current) {
        const track = rootRef.current?.querySelector('[role="listbox"]');
        if (track) {
          await runSlowDrag(track);
          await wait(700);
          if (cancelledRef.current) return;
          await runFastDrag(track);
        }
        await wait(1600);
      }
    }
    timer = setTimeout(cycle, 900);
    return () => {
      cancelledRef.current = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <div ref={rootRef} className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / starch-shear</p>

      <div className="w-full max-w-lg rounded-[12px] border border-border bg-background p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="text-sm text-foreground">Reel_master.mov</span>
          <span className="font-mono text-xs tabular-nums text-ns-muted">
            Frame {index + 1} / {ITEMS.length}
          </span>
        </div>

        <StarchShear items={ITEMS} value={index} onValueChange={setIndex} label="Reel frames" />
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        Drag slowly and the strip flows, each frame lagging its neighbor. Flick
        it and the strip locks rigid, moving as one piece.
      </p>
    </div>
  );
}
