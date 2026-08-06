"use client";

import { useEffect, useRef, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// SolargraphHero — hero surface that behaves like a long-exposure photograph:
// cursor movement burns light streaks into offscreen accumulation buffers that
// are never cleared per frame, only decayed on a slow half-life, so the canvas
// builds a "light painting" of the whole session. Persistence, not live
// emission, is the differentiator. Buffers store pure intensity (white ink);
// theme tint is applied at composite time via a source-in pass, so a theme
// flip recolors the entire accumulated exposure instantly. Canvas 2D,
// refs-only hot path, sleeps when the pointer rests and residual energy
// decays under an epsilon.
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

function mix(a: Vec3, b: Vec3, t: number): Vec3 {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function css(c: Vec3): string {
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// deterministic prng — buffer picks + the seeded reduced-motion exposure
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SLEEP_MS = 500; // pointer-idle threshold before the loop may sleep
const ENERGY_EPS = 0.02; // residual-exposure floor — below this, sleep + wipe
const INTRO_MS = 2000; // scripted figure-eight duration on load
// decay is batched over this many seconds of real elapsed time before being
// applied to the buffers. Canvas alpha is an 8-bit channel — the per-frame
// erosion this represents (~0.3% of a stroke's alpha at 60fps) rounds away to
// nothing every single frame, so the buffer never visibly fades. Batching the
// same exponential math over a bigger dt removes enough alpha in one op to
// survive 8-bit rounding, with no change to the actual half-life curve since
// exp(-dt/tau) compounds identically whether applied in small or large steps.
const DECAY_STEP_S = 0.15;

export function SolargraphHero({
  children,
  halfLifeMs = 4000,
  maxStrokeAlpha = 0.35,
  intro = true,
  className = "",
}: {
  /** hero copy / CTAs — rendered above the canvas, fully interactive */
  children?: ReactNode;
  /** exposure decay half-life in ms */
  halfLifeMs?: number;
  /** per-stroke alpha ceiling; repeated passes asymptote instead of whiting out */
  maxStrokeAlpha?: number;
  /** scripted 2s figure-eight on load so the exposure shows before any input */
  intro?: boolean;
  /** extra classes merged onto the rendered root element */
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const vctx = canvas.getContext("2d");
    if (!vctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const tau = Math.max(0.5, halfLifeMs / 1000 / Math.LN2); // ≈ 5.77s at 4s half-life
    const rand = mulberry32(0x50a7);

    // accumulation buffers — never cleared per frame. A holds ~60% of the
    // segments (primary tint), B the rest (secondary tint).
    const bufA = document.createElement("canvas");
    const bufB = document.createElement("canvas");
    const scratch = document.createElement("canvas");
    const actxA = bufA.getContext("2d");
    const actxB = bufB.getContext("2d");
    const sctx = scratch.getContext("2d");
    if (!actxA || !actxB || !sctx) return;

    // -- token-derived tints + blend mode: read at mount, re-derived live ----
    let tintA: Vec3 = [0, 107, 255];
    let tintB: Vec3 = [237, 237, 237];
    const derive = () => {
      const cs = getComputedStyle(document.documentElement);
      const bg = parseColor(cs.getPropertyValue("--background")) ?? [10, 10, 10];
      const fg = parseColor(cs.getPropertyValue("--foreground")) ?? [237, 237, 237];
      const accent = parseColor(cs.getPropertyValue("--ns-accent")) ?? [0, 107, 255];
      const border = parseColor(cs.getPropertyValue("--border")) ?? [46, 46, 46];
      const muted = parseColor(cs.getPropertyValue("--ns-muted")) ?? [143, 143, 143];
      const lum = (0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2]) / 255;
      if (lum < 0.5) {
        // dark: trails lighten the surface — accent-led glow
        tintA = accent;
        tintB = fg;
        canvas.style.mixBlendMode = "screen";
      } else {
        // light: screen would vanish on white — flip to multiply with ink
        // derived from --ns-muted/--border so trails darken instead
        tintA = muted;
        tintB = mix(border, muted, 0.6);
        canvas.style.mixBlendMode = "multiply";
      }
    };
    derive();

    // -- sizing: DPR clamp 2, exposure preserved across resize via copy ------
    let w = 0;
    let h = 0;
    let dpr = 1;
    let W = 0; // device px
    let H = 0;
    let sized = false;
    const resize = () => {
      const rect = root.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        sized = false; // guard zero-size containers — loop no-ops until real
        return;
      }
      w = rect.width;
      h = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const nW = Math.max(1, Math.round(w * dpr));
      const nH = Math.max(1, Math.round(h * dpr));
      const pW = W;
      const pH = H;
      W = nW;
      H = nH;
      canvas.width = W;
      canvas.height = H;
      for (const [buf, ctx] of [
        [bufA, actxA],
        [bufB, actxB],
      ] as const) {
        // snapshot old exposure, resize (clears), paint it back scaled
        if (pW > 0 && pH > 0) {
          scratch.width = pW;
          scratch.height = pH;
          sctx.drawImage(buf, 0, 0);
        }
        buf.width = W;
        buf.height = H;
        if (pW > 0 && pH > 0) ctx.drawImage(scratch, 0, 0, W, H);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      scratch.width = W;
      scratch.height = H;
      sized = true;
    };
    resize();

    const clearBuffers = () => {
      for (const ctx of [actxA, actxB]) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, W, H);
        ctx.restore();
      }
    };

    // framerate-independent decay: destination-out black over the buffer
    const decay = (dt: number) => {
      const a = 1 - Math.exp(-dt / tau);
      for (const ctx of [actxA, actxB]) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = "destination-out";
        ctx.globalAlpha = a;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    };

    // one quadratic segment into a weighted-random buffer. White here is an
    // intensity mask, not ink — display color is applied at composite time.
    const strokeSeg = (
      x0: number,
      y0: number,
      cx: number,
      cy: number,
      x1: number,
      y1: number,
      width: number,
      alpha: number
    ) => {
      const ctx = rand() < 0.6 ? actxA : actxB;
      ctx.save();
      ctx.globalAlpha = alpha; // ceiling — repeated passes asymptote to 1
      ctx.strokeStyle = "#fff";
      ctx.shadowColor = "#fff";
      ctx.shadowBlur = 12;
      ctx.lineCap = "round";
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(cx, cy, x1, y1);
      ctx.stroke();
      ctx.restore();
    };

    // tint each intensity buffer via source-in and stack onto the visible
    // canvas — this IS the recolor pass, so theme flips re-tint the whole
    // accumulated exposure on the very next composite
    const composite = () => {
      if (!sized) return;
      vctx.setTransform(1, 0, 0, 1, 0, 0);
      vctx.clearRect(0, 0, W, H);
      const pairs = [
        [bufA, tintA],
        [bufB, tintB],
      ] as const;
      for (let i = 0; i < 2; i++) {
        const [buf, tint] = pairs[i]!;
        sctx.globalCompositeOperation = "source-over";
        sctx.clearRect(0, 0, W, H);
        sctx.drawImage(buf, 0, 0);
        sctx.globalCompositeOperation = "source-in";
        sctx.fillStyle = css(tint);
        sctx.fillRect(0, 0, W, H);
        vctx.globalCompositeOperation = i === 0 ? "source-over" : "lighter";
        vctx.drawImage(scratch, 0, 0);
      }
      vctx.globalCompositeOperation = "source-over";
    };

    // -- reduced motion: one seeded synthetic exposure, no loop --------------
    const renderStatic = () => {
      if (!sized) return;
      clearBuffers();
      const srand = mulberry32(0x5017);
      const steps = 150;
      let p2x = 0;
      let p2y = 0;
      let px = 0;
      let py = 0;
      for (let i = 0; i <= steps; i++) {
        const th = (i / steps) * Math.PI * 2;
        const x = w / 2 + w * 0.3 * Math.sin(th) + (srand() - 0.5) * 5;
        const y = h / 2 + h * 0.2 * Math.sin(th * 2) + (srand() - 0.5) * 5;
        if (i > 1) {
          strokeSeg(
            (p2x + px) / 2,
            (p2y + py) / 2,
            px,
            py,
            (px + x) / 2,
            (py + y) / 2,
            1.5 + srand(),
            0.14
          );
        }
        p2x = px;
        p2y = py;
        px = x;
        py = y;
      }
      composite();
    };

    if (reduced) {
      renderStatic();
      const ro = new ResizeObserver(() => {
        resize();
        renderStatic();
      });
      ro.observe(root);
      const mo = new MutationObserver(() => {
        derive();
        renderStatic(); // recolor the static exposure for the new theme
      });
      mo.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
      return () => {
        ro.disconnect();
        mo.disconnect();
      };
    }

    // -- hot-path state: locals only, never React state ----------------------
    let raf = 0;
    let last = 0;
    let visible = true;
    let tx = 0; // raw pointer target
    let ty = 0;
    let sx = 0; // smoothed pointer sample
    let sy = 0;
    let px = 0; // previous smoothed sample (control point)
    let py = 0;
    let p2x = 0; // sample before that (segment start midpoint)
    let p2y = 0;
    let hasChain = false;
    let lastMove = -1e9;
    let energy = 0; // running sum of recent stroke alpha, decays with tau
    let introActive = intro;
    let introT0 = -1;
    let decayAccum = 0; // real seconds of decay owed to the buffers, batched

    const loop = (now: number) => {
      raf = 0;
      if (!visible) {
        last = 0;
        return; // paused offscreen — IntersectionObserver wakes us
      }
      if (!sized) {
        last = 0;
        return; // zero-size container — ResizeObserver wakes us when real
      }
      const dt = last === 0 ? 1 / 60 : Math.min(0.05, (now - last) / 1000);
      last = now;

      // scripted figure-eight until it ends or a real pointer takes over
      if (introActive) {
        if (introT0 < 0) introT0 = now;
        const t = (now - introT0) / INTRO_MS;
        if (t >= 1) {
          introActive = false;
          hasChain = false;
        } else {
          const th = t * Math.PI * 2;
          tx = w / 2 + w * 0.3 * Math.sin(th);
          ty = h / 2 + h * 0.2 * Math.sin(th * 2);
          if (!hasChain) {
            sx = px = p2x = tx;
            sy = py = p2y = ty;
            hasChain = true;
          }
          lastMove = now;
        }
      }

      // batch the destination-out erosion — see DECAY_STEP_S above
      decayAccum += dt;
      if (decayAccum >= DECAY_STEP_S) {
        decay(decayAccum);
        decayAccum = 0;
      }
      energy *= Math.exp(-dt / tau);

      if (hasChain) {
        // chase the raw pointer so segments are smoothed, not jittery
        const k = 1 - Math.exp(-dt * 18);
        sx += (tx - sx) * k;
        sy += (ty - sy) * k;
        const dist = Math.hypot(sx - px, sy - py);
        if (dist > 0.75) {
          const speed = dist / dt;
          const lw = 1.5 + Math.min(1.5, Math.max(0, speed / 1200));
          strokeSeg(
            (p2x + px) / 2,
            (p2y + py) / 2,
            px,
            py,
            (px + sx) / 2,
            (py + sy) / 2,
            lw,
            maxStrokeAlpha
          );
          energy = Math.min(4, energy + maxStrokeAlpha);
          p2x = px;
          p2y = py;
          px = sx;
          py = sy;
        }
      }

      composite();

      // sleep: pointer idle past threshold AND residual exposure spent
      if (now - lastMove > SLEEP_MS && energy < ENERGY_EPS) {
        clearBuffers(); // wipe the invisible residue so wake starts clean
        composite();
        energy = 0;
        decayAccum = 0;
        last = 0;
        return; // raf stays 0 — genuinely asleep
      }
      raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const onMove = (e: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      tx = e.clientX - rect.left;
      ty = e.clientY - rect.top;
      introActive = false; // a real cursor takes over the exposure
      if (!hasChain) {
        sx = px = p2x = tx;
        sy = py = p2y = ty;
        hasChain = true;
      }
      lastMove = performance.now();
      wake();
    };
    const onLeave = () => {
      hasChain = false; // break the chain — no streak to the re-entry point
    };

    // -- observers ------------------------------------------------------------
    const ro = new ResizeObserver(() => {
      resize();
      composite();
      wake();
    });
    ro.observe(root);
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) wake();
    });
    io.observe(root);
    // live theme re-derive: watch documentElement class flips; the next
    // composite re-tints the accumulated buffer via the source-in pass
    const mo = new MutationObserver(() => {
      derive();
      composite();
      wake();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    const onVis = () => {
      if (!document.hidden) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerdown", onMove);
    root.addEventListener("pointerleave", onLeave);
    if (intro) wake();

    return () => {
      cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerdown", onMove);
      root.removeEventListener("pointerleave", onLeave);
    };
  }, [halfLifeMs, maxStrokeAlpha, intro]);

  return (
    <div
      ref={rootRef}
      className={`relative isolate overflow-hidden ${className}`}
    >
      {/* exposure layer: pointer-events none — CTAs above stay clickable */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      <div className="relative">{children}</div>
    </div>
  );
}
