"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

// Empty state as a plot of land marked out and not yet planted. The panel's
// boundary is a single SVG rect stroked with a dashed border-token line whose
// stroke-dashoffset drifts on a seamless CSS loop, so the edge is alive while
// the inside stays honestly empty — no ghost content rows. Pointing at the CTA
// contracts the outline toward the button (transform-origin measured from the
// button's real centre, so it works at any panel size), which makes the
// affordance point at itself. Pure CSS + SVG: no canvas, no rAF, no timers.
// Hover is tracked in React rather than :hover so the landing-card autoplay
// driver's synthetic pointer events reach it. prefers-reduced-motion kills both
// the drift and the contraction and leaves a static, readable outline.

export interface FallowPanelProps {
  /** Headline — what is missing. */
  title?: string;
  /** One line of supporting copy. Keep it to one line. */
  description?: string;
  /** Label of the single accent CTA. Pass an empty string to omit the button. */
  actionLabel?: string;
  onAction?: () => void;
  /** Optional mark above the headline — an icon, a glyph, anything small. */
  icon?: ReactNode;
  className?: string;
}

export function FallowPanel({
  title = "Nothing here yet",
  description = "This list is empty. Add the first item and it will show up here.",
  actionLabel = "Add the first item",
  onAction,
  icon,
  className = "",
}: FallowPanelProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const near = hovered || focused;
  // origin of the contraction, in % of the panel box — measured, not assumed,
  // because the CTA sits wherever the copy above it pushes it
  const [origin, setOrigin] = useState("50% 72%");

  const measure = useCallback(() => {
    const root = rootRef.current;
    const cta = ctaRef.current;
    if (!root || !cta) return;
    const r = root.getBoundingClientRect();
    const c = cta.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const x = ((c.left + c.width / 2 - r.left) / r.width) * 100;
    const y = ((c.top + c.height / 2 - r.top) / r.height) * 100;
    setOrigin(`${x.toFixed(2)}% ${y.toFixed(2)}%`);
  }, []);

  // the panel reflows (viewport, font load, copy change) — keep the origin true
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    if (ctaRef.current) ro.observe(ctaRef.current);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <div
      ref={rootRef}
      className={["relative isolate", className].join(" ")}
    >
      <style>{`@keyframes ns-fallow-drift{to{stroke-dashoffset:-36}}
.ns-fallow-edge{stroke:var(--ns-muted);opacity:.45;transition:stroke 320ms ease-out,opacity 320ms ease-out,transform 560ms cubic-bezier(.22,1,.36,1);transform-box:fill-box;animation:ns-fallow-drift 9s linear infinite}
.ns-fallow-edge[data-near="true"]{stroke:var(--ns-accent);opacity:.85;transform:scale(.965)}
@media (prefers-reduced-motion: reduce){.ns-fallow-edge{animation:none;transition:stroke 320ms ease-out,opacity 320ms ease-out}.ns-fallow-edge[data-near="true"]{transform:none}}`}</style>

      {/* the boundary. overflow-visible so the stroke straddling the box edge
          isn't clipped in half by the SVG viewport */}
      <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
        <rect
          className="ns-fallow-edge"
          data-near={near}
          x="0"
          y="0"
          width="100%"
          height="100%"
          rx="12"
          ry="12"
          fill="none"
          strokeWidth="1.5"
          strokeDasharray="10 8"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{ transformOrigin: origin }}
        />
      </svg>

      <div className="flex flex-col items-center px-8 py-14 text-center">
        {icon ? (
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-sm border border-border text-ns-muted">
            {icon}
          </div>
        ) : null}
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? (
          <p className="mt-2 max-w-[36ch] text-sm leading-relaxed text-ns-muted">{description}</p>
        ) : null}
        {actionLabel ? (
          <button
            ref={ctaRef}
            type="button"
            onClick={onAction}
            onPointerEnter={() => setHovered(true)}
            onPointerLeave={() => setHovered(false)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className={[
              "mt-6 inline-flex items-center justify-center rounded-sm bg-ns-accent px-4 py-2",
              "text-sm font-medium text-white",
              "transition-[background-color,transform,box-shadow] duration-200 ease-out",
              "hover:-translate-y-px hover:bg-ns-accent-hover hover:shadow-[0_0_0_1px_var(--ns-accent)]",
              "active:translate-y-0 active:bg-ns-accent-hover",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent",
            ].join(" ")}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
