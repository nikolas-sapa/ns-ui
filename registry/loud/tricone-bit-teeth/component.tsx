"use client";

import { useEffect, useId, useRef } from "react";

// ---------------------------------------------------------------------------
// TriconeBitTeeth — a full-bleed hero built on a rotary tricone rock bit: the
// three cone cutters at a bit's periphery orbit the borehole axis while each
// spins on its own skewed journal, so their teeth both crush and scrape the
// formation with every pass. Unlike edm-crater-field's steady-state RANDOM
// discharge scatter, this crater field is never diffuse or uniform — every
// dent lands only where a cone's tooth row actually swept, in three
// simultaneous, 120-degree-offset clusters, so the field always reads as a
// RING traced by a rotating tool rather than a pockmarked plate. The bit
// bodies themselves are drawn as visible orbiting wedges so "three cones
// rotating" is legible on its own, independent of the crater ring it leaves.
//
// The real bit rotates around 60-120 RPM and strikes 33 times/lap (3 cones x
// 11 teeth) — both far too fast to paint 1:1 against a 60Hz page without
// aliasing into a strobe (round 9's meter-matrix-scan lesson). Both rates are
// deliberately decoupled: the bit is rendered orbiting at an 8-RPM-equivalent
// sweep (one lap every 7.5s), and the 33 individual tooth strikes per lap are
// collapsed into one 3-cone simultaneous cluster roughly every 680ms, which
// is what a viewer can actually track landing and healing.
//
// IMPLEMENTATION: like edm-crater-field, the rock face is a small CPU-side
// height/depth buffer (cells derived from the container's SMALLER dimension,
// 96 cells across it) that strikes stamp a crater into and that decays back
// toward flat every frame — never a monotonic fill, a resident population in
// equilibrium. The buffer is painted to an offscreen ImageData canvas and
// blitted, scaled and smoothed, onto the display canvas; the three cone
// bodies and the mud-jet sweep ring are drawn on top in vector form each
// frame so the "rotating tool" reading never depends on the field alone.
//
// Colours: three luminance stops derived from --background, --foreground and
// --ns-muted (getComputedStyle at mount, re-read on a MutationObserver
// watching documentElement's class) — no literals anywhere. --ns-accent is
// never touched: there is no interactive climactic moment (an optional
// pointer only brightens the swept ring in luminance), matching the showpiece
// recipe's standing "accent-tinted pointer highlight" defect.
// ---------------------------------------------------------------------------

export interface TriconeBitTeethProps {
  /** Freezes the surface on a composed post-strike still frame without unmounting. */
  paused?: boolean;
  /** Rendered in the DOM over the field — eyebrow, headline, CTA. */
  children?: React.ReactNode;
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

const CONES = 3;
const TEETH_PER_CONE = 11;
const LAP_SECONDS = 7.5; // 8-RPM-equivalent decoupled sweep, see header
const STRIKE_INTERVAL = 0.68; // s between simultaneous 3-cone strike clusters
const HEAL_RATE = 0.9; // depth *= exp(-HEAL_RATE * dt), ~90% refill in ~1.1s
const FIELD_CELLS = 96; // cells across the container's smaller dimension
const JET_PERIOD = 0.9; // s per mud-jet sweep lap
const JET_SPEED = 140; // px/s the sweep ring expands at

// The frame drawn under prefers-reduced-motion (and paused): right after a
// 3-cone simultaneous strike lands, at maximum unhealed depth — the single
// most structured frame, showing the tooth pattern rather than a mid-heal
// blur or the flat rock the loop would otherwise freeze on.
const STATIC_STRIKE_PHASE = 0; // seconds past the most recent strike event

export function TriconeBitTeeth({
  paused = false,
  children,
  className = "",
  style,
}: TriconeBitTeethProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const uid = useId();
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let cssW = 0;
    let cssH = 0;
    let dpr = 1;
    let disposed = false;
    let running = false;
    let raf = 0;
    let staticMode = false;
    let lastMs = performance.now();
    let simTime = 0;
    let lastStrikeAt = -STRIKE_INTERVAL;

    let fieldW = FIELD_CELLS;
    let fieldH = FIELD_CELLS;
    let depth = new Float32Array(fieldW * fieldH);
    const field = document.createElement("canvas");
    const fctx = field.getContext("2d", { willReadFrequently: true });
    let fieldImg: ImageData | null = null;

    let bg: RGB = [1, 1, 1];
    let raised: RGB = [0.86, 0.86, 0.86];
    let struckDeep: RGB = [0.06, 0.06, 0.06];
    let muted: RGB = [0.55, 0.55, 0.55];

    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      const bgTok = parseHex(cs.getPropertyValue("--background")) ?? [1, 1, 1];
      const fg = parseHex(cs.getPropertyValue("--foreground")) ?? [0.09, 0.09, 0.09];
      const mut = parseHex(cs.getPropertyValue("--ns-muted")) ?? [0.55, 0.55, 0.55];
      bg = bgTok;
      muted = mut;
      // dark theme: unstruck rock sits slightly above background; struck
      // craters read near-black. Light theme needs the same three legible
      // steps compressed into far less headroom below --background, so the
      // dark anchor is pulled from --foreground rather than pure black.
      if (luminance(bgTok) < 0.5) {
        raised = mixRGB(bgTok, [1, 1, 1], 0.14);
        struckDeep = mixRGB(bgTok, [0, 0, 0], 0.55);
      } else {
        raised = mixRGB(bgTok, fg, 0.1);
        struckDeep = mixRGB(fg, [0, 0, 0], 0.25);
      }
    };
    readColors();

    const setFieldRes = () => {
      const ref = Math.min(cssW, cssH) || 1;
      fieldW = FIELD_CELLS;
      fieldH = Math.max(24, Math.round(FIELD_CELLS * (cssH / ref)));
      const w2 = Math.max(24, Math.round(FIELD_CELLS * (cssW / ref)));
      fieldW = w2;
      depth = new Float32Array(fieldW * fieldH);
      field.width = fieldW;
      field.height = fieldH;
      fieldImg = fctx ? fctx.createImageData(fieldW, fieldH) : null;
    };

    // A crater is a recessed bowl: a soft radial falloff stamped additively
    // into the depth buffer (0 = flat, up to 1 = deepest fresh crater).
    const stampCrater = (cx: number, cy: number, radiusCells: number, amp: number) => {
      const r = Math.max(1, radiusCells);
      const x0 = Math.max(0, Math.floor(cx - r));
      const x1 = Math.min(fieldW - 1, Math.ceil(cx + r));
      const y0 = Math.max(0, Math.floor(cy - r));
      const y1 = Math.min(fieldH - 1, Math.ceil(cy + r));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const dx = (x - cx) / r;
          const dy = (y - cy) / r;
          const d2 = dx * dx + dy * dy;
          if (d2 > 1) continue;
          const fall = Math.exp(-d2 * 2.2);
          const idx = y * fieldW + x;
          depth[idx] = Math.min(1, depth[idx] + amp * fall);
        }
      }
    };

    // The three cones sit 120 degrees apart at the bit's periphery and orbit
    // the bit centre together. Each cone's tooth row strikes a cluster of
    // TEETH_PER_CONE small craters scattered along a short arc of its own
    // track — this is what keeps the ring textured (individual tooth marks)
    // rather than a single smeared dent per cone per strike.
    const strikeCluster = (bitAngle: number) => {
      const ref = Math.min(fieldW, fieldH);
      const orbitR = ref * 0.32;
      const cx = fieldW / 2;
      const cy = fieldH / 2;
      for (let c = 0; c < CONES; c++) {
        const coneAngle = bitAngle + (c * Math.PI * 2) / CONES;
        const coneCx = cx + Math.cos(coneAngle) * orbitR;
        const coneCy = cy + Math.sin(coneAngle) * orbitR;
        for (let t = 0; t < TEETH_PER_CONE; t++) {
          // teeth spread across a short arc of the cone's own track, not a
          // single point, so one strike cluster reads as a row, not a dot
          const spread = ((t / (TEETH_PER_CONE - 1)) - 0.5) * 0.5;
          const ta = coneAngle + spread;
          const tr = orbitR * (0.94 + 0.09 * ((t % 3) - 1));
          const tx = cx + Math.cos(ta) * tr;
          const ty = cy + Math.sin(ta) * tr;
          stampCrater(tx, ty, ref * 0.028, 0.75 + 0.25 * Math.random());
        }
      }
    };

    const paintField = () => {
      if (!fctx || !fieldImg) return;
      const data = fieldImg.data;
      for (let i = 0; i < depth.length; i++) {
        const d = depth[i];
        // raised (unstruck) rock at d=0 down to the deepest struck stop at d=1
        const col = d <= 0.001 ? raised : mixRGB(raised, struckDeep, Math.min(1, d));
        const j = i * 4;
        data[j] = Math.round(col[0] * 255);
        data[j + 1] = Math.round(col[1] * 255);
        data[j + 2] = Math.round(col[2] * 255);
        data[j + 3] = 255;
      }
      fctx.putImageData(fieldImg, 0, 0);
    };

    const drawCones = (t: number, bitAngle: number) => {
      const ref = Math.min(cssW, cssH);
      const cx = cssW / 2;
      const cy = cssH / 2;
      const orbitR = ref * 0.32;
      const bodyR = ref * 0.1;
      for (let c = 0; c < CONES; c++) {
        const coneAngle = bitAngle + (c * Math.PI * 2) / CONES;
        const px = cx + Math.cos(coneAngle) * orbitR;
        const py = cy + Math.sin(coneAngle) * orbitR;
        const spin = t * 6.0 + c; // decorative own-axis spin, purely visual
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(spin);
        ctx.beginPath();
        ctx.moveTo(0, -bodyR);
        ctx.lineTo(bodyR * 0.82, bodyR * 0.62);
        ctx.lineTo(-bodyR * 0.82, bodyR * 0.62);
        ctx.closePath();
        ctx.fillStyle = rgbCss(muted, 0.9);
        ctx.fill();
        ctx.strokeStyle = rgbCss(struckDeep, 0.7);
        ctx.lineWidth = Math.max(1, bodyR * 0.05);
        ctx.stroke();
        ctx.restore();
      }
    };

    const drawJetSweep = (t: number) => {
      const ref = Math.min(cssW, cssH);
      const maxR = ref * 0.46;
      const phase = ((t % JET_PERIOD) / JET_PERIOD) * (JET_SPEED * JET_PERIOD);
      const r = Math.min(maxR, phase);
      const alpha = 0.08 * (1 - r / maxR);
      if (alpha <= 0.002) return;
      ctx.save();
      ctx.strokeStyle = rgbCss(mixRGB(raised, [1, 1, 1], 0.5), alpha);
      ctx.lineWidth = Math.max(2, ref * 0.02);
      ctx.beginPath();
      ctx.arc(cssW / 2, cssH / 2, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    };

    const draw = () => {
      if (cssW <= 0 || cssH <= 0 || !fctx) return;
      const t = staticMode ? lastStrikeAt + STATIC_STRIKE_PHASE : simTime;
      const bitAngle = (t / LAP_SECONDS) * Math.PI * 2;

      paintField();
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.fillStyle = rgbCss(raised);
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.drawImage(field, 0, 0, cssW, cssH);
      ctx.restore();

      drawJetSweep(t);
      drawCones(t, bitAngle);
    };

    const loop = (nowMs: number) => {
      const rawMs = nowMs - lastMs;
      const dt = Math.min(0.05, Math.max(0, rawMs / 1000));
      lastMs = nowMs;
      simTime += dt;

      // heal every resident crater back toward flat, framerate-independent
      const heal = Math.exp(-HEAL_RATE * dt);
      for (let i = 0; i < depth.length; i++) depth[i] *= heal;

      const bitAngle = (simTime / LAP_SECONDS) * Math.PI * 2;
      if (simTime - lastStrikeAt >= STRIKE_INTERVAL) {
        lastStrikeAt = simTime;
        strikeCluster(bitAngle);
      }

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

    const dprCap = () => Math.min(window.devicePixelRatio || 1, 2);

    const applyBacking = () => {
      if (cssW < 2 || cssH < 2) return;
      dpr = dprCap();
      const pw = Math.round(cssW * dpr);
      const ph = Math.round(cssH * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      cssW = rect.width;
      cssH = rect.height;
      applyBacking();
      setFieldRes();
      // seed a struck ring immediately so a freshly-mounted/resized surface
      // never shows a blank flat frame while waiting for the first cycle
      strikeCluster(0);
      strikeCluster((Math.PI * 2) / LAP_SECONDS / 3);
      draw();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

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
        else if (!staticMode && !document.hidden) wake();
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
      if (staticMode) draw();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

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
      data-tricone-bit-teeth={uid}
      className={`relative isolate h-full w-full overflow-hidden bg-background ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 block h-full w-full" />
      {children ? <div className="relative z-[1] h-full w-full">{children}</div> : null}
    </div>
  );
}

TriconeBitTeeth.displayName = "TriconeBitTeeth";
