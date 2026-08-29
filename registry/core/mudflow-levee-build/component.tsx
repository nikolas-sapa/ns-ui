"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// MudflowLeveeBuild — an ambient activity track where the track itself is
// self-built by the traffic flowing through it, rather than a pre-existing
// channel being filled. Modelled on lateral levee formation in debris flows
// (mudflows with a coarse clast fraction — cobbles suspended in a fine
// matrix): shear at a flow's margins is highest where the edges lag the
// faster center, and that shear preferentially strands the coarsest
// material at the margins. Over many surges those margins build into two
// low ridges that confine and channelize everything behind them, narrowing
// the channel — until a surge overtops one bank, breaching it, and the
// active path avulses sideways, leaving the old levee pair behind as a
// static scar.
//
// Two lanes (top half of the track, bottom half) each hold their own pair
// of Float32Array levee-height buckets (one bucket per horizontal position,
// bucket width derived from the container's smaller dimension so the ridge
// reads at card scale). Only one lane is "active" (carries live surges) at
// a time; the other sits empty until a breach hands it the channel. A surge
// spawns every ~1.6-3.4s (mean 2.4s), sweeps left to right over 1.8s, and
// deposits growth onto BOTH margins of whichever bucket it currently
// occupies roughly every 90ms — so levee height at any point is a literal
// record of how many surges have passed there and how coarse each was, not
// a uniform ramp. Once a margin bucket's height crosses 78% of the lane's
// half-height, the flow breaches there: that levee's height collapses
// toward a residual scar value over 300ms, the active lane freezes in
// place (no further deposits, ever), and the OTHER lane resets to a flat
// channel and takes over as active, starting its own pair from scratch.
// The abandoned lane keeps rendering its frozen ridge (and its gap)
// indefinitely as a visible scar.
//
// Levee ridges are drawn as a granulated cluster of small markers rather
// than a filled bar: marker count per bucket is derived directly from that
// bucket's stored height (height / DOT_PITCH), and each marker's jittered
// position is a deterministic hash of its (lane, margin, bucket, index) —
// so growing the height only ever appends new markers at the outer end,
// every existing marker holds its exact pixel position frame to frame, and
// nothing needs to be stored beyond the height arrays themselves (bounded
// memory, unbounded loop). The active lane's flow band is a horizontally
// tapered translucent fill following the current surge position(s),
// confined between that bucket's live margin heights, so the band visibly
// narrows as the levees grow beneath it.
//
// Legibility: the one thing to follow is levee height climbing at the
// margins (never the channel "filling") until a breach visibly snaps the
// active path sideways — a rare (~9-13s), unmistakably discrete event
// distinct from the continuous narrowing around it.
// ---------------------------------------------------------------------------

type Vec3 = [number, number, number];

function parseColor(raw: string): Vec3 | null {
  const s = raw.trim();
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex.slice(0, 1) + hex.slice(0, 1), 16);
      const g = parseInt(hex.slice(1, 2) + hex.slice(1, 2), 16);
      const b = parseInt(hex.slice(2, 3) + hex.slice(2, 3), 16);
      return Number.isNaN(r + g + b) ? null : [r, g, b];
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return Number.isNaN(r + g + b) ? null : [r, g, b];
    }
    return null;
  }
  const m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

// deterministic per-cell hash — used for marker jitter (must stay fixed
// across frames) and for the flow band's turbulence texture.
function hash01(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

const SURGE_TRAVERSE_MS = 1800;
const SURGE_MIN_GAP = 1600;
const SURGE_MAX_GAP = 3400;
const MARKER_INTERVAL_MS = 90;
const GROWTH_MIN = 0.4;
const GROWTH_MAX = 0.9;
const COARSE_MIN = 0.6;
const COARSE_MAX = 1.4;
const BREACH_THRESHOLD_FRAC = 0.78;
const BREACH_MS = 300;
const BREACH_RESIDUAL = 0.12; // fraction of pre-breach height left as scar gap
const TAPER_BUCKETS = 6; // how many buckets either side of a surge the flow band tapers over
const MAX_SURGES = 4;

interface LaneState {
  top: Float32Array;
  bottom: Float32Array;
  active: boolean;
}

interface Surge {
  lane: number;
  start: number;
  lastDeposit: number;
  coarse: number;
}

interface BreachAnim {
  lane: number;
  bucket: number;
  margin: "top" | "bottom";
  start: number;
  from: number;
}

export interface MudflowLeveeBuildProps {
  /** accessible label describing the ambient visualisation */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function MudflowLeveeBuild({
  label = "Channel activity",
  className = "",
}: MudflowLeveeBuildProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // -- token-derived ink: read at mount, re-derived on theme class change --
    let fg: Vec3 = [237, 237, 237];
    let bd: Vec3 = [55, 55, 55];
    const derive = () => {
      const cs = getComputedStyle(document.documentElement);
      fg = parseColor(cs.getPropertyValue("--foreground")) ?? fg;
      bd = parseColor(cs.getPropertyValue("--border")) ?? bd;
    };
    derive(); // no paint happens before this

    let disposed = false;
    let visible = true;
    let raf = 0;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let numBuckets = 32;
    let bucketPxWidth = 8;
    let laneH = 0;
    let laneGap = 2;
    let halfLane = 1;
    let dotPitch = 3;

    const lanes: LaneState[] = [
      { top: new Float32Array(0), bottom: new Float32Array(0), active: true },
      { top: new Float32Array(0), bottom: new Float32Array(0), active: false },
    ];
    let activeLane = 0;
    let surges: Surge[] = [];
    let nextSpawnAt = 0;
    let breachAnim: BreachAnim | null = null;

    const coarseRand = () => COARSE_MIN + Math.random() * (COARSE_MAX - COARSE_MIN);
    const spawnGap = () => {
      const t = (Math.random() + Math.random()) / 2; // bias toward the mean
      return SURGE_MIN_GAP + t * (SURGE_MAX_GAP - SURGE_MIN_GAP);
    };

    const laneY0 = (lane: number) => (lane === 0 ? 0 : laneH + laneGap);
    const bucketX = (b: number) => b * bucketPxWidth;

    const triggerBreach = (now: number, lane: number, bucket: number, margin: "top" | "bottom") => {
      const arr = lanes[lane][margin];
      breachAnim = { lane, bucket, margin, start: now, from: arr[bucket] ?? 0 };
      lanes[lane].active = false;
      const nextLane = 1 - lane;
      const nl = lanes[nextLane];
      nl.top.fill(0);
      nl.bottom.fill(0);
      nl.active = true;
      activeLane = nextLane;
      surges = [{ lane: nextLane, start: now, lastDeposit: now, coarse: coarseRand() }];
      nextSpawnAt = now + spawnGap();
    };

    const warmStart = (now: number) => {
      // never a fresh flat channel at t0 — pre-build an asymmetric ridge as
      // if several surges already passed, and put one surge already
      // partway across the track.
      const lane = lanes[0];
      for (let b = 0; b < numBuckets; b++) {
        lane.top[b] = (0.1 + 0.24 * hash01(b, 11)) * halfLane;
        lane.bottom[b] = (0.05 + 0.16 * hash01(b, 29)) * halfLane;
      }
      lane.active = true;
      lanes[1].active = false;
      activeLane = 0;
      surges = [
        { lane: 0, start: now - SURGE_TRAVERSE_MS * 0.45, lastDeposit: now, coarse: coarseRand() },
      ];
      nextSpawnAt = now + spawnGap();
      breachAnim = null;
    };

    const buildReducedFrame = () => {
      // frozen "immediately after a breach" frame: an abandoned lane with a
      // visible gap sitting beside a fresh, partially-built active lane.
      const old = lanes[0];
      const fresh = lanes[1];
      for (let b = 0; b < numBuckets; b++) {
        old.top[b] = (0.4 + 0.34 * hash01(b, 3)) * halfLane;
        old.bottom[b] = (0.32 + 0.3 * hash01(b, 7)) * halfLane;
      }
      const gapB = Math.floor(numBuckets * 0.6);
      for (let d = -1; d <= 1; d++) {
        const bb = gapB + d;
        if (bb >= 0 && bb < numBuckets) old.top[bb] = (old.top[bb] ?? 0) * BREACH_RESIDUAL;
      }
      old.active = false;
      for (let b = 0; b < numBuckets; b++) {
        fresh.top[b] = (0.05 + 0.14 * hash01(b, 41)) * halfLane;
        fresh.bottom[b] = (0.04 + 0.11 * hash01(b, 53)) * halfLane;
      }
      fresh.active = true;
      activeLane = 1;
      surges = [];
      breachAnim = null;
    };

    const deposit = (now: number) => {
      if (breachAnim) return;
      for (let i = surges.length - 1; i >= 0; i--) {
        const s = surges[i];
        if (!s) continue;
        const progress = (now - s.start) / SURGE_TRAVERSE_MS;
        if (progress >= 1) {
          surges.splice(i, 1);
          continue;
        }
        if (progress < 0) continue;
        if (now - s.lastDeposit < MARKER_INTERVAL_MS) continue;
        s.lastDeposit = now;
        const lane = lanes[s.lane];
        if (!lane.active) continue;
        const bucket = Math.max(0, Math.min(numBuckets - 1, Math.floor(progress * numBuckets)));
        const growTop = (GROWTH_MIN + Math.random() * (GROWTH_MAX - GROWTH_MIN)) * s.coarse;
        const growBottom = (GROWTH_MIN + Math.random() * (GROWTH_MAX - GROWTH_MIN)) * s.coarse;
        lane.top[bucket] = Math.min(halfLane, (lane.top[bucket] ?? 0) + growTop);
        lane.bottom[bucket] = Math.min(halfLane, (lane.bottom[bucket] ?? 0) + growBottom);
        const threshold = BREACH_THRESHOLD_FRAC * halfLane;
        if (!breachAnim) {
          if ((lane.top[bucket] ?? 0) >= threshold) {
            triggerBreach(now, s.lane, bucket, "top");
            return;
          }
          if ((lane.bottom[bucket] ?? 0) >= threshold) {
            triggerBreach(now, s.lane, bucket, "bottom");
            return;
          }
        }
      }
      if (!breachAnim && now >= nextSpawnAt) {
        surges.push({ lane: activeLane, start: now, lastDeposit: now, coarse: coarseRand() });
        if (surges.length > MAX_SURGES) surges.shift();
        nextSpawnAt = now + spawnGap();
      }
    };

    const resolveBreachAnim = (now: number) => {
      if (!breachAnim) return;
      const p = Math.min(1, (now - breachAnim.start) / BREACH_MS);
      const eased = easeOutCubic(p);
      const target = breachAnim.from * BREACH_RESIDUAL;
      const val = breachAnim.from + (target - breachAnim.from) * eased;
      const lane = lanes[breachAnim.lane];
      lane[breachAnim.margin][breachAnim.bucket] = val;
      // widen the visible gap slightly into the immediate neighbours
      for (const d of [-1, 1]) {
        const bb = breachAnim.bucket + d;
        if (bb < 0 || bb >= numBuckets) continue;
        const arr = lane[breachAnim.margin];
        const base = arr[bb] ?? 0;
        arr[bb] = base - (base - base * BREACH_RESIDUAL) * eased * 0.5;
      }
      if (p >= 1) breachAnim = null;
    };

    const drawMargin = (lane: LaneState, laneTop: number, l: number, margin: "top" | "bottom") => {
      const arr = lane[margin];
      for (let b = 0; b < numBuckets; b++) {
        const height = arr[b] ?? 0;
        if (height <= 0.5) continue;
        const count = Math.max(1, Math.ceil(height / dotPitch));
        const x = bucketX(b) + bucketPxWidth / 2;
        for (let i = 0; i < count; i++) {
          const dist = Math.min(height, i * dotPitch + dotPitch * 0.4);
          const jx = (hash01(b * 7 + i * 3 + l * 131 + (margin === "top" ? 1 : 2), 5) - 0.5) * bucketPxWidth * 0.7;
          const size = 2 + hash01(b * 3 + l * 17, i + (margin === "top" ? 31 : 59)) * 1.1;
          const y = margin === "top" ? laneTop + dist : laneTop + laneH - dist;
          ctx.fillRect(x + jx - size / 2, y - size / 2, size, size);
        }
      }
    };

    const drawFlowBand = (lane: LaneState, laneTop: number, l: number, now: number) => {
      for (let b = 0; b < numBuckets; b++) {
        let alpha = 0;
        for (const s of surges) {
          if (s.lane !== l) continue;
          const progress = (now - s.start) / SURGE_TRAVERSE_MS;
          if (progress < 0 || progress > 1) continue;
          const sx = progress * numBuckets;
          const d = Math.abs(b - sx);
          const a = Math.max(0, 1 - d / TAPER_BUCKETS);
          if (a > alpha) alpha = a;
        }
        if (alpha <= 0.02) continue;
        const yTop = laneTop + (lane.top[b] ?? 0);
        const yBot = laneTop + laneH - (lane.bottom[b] ?? 0);
        if (yBot <= yTop) continue;
        const flicker = 0.82 + 0.32 * hash01(b, Math.floor(now / 90));
        const a = Math.min(0.5, alpha * 0.5 * flicker);
        ctx.fillStyle = `rgba(${fg[0]},${fg[1]},${fg[2]},${a.toFixed(3)})`;
        ctx.fillRect(bucketX(b), yTop, bucketPxWidth + 0.5, yBot - yTop);
      }
    };

    const drawStaticFlow = (lane: LaneState, laneTop: number) => {
      // reduced-motion only: a single non-scrolling fill so the fresh
      // channel still reads as carrying live flow, not an empty gutter.
      for (let b = 0; b < numBuckets; b++) {
        const yTop = laneTop + (lane.top[b] ?? 0);
        const yBot = laneTop + laneH - (lane.bottom[b] ?? 0);
        if (yBot <= yTop) continue;
        ctx.fillStyle = `rgba(${fg[0]},${fg[1]},${fg[2]},0.35)`;
        ctx.fillRect(bucketX(b), yTop, bucketPxWidth + 0.5, yBot - yTop);
      }
    };

    const draw = (now: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (w <= 0 || h <= 0) return;

      ctx.strokeStyle = `rgb(${bd[0]},${bd[1]},${bd[2]})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, Math.max(0, w - 1), Math.max(0, h - 1));

      for (let l = 0; l < 2; l++) {
        const lane = lanes[l];
        if (!lane) continue;
        const top = laneY0(l);
        if (lane.active) {
          if (reduced) drawStaticFlow(lane, top);
          else drawFlowBand(lane, top, l, now);
        }
        ctx.fillStyle = `rgb(${fg[0]},${fg[1]},${fg[2]})`;
        drawMargin(lane, top, l, "top");
        drawMargin(lane, top, l, "bottom");
      }
    };

    const loop = (now: number) => {
      if (disposed) return;
      if (!visible) {
        raf = 0;
        return;
      }
      deposit(now);
      resolveBreachAnim(now);
      draw(now);
      raf = requestAnimationFrame(loop);
    };

    const allocLanes = () => {
      lanes[0].top = new Float32Array(numBuckets);
      lanes[0].bottom = new Float32Array(numBuckets);
      lanes[1].top = new Float32Array(numBuckets);
      lanes[1].bottom = new Float32Array(numBuckets);
    };

    const measure = () => {
      const rect = root.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      if (w < 2 || h < 2) return false;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));

      const minDim = Math.min(w, h);
      const bucketTarget = Math.max(3, minDim / 40);
      numBuckets = Math.max(16, Math.floor(w / bucketTarget));
      bucketPxWidth = w / numBuckets;
      laneGap = Math.max(1, Math.round(minDim / 80));
      laneH = (h - laneGap) / 2;
      halfLane = laneH / 2;
      dotPitch = Math.max(2, Math.min(4, Math.round(minDim / 90)));
      allocLanes();
      return true;
    };

    const start = () => {
      if (!measure()) return;
      const now = performance.now();
      if (reduced) {
        buildReducedFrame();
        draw(now);
        raf = 0;
        return;
      }
      warmStart(now);
      draw(now);
      if (raf === 0) raf = requestAnimationFrame(loop);
    };

    start();

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (disposed) return;
        cancelAnimationFrame(raf);
        raf = 0;
        start();
      }, 120);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(root);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !reduced && raf === 0 && !disposed) {
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(root);

    const mo = new MutationObserver(() => {
      derive();
      if (raf === 0) draw(performance.now());
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      window.clearTimeout(resizeTimer);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      role="img"
      aria-label={label}
      className={`relative w-full overflow-hidden rounded-sm ${className}`}
    >
      <canvas ref={canvasRef} aria-hidden className="h-full w-full" />
    </div>
  );
}
