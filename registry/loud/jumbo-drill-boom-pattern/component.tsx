"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";

// ---------------------------------------------------------------------------
// JumboDrillBoomPattern — a full-bleed ambient background modeling a tunnel
// drill jumbo drilling a full blast pattern: one boom's drill steel swings to
// each collar point across a rock face and plunges in with a hammering
// jitter, leaving a growing hole, before withdrawing and repositioning to
// the next collar — hole by hole, in the numbered order of a real burn-cut
// drill-and-blast layout. This is strictly the DRILLING of the pattern
// (steel plunging into rock); it is deliberately NOT the firing sequence —
// that is registry/core/blast-hole-delay-sequence, the document-of-record
// object this component's finished pattern hands off to. It is also kept
// off tricone-bit-teeth's axis: that component is one bit crushing rock at a
// single point, this one is a PATTERN of holes being drilled in sequence
// across a face.
//
// TIMELINE IS A PURE FUNCTION OF simTime, not an incrementally stepped sim:
// a real jumbo cycle (drill-in, withdraw, reposition) is fully deterministic
// given the collar order, so every hole's state and the boom's position can
// be derived directly from elapsed time mod one loop — no per-frame state
// needs to accumulate. 35 collars (5x7 burn-cut layout), 2.4s/hole (1.8s
// drill-in + 0.3s withdraw + 0.3s reposition swing) = 84s to drill the full
// pattern, then a 3s pause with the full pattern visible and the boom
// parked, then a 4s dissolve where every hole fills back in together
// (standing in for the round being fired and a fresh face exposed) before
// the pattern restarts. Loop period = 91s.
//
// COLLAR ORDER: the 35 grid cells are sorted by distance from the pattern
// center with a per-cell jitter (seeded once, mulberry32) so drilling grows
// as an uneven cluster outward from a burn-cut-style center rather than a
// clean scanned row — matching how a real burn cut prioritizes the center
// relief holes before the perimeter/lookout ring.
//
// ROCK FACE: a low-frequency value-noise field (fixed control-point grid,
// seeded once at mount, bilinearly resampled into a small offscreen canvas
// that is only rebuilt on resize / token change, never per frame) ramps
// between --background and --ns-muted. Drilled holes punch through it as
// --foreground-anchored dark circles with a --ns-muted spoil-ring and a
// soft --foreground shadow (alpha-only, no literal color) so they still
// read as holes rather than a rendering artifact in light theme.
//
// Tokens: --foreground draws the rock structure, boom/steel and drilled
// holes; --ns-muted draws the ambient noise and each hole's spoil ring;
// --background clears the canvas. No --ns-accent anywhere — this is a
// resting ambient surface, no interaction moment. All three tokens are read
// via getComputedStyle(document.documentElement) only, after
// document.fonts.ready, before the first paint, and re-read (plus the rock
// buffer rebuilt) on a MutationObserver watching documentElement's class.
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;

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

const COLS = 5;
const ROWS = 7;
const TOTAL = COLS * ROWS; // 35 collar points
const WARP_POWER = 1.6; // >1 compresses spacing near center, widens toward perimeter

const DRILL_MS = 1800;
const WITHDRAW_MS = 300;
const REPOSITION_MS = 300;
const CYCLE_MS = DRILL_MS + WITHDRAW_MS + REPOSITION_MS; // 2400ms/hole
const TOTAL_DRILL_MS = TOTAL * CYCLE_MS; // 84000ms to drill the full pattern
const PAUSE_MS = 3000; // full pattern held, boom parked
const DISSOLVE_MS = 4000; // holes fill back in together
const LOOP_MS = TOTAL_DRILL_MS + PAUSE_MS + DISSOLVE_MS; // 91000ms

const T0_OFFSET_MS = 28000; // mount frame: ~a third drilled, one boom mid-plunge (11/35)
const REDUCED_FREEZE_MS = 51300; // ~61% through the pattern, hole 22 mid-plunge (progress 0.5)

const JITTER_HZ = 12; // percussive shake, decoupled from a real 30-60Hz drifter
const JITTER_AMP_PX_RATIO = 0.02; // relative to pattern spacing

const OFF_W = 96;
const CONTROL_COLS = 9;
const CONTROL_ROWS = 6;

interface Collar {
  x: number;
  y: number;
}

function easeOutCubic(t: number) {
  const u = 1 - t;
  return 1 - u * u * u;
}

function buildCollars(width: number, height: number): Collar[] {
  const minDim = Math.min(width, height);
  const halfX = minDim * 0.4;
  const halfY = halfX * ((ROWS - 1) / (COLS - 1));
  const cx = width / 2;
  const cy = height / 2;
  const collars: Collar[] = [];
  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      const nx = (i - (COLS - 1) / 2) / ((COLS - 1) / 2);
      const ny = (j - (ROWS - 1) / 2) / ((ROWS - 1) / 2);
      const wx = Math.sign(nx) * Math.pow(Math.abs(nx), WARP_POWER);
      const wy = Math.sign(ny) * Math.pow(Math.abs(ny), WARP_POWER);
      collars.push({ x: cx + wx * halfX, y: cy + wy * halfY });
    }
  }
  return collars;
}

// order 0..TOTAL-1 grid indices by jittered distance from center — an
// uneven cluster growing outward, burn-cut style, not a scanned row.
function buildCollarOrder(): number[] {
  const rand = mulberry32(0xb17e5eed);
  const scored = Array.from({ length: TOTAL }, (_, idx) => {
    const i = idx % COLS;
    const j = Math.floor(idx / COLS);
    const nx = (i - (COLS - 1) / 2) / ((COLS - 1) / 2);
    const ny = (j - (ROWS - 1) / 2) / ((ROWS - 1) / 2);
    const d = Math.hypot(nx, ny) + (rand() - 0.5) * 0.7;
    return { idx, d };
  });
  scored.sort((a, b) => a.d - b.d);
  return scored.map((s) => s.idx);
}

interface HoleFrame {
  drilledUpTo: number; // count of fully-complete holes (exclusive of current)
  currentIndex: number; // -1 if none active (pause/dissolve)
  currentDepth: number; // 0..1 growth of the current hole
  steelExtend: number; // 0..1 how far the steel currently pokes past the collar
  boomTargetOrderIdx: number; // order index the boom tip is at/heading to
  boomTravelT: number; // 0..1 within a reposition swing, else 0 or 1
  dissolveT: number; // 0 outside dissolve phase
  parked: boolean;
}

function computeFrame(simTimeMs: number): HoleFrame {
  const t = ((simTimeMs % LOOP_MS) + LOOP_MS) % LOOP_MS;

  if (t < TOTAL_DRILL_MS) {
    const index = Math.min(TOTAL - 1, Math.floor(t / CYCLE_MS));
    const phaseTime = t - index * CYCLE_MS;
    if (phaseTime < DRILL_MS) {
      const progress = easeOutCubic(phaseTime / DRILL_MS);
      return {
        drilledUpTo: index,
        currentIndex: index,
        currentDepth: progress,
        steelExtend: progress,
        boomTargetOrderIdx: index,
        boomTravelT: 1,
        dissolveT: 0,
        parked: false,
      };
    }
    if (phaseTime < DRILL_MS + WITHDRAW_MS) {
      const wp = (phaseTime - DRILL_MS) / WITHDRAW_MS;
      return {
        drilledUpTo: index + 1,
        currentIndex: index,
        currentDepth: 1,
        steelExtend: 1 - wp,
        boomTargetOrderIdx: index,
        boomTravelT: 1,
        dissolveT: 0,
        parked: false,
      };
    }
    const rp = (phaseTime - DRILL_MS - WITHDRAW_MS) / REPOSITION_MS;
    return {
      drilledUpTo: index + 1,
      currentIndex: index,
      currentDepth: 1,
      steelExtend: 0,
      boomTargetOrderIdx: index + 1, // may equal TOTAL -> park
      boomTravelT: rp,
      dissolveT: 0,
      parked: false,
    };
  }

  if (t < TOTAL_DRILL_MS + PAUSE_MS) {
    return {
      drilledUpTo: TOTAL,
      currentIndex: -1,
      currentDepth: 0,
      steelExtend: 0,
      boomTargetOrderIdx: TOTAL,
      boomTravelT: 1,
      dissolveT: 0,
      parked: true,
    };
  }

  const dissolveT = (t - TOTAL_DRILL_MS - PAUSE_MS) / DISSOLVE_MS;
  return {
    drilledUpTo: TOTAL,
    currentIndex: -1,
    currentDepth: 0,
    steelExtend: 0,
    boomTargetOrderIdx: TOTAL,
    boomTravelT: 1,
    dissolveT,
    parked: true,
  };
}

export interface JumboDrillBoomPatternProps {
  /** freeze the field at its current frame. @default false */
  paused?: boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function JumboDrillBoomPattern({
  paused = false,
  children,
  className = "",
  style,
}: JumboDrillBoomPatternProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // persists across effect re-inits (e.g. the `paused` prop flipping) so a
  // pause freezes wherever the pattern actually is, never snaps back to t0.
  const simTimeRef = useRef(T0_OFFSET_MS);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const off = document.createElement("canvas");
    const offCtx = off.getContext("2d");
    if (!offCtx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let ink = "";
    let muted = "";
    let bg = "";
    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      ink = cs.getPropertyValue("--foreground").trim();
      muted = cs.getPropertyValue("--ns-muted").trim();
      bg = cs.getPropertyValue("--background").trim();
    };

    // fixed control-point noise grid — generated once at mount, never
    // regenerated on resize; only its resampling target size changes.
    const controlRand = mulberry32(0x5eed1e5);
    const controls: number[] = [];
    for (let k = 0; k < CONTROL_COLS * CONTROL_ROWS; k++) controls.push(controlRand());

    const sampleNoise = (u: number, v: number) => {
      const fx = u * (CONTROL_COLS - 1);
      const fy = v * (CONTROL_ROWS - 1);
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const x1 = Math.min(CONTROL_COLS - 1, x0 + 1);
      const y1 = Math.min(CONTROL_ROWS - 1, y0 + 1);
      const tx = fx - x0;
      const ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx); // smoothstep
      const sy = ty * ty * (3 - 2 * ty);
      const g = (xx: number, yy: number) => controls[yy * CONTROL_COLS + xx];
      const top = g(x0, y0) * (1 - sx) + g(x1, y0) * sx;
      const bot = g(x0, y1) * (1 - sx) + g(x1, y1) * sx;
      return top * (1 - sy) + bot * sy;
    };

    let width = 0;
    let height = 0;
    let dpr = 1;
    let sized = false;
    let ready = false;
    let disposed = false;
    let visible = true;
    let raf = 0;

    let collars: Collar[] = [];
    let order: number[] = buildCollarOrder();
    let holeR = 6;
    let jitterAmp = 2;
    let base: Collar = { x: 0, y: 0 };
    let park: Collar = { x: 0, y: 0 };

    let mountPerf = 0;

    const buildRockBuffer = () => {
      const offH = Math.max(24, Math.round((OFF_W * height) / Math.max(1, width)));
      off.width = OFF_W;
      off.height = offH;
      offCtx.fillStyle = bg;
      offCtx.fillRect(0, 0, OFF_W, offH);
      offCtx.fillStyle = muted;
      for (let y = 0; y < offH; y++) {
        for (let x = 0; x < OFF_W; x++) {
          const n = sampleNoise(x / (OFF_W - 1), y / (offH - 1));
          offCtx.globalAlpha = Math.max(0, n - 0.15) * 0.42;
          offCtx.fillRect(x, y, 1, 1);
        }
      }
      offCtx.globalAlpha = 1;
    };

    const layout = () => {
      collars = buildCollars(width, height);
      const minDim = Math.min(width, height);
      const spacing = (minDim * 0.4 * 2) / (COLS - 1);
      holeR = Math.max(3, spacing * 0.24);
      jitterAmp = Math.max(1, spacing * JITTER_AMP_PX_RATIO * 10);
      base = { x: width * -0.06, y: height * 1.05 };
      park = { x: width * 0.05, y: height * 0.9 };
      buildRockBuffer();
    };

    const collarFor = (orderIdx: number): Collar => {
      if (orderIdx >= TOTAL) return park;
      return collars[order[orderIdx]];
    };

    const draw = (simTimeMs: number) => {
      if (!sized) return;
      const f = computeFrame(simTimeMs);
      const fade = 1 - f.dissolveT;

      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(off, 0, 0, width, height);

      // undrilled collar marks — faint plan reference, always visible.
      ctx.strokeStyle = muted;
      ctx.lineWidth = Math.max(1, holeR * 0.16);
      for (let k = 0; k < collars.length; k++) {
        const isDrilled =
          order.indexOf(k) < f.drilledUpTo || (f.currentIndex >= 0 && order[f.currentIndex] === k);
        if (isDrilled && fade > 0.02) continue;
        ctx.globalAlpha = 0.3;
        const c = collars[k];
        ctx.beginPath();
        ctx.arc(c.x, c.y, holeR * 0.42, 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // drilled holes: rim + shadowed puncture.
      for (let oi = 0; oi < TOTAL; oi++) {
        let depth = 0;
        if (oi < f.drilledUpTo) depth = 1;
        else if (oi === f.currentIndex) depth = f.currentDepth;
        if (depth <= 0) continue;
        depth *= fade;
        if (depth <= 0.01) continue;
        const c = collars[order[oi]];
        const r = holeR * depth;

        ctx.beginPath();
        ctx.fillStyle = muted;
        ctx.globalAlpha = 0.55 * depth;
        ctx.arc(c.x, c.y, r * 1.45, 0, TAU);
        ctx.fill();

        ctx.save();
        ctx.shadowColor = ink;
        ctx.shadowBlur = r * 0.9;
        ctx.globalAlpha = 0.4 * depth;
        ctx.beginPath();
        ctx.arc(c.x, c.y, r * 0.9, 0, TAU);
        ctx.fillStyle = ink;
        ctx.fill();
        ctx.restore();

        ctx.beginPath();
        ctx.globalAlpha = 0.92 * depth;
        ctx.fillStyle = ink;
        ctx.arc(c.x, c.y, r, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // boom + steel — hidden once fully dissolved back to a bare face.
      if (fade > 0.02) {
        let tip: Collar;
        if (f.parked) {
          tip = park;
        } else {
          const from = collarFor(f.currentIndex);
          const to = collarFor(f.boomTargetOrderIdx);
          const rt = f.boomTravelT;
          tip = { x: from.x + (to.x - from.x) * rt, y: from.y + (to.y - from.y) * rt };
        }

        const dx = tip.x - base.x;
        const dy = tip.y - base.y;
        const len = Math.max(1, Math.hypot(dx, dy));
        const dirX = dx / len;
        const dirY = dy / len;
        const perpX = -dirY;
        const perpY = dirX;

        const jitter =
          f.steelExtend > 0.01
            ? (Math.sin(simTimeMs * 0.001 * JITTER_HZ * TAU) +
                0.4 * Math.sin(simTimeMs * 0.001 * JITTER_HZ * 2.3 * TAU + 1.3)) *
              jitterAmp *
              0.72
            : 0;

        const mastTipX = base.x + dirX * len * 0.86;
        const mastTipY = base.y + dirY * len * 0.86;

        ctx.globalAlpha = 0.75 * fade;
        ctx.strokeStyle = ink;
        ctx.lineWidth = Math.max(1.5, holeR * 0.34);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(mastTipX, mastTipY);
        ctx.stroke();

        // carriage stub at the base.
        ctx.globalAlpha = 0.55 * fade;
        ctx.fillStyle = ink;
        ctx.fillRect(base.x - holeR * 0.9, base.y - holeR * 0.6, holeR * 1.8, holeR * 1.2);

        // steel — plunges past the collar into the rock, with hammering jitter.
        const steelBackX = mastTipX + perpX * jitter;
        const steelBackY = mastTipY + perpY * jitter;
        const steelTipX = tip.x + dirX * holeR * 2.1 * f.steelExtend + perpX * jitter;
        const steelTipY = tip.y + dirY * holeR * 2.1 * f.steelExtend + perpY * jitter;
        ctx.globalAlpha = 0.85 * fade;
        ctx.lineWidth = Math.max(1, holeR * 0.16);
        ctx.beginPath();
        ctx.moveTo(steelBackX, steelBackY);
        ctx.lineTo(steelTipX, steelTipY);
        ctx.stroke();
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
      layout();
      sized = true;
    };

    const loop = (now: number) => {
      if (!visible) return;
      const simTimeMs = now - mountPerf;
      simTimeRef.current = simTimeMs;
      draw(simTimeMs);
      raf = requestAnimationFrame(loop);
    };

    // resumes the loop from wherever simTimeRef last landed, never snaps
    // back to t0 — used on mount, resize-recovery, and every reactivation.
    const startLoop = () => {
      mountPerf = performance.now() - simTimeRef.current;
      raf = requestAnimationFrame(loop);
    };

    const drawFrozen = () => draw(reduced ? REDUCED_FREEZE_MS : simTimeRef.current);

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (!sized) return;
        ready = true;
        if (reduced || paused) {
          drawFrozen();
        } else if (visible && !raf) {
          startLoop();
        }
      }, 150);
    };

    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        if (visible && ready && !reduced && !paused) {
          startLoop();
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
        startLoop();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const mo = new MutationObserver(() => {
      readTokens();
      if (sized) buildRockBuffer();
      if (reduced || paused) drawFrozen();
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
      ready = true;
      if (reduced || paused) {
        drawFrozen();
      } else {
        startLoop();
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
  }, [paused]);

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

JumboDrillBoomPattern.displayName = "JumboDrillBoomPattern";
