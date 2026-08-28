"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// SpallFace — a card-scale background texture panel modelling frost (freeze-
// thaw) weathering of a porous rock/masonry face: water in surface pores
// freezes, expands, and fatigues the near-surface layer until a flake
// (spall) detaches at once, exposing fresh material beneath. Two mechanics
// run independently on the same cell grid:
//
// 1) CONVEYOR — the entire sampled field drifts slowly upward. Rows are
//    stored in a buffer one taller than the visible span; a fractional pixel
//    offset slides everything smoothly, and once that offset crosses a full
//    cell height the oldest (top) row is shifted off — permanently exiting
//    the visible frame — and a brand-new, unweathered row is pushed in at
//    the bottom. This is real material transport (fresh rock entering one edge,
//    weathered/spalled rock permanently leaving the other), not a fixed
//    surface that fills up and stops — the property that keeps the loop
//    genuinely unbounded rather than converging on a static pitted texture
//    (see registry/loud/edm-crater-field, a steady-state field with no net
//    transport — the deliberate differentiator from this component).
//
// 2) SPALL EVENTS — on a random 1.3-2s cadence, one small cell block is
//    picked and enters a 350ms lift -> tip -> fall departure: the flake
//    keeps the patch's OLD (pre-event) colour as it lifts and tips outward,
//    fades while falling off-frame, and the instant it fully detaches (the
//    fall stage begins) the patch underneath resets to a fresh-exposure
//    state and starts glowing. That glow (an exponential decay toward the
//    ambient base tone) is what "brightens immediately, then weathers over
//    the following several seconds" looks like — a real recession cycle of
//    ~0.1-2mm/yr compressed to an illustrative ~40s per patch, documented
//    here rather than literally timed per cell.
//
// Every cell's rendered tone is a single 3-stop lerp across --background ->
// --ns-muted -> --foreground, driven by a base tone plus the exposure glow
// plus a fixed per-cell grain value (a smooth banded function of the row's
// own generation index, so strata form and ride the conveyor coherently
// instead of flickering as uncorrelated per-cell noise). Because both
// the "fresh" and "ambient" ends of that lerp are the SAME two tokens in
// both themes, a fresh patch is automatically brighter in dark theme
// (moving toward --foreground = lighter ink there) and automatically reads
// as a darker, more structured patch in light theme (moving toward
// --foreground = darker ink there) with no theme branch anywhere — the
// inversion the spec calls for falls straight out of the token roles.
// ---------------------------------------------------------------------------

interface Cell {
  grain: number; // fixed per-cell tone jitter, set once at row creation
  sinceExposure: number; // seconds since this cell last freshly spalled
}

interface Flake {
  cell: Cell;
  sizePx: number;
  tipDirX: number; // -1..1, lateral tip direction
  startTime: number; // ms, performance.now() at spawn
  exposed: boolean;
  capturedT: number; // the patch's tone at the instant it detached, carried by the flake
  rowIdx: number;
  colIdx: number;
}

export interface SpallFaceProps {
  /** extra classes merged onto the rendered root element */
  className?: string;
}

type RGB = [number, number, number];

function parseColor(raw: string): RGB | null {
  const s = raw.trim();
  if (s.startsWith("#")) {
    let hex = s.slice(1);
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    if (hex.length < 6) return null;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return Number.isNaN(r + g + b) ? null : [r, g, b];
  }
  const m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function mixRGB(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// -- grid + tone constants --------------------------------------------------
const CELLS_ACROSS = 48; // cell count along the container's SMALLER dimension
const BASE_T = 0.14; // ambient (unweathered) tone position on the 0..1 ramp
const BUMP_AMP = 0.6; // how far a fresh exposure pushes the tone up the ramp
const TAU_EXPOSURE = 9; // s, exponential decay constant of the fresh-glow

// -- initial scatter (t0 must show varied weathering ages, not a blank face) --
const INIT_SCATTER_FRACTION = 0.025;
const INIT_SCATTER_MAX_AGE = 22; // s

// -- conveyor -----------------------------------------------------------
// full nominal 48-cell pass takes ~70s -> constant px/s speed regardless of
// container aspect, since cellPx itself scales off the smaller dimension.
// Fast enough that a band (see bandFor()) visibly advances within 2.5s.
const DRIFT_CELLS_PER_SEC = 48 / 70;

// -- spall events ---------------------------------------------------------
const SPALL_MIN_INTERVAL = 1300; // ms
const SPALL_MAX_INTERVAL = 2000; // ms
const FLAKE_LIFT_END = 120; // ms
const FLAKE_TIP_END = 220; // ms — exposure resets the instant fall begins
const FLAKE_DURATION = 350; // ms
const FLAKE_SIZE_MIN_FRAC = 0.04; // of container's smaller dimension
const FLAKE_SIZE_MAX_FRAC = 0.07;
const MAX_CONCURRENT_FLAKES = 3;
const EDGE_MARGIN_ROWS = 2; // keep new flakes clear of the buffer's top/bottom

const BUCKETS = 16;
const DT_MAX = 1 / 30;

// reduced-motion freeze frame: a flake mid-fall (past lift+tip, visibly
// departed, its patch already brightening) plus older weathering patches
// elsewhere — shows fresh / aging / mid-spall in one still.
const STATIC_FLAKE_ELAPSED = 280; // ms — inside the fall stage
const STATIC_AGES = [1.4, 5.5, 13, 21]; // s — scattered "now weathering" patches

// real rock faces have bedding, not uniform per-cell noise — a row's grain
// is a smooth function of its own generation index (two incommensurate
// sines), so adjacent rows correlate into horizontal strata a few cells
// wide; per-cell jitter on top keeps each band from looking flat. The bands
// are what makes the upward conveyor drift legible: the eye tracks a band,
// not a single random cell.
const BAND_JITTER = 0.02;
function bandFor(seq: number): number {
  return 0.09 * Math.sin(seq * 0.34) + 0.05 * Math.sin(seq * 0.13 + 2.1);
}

function makeRow(cols: number, rand: () => number, seq: number): Cell[] {
  const band = bandFor(seq);
  return Array.from({ length: cols }, () => ({
    grain: band + (rand() * 2 - 1) * BAND_JITTER,
    sinceExposure: 9999,
  }));
}

export function SpallFace({ className = "" }: SpallFaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;
    const rand = mulberry32(0x5fa11ace);

    // -- token-derived ink, re-derived on theme class change -----------
    let bg: RGB = [10, 10, 10];
    let muted: RGB = [143, 143, 143];
    let fg: RGB = [237, 237, 237];
    const derive = () => {
      const cs = getComputedStyle(document.documentElement);
      bg = parseColor(cs.getPropertyValue("--background")) ?? bg;
      muted = parseColor(cs.getPropertyValue("--ns-muted")) ?? muted;
      fg = parseColor(cs.getPropertyValue("--foreground")) ?? fg;
    };
    derive();

    const colorAt = (t: number): RGB => {
      const c = Math.min(1, Math.max(0, t));
      return c < 0.5 ? mixRGB(bg, muted, c * 2) : mixRGB(muted, fg, (c - 0.5) * 2);
    };

    let w = 0;
    let h = 0;
    let dpr = 1;
    let cellPx = 8;
    let cols = 0;
    let visibleRows = 0;
    let rowsBuf: Cell[][] = []; // length visibleRows + 1, index 0 = incoming buffer row
    let rowSeq = 0; // generation counter feeding bandFor(), advances one per new row
    let conveyorPix = 0;
    let flakes: Flake[] = [];
    let nextSpallAt = 0;
    let raf = 0;
    let last = 0;
    let visible = true;

    const buildGrid = () => {
      const minDim = Math.max(1, Math.min(w, h));
      cellPx = Math.max(3, minDim / CELLS_ACROSS);
      cols = Math.max(1, Math.ceil(w / cellPx));
      visibleRows = Math.max(1, Math.ceil(h / cellPx));
      rowSeq = 0;
      rowsBuf = Array.from({ length: visibleRows + 1 }, () => makeRow(cols, rand, rowSeq++));
      // seed varied weathering ages so t0 isn't a blank, uniformly fresh face
      for (const row of rowsBuf) {
        for (const cell of row) {
          if (rand() < INIT_SCATTER_FRACTION) cell.sinceExposure = rand() * INIT_SCATTER_MAX_AGE;
        }
      }
      conveyorPix = 0;
      flakes = [];
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildGrid();
    };

    const spawnFlake = (now: number) => {
      if (flakes.length >= MAX_CONCURRENT_FLAKES) return;
      const lastIdx = rowsBuf.length - 1;
      const rowIdx = EDGE_MARGIN_ROWS + Math.floor(rand() * Math.max(1, lastIdx - EDGE_MARGIN_ROWS * 2));
      const colIdx = Math.floor(rand() * cols);
      const row = rowsBuf[rowIdx];
      const cell = row?.[colIdx];
      if (!cell) return;
      const minDim = Math.min(w, h);
      const sizePx = minDim * (FLAKE_SIZE_MIN_FRAC + rand() * (FLAKE_SIZE_MAX_FRAC - FLAKE_SIZE_MIN_FRAC));
      const bump = Math.exp(-cell.sinceExposure / TAU_EXPOSURE) * BUMP_AMP;
      const capturedT = Math.min(1, Math.max(0, BASE_T + bump + cell.grain));
      flakes.push({
        cell,
        sizePx,
        tipDirX: rand() < 0.5 ? -1 : 1,
        startTime: now,
        exposed: false,
        capturedT,
        rowIdx,
        colIdx,
      });
    };

    const exposePatch = (rowIdx: number, colIdx: number, radiusCells: number) => {
      for (let ry = rowIdx - radiusCells; ry <= rowIdx + radiusCells; ry++) {
        const row = rowsBuf[ry];
        if (!row) continue;
        for (let rx = colIdx - radiusCells; rx <= colIdx + radiusCells; rx++) {
          const cell = row[rx];
          if (cell) cell.sinceExposure = 0;
        }
      }
    };

    const drawFace = (now: number, staticFlakeElapsed: number | null) => {
      ctx.clearRect(0, 0, w, h);
      const frac = conveyorPix;

      const buckets: { x: number; y: number }[][] = Array.from({ length: BUCKETS }, () => []);
      for (let i = 0; i < rowsBuf.length; i++) {
        const row = rowsBuf[i];
        if (!row) continue;
        const y = i * cellPx - frac;
        if (y > h || y + cellPx < 0) continue;
        for (let c = 0; c < row.length; c++) {
          const cell = row[c];
          if (!cell) continue;
          const bump = Math.exp(-cell.sinceExposure / TAU_EXPOSURE) * BUMP_AMP;
          const t = Math.min(1, Math.max(0, BASE_T + bump + cell.grain));
          const bucket = Math.round(t * (BUCKETS - 1));
          buckets[bucket]?.push({ x: c * cellPx, y });
        }
      }
      for (let b = 0; b < BUCKETS; b++) {
        const rects = buckets[b];
        if (!rects || rects.length === 0) continue;
        const [r, g, bl] = colorAt(b / (BUCKETS - 1));
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${bl | 0})`;
        ctx.beginPath();
        for (const rect of rects) ctx.rect(rect.x, rect.y, cellPx + 0.5, cellPx + 0.5);
        ctx.fill();
      }

      const drawFlake = (fl: Flake, elapsed: number) => {
        let lift: number;
        let rotDeg: number;
        let alpha = 1;
        if (elapsed <= FLAKE_LIFT_END) {
          const lt = elapsed / FLAKE_LIFT_END;
          lift = lt * fl.sizePx * 0.35;
          rotDeg = lt * 8;
        } else if (elapsed <= FLAKE_TIP_END) {
          const tt = (elapsed - FLAKE_LIFT_END) / (FLAKE_TIP_END - FLAKE_LIFT_END);
          lift = fl.sizePx * 0.35 + tt * fl.sizePx * 0.15;
          rotDeg = 8 + tt * 30;
        } else {
          const ft = Math.min(1, (elapsed - FLAKE_TIP_END) / (FLAKE_DURATION - FLAKE_TIP_END));
          lift = fl.sizePx * 0.5 + ft * ft * fl.sizePx * 2.4;
          rotDeg = 38 + ft * 55;
          alpha = 1 - ft;
        }
        const [r, g, bl] = colorAt(fl.capturedT);
        // rides the same conveyor coordinates as the grid, not a frozen
        // spawn-time pixel — a row shift mid-flight must not desync the
        // flake from the patch it is exposing.
        const x = (fl.colIdx + 0.5) * cellPx;
        const y = (fl.rowIdx + 0.5) * cellPx - conveyorPix;
        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.translate(x + fl.tipDirX * lift * 0.6, y - lift);
        ctx.rotate((rotDeg * fl.tipDirX * Math.PI) / 180);
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${bl | 0})`;
        ctx.fillRect(-fl.sizePx / 2, -fl.sizePx / 2, fl.sizePx, fl.sizePx);
        ctx.restore();
      };

      if (staticFlakeElapsed != null && flakes[0]) {
        drawFlake(flakes[0], staticFlakeElapsed);
      } else {
        for (const fl of flakes) drawFlake(fl, now - fl.startTime);
      }
      ctx.globalAlpha = 1;
    };

    const step = (dt: number, now: number) => {
      for (const row of rowsBuf) {
        for (const cell of row) cell.sinceExposure += dt;
      }

      // upward drift: bottom buffer row is the incoming fresh rock,
      // top row is what permanently exits the visible frame.
      conveyorPix += DRIFT_CELLS_PER_SEC * cellPx * dt;
      while (conveyorPix >= cellPx) {
        conveyorPix -= cellPx;
        rowsBuf.shift();
        rowsBuf.push(makeRow(cols, rand, rowSeq++));
        // every row index shifts down by one — an in-flight flake must
        // track the same cell it was spawned over, not drift a row stale.
        for (const fl of flakes) fl.rowIdx -= 1;
      }
      flakes = flakes.filter((fl) => fl.rowIdx >= 0);

      if (now >= nextSpallAt) {
        spawnFlake(now);
        nextSpallAt = now + SPALL_MIN_INTERVAL + rand() * (SPALL_MAX_INTERVAL - SPALL_MIN_INTERVAL);
      }

      for (const fl of flakes) {
        const elapsed = now - fl.startTime;
        if (!fl.exposed && elapsed >= FLAKE_TIP_END) {
          const radiusCells = Math.max(1, Math.round(fl.sizePx / (2 * cellPx)));
          exposePatch(fl.rowIdx, fl.colIdx, radiusCells);
          fl.exposed = true;
        }
      }
      flakes = flakes.filter((fl) => now - fl.startTime < FLAKE_DURATION);
    };

    const loop = (now: number) => {
      const dt = last ? Math.min(DT_MAX, (now - last) / 1000) : 1 / 60;
      last = now;
      step(dt, now);
      drawFace(now, null);
      raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (raf === 0 && !reduced && visible) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const drawStatic = () => {
      const rowIdx = Math.max(EDGE_MARGIN_ROWS, Math.floor(rowsBuf.length / 2));
      const colIdx = Math.floor(cols / 2);
      const row = rowsBuf[rowIdx];
      const cell = row?.[colIdx];
      let staticFlake: Flake | null = null;
      if (cell) {
        // the flake carries the patch's OLD (ambient) tone as it departs...
        const capturedT = Math.min(1, Math.max(0, BASE_T + cell.grain));
        cell.sinceExposure = 0.15; // ...while the patch underneath is already exposed, brightening
        const minDim = Math.min(w, h);
        staticFlake = {
          cell,
          sizePx: minDim * (FLAKE_SIZE_MIN_FRAC + FLAKE_SIZE_MAX_FRAC) * 0.5,
          tipDirX: 1,
          startTime: 0,
          exposed: true,
          capturedT,
          rowIdx,
          colIdx,
        };
      }
      // older, now-weathering patches scattered elsewhere on the face
      let ai = 0;
      for (const r of rowsBuf) {
        for (const c of r) {
          if (c === cell) continue;
          if (rand() < 0.006 && ai < STATIC_AGES.length) {
            c.sinceExposure = STATIC_AGES[ai] ?? c.sinceExposure;
            ai++;
          }
        }
      }
      flakes = staticFlake ? [staticFlake] : [];
      drawFace(0, STATIC_FLAKE_ELAPSED);
    };

    resize();
    if (reduced) {
      drawStatic();
    } else {
      nextSpallAt = performance.now() + SPALL_MIN_INTERVAL + rand() * (SPALL_MAX_INTERVAL - SPALL_MIN_INTERVAL);
      raf = requestAnimationFrame(loop);
    }

    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) drawStatic();
    });
    ro.observe(canvas);

    const mo = new MutationObserver(() => {
      derive();
      // if the loop is currently paused (tab hidden / off-screen) nothing
      // will repaint on its own — force one frame so a theme flip never
      // leaves a stale-theme frame sitting until the loop wakes.
      if (reduced) drawStatic();
      else if (raf === 0) drawFace(performance.now(), null);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const onReducedChange = () => {
      reduced = mq.matches;
      if (reduced) {
        cancelAnimationFrame(raf);
        raf = 0;
        buildGrid();
        drawStatic();
      } else {
        wake();
      }
    };
    mq.addEventListener("change", onReducedChange);

    const onVisibility = () => {
      visible = document.visibilityState === "visible";
      if (visible) wake();
      else {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        visible = entry.isIntersecting && document.visibilityState === "visible";
        if (visible) wake();
        else {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      { threshold: 0.01 }
    );
    io.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
      mq.removeEventListener("change", onReducedChange);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`block h-full w-full ${className}`}
    />
  );
}

SpallFace.displayName = "SpallFace";

export default SpallFace;
