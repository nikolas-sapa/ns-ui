"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// TensegrityDrift — a freeform card canvas held together as a tensegrity
// structure. Cards are DOM elements on spring-animated transforms; cables are
// SVG quadratic paths between rectangle-boundary anchor points. Cable "rest
// length" is fixed at mount (the material's natural length); the network only
// ever pulls, never pushes, so slack cables sag into a shallow catenary and
// taut ones straighten and thin. Dragging one card stretches its cables past
// rest length, which tugs its neighbors, which tug theirs — strain
// propagates through the topology, not just the moved card, and the whole
// mesh rings down into a new equilibrium over ~1.2s of damped oscillation.
// prefers-reduced-motion drops the spring/cable coupling entirely: cards move
// on a 150ms ease, cables render as static straight lines, nothing rings.
// ---------------------------------------------------------------------------

export interface TensegrityItem {
  id: string;
  label: string;
  caption?: string;
  /** rest position, 0..1 fraction of the canvas width/height */
  x: number;
  y: number;
  /** ids of other items this one is cabled to (list both directions) */
  connections: string[];
}

const DEFAULT_ITEMS: TensegrityItem[] = [
  {
    id: "research",
    label: "Research",
    caption: "interviews, field notes",
    x: 0.12,
    y: 0.2,
    connections: ["design", "roadmap"],
  },
  {
    id: "design",
    label: "Design",
    caption: "system, flows",
    x: 0.4,
    y: 0.1,
    connections: ["research", "prototype", "launch"],
  },
  {
    id: "prototype",
    label: "Prototype",
    caption: "clickable spec",
    x: 0.72,
    y: 0.18,
    connections: ["design", "pricing", "launch"],
  },
  {
    id: "pricing",
    label: "Pricing",
    caption: "tiers, billing",
    x: 0.9,
    y: 0.48,
    connections: ["prototype", "onboarding", "launch"],
  },
  {
    id: "onboarding",
    label: "Onboarding",
    caption: "first-run flow",
    x: 0.74,
    y: 0.82,
    connections: ["pricing", "support", "launch"],
  },
  {
    id: "support",
    label: "Support",
    caption: "docs, macros",
    x: 0.38,
    y: 0.9,
    connections: ["onboarding", "roadmap", "launch"],
  },
  {
    id: "roadmap",
    label: "Roadmap",
    caption: "next two quarters",
    x: 0.1,
    y: 0.62,
    connections: ["research", "support", "launch"],
  },
  {
    id: "launch",
    label: "Launch",
    caption: "the whole thing, at once",
    x: 0.5,
    y: 0.48,
    connections: [
      "design",
      "prototype",
      "pricing",
      "onboarding",
      "support",
      "roadmap",
    ],
  },
];

// -- tuning -------------------------------------------------------------
const ANCHOR_K = 120; // spring pulling a card's offset back toward its home
const CABLE_K = 46; // cable pull once stretched past rest length
const DAMPING = 14; // velocity damping — underdamped enough to ring, not bounce forever
const NUDGE_STEP = 32; // px per arrow-key press (Geist spacing rhythm)
const MAX_TENSION = 0.35; // stretch ratio at which a cable reads "maximally taut"
const MAX_SLACK = 0.55; // slack ratio at which a cable reads "maximally loose"
const SLEEP_EPS = 0.02; // combined speed+offset below this => loop sleeps
const DRAG_THRESHOLD = 4; // px of movement before a press counts as a drag, not a tap

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}
function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// Point where the ray from a rect's center toward (ux,uy) crosses its border
// — cables terminate on the card edge, not floating over its face.
function rectAnchor(
  cx: number,
  cy: number,
  hw: number,
  hh: number,
  ux: number,
  uy: number
) {
  const ax = Math.abs(ux) < 1e-6 ? 1e-6 : Math.abs(ux);
  const ay = Math.abs(uy) < 1e-6 ? 1e-6 : Math.abs(uy);
  const t = Math.min(hw / ax, hh / ay);
  return { x: cx + ux * t, y: cy + uy * t };
}

interface Engine {
  reduced: boolean;
  beginDrag: (i: number, e: { clientX: number; clientY: number }) => void;
  dragMove: (i: number, e: { clientX: number; clientY: number }) => void;
  endDrag: (i: number, e: { clientX: number; clientY: number }) => void;
  nudge: (i: number, dx: number, dy: number) => void;
  consumeSuppressClick: (i: number) => boolean;
}

export function TensegrityDrift({
  items = DEFAULT_ITEMS,
  className = "min-h-[560px]",
  onOpenItem,
  "aria-label": ariaLabel = "Tensegrity card canvas — drag any card to strain the network",
}: {
  items?: TensegrityItem[];
  className?: string;
  onOpenItem?: (id: string) => void;
  "aria-label"?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const engineRef = useRef<Engine | null>(null);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set()
  );

  const onOpenItemRef = useRef(onOpenItem);
  useEffect(() => {
    onOpenItemRef.current = onOpenItem;
  }, [onOpenItem]);

  const labelById = useMemo(() => {
    const m = new Map<string, string>();
    items.forEach((it) => m.set(it.id, it.label));
    return m;
  }, [items]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        onOpenItemRef.current?.(id);
      }
      return next;
    });
  }, []);

  // -- engine: mass-spring cards + cable-tension SVG, all outside React ----
  useEffect(() => {
    const root = rootRef.current;
    const svg = svgRef.current;
    if (!root || !svg) return;

    const n = items.length;
    const cardEls = cardRefs.current.slice(0, n);
    const pathEls = pathRefs.current;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // unique undirected edges, built from each item's connection list
    const edgeA: number[] = [];
    const edgeB: number[] = [];
    const seen = new Set<string>();
    const idxOf = new Map<string, number>();
    items.forEach((it, i) => idxOf.set(it.id, i));
    items.forEach((it, i) => {
      it.connections.forEach((cid) => {
        const j = idxOf.get(cid);
        if (j === undefined || j === i) return;
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (seen.has(key)) return;
        seen.add(key);
        edgeA.push(Math.min(i, j));
        edgeB.push(Math.max(i, j));
      });
    });
    const edgeCount = edgeA.length;
    const edgeRest = new Float32Array(edgeCount);

    const baseX = new Float32Array(n);
    const baseY = new Float32Array(n);
    const halfW = new Float32Array(n);
    const halfH = new Float32Array(n);
    const homeX = new Float32Array(n);
    const homeY = new Float32Array(n);
    const curX = new Float32Array(n);
    const curY = new Float32Array(n);
    const velX = new Float32Array(n);
    const velY = new Float32Array(n);
    const dragging = new Uint8Array(n);
    const moved = new Uint8Array(n);
    const suppressClick = new Uint8Array(n);
    const pointerId = new Int32Array(n).fill(-1);
    const startClientX = new Float32Array(n);
    const startClientY = new Float32Array(n);
    const grabX = new Float32Array(n);
    const grabY = new Float32Array(n);

    // Re-derived on mount and on resize. Rest length always tracks the
    // *current* base layout so a viewport resize re-anneals the network to
    // zero tension instead of reading as spurious strain — only a drag or a
    // keyboard nudge should ever put a cable under load.
    const measure = () => {
      for (let i = 0; i < n; i++) {
        const el = cardEls[i];
        if (!el) continue;
        // offsetLeft/Top ignore the transform we drive physics through, so
        // this is the untransformed rest anchor, not a feedback loop.
        baseX[i] = el.offsetLeft;
        baseY[i] = el.offsetTop;
        halfW[i] = el.offsetWidth / 2;
        halfH[i] = el.offsetHeight / 2;
      }
      for (let e = 0; e < edgeCount; e++) {
        const a = edgeA[e] as number;
        const b = edgeB[e] as number;
        const dx =
          (baseX[b] as number) +
          (homeX[b] as number) -
          ((baseX[a] as number) + (homeX[a] as number));
        const dy =
          (baseY[b] as number) +
          (homeY[b] as number) -
          ((baseY[a] as number) + (homeY[a] as number));
        edgeRest[e] = Math.max(1, Math.hypot(dx, dy));
      }
    };
    measure();

    const renderCards = () => {
      for (let i = 0; i < n; i++) {
        const el = cardEls[i];
        if (!el) continue;
        const x = (homeX[i] as number) + (curX[i] as number);
        const y = (homeY[i] as number) + (curY[i] as number);
        el.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      }
    };

    const drawEdges = (dynamic: boolean) => {
      for (let e = 0; e < edgeCount; e++) {
        const path = pathEls[e];
        if (!path) continue;
        const a = edgeA[e] as number;
        const b = edgeB[e] as number;
        const ax = (baseX[a] as number) + (homeX[a] as number) + (curX[a] as number);
        const ay = (baseY[a] as number) + (homeY[a] as number) + (curY[a] as number);
        const bx = (baseX[b] as number) + (homeX[b] as number) + (curX[b] as number);
        const by = (baseY[b] as number) + (homeY[b] as number) + (curY[b] as number);
        const dx = bx - ax;
        const dy = by - ay;
        const dist = Math.max(1e-4, Math.hypot(dx, dy));
        const ux = dx / dist;
        const uy = dy / dist;
        const pa = rectAnchor(ax, ay, halfW[a] as number, halfH[a] as number, ux, uy);
        const pb = rectAnchor(bx, by, halfW[b] as number, halfH[b] as number, -ux, -uy);

        if (!dynamic) {
          path.setAttribute("d", `M ${pa.x} ${pa.y} L ${pb.x} ${pb.y}`);
          path.style.stroke = "var(--foreground)";
          path.style.strokeWidth = "1";
          path.style.strokeOpacity = "0.5";
          continue;
        }

        const rest = edgeRest[e] as number;
        const ratio = (dist - rest) / rest;
        let sag = 0;
        let width: number;
        let opacity: number;
        let mixPct: number;
        if (ratio >= 0) {
          const t = clamp01(ratio / MAX_TENSION);
          width = lerp(1, 0.5, t);
          opacity = lerp(0.55, 1, t);
          mixPct = 100;
        } else {
          const s = clamp01(-ratio / MAX_SLACK);
          const sagMax = clamp(rest * 0.16, 10, 46);
          sag = s * sagMax;
          width = 1;
          opacity = lerp(0.55, 0.16, s);
          mixPct = lerp(100, 25, s);
        }
        let nx = -uy;
        let ny = ux;
        if (ny < 0) {
          nx = -nx;
          ny = -ny;
        } // sag reads as gravity pulling down, not perpendicular either way
        const midX = (pa.x + pb.x) / 2 + nx * sag;
        const midY = (pa.y + pb.y) / 2 + ny * sag;
        path.setAttribute(
          "d",
          `M ${pa.x} ${pa.y} Q ${midX} ${midY} ${pb.x} ${pb.y}`
        );
        path.style.stroke =
          mixPct >= 99.5
            ? "var(--foreground)"
            : `color-mix(in oklab, var(--foreground) ${mixPct.toFixed(0)}%, var(--border))`;
        path.style.strokeWidth = width.toFixed(2);
        path.style.strokeOpacity = opacity.toFixed(2);
      }
    };

    const syncNow = () => {
      renderCards();
      drawEdges(!reduced);
    };

    // -- rAF spring loop (skipped entirely under reduced motion) -----------
    let raf = 0;
    let last = 0;
    const DT_CAP = 1 / 30;

    const integrate = (dt: number) => {
      const Fx = new Float32Array(n);
      const Fy = new Float32Array(n);
      for (let e = 0; e < edgeCount; e++) {
        const a = edgeA[e] as number;
        const b = edgeB[e] as number;
        const ax = (baseX[a] as number) + (homeX[a] as number) + (curX[a] as number);
        const ay = (baseY[a] as number) + (homeY[a] as number) + (curY[a] as number);
        const bx = (baseX[b] as number) + (homeX[b] as number) + (curX[b] as number);
        const by = (baseY[b] as number) + (homeY[b] as number) + (curY[b] as number);
        const dx = bx - ax;
        const dy = by - ay;
        const dist = Math.max(1e-4, Math.hypot(dx, dy));
        const rest = edgeRest[e] as number;
        if (dist > rest) {
          const f = CABLE_K * (dist - rest);
          const ux = dx / dist;
          const uy = dy / dist;
          Fx[a] = (Fx[a] as number) + f * ux;
          Fy[a] = (Fy[a] as number) + f * uy;
          Fx[b] = (Fx[b] as number) - f * ux;
          Fy[b] = (Fy[b] as number) - f * uy;
        }
      }
      let maxUnrest = 0;
      for (let i = 0; i < n; i++) {
        if (dragging[i]) continue;
        const ax =
          (Fx[i] as number) - ANCHOR_K * (curX[i] as number) - DAMPING * (velX[i] as number);
        const ay =
          (Fy[i] as number) - ANCHOR_K * (curY[i] as number) - DAMPING * (velY[i] as number);
        velX[i] = (velX[i] as number) + ax * dt;
        velY[i] = (velY[i] as number) + ay * dt;
        curX[i] = (curX[i] as number) + (velX[i] as number) * dt;
        curY[i] = (curY[i] as number) + (velY[i] as number) * dt;
        const unrest =
          Math.abs(velX[i] as number) +
          Math.abs(velY[i] as number) +
          Math.abs(curX[i] as number) +
          Math.abs(curY[i] as number);
        if (unrest > maxUnrest) maxUnrest = unrest;
      }
      return maxUnrest;
    };

    const loop = (now: number) => {
      const dt = last ? Math.min(DT_CAP, (now - last) / 1000) : 1 / 60;
      last = now;
      const maxUnrest = integrate(dt);
      renderCards();
      drawEdges(true);
      let anyDragging = false;
      for (let i = 0; i < n; i++) {
        if (dragging[i]) {
          anyDragging = true;
          break;
        }
      }
      if (maxUnrest > SLEEP_EPS || anyDragging) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = 0;
        last = 0;
      }
    };
    const wake = () => {
      if (reduced) return;
      if (!raf) raf = requestAnimationFrame(loop);
    };

    syncNow(); // paint the resting network before anything moves

    // -- interaction: pointer drag + keyboard nudge, shared by both modes --
    const engine: Engine = {
      reduced,
      beginDrag: (i, e) => {
        const rect = root.getBoundingClientRect();
        pointerId[i] = 1;
        startClientX[i] = e.clientX;
        startClientY[i] = e.clientY;
        moved[i] = 0;
        dragging[i] = 1;
        velX[i] = 0;
        velY[i] = 0;
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        grabX[i] =
          px - ((baseX[i] as number) + (homeX[i] as number) + (curX[i] as number));
        grabY[i] =
          py - ((baseY[i] as number) + (homeY[i] as number) + (curY[i] as number));
        if (reduced) {
          const el = cardEls[i];
          if (el) el.style.transition = "none";
        }
        wake();
      },
      dragMove: (i, e) => {
        if (!dragging[i]) return;
        const ddx = e.clientX - (startClientX[i] as number);
        const ddy = e.clientY - (startClientY[i] as number);
        if (!moved[i] && Math.hypot(ddx, ddy) > DRAG_THRESHOLD) moved[i] = 1;
        if (!moved[i]) return;
        const rect = root.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const targetAbsX = px - (grabX[i] as number);
        const targetAbsY = py - (grabY[i] as number);
        const clampedX = clamp(targetAbsX, halfW[i] as number, rect.width - (halfW[i] as number));
        const clampedY = clamp(targetAbsY, halfH[i] as number, rect.height - (halfH[i] as number));
        curX[i] = clampedX - (baseX[i] as number) - (homeX[i] as number);
        curY[i] = clampedY - (baseY[i] as number) - (homeY[i] as number);
        if (reduced) {
          syncNow();
        } else {
          wake();
        }
      },
      endDrag: (i) => {
        if (pointerId[i] === -1 && !dragging[i]) return;
        const wasMoved = moved[i] === 1;
        dragging[i] = 0;
        pointerId[i] = -1;
        suppressClick[i] = wasMoved ? 1 : 0;
        if (wasMoved) {
          // commit: the drop point becomes the new home. The cable rest
          // lengths did not change, so this is exactly what puts the
          // network under strain until it rings back down.
          homeX[i] = (homeX[i] as number) + (curX[i] as number);
          homeY[i] = (homeY[i] as number) + (curY[i] as number);
          curX[i] = 0;
          curY[i] = 0;
        }
        if (reduced) {
          const el = cardEls[i];
          if (el) el.style.transition = "transform 150ms ease";
          syncNow();
        } else {
          wake();
        }
      },
      nudge: (i, dx, dy) => {
        const rect = root.getBoundingClientRect();
        const nx = clamp(
          (homeX[i] as number) + dx * NUDGE_STEP,
          (halfW[i] as number) - (baseX[i] as number),
          rect.width - (halfW[i] as number) - (baseX[i] as number)
        );
        const ny = clamp(
          (homeY[i] as number) + dy * NUDGE_STEP,
          (halfH[i] as number) - (baseY[i] as number),
          rect.height - (halfH[i] as number) - (baseY[i] as number)
        );
        homeX[i] = nx;
        homeY[i] = ny;
        if (reduced) {
          const el = cardEls[i];
          if (el) el.style.transition = "transform 150ms ease";
          syncNow();
        } else {
          wake();
        }
      },
      consumeSuppressClick: (i) => {
        const s = suppressClick[i] === 1;
        suppressClick[i] = 0;
        return s;
      },
    };
    engineRef.current = engine;

    if (reduced) {
      // set the eased-transform baseline once; drag temporarily clears it
      cardEls.forEach((el) => {
        if (el) el.style.transition = "transform 150ms ease";
      });
    }

    const ro = new ResizeObserver(() => {
      measure();
      syncNow();
    });
    ro.observe(root);

    let visible = true;
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? true;
        if (!visible && raf) {
          cancelAnimationFrame(raf);
          raf = 0;
          last = 0;
        }
      },
      { threshold: 0 }
    );
    io.observe(root);

    return () => {
      engineRef.current = null;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, [items]);

  return (
    <div
      ref={rootRef}
      aria-label={ariaLabel}
      className={`relative w-full overflow-visible rounded-lg border border-border bg-background ${className}`}
    >
      <svg
        ref={svgRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      >
        {(() => {
          // build the same dedup'd edge list purely for stable React keys /
          // ref slots — the effect above rebuilds the identical set.
          const idxOf = new Map<string, number>();
          items.forEach((it, i) => idxOf.set(it.id, i));
          const seen = new Set<string>();
          const edges: [number, number][] = [];
          items.forEach((it, i) => {
            it.connections.forEach((cid) => {
              const j = idxOf.get(cid);
              if (j === undefined || j === i) return;
              const key = i < j ? `${i}-${j}` : `${j}-${i}`;
              if (seen.has(key)) return;
              seen.add(key);
              edges.push([Math.min(i, j), Math.max(i, j)]);
            });
          });
          return edges.map(([a, b], e) => (
            <path
              key={`${items[a]?.id}-${items[b]?.id}`}
              ref={(el) => {
                pathRefs.current[e] = el;
              }}
              fill="none"
              strokeLinecap="round"
            />
          ));
        })()}
      </svg>

      {items.map((item, i) => {
        const expanded = expandedIds.has(item.id);
        return (
          <div
            key={item.id}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            data-card-id={item.id}
            role="button"
            tabIndex={0}
            aria-label={item.label}
            aria-pressed={expanded}
            aria-describedby={`${item.id}-tsg-desc`}
            className={`absolute w-40 touch-none select-none rounded-md border bg-background px-3 py-2.5 text-left shadow-sm outline-none will-change-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 sm:w-48 ${
              expanded ? "border-accent" : "border-border"
            }`}
            style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%` }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              engineRef.current?.beginDrag(i, e);
            }}
            onPointerMove={(e) => engineRef.current?.dragMove(i, e)}
            onPointerUp={(e) => {
              try {
                e.currentTarget.releasePointerCapture(e.pointerId);
              } catch {
                // capture may already be gone — nothing to clean up
              }
              engineRef.current?.endDrag(i, e);
            }}
            onPointerCancel={(e) => engineRef.current?.endDrag(i, e)}
            onClick={() => {
              if (engineRef.current?.consumeSuppressClick(i)) return;
              toggleExpand(item.id);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleExpand(item.id);
                return;
              }
              const dir: Record<string, [number, number]> = {
                ArrowLeft: [-1, 0],
                ArrowRight: [1, 0],
                ArrowUp: [0, -1],
                ArrowDown: [0, 1],
              };
              const d = dir[e.key];
              if (!d) return;
              e.preventDefault();
              engineRef.current?.nudge(i, d[0], d[1]);
            }}
          >
            <span className="block truncate font-mono text-sm font-medium text-foreground">
              {item.label}
            </span>
            {item.caption ? (
              <span className="mt-0.5 block truncate text-xs text-muted">
                {item.caption}
              </span>
            ) : null}
            <span id={`${item.id}-tsg-desc`} className="sr-only">
              {`Connected to: ${item.connections
                .map((cid) => labelById.get(cid) ?? cid)
                .join(", ")}`}
            </span>
            {expanded ? (
              <span
                data-tsg-reveal
                className="mt-1.5 block text-xs text-accent"
              >
                {`→ ${item.connections
                  .map((cid) => labelById.get(cid) ?? cid)
                  .join(", ")}`}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
