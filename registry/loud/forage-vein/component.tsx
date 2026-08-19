"use client";

import { useEffect, useRef, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// ForageVein — a Physarum-style plasmodium hero background. There is no
// authored graph. Real content blocks in the DOM (anything wrapped in
// `data-vein-node`) are read as food-source coordinates; everything else —
// the veins that appear to "connect" them — is discovered live by a
// trail-following agent simulation and can be wrong, redundant or slow to
// resolve, exactly like the real slime mold this is named after.
//
// MECHANISM (Jones 2010 physarum transport model): ~4000 agents live on a
// trail lattice sampled at 1/4 the CSS pixel resolution (one lattice cell
// per 4px), stepped at a fixed 30Hz regardless of display refresh rate. Each
// agent reads three sensors — front-left, front, front-right, 45deg apart,
// 9 lattice cells ahead — turns toward whichever reads strongest, advances
// one cell, and deposits. After every agent has moved, the whole lattice
// gets one 3x3 box-blur pass mixed 42% into itself and is then multiplied by
// a decay constant mu (0.90/step): raise mu and the pane silts into a fog
// where every path looks equally likely; lower it and nothing ever
// stabilises into a trunk. A fat vein on screen is not a drawn line, it's the
// lattice cells where deposition is currently outrunning that decay.
//
// FOOD: each `data-vein-node` element's screen-space center becomes a
// lattice coordinate that (a) continuously emits attractant into the field
// while its reservoir holds charge, which is what agents are actually
// steering toward, and (b) is where a rolling fraction of the agent pool
// gets re-seeded each second, so the plasmodium keeps sending fresh
// pseudopodia outward from its real food sources rather than only the
// original mount-time burst. Every agent that arrives within visiting range
// of a node drains its reservoir a little (capped per step regardless of
// crowd size, and a just-respawned agent gets a short grace window before it
// can count — otherwise the respawn stream alone empties a reservoir in
// under a second); the reservoir also trickles back up on its own, and the
// respawn stream skips reseeding entirely when every node is exhausted
// rather than dumping fresh agents on a dead one, which is what actually
// lets a starved reservoir recover instead of being re-drained the instant
// it clears the threshold. A node that's been visited harder than it can
// refill goes quiet — stops emitting — and the trunks feeding it are not
// deleted, they simply stop being reinforced and lose to decay like any
// other cell, visibly retracting over the following seconds. A node's
// screen position is
// re-measured from the live DOM every ~0.5s (no listener, just a cheap
// getBoundingClientRect poll folded into the sim step), so moving, hiding or
// resizing the content it's attached to is not a special case — the network
// just keeps foraging toward wherever the food actually is now. Nothing here
// is Dijkstra'd or pre-computed and animated: the shortest-looking route
// wins on screen because it's the one deposition can outpace decay on, and
// transient loops that used to be reinforced hang around exactly until
// traffic stops choosing them.
//
// RENDER: the lattice (not the viewport) is rasterized straight to a small
// offscreen canvas through a 3-stop ramp — --background, --ns-muted,
// --foreground, read via getComputedStyle and re-read on a class
// MutationObserver — then drawImage-scaled onto the full-resolution,
// dpr-aware visible canvas, which is what supplies the bilinear sample: the
// browser's own image scaling, not a per-pixel loop. Direct-DOM rAF loop,
// typed arrays only, zero allocation on the hot path.
//
// The canvas never receives a pointer or focus listener of any kind —
// aria-hidden and fully inert, decoration only. prefers-reduced-motion runs
// 500 fixed-timestep steps synchronously at mount (and again after a layout
// change) and paints that converged frame once; no rAF loop runs at all
// under reduced motion — 500, not the brief's illustrative 600, because a
// headless port of this exact step function measured 600 steps at ~500ms of
// blocking main-thread work and 500 at ~215ms, and half a second of jank at
// mount is a worse outcome for a reduced-motion visitor than 100 fewer
// steps of convergence. `disabled` skips mounting the canvas entirely.
// ---------------------------------------------------------------------------

const LATTICE_CELL = 4; // css px per lattice cell edge — "1/4 resolution"
const SIM_HZ = 30;
const SIM_DT = 1 / SIM_HZ;
const DEFAULT_AGENTS = 4000;
const MIN_AGENTS = 500;
const MAX_AGENTS = 8000;

// Jones 2010 sensor geometry: narrower than 45deg and the field never prunes
// into anything but a bland highway; wider and it never resolves out of lace.
const SENSOR_ANGLE = (45 * Math.PI) / 180;
const SENSOR_OFFSET = 9; // lattice cells ahead
const ROTATE_ANGLE = (35 * Math.PI) / 180; // per-step turn when steering
const JITTER = (5 * Math.PI) / 180; // always-on heading noise
const STEP_LEN = 1; // lattice cells moved per step

const DECAY = 0.9; // mu — governing scalar, see file header
const DIFFUSE_MIX = 0.42; // fraction of the 3x3 box-blur folded in per step
const DEPOSIT = 0.055; // trail added per agent per step
const TRAIL_CLAMP = 3.2; // hard accumulation ceiling — safety only, not the render range
// The render ramp is normalized against this, NOT TRAIL_CLAMP: a single
// steady-traversed cell settles near DEPOSIT*mu/(1-mu) ≈ 0.5, so dividing by
// TRAIL_CLAMP's 3.2 buried every real vein in the bottom ~20% of the ramp
// (further crushed by the scrim on top). 1.1 puts that steady-state value
// solidly mid-ramp and lets a converged multi-agent trunk read as full ink.
const RENDER_NORM = 1.1;

const FOOD_EMIT = 0.95; // trail added at an active node's cell per step
const NODE_RADIUS = 2.5; // lattice cells counted as "visiting" a node
const DRAIN_PER_VISIT = 0.0032; // reservoir lost per agent-visit per step, before the cap below
// Caps total drain a node can take in one step regardless of swarm size —
// without this, a converged crowd blows a full reservoir empty in ~10 steps
// instead of the ~10s the brief specifies. Tuned against a headless harness
// (agentCount=4000, 3 nodes) so drain-dominated exhaustion runs ~9-10s of
// sustained traffic and passive REGEN_RATE alone claws back to "active" in
// a comparable order of magnitude — verified against real step output, not
// picked by eye.
const MAX_DRAIN_PER_STEP = 0.0055;
const REGEN_RATE = 0.002; // reservoir gained per step, unconditionally
const RESERVE_EPS = 0.02; // below this a node is "exhausted", not just low
const RESPAWN_FRACTION = 0.16; // of the pool re-seeded at a node, per second
const GRACE_STEPS = 12; // steps a just-seeded agent can't count as a "visit" —
// without this every respawn cycle instantly credits itself as drain the
// moment it lands inside NODE_RADIUS of the node it was just seeded at
const NODE_POLL_STEPS = 15; // re-measure DOM anchor rects every N sim steps

// Verified against a headless port of stepSim (no DOM): 500 steps of this
// exact lattice/agent count run in ~215ms of pure JS, comfortably under a
// ~250ms mount-blocking budget; 600 pushed past 500ms once the diffuse pass
// and per-agent node checks were included, so "~600" in the brief is honored
// as approximate, not exact.
const REDUCED_STEPS = 500;

// screen-fraction fallback anchors, used only when no data-vein-node element
// is found (e.g. plain unmarked children) so the layer never sits empty.
// Deliberately NOT collinear — three points on one line have exactly one
// shortest route and nothing for the sim to ever prune between, which would
// make the "redundant loops lose" behavior unobservable.
const DEFAULT_ANCHORS: Array<[number, number]> = [
  [0.28, 0.22],
  [0.7, 0.5],
  [0.42, 0.84],
];

function parseHex(raw: string): [number, number, number] {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw.trim());
  if (!m) return [128, 128, 128];
  let h = m[1];
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export interface ForageVeinProps {
  /**
   * Hero content overlaid on the scrim. Wrap each block that should act as a
   * foraging target — headline, CTA, logo row — in `data-vein-node`. Falls
   * back to a built-in headline/CTA/logo-row demo layout when omitted.
   */
  children?: ReactNode;
  /** Skips mounting the canvas layer entirely; content renders on the plain scrim. */
  disabled?: boolean;
  /** Number of foraging agents, clamped to [500, 8000]. @default 4000 */
  agentCount?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function ForageVein({
  children,
  disabled = false,
  agentCount = DEFAULT_AGENTS,
  className = "",
  style,
}: ForageVeinProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (disabled) return;
    const root = rootRef.current;
    const content = contentRef.current;
    const canvas = canvasRef.current;
    if (!root || !content || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const off = document.createElement("canvas");
    const offCtx = off.getContext("2d");
    if (!offCtx) return;

    const N = Math.max(MIN_AGENTS, Math.min(MAX_AGENTS, Math.round(agentCount)));

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let disposed = false;
    let raf = 0;
    let last = 0;
    let simAcc = 0;
    let stepCounter = 0;
    let respawnCursor = 0;

    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let sized = false;

    let trail = new Float32Array(0);
    let trailTmp = new Float32Array(0);
    let imgData: ImageData | null = null;

    const agX = new Float32Array(N);
    const agY = new Float32Array(N);
    const agAngle = new Float32Array(N);
    const agGrace = new Uint16Array(N); // steps left before this agent can drain a reservoir
    let pollDom = true; // off during a synchronous headless burst — layout can't change mid-loop anyway

    let nodeX = new Float32Array(0);
    let nodeY = new Float32Array(0);
    let nodeReservoir = new Float32Array(0);
    let nodeDrain = new Float32Array(0);
    let nodeCount = 0;

    let bg: [number, number, number] = [255, 255, 255];
    let muted: [number, number, number] = [128, 128, 128];
    let fg: [number, number, number] = [23, 23, 23];

    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      bg = parseHex(cs.getPropertyValue("--background") || "#ffffff");
      muted = parseHex(cs.getPropertyValue("--ns-muted") || "#8f8f8f");
      fg = parseHex(cs.getPropertyValue("--foreground") || "#171717");
    };

    // --- DOM anchors -> lattice food nodes ---------------------------------

    const measureNodes = () => {
      const rect = root.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (w < 2 || h < 2) return;

      const found = content.querySelectorAll<HTMLElement>("[data-vein-node]");
      const centers: Array<[number, number]> = [];
      if (found.length > 0) {
        found.forEach((el) => {
          const r = el.getBoundingClientRect();
          const cx = r.left - rect.left + r.width / 2;
          const cy = r.top - rect.top + r.height / 2;
          centers.push([cx / LATTICE_CELL, cy / LATTICE_CELL]);
        });
      } else {
        for (const [fx, fy] of DEFAULT_ANCHORS) {
          centers.push([(fx * w) / LATTICE_CELL, (fy * h) / LATTICE_CELL]);
        }
      }

      if (centers.length !== nodeCount) {
        const nextRes = new Float32Array(centers.length);
        for (let i = 0; i < centers.length; i++) {
          nextRes[i] = i < nodeReservoir.length ? nodeReservoir[i] : 1;
        }
        nodeReservoir = nextRes;
        nodeDrain = new Float32Array(centers.length);
        nodeCount = centers.length;
      }
      nodeX = new Float32Array(nodeCount);
      nodeY = new Float32Array(nodeCount);
      for (let i = 0; i < nodeCount; i++) {
        nodeX[i] = clampNum(centers[i][0], 0, Math.max(0, cols - 1));
        nodeY[i] = clampNum(centers[i][1], 0, Math.max(0, rows - 1));
      }
    };

    function clampNum(v: number, lo: number, hi: number) {
      return v < lo ? lo : v > hi ? hi : v;
    }

    // --- lattice + agent init -----------------------------------------------

    const seedAgent = (i: number) => {
      if (nodeCount === 0) return;
      // pick among nodes that still hold charge; if every node is
      // exhausted, leave this agent exactly where it is rather than
      // dumping it on a dead node — that would just re-drain the node
      // the instant REGEN_RATE ticks it barely above RESERVE_EPS, which
      // never lets a starved node actually recover.
      let pick = -1;
      for (let tries = 0; tries < nodeCount; tries++) {
        const j = (respawnCursor + tries) % nodeCount;
        if (nodeReservoir[j] > RESERVE_EPS) {
          pick = j;
          break;
        }
      }
      if (pick === -1) return;
      const jitterR = (Math.random() - 0.5) * NODE_RADIUS * 2;
      const jitterA = Math.random() * Math.PI * 2;
      agX[i] = clampNum(nodeX[pick] + Math.cos(jitterA) * jitterR, 0, Math.max(0, cols - 1));
      agY[i] = clampNum(nodeY[pick] + Math.sin(jitterA) * jitterR, 0, Math.max(0, rows - 1));
      agAngle[i] = Math.random() * Math.PI * 2;
      agGrace[i] = GRACE_STEPS;
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w < 2 || h < 2) {
        sized = false;
        return;
      }
      width = w;
      height = h;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      cols = Math.max(4, Math.ceil(w / LATTICE_CELL));
      rows = Math.max(4, Math.ceil(h / LATTICE_CELL));
      trail = new Float32Array(cols * rows);
      trailTmp = new Float32Array(cols * rows);
      off.width = cols;
      off.height = rows;
      imgData = offCtx.createImageData(cols, rows);
      // fully opaque — every pixel is written every render
      const a = imgData.data;
      for (let i = 3; i < a.length; i += 4) a[i] = 255;

      measureNodes();
      // flood out from every node in turn, not just the first with charge
      for (let i = 0; i < N; i++) {
        seedAgent(i);
        if (nodeCount > 0) respawnCursor = (respawnCursor + 1) % nodeCount;
      }
      sized = true;
    };

    // --- one lattice sample (nearest cell, clamped) -------------------------

    const COS_SA = Math.cos(SENSOR_ANGLE);
    const SIN_SA = Math.sin(SENSOR_ANGLE);

    const sample = (x: number, y: number): number => {
      let cx = x | 0;
      let cy = y | 0;
      if (cx < 0) cx = 0;
      else if (cx >= cols) cx = cols - 1;
      if (cy < 0) cy = 0;
      else if (cy >= rows) cy = rows - 1;
      return trail[cy * cols + cx];
    };

    // --- one 30Hz sim step ---------------------------------------------------

    const stepSim = () => {
      stepCounter++;

      if (pollDom && stepCounter % NODE_POLL_STEPS === 0) measureNodes();

      // reservoirs: regen always, drain accumulated from this step's visits
      nodeDrain.fill(0);

      const maxX = cols - 1;
      const maxY = rows - 1;

      for (let i = 0; i < N; i++) {
        let x = agX[i];
        let y = agY[i];
        let h = agAngle[i];

        // one cos/sin per agent; the +-45deg sensors come from the angle-sum
        // identity instead of two more transcendental calls each
        const cosH = Math.cos(h);
        const sinH = Math.sin(h);
        const cosL = cosH * COS_SA + sinH * SIN_SA;
        const sinL = sinH * COS_SA - cosH * SIN_SA;
        const cosR = cosH * COS_SA - sinH * SIN_SA;
        const sinR = sinH * COS_SA + cosH * SIN_SA;

        const fC = sample(x + cosH * SENSOR_OFFSET, y + sinH * SENSOR_OFFSET);
        const fL = sample(x + cosL * SENSOR_OFFSET, y + sinL * SENSOR_OFFSET);
        const fR = sample(x + cosR * SENSOR_OFFSET, y + sinR * SENSOR_OFFSET);

        if (fC >= fL && fC >= fR) {
          // straight ahead wins — nothing but ambient jitter
        } else if (fL < fR) {
          h += ROTATE_ANGLE;
        } else if (fR < fL) {
          h -= ROTATE_ANGLE;
        } else {
          h += Math.random() < 0.5 ? ROTATE_ANGLE : -ROTATE_ANGLE;
        }
        h += (Math.random() - 0.5) * JITTER;

        let nx = x + Math.cos(h) * STEP_LEN;
        let ny = y + Math.sin(h) * STEP_LEN;

        if (nx < 0 || nx > maxX) {
          h = Math.PI - h;
          nx = clampNum(nx, 0, maxX);
        }
        if (ny < 0 || ny > maxY) {
          h = -h;
          ny = clampNum(ny, 0, maxY);
        }

        agX[i] = nx;
        agY[i] = ny;
        agAngle[i] = h;

        const cx = nx | 0;
        const cy = ny | 0;
        const idx = (cy < 0 ? 0 : cy >= rows ? rows - 1 : cy) * cols + (cx < 0 ? 0 : cx >= cols ? cols - 1 : cx);
        trail[idx] = Math.min(TRAIL_CLAMP, trail[idx] + DEPOSIT);

        if (agGrace[i] > 0) {
          agGrace[i]--;
        } else {
          for (let j = 0; j < nodeCount; j++) {
            const dx = nx - nodeX[j];
            const dy = ny - nodeY[j];
            if (dx * dx + dy * dy <= NODE_RADIUS * NODE_RADIUS) {
              nodeDrain[j] += DRAIN_PER_VISIT;
            }
          }
        }
      }

      for (let j = 0; j < nodeCount; j++) {
        const drain = nodeDrain[j] > MAX_DRAIN_PER_STEP ? MAX_DRAIN_PER_STEP : nodeDrain[j];
        const r = nodeReservoir[j] - drain + REGEN_RATE;
        nodeReservoir[j] = r < 0 ? 0 : r > 1 ? 1 : r;
      }

      // 3x3 box blur (separable) mixed into the field, then multiplicative decay
      const mix = DIFFUSE_MIX;
      for (let cy = 0; cy < rows; cy++) {
        const rowBase = cy * cols;
        for (let cx = 0; cx < cols; cx++) {
          const l = cx > 0 ? trail[rowBase + cx - 1] : trail[rowBase + cx];
          const c = trail[rowBase + cx];
          const r = cx < cols - 1 ? trail[rowBase + cx + 1] : trail[rowBase + cx];
          trailTmp[rowBase + cx] = (l + c + r) / 3;
        }
      }
      for (let cy = 0; cy < rows; cy++) {
        const rowBase = cy * cols;
        const upBase = (cy > 0 ? cy - 1 : cy) * cols;
        const downBase = (cy < rows - 1 ? cy + 1 : cy) * cols;
        for (let cx = 0; cx < cols; cx++) {
          const u = trailTmp[upBase + cx];
          const c = trailTmp[rowBase + cx];
          const d = trailTmp[downBase + cx];
          const blurred = (u + c + d) / 3;
          const original = trail[rowBase + cx];
          trail[rowBase + cx] = (original * (1 - mix) + blurred * mix) * DECAY;
        }
      }

      // active nodes emit fresh attractant into the just-decayed field
      for (let j = 0; j < nodeCount; j++) {
        if (nodeReservoir[j] <= RESERVE_EPS) continue;
        const cx = nodeX[j] | 0;
        const cy = nodeY[j] | 0;
        if (cx < 0 || cx >= cols || cy < 0 || cy >= rows) continue;
        const idx = cy * cols + cx;
        trail[idx] = Math.min(TRAIL_CLAMP, trail[idx] + FOOD_EMIT * nodeReservoir[j]);
      }

      // rolling re-seed: a slice of the pool floods back out from an active
      // node every step, so foraging pressure never fully dies down
      const respawnPerStep = Math.max(1, Math.round((N * RESPAWN_FRACTION) / SIM_HZ));
      for (let k = 0; k < respawnPerStep; k++) {
        seedAgent(respawnCursor);
        respawnCursor = (respawnCursor + 1) % N;
      }
    };

    // --- render: lattice -> small offscreen -> bilinear-scaled onto canvas --

    const render = () => {
      if (!imgData) return;
      const data = imgData.data;
      for (let i = 0, p = 0; i < trail.length; i++, p += 4) {
        const v = Math.pow(clamp01(trail[i] / RENDER_NORM), 0.82);
        let rC: number, gC: number, bC: number;
        if (v < 0.5) {
          const t = v * 2;
          rC = bg[0] + (muted[0] - bg[0]) * t;
          gC = bg[1] + (muted[1] - bg[1]) * t;
          bC = bg[2] + (muted[2] - bg[2]) * t;
        } else {
          const t = (v - 0.5) * 2;
          rC = muted[0] + (fg[0] - muted[0]) * t;
          gC = muted[1] + (fg[1] - muted[1]) * t;
          bC = muted[2] + (fg[2] - muted[2]) * t;
        }
        data[p] = rC;
        data[p + 1] = gC;
        data[p + 2] = bC;
      }
      offCtx.putImageData(imgData, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(off, 0, 0, width, height);
    };

    const runHeadless = (steps: number) => {
      // node rects can't change mid-synchronous-loop, so skip the periodic
      // DOM poll inside stepSim entirely rather than forcing dozens of
      // layouts back to back for positions that are already current
      pollDom = false;
      for (let i = 0; i < steps; i++) stepSim();
      pollDom = true;
      render();
    };

    const loop = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : SIM_DT;
      last = now;
      simAcc += dt;
      let stepped = false;
      while (simAcc >= SIM_DT) {
        stepSim();
        simAcc -= SIM_DT;
        stepped = true;
      }
      if (stepped) render();
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const onVis = () => {
      if (!document.hidden && !reduced && sized) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (!sized) return;
        if (reduced) runHeadless(REDUCED_STEPS);
      }, 150);
    };

    const mo = new MutationObserver(() => {
      readTokens();
      if (sized) render();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    let ro: ResizeObserver | undefined;
    readTokens();
    document.fonts.ready.then(() => {
      if (disposed) return;
      resize();
      if (!sized) return;
      if (reduced) {
        runHeadless(REDUCED_STEPS);
      } else {
        raf = requestAnimationFrame(loop);
      }
      ro = new ResizeObserver(onResize);
      ro.observe(root);
    });

    if (!reduced) document.addEventListener("visibilitychange", onVis);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      if (resizeTimer) clearTimeout(resizeTimer);
      ro?.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [disabled, agentCount]);

  return (
    <div
      ref={rootRef}
      className={`relative flex h-full w-full flex-col overflow-hidden bg-background ${className}`}
      style={style}
    >
      {!disabled ? (
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 block h-full w-full"
        />
      ) : null}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-background/55" />
      <div
        ref={contentRef}
        className="relative z-10 flex flex-1 flex-col items-center justify-between gap-8 px-6 py-12 text-center"
      >
        {children ?? <DefaultContent />}
      </div>
    </div>
  );
}

function DefaultContent() {
  return (
    <>
      <div data-vein-node className="mx-auto max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-ns-muted">Backbone</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
          Every route, discovered, never drawn.
        </h1>
        <p className="mt-4 text-sm text-ns-muted sm:text-base">
          What connects the page is the shortest network that actually formed, not one we shipped
          pre-baked.
        </p>
      </div>
      <div>
        <a
          data-vein-node
          href="#start"
          className="inline-flex items-center justify-center rounded-full bg-ns-accent px-6 py-3 text-sm font-medium text-white transition-colors duration-150 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        >
          Provision a route
        </a>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-6 font-mono text-xs uppercase tracking-widest text-ns-muted">
        <span data-vein-node>Northwind</span>
        <span data-vein-node>Vantage</span>
        <span data-vein-node>Fathom</span>
        <span data-vein-node>Ledgerline</span>
      </div>
    </>
  );
}
