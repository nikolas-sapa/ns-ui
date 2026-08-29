"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// MillstoneFurrowFlow — an ambient processing-section background modelled on
// a dressed millstone pair. Two sickle-furrow patterns are drawn concentric
// and share a centre but NOT a furrow count: the bedstone (static,
// underneath) is dressed with 13 furrows, the runner (rotating, on top) with
// the standard 12. Two near-equal angular frequencies beat against each
// other — that |13-12| = 1 mismatch is what produces a single crossing band
// that sweeps once around the stone per runner revolution, not 12 crossings
// drifting together (which a same-count pair would produce, reading as a
// restyled radial pattern rather than a genuine moiré). The bedstone's
// sickle curvature is also mirrored relative to the runner's, matching how a
// real bedstone is dressed as the runner's counter-pattern so the two
// furrow sets genuinely scissor rather than merely overlay.
//
// A second, independent process rides on top of the furrow field: grain
// particles spawn at the stone's eye (centre) and spiral outward, shrinking
// as they travel — coarse feed at the centre, fine meal at the rim — then
// disperse into a handful of fading dust motes instead of simply vanishing.
// A particle's own angle is coupled to 60% of the runner's angular rate, so
// its path traces a shallow spiral rather than a straight radius, visually
// tying it to the furrow pattern turning beneath it.
//
// The real runner stone turns at roughly 120 RPM (~2 rev/s); rendered here
// at 0.08 rev/s, a deliberate decoupling from the real rate for legibility
// (a viewer needs seconds, not a strobe, to track the moiré sweep) — the
// real number is documented, not animated 1:1.
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

// -- real millwright numbers, documented rate then a deliberately decoupled
// rendered rate (round-9 legibility rule: near/above-paint-rate mechanics
// must render slow, not 1:1) -------------------------------------------------
const REAL_RUNNER_RPM = 120; // ~2 rev/s on an operating stone mill
const RUNNER_REV_PER_SEC = 0.08; // rendered rate, documented as illustrative
const RUNNER_ANGULAR_RATE = RUNNER_REV_PER_SEC * Math.PI * 2; // rad/s

const RUNNER_FURROW_COUNT = 12; // sickle-dress furrow count, rotating layer
const BEDSTONE_FURROW_COUNT = 13; // one more than the runner — the frequency
// mismatch that turns two overlaid patterns into a genuine beating moiré
const STONE_RADIUS_RATIO = 0.48; // of min(w, h)
const EYE_RADIUS_RATIO = 0.04; // of stone radius
const SICKLE_SWEEP = (12 * Math.PI) / 180; // angular curvature per furrow
const FURROW_ALPHA_CENTER = 0.62; // deepest cut, highest local contrast
const FURROW_ALPHA_RIM = 0.24; // shallowest land, above --border's 1.1:1 floor
const BEDSTONE_ALPHA_SCALE = 0.72; // static layer sits slightly under the runner
const CURVE_STEPS = 20; // polyline samples per furrow curve

const SPAWN_INTERVAL_MS = 900; // one grain every 0.9s
const BASE_STONE_RADIUS = 240; // reference radius the real numbers were measured against
const BASE_TRAVEL_MS = 4500; // ~4.5s eye-to-rim at the reference radius (~14px/s outward)
const MIN_TRAVEL_MS = 1500;
const MAX_TRAVEL_MS = 9000;
const EASE_EXP = 1.15; // accelerating outward travel (centrifugal build-up)
const SIZE_EYE_PX = 5;
const SIZE_RIM_PX = 1;
const ANGULAR_COUPLE = 0.6; // fraction of the runner's angular delta a grain inherits
const DUST_FADE_MS = 800;
const DUST_SIZE_PX = 0.5;

interface Grain {
  spawnMs: number;
  spawnAngle: number;
  spawnRunnerAngle: number;
}

interface Dust {
  x: number;
  y: number;
  spawnMs: number;
}

export interface MillstoneFurrowFlowProps {
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function MillstoneFurrowFlow({ className = "" }: MillstoneFurrowFlowProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rand = mulberry32(0x6d1157a3);

    // -- token-derived ink, re-derived on theme class change, no paint before
    // the first read ----------------------------------------------------------
    let muted: Vec3 = [143, 143, 143];
    let fg: Vec3 = [237, 237, 237];
    const derive = () => {
      const cs = getComputedStyle(document.documentElement);
      muted = parseColor(cs.getPropertyValue("--ns-muted")) ?? muted;
      fg = parseColor(cs.getPropertyValue("--foreground")) ?? fg;
    };
    derive();

    let w = 0;
    let h = 0;
    let dpr = 1;
    let cx = 0;
    let cy = 0;
    let stoneR = 0;
    let eyeR = 0;
    let travelMs = BASE_TRAVEL_MS;
    let bedPath: Path2D = new Path2D();
    let runnerPath: Path2D = new Path2D();
    let gradient: CanvasGradient | null = null;

    let raf = 0;
    let visible = true;

    let grains: Grain[] = [];
    let dust: Dust[] = [];
    let nextSpawnMs = 0;

    // -- a furrow is a quadratic bezier in polar space: radius eases linearly
    // eye->rim, angle curves through a midpoint offset by half the sickle
    // sweep before reaching its endpoint. sweepSign flips the curvature so
    // the bedstone pattern mirrors the runner's, matching a real dress. -----
    const buildFurrowPath = (count: number, sweepSign: 1 | -1): Path2D => {
      const path = new Path2D();
      const sweep = SICKLE_SWEEP * sweepSign;
      for (let f = 0; f < count; f++) {
        const a0 = (f / count) * Math.PI * 2;
        const aMid = a0 + sweep * 0.5;
        const aEnd = a0 + sweep;
        for (let i = 0; i <= CURVE_STEPS; i++) {
          const t = i / CURVE_STEPS;
          const ang = (1 - t) * (1 - t) * a0 + 2 * (1 - t) * t * aMid + t * t * aEnd;
          const r = eyeR + (stoneR - eyeR) * t;
          const px = cx + Math.cos(ang) * r;
          const py = cy + Math.sin(ang) * r;
          if (i === 0) path.moveTo(px, py);
          else path.lineTo(px, py);
        }
      }
      return path;
    };

    const buildGradient = (): CanvasGradient => {
      const g = ctx.createRadialGradient(cx, cy, eyeR, cx, cy, stoneR);
      g.addColorStop(0, `rgba(${muted[0]},${muted[1]},${muted[2]},${FURROW_ALPHA_CENTER})`);
      g.addColorStop(1, `rgba(${muted[0]},${muted[1]},${muted[2]},${FURROW_ALPHA_RIM})`);
      return g;
    };

    const spawnDust = (x: number, y: number, nowMs: number) => {
      const count = 3 + Math.floor(rand() * 4); // 3..6
      for (let i = 0; i < count; i++) {
        const jitter = 3 + rand() * 3;
        const jang = rand() * Math.PI * 2;
        dust.push({
          x: x + Math.cos(jang) * jitter,
          y: y + Math.sin(jang) * jitter,
          spawnMs: nowMs,
        });
      }
    };

    const drawGrain = (x: number, y: number, sizePx: number, alpha: number) => {
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.25, sizePx / 2), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${fg[0]},${fg[1]},${fg[2]},${alpha.toFixed(3)})`;
      ctx.fill();
    };

    const drawFurrows = (runnerAngle: number) => {
      if (!gradient) return;
      ctx.lineWidth = 1;
      ctx.strokeStyle = gradient;
      ctx.globalAlpha = BEDSTONE_ALPHA_SCALE;
      ctx.stroke(bedPath); // static bedstone, underneath
      ctx.globalAlpha = 1;
      // rotating runner, on top — the 12-vs-13 frequency mismatch against the
      // static bedstone is what produces the moiré band sweeping the stone
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(runnerAngle);
      ctx.translate(-cx, -cy);
      ctx.stroke(runnerPath);
      ctx.restore();
    };

    const render = (nowMs: number, runnerAngle: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (w <= 0 || h <= 0 || stoneR <= 0) return;

      drawFurrows(runnerAngle);

      for (const g of grains) {
        const elapsed = nowMs - g.spawnMs;
        const progress = Math.min(1, Math.max(0, elapsed / travelMs));
        const eased = Math.pow(progress, EASE_EXP);
        const r = eyeR + (stoneR - eyeR) * eased;
        const size = SIZE_EYE_PX + (SIZE_RIM_PX - SIZE_EYE_PX) * progress;
        const angle = g.spawnAngle + ANGULAR_COUPLE * (runnerAngle - g.spawnRunnerAngle);
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        drawGrain(x, y, size, 1);
      }

      for (const d of dust) {
        const age = nowMs - d.spawnMs;
        const alpha = Math.max(0, 1 - age / DUST_FADE_MS);
        if (alpha <= 0) continue;
        drawGrain(d.x, d.y, DUST_SIZE_PX, alpha * 0.9);
      }
    };

    const step = (nowMs: number) => {
      // spawn grain feed — if the field was off-screen and paused long
      // enough that many spawns were missed, fast-forward the schedule
      // instead of catching up a runaway burst in one frame
      if (nowMs - nextSpawnMs > SPAWN_INTERVAL_MS * 4) {
        nextSpawnMs = nowMs - SPAWN_INTERVAL_MS;
      }
      while (nowMs >= nextSpawnMs) {
        grains.push({
          spawnMs: nextSpawnMs,
          spawnAngle: rand() * Math.PI * 2,
          spawnRunnerAngle: (nextSpawnMs / 1000) * RUNNER_ANGULAR_RATE,
        });
        nextSpawnMs += SPAWN_INTERVAL_MS;
      }
      // mature grains -> dust at the rim
      const kept: Grain[] = [];
      for (const g of grains) {
        const elapsed = nowMs - g.spawnMs;
        if (elapsed >= travelMs) {
          const runnerAngle = (nowMs / 1000) * RUNNER_ANGULAR_RATE;
          const angle = g.spawnAngle + ANGULAR_COUPLE * (runnerAngle - g.spawnRunnerAngle);
          const x = cx + Math.cos(angle) * stoneR;
          const y = cy + Math.sin(angle) * stoneR;
          spawnDust(x, y, nowMs);
        } else {
          kept.push(g);
        }
      }
      grains = kept;
      // cull expired dust
      dust = dust.filter((d) => nowMs - d.spawnMs < DUST_FADE_MS);
    };

    // -- absolute rAF timestamps throughout (never elapsed-since-mount): a
    // pause/resume via IntersectionObserver never has to rewind or offset a
    // clock, so grain spawnMs values stay valid and progress never goes
    // negative across a visibility gap ----------------------------------------
    const loop = (nowMs: number) => {
      if (!visible) {
        raf = 0;
        return;
      }
      step(nowMs);
      const runnerAngle = (nowMs / 1000) * RUNNER_ANGULAR_RATE;
      render(nowMs, runnerAngle);
      raf = requestAnimationFrame(loop);
    };

    const drawReducedFrame = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (w <= 0 || h <= 0 || stoneR <= 0) return;
      // deliberately chosen NON-t0 most-structured frame: runner offset from
      // the bedstone (visible cross-hatch, not full alignment), one grain
      // mid-grind, one dust puff mid-fade — the whole process visible at once
      const runnerAngle = (18 * Math.PI) / 180;
      drawFurrows(runnerAngle);
      const progress = 0.6;
      const eased = Math.pow(progress, EASE_EXP);
      const r = eyeR + (stoneR - eyeR) * eased;
      const size = SIZE_EYE_PX + (SIZE_RIM_PX - SIZE_EYE_PX) * progress;
      const angle = Math.PI * 0.35;
      drawGrain(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, size, 1);
      const dustAngle = Math.PI * 1.2;
      drawGrain(cx + Math.cos(dustAngle) * stoneR, cy + Math.sin(dustAngle) * stoneR, DUST_SIZE_PX, 0.45);
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      dpr = Math.min(1.5, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      cx = w / 2;
      cy = h / 2;
      stoneR = Math.min(w, h) * STONE_RADIUS_RATIO;
      eyeR = stoneR * EYE_RADIUS_RATIO;
      // duration scales with stone radius (not a fixed px/s divisor) so a
      // card-sized instance still reads a full ~4.5s transit at the 240px
      // reference radius rather than a formula-derived crawl
      travelMs = Math.min(
        MAX_TRAVEL_MS,
        Math.max(MIN_TRAVEL_MS, BASE_TRAVEL_MS * (stoneR / BASE_STONE_RADIUS || 1))
      );
      bedPath = buildFurrowPath(BEDSTONE_FURROW_COUNT, -1);
      runnerPath = buildFurrowPath(RUNNER_FURROW_COUNT, 1);
      gradient = buildGradient();
      if (reduced) {
        drawReducedFrame();
      } else if (raf === 0 && visible) {
        render(performance.now(), 0);
      }
    };

    resize();

    if (!reduced) {
      raf = requestAnimationFrame(loop);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(root);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (!reduced && visible && raf === 0) {
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(root);

    const mo = new MutationObserver(() => {
      derive();
      gradient = buildGradient();
      if (reduced) drawReducedFrame();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  return (
    <div ref={rootRef} className={`relative overflow-hidden bg-background ${className}`}>
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}
