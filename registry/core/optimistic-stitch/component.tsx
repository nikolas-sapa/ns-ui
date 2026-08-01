"use client";

import type { ReactNode } from "react";

// BasteStitch — optimistic-write feedback for a single row (list item,
// comment, form field) rendered as a tailor's basting stitch along its left
// seam, not a spinner or a toast.
//
// A pending write (created/edited optimistically, not yet acked) draws an
// uneven, hand-stitched dashed line — real stroke-dasharray, sized like
// unequal hand stitches, not a machine-even pattern. The instant the server
// acks, the dasharray pairwise-interpolates to a solid hairline (every
// dash grows toward a length far longer than the row while every gap
// shrinks to zero — a plain CSS transition, no JS tweening) while the whole
// row does a barely-there scaleX 0.995 -> 1 spring contraction: the stitch
// visibly pulls taut. On failure the dash offset snaps outward fast (the
// thread yanked loose), the pattern loosens into wider, frayed gaps, the
// seam settles to --muted, and the row's own content dims beside a real
// inline Retry button — never a red/accent decoration, never a spinner.
//
// This is deliberately a *lifecycle* encoding (provisional / committed /
// rolled back for ONE write), not a freshness signal: it never keeps
// running once a state is reached, and a still frame is fully legible with
// zero motion — dashed vs. solid vs. muted-frayed-dimmed are three
// structurally different rests, not degrees of the same shimmer. That's
// what keeps it distinct from wet-ink, which encodes a still-arriving
// token *stream* and never stops animating until the stream itself ends.
//
// The component holds no write logic of its own (no fetch, no retry
// backoff) — it is a pure function of `status`, and calls `onRetry` when
// the user asks to try again. The caller owns the actual write.

export type BasteStatus = "pending" | "committed" | "failed";

export interface BasteStitchProps {
  /** Where this row's write currently sits in its lifecycle. */
  status: BasteStatus;
  /** Called when the user activates the Retry control after a failed write. */
  onRetry?: () => void;
  /** The row's real content — list text, a comment body, a form field. */
  children: ReactNode;
  /**
   * Noun for what this row is, used only in the Retry button's own label
   * ("Retry {itemLabel}") so multiple failed rows read as distinct
   * controls to a screen reader. Default "change".
   */
  itemLabel?: string;
  className?: string;
}

const STATUS_MESSAGE: Record<BasteStatus, string> = {
  pending: "Saving",
  committed: "Saved",
  failed: "Failed to save. Retry available.",
};

export function BasteStitch({
  status,
  onRetry,
  children,
  itemLabel = "change",
  className = "",
}: BasteStitchProps) {
  return (
    <div className={`relative ${className}`} data-status={status}>
      <div className="ns-baste-scale relative flex items-stretch">
        <svg
          className="ns-baste-seam absolute inset-y-0 left-0 w-2.5"
          aria-hidden="true"
          focusable="false"
        >
          <line className="ns-baste-seam-line" x1="5" y1="0" x2="5" y2="100%" />
        </svg>
        <div className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-3 pl-4">
          <div className="ns-baste-row-content min-w-0 flex-1">{children}</div>
          {status === "failed" && (
            <button
              type="button"
              onClick={onRetry}
              className="ns-baste-retry shrink-0 rounded-sm border border-border px-2.5 py-1 font-mono text-[11px] whitespace-nowrap text-foreground transition-colors duration-150 hover:border-muted hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Retry {itemLabel}
            </button>
          )}
        </div>
      </div>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {STATUS_MESSAGE[status]}
      </span>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.ns-baste-scale{
  transform-origin:left center;
  transform:scaleX(1);
  transition:transform 360ms cubic-bezier(.34,1.56,.64,1);
}
.ns-baste-seam{ overflow:visible; pointer-events:none; }
.ns-baste-seam-line{
  stroke:var(--border);
  stroke-width:2;
  stroke-linecap:round;
  fill:none;
  stroke-dasharray:3 2 4 2 2 3;
  stroke-dashoffset:0;
  transition:
    stroke-dasharray 300ms cubic-bezier(.16,1,.3,1),
    stroke-dashoffset 300ms cubic-bezier(.16,1,.3,1),
    stroke 300ms cubic-bezier(.16,1,.3,1);
}
.ns-baste-row-content{
  opacity:1;
  transition:opacity 220ms ease-out;
}

[data-status="pending"] .ns-baste-scale{ transform:scaleX(0.995); }

[data-status="committed"] .ns-baste-scale{ transform:scaleX(1); }
[data-status="committed"] .ns-baste-seam-line{
  stroke:var(--border);
  stroke-dasharray:1000 0 1000 0 1000 0;
  stroke-dashoffset:0;
}

[data-status="failed"] .ns-baste-scale{ transform:scaleX(1); }
[data-status="failed"] .ns-baste-seam-line{
  stroke:var(--muted);
  stroke-dasharray:2 7 1 9 2 6;
  stroke-dashoffset:18;
  transition:
    stroke-dasharray 160ms cubic-bezier(.55,0,1,.45),
    stroke-dashoffset 160ms cubic-bezier(.55,0,1,.45),
    stroke 260ms ease-out;
}
[data-status="failed"] .ns-baste-row-content{ opacity:.55; }

@media (prefers-reduced-motion: reduce){
  .ns-baste-scale, .ns-baste-seam-line, .ns-baste-row-content{
    transition:none;
  }
}
`;
