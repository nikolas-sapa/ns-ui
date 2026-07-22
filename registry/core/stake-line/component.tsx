"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

// Empty state as a surveyor's staked plot, not a loading skeleton. A hidden
// template (visibility:hidden, so it occupies real layout space but paints
// nothing) is sized exactly like the content that will eventually live here —
// table rows, a card grid, or a chart area — and measured via
// getBoundingClientRect. An SVG overlay uses those real coordinates to drive
// four corner stakes in one by one (translateY(-6px) + a back-eased spring
// settle, 40ms stagger), then dashed "string" paths (4-3 dash, --border) draw
// in via stroke-dashoffset on an ease-out-expo curve, outlining the plot's
// real silhouette. The last string doesn't stop at the plot: it continues to
// the CTA's top border and ties off in a small loop, so the one thing to do
// is physically connected to the thing that's missing. Hovering or
// keyboard-focusing the CTA nudges that connector's control point ~3px,
// a gentle tug rather than a state change. The whole intro runs ~1.5s and the
// component is fully static after — unlike a skeleton, which loops forever
// because it's pretending data is imminent. Reduced motion renders every
// stake and string already settled, no draw-in, and the connector snaps
// instantly instead of easing on hover.
//
// The survey graphic (template + SVG) is aria-hidden decoration. The
// accessible content is a plain heading, one sentence of body copy, and a
// real button — the only focusable element in the region.

export type StakeLineShape =
  /** A future data table: `rows` equal-height horizontal bands. */
  | { kind: "table"; rows?: number }
  /** A future card grid: `count` cells across `columns` columns. */
  | { kind: "cards"; count?: number; columns?: number }
  /** A future chart plot area, outlined with a simple L-axis. */
  | { kind: "chart" };

export interface StakeLineProps {
  /** Headline — what's missing. */
  title?: string;
  /** One sentence of supporting copy. */
  description?: string;
  /** Label of the single CTA the staked plot ties itself to. */
  actionLabel?: string;
  onAction?: () => void;
  /** What the plot outlines. Defaults to a 3-column card grid of 6. */
  shape?: StakeLineShape;
  className?: string;
}

type Rect = { x: number; y: number; w: number; h: number };
type Boxes = { outer: Rect; cells: Rect[]; cta: Rect };

const OUTER_RADIUS = 12;
const CELL_RADIUS = 6;

function relRect(el: Element, rootBox: DOMRect): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left - rootBox.left, y: r.top - rootBox.top, w: r.width, h: r.height };
}

function roundedRectPath(x: number, y: number, w: number, h: number, radius: number): string {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  return `M${x + r},${y} H${x + w - r} A${r},${r} 0 0 1 ${x + w},${y + r} V${y + h - r} A${r},${r} 0 0 1 ${
    x + w - r
  },${y + h} H${x + r} A${r},${r} 0 0 1 ${x},${y + h - r} V${y + r} A${r},${r} 0 0 1 ${x + r},${y} Z`;
}

function roundedRectPerimeter(w: number, h: number, radius: number): number {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  return 2 * (w - 2 * r) + 2 * (h - 2 * r) + 2 * Math.PI * r;
}

const CSS = `
@keyframes ns-stake-drop{from{opacity:0;transform:translateY(-6px) scale(.85)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes ns-stake-reveal{from{stroke-dashoffset:var(--ns-len)}to{stroke-dashoffset:0}}
@keyframes ns-stake-loop-in{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:scale(1)}}
`;

export function StakeLine({
  title = "No projects yet",
  description = "Projects show up here once you create one — the layout below is already staked out and waiting.",
  actionLabel = "Create a project",
  onAction,
  shape = { kind: "cards", count: 6, columns: 3 },
  className = "",
}: StakeLineProps) {
  const uid = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const templateRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [boxes, setBoxes] = useState<Boxes | null>(null);
  const [reduced, setReduced] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const near = (hovered || focused) && !reduced;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const measure = useCallback(() => {
    const root = rootRef.current;
    const template = templateRef.current;
    const cta = ctaRef.current;
    if (!root || !template || !cta) return;
    const rootBox = root.getBoundingClientRect();
    if (!rootBox.width || !rootBox.height) return;
    const outer = relRect(template, rootBox);
    const cells = cellRefs.current
      .filter((el): el is HTMLDivElement => !!el)
      .map((el) => relRect(el, rootBox));
    setBoxes({ outer, cells, cta: relRect(cta, rootBox) });
  }, []);

  // shape drives how many cell refs exist, so a shape change needs a remeasure
  useLayoutEffect(() => {
    measure();
    const root = rootRef.current;
    if (!root) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(root);
    return () => ro.disconnect();
  }, [measure, shape]);

  // --- geometry derived from the measured boxes -----------------------------
  const silhouetteMaskId = `ns-stake-sil-${uid}`;
  const connectorMaskId = `ns-stake-con-${uid}`;

  let silhouetteD = "";
  let silhouetteLen = 0;
  let corners: { x: number; y: number; dx: number; dy: number }[] = [];
  let restD = "";
  let tugD = "";
  let loopD = "";
  let connectorLen = 0;

  if (boxes) {
    const { outer, cells, cta } = boxes;
    silhouetteD = roundedRectPath(outer.x, outer.y, outer.w, outer.h, OUTER_RADIUS);
    silhouetteLen = roundedRectPerimeter(outer.w, outer.h, OUTER_RADIUS);

    for (const cell of cells) {
      silhouetteD += ` ${roundedRectPath(cell.x, cell.y, cell.w, cell.h, CELL_RADIUS)}`;
      silhouetteLen += roundedRectPerimeter(cell.w, cell.h, CELL_RADIUS);
    }

    if (shape.kind === "chart" && outer.w > 24 && outer.h > 24) {
      const inset = 12;
      const axisD = `M${outer.x + inset},${outer.y + inset} V${outer.y + outer.h - inset} H${
        outer.x + outer.w - inset
      }`;
      silhouetteD += ` ${axisD}`;
      silhouetteLen += outer.h - 2 * inset + (outer.w - 2 * inset);
    }

    corners = [
      { x: outer.x, y: outer.y, dx: -5, dy: -5 },
      { x: outer.x + outer.w, y: outer.y, dx: 5, dy: -5 },
      { x: outer.x, y: outer.y + outer.h, dx: -5, dy: 5 },
      { x: outer.x + outer.w, y: outer.y + outer.h, dx: 5, dy: 5 },
    ];

    const start = { x: outer.x + outer.w / 2, y: outer.y + outer.h };
    const end = { x: cta.x + cta.w / 2, y: cta.y };
    const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    restD = `M${start.x},${start.y} Q${mid.x},${mid.y} ${end.x},${end.y}`;
    // the "tug": nudge the control point sideways, not along the line, so
    // hover reads as a pluck rather than a no-op collinear shift
    tugD = `M${start.x},${start.y} Q${mid.x + 3},${mid.y} ${end.x},${end.y}`;
    loopD = `M${end.x - 4},${end.y} a4,3 0 1,0 8,0 a4,3 0 1,0 -8,0`;
    connectorLen = Math.hypot(end.x - start.x, end.y - start.y);
  }

  return (
    <div ref={rootRef} className={["relative", className].join(" ")}>
      <style>{CSS}</style>

      {/* Hidden template — never painted, only measured. Establishes the real
          size and position of the content that doesn't exist yet. */}
      {shape.kind === "table" && (
        <div
          ref={templateRef}
          aria-hidden
          style={{ visibility: "hidden" }}
          className="flex w-full flex-col overflow-hidden rounded-md border border-border"
        >
          {Array.from({ length: Math.max(1, shape.rows ?? 5) }, (_, i) => (
            <div
              key={i}
              ref={(el) => {
                cellRefs.current[i] = el;
              }}
              className="h-10 w-full border-b border-border last:border-b-0"
            />
          ))}
        </div>
      )}

      {shape.kind === "cards" && (
        <div
          ref={templateRef}
          aria-hidden
          style={{
            visibility: "hidden",
            display: "grid",
            gridTemplateColumns: `repeat(${Math.max(1, shape.columns ?? 3)}, 1fr)`,
            gap: 12,
          }}
          className="w-full"
        >
          {Array.from({ length: Math.max(1, shape.count ?? 6) }, (_, i) => (
            <div
              key={i}
              ref={(el) => {
                cellRefs.current[i] = el;
              }}
              className="aspect-[4/3] rounded-md border border-border"
            />
          ))}
        </div>
      )}

      {shape.kind === "chart" && (
        <div
          ref={templateRef}
          aria-hidden
          style={{ visibility: "hidden" }}
          className="h-44 w-full rounded-md border border-border"
        />
      )}

      <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
        {boxes && (
          <>
            <defs>
              <mask id={silhouetteMaskId} maskUnits="userSpaceOnUse">
                <path
                  d={silhouetteD}
                  stroke="#fff"
                  strokeWidth={10}
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={reduced ? undefined : `${silhouetteLen} ${silhouetteLen}`}
                  style={
                    reduced
                      ? undefined
                      : ({
                          "--ns-len": silhouetteLen,
                          animation: "ns-stake-reveal 650ms cubic-bezier(.16,1,.3,1) 520ms both",
                        } as CSSProperties)
                  }
                />
              </mask>
              <mask id={connectorMaskId} maskUnits="userSpaceOnUse">
                <path
                  d={restD}
                  stroke="#fff"
                  strokeWidth={10}
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={reduced ? undefined : `${connectorLen} ${connectorLen}`}
                  style={
                    reduced
                      ? undefined
                      : ({
                          "--ns-len": connectorLen,
                          animation: "ns-stake-reveal 220ms cubic-bezier(.16,1,.3,1) 1180ms both",
                        } as CSSProperties)
                  }
                />
              </mask>
            </defs>

            {/* the plot's real silhouette: outer boundary + each future row/card */}
            <path
              d={silhouetteD}
              stroke="var(--border)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              strokeLinecap="round"
              fill="none"
              vectorEffect="non-scaling-stroke"
              mask={`url(#${silhouetteMaskId})`}
            />

            {/* four corner stakes, driven in one by one. Positioning lives on
                the wrapping <g>'s SVG `transform` attribute; the drop-in
                animates a plain CSS `transform` on the inner <path> only —
                putting both on the same element would have the animated CSS
                transform silently replace the attribute's translate instead
                of composing with it, collapsing all four stakes onto (0,0). */}
            {corners.map((c, i) => (
              <g key={i} transform={`translate(${c.x + c.dx}, ${c.y + c.dy})`}>
                <path
                  d="M0,3 L0,-8 M-3,-8 L3,-8"
                  stroke="var(--muted)"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  fill="none"
                  style={
                    reduced
                      ? undefined
                      : ({
                          transformBox: "fill-box",
                          transformOrigin: "center",
                          opacity: 0,
                          animation: `ns-stake-drop 340ms cubic-bezier(.34,1.56,.64,1) ${i * 40}ms both`,
                        } as CSSProperties)
                  }
                />
              </g>
            ))}

            {/* the string tying the missing content to the one thing to do */}
            <path
              stroke="var(--border)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              strokeLinecap="round"
              fill="none"
              vectorEffect="non-scaling-stroke"
              mask={`url(#${connectorMaskId})`}
              style={
                {
                  d: `path("${near ? tugD : restD}")`,
                  transition: reduced ? undefined : "d 260ms cubic-bezier(.22,1,.36,1)",
                } as CSSProperties
              }
            />

            {/* the cinch where the string ties off at the button */}
            <path
              d={loopD}
              stroke="var(--border)"
              strokeWidth={1.5}
              strokeLinecap="round"
              fill="none"
              style={
                reduced
                  ? undefined
                  : ({
                      opacity: 0,
                      transformBox: "fill-box",
                      transformOrigin: "center",
                      animation: "ns-stake-loop-in 150ms cubic-bezier(.34,1.56,.64,1) 1380ms both",
                    } as CSSProperties)
              }
            />
          </>
        )}
      </svg>

      <div className="relative z-10 mt-10 flex flex-col items-center px-6 pb-2 text-center">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mt-2 max-w-[38ch] text-sm leading-relaxed text-muted">{description}</p>
        <button
          ref={ctaRef}
          type="button"
          onClick={onAction}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={[
            "mt-6 inline-flex items-center justify-center rounded-sm bg-accent px-4 py-2",
            "text-sm font-medium text-white",
            "transition-[background-color,transform,box-shadow] duration-200 ease-out",
            "hover:-translate-y-px hover:bg-accent-hover hover:shadow-[0_0_0_1px_var(--accent)]",
            "active:translate-y-0 active:bg-accent-hover",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          ].join(" ")}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
