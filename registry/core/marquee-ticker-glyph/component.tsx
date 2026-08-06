"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// GlyphScrubTicker — a marquee that is an instrument, not a loop. Unlike a
// plain auto-scrolling ticker, the tape is GRABBABLE: pointerdown+drag scrubs
// it directly under the cursor (1:1, no easing while held), release throws it
// with momentum that decays under friction, and — the mechanic no sibling
// ticker has — per-character LEGIBILITY IS A FUNCTION OF INSTANTANEOUS SPEED.
// Below a resolve threshold (ambient auto-scroll speed, and the tail of every
// fling) each character renders its real glyph. Above it (an active scrub or
// the fast part of a fling) visible cells swap to a churning noise charset,
// re-rolled every couple of frames — the tape reads as blurred motion, then
// snaps back into focus the instant it slows down. One direct-DOM rAF loop
// drives position + per-cell textContent; no React state on the hot path.
// The real string is always exposed via aria-label per item (role=listitem,
// roving tabindex); the glyph cells themselves are aria-hidden, so a screen
// reader always hears the resolved value regardless of what's on screen.
// ---------------------------------------------------------------------------

export interface GlyphScrubTickerProps {
  /** items rendered in order, looped end to end */
  items: string[];
  /** glyph placed between items, including at the wrap seam */
  separator?: string;
  /** ambient auto-scroll speed in px/s while untouched and unpaused */
  speed?: number;
  /** px/s above which cells blur into noise glyphs (ambient speed should sit under this) */
  resolveThreshold?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const NOISE_CHARSET = "░▒▓#%&@*+=-:.";
const FRICTION = 0.94; // per-frame velocity decay after release (~60fps)
const MIN_FLING_V = 40; // px/s below which a release doesn't fling at all
const CELL_PROBE_CHAR = "0";

export function GlyphScrubTicker({
  items,
  separator = "/",
  speed = 34,
  resolveThreshold = 260,
  className = "",
}: GlyphScrubTickerProps) {
  const uid = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const [reduced, setReduced] = useState(false);
  const [paused, setPaused] = useState(false);

  const tape = useMemo(() => {
    if (items.length === 0) return "";
    return ` ${items.join(` ${separator} `)} ${separator} `;
  }, [items, separator]);

  const label = useMemo(() => items.join(", "), [items]);

  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    const probe = probeRef.current;
    if (!container || !track || !probe || tape.length === 0) return;

    let cellWidth = probe.getBoundingClientRect().width || 8;
    let cells: HTMLSpanElement[] = [];
    let offset = 0; // fractional tape position, in characters
    let velocity = 0; // characters/sec, signed (negative = feeding forward)
    let raf = 0;
    let last = 0;
    let dragging = false;
    let dragLastX = 0;
    let dragLastT = 0;
    let hovering = false;
    let focused = false;

    const charAt = (absIndex: number) =>
      tape[((Math.floor(absIndex) % tape.length) + tape.length) % tape.length] ?? " ";

    const rebuild = () => {
      cellWidth = probe.getBoundingClientRect().width || cellWidth;
      const w = container.getBoundingClientRect().width;
      const count = Math.max(1, Math.ceil(w / cellWidth) + 1);
      track.textContent = "";
      cells = [];
      for (let i = 0; i < count; i++) {
        const span = document.createElement("span");
        span.setAttribute("aria-hidden", "true");
        span.style.display = "inline-block";
        span.style.width = `${cellWidth}px`;
        span.style.textAlign = "center";
        span.style.flexShrink = "0";
        track.appendChild(span);
        cells.push(span);
      }
      paint(0);
    };

    // paints every visible cell from the current offset + a resolved-vs-noise
    // decision driven by |speedPxPerSec|. Cells always keep a stable-width
    // monospace glyph (real char or a noise charset member) — never blank —
    // so nothing reflows.
    const paint = (speedPxPerSec: number) => {
      const blurred = Math.abs(speedPxPerSec) > resolveThreshold;
      for (let i = 0; i < cells.length; i++) {
        const idx = offset + i;
        if (blurred) {
          cells[i]!.textContent =
            NOISE_CHARSET[Math.floor(Math.random() * NOISE_CHARSET.length)]!;
        } else {
          cells[i]!.textContent = charAt(idx);
        }
      }
    };

    if (reduced) {
      rebuild();
      const ro = new ResizeObserver(rebuild);
      ro.observe(container);
      return () => ro.disconnect();
    }

    rebuild();

    const loop = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;

      if (dragging) {
        // 1:1 scrub — position and velocity both come straight from pointer
        // deltas in onMove; nothing to integrate here.
      } else {
        const stopped = pausedRef.current || hovering || focused;
        const target = stopped ? 0 : -speed / cellWidth;
        if (Math.abs(velocity) > MIN_FLING_V / cellWidth || Math.abs(target) > 0.001) {
          // momentum decay toward the ambient target speed
          velocity += (target - velocity) * (1 - Math.pow(FRICTION, dt * 60));
        } else {
          velocity = target;
        }
        offset += velocity * dt;
      }

      paint(velocity * cellWidth);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const clientXToCharDelta = (dx: number) => -dx / cellWidth;

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      dragLastX = e.clientX;
      dragLastT = performance.now();
      velocity = 0;
      container.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const now = performance.now();
      const dtMs = Math.max(1, now - dragLastT);
      const dx = e.clientX - dragLastX;
      const charDelta = clientXToCharDelta(dx);
      offset += charDelta;
      velocity = (charDelta / dtMs) * 1000; // chars/sec, feeds the resolve check
      dragLastX = e.clientX;
      dragLastT = now;
      paint(velocity * cellWidth);
    };
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      if (Math.abs(velocity * cellWidth) < MIN_FLING_V) velocity = 0;
    };

    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerup", endDrag);
    container.addEventListener("pointercancel", endDrag);
    container.addEventListener("pointerenter", () => {
      hovering = true;
    });
    container.addEventListener("pointerleave", () => {
      hovering = false;
    });
    container.addEventListener("focusin", () => {
      focused = true;
    });
    container.addEventListener("focusout", () => {
      focused = false;
    });

    // Arrow keys nudge the scrub position directly (fast enough repeats
    // briefly cross the resolve threshold so keyboard users can feel the
    // same blur-then-settle the pointer path gets).
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      offset += dir * 3;
      velocity = dir * (resolveThreshold / cellWidth) * 1.4;
      paint(velocity * cellWidth);
    };
    container.addEventListener("keydown", onKeyDown);

    const ro = new ResizeObserver(rebuild);
    ro.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", endDrag);
      container.removeEventListener("pointercancel", endDrag);
      container.removeEventListener("keydown", onKeyDown);
    };
  }, [tape, speed, resolveThreshold, reduced]);

  return (
    <div className={`flex items-center gap-3 rounded-[12px] border border-border bg-background p-2 ${className}`}>
      <button
        type="button"
        aria-label={paused ? "Resume ticker" : "Pause ticker"}
        aria-pressed={paused}
        onClick={() => setPaused((p) => !p)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border border-border text-foreground transition-colors hover:bg-border/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
      >
        {paused ? (
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M1 0.5 L9 5 L1 9.5 Z" fill="currentColor" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <rect x="1" y="0.5" width="3" height="9" fill="currentColor" />
            <rect x="6" y="0.5" width="3" height="9" fill="currentColor" />
          </svg>
        )}
      </button>

      <div
        ref={containerRef}
        role="list"
        aria-label={label}
        tabIndex={0}
        className="relative h-9 flex-1 touch-none select-none overflow-hidden font-mono text-sm text-foreground [cursor:grab] active:[cursor:grabbing] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
      >
        <span
          ref={probeRef}
          aria-hidden="true"
          className="pointer-events-none absolute -left-[9999px] top-0"
          style={{ visibility: "hidden", whiteSpace: "pre" }}
        >
          {CELL_PROBE_CHAR}
        </span>
        {reduced ? (
          <div className="flex h-full items-center gap-2 overflow-hidden whitespace-nowrap">
            {items.map((it, i) => (
              <span key={`${it}-${i}-${uid}`} role="listitem" aria-label={it} className="border-r border-border pr-2 last:border-none">
                {it}
              </span>
            ))}
          </div>
        ) : (
          <div ref={trackRef} className="flex h-full items-stretch will-change-[transform]" />
        )}
      </div>
    </div>
  );
}
