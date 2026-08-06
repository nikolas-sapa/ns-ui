"use client";

import { useEffect, useMemo, useRef } from "react";

// ---------------------------------------------------------------------------
// RollCrawl — a teleprinter-register crawl. Unlike a CSS marquee, the strip
// never slides: a fixed row of monospace cells exists at fixed pixel
// positions, and every `beatMs` the ENTIRE row is re-rendered one tape-index
// further along by rewriting each cell's textContent — the crawl is content
// substitution, not translation, which is what makes the motion read as
// character-quantised rather than a subpixel slide. A cell's distance from
// the right edge (offsetFromRight = cellCount - 1 - i) is fixed per DOM
// position, and doubles as that position's "age": the rightmost cell is
// always the just-arrived one, so it flickers through a short run of random
// glyphs on every beat, while positions old enough (offsetFromRight >=
// FLICKER_STEPS) always show the real, settled tape character. Direct-DOM
// rAF only — no React state on the hot path.
// ---------------------------------------------------------------------------

const FLICKER_STEPS = 3;
const FLICKER_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@*+=-_/\\|";

export interface RollCrawlProps {
  /** items rendered in order, joined by `separator` and looped */
  items: string[];
  /** glyph placed between items, including at the wrap seam */
  separator?: string;
  /** ms per cell advance; also the flicker settle budget is 3x this */
  beatMs?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function RollCrawl({
  items,
  separator = "•",
  beatMs = 110,
  className = "",
}: RollCrawlProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);

  const tape = useMemo(() => {
    if (items.length === 0) return "";
    return `${items.join(` ${separator} `)} ${separator} `;
  }, [items, separator]);

  const label = useMemo(() => items.join(", "), [items]);

  useEffect(() => {
    const container = containerRef.current;
    const row = rowRef.current;
    const probe = probeRef.current;
    if (!container || !row || !probe || tape.length === 0) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let cellWidth = probe.getBoundingClientRect().width || 10;
    let cells: HTMLSpanElement[] = [];
    let leadIndex = 0;
    let beatAcc = 0;
    let paused = false;
    let raf = 0;
    let last = 0;

    const charAt = (absIndex: number) =>
      tape[((absIndex % tape.length) + tape.length) % tape.length] ?? " ";

    const rebuild = () => {
      cellWidth = probe.getBoundingClientRect().width || cellWidth;
      const w = container.getBoundingClientRect().width;
      const count = Math.max(1, Math.floor(w / cellWidth));
      row.textContent = "";
      cells = [];
      for (let i = 0; i < count; i++) {
        const span = document.createElement("span");
        span.setAttribute("aria-hidden", "true");
        span.style.display = "inline-block";
        span.style.width = `${cellWidth}px`;
        span.style.textAlign = "center";
        span.style.flexShrink = "0";
        row.appendChild(span);
        cells.push(span);
      }
      forceSettle();
    };

    // writes the real, settled character to every cell regardless of its
    // flicker age — used for the initial paint and for a clean, non-mid-beat
    // hover pause.
    const forceSettle = () => {
      for (let i = 0; i < cells.length; i++) {
        const offsetFromRight = cells.length - 1 - i;
        cells[i]!.textContent = charAt(leadIndex - offsetFromRight);
      }
    };

    // one beat: advance the tape by one cell, settle positions old enough to
    // have cleared the flicker window, and re-roll the still-new ones.
    const applyBeat = () => {
      leadIndex++;
      for (let i = 0; i < cells.length; i++) {
        const offsetFromRight = cells.length - 1 - i;
        if (offsetFromRight >= FLICKER_STEPS) {
          cells[i]!.textContent = charAt(leadIndex - offsetFromRight);
        } else {
          cells[i]!.textContent =
            FLICKER_CHARSET[Math.floor(Math.random() * FLICKER_CHARSET.length)]!;
        }
      }
    };

    // between beats: re-roll only the cells still inside the flicker window,
    // so a freshly-arrived character visibly churns through 2-3 glyphs.
    const applyFlicker = () => {
      for (let i = 0; i < cells.length; i++) {
        const offsetFromRight = cells.length - 1 - i;
        if (offsetFromRight < FLICKER_STEPS) {
          cells[i]!.textContent =
            FLICKER_CHARSET[Math.floor(Math.random() * FLICKER_CHARSET.length)]!;
        }
      }
    };

    rebuild();

    if (reduced) {
      const ro = new ResizeObserver(rebuild);
      ro.observe(container);
      return () => ro.disconnect();
    }

    let flickerAcc = 0;
    const flickerInterval = Math.max(30, beatMs / 2.4);

    const loop = (now: number) => {
      const dt = last ? Math.min(64, now - last) : 16;
      last = now;
      if (!paused) {
        beatAcc += dt;
        flickerAcc += dt;
        if (beatAcc >= beatMs) {
          beatAcc -= beatMs;
          flickerAcc = 0;
          applyBeat();
        } else if (flickerAcc >= flickerInterval) {
          flickerAcc -= flickerInterval;
          applyFlicker();
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onEnter = () => {
      paused = true;
      forceSettle(); // land cleanly on the current cell boundary, no frozen flicker
    };
    const onLeave = () => {
      paused = false;
      beatAcc = 0;
      flickerAcc = 0;
    };
    container.addEventListener("pointerenter", onEnter);
    container.addEventListener("pointerleave", onLeave);
    container.addEventListener("focusin", onEnter);
    container.addEventListener("focusout", onLeave);

    const ro = new ResizeObserver(rebuild);
    ro.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      container.removeEventListener("pointerenter", onEnter);
      container.removeEventListener("pointerleave", onLeave);
      container.removeEventListener("focusin", onEnter);
      container.removeEventListener("focusout", onLeave);
    };
  }, [tape, beatMs]);

  return (
    <div
      ref={containerRef}
      role="text"
      aria-label={label}
      className={`relative overflow-hidden whitespace-nowrap font-mono text-foreground ${className}`}
    >
      <span
        ref={probeRef}
        aria-hidden="true"
        className="pointer-events-none absolute -left-[9999px] top-0"
        style={{ visibility: "hidden", whiteSpace: "pre" }}
      >
        0
      </span>
      <div ref={rowRef} className="flex" />
    </div>
  );
}
