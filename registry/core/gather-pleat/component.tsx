"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";

// Middle truncation as fabric. A hard-clipped "..." says something was cut
// but not how much and where the loss is worst — this gathers the hidden
// middle of a string into a narrow pleated band whose fold count is
// proportional to how many characters it hides, so the resting frame reads
// as a quantity, not a shrug. Head and tail (the informative ends of a path,
// URL or hash) are plain, un-clipped text either side of the band; only the
// middle run sits inside a width-animated, overflow-hidden strip. A single
// real <button> sits over that strip — the pleat glyph is its paint, not a
// separate decoration — carrying aria-expanded and an accessible name that
// states the hidden count. Click/Enter toggles between the collapsed pleat
// width and the middle's natural (un-clipped) width on a spring-timed CSS
// transition; dragging the button maps pointer delta directly onto the
// strip's width for a partial peek, snapping to the nearer end on release.
// The full string — head, hidden middle, tail — is always real DOM text in
// document order: clipping is overflow:hidden on a box, never a removed or
// aria-hidden node, so assistive tech and copy/paste always see everything.

const CHARS_PER_FOLD = 3;
const MIN_FOLDS = 2;
const MAX_FOLDS = 14;
const FOLD_PX = 6.5;
const COLLAPSED_PAD = 9;
const MIN_COLLAPSED = 20;
const WIDTH_MS = 420;
const STAGGER_CAP_MS = 220;
const DRAG_THRESHOLD = 4; // px of movement before a press counts as a drag

export interface GatherPleatProps {
  /** Full string — always rendered as real, complete text regardless of visual clipping. */
  text: string;
  /** Characters always shown at the start. Default 10. */
  headChars?: number;
  /** Characters always shown at the end. Default 8. */
  tailChars?: number;
  /** Minimum hidden characters before a pleat is worth gathering. Default 4 — below this the full string just renders plainly. */
  minHidden?: number;
  className?: string;
}

export function GatherPleat({
  text,
  headChars = 10,
  tailChars = 8,
  minHidden = 4,
  className = "",
}: GatherPleatProps) {
  const chars = useMemo(() => Array.from(text), [text]);
  const hiddenCount = Math.max(0, chars.length - headChars - tailChars);
  const needsPleat = hiddenCount >= minHidden;

  const head = needsPleat ? chars.slice(0, headChars).join("") : text;
  const tail = needsPleat ? chars.slice(chars.length - tailChars).join("") : "";
  const middle = needsPleat
    ? chars.slice(headChars, chars.length - tailChars).join("")
    : "";

  const foldCount = needsPleat
    ? Math.min(MAX_FOLDS, Math.max(MIN_FOLDS, Math.round(hiddenCount / CHARS_PER_FOLD)))
    : 0;
  const collapsedWidth = Math.max(MIN_COLLAPSED, Math.round(foldCount * FOLD_PX + COLLAPSED_PAD));

  const measurerRef = useRef<HTMLSpanElement>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [naturalWidth, setNaturalWidth] = useState(collapsedWidth);
  const [expanded, setExpanded] = useState(false);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const dragging = dragWidth !== null;

  // Reduced motion is handled entirely in CSS (the media query below strips
  // every transition to `none`), so a toggle or drag-release still commits
  // its width/opacity change immediately — no JS branching needed here.

  useLayoutEffect(() => {
    if (!needsPleat) return;
    const measurer = measurerRef.current;
    if (!measurer) return;
    const measure = () => setNaturalWidth(Math.max(collapsedWidth, measurer.scrollWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(measurer);
    let cancelled = false;
    document.fonts?.ready
      ?.then(() => {
        if (!cancelled) measure();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, [needsPleat, middle, collapsedWidth]);

  const targetWidth = expanded ? naturalWidth : collapsedWidth;
  const currentWidth = dragging ? dragWidth! : targetWidth;

  // -- drag: pointer delta maps directly onto strip width, snap on release --
  const dragRef = useRef<{ startX: number; startWidth: number; moved: boolean }>(
    { startX: 0, startWidth: 0, moved: false }
  );
  const suppressClickRef = useRef(false);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== undefined && e.button !== 0) return;
    dragRef.current = { startX: e.clientX, startWidth: targetWidth, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const delta = e.clientX - d.startX;
    if (!d.moved && Math.abs(delta) < DRAG_THRESHOLD) return;
    d.moved = true;
    const next = Math.min(naturalWidth, Math.max(collapsedWidth, d.startWidth + delta));
    setDragWidth(next);
  };

  const endDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (d.moved) {
      const span = Math.max(1, naturalWidth - collapsedWidth);
      const fraction = ((dragWidth ?? d.startWidth) - collapsedWidth) / span;
      setExpanded(fraction > 0.5);
      suppressClickRef.current = true;
    }
    setDragWidth(null);
    d.moved = false;
  };

  const onClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setExpanded((v) => !v);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Escape" && expanded) {
      e.preventDefault();
      setExpanded(false);
    }
  };

  if (!needsPleat) {
    return <span className={className}>{text}</span>;
  }

  const label = `${hiddenCount} characters hidden`;
  const stagger = Math.min(STAGGER_CAP_MS / Math.max(1, foldCount - 1), 26);
  const folds = Array.from({ length: foldCount }, (_, i) => i);

  return (
    <span
      className={`ns-gp inline-flex max-w-full items-end whitespace-nowrap ${className}`}
      data-expanded={expanded}
      data-dragging={dragging || undefined}
    >
      <style>{`
        .ns-gp-strip {
          transition: width ${WIDTH_MS}ms cubic-bezier(.16,1,.3,1);
        }
        .ns-gp[data-dragging="true"] .ns-gp-strip {
          transition: none;
        }
        .ns-gp-btn {
          color: var(--border);
          transition: color 150ms ease;
        }
        .ns-gp-btn:hover,
        .ns-gp-btn[data-dragging="true"] {
          color: var(--muted);
        }
        .ns-gp-backdrop {
          fill: var(--background);
          transition: opacity ${WIDTH_MS}ms cubic-bezier(.16,1,.3,1);
        }
        .ns-gp[data-expanded="true"] .ns-gp-backdrop {
          opacity: 0;
        }
        .ns-gp-fold {
          stroke: currentColor;
          transition: opacity 160ms ease-out;
        }
        .ns-gp[data-expanded="true"] .ns-gp-fold {
          opacity: 0;
        }
        .ns-gp-seam {
          stroke: var(--border);
          opacity: 0;
          transition: opacity 160ms ease-out;
        }
        .ns-gp[data-expanded="true"] .ns-gp-seam {
          opacity: 1;
        }
        /* The button lives inside the strip's overflow:hidden box, so an
           outline (which paints outside the border box) would be clipped
           away invisibly. An inset box-shadow paints inside instead, so
           the focus ring always shows regardless of the strip's width. */
        .ns-gp-btn:focus-visible {
          box-shadow: inset 0 0 0 2px var(--accent);
        }
        @media (prefers-reduced-motion: reduce) {
          .ns-gp-strip, .ns-gp-backdrop, .ns-gp-fold, .ns-gp-seam, .ns-gp-btn {
            transition: none !important;
          }
        }
      `}</style>

      <span data-gp-head className="text-foreground">
        {head}
      </span>

      <span
        ref={wrapperRef}
        className="ns-gp-strip relative inline-block shrink-0 overflow-hidden whitespace-nowrap align-baseline"
        style={{ width: currentWidth }}
      >
        {/* full hidden run, real text, visual clip only */}
        <span className="text-foreground">{middle}</span>

        {/* hidden measurer: same text, no width constraint — gives the
            natural pixel width the strip springs open to */}
        <span
          ref={measurerRef}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 whitespace-nowrap"
          style={{ visibility: "hidden" }}
        >
          {middle}
        </span>

        <button
          ref={buttonRef}
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? `${label}, collapse` : `${label}, expand`}
          data-dragging={dragging || undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClick={onClick}
          onKeyDown={onKeyDown}
          className="ns-gp-btn absolute inset-0 flex h-full w-full cursor-ew-resize touch-none items-stretch border-0 bg-transparent p-0"
        >
          <svg
            aria-hidden
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="h-full w-full"
          >
            <rect className="ns-gp-backdrop" x={0} y={0} width={100} height={100} />
            {folds.map((i) => {
              const x1 = (i / foldCount) * 100;
              const x2 = ((i + 1) / foldCount) * 100;
              const y1 = i % 2 === 0 ? 22 : 78;
              const y2 = (i + 1) % 2 === 0 ? 22 : 78;
              const openDelay = i * stagger;
              const closeDelay = (foldCount - 1 - i) * stagger;
              return (
                <line
                  key={i}
                  className="ns-gp-fold"
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  style={{
                    transitionDelay: `${expanded ? openDelay : closeDelay}ms`,
                  }}
                />
              );
            })}
            <line
              className="ns-gp-seam"
              x1={2}
              y1={94}
              x2={98}
              y2={94}
              strokeWidth={1.6}
              strokeDasharray="3 3"
              style={{ transitionDelay: expanded ? `${WIDTH_MS}ms` : "0ms" }}
            />
          </svg>
        </button>
      </span>

      <span data-gp-tail className="text-foreground">
        {tail}
      </span>
    </span>
  );
}
