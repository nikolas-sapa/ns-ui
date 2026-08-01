"use client";

import { useEffect, useRef } from "react";
import { StitchPick } from "./component";

const TEXT = "UNRAVEL";

function dispatchPointer(el: Element, type: string, clientX: number, clientY: number) {
  el.dispatchEvent(
    new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, clientX, clientY })
  );
}

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function letterX(rect: DOMRect, index: number) {
  const advance = rect.width / TEXT.length;
  return rect.left + advance * (index + 0.5);
}

// Self-driving tour of the whole state machine: a quick sweep (pick + auto
// re-stitch on each letter), a long dwell on one letter (fully unravels into
// a pile), a click on that letter (resews it), two more dwells followed by
// clicking the "Re-sew" button (resews everything at once).
async function runScript(root: HTMLElement, cancelled: () => boolean) {
  const svg = root.querySelector("svg");
  if (!svg) return;
  const rect = svg.getBoundingClientRect();
  const y = rect.top + rect.height * 0.55;

  // quick sweep across the first few letters
  for (let i = 0; i < 4 && !cancelled(); i++) {
    dispatchPointer(svg, "pointermove", letterX(rect, i), y);
    await wait(160);
  }
  dispatchPointer(svg, "pointerleave", letterX(rect, 4), y);
  await wait(500);
  if (cancelled()) return;

  // dwell on letter 1 until it unravels, then click to resew it
  dispatchPointer(svg, "pointermove", letterX(rect, 1), y);
  await wait(900);
  if (cancelled()) return;
  dispatchPointer(svg, "click", letterX(rect, 1), y);
  await wait(400);
  dispatchPointer(svg, "pointerleave", letterX(rect, 1), y);
  await wait(600);
  if (cancelled()) return;

  // dwell on two letters, then resew everything via the button
  dispatchPointer(svg, "pointermove", letterX(rect, 2), y);
  await wait(900);
  if (cancelled()) return;
  dispatchPointer(svg, "pointermove", letterX(rect, 5), y);
  await wait(900);
  dispatchPointer(svg, "pointerleave", letterX(rect, 5), y);
  if (cancelled()) return;
  await wait(500);

  const resewBtn = root.querySelector<HTMLButtonElement>(".ns-stitch-resew");
  resewBtn?.click();
  await wait(1400);
}

export default function StitchPickDemo() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function loop() {
      while (!cancelledRef.current) {
        if (rootRef.current) {
          await runScript(rootRef.current, () => cancelledRef.current);
        }
        await wait(700);
      }
    }
    timer = setTimeout(loop, 700);
    return () => {
      cancelledRef.current = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <div ref={rootRef} className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">ns-ui / text-stitch-unpick</p>

      <StitchPick text={TEXT} />

      <p className="max-w-md text-center text-xs text-muted">
        Pass the seam ripper over a letter to pick its stitches loose; linger
        and it fully unravels into a pile you have to re-sew.
      </p>
    </div>
  );
}
