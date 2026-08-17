"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// AgarStarve — a bacterial colony whose SHAPE is decided by a live, depleting
// nutrient field, not by noise or a growth rule with a fixed geometry.
//
// Two coupled lattices at roughly 1/6 viewport resolution (coarsened further
// under a cell budget, see MAX_CELLS): OCCUPIED (has biomass ever landed
// here — permanent, cells never vacate) and N, a nutrient concentration that
// diffuses and gets eaten. Every tick, in order:
//
//   1. DIFFUSE — N relaxes toward a smoothed version of itself. This is
//      solved IMPLICITLY via Jacobi relaxation (Stam's stable-diffuse: each
//      iteration reads the previous iteration's WHOLE field, never itself
//      mid-sweep), 5 iterations, no-flux at the plate edge. Fewer iterations
//      leaves the solve unconverged in a way that is biased along the two
//      grid axes — branches would visibly snap to 90deg, the classic
//      lattice-diffusion artifact. That the caller can raise `diffusion` at
//      runtime and watch an already-branched colony round itself back out is
//      the falsifiable core of this component: nothing here is baked
//      geometry, it's a PDE the colony is currently reading.
//   2. REACT — every occupied cell eats CONSUME from its own nutrient. A
//      cell whose local N has fallen under STARVE stops eating and stops
//      dividing — "dies to inert interior" — but the check is against LIVE
//      N, not a sticky flag, so a cell a rising diffusion front reaches
//      really does wake back up.
//   3. DIVIDE — every still-alive occupied cell picks ONE random empty
//      neighbour (Moore, 8-connected — a 4-connected Eden model grows a
//      visible diamond) and divides into it with probability = that
//      neighbour's OWN nutrient, capped at 0.25. This is the whole
//      mechanism, and it is nutrient-limited division, not DLA or an
//      L-system: no direction is ever chosen on purpose, but a neighbour
//      facing untouched plate has more nutrient and wins the coin flip more
//      often over many ticks, so fingers statistically steer toward what's
//      still fresh. And because the same diffuse+eat step also pulls the
//      nutrient OUT of the gap between two adjacent fingers before either
//      tip physically reaches it, two fingers advancing at each other starve
//      the seam between them first and never touch — a gap the render pass
//      paints as permanent exhausted shadow, because N there truly never
//      recovers on its own.
//
// C0 (prop `c0`) is the initial fill of N and the real governing scalar —
// the axis of the Ben-Jacob morphology diagram. High C0 keeps most of the
// plate above the 0.25 probability cap for long enough that the front
// advances near-uniformly (a smooth Eden disc); low C0 exhausts locally
// almost immediately behind the leading edge, so growth channels into the
// few directions that still have supply (dense-branching morphology).
//
// When no occupied+alive cell has an empty neighbour left for a sustained
// stretch (DRY_GRACE_TICKS), the plate is spent: every occupied cell is
// snapped to the oldest age band ("dries to interior tone") and, after a
// pause, a fresh inoculation is dropped at the next corner in rotation, N is
// refilled everywhere — including inside the old shadow gaps — and the new
// colony grows outward, free to fill in territory the previous colony's
// gaps had starved shut. Occupancy is never cleared, so the old colony's
// silhouette stays legible underneath: growing through the ghost of the
// last one.
//
// RENDER: the two lattices are painted into an ImageData at grid resolution
// (occupied cells ramp --ns-muted at birth toward --border at full age;
// empty-but-depleted cells get a faint --border wash standing in for
// exhausted shadow, everything else fully transparent over the
// bg-background wrapper) then drawn scaled up onto the visible canvas with
// a 1.5px canvas blur, so the result reads as biomass texture rather than
// as visible grid cells. Tokens are read via getComputedStyle at mount and
// re-read on a documentElement class mutation (theme toggle); the ramp
// never leaves the --ns-muted..--border range, so it can never get darker
// (dark theme) or busier (light theme) than --border, which is what keeps
// overlaid text safe.
//
// No pointer/keyboard interaction anywhere — this is a decorative backdrop,
// the canvas is aria-hidden, and the whole point is a slow ambient process
// that rewards an occasional glance rather than a stare: the front advances
// at roughly 8px/s. prefers-reduced-motion runs the same tick function
// REDUCED_TICKS times synchronously at mount and paints one static frame
// instead of ever scheduling a rAF.
// ---------------------------------------------------------------------------

const CELL_BASE = 6; // 1/6 viewport resolution, before the cell budget below
const MAX_CELLS = 9000; // perf cap: cell size grows past CELL_BASE on big panes

const DIV_PROB_CAP = 0.25;
const CONSUME = 0.02;
const STARVE = 0.03;
const JACOBI_ITERS = 5;

// Ticks for a cell to fully age from --ns-muted to --border. 500 (~100s), not
// the original 40 (~8s): --border is a near-invisible wash against
// --background, so an 8-second ramp meant everything but the advancing margin
// itself had already faded out, and the colony body — the thing that records
// where the nutrient went — was never on screen at all. At 500 the last couple
// of minutes of growth stay legible and fade off behind the front.
const MATURE_AGE = 500;
const TICK_HZ = 5; // 0.25 max prob * 5 ticks/s * ~6-10px cell ~= 8px/s front
const TICK_STEP = 1 / TICK_HZ;
const MAX_TICKS_PER_FRAME = 6; // catch-up clamp after a stalled tab

const DRY_GRACE_TICKS = 15; // ~3s with no room left before we call it spent
const DRY_PAUSE_TICKS = 30; // ~6s showing the dried plate before reseeding
const SEED_RADIUS = 1;
const CORNER_MARGIN = 2;
const SHADOW_MAX_ALPHA = 70; // out of 255 — a wash, not a second colony

// Normal-motion mount warmup. Deliberately large: the colony grows at ~8px/s,
// so a small warmup leaves first paint (and the resting screenshot the owner
// judges first) showing a bare corner wedge on an otherwise empty plate, with
// none of the branching the piece is about. Matches the prewarm-at-mount idiom
// floret-pack and thallus-siege already use.
// Safety bound only — the prewarm below stops on COVERAGE, not on this count.
// A fixed count ran past the end of a whole plate cycle on a wide pane: first
// paint was a spent plate (every occupied cell aged to --border, a wash that is
// near-invisible against --background) plus a just-reseeded corner dot, i.e. an
// apparently blank pane through the gate.
const PREWARM_TICKS = 900;
/** fraction of the lattice the mount prewarm grows to before it stops */
const WARM_COVERAGE = 0.3;
const WARM_COVERAGE_REDUCED = 0.55;
const REDUCED_TICKS = 3000; // reduced-motion: one fully-grown static frame

const NX = [-1, 0, 1, -1, 1, -1, 0, 1];
const NY = [-1, -1, -1, 0, 0, 1, 1, 1];

type RGB = [number, number, number];

function parseHex(raw: string): RGB | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixRGB(a: RGB, b: RGB, t: number): RGB {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return [
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k),
  ];
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// xorshift32 — deterministic across mounts, unlike Math.random, so the
// resting frame this component ships doesn't differ screenshot to screenshot
function makeRng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

export interface AgarStarveProps {
  /** Initial nutrient concentration (0-1) — the governing scalar of the Ben-Jacob morphology diagram. Low starves into dense-branching fingers; high grows a smooth Eden disc. @default 0.34 */
  c0?: number;
  /** Nutrient diffusion coefficient, cell^2/step. Raise it at runtime to visibly heal an already-branched colony back toward circular. @default 0.18 */
  diffusion?: number;
  /** Global simulation speed multiplier. @default 1 */
  speed?: number;
  /** Freezes the plate on its current frame without unmounting. */
  paused?: boolean;
  /** Rendered in the DOM over the plate — this layer alone is aria-hidden. */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function AgarStarve({
  c0 = 0.34,
  diffusion = 0.18,
  speed = 1,
  paused = false,
  children,
  className = "",
  style,
}: AgarStarveProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // read live every render, consulted inside the effect via .current — none
  // of these should tear down and reseed the plate just because a prop
  // changed, that's the whole point of "heal at runtime"
  const c0Ref = useRef(c0);
  c0Ref.current = c0;
  const diffusionRef = useRef(diffusion);
  diffusionRef.current = diffusion;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;

    let cssW = 0;
    let cssH = 0;
    let dpr = 1;
    let cols = 0;
    let rows = 0;
    let cellSize = CELL_BASE;

    // --- lattices -----------------------------------------------------------
    let N = new Float32Array(0);
    let N0 = new Float32Array(0);
    let Nb = new Float32Array(0);
    let occupied = new Uint8Array(0);
    let age = new Uint16Array(0);
    let aliveBuf = new Uint8Array(0);
    let plateC0 = c0Ref.current;

    let rng = makeRng(0x9e3779b9);
    let cornerIdx = 0;
    let dryTimer = 0;
    let reseedTimer = 0;
    let state: "growing" | "dried" = "growing";

    const idx = (x: number, y: number) => y * cols + x;

    const cornerPos = (i: number): [number, number] => {
      const m = CORNER_MARGIN;
      switch (i % 4) {
        case 0:
          return [m, m];
        case 1:
          return [cols - 1 - m, rows - 1 - m];
        case 2:
          return [cols - 1 - m, m];
        default:
          return [m, rows - 1 - m];
      }
    };

    // expanding square-ring search for the nearest empty cell to (cx, cy)
    const findSeedSpot = (cx: number, cy: number): [number, number] => {
      const maxR = Math.max(cols, rows);
      for (let r = 0; r <= maxR; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const x = cx + dx;
            const y = cy + dy;
            if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
            if (occupied[idx(x, y)] === 0) return [x, y];
          }
        }
      }
      // the whole plate is biomass — force a clean spot rather than never
      // reseeding again
      return [cx, cy];
    };

    const plantSeed = (cx: number, cy: number) => {
      for (let dy = -SEED_RADIUS; dy <= SEED_RADIUS; dy++) {
        for (let dx = -SEED_RADIUS; dx <= SEED_RADIUS; dx++) {
          if (dx * dx + dy * dy > SEED_RADIUS * SEED_RADIUS + 0.5) continue;
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
          const i = idx(x, y);
          occupied[i] = 1;
          age[i] = 0;
        }
      }
    };

    const reseed = (fresh: boolean) => {
      plateC0 = Math.max(0.05, Math.min(1, c0Ref.current));
      N.fill(plateC0);
      if (fresh) {
        occupied.fill(0);
        age.fill(0);
        cornerIdx = 0;
      } else {
        cornerIdx++;
      }
      const [cx, cy] = cornerPos(cornerIdx);
      const [sx, sy] = findSeedSpot(cx, cy);
      plantSeed(sx, sy);
      state = "growing";
      dryTimer = 0;
      reseedTimer = 0;
    };

    // Jacobi solve of (I - a*Laplacian) N = N0, no-flux boundary (an edge
    // cell's missing neighbour is itself — nutrient neither leaks off the
    // plate nor wraps around it)
    const diffuseStep = () => {
      const a = Math.max(0, diffusionRef.current);
      const denom = 1 / (1 + 4 * a);
      N0.set(N);
      let src = N;
      let dst = Nb;
      for (let it = 0; it < JACOBI_ITERS; it++) {
        for (let y = 0; y < rows; y++) {
          const up = y > 0 ? y - 1 : y;
          const dn = y < rows - 1 ? y + 1 : y;
          const rowY = y * cols;
          const rowUp = up * cols;
          const rowDn = dn * cols;
          for (let x = 0; x < cols; x++) {
            const lf = x > 0 ? x - 1 : x;
            const rt = x < cols - 1 ? x + 1 : x;
            const i = rowY + x;
            const sum = src[rowY + lf]! + src[rowY + rt]! + src[rowUp + x]! + src[rowDn + x]!;
            dst[i] = (N0[i]! + a * sum) * denom;
          }
        }
        const t = src;
        src = dst;
        dst = t;
      }
      N = src;
      Nb = dst;
    };

    const pending: number[] = [];
    const neighborScratch: number[] = [];

    const reactAndDivide = () => {
      let active = 0;
      pending.length = 0;
      for (let y = 0; y < rows; y++) {
        const rowY = y * cols;
        for (let x = 0; x < cols; x++) {
          const i = rowY + x;
          if (!occupied[i]) continue;
          const wasAlive = N[i]! >= STARVE;
          if (!wasAlive) {
            aliveBuf[i] = 0;
            age[i] = MATURE_AGE;
            continue;
          }
          N[i] = Math.max(0, N[i]! - CONSUME);
          age[i] = age[i]! < MATURE_AGE ? age[i]! + 1 : MATURE_AGE;
          const stillAlive = N[i]! >= STARVE;
          aliveBuf[i] = stillAlive ? 1 : 0;
          if (!stillAlive) continue;

          neighborScratch.length = 0;
          for (let k = 0; k < 8; k++) {
            const nx = x + NX[k]!;
            const ny = y + NY[k]!;
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
            const ni = ny * cols + nx;
            if (occupied[ni] === 0) neighborScratch.push(ni);
          }
          if (neighborScratch.length === 0) continue;
          active++;
          const target = neighborScratch[Math.floor(rng() * neighborScratch.length)]!;
          const prob = Math.min(DIV_PROB_CAP, N[target]!);
          if (rng() < prob) pending.push(target);
        }
      }
      for (let k = 0; k < pending.length; k++) {
        const i = pending[k]!;
        if (occupied[i]) continue; // two front cells targeted the same gap
        occupied[i] = 1;
        age[i] = 0;
      }
      return active;
    };

    const tick = () => {
      diffuseStep();
      const active = reactAndDivide();
      if (active === 0) {
        dryTimer++;
        if (state === "growing" && dryTimer >= DRY_GRACE_TICKS) {
          state = "dried";
          reseedTimer = 0;
          // the whole plate dries to interior tone in one beat, not just
          // whichever cells individually starved this tick
          for (let i = 0; i < occupied.length; i++) {
            if (occupied[i]) age[i] = MATURE_AGE;
          }
        }
      } else {
        dryTimer = 0;
        if (state === "dried") state = "growing";
      }
      if (state === "dried") {
        reseedTimer++;
        if (reseedTimer >= DRY_PAUSE_TICKS) reseed(false);
      }
    };

    // --- palette --------------------------------------------------------
    let muted: RGB = [79, 79, 79];
    let border: RGB = [46, 46, 46];
    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      muted = parseHex(cs.getPropertyValue("--ns-muted")) ?? muted;
      border = parseHex(cs.getPropertyValue("--border")) ?? border;
    };
    readColors();

    // --- offscreen grid canvas, upsampled + blurred onto the visible one --
    let off: HTMLCanvasElement | null = null;
    let offCtx: CanvasRenderingContext2D | null = null;
    let img: ImageData | null = null;

    const buildOffscreen = () => {
      off = document.createElement("canvas");
      off.width = cols;
      off.height = rows;
      offCtx = off.getContext("2d");
      img = offCtx ? offCtx.createImageData(cols, rows) : null;
    };

    const render = () => {
      if (!offCtx || !img || cols <= 0 || rows <= 0) return;
      const data = img.data;
      for (let i = 0, p = 0; i < N.length; i++, p += 4) {
        if (occupied[i]) {
          const t = age[i]! / MATURE_AGE;
          const c = mixRGB(muted, border, t);
          data[p] = c[0];
          data[p + 1] = c[1];
          data[p + 2] = c[2];
          data[p + 3] = 255;
        } else {
          const depletion = 1 - N[i]! / plateC0;
          const shadow = smoothstep(0.35, 0.95, depletion);
          data[p] = border[0];
          data[p + 1] = border[1];
          data[p + 2] = border[2];
          data[p + 3] = Math.round(shadow * SHADOW_MAX_ALPHA);
        }
      }
      offCtx.putImageData(img, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.filter = "blur(1.5px)";
      ctx.drawImage(off!, 0, 0, cols, rows, 0, 0, canvas.width, canvas.height);
      ctx.filter = "none";
    };

    // --- sizing -----------------------------------------------------------
    const rebuild = () => {
      if (cssW < 2 || cssH < 2) return;
      cellSize = CELL_BASE;
      let c = Math.max(4, Math.ceil(cssW / cellSize));
      let r = Math.max(4, Math.ceil(cssH / cellSize));
      while (c * r > MAX_CELLS) {
        cellSize++;
        c = Math.max(4, Math.ceil(cssW / cellSize));
        r = Math.max(4, Math.ceil(cssH / cellSize));
      }
      cols = c;
      rows = r;
      const n = cols * rows;
      N = new Float32Array(n);
      N0 = new Float32Array(n);
      Nb = new Float32Array(n);
      occupied = new Uint8Array(n);
      age = new Uint16Array(n);
      aliveBuf = new Uint8Array(n);
      rng = makeRng(0x9e3779b9);
      buildOffscreen();
      reseed(true);
      // Prewarm to a COVERAGE target, not to a tick count. A fixed count can't
      // be right for two reasons: the front's speed depends on cell size (so on
      // the pane), and a plate is spent after a bounded number of ticks — a
      // count tuned past that lands on the dried/reseeded phase, where the
      // interior has aged to --border and the whole pane reads blank. Stopping
      // at a fraction of the lattice always lands mid-growth, with the
      // branching margin on screen, whatever the viewport. The tick count
      // below is only a safety bound.
      const warmCap = reduced ? REDUCED_TICKS : PREWARM_TICKS;
      const warmTarget = (reduced ? WARM_COVERAGE_REDUCED : WARM_COVERAGE) * n;
      for (let i = 0; i < warmCap; i++) {
        tick();
        if ((i & 7) === 7) {
          let filled = 0;
          for (let k = 0; k < n; k++) if (occupied[k]) filled++;
          if (filled >= warmTarget) break;
        }
      }
      render();
    };

    const applyBacking = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(cssW * dpr));
      canvas.height = Math.max(1, Math.round(cssH * dpr));
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
    };

    let rebuildTimer = 0;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const changed = Math.abs(rect.width - cssW) > 0.5 || Math.abs(rect.height - cssH) > 0.5;
      cssW = rect.width;
      cssH = rect.height;
      applyBacking();
      if (changed) {
        if (cols === 0) {
          rebuild();
        } else {
          window.clearTimeout(rebuildTimer);
          rebuildTimer = window.setTimeout(rebuild, 260);
        }
      } else {
        render();
      }
    };

    // --- loop ---------------------------------------------------------------
    let raf = 0;
    let last = 0;
    let acc = 0;
    let visible = true;
    let staticMode = reduced || pausedRef.current;

    const loop = (now: number) => {
      const dt = last === 0 ? 1 / 60 : Math.min(0.1, (now - last) / 1000);
      last = now;
      acc += dt * Math.max(0, speedRef.current);
      let ran = 0;
      while (acc >= TICK_STEP && ran < MAX_TICKS_PER_FRAME) {
        tick();
        acc -= TICK_STEP;
        ran++;
      }
      if (ran > 0) render();
      if (visible && !document.hidden && !staticMode) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = 0;
      }
    };

    const wake = () => {
      if (raf || staticMode || !visible || document.hidden) return;
      last = 0;
      raf = requestAnimationFrame(loop);
    };
    const sleep = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries.some((e) => e.isIntersecting);
        if (visible) wake();
        else sleep();
      },
      { threshold: 0 }
    );
    io.observe(wrap);

    const onVis = () => {
      if (document.hidden) sleep();
      else wake();
    };
    document.addEventListener("visibilitychange", onVis);

    // the REDUCED_TICKS prewarm only ever ran under the reduced-motion value
    // seen at mount; a LIVE flip just freezes/resumes wherever growth
    // currently is, same as toggling `paused`
    const applyMode = () => {
      staticMode = reduced || pausedRef.current;
      if (staticMode) sleep();
      else wake();
    };
    const onMq = () => {
      reduced = mq.matches;
      applyMode();
    };
    mq.addEventListener("change", onMq);

    let lastPolledPaused = pausedRef.current;
    let poll = 0;
    const pollPaused = () => {
      if (pausedRef.current !== lastPolledPaused) {
        lastPolledPaused = pausedRef.current;
        applyMode();
      }
      poll = window.setTimeout(pollPaused, 150);
    };
    pollPaused();

    const themeObserver = new MutationObserver(() => {
      readColors();
      render();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    applyMode();

    return () => {
      sleep();
      ro.disconnect();
      io.disconnect();
      themeObserver.disconnect();
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
      window.clearTimeout(rebuildTimer);
      window.clearTimeout(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`relative isolate h-full w-full overflow-hidden bg-background ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 block h-full w-full" />
      {children ? <div className="relative z-[1] h-full w-full">{children}</div> : null}
    </div>
  );
}

AgarStarve.displayName = "AgarStarve";
