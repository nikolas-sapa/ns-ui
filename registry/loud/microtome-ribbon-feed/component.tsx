"use client";

import { useEffect, useRef, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// MicrotomeRibbonFeed — a full-bleed hero built on a rotary-microtome
// sectioning mechanic: on every handwheel stroke the block advances onto a
// fixed blade, a paper-thin section is cut, and that fresh section clings to
// the edge of the one before it (surface tension / static cling) — so an
// unbroken RIBBON keeps growing off the blade tip and draping under its own
// weight, rather than a pile of separate slices.
//
// The ribbon is a verlet chain pinned at one end to the blade tip (the only
// fixed point). Every STROKE_INTERVAL a new point is spliced in immediately
// after the anchor — that is the freshly cut section, physically nearest the
// blade — pushing every older point one slot further from the anchor, exactly
// as a real ribbon's oldest sections get shouldered further from the blade by
// everything cut after them. Gravity plus a handful of distance-constraint
// iterations per frame relax the chain into a catenary drape; nothing is
// scripted, the sag is the constraint solve settling.
//
// The block reciprocates on the same STROKE_INTERVAL — down onto the blade
// (cut), a brief dwell (the moment a point is spliced in), then back up
// (return) — so the growth cadence is literally the same clock driving the
// visible stroke, not two independent timers that happen to agree.
// ---------------------------------------------------------------------------

const STROKE_INTERVAL_S = 1.4; // s per handwheel stroke (advance + cut + return)
const DWELL_PHASE = 0.5; // fraction of the stroke where the blade contacts and a section is cut
const MAX_SEGMENTS = 60; // ribbon cap before it lifts away and the cycle resets
const FADE_S = 2; // lift-away fade duration once the cap is hit
const GRAVITY_PX_S2 = 900; // simulated drape gravity, in reference (1080-tall) px
const CONSTRAINT_ITERS = 4;
const DAMPING = 0.985; // verlet velocity retention per substep
const SUBSTEP = 1 / 90;
const REF_DIM = 1080; // reference container dimension the px constants below are tuned at
const SEG_LEN_REF = 6; // px per ribbon segment at REF_DIM
const BLOCK_TRAVEL_REF = 46; // px block bob distance at REF_DIM
const POINTER_RADIUS_REF = 90; // px, pointer sway/glint influence radius at REF_DIM
const POINTER_FORCE = 5.5; // px/s^2-ish nudge applied to points inside the radius
const STATIC_TIME_S = 22 * STROKE_INTERVAL_S + STROKE_INTERVAL_S * DWELL_PHASE + 0.2; // ~31.5s — 22 settled segments, a 23rd about to be cut, block at dwell

interface Pt {
  x: number;
  y: number;
  px: number;
  py: number;
}

export interface MicrotomeRibbonFeedProps {
  /** content rendered over the ribbon, e.g. an eyebrow, headline and CTA */
  children?: ReactNode;
  className?: string;
}

export function MicrotomeRibbonFeed({
  children,
  className = "",
}: MicrotomeRibbonFeedProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // -- token-derived ink, read at mount and re-derived on theme flip ------
    let fg = "rgb(237,237,237)";
    let muted = "rgb(110,110,110)";
    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      fg = cs.getPropertyValue("--foreground").trim() || fg;
      muted = cs.getPropertyValue("--ns-muted").trim() || muted;
    };
    readTokens();

    // -- hot-path state: locals only, never React state ---------------------
    let w = 0;
    let h = 0;
    let dpr = 1;
    let scale = 1; // min(w,h) / REF_DIM — every px constant above is multiplied by this
    let anchorX = 0;
    let anchorY = 0;
    let sized = false;
    let paused = false;
    let reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let points: Pt[] = [];
    let simTime = 0;
    let strokeClock = 0;
    let cutThisStroke = false;
    let fadeStart = -Infinity; // simTime the cap-fade began, -Infinity = not fading

    let ptrX = -1e5;
    let ptrY = -1e5;
    let havePtr = false;

    const segLen = () => SEG_LEN_REF * scale;

    const resetRibbon = () => {
      points = [{ x: anchorX, y: anchorY, px: anchorX, py: anchorY }];
      fadeStart = -Infinity;
    };

    const spliceNewSegment = () => {
      const anchor = points[0]!;
      const next: Pt = { x: anchor.x, y: anchor.y, px: anchor.x, py: anchor.y };
      points.splice(1, 0, next);
      if (points.length - 1 >= MAX_SEGMENTS) {
        fadeStart = simTime;
      }
    };

    const applyPointerSway = (dt: number) => {
      if (!havePtr) return;
      const r = POINTER_RADIUS_REF * scale;
      for (let i = 1; i < points.length; i++) {
        const p = points[i]!;
        const dx = p.x - ptrX;
        const dy = p.y - ptrY;
        const dist2 = dx * dx + dy * dy;
        if (dist2 > r * r || dist2 < 1) continue;
        const dist = Math.sqrt(dist2);
        const falloff = 1 - dist / r;
        const push = (POINTER_FORCE * scale * falloff * falloff) * dt;
        p.x += (dx / dist) * push;
      }
    };

    const stepChain = (dt: number) => {
      // gravity + damping (verlet)
      for (let i = 1; i < points.length; i++) {
        const p = points[i]!;
        const vx = (p.x - p.px) * DAMPING;
        const vy = (p.y - p.py) * DAMPING;
        p.px = p.x;
        p.py = p.y;
        p.x += vx;
        p.y += vy + GRAVITY_PX_S2 * scale * dt * dt;
      }
      applyPointerSway(dt);
      // distance constraints, anchor pinned
      const L = segLen();
      for (let iter = 0; iter < CONSTRAINT_ITERS; iter++) {
        for (let i = 0; i < points.length - 1; i++) {
          const a = points[i]!;
          const b = points[i + 1]!;
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 1e-4) dist = 1e-4;
          const diff = (dist - L) / dist;
          const ax = i === 0 ? 0 : 0.5;
          const bx = i === 0 ? 1 : 0.5;
          a.x += dx * diff * ax;
          a.y += dy * diff * ax;
          b.x -= dx * diff * bx;
          b.y -= dy * diff * bx;
        }
        points[0]!.x = anchorX;
        points[0]!.y = anchorY;
      }
    };

    // one deterministic tick: advances the stroke clock, splices a segment at
    // dwell, relaxes the chain, and resets past the cap-fade — identical for
    // both the live rAF loop and the reduced-motion replay.
    const tick = (dt: number) => {
      simTime += dt;
      const prevStrokeClock = strokeClock;
      strokeClock = (strokeClock + dt / STROKE_INTERVAL_S) % 1;
      const wrapped = strokeClock < prevStrokeClock;
      if (wrapped) cutThisStroke = false;
      if (!cutThisStroke && strokeClock >= DWELL_PHASE) {
        cutThisStroke = true;
        if (fadeStart === -Infinity) spliceNewSegment();
      }
      if (fadeStart !== -Infinity && simTime - fadeStart >= FADE_S) {
        resetRibbon();
      }
      stepChain(dt);
    };

    // block reciprocation, purely a function of the stroke clock — no extra
    // state, so it can never drift out of sync with the cut cadence.
    const blockOffset = () => {
      // 0 -> DWELL_PHASE: descend onto the blade (cut). DWELL_PHASE -> 1: return.
      if (strokeClock <= DWELL_PHASE) {
        const t = strokeClock / DWELL_PHASE;
        return Math.sin((t * Math.PI) / 2); // eased down-stroke
      }
      const t = (strokeClock - DWELL_PHASE) / (1 - DWELL_PHASE);
      return 1 - Math.sin((t * Math.PI) / 2); // eased return
    };

    const drawBlock = () => {
      const travel = BLOCK_TRAVEL_REF * scale;
      const bw = 0.16 * Math.min(w, h);
      const bh = 0.11 * Math.min(w, h);
      const bx = anchorX - bw / 2;
      const by = anchorY - bh - 10 * scale - travel * (1 - blockOffset());
      ctx.fillStyle = fg;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(bx, by, bw, bh);
      // a slightly dimmer side face for a hint of dimensionality — value only
      ctx.globalAlpha = 0.55;
      ctx.fillRect(bx + bw, by + bh * 0.28, bw * 0.16, bh * 0.72);
      ctx.globalAlpha = 1;
    };

    const drawBlade = () => {
      const bladeLen = 0.42 * Math.min(w, h);
      ctx.strokeStyle = fg;
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = Math.max(1.25, 1.6 * scale);
      ctx.beginPath();
      ctx.moveTo(anchorX - bladeLen * 0.18, anchorY + 2 * scale);
      ctx.lineTo(anchorX + bladeLen, anchorY - bladeLen * 0.1);
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    const drawRibbon = () => {
      if (points.length < 2) return;
      let alpha = 1;
      if (fadeStart !== -Infinity) {
        alpha = Math.max(0, 1 - (simTime - fadeStart) / FADE_S);
      }
      if (alpha <= 0) return;
      ctx.lineWidth = Math.max(1.4, 2.1 * scale);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = fg;
      ctx.globalAlpha = 0.85 * alpha;
      ctx.beginPath();
      ctx.moveTo(points[0]!.x, points[0]!.y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i]!.x, points[i]!.y);
      ctx.stroke();

      // seam ticks at every joint so consecutive sections read as discrete,
      // not one smooth blur — plus a pointer-proximity brighten, luminance
      // (alpha) only, never a hue mix.
      const r = POINTER_RADIUS_REF * scale;
      for (let i = 1; i < points.length - 1; i++) {
        const p = points[i]!;
        const prev = points[i - 1]!;
        const next = points[i + 1]!;
        const tx = next.x - prev.x;
        const ty = next.y - prev.y;
        const tlen = Math.hypot(tx, ty) || 1;
        const nx = (-ty / tlen) * segLen() * 0.4;
        const ny = (tx / tlen) * segLen() * 0.4;
        let a = 0.35;
        if (havePtr) {
          const d = Math.hypot(p.x - ptrX, p.y - ptrY);
          if (d < r) a = 0.35 + 0.5 * (1 - d / r);
        }
        ctx.strokeStyle = muted;
        ctx.globalAlpha = a * alpha;
        ctx.lineWidth = Math.max(1, 1.1 * scale);
        ctx.beginPath();
        ctx.moveTo(p.x - nx, p.y - ny);
        ctx.lineTo(p.x + nx, p.y + ny);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    const draw = () => {
      if (!sized) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      drawRibbon();
      drawBlade();
      drawBlock();
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      if (w < 2 || h < 2) {
        sized = false;
        return;
      }
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      scale = Math.min(w, h) / REF_DIM;
      anchorX = w * 0.3;
      anchorY = h * 0.24;
      sized = true;
    };

    // -- reduced-motion: deterministic replay, no randomness involved, so
    // stepping the same tick() up to STATIC_TIME_S reproduces the exact
    // frame every time it is called (theme flips, resize) --------------------
    const renderStatic = () => {
      points = [];
      simTime = 0;
      strokeClock = 0;
      cutThisStroke = false;
      resetRibbon();
      let t = 0;
      const dt = SUBSTEP;
      while (t < STATIC_TIME_S) {
        const d = Math.min(dt, STATIC_TIME_S - t);
        tick(d);
        t += d;
      }
      draw();
    };

    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      const dtFrame = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      let remaining = dtFrame;
      while (remaining > 0) {
        const step = Math.min(SUBSTEP, remaining);
        tick(step);
        remaining -= step;
      }
      draw();
      if (!paused) raf = requestAnimationFrame(loop);
    };

    const stopLoop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    };

    const startLoop = () => {
      stopLoop();
      if (paused || !sized) return;
      if (reduced) {
        renderStatic();
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    resize();
    resetRibbon();

    const ro = new ResizeObserver(() => {
      resize();
      // anchor moved — snap existing points toward the new anchor rather
      // than leaving them pinned to stale screen coordinates
      if (points.length) {
        points[0]!.x = anchorX;
        points[0]!.y = anchorY;
      }
      if (reduced) renderStatic();
    });
    ro.observe(root);

    const onThemeChange = () => {
      readTokens();
      if (reduced) draw();
    };
    const mo = new MutationObserver(onThemeChange);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    colorScheme.addEventListener("change", onThemeChange);

    const reducedMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onReducedChange = () => {
      reduced = reducedMq.matches;
      startLoop();
    };
    reducedMq.addEventListener("change", onReducedChange);

    const onVisibility = () => {
      paused = document.hidden;
      startLoop();
    };
    document.addEventListener("visibilitychange", onVisibility);

    let io: IntersectionObserver | undefined;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        paused = !entry.isIntersecting || document.hidden;
        startLoop();
      });
      io.observe(root);
    }

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      ptrX = e.clientX - rect.left;
      ptrY = e.clientY - rect.top;
      havePtr = true;
    };
    const onLeave = () => {
      havePtr = false;
    };
    if (!reduced) {
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerleave", onLeave);
    }

    startLoop();

    return () => {
      stopLoop();
      ro.disconnect();
      mo.disconnect();
      colorScheme.removeEventListener("change", onThemeChange);
      reducedMq.removeEventListener("change", onReducedChange);
      document.removeEventListener("visibilitychange", onVisibility);
      io?.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`relative h-full w-full overflow-hidden bg-background ${className}`}
    >
      <canvas ref={canvasRef} aria-hidden className="block h-full w-full" />
      {children}
    </div>
  );
}
