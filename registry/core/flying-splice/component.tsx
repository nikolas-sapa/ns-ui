"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// FlyingSplice — a logo ribbon whose subject is the roll stand feeding it, not
// the ribbon of marks itself. ONE stand, one roll, unwinding at constant web
// speed: the roll's radius falls and its RPM climbs continuously as it empties
// (v/r rises as r shrinks), then the radius rebuilds on the exact time-reverse
// of the same schedule while the roll keeps turning the same way. That inverse
// radius/RPM relationship is the whole mechanic; the ribbon of marks is the
// OUTPUT the roll feeds and is deliberately the plainer half of this component.
//
// The cycle wraps by oscillating the radius, not by resetting it: 15s of
// run-down (R_max -> R_min, omega v/R_max -> v/R_min) then 7s of rebuild
// (R_min -> R_max) — so there is never a pop back to a full roll, and never a
// second disc on screen. Angular velocity is omega = v/r throughout, so it is
// continuous at BOTH turning points (both sides evaluate to v/R_min and
// v/R_max respectively); only dr/dt changes sign, and the rebuild is simply
// the same inverse relationship traversed backward.
//
// Every visual quantity is a pure, closed-form function of absolute time —
// never a per-frame accumulator — because prefers-reduced-motion has to render
// exactly t = STATIC_TIME byte-stably without simulating up to it at mount,
// and because the integrals involved have exact closed forms:
//   down: r = sqrt(R_max^2 - B_dn*p),  theta = 2*v*(R_max - r)/B_dn
//   up:   r = sqrt(R_min^2 + B_up*q),  theta = 2*v*(r - R_min)/B_up
// The swept angle accumulates across cycles as `cycle*THETA_CYCLE + theta(p)`
// rather than restarting each cycle, so the index lines do not snap at the
// wrap — with a single persistent roll there is no role swap to hide a reset
// behind.
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
// The roll empties over RUNDOWN_DUR and rebuilds over the remainder. Asymmetric
// on purpose: the run-down is the subject and gets the long, slow read; the
// rebuild is the wrap, and a shorter rebuild keeps it from reading as a second,
// competing event. Both legs share the same sqrt-of-time radius law, so the
// rebuild is the run-down time-reversed rather than an arbitrary eased return.
const RUNDOWN_DUR = 15.0;
const REBUILD_DUR = CYCLE - RUNDOWN_DUR; // 7.0
// Reduced-motion freeze: 65% through the run-down, where the roll is visibly
// part-spent — a clear gap between its wrap edge and the dashed capacity ring,
// index lines already noticeably closer-spaced than on a full roll. Freezing on
// a full roll (the old 22.09s, chosen for a splice that no longer exists) would
// show zero run-down at all.
export const STATIC_TIME = RUNDOWN_DUR * 0.65; // 9.75s

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

    // Paper has to READ as paper against the band: at 0.16 in dark theme the
    // rolls were near-black discs on a near-black band and the whole
    // mechanism was invisible, however correct its motion was.
    const paperColor = () => mixRGB(bg, fg, dark ? 0.34 : 0.13);
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
    let RMIN = 1;
    const RMIN_RATIO = 27.5 / 64.6; // preserves the spec's radius ratio
    let cy = 0;
    let standX = 0; // the stand's centre x
    let nipX = 0;
    let markCount = 9;
    let indexLines = 4;

    const computeGeometry = () => {
      M = Math.min(cssW, cssH);
      W = cssW;
      H = cssH;
      // R_max = 0.19*M is the spec's checkable number at typical aspect
      // ratios; the max() with a fraction of W is a floor that engages on wide
      // bands (card crops especially), where 0.19*M would leave a spent roll
      // too small to read as wound paper. The floor is 0.11*W: with ONE stand
      // the cluster is a single 2*R_max-wide disc, so 0.11*W puts it at 22% of
      // the band — still clear of the 30%-of-band-width kill criterion that
      // the old 0.075*W floor was sized for when two stands shared the space.
      RMAX = Math.max(0.19 * M, 0.11 * W);
      RMIN = RMAX * RMIN_RATIO;
      cy = H / 2;
      const marginR = RMAX * 0.2;
      standX = W - marginR - RMAX;
      nipX = standX - RMAX * 1.05;
      markCount = M < 200 ? 6 : 9;
      indexLines = M < 200 ? 3 : 4;
    };

    // ---- pure functions of absolute time ---------------------------------
    const v = () => 0.42 * W; // web speed, px/s
    const spacing = () => 0.155 * W;
    const markSize = () => 0.14 * M;

    // radius law constants: r^2 is linear in time on both legs, which is what
    // constant web speed off a wound roll actually gives you.
    const BDN = () => (RMAX * RMAX - RMIN * RMIN) / RUNDOWN_DUR;
    const BUP = () => (RMAX * RMAX - RMIN * RMIN) / REBUILD_DUR;

    const radiusAt = (phase: number) => {
      if (phase <= RUNDOWN_DUR) {
        return Math.sqrt(Math.max(RMAX * RMAX - BDN() * phase, RMIN * RMIN));
      }
      const q = Math.min(phase - RUNDOWN_DUR, REBUILD_DUR);
      return Math.sqrt(Math.min(RMIN * RMIN + BUP() * q, RMAX * RMAX));
    };
    // exact integral of omega = v/r on each leg; omega itself is continuous at
    // both turning points (v/RMIN at the bottom, v/RMAX at the wrap), so the
    // index lines never stall, reverse or jump.
    const angleDownTotal = () => (2 * v() * (RMAX - RMIN)) / BDN();
    const angleUpTotal = () => (2 * v() * (RMAX - RMIN)) / BUP();
    const angleAt = (phase: number) => {
      if (phase <= RUNDOWN_DUR) {
        return (2 * v() * (RMAX - radiusAt(phase))) / BDN();
      }
      return angleDownTotal() + (2 * v() * (radiusAt(phase) - RMIN)) / BUP();
    };
    const cycleAngle = () => angleDownTotal() + angleUpTotal();

    interface RollState {
      radius: number;
      angle: number;
    }

    // The single roll's complete state at absolute time t. The swept angle
    // accumulates across cycles rather than restarting, so nothing snaps at the
    // wrap; it is reduced mod 2*PI only at draw time to keep float precision
    // bounded over long sessions.
    const rollState = (t: number): RollState => {
      const cycle = Math.floor(t / CYCLE);
      const phase = t - cycle * CYCLE;
      return {
        radius: radiusAt(phase),
        angle: (cycle * cycleAngle() + angleAt(phase)) % (Math.PI * 2),
      };
    };

    // ---- draw --------------------------------------------------------------
    const drawRoll = (
      c: CanvasRenderingContext2D,
      x: number,
      state: RollState
    ) => {
      const py = cy;
      c.save();
      const base = paperColor();
      const hi = mixRGB(base, WHITE, 0.10);
      const lo = mixRGB(base, BLACK, 0.12);
      // single-lamp Lambert shade: a radial gradient whose centre is offset
      // toward the light azimuth (118deg), i.e. the classic sphere-shading
      // trick, cheap in 2D canvas and value-only (no hue).
      const az = (118 * Math.PI) / 180;
      // a shallow offset: at 0.55 the shading read as a billiard ball rather
      // than as the flat end of a wound coil.
      const gx = x + Math.cos(az) * state.radius * 0.22;
      const gy = py + Math.sin(az) * state.radius * 0.22;
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
        c.strokeStyle = rgbCss(i % 2 === 0 ? hi : lo, 0.3);
        c.stroke();
      }
      // core: a roll of paper has a visible hub, and the hub is what tells
      // you the wrap edge is receding toward it as the roll runs down.
      c.beginPath();
      c.arc(x, py, Math.max(3, state.radius * 0.17), 0, Math.PI * 2);
      c.fillStyle = rgbCss(bg, 0.92);
      c.fill();
      c.lineWidth = 1;
      c.strokeStyle = rgbCss(fg, 0.45);
      c.stroke();

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
      const state = rollState(t);

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

      // The web itself. Without a visible strip of paper leaving the roll
      // there is no ribbon, only marks floating on the band — which is
      // exactly how the first cut read. The web leaves the roll at its wrap
      // edge, so it must end just inside the CURRENT radius: anchored to the
      // stand centre it would jut out past a run-down roll as a bare
      // rectangle, and the strip visibly lengthening as the roll empties is
      // itself part of the run-down read.
      const webEnd = standX - state.radius * 0.35;
      const webH = markSize() * 1.95;
      const paper = paperColor();
      ctx.fillStyle = rgbCss(paper);
      ctx.fillRect(0, cy - webH / 2, webEnd, webH);
      ctx.strokeStyle = rgbCss(mixRGB(paper, BLACK, 0.35), 0.8);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, cy - webH / 2 + 0.5);
      ctx.lineTo(webEnd, cy - webH / 2 + 0.5);
      ctx.moveTo(0, cy + webH / 2 - 0.5);
      ctx.lineTo(webEnd, cy + webH / 2 - 0.5);
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

      // the stand hardware, then the roll sitting on it.
      const footY = cy + RMAX * 1.18;
      ctx.save();
      ctx.strokeStyle = rgbCss(fg, 0.38);
      ctx.lineWidth = Math.max(2, RMAX * 0.06);
      ctx.beginPath();
      ctx.moveTo(standX, cy);
      ctx.lineTo(standX, footY);
      ctx.stroke();
      ctx.lineWidth = Math.max(1, RMAX * 0.045);
      ctx.beginPath();
      ctx.moveTo(standX - RMAX * 0.42, footY);
      ctx.lineTo(standX + RMAX * 0.42, footY);
      ctx.stroke();
      ctx.restore();

      // The stand's capacity ring: a full roll fills it, and the gap between
      // it and the roll's wrap edge IS the run-down, readable in a single
      // still instead of only across the cycle. Its alpha is tied to that gap,
      // so it fades out entirely as the roll fills: at R_max the dashed ring
      // sits directly on the roll's own wrap-edge stroke and the doubled
      // outline reads as a jagged artefact — for the ~2s centred exactly on
      // the wrap, which is the one moment that has to be unobtrusive.
      ctx.save();
      ctx.globalAlpha = 0.5 * ((RMAX - state.radius) / (RMAX - RMIN));
      ctx.setLineDash([3, 5]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgbCss(fg, 0.55);
      ctx.beginPath();
      ctx.arc(standX, cy, RMAX, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      drawRoll(ctx, standX, state);

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
      aria-label="A single paper roll feeding a ribbon of placeholder logo marks, shrinking and spinning faster as it empties, then rebuilding to full and slowing again"
    >
      <canvas ref={canvasRef} aria-hidden="true" className="block h-full w-full" />
    </div>
  );
}

FlyingSplice.displayName = "FlyingSplice";
