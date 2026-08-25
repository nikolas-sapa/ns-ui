"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// TextRingFunnel — a full-bleed hero where TEXT IS THE GEOMETRY. Seven rings
// of real, readable words sit at fixed world depths tapering from Z_NEAR to
// Z_FAR (a static funnel, not a treadmill — nothing travels in z). Each
// ring's screen radius AND glyph size are both K1*(1/z) of the same world
// constants, the standard single-point-perspective divide, so the funnel
// tapers correctly: a ring twice as deep is both half the radius and half
// the type size, never one without the other.
//
// The depth cue is angular, not translational: every ring spins forever at
// its own constant angular speed, fastest near / slowest far (a ~5x spread),
// so the phase gap between neighboring rings grows continuously — that
// growing lag, not any z motion, is what the eye reads as a tunnel turning
// in place. This is deliberately NOT the ascii-tunnel family: nothing here
// quantizes to a fixed character-cell grid or looks up a density ramp glyph.
// A ring's text is laid out ONCE per resize (real words, real proportional
// widths from an offscreen measureText pass, cached per glyph+font-size) by
// walking the circle and rotating+translating the 2D context per character —
// classic "text on a circle" typesetting, not a raster stand-in. The only
// per-frame cost is one extra ctx.rotate() per ring before replaying that
// fixed layout, so motion is bought once, not re-measured every tick.
// ---------------------------------------------------------------------------

const RING_COUNT = 7;
const Z_NEAR = 0.62;
const Z_FAR = 3.2;
const WORLD_R = 1; // ring radius, world units
const WORLD_GLYPH = 0.17; // glyph size, world units
const MIN_FONT_PX = 9; // legibility floor — see readme note below
const OMEGA_NEAR = 0.46; // rad/s, nearest ring
const OMEGA_FAR = 0.09; // rad/s, farthest ring
const STATIC_TIME = 2.2; // reduced-motion freeze — rings already well out of phase
const MOTE_COUNT = 36;
const CONTENT_FEATHER_PX = 56;
const MAX_CHARS_PER_RING = 140;
const DT_MAX = 0.05;

export interface TextRingFunnelProps {
  /** the running phrase set as the ring text; tiled to fill each circle */
  ringText?: string;
  /** headline / CTA centered at the funnel's vanishing point */
  children?: ReactNode;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function TextRingFunnel({
  ringText = "NS-UI HERO TEXT RING FUNNEL — TYPE SET IN DEPTH — ",
  children,
  className = "",
}: TextRingFunnelProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // -- tokens, re-read on every theme flip; nothing paints before the
    // first read (guarded by the `ready` gate below) --
    let fgColor = "";
    let mutedColor = "";
    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      fgColor = cs.getPropertyValue("--foreground").trim();
      mutedColor = cs.getPropertyValue("--ns-muted").trim();
    };

    let dpr = 1;
    let sized = false;
    let ready = false;
    let disposed = false;
    let rootW = 0;
    let rootH = 0;
    let cx = 0;
    let cy = 0;
    let K1 = 0;

    type CharItem = { angle: number; ch: string };
    type Ring = {
      z: number;
      omega: number;
      angle: number; // accumulated rotation, radians
      radiusPx: number;
      fontPx: number;
      color: string;
      alpha: number;
      layout: CharItem[];
    };
    let rings: Ring[] = [];

    type Mote = { ringGap: number; theta: number; drift: number; r: number };
    const motes: Mote[] = [];
    for (let i = 0; i < MOTE_COUNT; i++) {
      motes.push({
        ringGap: Math.random() * (RING_COUNT - 1),
        theta: Math.random() * Math.PI * 2,
        drift: 0.04 + Math.random() * 0.08,
        r: 0.6 + Math.random() * 1.1,
      });
    }

    // -- children's measured box, used to feather rings near the legible
    // center zone so the headline stays readable --
    const content = contentRef.current;
    const hasContent = !!content;
    let contentRadiusPx = 0;
    const measureContent = () => {
      if (!content) return;
      const r = content.getBoundingClientRect();
      contentRadiusPx = Math.sqrt((r.width / 2) ** 2 + (r.height / 2) ** 2);
    };
    measureContent();
    const contentRO = content ? new ResizeObserver(measureContent) : null;
    if (content) contentRO?.observe(content);

    const measureCache = new Map<string, number>();
    const measureChar = (
      offCtx: CanvasRenderingContext2D,
      ch: string,
      fontPx: number,
      fontFamily: string
    ) => {
      const key = `${fontPx}|${ch}`;
      const cached = measureCache.get(key);
      if (cached !== undefined) return cached;
      offCtx.font = `600 ${fontPx}px ${fontFamily}`;
      const w = Math.max(1, offCtx.measureText(ch).width);
      measureCache.set(key, w);
      return w;
    };

    const buildLayout = (
      offCtx: CanvasRenderingContext2D,
      radiusPx: number,
      fontPx: number,
      fontFamily: string
    ) => {
      const layout: CharItem[] = [];
      const text = ringText.length ? ringText : " ";
      const full = Math.PI * 2;
      let angle = 0;
      let i = 0;
      while (angle < full && layout.length < MAX_CHARS_PER_RING) {
        const ch = text[i % text.length];
        const w = measureChar(offCtx, ch, fontPx, fontFamily);
        const charAngle = w / radiusPx;
        if (ch !== " ") {
          layout.push({ angle: angle + charAngle / 2, ch });
        }
        angle += charAngle;
        i++;
      }
      return layout;
    };

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (width < 2 || height < 2) {
        sized = false;
        return;
      }
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      rootW = width;
      rootH = height;
      cx = width / 2;
      cy = height / 2;
      K1 = Math.min(width, height) * 0.46;

      const off = document.createElement("canvas");
      const offCtx = off.getContext("2d");
      const fontFamily = getComputedStyle(canvas).fontFamily;
      measureCache.clear();

      const next: Ring[] = [];
      for (let i = 0; i < RING_COUNT; i++) {
        const z = Z_NEAR + (i * (Z_FAR - Z_NEAR)) / (RING_COUNT - 1);
        const ooz = 1 / z;
        const fontPx = Math.max(MIN_FONT_PX, K1 * ooz * WORLD_GLYPH);
        const radiusPx = Math.max(fontPx * 2.2, K1 * ooz * WORLD_R);
        const depthT = i / (RING_COUNT - 1); // 0 = nearest, 1 = farthest
        const far = depthT >= 0.5;
        const layout = offCtx
          ? buildLayout(offCtx, radiusPx, fontPx, fontFamily)
          : [];
        const prevAngle = rings[i]?.angle ?? Math.random() * Math.PI * 2;
        next.push({
          z,
          omega: OMEGA_NEAR + (OMEGA_FAR - OMEGA_NEAR) * depthT,
          angle: prevAngle,
          radiusPx,
          fontPx,
          color: far ? mutedColor : fgColor,
          alpha: far ? 0.85 - (depthT - 0.5) * 0.9 : 1 - depthT * 0.35,
          layout,
        });
      }
      rings = next;
      sized = true;
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (reduced) draw();
      }, 150);
    };

    const draw = () => {
      if (!sized) return;
      ctx.clearRect(0, 0, rootW, rootH);

      // motes drift in the gaps between rings, faint, muted-only
      ctx.fillStyle = mutedColor;
      for (const m of motes) {
        const lo = Math.floor(m.ringGap);
        const hi = Math.min(RING_COUNT - 1, lo + 1);
        const t = m.ringGap - lo;
        const rr = rings[lo] && rings[hi]
          ? rings[lo].radiusPx + (rings[hi].radiusPx - rings[lo].radiusPx) * t
          : 0;
        if (!rr) continue;
        const theta = m.theta;
        const x = cx + Math.cos(theta) * rr;
        const y = cy + Math.sin(theta) * rr;
        ctx.globalAlpha = 0.22;
        ctx.beginPath();
        ctx.arc(x, y, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // farthest ring first (painter's algorithm) — concentric circles never
      // overlap in projected radius so draw order alone is a valid depth sort
      for (let i = rings.length - 1; i >= 0; i--) {
        const ring = rings[i];
        if (!ring.layout.length) continue;

        let alpha = ring.alpha;
        if (hasContent && contentRadiusPx > 0) {
          const d = ring.radiusPx - contentRadiusPx;
          if (d < -CONTENT_FEATHER_PX) continue; // fully behind the legible zone
          if (d < CONTENT_FEATHER_PX) {
            const t = Math.min(
              1,
              Math.max(0, (d + CONTENT_FEATHER_PX) / (2 * CONTENT_FEATHER_PX))
            );
            alpha *= t * t * (3 - 2 * t); // smoothstep
          }
        }
        if (alpha <= 0.02) continue;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ring.angle);
        ctx.font = `600 ${ring.fontPx}px ${getComputedStyle(canvas).fontFamily}`;
        ctx.fillStyle = ring.color;
        ctx.globalAlpha = alpha;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (const item of ring.layout) {
          ctx.save();
          ctx.rotate(item.angle);
          ctx.translate(0, -ring.radiusPx);
          ctx.rotate(Math.PI / 2);
          ctx.fillText(item.ch, 0, 0);
          ctx.restore();
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    };

    // -- hot-path state: locals only, never React state ---------------------
    let raf = 0;
    let last = 0;
    let clock = 0;

    const placeContent = () => {
      const el = contentRef.current;
      if (!el) return;
      el.style.transform = "translate(-50%, -50%)";
    };

    const loop = (now: number) => {
      const dt = last ? Math.min(DT_MAX, (now - last) / 1000) : 1 / 60;
      last = now;
      clock += dt;
      for (const ring of rings) ring.angle += ring.omega * dt;
      for (const m of motes) {
        m.theta += m.drift * dt;
        m.ringGap += dt * 0.12;
        if (m.ringGap > RING_COUNT - 1) m.ringGap -= RING_COUNT - 1;
      }
      draw();
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries[0]?.isIntersecting ?? true;
        if (visible && !document.hidden && !reduced && ready && !raf) {
          last = 0;
          raf = requestAnimationFrame(loop);
        } else if (!visible && raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      { threshold: 0 }
    );
    io.observe(root);

    const onVis = () => {
      if (!document.hidden && !reduced && ready && !raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      } else if (document.hidden && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const mo = new MutationObserver(() => {
      readTokens();
      resize();
      if (reduced) draw();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const ro = new ResizeObserver(() => onResize());
    ro.observe(root);

    document.fonts.ready.then(() => {
      if (disposed) return;
      readTokens();
      resize();
      ready = true;
      placeContent();
      if (reduced) {
        // freeze at a beat past t0 so the differential angular speed has
        // already visibly separated the rings' phase — t0 itself has every
        // ring at a random starting angle, which can look aligned by chance
        for (const ring of rings) ring.angle += ring.omega * STATIC_TIME;
        draw();
      } else {
        raf = requestAnimationFrame(loop);
      }
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      mo.disconnect();
      io.disconnect();
      ro.disconnect();
      contentRO?.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ringText]);

  return (
    <div
      ref={rootRef}
      className={`relative isolate min-h-screen w-full overflow-hidden bg-background ${className}`}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 block h-full w-full"
      />
      {/* the ring phrase carries real content (it's the caller's copy set
          as geometry) — expose it to assistive tech once, unstyled, since
          the canvas glyphs themselves are decorative paint */}
      <span className="sr-only">{ringText.trim()}</span>
      {children ? (
        <div
          ref={contentRef}
          className="absolute left-1/2 top-1/2 flex w-full max-w-md flex-col items-center gap-4 px-6 text-center"
          style={{ transform: "translate(-50%, -50%)" }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
