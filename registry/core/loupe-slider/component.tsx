"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// LoupeSlider — single-value slider read through a circular magnifying loupe
// riding the thumb. The tick scale is drawn twice from cached layers: a base
// pass pre-blurred (ctx.filter blur(1.5px), rebuilt only on size/theme change)
// at 55% alpha, and a sharp 1.8x-magnified pass inside a 44px circular clip
// centered on the loupe — lens focus IS the readout. The loupe springs after
// the thumb (k=180, zeta=0.75, slight optical lag); dragging past the bounds
// rubber-bands at x0.3 (capped 24px) and release springs home (k=260,
// zeta=0.7) while magnification wobbles 1.8 -> 2.0 -> 1.8 over 350ms.
// Direct-DOM rAF that sleeps at a velocity epsilon, pauses offscreen, and
// carries a 1s forced-settle deadline. All canvas ink is derived from CSS
// tokens at mount and re-derived live on documentElement class changes.
// ---------------------------------------------------------------------------

const LENS_R = 22; // px lens radius (44px loupe)
const PAD = 28; // track inset so the lens never clips at the ends
const MAG_BASE = 1.8;
const MAG_PEAK = 2.0;
const WOBBLE_MS = 350;
const LOUPE_K = 180; // loupe chase spring, s^-2
const LOUPE_ZETA = 0.75;
const HOME_K = 260; // rubber-band return / glide spring, s^-2
const HOME_ZETA = 0.7;
const RUBBER = 0.3; // overshoot gain past the bounds
const RUBBER_MAX = 24; // px overshoot cap
const SETTLE_MS = 1000; // forced-settle deadline

type Vec3 = readonly [number, number, number];

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

function rgba(c: Vec3, a: number) {
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

// round a raw interval to a 1/2/5 decade so tick labels land on clean values
function niceStep(raw: number) {
  const mag = 10 ** Math.floor(Math.log10(Math.max(1e-9, raw)));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}

export function LoupeSlider({
  value,
  defaultValue = 50,
  min = 0,
  max = 100,
  step = 1,
  tickStep,
  majorEvery = 5,
  formatLabel,
  formatValue,
  onValueChange,
  className = "",
  "aria-label": ariaLabel = "Value",
}: {
  /** controlled value; omit for uncontrolled */
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  /** minor tick interval in value units; auto-derived when omitted */
  tickStep?: number;
  /** every Nth minor tick is major and labeled */
  majorEvery?: number;
  /** tick label text (drawn on canvas) */
  formatLabel?: (v: number) => string;
  /** aria-valuetext for the current value */
  formatValue?: (v: number) => string;
  onValueChange?: (v: number) => void;
  className?: string;
  "aria-label"?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loupeRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<{
    dragStart: (clientX: number) => void;
    dragMove: (clientX: number) => void;
    dragEnd: () => void;
    glideTo: (v: number) => void;
    dragging: () => boolean;
  } | null>(null);

  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(() =>
    Math.min(max, Math.max(min, defaultValue))
  );
  const current = isControlled ? value : internal;
  const currentRef = useRef(current);
  currentRef.current = current;
  // mirrors :hover into data-hover — synthetic/dispatched pointer events never
  // flip Chromium's real hover pseudo-class, so an autoplay driver using them
  // needs an attribute to target (additive, doesn't change real-pointer feel)
  const [hover, setHover] = useState(false);

  const defaultLabel = (v: number) =>
    step < 1 ? v.toFixed(1) : String(Math.round(v));
  const fmtLabel = formatLabel ?? defaultLabel;
  const fmtValue = formatValue ?? fmtLabel;
  const labelRef = useRef(fmtLabel);
  labelRef.current = fmtLabel;

  const commitRef = useRef<(v: number) => void>(() => {});
  commitRef.current = (v: number) => {
    if (!isControlled) setInternal(v);
    onValueChange?.(v);
  };

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const loupe = loupeRef.current;
    const thumb = thumbRef.current;
    if (!container || !canvas || !loupe || !thumb) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // -- token-derived ink: read at mount, re-derived on theme class change --
    let fg: Vec3 = [237, 237, 237];
    let bd: Vec3 = [46, 46, 46];
    let monoFam = "ui-monospace, SFMono-Regular, Menlo, monospace";
    const derive = () => {
      const cs = getComputedStyle(document.documentElement);
      fg =
        parseColor(cs.getPropertyValue("--foreground")) ??
        parseColor(getComputedStyle(container).color) ??
        fg;
      bd = parseColor(cs.getPropertyValue("--border")) ?? bd;
      const fam = getComputedStyle(container).fontFamily;
      if (fam) monoFam = fam;
    };
    derive();

    // -- hot-path state: locals only, never React state ---------------------
    let w = 0;
    let h = 0;
    let cy = 32;
    let dpr = 1;
    let sized = false;
    let raf = 0;
    let last = 0;
    let visible = true;
    let tx = 0; // thumb x (canvas coords)
    let tv = 0;
    let lx = 0; // loupe x, springs after the thumb
    let lv = 0;
    let targetX = 0;
    let mag = MAG_BASE;
    let wobbleAt = -1; // performance.now() when the wobble started
    let dragging = false;
    let committed = currentRef.current;
    let deadline = 0; // forced-settle deadline (performance.now())

    // cached layers: sharp scale at 2x supersample (stays crisp when the lens
    // magnifies it), blurred base derived from it once per size/theme change
    const sharp = document.createElement("canvas");
    const soft = document.createElement("canvas");

    const span = () => Math.max(1e-9, max - min);
    const xFor = (v: number) =>
      PAD + ((v - min) / span()) * Math.max(1, w - PAD * 2);
    const quantize = (v: number) => {
      const q = min + Math.round((v - min) / step) * step;
      return Math.min(max, Math.max(min, Number(q.toFixed(6))));
    };

    // geometry hugs the lens center: the clip radius is LENS_R*mag/MAG_BASE
    // and the draw pass is scaled by `mag` around the same center, so a
    // pre-mag point at offset d from (lx,cy) lands at d*mag post-transform —
    // the mag-INDEPENDENT safe envelope is |d| <= LENS_R/MAG_BASE (R0),
    // regardless of the 1.8->2.0 wobble. That only bounds height though:
    // labels also need their magnified WIDTH inside the chord at that
    // offset, so they sit at the lens's vertical center (dy small, near 0)
    // for the widest available chord, AND get measured + font-shrunk per
    // label so arbitrary formatLabel strings (not just 2-digit numbers)
    // never get sliced by the rim.
    const drawScale = (g: CanvasRenderingContext2D) => {
      let minor = tickStep && tickStep > 0 ? tickStep : niceStep(span() / 60);
      while (span() / minor > 240) minor *= 2; // cap the tick count
      const every = majorEvery > 0 ? Math.round(majorEvery) : 5;
      const axisY = cy - 12;
      g.strokeStyle = rgba(bd, 1);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(PAD, axisY + 0.5);
      g.lineTo(w - PAD, axisY + 0.5);
      g.stroke();
      const count = Math.floor(span() / minor + 1e-6);
      // minor ticks
      g.strokeStyle = rgba(fg, 0.45);
      g.beginPath();
      for (let i = 0; i <= count; i++) {
        if (i % every === 0) continue;
        const x = Math.round(xFor(min + i * minor)) + 0.5;
        g.moveTo(x, axisY);
        g.lineTo(x, axisY + 6);
      }
      g.stroke();
      // major ticks + labels
      g.strokeStyle = rgba(fg, 0.8);
      g.beginPath();
      for (let i = 0; i <= count; i += every) {
        const x = Math.round(xFor(min + i * minor)) + 0.5;
        g.moveTo(x, axisY);
        g.lineTo(x, axisY + 10);
      }
      g.stroke();
      // labels: near lens-center for max chord width, font shrunk per-label
      // when it would still overflow that chord (see comment above drawScale)
      const R0 = LENS_R / MAG_BASE;
      const labelDy = 2; // small clearance below the major tick tips (-2)
      const maxWidth =
        2 * Math.sqrt(Math.max(0, R0 * R0 - labelDy * labelDy)) * 0.92;
      const baseFontPx = 9;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = rgba(fg, 0.9);
      for (let i = 0; i <= count; i += every) {
        const v = Number((min + i * minor).toFixed(6));
        const text = labelRef.current(v);
        g.font = `500 ${baseFontPx}px ${monoFam}`;
        const measured = g.measureText(text).width;
        const fontPx =
          measured > maxWidth && measured > 0
            ? Math.max(5, baseFontPx * (maxWidth / measured))
            : baseFontPx;
        if (fontPx !== baseFontPx) g.font = `500 ${fontPx}px ${monoFam}`;
        g.fillText(text, xFor(v), cy + labelDy);
      }
    };

    const buildLayers = () => {
      if (!sized) return;
      const S = dpr * 2; // supersample so the 1.8-2.0x pass stays sharp
      sharp.width = Math.ceil(w * S);
      sharp.height = Math.ceil(h * S);
      const sctx = sharp.getContext("2d");
      if (!sctx) return;
      sctx.setTransform(S, 0, 0, S, 0, 0);
      sctx.clearRect(0, 0, w, h);
      drawScale(sctx);
      soft.width = Math.ceil(w * dpr);
      soft.height = Math.ceil(h * dpr);
      const bctx = soft.getContext("2d");
      if (!bctx) return;
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bctx.clearRect(0, 0, w, h);
      bctx.filter = "blur(1.5px)";
      if (bctx.filter.indexOf("blur") !== -1) {
        bctx.drawImage(sharp, 0, 0, w, h);
        bctx.filter = "none";
      } else {
        // no ctx.filter support: approximate with a 9-tap ring average
        bctx.globalAlpha = 1 / 9;
        bctx.drawImage(sharp, 0, 0, w, h);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          bctx.drawImage(sharp, Math.cos(a) * 1.3, Math.sin(a) * 1.3, w, h);
        }
        bctx.globalAlpha = 1;
      }
    };

    // full clear + composite from cached layers every frame — no filter work
    // on the hot path, no alpha accumulation
    const render = () => {
      if (!sized) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = 0.55;
      ctx.drawImage(soft, 0, 0, w, h);
      ctx.globalAlpha = 1;
      const r = LENS_R * (mag / MAG_BASE);
      ctx.save();
      ctx.beginPath();
      ctx.arc(lx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.clearRect(0, 0, w, h); // knock the soft pass out of the lens
      ctx.translate(lx, cy);
      ctx.scale(mag, mag);
      ctx.translate(-lx, -cy);
      ctx.drawImage(sharp, 0, 0, w, h);
      ctx.restore();
      // loupe + thumb are DOM nodes on OFFSET transforms from the container's
      // top-left anchor — never absolute canvas coords
      const ringScale = mag / MAG_BASE;
      loupe.style.transform = `translate3d(${(lx - LENS_R).toFixed(2)}px, ${(
        cy - LENS_R
      ).toFixed(2)}px, 0) scale(${ringScale.toFixed(4)})`;
      thumb.style.transform = `translate3d(${(tx - 12).toFixed(2)}px, ${(
        cy - 12
      ).toFixed(2)}px, 0)`;
    };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width < PAD * 2 + 8 || rect.height < 8) {
        sized = false; // zero-size guard — never draw into nothing
        return;
      }
      w = rect.width;
      h = rect.height;
      cy = h / 2;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      // a <canvas> is a replaced element: size the CSS box EXPLICITLY, or it
      // renders at dpr scale
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      sized = true;
      buildLayers();
      targetX = xFor(currentRef.current);
      if (!raf) {
        tx = targetX;
        tv = 0;
        lx = targetX;
        lv = 0;
      }
      render();
    };
    resize();

    const loop = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(0.033, (now - last) / 1000) : 1 / 60;
      last = now;
      let active = false;

      if (dragging) {
        active = true; // thumb is pinned to the pointer; loupe still chases
      } else {
        const c = 2 * HOME_ZETA * Math.sqrt(HOME_K);
        tv += (-HOME_K * (tx - targetX) - c * tv) * dt;
        tx += tv * dt;
        if (Math.abs(tx - targetX) < 0.05 && Math.abs(tv) < 0.5) {
          tx = targetX;
          tv = 0;
        } else active = true;
      }

      const cl = 2 * LOUPE_ZETA * Math.sqrt(LOUPE_K);
      lv += (-LOUPE_K * (lx - tx) - cl * lv) * dt;
      lx += lv * dt;
      if (!dragging && Math.abs(lx - tx) < 0.05 && Math.abs(lv) < 0.5) {
        lx = tx;
        lv = 0;
      } else if (Math.abs(lx - tx) >= 0.05 || Math.abs(lv) >= 0.5) {
        active = true;
      }

      if (wobbleAt >= 0) {
        const p = (now - wobbleAt) / WOBBLE_MS;
        if (p >= 1) {
          wobbleAt = -1;
          mag = MAG_BASE;
        } else {
          // half-sine out-and-back, tail damped: 1.8 -> 2.0 -> 1.8
          mag =
            MAG_BASE +
            (MAG_PEAK - MAG_BASE) * Math.sin(Math.PI * p) * (1 - 0.25 * p);
          active = true;
        }
      }

      // forced-settle deadline — springs AND wobble both answer to it
      if (active && !dragging && now > deadline) {
        tx = targetX;
        tv = 0;
        lx = targetX;
        lv = 0;
        mag = MAG_BASE;
        wobbleAt = -1;
        active = false;
      }

      render();
      if (active && visible && !document.hidden) {
        raf = requestAnimationFrame(loop);
      }
    };

    const wake = () => {
      if (!raf && sized) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    // -- interaction (called from React handlers via engineRef) -------------
    const dragMove = (clientX: number) => {
      if (!sized) return;
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const lo = PAD;
      const hi = w - PAD;
      let px = x;
      if (x < lo) px = lo + Math.max(-RUBBER_MAX, (x - lo) * RUBBER);
      else if (x > hi) px = hi + Math.min(RUBBER_MAX, (x - hi) * RUBBER);
      const clamped = Math.min(hi, Math.max(lo, x));
      const v = quantize(min + ((clamped - lo) / Math.max(1, hi - lo)) * span());
      targetX = xFor(v); // release springs home to the committed value
      if (v !== committed) {
        committed = v;
        commitRef.current(v);
      }
      deadline = performance.now() + SETTLE_MS;
      if (reduced) {
        tx = px;
        lx = px;
        tv = 0;
        lv = 0;
        render();
        return;
      }
      tx = px;
      wake();
    };

    const dragStart = (clientX: number) => {
      if (!sized) return;
      dragging = true;
      committed = currentRef.current;
      dragMove(clientX);
    };

    const dragEnd = () => {
      if (!dragging) return;
      dragging = false;
      const past = tx < PAD - 0.5 || tx > w - PAD + 0.5;
      deadline = performance.now() + SETTLE_MS;
      if (reduced) {
        tx = targetX;
        lx = targetX;
        tv = 0;
        lv = 0;
        render(); // no wobble, instant reposition — magnification itself stays
        return;
      }
      if (past) wobbleAt = performance.now(); // refractive wobble on release
      wake();
    };

    const glideTo = (v: number) => {
      if (dragging || !sized) return;
      committed = v;
      targetX = xFor(v);
      deadline = performance.now() + SETTLE_MS;
      if (reduced) {
        tx = targetX;
        lx = targetX;
        tv = 0;
        lv = 0;
        render();
        return;
      }
      wake();
    };

    engineRef.current = {
      dragStart,
      dragMove,
      dragEnd,
      glideTo,
      dragging: () => dragging,
    };

    // -- observers ----------------------------------------------------------
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) wake();
    });
    io.observe(container);
    // live theme re-derive: rebuild the blur layer on documentElement flips
    const mo = new MutationObserver(() => {
      derive();
      buildLayers();
      render();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    const onVis = () => {
      if (!document.hidden) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      engineRef.current = null;
    };
  }, [min, max, step, tickStep, majorEvery]);

  // keyboard + external value changes glide the loupe on the same spring
  useEffect(() => {
    engineRef.current?.glideTo(current);
  }, [current]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    let next: number | null = null;
    const v = currentRef.current;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = v + step;
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = v - step;
        break;
      case "PageUp":
        next = v + step * 10;
        break;
      case "PageDown":
        next = v - step * 10;
        break;
      case "Home":
        next = min;
        break;
      case "End":
        next = max;
        break;
      default:
        return;
    }
    e.preventDefault();
    next = Math.min(max, Math.max(min, Number(next.toFixed(6))));
    if (next !== v) commitRef.current(next);
  };

  return (
    <div
      ref={containerRef}
      data-hover={hover}
      className={`group relative h-16 w-full cursor-ew-resize touch-none select-none font-mono ${className}`}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        thumbRef.current?.focus({ preventScroll: true });
        engineRef.current?.dragStart(e.clientX);
      }}
      onPointerMove={(e) => {
        if (engineRef.current?.dragging()) engineRef.current.dragMove(e.clientX);
      }}
      onPointerUp={() => engineRef.current?.dragEnd()}
      onPointerCancel={() => engineRef.current?.dragEnd()}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0"
      />
      <div
        ref={loupeRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 h-11 w-11 rounded-full border border-border shadow-[0_2px_10px_-4px_rgba(0,0,0,0.4)] transition-colors duration-200 will-change-transform group-hover:border-foreground/40 group-data-[hover=true]:border-foreground/40"
      />
      <div
        ref={thumbRef}
        role="slider"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-orientation="horizontal"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={current}
        aria-valuetext={fmtValue(current)}
        onKeyDown={onKeyDown}
        className="absolute left-0 top-0 h-6 w-6 rounded-full outline-none will-change-transform focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/80 transition-colors duration-200 group-hover:bg-foreground group-data-[hover=true]:bg-foreground"
        />
      </div>
    </div>
  );
}
