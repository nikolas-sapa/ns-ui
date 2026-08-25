"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";

// ---------------------------------------------------------------------------
// BackgroundCapillaryWick — a full-bleed ambient background modeling paper
// chromatography: ink fronts wicking along a FIXED fibre-vein lattice, not a
// fluid turbulence field. The substrate is a 2D canvas graph (jittered
// triangular mesh of nodes + edges, generated once per size and never
// reshuffled), and the physics is front propagation along that graph —
// deceleration per the Washburn capillary-rise law (dPos/dt ∝ 1/√pos, a real
// front slows as it climbs because flow resistance grows with wetted length),
// stalling at each junction for a random dwell, then re-igniting a subset of
// the node's still-dry outgoing edges. This is the load-bearing difference
// from dye-whorl (registry/loud/dye-whorl): dye-whorl is a real incompressible
// Navier-Stokes solver advecting a continuous dye field through open fluid —
// no lattice, no discrete fronts, no junctions. Here the graph topology IS
// the physics; there is no velocity field, no pressure solve, no advection —
// ink can only exist ON an edge, and only in the order the graph connects.
//
// ALIVE AT REST, structurally, not cosmetically: a wet edge does not stay
// wet. After a dwell past saturation it EVAPORATES (intensity decays back to
// zero on a slower time constant than wetting), which returns it to "dry"
// and eligible for re-ignition by a later nucleation event elsewhere on the
// mesh. So the field is a standing turnover, not a fill-to-completion —
// there is no saturated end state to reach, by construction, forever.
//
// READING ZONE: fresh nucleation points are weighted away from the
// container's centre, and every stroke's alpha is additionally scaled by a
// radial coverage mask that stays low near centre and rises toward the
// edges — so overlaid headline/CTA content (typically centred) keeps a
// legible field under it even while the lattice is busy at the margins.
//
// Tokens: --foreground is the only ink color (wetted strokes + the bright
// advancing front head); --ns-muted draws the always-visible dry lattice
// structure at low alpha, well below --border's separator contrast, so the
// fixed veins read as texture rather than as a UI seam. No --ns-accent
// anywhere — this is a resting ambient surface with no interaction moment.
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;

// mulberry32 — deterministic per-mesh PRNG so a given size always regenerates
// the same lattice topology (only the runtime front schedule differs).
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Node {
  x: number;
  y: number;
  edges: number[]; // indices into the edges array
  stallUntil: number; // sim time the node may spread to dry neighbors
  pendingSpread: boolean;
}

interface Edge {
  a: number;
  b: number;
  len: number; // px, for speed normalization
  cx: number; // midpoint, for the coverage mask
  cy: number;
  state: 0 | 1 | 2; // 0 dry, 1 wetting (front advancing), 2 wet (post-saturation)
  pos: number; // 0..1 front position while wetting
  intensity: number; // 0..1 ink alpha, ramps to 1 on saturation, decays on evaporation
  wetAt: number; // sim time it reached state 2, for the evaporation delay
}

const EVAP_DELAY = 3.4; // s a wet edge holds full intensity before it starts fading
const EVAP_TAU = 2.6; // s time constant of the fade back to dry
const WICK_K = 0.34; // Washburn rate constant, grid-units/s^0.5 equivalent
const NUCLEATE_MIN = 0.5; // s between nucleation attempts
const NUCLEATE_MAX = 1.3;
const STALL_MIN = 0.25; // s a junction holds before re-igniting neighbors
const STALL_MAX = 1.1;
const SPREAD_CHANCE = 0.62; // per-edge odds a dry neighbor gets re-ignited at a spread event
const CENTER_COVERAGE = 0.16; // ink alpha multiplier at the reading-zone centre
const EDGE_COVERAGE = 1.0; // ink alpha multiplier at the frame edges
const WARM_STEPS = 260; // fixed-dt sim steps run before first paint (and for reduced motion)
const WARM_DT = 1 / 30;

export interface BackgroundCapillaryWickProps {
  /** lattice pitch as a fraction of the container's smaller dimension. @default 0.055 */
  pitchRatio?: number;
  /** freeze the field at its warm-start frame. @default false */
  paused?: boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function BackgroundCapillaryWick({
  pitchRatio = 0.055,
  paused = false,
  children,
  className = "",
  style,
}: BackgroundCapillaryWickProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // token fields start empty and are assigned unconditionally from
    // getComputedStyle before any draw path can run — nothing here has a
    // literal fallback color.
    let ink = "";
    let muted = "";
    let bg = "";
    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      ink = cs.getPropertyValue("--foreground").trim();
      muted = cs.getPropertyValue("--ns-muted").trim();
      bg = cs.getPropertyValue("--background").trim();
    };

    let dpr = 1;
    let width = 0;
    let height = 0;
    let sized = false;
    let ready = false;
    let disposed = false;
    let visible = true;
    let raf = 0;
    let last = 0;
    let simTime = 0;

    let nodes: Node[] = [];
    let edges: Edge[] = [];
    let nextNucleate = 0;
    let pitch = 40;
    let strokeW = 1.5;

    const rand = mulberry32(0x9e3779b9);

    const buildLattice = () => {
      pitch = Math.max(22, Math.min(72, Math.min(width, height) * pitchRatio));
      strokeW = Math.max(1, pitch * 0.055);

      const cols = Math.ceil(width / pitch) + 2;
      const rows = Math.ceil(height / pitch) + 2;
      const jitter = pitch * 0.28;

      nodes = [];
      const grid: number[][] = [];
      for (let ry = 0; ry < rows; ry++) {
        const rowIdx: number[] = [];
        for (let rx = 0; rx < cols; rx++) {
          // hex-ish stagger so the mesh doesn't read as a raw square grid
          const offsetX = ry % 2 === 0 ? 0 : pitch * 0.5;
          const x = rx * pitch + offsetX - pitch + (rand() - 0.5) * jitter;
          const y = ry * pitch - pitch + (rand() - 0.5) * jitter;
          rowIdx.push(nodes.length);
          nodes.push({ x, y, edges: [], stallUntil: 0, pendingSpread: false });
        }
        grid.push(rowIdx);
      }

      edges = [];
      const addEdge = (ia: number, ib: number) => {
        if (ia === ib) return;
        const na = nodes[ia];
        const nb = nodes[ib];
        const dx = nb.x - na.x;
        const dy = nb.y - na.y;
        const len = Math.hypot(dx, dy);
        if (len < 1 || len > pitch * 2.2) return; // fixed lattice: no long-range shortcuts
        const ei = edges.length;
        edges.push({
          a: ia,
          b: ib,
          len,
          cx: (na.x + nb.x) / 2,
          cy: (na.y + nb.y) / 2,
          state: 0,
          pos: 0,
          intensity: 0,
          wetAt: 0,
        });
        na.edges.push(ei);
        nb.edges.push(ei);
      };

      // connect each node to its right, down, and both down-diagonal
      // neighbors — a fixed triangular fibre mesh, built once per size.
      for (let ry = 0; ry < rows; ry++) {
        for (let rx = 0; rx < cols; rx++) {
          const i = grid[ry][rx];
          if (rx + 1 < cols) addEdge(i, grid[ry][rx + 1]);
          if (ry + 1 < rows) {
            addEdge(i, grid[ry + 1][rx]);
            const offsetEven = ry % 2 === 0;
            if (offsetEven && rx - 1 >= 0) addEdge(i, grid[ry + 1][rx - 1]);
            if (!offsetEven && rx + 1 < cols) addEdge(i, grid[ry + 1][rx + 1]);
          }
        }
      }

      simTime = 0;
      nextNucleate = NUCLEATE_MIN;
    };

    const dryNeighbors = (nodeIndex: number) =>
      nodes[nodeIndex].edges.filter((ei) => edges[ei].state === 0);

    const centerDist01 = (x: number, y: number) => {
      // 0 at container centre, 1 at the frame's far corner
      const dx = (x - width / 2) / (width / 2 || 1);
      const dy = (y - height / 2) / (height / 2 || 1);
      return Math.min(1, Math.hypot(dx, dy));
    };

    const igniteEdge = (ei: number) => {
      const e = edges[ei];
      e.state = 1;
      e.pos = 0;
      e.intensity = 0.18;
    };

    const tryNucleate = () => {
      if (nodes.length === 0) return;
      // bias node selection away from the reading zone at the container's
      // centre — fewer fresh sources start there, keeping it lighter.
      for (let attempt = 0; attempt < 6; attempt++) {
        const idx = Math.floor(rand() * nodes.length);
        const n = nodes[idx];
        const d = centerDist01(n.x, n.y);
        if (rand() > 0.25 + d * 0.75) continue; // low d (near centre) mostly rejected
        const candidates = dryNeighbors(idx);
        if (candidates.length === 0) continue;
        igniteEdge(candidates[Math.floor(rand() * candidates.length)]);
        return;
      }
    };

    const spreadFromNode = (nodeIndex: number) => {
      const candidates = dryNeighbors(nodeIndex);
      if (candidates.length === 0) return;
      let ignitedAny = false;
      for (const ei of candidates) {
        if (rand() < SPREAD_CHANCE) {
          igniteEdge(ei);
          ignitedAny = true;
        }
      }
      // a junction that rolled all misses still routes to one edge — a real
      // capillary front never just stops at a junction with dry paper open.
      if (!ignitedAny) igniteEdge(candidates[Math.floor(rand() * candidates.length)]);
    };

    const step = (dt: number) => {
      simTime += dt;

      if (simTime >= nextNucleate) {
        tryNucleate();
        nextNucleate = simTime + NUCLEATE_MIN + rand() * (NUCLEATE_MAX - NUCLEATE_MIN);
      }

      for (let i = 0; i < edges.length; i++) {
        const e = edges[i];
        if (e.state === 1) {
          // Washburn capillary rise: front speed falls off as 1/sqrt(distance
          // already wetted) — fast off the junction, decelerating as it
          // climbs, because wetted-length resistance grows with distance.
          const speed = (WICK_K / Math.sqrt(Math.max(e.pos, 0.06))) * (pitch / Math.max(e.len, 1));
          e.pos += speed * dt;
          e.intensity = Math.min(1, e.intensity + dt * 1.4);
          if (e.pos >= 1) {
            e.pos = 1;
            e.state = 2;
            e.intensity = 1;
            e.wetAt = simTime;
            const farNode = nodes[e.b];
            if (!farNode.pendingSpread) {
              farNode.pendingSpread = true;
              farNode.stallUntil = simTime + STALL_MIN + rand() * (STALL_MAX - STALL_MIN);
            }
          }
        } else if (e.state === 2) {
          const age = simTime - e.wetAt;
          if (age > EVAP_DELAY) {
            e.intensity *= Math.exp(-dt / EVAP_TAU);
            if (e.intensity < 0.035) {
              e.intensity = 0;
              e.state = 0;
              e.pos = 0;
            }
          }
        }
      }

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (n.pendingSpread && simTime >= n.stallUntil) {
          spreadFromNode(i);
          n.pendingSpread = false;
        }
      }
    };

    const draw = () => {
      if (!sized) return;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // dry lattice: always-visible faint structure, well under --border's
      // separator contrast — reads as fibre texture, not a UI seam.
      ctx.strokeStyle = muted;
      ctx.globalAlpha = 0.16;
      ctx.lineWidth = strokeW * 0.6;
      ctx.beginPath();
      for (const e of edges) {
        if (e.state !== 0) continue;
        const na = nodes[e.a];
        const nb = nodes[e.b];
        ctx.moveTo(na.x, na.y);
        ctx.lineTo(nb.x, nb.y);
      }
      ctx.stroke();

      // wet + wetting edges: --foreground ink, alpha = intensity * a radial
      // coverage mask that stays low near centre so overlaid content reads.
      ctx.strokeStyle = ink;
      ctx.lineCap = "round";
      for (const e of edges) {
        if (e.state === 0 || e.intensity <= 0) continue;
        const na = nodes[e.a];
        const nb = nodes[e.b];
        const mask = CENTER_COVERAGE + (EDGE_COVERAGE - CENTER_COVERAGE) * centerDist01(e.cx, e.cy);
        const alpha = e.intensity * mask;
        if (alpha <= 0.01) continue;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = strokeW;
        ctx.beginPath();
        if (e.state === 1) {
          const fx = na.x + (nb.x - na.x) * e.pos;
          const fy = na.y + (nb.y - na.y) * e.pos;
          ctx.moveTo(na.x, na.y);
          ctx.lineTo(fx, fy);
          ctx.stroke();
          // the advancing meniscus — a small bright head at the front, the
          // one moment brighter than steady-state ink.
          ctx.beginPath();
          ctx.globalAlpha = Math.min(1, alpha * 1.6);
          ctx.arc(fx, fy, strokeW * 1.15, 0, TAU);
          ctx.fillStyle = ink;
          ctx.fill();
        } else {
          ctx.moveTo(na.x, na.y);
          ctx.lineTo(nb.x, nb.y);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        sized = false;
        return;
      }
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildLattice();
      sized = true;
    };

    const warmStart = () => {
      for (let i = 0; i < WARM_STEPS; i++) step(WARM_DT);
    };

    const loop = (now: number) => {
      if (!visible) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      step(dt);
      draw();
      raf = requestAnimationFrame(loop);
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (!sized) return;
        // a lattice regenerates on resize, so re-warm it before the next
        // paint rather than showing a bare freshly-dry mesh for a beat.
        warmStart();
        ready = true;
        if (reduced || paused) {
          draw();
        } else {
          draw();
          if (visible && !raf) {
            last = 0;
            raf = requestAnimationFrame(loop);
          }
        }
      }, 150);
    };

    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        if (visible && ready && !reduced && !paused) {
          last = 0;
          raf = requestAnimationFrame(loop);
        } else {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      { threshold: 0 }
    );
    io.observe(canvas);

    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (visible && ready && !reduced && !paused) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced || paused) draw();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    document.fonts.ready.then(() => {
      if (disposed) return;
      readTokens();
      resize();
      if (!sized) {
        ready = true;
        return;
      }
      // fixed-dt warm start so the first paint — and the reduced-motion
      // frame — already shows multiple fronts mid-advance with visible
      // branching, never a bare or fully-saturated lattice.
      warmStart();
      ready = true;
      if (reduced || paused) {
        draw();
      } else {
        raf = requestAnimationFrame(loop);
      }
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [pitchRatio, paused]);

  return (
    <div
      className={`relative isolate h-full w-full overflow-hidden bg-background ${className}`}
      style={style}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 block h-full w-full"
      />
      {children ? <div className="relative z-[1] h-full w-full">{children}</div> : null}
    </div>
  );
}

BackgroundCapillaryWick.displayName = "BackgroundCapillaryWick";
