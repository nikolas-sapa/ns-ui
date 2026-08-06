"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface SelvageFoldProps {
  /** Plain text. Words are individually measured, so the fold count is exact, not estimated. */
  children: string;
  /** Visible lines when folded. */
  lines?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

/**
 * Truncation that tells the truth. "…" says something was cut but not how
 * much; line-clamp says nothing at all. This clamp measures where the fold
 * actually lands (every word is a span, the first one pushed past the fold
 * line is found by offsetTop) and the control states exactly what's hidden:
 * "+ 42 words". Unfolding is an in-place height ease, not a jump; folding
 * back re-measures. The full text stays in the DOM throughout, so assistive
 * tech and find-in-page always see everything — the fold is visual, not
 * informational.
 */
export function SelvageFold({ children, lines = 3, className = "" }: SelvageFoldProps) {
  const words = useMemo(() => children.split(/\s+/).filter(Boolean), [children]);
  const innerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [metrics, setMetrics] = useState<{ clampH: number; fullH: number; hidden: number } | null>(null);

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const measure = () => {
      const cs = getComputedStyle(inner);
      let lineH = parseFloat(cs.lineHeight);
      if (!Number.isFinite(lineH)) lineH = parseFloat(cs.fontSize) * 1.5;
      const clampH = Math.round(lineH * lines);
      const fullH = inner.scrollHeight;
      let hidden = 0;
      if (fullH > clampH + 2) {
        const spans = inner.querySelectorAll<HTMLElement>("[data-word]");
        // first word whose box starts at or past the fold line is the first casualty
        for (let i = 0; i < spans.length; i++) {
          if (spans[i].offsetTop + 1 >= clampH) {
            hidden = spans.length - i;
            break;
          }
        }
      }
      setMetrics({ clampH, fullH, hidden });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [lines, children]);

  const folded = metrics !== null && metrics.hidden > 0 && !open;
  const needsFold = metrics !== null && metrics.hidden > 0;

  return (
    <div className={className}>
      <div
        className="overflow-hidden transition-[max-height] ease-out motion-reduce:transition-none"
        style={{
          maxHeight: metrics ? (folded ? metrics.clampH : metrics.fullH) : undefined,
          transitionDuration: "400ms",
          maskImage: folded
            ? "linear-gradient(to bottom, black calc(100% - 1.5em), rgba(0,0,0,0.15))"
            : undefined,
          WebkitMaskImage: folded
            ? "linear-gradient(to bottom, black calc(100% - 1.5em), rgba(0,0,0,0.15))"
            : undefined,
        }}
      >
        <div ref={innerRef}>
          {words.map((w, i) => (
            <span key={i} data-word>
              {w}
              {i < words.length - 1 ? " " : ""}
            </span>
          ))}
        </div>
      </div>
      {needsFold && (
        <div className="mt-1 flex items-center gap-3">
          {/* the selvage: the finished edge of the cut, dashes like thread ends */}
          <span aria-hidden className="h-px flex-1 border-t border-dashed border-border" />
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? "Fold text back" : `Unfold ${metrics.hidden} more ${metrics.hidden === 1 ? "word" : "words"}`}
            onClick={() => setOpen((o) => !o)}
            className="flex cursor-pointer items-center gap-1.5 rounded-sm px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-ns-muted transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            <svg
              aria-hidden
              viewBox="0 0 10 10"
              className={`h-2.5 w-2.5 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 3.5 L5 6.5 L8 3.5" />
            </svg>
            {open ? "fold" : `+ ${metrics.hidden} words`}
          </button>
        </div>
      )}
    </div>
  );
}
