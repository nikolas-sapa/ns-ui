"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// PacketTrace — a small fixed node/edge network (9 nodes, 13 hairline edges,
// deliberately irregular positions) with data pulses that travel edge-to-edge
// via random walks, easing along each segment with a short fading tail.
// Everything on the animation hot path (pulse head/tail positions) is a
// direct-DOM write of `cx`/`cy`/`opacity` on pre-mounted SVG circle refs
// inside a rAF loop — no React state per frame. Hovering (or focusing) a
// node is React state, since it only changes 9 edges' stroke + one node's
// radius, cheap enough to re-render.
//
// `state` drives traffic shape, not just a cosmetic tint:
//   - idle: sparse ambient pulses (~3 concurrent), slow spawn.
//   - active: dense traffic (~10 concurrent), fast spawn.
//   - error: every new pulse takes the shortest path to a fixed hub node
//     (the highest-degree node) and, on arrival, PARKS there instead of
//     despawning — pulses stack visually above the node (newest on top,
//     oldest evicted once the stack exceeds its cap) while the node itself
//     blinks --error via a CSS keyframe (not JS) for as long as `state`
//     stays "error". Switching away from "error" clears the queue.
//
// Reduced motion drops the whole rAF layer: no traveling pulses at all.
// Instead each edge's stroke-width is set from a fixed per-edge weight
// table (the network's inherent "which routes matter more" shape), so the
// static picture still communicates route frequency.
// ---------------------------------------------------------------------------

export type PacketTraceState = "idle" | "active" | "error";

export interface PacketTraceProps {
  /** Traffic pattern. Default "idle". */
  state?: PacketTraceState;
  className?: string;
}

const VIEW_W = 320;
const VIEW_H = 180;

interface Node {
  x: number;
  y: number;
}

// Deliberately irregular — hand-placed, not a grid.
const NODES: Node[] = [
  { x: 38, y: 92 },
  { x: 98, y: 36 },
  { x: 92, y: 152 },
  { x: 163, y: 55 },
  { x: 156, y: 124 },
  { x: 228, y: 26 },
  { x: 222, y: 93 },
  { x: 230, y: 146 },
  { x: 282, y: 102 },
];

// Undirected edges; several cycles so a random walk actually branches.
const EDGES: [number, number][] = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 3],
  [2, 4],
  [3, 5],
  [3, 6],
  [4, 6],
  [4, 7],
  [5, 6],
  [6, 7],
  [6, 8],
  [7, 8],
];

// Fixed per-edge traffic weight for the reduced-motion static picture —
// edges touching the hub (node 6) run heavier than peripheral spurs.
const EDGE_WEIGHT: number[] = EDGES.map(([a, b]) => (a === 6 || b === 6 ? 2.4 : a === 3 || b === 3 ? 1.6 : 1));

// Node 6 is the highest-degree node (5 edges) — the natural congestion
// point, and where "error" traffic queues.
const ERROR_NODE = 6;

const ADJACENCY: number[][] = NODES.map(() => []);
EDGES.forEach(([a, b]) => {
  ADJACENCY[a].push(b);
  ADJACENCY[b].push(a);
});

function randomWalk(start: number, hops: number): number[] {
  const path = [start];
  let prev = -1;
  let cur = start;
  for (let i = 0; i < hops; i++) {
    const neighbors = ADJACENCY[cur];
    const candidates = neighbors.filter((n) => n !== prev);
    const pool = candidates.length > 0 ? candidates : neighbors;
    const next = pool[Math.floor(Math.random() * pool.length)]!;
    path.push(next);
    prev = cur;
    cur = next;
  }
  return path;
}

function bfsPath(start: number, target: number): number[] {
  if (start === target) return [start];
  const prev = new Array(NODES.length).fill(-1);
  const visited = new Array(NODES.length).fill(false);
  visited[start] = true;
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === target) break;
    for (const n of ADJACENCY[cur]) {
      if (!visited[n]) {
        visited[n] = true;
        prev[n] = cur;
        queue.push(n);
      }
    }
  }
  const path: number[] = [];
  let cur = target;
  while (cur !== -1) {
    path.unshift(cur);
    if (cur === start) break;
    cur = prev[cur];
  }
  return path.length > 1 ? path : [start, target];
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

interface Pulse {
  path: number[];
  hop: number;
  t: number;
  speedPerMs: number;
  queued: boolean;
}

const MAX_PULSES = 16;
const TAIL_COUNT = 3;
const QUEUE_CAP = 6;

const CONCURRENCY: Record<PacketTraceState, number> = { idle: 3, active: 10, error: 4 };
const SPAWN_RANGE: Record<PacketTraceState, [number, number]> = {
  idle: [900, 1800],
  active: [150, 400],
  error: [400, 900],
};

export function PacketTrace({ state = "idle", className = "" }: PacketTraceProps) {
  const dotRefs = useRef<(SVGCircleElement | null)[][]>(
    Array.from({ length: MAX_PULSES }, () => Array(TAIL_COUNT + 1).fill(null))
  );
  const pulsesRef = useRef<(Pulse | null)[]>(Array(MAX_PULSES).fill(null));
  const queueOrderRef = useRef<number[]>([]);
  const nextSpawnAtRef = useRef(0);
  const visitCountsRef = useRef<number[]>(Array(NODES.length).fill(0));
  const stateRef = useRef<PacketTraceState>(state);

  const [reducedMotion, setReducedMotion] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Reset the simulation cleanly on every state transition.
  useEffect(() => {
    stateRef.current = state;
    pulsesRef.current = Array(MAX_PULSES).fill(null);
    queueOrderRef.current = [];
    nextSpawnAtRef.current = 0;
    for (const slot of dotRefs.current) {
      for (const el of slot) {
        if (el) el.style.opacity = "0";
      }
    }
    const text =
      state === "error"
        ? `Network error — packets queuing at node ${ERROR_NODE + 1}.`
        : state === "active"
          ? "Network active — dense traffic."
          : "Network idle.";
    setAnnounce(text);
  }, [state]);

  useEffect(() => {
    if (reducedMotion) return;
    let raf = 0;
    let last = performance.now();

    const setDot = (el: SVGCircleElement | null, x: number, y: number, opacity: number) => {
      if (!el) return;
      el.setAttribute("cx", String(x));
      el.setAttribute("cy", String(y));
      el.style.opacity = String(opacity);
    };

    const step = (now: number) => {
      const dt = now - last;
      last = now;
      const cur = stateRef.current;
      const pulses = pulsesRef.current;
      const concurrency = CONCURRENCY[cur];
      const [minSpawn, maxSpawn] = SPAWN_RANGE[cur];

      if (now >= nextSpawnAtRef.current) {
        const traveling = pulses.filter((p) => p && !p.queued).length;
        if (traveling < concurrency) {
          const slot = pulses.findIndex((p) => p === null);
          if (slot !== -1) {
            let path: number[];
            if (cur === "error") {
              let start = Math.floor(Math.random() * NODES.length);
              if (start === ERROR_NODE) start = (start + 1) % NODES.length;
              path = bfsPath(start, ERROR_NODE);
            } else {
              const start = Math.floor(Math.random() * NODES.length);
              path = randomWalk(start, 3 + Math.floor(Math.random() * 4));
            }
            const duration = 550 + Math.random() * 400;
            pulses[slot] = { path, hop: 0, t: 0, speedPerMs: 1 / duration, queued: false };
          }
        }
        nextSpawnAtRef.current = now + minSpawn + Math.random() * (maxSpawn - minSpawn);
      }

      for (let i = 0; i < pulses.length; i++) {
        const p = pulses[i];
        if (!p || p.queued) continue;
        p.t += p.speedPerMs * dt;
        if (p.t >= 1) {
          const arrivedIdx = p.hop + 1;
          const arrivedNode = p.path[arrivedIdx]!;
          visitCountsRef.current[arrivedNode]! += 1;
          if (arrivedIdx >= p.path.length - 1) {
            if (cur === "error" && arrivedNode === ERROR_NODE) {
              p.queued = true;
              p.t = 1;
              queueOrderRef.current.push(i);
              if (queueOrderRef.current.length > QUEUE_CAP) {
                const evict = queueOrderRef.current.shift()!;
                pulses[evict] = null;
              }
            } else {
              pulses[i] = null;
            }
          } else {
            p.hop = arrivedIdx;
            p.t = 0;
          }
        }
      }

      for (let i = 0; i < pulses.length; i++) {
        const p = pulses[i];
        const refs = dotRefs.current[i]!;
        if (!p) {
          for (const el of refs) if (el) el.style.opacity = "0";
          continue;
        }
        if (p.queued) {
          const qIdx = Math.max(0, queueOrderRef.current.indexOf(i));
          const node = NODES[ERROR_NODE]!;
          setDot(refs[0]!, node.x - 9, node.y - 12 - qIdx * 5, 1);
          for (let k = 1; k <= TAIL_COUNT; k++) if (refs[k]) refs[k]!.style.opacity = "0";
          continue;
        }
        const a = NODES[p.path[p.hop]!]!;
        const b = NODES[p.path[p.hop + 1]!]!;
        const eased = easeInOutCubic(p.t);
        setDot(refs[0]!, a.x + (b.x - a.x) * eased, a.y + (b.y - a.y) * eased, 1);
        for (let k = 1; k <= TAIL_COUNT; k++) {
          const tt = Math.max(0, eased - k * 0.14);
          const op = tt > 0 || eased > 0 ? Math.max(0.1, 1 - k * 0.3) : 0;
          setDot(refs[k]!, a.x + (b.x - a.x) * tt, a.y + (b.y - a.y) * tt, op);
        }
      }

      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion]);

  // Live-refresh the tooltip's throughput count while a node is hovered/focused.
  useEffect(() => {
    if (hoveredNode === null) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 500);
    return () => window.clearInterval(id);
  }, [hoveredNode]);

  const openNode = (idx: number) => setHoveredNode(idx);
  const closeNode = (idx: number) => setHoveredNode((cur) => (cur === idx ? null : cur));

  const hovered = hoveredNode !== null ? NODES[hoveredNode] : null;
  const throughput = hoveredNode !== null ? visitCountsRef.current[hoveredNode] : 0;
  void tick; // read for the interval's re-render side effect only

  return (
    <div className={`relative inline-block ${className}`}>
      <style>{CSS}</style>
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announce}
      </span>

      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width="100%"
        style={{ maxWidth: VIEW_W }}
        focusable="false"
      >
        <g aria-hidden="true">
          {EDGES.map(([a, b], i) => {
            const na = NODES[a]!;
            const nb = NODES[b]!;
            const isHoverRoute = hoveredNode !== null && (a === hoveredNode || b === hoveredNode);
            const width = reducedMotion ? 0.6 + EDGE_WEIGHT[i]! * 0.7 : isHoverRoute ? 1.6 : 1;
            return (
              <line
                key={i}
                x1={na.x}
                y1={na.y}
                x2={nb.x}
                y2={nb.y}
                stroke={isHoverRoute ? "var(--foreground)" : "var(--border)"}
                strokeWidth={width}
                strokeLinecap="round"
              />
            );
          })}
        </g>

        {!reducedMotion && (
          <g aria-hidden="true">
            {Array.from({ length: MAX_PULSES }, (_, i) => (
              <g key={i}>
                {Array.from({ length: TAIL_COUNT + 1 }, (_, k) => (
                  <circle
                    key={k}
                    ref={(el) => {
                      dotRefs.current[i]![k] = el;
                    }}
                    r={k === 0 ? 2 : 1.4}
                    fill="var(--foreground)"
                    opacity={0}
                    cx={-10}
                    cy={-10}
                  />
                ))}
              </g>
            ))}
          </g>
        )}

        {reducedMotion && state === "error" && (
          <g aria-hidden="true">
            {[0, 1, 2].map((k) => (
              <circle
                key={k}
                cx={NODES[ERROR_NODE]!.x - 9}
                cy={NODES[ERROR_NODE]!.y - 12 - k * 5}
                r={1.4}
                fill="var(--foreground)"
                opacity={1 - k * 0.25}
              />
            ))}
          </g>
        )}

        {NODES.map((n, i) => {
          const isHovered = hoveredNode === i;
          const isError = state === "error" && i === ERROR_NODE;
          return (
            <circle
              key={i}
              role="button"
              tabIndex={0}
              aria-label={`Network node ${i + 1}${isError ? ", congested" : ""}`}
              aria-describedby={isHovered ? "network-packet-trace-tip" : undefined}
              cx={n.x}
              cy={n.y}
              r={isHovered ? 5.5 : 4}
              fill={isError ? "var(--error)" : "var(--foreground)"}
              className={isError ? "ns-pk-blink" : undefined}
              style={{ cursor: "pointer", outline: "none" }}
              onPointerEnter={() => openNode(i)}
              onPointerLeave={() => closeNode(i)}
              onFocus={() => openNode(i)}
              onBlur={() => closeNode(i)}
              onKeyDown={(e) => {
                if (e.key === "Escape") closeNode(i);
              }}
            />
          );
        })}

        {hoveredNode !== null && (
          <circle
            cx={NODES[hoveredNode]!.x}
            cy={NODES[hoveredNode]!.y}
            r={8}
            fill="none"
            stroke="var(--foreground)"
            strokeWidth={1}
            opacity={0.35}
            aria-hidden="true"
          />
        )}
      </svg>

      {hovered && (
        <div
          id="network-packet-trace-tip"
          role="tooltip"
          aria-live="off"
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-[6px] border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground shadow-sm"
          style={{
            left: `${(hovered.x / VIEW_W) * 100}%`,
            top: `${(hovered.y / VIEW_H) * 100 - 4}%`,
          }}
        >
          Node {hoveredNode! + 1} — {throughput} routed
        </div>
      )}
    </div>
  );
}

const CSS = `
@keyframes ns-pk-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
.ns-pk-blink { animation: ns-pk-blink 1.1s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .ns-pk-blink { animation: none; }
}
`;
