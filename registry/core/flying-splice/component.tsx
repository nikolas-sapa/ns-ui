"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// FlyingSplice — a logo ribbon whose subject is the flying paster (automatic
// splicer) on a web press, not the ribbon of marks itself. Two roll stands
// sit side by side, occupying the majority of the band's width. The running
// roll unwinds at constant web speed, so its radius falls and its RPM climbs
// continuously (1.06 -> 2.48 rev/s as radius falls 64.6px -> 27.5px at card
// scale). Every 22s the standby roll — already spun up to matched surface
// speed — is pasted onto the web, a knife severs the spent roll, and a fresh
// roll rises into the vacated stand. The ribbon of marks is the OUTPUT the
// rolls feed; it is deliberately the plainer half of this component.
//
// Every visual quantity is a pure, closed-form function of absolute time —
// never a per-frame accumulator — because prefers-reduced-motion has to
// render exactly t=22.09s byte-stably without simulating 22 seconds at
// mount, and because the two integrals involved (radius under constant web
// speed, and quadratic-ease angular spin-up/spin-down) both have exact
// closed forms:
//   r(t)     = sqrt(R_max^2 - B*t),          B = (R_max^2 - R_splice^2)/22
//   theta(t) = 2*v*(R_max - r(t)) / B         (exact integral of omega = v/r)
// A single 22s cycle is split into two roles per stand (running / standby)
// that swap on cycle parity, so the roll that WAS running becomes, at the
// instant of the splice, the "just-spent" stand playing the knife/drop/rise
// choreography, while the roll that WAS standby continues unwinding as the
// new running roll — no special-casing, the running-roll radius/angle
// formulas already start correctly at R_max/0 when a fresh cycle begins.
// ---------------------------------------------------------------------------

export interface FlyingSpliceProps {
  /** Freezes the mechanism on the composed reduced-motion still frame. */
  paused?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

type RGB = [number, number, number];

function parseHex(raw: string): RGB | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
function mixRGB(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
function luminance([r, g, b]: RGB): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function rgbCss([r, g, b]: RGB, a = 1): string {
  return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`;
}
// Neutral achromatic mixing points only — never a sourced or fallback colour,
// just the poles used to lighten/darken a token-derived value (same pattern
// weld-pool uses for its ramp).
const BLACK: RGB = [0, 0, 0];
const WHITE: RGB = [1, 1, 1];

const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

// Closed-form angle swept by omega(tau) = omega0 * (1 - (1-tau)^2), tau in [0,1]
// — the quadratic ease-out spin-up curve, integrated exactly.
function angleEaseOut(tau: number, omega0: number, duration: number): number {
  const u = clamp01(tau);
  return omega0 * duration * (u + Math.pow(1 - u, 3) / 3 - 1 / 3);
}
// Closed-form angle swept by omega(tau) = omega0 * (1-tau)^2, tau in [0,1]
// — the quadratic ease-in spin-down (decel) curve, integrated exactly.
function angleEaseIn(tau: number, omega0: number, duration: number): number {
  const u = clamp01(tau);
  return omega0 * duration * (1 / 3 - Math.pow(1 - u, 3) / 3);
}

// mulberry32 — deterministic seeded PRNG so the mark pattern is identical on
// every mount/render, which prefers-reduced-motion's byte-stability needs.
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

// --- cycle timing (seconds), all named so a reviewer can check them against
// the spec directly ------------------------------------------------------
const CYCLE = 22.0; // unbounded, never terminating
const SPINUP_DUR = 3.4;
const SPINUP_START = CYCLE - SPINUP_DUR; // 18.6
const ARM_DUR = 0.18; // arm swings 26deg, completing contact at wrap (t=22.0)
const ARM_ANGLE_DEG = 26;
// Knife fire is specced as "90ms after paster contact" AND the static frame
// at STATIC_TIME=22.09 (90ms into the new cycle) is specced as "mid-sweep".
// A 120ms sweep starting exactly at 90ms is only just beginning, not mid —
// so the sweep window is centred on 90ms rather than started there,
// reconciling both numbers instead of silently dropping one.
const KNIFE_DUR = 0.12;
const KNIFE_START = 0.09 - KNIFE_DUR / 2; // 0.03
const ARM_HOLD_END = KNIFE_START + KNIFE_DUR + 0.05; // 0.2 — arm retracts shortly after
const DECEL_START = KNIFE_START; // roll begins decelerating as the knife touches
const DECEL_DUR = 1.1;
const DROP_START = DECEL_START + DECEL_DUR; // 1.13
const DROP_DUR = 0.4;
const RISE_START = DROP_START + DROP_DUR + 0.9; // 2.43
const RISE_DUR = 0.7;
const CHOREO_END = RISE_START + RISE_DUR; // 3.13
const CHEVRON_CROSS = 2.4; // a mark/tape crosses the band in 2.4s
export const STATIC_TIME = CYCLE + 0.09; // 22.09s — 90ms into the new cycle

export function FlyingSplice({ paused = false, className = "", style }: FlyingSpliceProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let disposed = false;
    let raf = 0;
    let running = false;
    let staticMode = false;
    let cssW = 0;
    let cssH = 0;
    let dpr = 1;
    let simTime = 0;
    let lastMs = performance.now();

    // ---- tokens: read before anything paints ----------------------------
    let bg: RGB = [1, 1, 1];
    let fg: RGB = [0.09, 0.09, 0.09];
    let border: RGB = [0.92, 0.92, 0.92];
    let dark = false;
    let colorsReady = false;
    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      bg = parseHex(cs.getPropertyValue("--background")) ?? bg;
      fg = parseHex(cs.getPropertyValue("--foreground")) ?? fg;
      border = parseHex(cs.getPropertyValue("--border")) ?? border;
      dark = luminance(bg) < 0.5;
      colorsReady = true;
    };
    readColors(); // first statement in the effect — no paint precedes this

    const paperColor = () => mixRGB(bg, fg, dark ? 0.16 : 0.1);
    const markColor = () => rgbCss(fg, 0.78);

    // --- seeded mark generator: 3 abstract families (concentric arcs, bar
    // clusters, a lattice), each deterministic per pattern slot -----------
    const rand = mulberry32(0x9e3779b9);
    const markSeeds = Array.from({ length: 16 }, () => ({
      kind: Math.floor(rand() * 3),
      a: rand(),
      b: rand(),
      c: rand(),
    }));

    const drawMark = (
      c: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      size: number,
      seed: { kind: number; a: number; b: number; c: number }
    ) => {
      c.save();
      c.translate(cx, cy);
      c.strokeStyle = markColor();
      c.fillStyle = markColor();
      c.lineWidth = Math.max(1, size * 0.06);
      const r = size / 2;
      if (seed.kind === 0) {
        // concentric arcs
        const n = 3;
        for (let i = 0; i < n; i++) {
          const rr = r * (0.35 + (i / (n - 1)) * 0.65);
          c.beginPath();
          c.arc(0, 0, rr, seed.a * Math.PI * 2, seed.a * Math.PI * 2 + Math.PI * (0.9 + seed.b * 0.6));
          c.stroke();
        }
      } else if (seed.kind === 1) {
        // bar cluster
        const n = 4;
        for (let i = 0; i < n; i++) {
          const h = r * (0.4 + ((seed.a + i * 0.27 + seed.b) % 1) * 1.2);
          const x = -r + (i / (n - 1)) * r * 2;
          c.fillRect(x - size * 0.05, r - h, size * 0.1, h);
        }
      } else {
        // lattice
        const n = 3;
        c.beginPath();
        for (let i = 0; i <= n; i++) {
          const x = -r + (i / n) * r * 2;
          c.moveTo(x, -r);
          c.lineTo(x, r);
        }
        for (let i = 0; i <= n; i++) {
          const y = -r + (i / n) * r * 2;
          c.moveTo(-r, y);
          c.lineTo(r, y);
        }
        c.stroke();
      }
      c.restore();
    };

    // ---- geometry ---------------------------------------------------------
    let M = 1;
    let W = 1;
    let H = 1;
    let RMAX = 1;
    let RSPLICE = 1;
    const RSPLICE_RATIO = 27.5 / 64.6; // preserves the spec's radius ratio
    let cy = 0;
    let standAx = 0; // left stand centre x
    let standBx = 0; // right stand centre x
    let nipX = 0;
    let markCount = 9;
    let indexLines = 4;

    const computeGeometry = () => {
      M = Math.min(cssW, cssH);
      W = cssW;
      H = cssH;
      // R_max = 0.19*M is the spec's checkable number at typical/card aspect
      // ratios; the max() with 0.075*W is a floor that only engages on very
      // wide bands, guaranteeing the two-stand cluster clears the spec's
      // hard 30%-of-band-width kill criterion at any aspect ratio rather
      // than only at the one worked example.
      RMAX = Math.max(0.19 * M, 0.075 * W);
      RSPLICE = RMAX * RSPLICE_RATIO;
      cy = H / 2;
      const gap = RMAX * 0.22;
      const marginR = RMAX * 0.18;
      standBx = W - marginR - RMAX;
      standAx = standBx - (2 * RMAX + gap);
      nipX = standAx - RMAX * 1.05;
      markCount = M < 200 ? 6 : 9;
      indexLines = M < 200 ? 3 : 4;
    };

    // ---- pure functions of absolute time ---------------------------------
    const v = () => 0.42 * W; // web speed, px/s
    const spacing = () => 0.155 * W;
    const markSize = () => 0.14 * M;

    const A = () => RMAX * RMAX;
    const B = () => (RMAX * RMAX - RSPLICE * RSPLICE) / CYCLE;

    const radiusAt = (phase: number) => {
      const b = B();
      return Math.sqrt(Math.max(A() - b * phase, RSPLICE * RSPLICE));
    };
    const runAngle = (phase: number) => {
      const b = B();
      if (b <= 0) return 0;
      return (2 * v() * (RMAX - radiusAt(phase))) / b;
    };
    const spinupOmega0 = () => v() / RMAX;
    const spinupTotalAngle = () => angleEaseOut(1, spinupOmega0(), SPINUP_DUR);
    const decelOmega0 = () => v() / RSPLICE;

    interface StandState {
      visible: boolean;
      radius: number;
      angle: number;
      offsetY: number;
      opacity: number;
    }

    // role: true = running this cycle, for a given absolute time t.
    const standState = (running: boolean, cycle: number, phase: number): StandState => {
      if (running) {
        const angle = spinupTotalAngle() + runAngle(phase);
        return { visible: true, radius: radiusAt(phase), angle, offsetY: 0, opacity: 1 };
      }
      // standby role this cycle
      if (cycle > 0 && phase < CHOREO_END) {
        const totalAtCut = spinupTotalAngle() + runAngle(CYCLE);
        const omegaOld = decelOmega0();
        if (phase < DECEL_START) {
          return {
            visible: true,
            radius: RSPLICE,
            angle: totalAtCut + omegaOld * phase,
            offsetY: 0,
            opacity: 1,
          };
        }
        if (phase < DROP_START) {
          const tau = (phase - DECEL_START) / DECEL_DUR;
          return {
            visible: true,
            radius: RSPLICE,
            angle: totalAtCut + omegaOld * DECEL_START + angleEaseIn(tau, omegaOld, DECEL_DUR),
            offsetY: 0,
            opacity: 1,
          };
        }
        if (phase < DROP_START + DROP_DUR) {
          const tau = clamp01((phase - DROP_START) / DROP_DUR);
          return {
            visible: true,
            radius: RSPLICE,
            angle: totalAtCut + omegaOld * DECEL_START + angleEaseIn(1, omegaOld, DECEL_DUR),
            offsetY: easeOutQuad(tau) * RMAX * 1.4,
            opacity: 1 - tau,
          };
        }
        if (phase < RISE_START) {
          return { visible: false, radius: RMAX, angle: 0, offsetY: RMAX * 1.4, opacity: 0 };
        }
        if (phase < CHOREO_END) {
          const tau = clamp01((phase - RISE_START) / RISE_DUR);
          return {
            visible: true,
            radius: RMAX,
            angle: 0,
            offsetY: (1 - easeOutQuad(tau)) * RMAX * 1.4,
            opacity: tau,
          };
        }
      }
      if (phase >= SPINUP_START) {
        const tau = (phase - SPINUP_START) / SPINUP_DUR;
        return {
          visible: true,
          radius: RMAX,
          angle: angleEaseOut(tau, spinupOmega0(), SPINUP_DUR),
          offsetY: 0,
          opacity: 1,
        };
      }
      return { visible: true, radius: RMAX, angle: 0, offsetY: 0, opacity: 1 };
    };

    // arm swing: completes contact exactly at the wrap (t = k*CYCLE), held
    // briefly into the new cycle, then retracted for the rest of the cycle.
    const armProgress = (cycle: number, phase: number) => {
      if (phase >= CYCLE - ARM_DUR) return easeOutQuad((phase - (CYCLE - ARM_DUR)) / ARM_DUR);
      if (cycle > 0 && phase < ARM_HOLD_END) return 1;
      return 0;
    };
    const knifeProgress = (cycle: number, phase: number) => {
      if (cycle > 0 && phase >= KNIFE_START && phase < KNIFE_START + KNIFE_DUR) {
        return (phase - KNIFE_START) / KNIFE_DUR;
      }
      return -1;
    };

    // ---- draw --------------------------------------------------------------
    const drawRoll = (
      c: CanvasRenderingContext2D,
      x: number,
      state: StandState
    ) => {
      if (!state.visible || state.opacity <= 0.01) return;
      const py = cy + state.offsetY;
      c.save();
      c.globalAlpha = state.opacity;
      const base = paperColor();
      const hi = mixRGB(base, WHITE, 0.14);
      const lo = mixRGB(base, BLACK, 0.14);
      // single-lamp Lambert shade: a radial gradient whose centre is offset
      // toward the light azimuth (118deg), i.e. the classic sphere-shading
      // trick, cheap in 2D canvas and value-only (no hue).
      const az = (118 * Math.PI) / 180;
      const gx = x + Math.cos(az) * state.radius * 0.55;
      const gy = py + Math.sin(az) * state.radius * 0.55;
      const grad = c.createRadialGradient(gx, gy, state.radius * 0.05, x, py, state.radius * 1.05);
      grad.addColorStop(0, rgbCss(hi));
      grad.addColorStop(0.55, rgbCss(base));
      grad.addColorStop(1, rgbCss(lo));
      c.beginPath();
      c.arc(x, py, state.radius, 0, Math.PI * 2);
      c.fillStyle = grad;
      c.fill();
      // wrap edge = the outer boundary itself; it recedes toward the core as
      // radius falls, which is the entire "aliveness" of the shot.
      c.lineWidth = Math.max(1, state.radius * 0.02);
      c.strokeStyle = rgbCss(lo, 0.9);
      c.stroke();
      // fine paper-layer banding: sparse concentric rings, not the spec's
      // literal micro-period (impractical to render distinctly at this
      // scale and cost), tuned for a visible "wound paper" read instead.
      const rings = Math.min(14, Math.max(4, Math.round(state.radius / 8)));
      c.lineWidth = 1;
      for (let i = 1; i < rings; i++) {
        const rr = (state.radius * i) / rings;
        c.beginPath();
        c.arc(x, py, rr, 0, Math.PI * 2);
        c.strokeStyle = rgbCss(i % 2 === 0 ? hi : lo, 0.12);
        c.stroke();
      }
      // radial index lines — what makes rotation and RPM legible.
      c.strokeStyle = rgbCss(fg, dark ? 0.55 : 0.4);
      c.lineWidth = Math.max(1, state.radius * 0.035);
      for (let i = 0; i < indexLines; i++) {
        const a = state.angle + (i / indexLines) * Math.PI * 2;
        c.beginPath();
        c.moveTo(x, py);
        c.lineTo(x + Math.cos(a) * state.radius * 0.92, py + Math.sin(a) * state.radius * 0.92);
        c.stroke();
      }
      c.restore();
    };

    const draw = () => {
      if (!colorsReady || cssW <= 0 || cssH <= 0) return;
      const t = staticMode ? STATIC_TIME : simTime;
      const cycle = Math.floor(t / CYCLE);
      const phase = t - cycle * CYCLE;
      const runningIsA = cycle % 2 === 0;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, cssW, cssH);

      // band separator hairlines — the only legitimate use of --border here.
      ctx.strokeStyle = rgbCss(border);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 0.5);
      ctx.lineTo(cssW, 0.5);
      ctx.moveTo(0, cssH - 0.5);
      ctx.lineTo(cssW, cssH - 0.5);
      ctx.stroke();

      // ribbon of marks, spawned at the nip and scrolling left at v(t).
      const spc = spacing();
      const ms = markSize();
      const speed = v();
      const firstX = nipX - ((speed * t) % spc);
      let step = 0;
      for (let x = firstX; x > -ms; x -= spc) {
        step += 1;
        const slot = ((Math.round((nipX - x) / spc) % markCount) + markCount) % markCount;
        const seed = markSeeds[slot % markSeeds.length];
        drawMark(ctx, x, cy, ms, seed);
        if (step > 200) break; // pathological-width safety, never hit in practice
      }

      // chevron splice tape: the component's climactic moment — never
      // accent, a duller band with a brighter leading hairline.
      if (cycle > 0 && phase < CHEVRON_CROSS) {
        const tapeX = nipX - speed * phase;
        const tapeW = 0.03 * W;
        const base = paperColor();
        const tapeCol = mixRGB(base, BLACK, 0.14);
        const hairline = mixRGB(base, WHITE, 0.09);
        const bandH = ms * 1.6;
        for (const sign of [-1, 1]) {
          ctx.save();
          ctx.translate(tapeX, cy);
          ctx.rotate((sign * 34 * Math.PI) / 180);
          ctx.fillStyle = rgbCss(tapeCol, 0.9);
          ctx.fillRect(-tapeW / 2, -bandH, tapeW, bandH * 2);
          ctx.fillStyle = rgbCss(hairline, 0.85);
          ctx.fillRect(tapeW / 2 - Math.max(1, tapeW * 0.08), -bandH, Math.max(1, tapeW * 0.08), bandH * 2);
          ctx.restore();
        }
      }

      // two roll stands.
      const stateA = standState(runningIsA, cycle, phase);
      const stateB = standState(!runningIsA, cycle, phase);
      drawRoll(ctx, standAx, stateA);
      drawRoll(ctx, standBx, stateB);

      // paster arm + knife, shared mechanism at the nip.
      const arm = armProgress(cycle, phase);
      if (arm > 0.001) {
        ctx.save();
        ctx.translate(nipX + RMAX * 0.15, cy - RMAX * 0.9);
        ctx.rotate(((-ARM_ANGLE_DEG * arm) * Math.PI) / 180);
        ctx.strokeStyle = rgbCss(fg, 0.9);
        ctx.lineWidth = Math.max(2, RMAX * 0.05);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, RMAX * 0.85);
        ctx.stroke();
        // a single value-only bevel highlight, never a hue.
        ctx.strokeStyle = rgbCss(mixRGB(fg, WHITE, 0.22), 0.6);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(1, 4);
        ctx.lineTo(1, RMAX * 0.8);
        ctx.stroke();
        ctx.restore();
      }
      const knife = knifeProgress(cycle, phase);
      if (knife >= 0) {
        const ky = cy - RMAX * 0.7 + knife * RMAX * 1.4;
        ctx.save();
        ctx.strokeStyle = rgbCss(fg, 0.95);
        ctx.lineWidth = Math.max(2, RMAX * 0.045);
        ctx.beginPath();
        ctx.moveTo(nipX - RMAX * 0.25, ky);
        ctx.lineTo(nipX + RMAX * 0.35, ky);
        ctx.stroke();
        ctx.strokeStyle = rgbCss(mixRGB(fg, WHITE, 0.22), 0.7);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(nipX - RMAX * 0.25, ky - 1);
        ctx.lineTo(nipX + RMAX * 0.35, ky - 1);
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
    };

    const loop = (nowMs: number) => {
      const dt = Math.min(0.05, Math.max(0, (nowMs - lastMs) / 1000));
      lastMs = nowMs;
      simTime += dt;
      draw();
      raf = requestAnimationFrame(loop);
    };
    const wake = () => {
      if (running || disposed) return;
      running = true;
      lastMs = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const sleep = () => {
      cancelAnimationFrame(raf);
      running = false;
    };

    const applyBacking = () => {
      if (cssW < 2 || cssH < 2) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pw = Math.round(cssW * dpr);
      const ph = Math.round(cssH * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      draw();
    };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      cssW = rect.width;
      cssH = rect.height;
      computeGeometry();
      applyBacking();
      draw();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize(); // ResizeObserver's initial fire path also lands after readColors() above

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;
    const applyMode = () => {
      if (reduced || pausedRef.current) {
        staticMode = true;
        sleep();
        draw();
      } else {
        staticMode = false;
        wake();
      }
    };
    const onMq = () => {
      reduced = mq.matches;
      applyMode();
    };
    mq.addEventListener("change", onMq);

    let onScreen = true;
    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((en) => en.isIntersecting);
        if (!onScreen) sleep();
        else if (!staticMode && !document.hidden) wake(); // resume path — colors already read at mount
      },
      { threshold: 0 }
    );
    io.observe(wrap);

    const onVis = () => {
      if (document.hidden) sleep();
      else if (!staticMode && onScreen) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    const themeObserver = new MutationObserver(() => {
      readColors();
      draw();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    let lastPolledPaused = pausedRef.current;
    let poll = 0;
    const tick = () => {
      if (pausedRef.current !== lastPolledPaused) {
        lastPolledPaused = pausedRef.current;
        applyMode();
      }
      poll = window.setTimeout(tick, 140);
    };
    tick();

    applyMode();

    return () => {
      disposed = true;
      ro.disconnect();
      io.disconnect();
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
      themeObserver.disconnect();
      window.clearTimeout(poll);
      sleep();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`relative h-full w-full overflow-hidden bg-background ${className}`}
      style={style}
      role="img"
      aria-label="Two paper rolls feeding a ribbon of placeholder logo marks, the running roll shrinking and spinning faster until a splice hands off to the standby roll"
    >
      <canvas ref={canvasRef} aria-hidden="true" className="block h-full w-full" />
    </div>
  );
}

FlyingSplice.displayName = "FlyingSplice";
