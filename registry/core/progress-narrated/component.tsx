"use client";

import { useEffect, useRef, useState } from "react";

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@*+=";
const CHAR_MS = 1000 / 24; // 24 chars/s typing cadence
const FILL_MS = 450; // fill glide per value change
const DOCK_MS = 220; // caption shrink-and-fade on phase completion

// cubic-bezier(0.22, 1, 0.36, 1) solved via Newton–Raphson (house glideEase)
function makeBezier(p1x: number, p1y: number, p2x: number, p2y: number) {
  const cx = 3 * p1x;
  const bx = 3 * (p2x - p1x) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * p1y;
  const by = 3 * (p2y - p1y) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const s = slopeX(t);
      if (Math.abs(s) < 1e-6) break;
      t -= (sampleX(t) - x) / s;
    }
    return sampleY(Math.min(1, Math.max(0, t)));
  };
}
const glideEase = makeBezier(0.22, 1, 0.36, 1);
const easeOutCubic = (p: number) => 1 - (1 - p) ** 3;

function formatElapsed(ms: number) {
  const total = Math.max(0, ms) / 1000;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return `${String(m).padStart(2, "0")}:${s < 10 ? "0" : ""}${s.toFixed(1)}`;
}

export type ChroniclePhase = {
  /** progress percent (0-100] at which this phase completes */
  at: number;
  /** mono caption typed at the leading edge, docked below on completion */
  label: string;
};

type Milestone = { at: number; label: string; elapsed: number };

const DEFAULT_PHASES: ChroniclePhase[] = [
  { at: 25, label: "ASSETS" },
  { at: 60, label: "COMPILE" },
  { at: 100, label: "READY" },
];

// ---------------------------------------------------------------------------
// ChronicleBar — determinate progress bar whose fill front is a live
// narrator: a mono caption types itself at the leading edge (first three
// glyphs scramble-decode before locking), then shrinks and docks below the
// track as a timestamped milestone tick. A finished bar reads as a ledger of
// everything the loader did. Fill/cursor/caption are direct-DOM writes from
// one rAF loop that sleeps whenever nothing is easing or typing; a
// decreasing `value` resets the ledger for a new run.
// ---------------------------------------------------------------------------
export function ChronicleBar({
  value = 0,
  phases = DEFAULT_PHASES,
  className = "",
  "aria-label": ariaLabel = "Progress",
}: {
  /** progress 0-100 (controlled); a decrease resets the ledger */
  value?: number;
  /** phases in ascending order of `at` */
  phases?: ChroniclePhase[];
  /** extra classes merged onto the rendered root element */
  className?: string;
  /** accessible name for the progress bar. Default "Progress". */
  "aria-label"?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLSpanElement>(null);
  const pushRef = useRef<((v: number, reset: boolean) => void) | null>(null);
  const prevRef = useRef<number | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);

  // content-derived key: rebuild the narrator only when the phase sequence
  // itself changes, not on every inline-array re-render from the consumer
  const phasesKey = phases.map((p) => `${p.at}:${p.label}`).join("|");

  useEffect(() => {
    const track = trackRef.current;
    const fill = fillRef.current;
    const cursor = cursorRef.current;
    const caption = captionRef.current;
    if (!track || !fill || !cursor || !caption) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const list = [...phases].sort((a, b) => a.at - b.at);

    // hot-path state — locals only, never React state
    let raf = 0;
    let display = 0; // eased fill percent
    let from = 0;
    let to = 0;
    let animStart = -1; // -1 = width settled
    let pi = 0; // index of the phase currently narrating
    let capState: "typing" | "settled" | "docking" | "done" = "done";
    let capScale = 1;
    let typeStart = 0;
    let dockStart = 0;
    let pending: Milestone | null = null;
    let clockStart = performance.now();
    let trackW = track.clientWidth;
    let captionW = 0;
    let lastLen = -1;

    const paintPositions = () => {
      fill.style.width = `${display}%`;
      const px = (display / 100) * trackW;
      cursor.style.transform = `translate3d(${Math.min(
        Math.max(0, px - 1),
        Math.max(0, trackW - 2)
      )}px,0,0)`;
      // narrator done: the cursor block has nothing left to say
      cursor.style.opacity = display >= 100 && animStart < 0 ? "0" : "1";
      const cx = Math.min(Math.max(0, px), Math.max(0, trackW - captionW));
      caption.style.transform = `translate3d(${cx}px,0,0) scale(${capScale})`;
    };

    const resetRun = (v: number, now: number) => {
      display = Math.min(100, Math.max(0, v));
      animStart = -1;
      pi = 0;
      clockStart = now;
      pending = null;
      capState = list.length ? "typing" : "done";
      capScale = 1;
      typeStart = now;
      lastLen = -1;
      captionW = 0;
      caption.textContent = "";
      caption.style.opacity = "1";
      setMilestones([]);
    };

    const loop = (now: number) => {
      let busy = false;

      if (animStart >= 0) {
        const p = (now - animStart) / FILL_MS;
        if (p >= 1) {
          display = to;
          animStart = -1;
        } else {
          display = from + (to - from) * glideEase(p);
          busy = true;
        }
      }

      let ph = list[pi];

      // phase completion: the fill front crossed the phase mark
      if (ph && capState !== "docking" && capState !== "done" && display >= ph.at) {
        capState = "docking";
        dockStart = now;
        pending = { at: ph.at, label: ph.label, elapsed: now - clockStart };
      }

      if (capState === "typing" && ph) {
        const n = Math.min(
          ph.label.length,
          Math.floor((now - typeStart) / CHAR_MS)
        );
        let text = ph.label.slice(0, n);
        if (n < ph.label.length) {
          busy = true;
          // decrypt dose: each of the first 3 glyphs churns ~2 frames, locks
          if (n < 3) {
            text += CHARSET[Math.floor(Math.random() * CHARSET.length)];
          }
        } else {
          capState = "settled";
        }
        caption.textContent = text;
        if (text.length !== lastLen) {
          lastLen = text.length;
          captionW = caption.offsetWidth;
        }
      } else if (capState === "docking") {
        const p = Math.min(1, (now - dockStart) / DOCK_MS);
        const e = easeOutCubic(p);
        capScale = 1 - 0.08 * e;
        caption.style.opacity = String(1 - e);
        if (p < 1) {
          busy = true;
        } else {
          const m = pending;
          pending = null;
          if (m) setMilestones((prev) => [...prev, m]);
          pi += 1;
          ph = list[pi];
          capScale = 1;
          if (ph) {
            capState = "typing";
            typeStart = now;
            lastLen = -1;
            captionW = 0;
            caption.textContent = "";
            caption.style.opacity = "1";
            busy = true;
          } else {
            capState = "done";
            caption.textContent = "";
          }
        }
      }

      paintPositions();
      raf = busy ? requestAnimationFrame(loop) : 0; // sleep when settled
    };
    const wake = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };

    const push = (v: number, reset: boolean) => {
      const now = performance.now();
      const cl = Math.min(100, Math.max(0, v));
      if (reset) {
        resetRun(cl, now);
      } else if (cl !== display) {
        from = display;
        to = cl;
        animStart = now;
      }
      wake();
    };

    // reduced motion: fill jumps, captions render fully typed, ticks land now
    const pushReduced = (v: number, reset: boolean) => {
      const now = performance.now();
      if (reset) resetRun(v, now);
      display = Math.min(100, Math.max(0, v));
      const done: Milestone[] = [];
      while (pi < list.length) {
        const ph = list[pi];
        if (!ph || display < ph.at) break;
        done.push({ at: ph.at, label: ph.label, elapsed: now - clockStart });
        pi += 1;
      }
      if (done.length) setMilestones((prev) => [...prev, ...done]);
      const active = list[pi];
      caption.textContent = active ? active.label : "";
      caption.style.opacity = "1";
      capScale = 1;
      capState = active ? "settled" : "done";
      captionW = caption.offsetWidth;
      paintPositions();
    };

    pushRef.current = reduced ? pushReduced : push;
    resetRun(0, performance.now());
    pushRef.current(prevRef.current ?? 0, false);

    const ro = new ResizeObserver(() => {
      trackW = track.clientWidth;
      if (reduced) paintPositions();
      else wake(); // one paint pass, then back to sleep
    });
    ro.observe(track);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      pushRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on phasesKey, not the phases reference
  }, [phasesKey]);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = value;
    pushRef.current?.(value, prev !== null && value < prev);
  }, [value]);

  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className={className}>
      <style>{`@keyframes ns-chronicle-in{from{opacity:0}to{opacity:1}}
.ns-chronicle-in{animation:ns-chronicle-in 260ms ease-out both}
@media (prefers-reduced-motion: reduce){.ns-chronicle-in{animation:none}}`}</style>

      {/* narrator caption, anchored to the leading edge */}
      <div className="relative h-6 mb-1" aria-hidden>
        <span
          ref={captionRef}
          className="absolute bottom-0 left-0 origin-bottom-left whitespace-nowrap font-mono text-sm text-foreground will-change-transform"
        />
      </div>

      {/* track: hairline border, transparent bed */}
      <div
        ref={trackRef}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped)}
        aria-label={ariaLabel}
        className="relative h-1 rounded-full border border-border"
      >
        <div
          ref={fillRef}
          className="absolute inset-y-0 left-0 w-0 rounded-full bg-foreground"
        />
        {/* leading-edge cursor block — the only accent on the page */}
        <div
          ref={cursorRef}
          className="absolute -top-0.5 left-0 h-2 w-0.5 bg-ns-accent transition-opacity duration-300"
        />
      </div>

      {/* docked milestone ledger */}
      <div className="relative mt-2 h-7" aria-hidden>
        {milestones.map((m) => (
          <div key={`${m.at}-${m.label}`} className="ns-chronicle-in">
            <span
              className="absolute top-0 h-2 w-0.5 -translate-x-1/2 bg-ns-muted"
              style={{ left: `${m.at}%` }}
            />
            <span
              className="absolute top-3 whitespace-nowrap font-mono text-[11px] tracking-wide text-ns-muted"
              style={{
                left: `${m.at}%`,
                transform:
                  m.at >= 90
                    ? "translateX(-100%)"
                    : m.at > 10
                      ? "translateX(-50%)"
                      : undefined,
              }}
            >
              {m.label} {formatElapsed(m.elapsed)}
            </span>
          </div>
        ))}
      </div>

      {/* screen readers hear the ledger as it accrues */}
      <div aria-live="polite" className="sr-only">
        {milestones
          .map((m) => `${m.label} complete at ${formatElapsed(m.elapsed)}`)
          .join(", ")}
      </div>
    </div>
  );
}
