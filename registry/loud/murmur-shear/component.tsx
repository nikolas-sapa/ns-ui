"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// MurmurShear — a dusk murmuration hero. ~1500 starlings run true separation /
// alignment / cohesion over their 7 NEAREST NEIGHBOURS BY COUNT (topological,
// Ballerini/STARFLAG — not a metric radius), on a fixed 30Hz physics tick
// decoupled from display refresh via an accumulator, neighbours resolved
// through a spatial hash sized to the container so a bird almost always
// resolves in its own cell and only expands outward (up to 5 rings) when
// locally sparse. Separation 1.5 vs cohesion 1.0 keeps the flock from
// clump-collapsing.
//
// On a slow clock (H = passesPerMinute, the governing scalar) an invisible
// falcon flies one straight chord through the field. Birds it directly
// crosses get an immediate escape turn + speed kick. That escape state
// (alarm 0..1, signed turn direction) is NOT broadcast flock-wide — each bird
// samples its own 7 neighbours' alarm only once every 90ms (a per-bird
// latency accumulator) and adopts gain 2.2 x the neighbour average if that
// exceeds its own decaying value. The 90ms hop is what makes the escape read
// as a travelling band shearing across the flock rather than a synchronized
// flinch: hop distance / 90ms is faster than the flock's own cruise speed.
// H=0 disables the falcon entirely — alarm can never be seeded, so the wave
// mechanism structurally cannot fire; what's left is plain murmuration.
//
// Render: solid --background fill, then a low-res leaky-integrator density
// grid (raw bird count + a heavier alarm-weighted term, so a real spatial
// knot forms where escaping birds bank together) quantized to five alpha
// stops of --foreground and upscaled via a tiny offscreen canvas, then every
// bird as a 2-3px velocity-aligned streak (agitated birds drawn slightly
// bolder). All ink read via getComputedStyle at mount and re-read on a
// documentElement class MutationObserver.
//
// prefers-reduced-motion: no rAF ever starts. A silent physics-only warmup
// (with one falcon pass forced in, unless H=0) runs once, then a short
// low-alpha accumulation window is actually drawn without clearing between
// steps to build one precomputed long-exposure still, sealed with a final
// density wash. This is a genuinely different artifact from the live loop,
// not the live loop merely slowed down.
//
// Purely decorative: aria-hidden, pointer-events-none, no controls, no
// pointer handling at all — the flock is self-driving on its own clock.
// ---------------------------------------------------------------------------

export interface MurmurShearProps {
  /** number of starlings simulated; clamped to [50, 4000] */
  birdCount?: number;
  /** governing scalar H — invisible falcon passes per minute. 0 = pure murmuration, no waves. */
  passesPerMinute?: number;
  /** content overlaid on the field (caller supplies its own bg-background/70 scrim) */
  children?: React.ReactNode;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const K_NEIGHBORS = 7;
const MAX_RING = 5;
const SEP_WEIGHT = 1.5;
const ALIGN_WEIGHT = 1.0;
const COH_WEIGHT = 1.0;
const SEP_SCALE = 5500;
const ALIGN_SCALE = 1.8;
const COH_SCALE = 9;
const MAX_STEER_ACCEL = 260; // px/s^2, caps sep+align+coh before escape/wall are added
const MAX_TOTAL_ACCEL = 1500; // px/s^2, final safety clamp
const CRUISE_MAX_SPEED = 150; // px/s
const MIN_SPEED = 55; // px/s
const ESCAPE_SPEED_BONUS = 75; // px/s, agitated birds may cruise faster
const WALL_MARGIN_FRAC = 0.09;
const WALL_ACCEL = 340;
const JITTER_ACCEL = 16;

const ESCAPE_GAIN = 2.2; // wave response gain applied once per 90ms hop
const PROP_LATENCY = 0.09; // s — neighbour-to-neighbour latency
const ALARM_DECAY_TAU = 1.3; // s
const ESCAPE_TURN_ACCEL = 900; // px/s^2 lateral accel at alarm = 1

const FALCON_STRIKE_R = 68; // px
const FALCON_SPEED = 1050; // px/s
const FALCON_MARGIN = 90; // px beyond bounds for entry/exit
const FALCON_KICK = 480; // px/s instantaneous radial speed kick on direct hit

const DENSITY_CELL = 22; // px, css space
const DENSITY_DECAY = 0.86;
const DENSITY_ALARM_WEIGHT = 3.2;
const STOP_ALPHAS = [0, 0.1, 0.2, 0.34, 0.52]; // five stops toward --foreground

const STREAK_LEN = 2.8; // px

const FIXED_DT = 1 / 30; // fixed 30Hz physics tick
const MAX_STEPS_PER_FRAME = 4;

function parseHex(raw: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function MurmurShear({
  birdCount = 1500,
  passesPerMinute = 5,
  children,
  className = "",
}: MurmurShearProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const N = Math.max(50, Math.min(4000, Math.round(birdCount)));
  const H = Math.max(0, passesPerMinute);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;
    let running = false;
    let last = 0;
    let physAccum = 0;
    let seeded = false;

    // ---- ink, read from tokens; re-read on theme flip ---------------------
    let fgStyle = "#888";
    let bgStyle = "#0a0a0a";
    let fgRgb: [number, number, number] = [136, 136, 136];
    const readInk = () => {
      const cs = getComputedStyle(document.documentElement);
      const fg = cs.getPropertyValue("--foreground").trim();
      const bg = cs.getPropertyValue("--background").trim();
      fgStyle = fg || "#888";
      bgStyle = bg || "#0a0a0a";
      fgRgb = parseHex(fg) ?? [136, 136, 136];
    };
    readInk();

    // ---- bird state: typed arrays, mutated in place ------------------------
    const px = new Float32Array(N);
    const py = new Float32Array(N);
    const vx = new Float32Array(N);
    const vy = new Float32Array(N);
    const ax = new Float32Array(N);
    const ay = new Float32Array(N);
    const alarm = new Float32Array(N);
    const turnSign = new Float32Array(N);
    const propAccum = new Float32Array(N);
    const prevAlarm = new Float32Array(N);
    const prevTurnSign = new Float32Array(N);

    // ---- spatial hash (neighbour search), rebuilt per resize --------------
    let hashCell = 40;
    let gridCols = 1;
    let gridRows = 1;
    let buckets: number[][] = [];
    const nnIdx = new Int32Array(K_NEIGHBORS);
    const nnDist2 = new Float32Array(K_NEIGHBORS);
    let cand: number[] = [];

    const rebuildGridDims = () => {
      hashCell = Math.max(20, Math.min(140, Math.sqrt((10 * w * h) / N) || 40));
      gridCols = Math.max(1, Math.ceil(w / hashCell));
      gridRows = Math.max(1, Math.ceil(h / hashCell));
      buckets = new Array(gridCols * gridRows);
      for (let i = 0; i < buckets.length; i++) buckets[i] = [];
    };

    const rebuildBuckets = () => {
      for (let i = 0; i < buckets.length; i++) buckets[i].length = 0;
      for (let i = 0; i < N; i++) {
        let cx = Math.floor(px[i] / hashCell);
        let cy = Math.floor(py[i] / hashCell);
        if (cx < 0) cx = 0;
        else if (cx >= gridCols) cx = gridCols - 1;
        if (cy < 0) cy = 0;
        else if (cy >= gridRows) cy = gridRows - 1;
        buckets[cy * gridCols + cx].push(i);
      }
    };

    // finds up to K_NEIGHBORS nearest (topological — nearest by count, not a
    // metric cutoff), expanding the search ring until enough candidates are
    // seen. Returns the count found (0..K_NEIGHBORS).
    const findNeighbors = (i: number): number => {
      const xi = px[i];
      const yi = py[i];
      let cx = Math.floor(xi / hashCell);
      let cy = Math.floor(yi / hashCell);
      if (cx < 0) cx = 0;
      else if (cx >= gridCols) cx = gridCols - 1;
      if (cy < 0) cy = 0;
      else if (cy >= gridRows) cy = gridRows - 1;

      let ring = 0;
      cand.length = 0;
      for (;;) {
        cand.length = 0;
        const x0 = Math.max(0, cx - ring);
        const x1 = Math.min(gridCols - 1, cx + ring);
        const y0 = Math.max(0, cy - ring);
        const y1 = Math.min(gridRows - 1, cy + ring);
        for (let gy = y0; gy <= y1; gy++) {
          const rowBase = gy * gridCols;
          for (let gx = x0; gx <= x1; gx++) {
            const bucket = buckets[rowBase + gx];
            for (let k = 0; k < bucket.length; k++) {
              const j = bucket[k];
              if (j !== i) cand.push(j);
            }
          }
        }
        const fullyCovered = x0 === 0 && y0 === 0 && x1 === gridCols - 1 && y1 === gridRows - 1;
        if (cand.length >= K_NEIGHBORS || ring >= MAX_RING || fullyCovered) break;
        ring++;
      }

      let count = 0;
      for (let c = 0; c < cand.length; c++) {
        const j = cand[c];
        const dx = px[j] - xi;
        const dy = py[j] - yi;
        const d2 = dx * dx + dy * dy;
        if (count < K_NEIGHBORS) {
          // insertion into the sorted top-k
          let p = count;
          while (p > 0 && nnDist2[p - 1] > d2) {
            nnDist2[p] = nnDist2[p - 1];
            nnIdx[p] = nnIdx[p - 1];
            p--;
          }
          nnDist2[p] = d2;
          nnIdx[p] = j;
          count++;
        } else if (d2 < nnDist2[K_NEIGHBORS - 1]) {
          let p = K_NEIGHBORS - 1;
          while (p > 0 && nnDist2[p - 1] > d2) {
            nnDist2[p] = nnDist2[p - 1];
            nnIdx[p] = nnIdx[p - 1];
            p--;
          }
          nnDist2[p] = d2;
          nnIdx[p] = j;
        }
      }
      return count;
    };

    // ---- density field: low-res leaky integrator, upscaled via canvas -----
    let densCols = 1;
    let densRows = 1;
    let density = new Float32Array(1);
    let alarmDensity = new Float32Array(1);
    let densThresh: [number, number, number, number] = [1, 2, 3, 4];
    const washCanvas = document.createElement("canvas");
    const washCtx = washCanvas.getContext("2d");
    let washImg: ImageData | null = null;

    const rebuildDensityGrid = () => {
      densCols = Math.max(1, Math.ceil(w / DENSITY_CELL));
      densRows = Math.max(1, Math.ceil(h / DENSITY_CELL));
      density = new Float32Array(densCols * densRows);
      alarmDensity = new Float32Array(densCols * densRows);
      // density[] is a leaky integrator (*= DENSITY_DECAY, += 1/bird/tick), so
      // its steady-state value is the instantaneous per-tick count scaled by
      // the integrator's DC gain 1/(1-decay) — thresholds must be calibrated
      // against THAT, not the raw instantaneous average, or nearly every
      // occupied cell saturates past the top stop within ~1s and the whole
      // flock reads as one uniform blob instead of graded knots.
      const instBaseline = N / (densCols * densRows);
      const steadyBaseline = instBaseline / (1 - DENSITY_DECAY);
      densThresh = [
        steadyBaseline * 0.6,
        steadyBaseline * 1.3,
        steadyBaseline * 2.2,
        steadyBaseline * 3.4,
      ];
      washCanvas.width = densCols;
      washCanvas.height = densRows;
      washImg = washCtx ? washCtx.createImageData(densCols, densRows) : null;
    };

    // ---- falcon: one straight chord per pass, invisible, never drawn ------
    let falconActive = false;
    let falconT = 0;
    let falconDur = 0;
    let fx0 = 0;
    let fy0 = 0;
    let fx1 = 0;
    let fy1 = 0;
    let fpx = 0;
    let fpy = 0;
    let nextPassIn = H > 0 ? 3 : Infinity;

    const scheduleNextPass = () => {
      if (H <= 0) {
        nextPassIn = Infinity;
        return;
      }
      const base = 60 / H;
      nextPassIn = base * (0.7 + Math.random() * 0.6);
    };

    const startFalconPass = () => {
      const angle = ((Math.random() * 40 - 20) * Math.PI) / 180;
      const reverse = Math.random() < 0.5;
      const yMid = h * (0.28 + Math.random() * 0.44);
      const span = w + FALCON_MARGIN * 2;
      const dy = Math.tan(angle) * span;
      if (!reverse) {
        fx0 = -FALCON_MARGIN;
        fy0 = yMid - dy / 2;
        fx1 = w + FALCON_MARGIN;
        fy1 = yMid + dy / 2;
      } else {
        fx0 = w + FALCON_MARGIN;
        fy0 = yMid - dy / 2;
        fx1 = -FALCON_MARGIN;
        fy1 = yMid + dy / 2;
      }
      const dist = Math.hypot(fx1 - fx0, fy1 - fy0);
      falconDur = Math.max(0.1, dist / FALCON_SPEED);
      falconT = 0;
      fpx = fx0;
      fpy = fy0;
      falconActive = true;
    };

    // closest point on segment [ax,ay]-[bx,by] to point [px0,py0]
    const closestOnSegment = (ax0: number, ay0: number, bx0: number, by0: number, px0: number, py0: number) => {
      const sx = bx0 - ax0;
      const sy = by0 - ay0;
      const len2 = sx * sx + sy * sy;
      let t = len2 > 1e-6 ? ((px0 - ax0) * sx + (py0 - ay0) * sy) / len2 : 0;
      if (t < 0) t = 0;
      else if (t > 1) t = 1;
      return [ax0 + sx * t, ay0 + sy * t] as const;
    };

    // ---- one fixed-timestep physics tick -----------------------------------
    const stepPhysics = (dt: number, nowS: number) => {
      prevAlarm.set(alarm);
      prevTurnSign.set(turnSign);

      // falcon: advance / trigger
      if (H > 0) {
        if (!falconActive) {
          nextPassIn -= dt;
          if (nextPassIn <= 0) startFalconPass();
        }
        if (falconActive) {
          const prevX = fpx;
          const prevY = fpy;
          falconT += dt / falconDur;
          const t = Math.min(1, falconT);
          const curX = fx0 + (fx1 - fx0) * t;
          const curY = fy0 + (fy1 - fy0) * t;
          const fdx = curX - prevX;
          const fdy = curY - prevY;
          for (let i = 0; i < N; i++) {
            const [cxp, cyp] = closestOnSegment(prevX, prevY, curX, curY, px[i], py[i]);
            const ddx = px[i] - cxp;
            const ddy = py[i] - cyp;
            const dist = Math.sqrt(ddx * ddx + ddy * ddy);
            if (dist < FALCON_STRIKE_R) {
              const inv = dist > 1e-4 ? 1 / dist : 0;
              const awayX = ddx * inv;
              const awayY = ddy * inv;
              const kick = FALCON_KICK * (1 - dist / FALCON_STRIKE_R);
              vx[i] += awayX * kick;
              vy[i] += awayY * kick;
              alarm[i] = 1;
              const cross = fdx * awayY - fdy * awayX;
              turnSign[i] = cross >= 0 ? 1 : -1;
            }
          }
          fpx = curX;
          fpy = curY;
          if (falconT >= 1) {
            falconActive = false;
            scheduleNextPass();
          }
        }
      }

      rebuildBuckets();

      const wallMargin = Math.min(w, h) * WALL_MARGIN_FRAC;

      // Pass A: neighbours, boid forces, alarm propagation, escape steering
      for (let i = 0; i < N; i++) {
        const count = findNeighbors(i);
        let accX = 0;
        let accY = 0;

        if (count > 0) {
          let sepX = 0;
          let sepY = 0;
          let sumVx = 0;
          let sumVy = 0;
          let sumPx = 0;
          let sumPy = 0;
          for (let k = 0; k < count; k++) {
            const j = nnIdx[k];
            const dx = px[i] - px[j];
            const dy = py[i] - py[j];
            let d2 = dx * dx + dy * dy;
            if (d2 < 1e-4) d2 = 1e-4;
            const invd = 1 / d2;
            sepX += dx * invd;
            sepY += dy * invd;
            sumVx += vx[j];
            sumVy += vy[j];
            sumPx += px[j];
            sumPy += py[j];
          }
          const inv = 1 / count;
          accX += sepX * inv * SEP_SCALE * SEP_WEIGHT;
          accY += sepY * inv * SEP_SCALE * SEP_WEIGHT;
          accX += (sumVx * inv - vx[i]) * ALIGN_SCALE * ALIGN_WEIGHT;
          accY += (sumVy * inv - vy[i]) * ALIGN_SCALE * ALIGN_WEIGHT;
          accX += (sumPx * inv - px[i]) * COH_SCALE * COH_WEIGHT;
          accY += (sumPy * inv - py[i]) * COH_SCALE * COH_WEIGHT;
        }

        // clamp the flocking contribution before escape/wall are layered on
        const flockMag = Math.hypot(accX, accY);
        if (flockMag > MAX_STEER_ACCEL) {
          const s = MAX_STEER_ACCEL / flockMag;
          accX *= s;
          accY *= s;
        }

        // soft walls
        if (px[i] < wallMargin) accX += WALL_ACCEL * (wallMargin - px[i]) / wallMargin;
        else if (px[i] > w - wallMargin) accX -= (WALL_ACCEL * (wallMargin - (w - px[i]))) / wallMargin;
        if (py[i] < wallMargin) accY += WALL_ACCEL * (wallMargin - py[i]) / wallMargin;
        else if (py[i] > h - wallMargin) accY -= (WALL_ACCEL * (wallMargin - (h - py[i]))) / wallMargin;

        // ambient jitter, organic texture
        accX += (Math.random() - 0.5) * JITTER_ACCEL;
        accY += (Math.random() - 0.5) * JITTER_ACCEL;

        // alarm: decay, then at most once per 90ms sample the (pre-frame)
        // neighbour snapshot and adopt gain x average if it exceeds decay
        alarm[i] *= Math.exp(-dt / ALARM_DECAY_TAU);
        propAccum[i] += dt;
        if (propAccum[i] >= PROP_LATENCY) {
          propAccum[i] -= PROP_LATENCY;
          if (propAccum[i] > PROP_LATENCY) propAccum[i] = PROP_LATENCY;
          if (count > 0) {
            let sumA = 0;
            let sumSigned = 0;
            for (let k = 0; k < count; k++) {
              const j = nnIdx[k];
              sumA += prevAlarm[j];
              sumSigned += prevAlarm[j] * prevTurnSign[j];
            }
            const avgA = sumA / count;
            const proposed = Math.min(1, avgA * ESCAPE_GAIN);
            if (proposed > alarm[i]) {
              alarm[i] = proposed;
              turnSign[i] = sumSigned >= 0 ? 1 : -1;
            }
          }
        }

        // escape steering: lateral accel perpendicular to heading, signed
        const speedNow = Math.hypot(vx[i], vy[i]) || 1;
        const perpX = -vy[i] / speedNow;
        const perpY = vx[i] / speedNow;
        accX += perpX * turnSign[i] * alarm[i] * ESCAPE_TURN_ACCEL;
        accY += perpY * turnSign[i] * alarm[i] * ESCAPE_TURN_ACCEL;

        const totalMag = Math.hypot(accX, accY);
        if (totalMag > MAX_TOTAL_ACCEL) {
          const s = MAX_TOTAL_ACCEL / totalMag;
          accX *= s;
          accY *= s;
        }
        ax[i] = accX;
        ay[i] = accY;
      }

      // decay density grid once per tick
      for (let c = 0; c < density.length; c++) {
        density[c] *= DENSITY_DECAY;
        alarmDensity[c] *= DENSITY_DECAY;
      }

      // Pass B: integrate, clamp speed, accumulate density
      for (let i = 0; i < N; i++) {
        vx[i] += ax[i] * dt;
        vy[i] += ay[i] * dt;
        const maxSpeed = CRUISE_MAX_SPEED + alarm[i] * ESCAPE_SPEED_BONUS;
        const sp = Math.hypot(vx[i], vy[i]);
        if (sp > maxSpeed) {
          const s = maxSpeed / (sp || 1);
          vx[i] *= s;
          vy[i] *= s;
        } else if (sp < MIN_SPEED) {
          const s = MIN_SPEED / (sp || 1);
          vx[i] *= s;
          vy[i] *= s;
        }
        let nx = px[i] + vx[i] * dt;
        let ny = py[i] + vy[i] * dt;
        // hard clamp at the true canvas bound (soft walls should already have
        // turned birds back well before this); zero the outward component so
        // a fast-escaping bird can't pin here and re-stamp one density cell
        // every tick, which would paint a bright rim line at the edge
        if (nx < 0) {
          nx = 0;
          if (vx[i] < 0) vx[i] = 0;
        } else if (nx > w) {
          nx = w;
          if (vx[i] > 0) vx[i] = 0;
        }
        if (ny < 0) {
          ny = 0;
          if (vy[i] < 0) vy[i] = 0;
        } else if (ny > h) {
          ny = h;
          if (vy[i] > 0) vy[i] = 0;
        }
        px[i] = nx;
        py[i] = ny;

        let cx = Math.floor(nx / DENSITY_CELL);
        let cy = Math.floor(ny / DENSITY_CELL);
        if (cx < 0) cx = 0;
        else if (cx >= densCols) cx = densCols - 1;
        if (cy < 0) cy = 0;
        else if (cy >= densRows) cy = densRows - 1;
        const idx = cy * densCols + cx;
        density[idx] += 1;
        alarmDensity[idx] += alarm[i];
      }
      void nowS;
    };

    // ---- rendering ----------------------------------------------------------
    const clearBg = () => {
      ctx.fillStyle = bgStyle;
      ctx.fillRect(0, 0, w, h);
    };

    const drawWash = () => {
      if (!washCtx || !washImg) return;
      const buf = washImg.data;
      const [r, g, b] = fgRgb;
      for (let c = 0; c < density.length; c++) {
        const val = density[c] + alarmDensity[c] * DENSITY_ALARM_WEIGHT;
        let stop = 0;
        if (val >= densThresh[3]) stop = 4;
        else if (val >= densThresh[2]) stop = 3;
        else if (val >= densThresh[1]) stop = 2;
        else if (val >= densThresh[0]) stop = 1;
        const o = c * 4;
        buf[o] = r;
        buf[o + 1] = g;
        buf[o + 2] = b;
        buf[o + 3] = Math.round(STOP_ALPHAS[stop] * 255);
      }
      washCtx.putImageData(washImg, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(washCanvas, 0, 0, densCols, densRows, 0, 0, w, h);
    };

    const drawStreaks = (calmAlpha: number, agitatedAlphaBase: number) => {
      ctx.strokeStyle = fgStyle;
      ctx.lineWidth = 1.3;
      ctx.globalAlpha = calmAlpha;
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        if (alarm[i] >= 0.15) continue;
        const sp = Math.hypot(vx[i], vy[i]) || 1;
        const dx = (vx[i] / sp) * STREAK_LEN;
        const dy = (vy[i] / sp) * STREAK_LEN;
        ctx.moveTo(px[i] - dx, py[i] - dy);
        ctx.lineTo(px[i], py[i]);
      }
      ctx.stroke();

      ctx.globalAlpha = 1;
      ctx.beginPath();
      let any = false;
      for (let i = 0; i < N; i++) {
        if (alarm[i] < 0.15) continue;
        any = true;
        const sp = Math.hypot(vx[i], vy[i]) || 1;
        const dx = (vx[i] / sp) * STREAK_LEN * (1 + alarm[i] * 0.4);
        const dy = (vy[i] / sp) * STREAK_LEN * (1 + alarm[i] * 0.4);
        ctx.moveTo(px[i] - dx, py[i] - dy);
        ctx.lineTo(px[i], py[i]);
      }
      if (any) {
        ctx.lineWidth = 1.7;
        ctx.globalAlpha = Math.min(0.92, agitatedAlphaBase + 0.35);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    const renderFrame = () => {
      clearBg();
      drawWash();
      drawStreaks(0.5, 0.5);
    };

    // ---- main loop: fixed 30Hz physics, render once per rAF ---------------
    const loop = (t: number) => {
      const rawDt = Math.min((t - (last || t)) / 1000, 0.25);
      last = t;
      physAccum += rawDt;
      let steps = 0;
      while (physAccum >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
        stepPhysics(FIXED_DT, t / 1000);
        physAccum -= FIXED_DT;
        steps++;
      }
      renderFrame();
      raf = requestAnimationFrame(loop);
    };
    const wake = () => {
      if (!running) {
        running = true;
        last = 0;
        physAccum = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    const sleep = () => {
      cancelAnimationFrame(raf);
      running = false;
    };

    // ---- reduced motion: one precomputed long-exposure still --------------
    const seedBirds = () => {
      const cx = w / 2;
      const cy = h / 2;
      const rx = Math.min(w, h) * 0.34;
      const ry = Math.min(w, h) * 0.24;
      for (let i = 0; i < N; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random());
        px[i] = cx + Math.cos(a) * rx * r;
        py[i] = cy + Math.sin(a) * ry * r;
        const dir = Math.random() * Math.PI * 2;
        const sp = MIN_SPEED + Math.random() * (CRUISE_MAX_SPEED - MIN_SPEED);
        vx[i] = Math.cos(dir) * sp;
        vy[i] = Math.sin(dir) * sp;
        alarm[i] = 0;
        turnSign[i] = 0;
        propAccum[i] = Math.random() * PROP_LATENCY;
      }
    };

    const renderStatic = () => {
      if (w <= 0 || h <= 0) return;
      seedBirds();
      rebuildGridDims();
      rebuildDensityGrid();
      nextPassIn = H > 0 ? 2.0 : Infinity;
      falconActive = false;

      // silent physics-only warmup, no canvas work at all
      const WARMUP_STEPS = 180;
      for (let s = 0; s < WARMUP_STEPS; s++) stepPhysics(FIXED_DT, s * FIXED_DT);

      // accumulate a short low-alpha trail window — genuinely different from
      // the live loop, not a slowed-down copy of it
      clearBg();
      const ACCUM_STEPS = 24;
      for (let s = 0; s < ACCUM_STEPS; s++) {
        stepPhysics(FIXED_DT, (WARMUP_STEPS + s) * FIXED_DT);
        drawStreaks(0.1, 0.06);
      }
      drawWash();
    };

    // ---- mode plumbing ------------------------------------------------------
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;
    const applyMode = () => {
      if (reduced) {
        sleep();
        if (w > 0 && h > 0) renderStatic();
      } else {
        if (w > 0 && h > 0) {
          if (!seeded) {
            seedBirds();
            seeded = true;
          }
          clearBg();
          wake();
        }
      }
    };
    const onMq = () => {
      reduced = mq.matches;
      applyMode();
    };
    mq.addEventListener("change", onMq);

    const resize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) return;
      w = rect.width;
      h = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rebuildGridDims();
      rebuildDensityGrid();
      if (!seeded && !reduced) {
        seedBirds();
        seeded = true;
      } else if (seeded) {
        // clamp existing birds into the new bounds rather than reseeding
        for (let i = 0; i < N; i++) {
          if (px[i] > w) px[i] = w;
          if (py[i] > h) py[i] = h;
        }
      }
      applyMode();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    const themeObserver = new MutationObserver(() => {
      readInk();
      if (w <= 0 || h <= 0) return;
      if (reduced) renderStatic();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const onVis = () => {
      if (document.hidden) sleep();
      else if (!reduced) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      ro.disconnect();
      themeObserver.disconnect();
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
      sleep();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [N, H]);

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full overflow-hidden bg-background ${className}`}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      />
      {children ? <div className="relative z-[1] h-full w-full">{children}</div> : null}
    </div>
  );
}
