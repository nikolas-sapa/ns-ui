"use client";

import { useEffect, useRef, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// HeroBeamGlyph — a full-bleed hero wordmark drawn the way an XY vector CRT
// (Asteroids/Tempest/Vectrex-class arcade hardware, Tektronix vector/storage
// scope character generators) actually drew text: an electron beam tracing
// single-stroke letterforms (Hershey-style — one continuous poly-line per
// glyph, pen lifted between disconnected strokes), never a filled or
// raster/block glyph like every other ASCII/glyph component in this
// registry. A vector beam has no shutter and no pixel grid, so brightness at
// any point on the trace is a direct function of beam DWELL TIME: fast along
// long straight runs (dimmer), slow at direction-change vertices and stroke
// endpoints (brighter) — real vector-monitor beam physics, not a stylistic
// choice.
//
// The beam retraces the wordmark on a fixed 36Hz cycle (matches the
// commonly cited ~30-40Hz refresh of real vector arcade hardware under
// moderate draw-list length). Each retrace fades the previous pass toward
// the background token first, THEN draws the new pass additively/
// subtractively depending on theme direction (see COMPOSITE DIRECTION
// below) — a short multi-frame phosphor trail, deliberately NOT
// flyback-tear's whole-seconds broadcast-signal decay: this is a live,
// continuously-refreshing beam, not a failing timebase.
//
// COMPOSITE DIRECTION IS THEME-AWARE, NOT A COLOUR SWAP. In dark theme
// (bright foreground on a near-black background) a "glow" is genuinely
// additive — brighter strokes should push toward white, so retrace passes
// use `globalCompositeOperation: "lighter"`. In light theme the SAME
// brighter-at-corners relationship has to read as MORE INK, not more white
// — additive blending in light theme would wash dark strokes toward the
// light background and invert the whole mechanic, so light theme retraces
// with `"multiply"` instead. Which mode applies is decided at every token
// read by comparing the relative luminance of --foreground and
// --background, never by a class-name assumption.
//
// Beam jitter (simulated CRT deflection-coil hum) perturbs every vertex by
// a small smooth per-vertex-phased sine, sampled from a continuous
// simulation clock independent of the 36Hz retrace cadence (so its phase
// keeps advancing between retraces even though only a retrace event ever
// paints it). Pointer proximity locally boosts jitter amplitude near the
// cursor and decays back over roughly a second once the pointer leaves —
// brightness/jitter only, --ns-accent never appears anywhere in this
// component.
// ---------------------------------------------------------------------------

// -- single-stroke vector font -----------------------------------------
// Each letter is a list of strokes; each stroke is a flat [x0,y0,x1,y1,...]
// polyline in a 4-wide x 6-tall unit cell (Hershey-style: continuous pen-down
// runs, pen lifted between separate strokes). Hand-authored geometric
// approximation, not a traced copy of the historical Hershey glyph set.
const STROKE_FONT: Record<string, number[][]> = {
  A: [[0, 6, 2, 0, 4, 6], [0.8, 3.6, 3.2, 3.6]],
  B: [
    [0, 0, 0, 6],
    [0, 0, 2.8, 0, 4, 1.4, 2.8, 3, 0, 3],
    [0, 3, 2.8, 3, 4, 4.6, 2.8, 6, 0, 6],
  ],
  C: [[4, 1.2, 3, 0, 1, 0, 0, 1.6, 0, 4.4, 1, 6, 3, 6, 4, 4.8]],
  D: [[0, 0, 0, 6], [0, 0, 2.4, 0, 4, 1.6, 4, 4.4, 2.4, 6, 0, 6]],
  E: [[0, 0, 0, 6], [0, 0, 4, 0], [0, 3, 3, 3], [0, 6, 4, 6]],
  F: [[0, 0, 0, 6], [0, 0, 4, 0], [0, 3, 3, 3]],
  G: [[4, 1.2, 3, 0, 1, 0, 0, 1.6, 0, 4.4, 1, 6, 3, 6, 4, 4.8, 4, 3.4, 2.4, 3.4]],
  H: [[0, 0, 0, 6], [4, 0, 4, 6], [0, 3, 4, 3]],
  I: [[2, 0, 2, 6], [0.6, 0, 3.4, 0], [0.6, 6, 3.4, 6]],
  J: [[3, 0, 3, 4.4, 2, 6, 0.6, 5.6, 0, 4.4]],
  K: [[0, 0, 0, 6], [4, 0, 0, 3.2], [0, 3.2, 4, 6]],
  L: [[0, 0, 0, 6, 4, 6]],
  M: [[0, 6, 0, 0, 2, 3, 4, 0, 4, 6]],
  N: [[0, 6, 0, 0, 4, 6, 4, 0]],
  O: [[2, 0, 4, 1.6, 4, 4.4, 2, 6, 0, 4.4, 0, 1.6, 2, 0]],
  P: [[0, 0, 0, 6], [0, 0, 3, 0, 4, 1.6, 3, 3, 0, 3]],
  Q: [[2, 0, 4, 1.6, 4, 4.4, 2, 6, 0, 4.4, 0, 1.6, 2, 0], [2.2, 4, 4.2, 6.2]],
  R: [[0, 0, 0, 6], [0, 0, 3, 0, 4, 1.6, 3, 3, 0, 3], [0, 3, 4, 6]],
  S: [[4, 1, 3, 0, 1, 0, 0, 1, 0, 2.4, 1, 3, 3, 3, 4, 4, 4, 5, 3, 6, 1, 6, 0, 5]],
  T: [[0, 0, 4, 0], [2, 0, 2, 6]],
  U: [[0, 0, 0, 4.4, 2, 6, 4, 4.4, 4, 0]],
  V: [[0, 0, 2, 6, 4, 0]],
  W: [[0, 0, 1, 6, 2, 3, 3, 6, 4, 0]],
  X: [[0, 0, 4, 6], [4, 0, 0, 6]],
  Y: [[0, 0, 2, 3], [4, 0, 2, 3], [2, 3, 2, 6]],
  Z: [[0, 0, 4, 0, 0, 6, 4, 6]],
  "0": [[2, 0, 4, 1.6, 4, 4.4, 2, 6, 0, 4.4, 0, 1.6, 2, 0], [0.7, 5, 3.3, 1]],
  "1": [[1, 1, 2, 0, 2, 6], [1, 6, 3, 6]],
  "2": [[0, 1, 1, 0, 3, 0, 4, 1.2, 4, 2.2, 0, 6, 4, 6]],
  "3": [[0, 0.8, 1, 0, 3, 0, 4, 1.2, 3, 3, 1.5, 3, 3, 3, 4, 4.2, 3, 6, 1, 6, 0, 5.2]],
  "4": [[3, 0, 0, 4, 4, 4], [3, 0, 3, 6]],
  "5": [[4, 0, 0, 0, 0, 3, 2.5, 3, 4, 4, 4, 5, 2.5, 6, 0, 6]],
  "6": [[3.5, 0.5, 1.5, 0, 0, 1.6, 0, 4.4, 1.5, 6, 3, 6, 4, 4.6, 3.5, 3.2, 1, 3.2]],
  "7": [[0, 0, 4, 0, 1.5, 6]],
  "8": [
    [2, 3, 0.6, 1.8, 1, 0, 3, 0, 3.4, 1.8, 2, 3],
    [2, 3, 0.6, 4.2, 1, 6, 3, 6, 3.4, 4.2, 2, 3],
  ],
  "9": [[3, 3.2, 1, 3.2, 0, 1.8, 0.8, 0.3, 2.2, 0, 3.5, 1, 4, 3, 4, 4.4, 2.5, 6, 1, 5.5]],
  " ": [],
  "-": [[0.5, 3, 3.5, 3]],
};

const GLYPH_W = 4; // unit width of one glyph cell
const GLYPH_H = 6; // unit height of one glyph cell
const GLYPH_GAP = 1.4; // unit gap between glyphs — generous, strokes need room

const REFRESH_HZ = 36; // full-wordmark retrace rate, real vector-arcade range
const RETRACE_MS = 1000 / REFRESH_HZ;
const DECAY = 0.85; // previous pass retained fraction per retrace
const SPEED_MAX = 2200; // px/s-equivalent, long straight runs (dim baseline)
const SPEED_MIN = 400; // px/s-equivalent, sharp corners/endpoints (bright)
const BRIGHT_CAP = 3; // vertices cap at 3x the straight-run baseline
const ALPHA_MIN = 0.32; // stroke alpha at straight-run baseline
const ALPHA_MAX = 0.92; // stroke alpha at a corner/endpoint
const JITTER_OMEGA = 6.1; // rad/s — simulated deflection-coil hum
const JITTER_AMP = 1.5; // px, at rest
const DISTURB_EXTRA_AMP = 4.5; // px, additional jitter at full disturbance
const DISTURB_RADIUS_FRAC = 0.28; // fraction of min(w,h) the disturbance reaches
const DISTURB_TAU = 0.35; // s — exponential decay constant after pointer leaves
const SUBSTEP_PX = 6; // one drawn subsegment per this many px of stroke length, capped at 24 per segment

interface Vertex {
  x: number;
  y: number;
  alpha: number;
  seedX: number;
  seedY: number;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.trim().replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (v.length !== 6) return null;
  const num = Number.parseInt(v, 16);
  if (Number.isNaN(num)) return null;
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function relLuminance(rgb: [number, number, number]): number {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function cornerAlpha(prev: [number, number] | null, cur: [number, number], next: [number, number] | null): number {
  // endpoints (no prev or no next) dwell like a corner — the beam decelerates
  // to land a stroke and decelerates before lifting off it
  if (!prev || !next) {
    return ALPHA_MAX;
  }
  const inX = cur[0] - prev[0];
  const inY = cur[1] - prev[1];
  const outX = next[0] - cur[0];
  const outY = next[1] - cur[1];
  const inLen = Math.hypot(inX, inY) || 1;
  const outLen = Math.hypot(outX, outY) || 1;
  const dot = (inX / inLen) * (outX / outLen) + (inY / inLen) * (outY / outLen);
  const turn = Math.max(0, Math.min(1, (1 - dot) / 2)); // 0 straight .. 1 full reversal
  const speed = SPEED_MAX - turn * (SPEED_MAX - SPEED_MIN);
  const brightnessNorm = Math.max(1, Math.min(BRIGHT_CAP, SPEED_MAX / Math.max(speed, 1)));
  const t = (brightnessNorm - 1) / (BRIGHT_CAP - 1);
  return ALPHA_MIN + t * (ALPHA_MAX - ALPHA_MIN);
}

export interface HeroBeamGlyphProps {
  /** wordmark text; unsupported characters render as a blank cell */
  text?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
  /** optional content laid over the field (subheading, CTA) */
  children?: ReactNode;
}

export function HeroBeamGlyph({
  text = "SIGNAL",
  className = "",
  children,
}: HeroBeamGlyphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    let fg = "";
    let bg = "";
    let multiplyDirection = false; // true in light theme (dark ink on light ground)
    let tokensReady = false;

    let dpr = 1;
    let displayW = 0;
    let displayH = 0;
    let sized = false;

    // one Vertex[] per stroke, in resting (unjittered) world px space
    let strokes: Vertex[][] = [];

    let disposed = false;
    let raf = 0;
    let accMs = 0;
    let lastNow = 0;
    let simTime = 0;

    let cursorX = -1e5;
    let cursorY = -1e5;
    let disturbWeight = 0;

    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      const nextFg = cs.getPropertyValue("--foreground").trim();
      const nextBg = cs.getPropertyValue("--background").trim();
      if (!nextFg || !nextBg) return;
      fg = nextFg;
      bg = nextBg;
      const fgRgb = hexToRgb(fg);
      const bgRgb = hexToRgb(bg);
      if (fgRgb && bgRgb) {
        multiplyDirection = relLuminance(fgRgb) < relLuminance(bgRgb);
      }
      tokensReady = true;
    };

    const buildGeometry = () => {
      if (!sized) return;
      const chars = Array.from(text.toUpperCase());
      const cellStep = GLYPH_W + GLYPH_GAP;
      const totalUnitsW = Math.max(GLYPH_W, chars.length * cellStep - GLYPH_GAP);

      const minDim = Math.min(displayW, displayH);
      let scale = (minDim * 0.42) / GLYPH_H;
      let pxW = totalUnitsW * scale;
      if (pxW > displayW * 0.88) {
        scale *= (displayW * 0.88) / pxW;
        pxW = totalUnitsW * scale;
      }
      const originX = (displayW - pxW) / 2;
      const originY = (displayH - GLYPH_H * scale) / 2;

      const built: Vertex[][] = [];
      chars.forEach((ch, i) => {
        const glyphStrokes = STROKE_FONT[ch];
        if (!glyphStrokes || glyphStrokes.length === 0) return;
        const gx = originX + i * cellStep * scale;
        for (const flat of glyphStrokes) {
          if (flat.length < 4) continue;
          const pts: [number, number][] = [];
          for (let p = 0; p < flat.length; p += 2) {
            pts.push([gx + flat[p] * scale, originY + flat[p + 1] * scale]);
          }
          const verts: Vertex[] = pts.map((pt, idx) => {
            const prev = idx > 0 ? pts[idx - 1] : null;
            const next = idx < pts.length - 1 ? pts[idx + 1] : null;
            return {
              x: pt[0],
              y: pt[1],
              alpha: cornerAlpha(prev, pt, next),
              seedX: Math.random() * Math.PI * 2,
              seedY: Math.random() * Math.PI * 2,
            };
          });
          built.push(verts);
        }
      });
      strokes = built;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        sized = false;
        return;
      }
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      displayW = rect.width;
      displayH = rect.height;
      canvas.width = Math.max(1, Math.round(displayW * dpr));
      canvas.height = Math.max(1, Math.round(displayH * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sized = true;
      buildGeometry();
    };

    const lineWidthFor = () => {
      const minDim = Math.min(displayW, displayH);
      return Math.max(1.1, Math.min(3.2, minDim * 0.0035));
    };

    // draws one retrace pass: fades the existing canvas toward `bg`, then
    // strokes the wordmark on top with a theme-appropriate composite mode
    const retrace = (t: number, jitterOn: boolean, includeFade: boolean) => {
      if (!sized || !tokensReady) return;

      // a trail retrace fades the previous pass toward `bg` by DECAY; a
      // fresh single-pass (reduced motion) fully resets to an opaque `bg`
      // fill instead, so there is never a leftover transparent pixel for
      // the theme-dependent composite mode below to blend against
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = includeFade ? 1 - DECAY : 1;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, displayW, displayH);
      ctx.globalAlpha = 1;

      ctx.globalCompositeOperation = multiplyDirection ? "multiply" : "lighter";
      ctx.strokeStyle = fg;
      ctx.lineWidth = lineWidthFor();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const minDim = Math.min(displayW, displayH);
      const disturbRadius = minDim * DISTURB_RADIUS_FRAC;
      const disturbR2 = disturbRadius * disturbRadius;

      for (const verts of strokes) {
        for (let i = 0; i < verts.length - 1; i++) {
          const a = verts[i];
          const b = verts[i + 1];
          const segLen = Math.hypot(b.x - a.x, b.y - a.y);
          const steps = Math.max(1, Math.min(24, Math.round(segLen / SUBSTEP_PX)));
          let prevX = a.x;
          let prevY = a.y;
          if (jitterOn) {
            const localAmp = (v: Vertex) => {
              let amp = JITTER_AMP;
              if (disturbWeight > 0.001) {
                const dx = v.x - cursorX;
                const dy = v.y - cursorY;
                const d2 = dx * dx + dy * dy;
                const influence = Math.exp(-d2 / (2 * disturbR2));
                amp += disturbWeight * influence * DISTURB_EXTRA_AMP;
              }
              return amp;
            };
            const ampA = localAmp(a);
            const ampB = localAmp(b);
            prevX = a.x + ampA * Math.sin(t * JITTER_OMEGA + a.seedX);
            prevY = a.y + ampA * Math.sin(t * JITTER_OMEGA * 1.31 + a.seedY);
            for (let s = 1; s <= steps; s++) {
              const frac = s / steps;
              const bx = a.x + (b.x - a.x) * frac;
              const by = a.y + (b.y - a.y) * frac;
              const amp = ampA + (ampB - ampA) * frac;
              const jx = bx + amp * Math.sin(t * JITTER_OMEGA + a.seedX + frac * 0.3);
              const jy = by + amp * Math.sin(t * JITTER_OMEGA * 1.31 + a.seedY + frac * 0.3);
              const alpha = a.alpha + (b.alpha - a.alpha) * frac;
              ctx.globalAlpha = alpha;
              ctx.beginPath();
              ctx.moveTo(prevX, prevY);
              ctx.lineTo(jx, jy);
              ctx.stroke();
              prevX = jx;
              prevY = jy;
            }
          } else {
            for (let s = 1; s <= steps; s++) {
              const frac = s / steps;
              const bx = a.x + (b.x - a.x) * frac;
              const by = a.y + (b.y - a.y) * frac;
              const alpha = a.alpha + (b.alpha - a.alpha) * frac;
              ctx.globalAlpha = alpha;
              ctx.beginPath();
              ctx.moveTo(prevX, prevY);
              ctx.lineTo(bx, by);
              ctx.stroke();
              prevX = bx;
              prevY = by;
            }
          }
        }
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    let visible = true;
    let paused = false;

    const startLive = () => {
      if (paused || reducedQuery.matches) return;
      if (!raf) {
        lastNow = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    const stopLive = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    function loop(now: number) {
      raf = 0;
      if (disposed || paused || !visible) return;
      const dtMs = lastNow ? Math.min(250, now - lastNow) : 1000 / 60;
      lastNow = now;
      const dtSec = dtMs / 1000;
      simTime += dtSec;
      disturbWeight *= Math.exp(-dtSec / DISTURB_TAU);
      accMs += dtMs;
      // fixed-timestep retrace accumulator: paints only on a real 36Hz
      // retrace boundary, capped so a long hidden-tab gap catches up at
      // most a handful of passes rather than bursting through hundreds
      let guard = 0;
      while (accMs >= RETRACE_MS && guard < 8) {
        accMs -= RETRACE_MS;
        retrace(simTime, true, true);
        guard++;
      }
      if (guard >= 8) accMs = 0;
      raf = requestAnimationFrame(loop);
    }

    const drawReducedFrame = () => {
      disturbWeight = 0;
      retrace(0, false, false);
    };

    const applyMotionPref = () => {
      stopLive();
      if (reducedQuery.matches) {
        drawReducedFrame();
      } else if (visible) {
        accMs = 0;
        startLive();
      }
    };
    reducedQuery.addEventListener("change", applyMotionPref);

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      cursorX = e.clientX - rect.left;
      cursorY = e.clientY - rect.top;
      disturbWeight = 1;
    };
    if (!reducedQuery.matches) {
      canvas.addEventListener("pointermove", onPointerMove);
    }

    const mo = new MutationObserver(() => {
      readTokens();
      if (reducedQuery.matches) drawReducedFrame();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (reducedQuery.matches) drawReducedFrame();
      }, 120);
    });
    ro.observe(canvas);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (!reducedQuery.matches) {
        if (visible) startLive();
        else stopLive();
      }
    });
    io.observe(canvas);

    const onVisibility = () => {
      if (document.hidden) {
        paused = true;
        stopLive();
      } else {
        paused = false;
        if (visible && !reducedQuery.matches) startLive();
        else if (reducedQuery.matches) drawReducedFrame();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // no paint before the first token read — this component draws its own
    // vector strokes, not text glyphs, so there is no webfont metric to
    // wait on the way hero-oscilloscope's box-drawing grid does
    readTokens();
    resize();
    if (reducedQuery.matches) {
      drawReducedFrame();
    } else if (visible) {
      startLive();
    }

    return () => {
      disposed = true;
      stopLive();
      if (resizeTimer) clearTimeout(resizeTimer);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      reducedQuery.removeEventListener("change", applyMotionPref);
      canvas.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [text]);

  return (
    <div className={`relative h-full w-full bg-background ${className}`}>
      <canvas ref={canvasRef} aria-hidden className="block h-full w-full" />
      {children ? (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center px-6 pb-10 text-center sm:pb-14">
          {children}
        </div>
      ) : null}
    </div>
  );
}
