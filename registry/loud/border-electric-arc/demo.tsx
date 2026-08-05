"use client";

import { useEffect, useRef } from "react";
import { SparkGap } from "./component";

// Self-driving: a synthetic cursor orbits the button on a slow ellipse via
// real MouseEvents dispatched on window — exercising the actual
// gap-follows-cursor code path, no special props — and every few seconds a
// synthetic pointerdown/up on the button plays the full discharge flash.

const ORBIT_MS = 40;
const ORBIT_STEP = 0.05;
const ORBIT_PAD = 16; // ellipse radius beyond the button's half-extent
const PRESS_EVERY_MS = 6000;
const PRESS_HOLD_MS = 140;

export default function SparkGapDemo() {
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const btn = stage.querySelector("button");
    if (!btn) return;

    let angle = 0;
    let holdTimer: number | undefined;

    const orbit = window.setInterval(() => {
      if (document.hidden) return;
      const r = btn.getBoundingClientRect();
      if (r.width === 0) return;
      angle += ORBIT_STEP;
      const cx =
        r.left + r.width / 2 + Math.cos(angle) * (r.width / 2 + ORBIT_PAD);
      const cy =
        r.top + r.height / 2 + Math.sin(angle) * (r.height / 2 + ORBIT_PAD);
      window.dispatchEvent(
        new MouseEvent("mousemove", { clientX: cx, clientY: cy, bubbles: true })
      );
    }, ORBIT_MS);

    const press = window.setInterval(() => {
      if (document.hidden) return;
      btn.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 })
      );
      holdTimer = window.setTimeout(() => {
        btn.dispatchEvent(
          new PointerEvent("pointerup", { bubbles: true, pointerId: 1 })
        );
      }, PRESS_HOLD_MS);
    }, PRESS_EVERY_MS);

    return () => {
      window.clearInterval(orbit);
      window.clearInterval(press);
      window.clearTimeout(holdTimer);
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / border-electric-arc
      </p>

      <div ref={stageRef} className="flex items-center justify-center py-8">
        <SparkGap label="Get Started" />
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        A live-wire border: bring the cursor close and the stroke opens a gap
        that tracks you, with an arc jumping across it. Press for the full
        discharge — the wire flashes, then runs spent for two seconds.
      </p>
    </div>
  );
}
