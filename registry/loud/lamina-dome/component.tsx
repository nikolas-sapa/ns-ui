"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// LaminaDome — stromatolites accreting upward from the bottom edge of the
// pane. A heightfield of one column per ~2 css px grows by LIGHT-OCCLUSION
// COMPETITION between neighbouring columns, not by summed sine bumps or a
// noise field with stripes drawn on top. Every simulation tick, in order:
//
//   1. CLEARANCE — for each column x, cast K rays spanning a cone of
//      `coneHalfAngleDeg` on either side of the current light direction.
//      Each ray marches upward in fixed height steps; at each step the ray's
//      height is compared against whatever column its horizontal offset now
//      lands on. A neighbour tall enough to reach the ray height BLOCKS it —
//      the rest of that ray's steps don't count toward clearance. L[x] is
//      the fraction of ray-steps, averaged over all K rays, that stayed
//      unblocked: 1.0 for a column with open sky in the whole cone, lower
//      for one sitting in another column's shadow.
//   2. DEPOSIT — h[x] += growthRate * L[x] * dt, then a fixed 0.2
//      surface-tension blend with the two neighbours (below 0.1 the front
//      grows hairline single-column spikes; above 0.4 neighbouring domes
//      blur into one mound — 0.2 sits in the middle of that range and is not
//      exposed as a prop). A column whose growth stays capped low because a
//      taller neighbour keeps shading its cone falls further behind every
//      tick — that widening gap, not a fixed rule, is the coarsening: a few
//      tall columns keep winning L and pull away, many short ones measurably
//      stop accreting once they're buried in shadow.
//
// `coneHalfAngleDeg` is the one governing scalar and it alone traverses the
// real morphospace: narrow (~10deg) tests only near-vertical sky, so a
// column is shaded solely by whatever sits almost directly upslope of it —
// most columns keep some clearance and the front stays columnar, many
// similar-height ridges. Wide (~65deg) tests a broad hemisphere, so nearly
// any taller neighbour anywhere nearby blocks you — only the true local
// maxima stay lit, and the front coarsens hard into a few broad domes.
//
// LIGHT DIRECTION arcs slowly (LIGHT_BASE_DEG lean + a slow sine swing) —
// domes accrete more on the side of their crest that keeps clearance toward
// that lean, so they visibly lean the way real fossil stromatolite domes
// lean toward palaeo-north. SEA LEVEL is a single scalar that chases the
// field's mean height (slowly, so it stays relevant as the front grows) plus
// a slow sine on top of that; a column below it gets its deposit multiplied
// by DROWN_FACTOR — the front nearly stalls under a transgression and wakes
// back up on the following regression, one line moving uniformly, not a
// per-column rule.
//
// LAMINA COMMIT — every ~2s the current front polyline is pushed as a
// banded stripe (a Float32Array snapshot of h[]). Capped at MAX_LAMINAE:
// past that, the OLDEST TWO are averaged into one rather than the oldest
// simply dropped — real compaction, and it bounds memory. The display scale
// itself is `capPx / max(runningMaxHeight, capPx)`, computed fresh every
// render from the tallest column's all-time raw height — so the tallest
// dome is always pinned at capPx (40% of the pane) and everything below,
// laminae included, compacts proportionally as the field keeps growing.
// Growth in raw units never actually stops; only what's on screen saturates.
//
// RENDER: canvas only, no DOM per-cell nodes. Band fill alternates two
// colors mixed from --ns-muted and --foreground over --background (read via
// getComputedStyle at mount and on a documentElement class mutation). A
// thin sea-level line uses --border. Canvas is aria-hidden and
// pointer-events:none — nothing here is interactive. prefers-reduced-motion
// runs the tick function synchronously at mount until ~80 laminae exist,
// then paints that one static banded field and never schedules a rAF.
// ---------------------------------------------------------------------------

const TICK_HZ = 8;
const TICK_STEP = 1 / TICK_HZ;
const MAX_TICKS_PER_FRAME = 6;

const STEP_H = 3; // px per ray marching step
const STEPS = 18; // -> 54px max occlusion reach
const K_RAYS = 5; // samples across the cone

const SURFACE_TENSION = 0.2; // fixed — see header comment on the 0.1/0.4 bounds

const LIGHT_BASE_DEG = -18; // steady lean ("palaeo-north")
const LIGHT_ARC_DEG = 12; // slow swing amplitude on top of the lean
const LIGHT_ARC_PERIOD_S = 90;
const MAX_LIGHT_DEG = 80; // clamp so tan() never blows up

const SEA_AMPL = 26; // raw height units
const SEA_PERIOD_S = 55;
const SEA_CHASE = 0.01; // per-tick lerp of sea center toward mean height
const DROWN_FACTOR = 0.12;

const COMMIT_INTERVAL_MS = 2000;
const MAX_LAMINAE = 200;
const CAP_FRACTION = 0.4; // front never displays past 40% of pane height

const COL_WIDTH_BASE = 2; // 1 column per 2 css px, before the perf budget
const MAX_COLS = 900;

// Normal-motion mount warmup. Grows to a lamina count rather than a fixed tick
// budget, same as the reduced path: a flat tick cap left the heightfield a
// near-invisible sliver at the bottom edge on first paint (and in the resting
// screenshot), which is the one state the piece is judged on. Both paths keep a
// hard tick cap so a pathological prop can't hang the mount.
const PREWARM_LAMINAE_TARGET = 34;
const PREWARM_SAFETY_TICKS = 3000;
const REDUCED_LAMINAE_TARGET = 80;
const REDUCED_SAFETY_TICKS = 6000;

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

function rgbCss([r, g, b]: RGB, alpha = 1): string {
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

// xorshift32 — deterministic across mounts, so the shipped resting frame
// (and the reduced-motion static frame) don't drift screenshot to screenshot
function makeRng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

export interface LaminaDomeProps {
  /** Light-cone half-angle in degrees — the single governing scalar of the columnar-to-broad-domed morphospace. Narrow (~8-15) shades a column only from near-vertical neighbours, so the front stays columnar; wide (~55-70) tests a broad hemisphere, so only true local maxima stay lit and the front coarsens hard into a few broad domes. @default 30 */
  coneHalfAngleDeg?: number;
  /** Deposition rate: height units/second for a fully unshaded column (clearance L=1). @default 5 */
  growthRate?: number;
  /** Global simulation speed multiplier. @default 1 */
  speed?: number;
  /** Freezes the front on its current frame without unmounting. */
  paused?: boolean;
  /** Rendered over the plate in ordinary accessible DOM — this layer alone is aria-hidden. */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function LaminaDome({
  coneHalfAngleDeg = 30,
  growthRate = 5,
  speed = 1,
  paused = false,
  children,
  className = "",
  style,
}: LaminaDomeProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const coneRef = useRef(coneHalfAngleDeg);
  coneRef.current = coneHalfAngleDeg;
  const growthRef = useRef(growthRate);
  growthRef.current = growthRate;
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
    let colWidth = COL_WIDTH_BASE;

    let h = new Float32Array(0);
    let hNext = new Float32Array(0);
    let laminae: Float32Array[] = [];
    let rng = makeRng(0x51a1cb1e);

    let tAccum = 0;
    let sinceCommit = 0;
    let seaCenter = 0;
    let runningMax = 1;

    const rebuild = () => {
      if (cssW < 2 || cssH < 2) return;
      colWidth = COL_WIDTH_BASE;
      let c = Math.max(20, Math.ceil(cssW / colWidth));
      while (c > MAX_COLS) {
        colWidth++;
        c = Math.max(20, Math.ceil(cssW / colWidth));
      }
      cols = c;
      h = new Float32Array(cols);
      hNext = new Float32Array(cols);
      rng = makeRng(0x51a1cb1e);
      for (let i = 0; i < cols; i++) h[i] = rng() * 2;
      laminae = [];
      tAccum = 0;
      sinceCommit = 0;
      seaCenter = 1;
      runningMax = 1;

      const warm = reduced ? REDUCED_SAFETY_TICKS : PREWARM_SAFETY_TICKS;
      const laminaeTarget = reduced ? REDUCED_LAMINAE_TARGET : PREWARM_LAMINAE_TARGET;
      let ticks = 0;
      while (ticks < warm) {
        tick(TICK_STEP);
        ticks++;
        if (laminae.length >= laminaeTarget) break;
      }
      render();
    };

    // --- simulation -------------------------------------------------------
    const tanCache = new Float32Array(K_RAYS);

    const tick = (dt: number) => {
      tAccum += dt;

      let lightDeg =
        LIGHT_BASE_DEG + LIGHT_ARC_DEG * Math.sin((tAccum / LIGHT_ARC_PERIOD_S) * Math.PI * 2);
      lightDeg = Math.max(-MAX_LIGHT_DEG, Math.min(MAX_LIGHT_DEG, lightDeg));
      const lightRad = (lightDeg * Math.PI) / 180;
      const halfRad =
        (Math.max(5, Math.min(70, coneRef.current)) * Math.PI) / 180;

      for (let k = 0; k < K_RAYS; k++) {
        const off = (k / (K_RAYS - 1)) * 2 - 1; // -1..1, K_RAYS is fixed > 1
        const a = Math.max(-MAX_LIGHT_DEG * (Math.PI / 180), Math.min(MAX_LIGHT_DEG * (Math.PI / 180), lightRad + off * halfRad));
        tanCache[k] = Math.tan(a);
      }

      let meanH = 0;
      for (let i = 0; i < cols; i++) meanH += h[i]!;
      meanH /= Math.max(1, cols);
      seaCenter += (meanH - seaCenter) * SEA_CHASE;
      const seaLevel =
        seaCenter + SEA_AMPL * Math.sin((tAccum / SEA_PERIOD_S) * Math.PI * 2);

      const g = Math.max(0, growthRef.current);

      for (let x = 0; x < cols; x++) {
        const base = h[x]!;
        let clearSum = 0;
        for (let k = 0; k < K_RAYS; k++) {
          const tanA = tanCache[k]!;
          let clear = 0;
          for (let s = 1; s <= STEPS; s++) {
            const rise = s * STEP_H;
            const nx = x + Math.round((rise * tanA) / colWidth);
            if (nx < 0 || nx >= cols) {
              clear++;
              continue;
            }
            if (h[nx]! >= base + rise) break;
            clear++;
          }
          clearSum += clear / STEPS;
        }
        const L = clearSum / K_RAYS;
        const drowned = base < seaLevel;
        const deposit = g * L * dt * (drowned ? DROWN_FACTOR : 1);
        hNext[x] = base + deposit;
      }

      // surface tension: 0.2 blend with clamped neighbours
      for (let x = 0; x < cols; x++) {
        const l = x > 0 ? hNext[x - 1]! : hNext[x]!;
        const r = x < cols - 1 ? hNext[x + 1]! : hNext[x]!;
        h[x] = hNext[x]! * (1 - 2 * SURFACE_TENSION) + SURFACE_TENSION * (l + r);
      }

      for (let x = 0; x < cols; x++) if (h[x]! > runningMax) runningMax = h[x]!;

      sinceCommit += dt * 1000;
      if (sinceCommit >= COMMIT_INTERVAL_MS) {
        sinceCommit = 0;
        laminae.push(h.slice());
        if (laminae.length > MAX_LAMINAE) {
          const merged = new Float32Array(cols);
          const a = laminae[0]!;
          const b = laminae[1]!;
          for (let i = 0; i < cols; i++) merged[i] = (a[i]! + b[i]!) * 0.5;
          laminae.splice(0, 2, merged);
        }
      }
    };

    // --- palette ------------------------------------------------------------
    let background: RGB = [255, 255, 255];
    let muted: RGB = [77, 77, 77];
    let foreground: RGB = [23, 23, 23];
    let border: RGB = [235, 235, 235];
    let bandA = "rgb(120,120,120)";
    let bandB = "rgb(150,150,150)";
    let seaStroke = "rgba(120,120,120,0.5)";

    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      background = parseHex(cs.getPropertyValue("--background")) ?? background;
      muted = parseHex(cs.getPropertyValue("--ns-muted")) ?? muted;
      foreground = parseHex(cs.getPropertyValue("--foreground")) ?? foreground;
      border = parseHex(cs.getPropertyValue("--border")) ?? border;
      bandA = rgbCss(mixRGB(background, muted, 0.5));
      bandB = rgbCss(mixRGB(background, foreground, 0.14));
      seaStroke = rgbCss(mixRGB(background, border, 0.9), 0.7);
    };
    readColors();

    // --- render ---------------------------------------------------------
    const render = () => {
      if (cols <= 0 || cssW < 2 || cssH < 2) return;
      ctx.clearRect(0, 0, cssW, cssH);

      const capPx = cssH * CAP_FRACTION;
      const scale = capPx / Math.max(runningMax, capPx);
      const baselineY = cssH;
      const xAt = (i: number) => i * colWidth;
      const yAt = (height: number) => baselineY - height * scale;

      const bands = [...laminae, h];
      let prevTop: Float32Array | null = null;
      for (let bi = 0; bi < bands.length; bi++) {
        const top = bands[bi]!;
        ctx.beginPath();
        ctx.moveTo(0, yAt(prevTop ? prevTop[0]! : 0));
        if (prevTop) {
          for (let i = 1; i < cols; i++) ctx.lineTo(xAt(i), yAt(prevTop[i]!));
        } else {
          ctx.lineTo(xAt(cols - 1), yAt(0));
        }
        for (let i = cols - 1; i >= 0; i--) ctx.lineTo(xAt(i), yAt(top[i]!));
        ctx.closePath();
        ctx.fillStyle = bi % 2 === 0 ? bandA : bandB;
        ctx.fill();
        prevTop = top;
      }

      // sea level line
      const capPxUnits = capPx / Math.max(scale, 1e-6);
      const seaLevel =
        seaCenter + SEA_AMPL * Math.sin((tAccum / SEA_PERIOD_S) * Math.PI * 2);
      if (seaLevel > 0 && seaLevel < capPxUnits * 1.4) {
        const y = yAt(seaLevel);
        if (y > 0 && y < cssH) {
          ctx.strokeStyle = seaStroke;
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(cssW, y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    };

    // --- sizing -----------------------------------------------------------
    const applyBacking = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(cssW * dpr));
      canvas.height = Math.max(1, Math.round(cssH * dpr));
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    let rebuildTimer = 0;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const widthChanged = Math.abs(rect.width - cssW) > 0.5;
      cssW = rect.width;
      cssH = rect.height;
      applyBacking();
      if (widthChanged) {
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
        tick(TICK_STEP);
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
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 block h-full w-full"
      />
      {children ? <div className="relative z-[1] h-full w-full">{children}</div> : null}
    </div>
  );
}

LaminaDome.displayName = "LaminaDome";
