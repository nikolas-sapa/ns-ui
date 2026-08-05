"use client";

import { useEffect, useRef, useState } from "react";
import { SprocketScrub } from "./component";

const DURATION = 90;
const PLAY_TICK_MS = 500;

function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}

// Dispatches a real PointerEvent sequence at a DOM node so the demo can show
// off both drag regimes unattended: a slow multi-step move (low px/ms, drives
// the discrete perforation-snap path) and a fast single jump (high px/ms,
// drives the continuous glide path). This exercises the actual component
// interaction code, not a fake stand-in for it.
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

async function runSlowDrag(el: Element) {
  const rect = el.getBoundingClientRect();
  const startX = rect.left + rect.width * 0.15;
  dispatchPointer(el, "pointerdown", startX);
  for (let i = 1; i <= 8; i++) {
    await wait(70);
    dispatchPointer(el, "pointermove", startX + i * 14);
  }
  await wait(70);
  dispatchPointer(el, "pointerup", startX + 8 * 14);
}

async function runFastDrag(el: Element) {
  const rect = el.getBoundingClientRect();
  const startX = rect.left + rect.width * 0.3;
  dispatchPointer(el, "pointerdown", startX);
  await wait(20);
  dispatchPointer(el, "pointermove", startX + rect.width * 0.45);
  await wait(20);
  dispatchPointer(el, "pointerup", startX + rect.width * 0.45);
}

export default function SprocketScrubDemo() {
  const [value, setValue] = useState(6);
  const [buffered, setBuffered] = useState(24);
  const [playing, setPlaying] = useState(true);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const cancelledRef = useRef(false);

  // Playback: ticks value forward at a steady rate while playing, buffer
  // keeps a lead over the playhead. Purely a glide — the two-regime split is
  // demonstrated separately below, by real drag gestures.
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setValue((v) => (v + 1 > DURATION ? 0 : v + 1));
      setBuffered((b) => Math.min(DURATION, b + 0.6));
    }, PLAY_TICK_MS);
    return () => window.clearInterval(id);
  }, [playing]);

  // Self-driving loop: play a stretch, pause and demonstrate a slow scrub
  // (snap regime), then a fast scrub (glide regime), then resume playback.
  useEffect(() => {
    cancelledRef.current = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function cycle() {
      while (!cancelledRef.current) {
        setPlaying(true);
        await wait(4000);
        if (cancelledRef.current) return;

        setPlaying(false);
        const track = rootRef.current?.querySelector("[data-sprocket-track]");
        if (track) {
          await runSlowDrag(track);
          await wait(500);
          if (cancelledRef.current) return;
          await runFastDrag(track);
        }
        await wait(600);
      }
    }
    timer = setTimeout(cycle, 800);
    return () => {
      cancelledRef.current = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <div ref={rootRef} className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / scrubber-film-strip</p>

      <div className="w-full max-w-lg rounded-[12px] border border-border bg-background p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="truncate text-sm text-foreground">Interview_master.mov</span>
          <div className="flex items-center gap-2 font-mono text-xs tabular-nums text-ns-muted">
            <button
              type="button"
              aria-label={playing ? "Pause" : "Play"}
              onClick={() => setPlaying((p) => !p)}
              className="flex h-7 w-7 items-center justify-center rounded-[6px] border border-border text-foreground hover:bg-border/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
            >
              {playing ? (
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                  <rect x="1" y="0.5" width="3" height="9" fill="currentColor" />
                  <rect x="6" y="0.5" width="3" height="9" fill="currentColor" />
                </svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                  <path d="M1 0.5 L9 5 L1 9.5 Z" fill="currentColor" />
                </svg>
              )}
            </button>
            <span>
              {formatClock(value)} / {formatClock(DURATION)}
            </span>
          </div>
        </div>

        <SprocketScrub value={value} duration={DURATION} buffered={buffered} onValueChange={setValue} />
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        Drag slowly to feel the claw catch each perforation; drag fast and it
        releases into a continuous glide.
      </p>
    </div>
  );
}
