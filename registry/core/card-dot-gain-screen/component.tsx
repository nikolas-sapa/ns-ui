"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// CardDotGainScreen — a card whose backing texture is a contact-screen
// halftone reproduced with real ink behaviour, not a decorative dot grid.
// Offset printing does not scale a halftone dot cleanly: the plate's
// nominal tone value runs through a NONLINEAR dot-gain curve (ink spreads
// past the plate's own edge, growing a dot's printed area beyond its
// theoretical size — heaviest in the midtones, per Murray-Davies), and in
// the deepest tones the grown dots physically touch their neighbours and
// PLUG: the paper between adjacent dots disappears and a patch of "texture"
// becomes a patch of solid ink. That plugging, not the dot shape, is the
// mechanic this component reproduces — chart-bar-halftone and
// chart-donut-halftone elsewhere in this registry both use a clean,
// LINEARLY size-scaled dot per data value on a chart surface; this is a
// card, and every dot's radius here comes off a nonlinear gain curve that
// is allowed to push a dot's printed area past the point where it stays a
// separate circle, so dense regions visibly bridge and merge instead of
// just growing bigger.  background-halftone-rosette (loud) is the other
// printing-family neighbour: two same-pitch dot screens at drifting angles
// producing moiré interference — a two-screen registration effect, no gain
// curve, no merging, and it runs full-bleed with no card content to
// protect. This component is a single screen with per-dot growth.
//
// Ink math: a dot's PRINTED area comes from its plate tone t (0=highlight,
// 1=shadow) via printedArea(t) = t + gain*midtoneBump(t) + gain*shadowPlug(t):
//   midtoneBump  = 4t(1-t)              — Murray-Davies parabola, heaviest ~50%
//   shadowPlug   = smoothstep(0.68,1,t)^2 — near-zero until t~0.68, then
//                  accelerates hard toward 1 — models the extra ink-spread
//                  that specifically hits shadow regions in real contact
//                  printing, on top of the ordinary midtone bump
// printedArea is allowed to exceed 1 (clamped to 1.6) so a dot's rendered
// radius r = pitch/2 * sqrt(printedArea) can grow past pitch/2 — the radius
// at which a dot on a square screen touches its orthogonal neighbours.
// Past that point two filled, opaque circles drawn overlapping is what
// "plugging" IS: the canvas fill covers the gap between them the same way
// spreading ink would. Nothing special-cases the merge; it falls out of
// letting the radius exceed tangency.
//
// Idle drift: `gain` above is not a constant. Two incommensurate sine terms
// (periods 7.3s / 11.7s, never in phase together twice inside any short
// window) walk it between roughly 0.22 and 0.38, standing in for plate
// humidity and ink-feed variance drifting a real press's dot gain over a
// run. A slow per-dot noise field (coordinates offset by time*0.05) adds
// a small amount of jitter on top so individual dots swell and shrink out
// of lockstep — the plug/bridge boundary between screen and solid visibly
// creeps rather than holding a fixed shape, with no input required.
//
// Legibility: a card carries text. A screen printed at uniform mid-to-high
// tone would plug solid under the copy and erase it. Rather than punching
// a hole (an opacity mask reads as "the effect turned off"), the plate
// tone itself is scaled down under the content block — the same "coverage
// gradient" solution background-halftone-rosette uses for its full-bleed
// scrim, applied locally: t is multiplied by a falloff that is 1 outside
// the text's padded bounding box and ~0.32 inside it with a soft-edged
// transition, so the copy sits over a sparse, still-visibly-printed
// highlight patch while the card's margins run the full gain curve up
// into plugged shadow — the mechanic stays fully on display, just not
// directly behind the letters.
// ---------------------------------------------------------------------------

export interface CardDotGainScreenProps {
  /** card heading */
  title?: string;
  /** card body copy */
  description?: string;
  /** trailing link label; omit to render the card with no link */
  linkLabel?: string;
  /** link href, used only when linkLabel is set */
  href?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
  /** inline styles merged onto the root element */
  style?: CSSProperties;
}

type RGB = [number, number, number];

function parseColor(raw: string): RGB | null {
  const s = raw.trim();
  if (s.startsWith("#")) {
    let hex = s.slice(1);
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    if (hex.length < 6) return null;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return Number.isNaN(r + g + b) ? null : [r, g, b];
  }
  const m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

// deterministic per-cell hash, coordinates offset by time elsewhere to drift
function hash01(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// gain(t) walks between the two SEC constants below via two incommensurate
// sine terms; freeze time (reduced motion) lands here for maximum plugging.
const GAIN_BASE = 0.3;
const GAIN_AMP1 = 0.05;
const GAIN_AMP2 = 0.035;
const PERIOD1 = 7.3; // seconds
const PERIOD2 = 11.7; // seconds
// t at which sin(2*pi*t/PERIOD1) first peaks — chosen as the reduced-motion
// freeze frame because both waves sit near their maxima there together
// (PERIOD1/4 = 1.825s; PERIOD2 is not a multiple of it, so this is the
// nearest simultaneous near-peak, not an exact one), giving the richest,
// most legibly plugged shadow band to freeze on rather than an arbitrary t=0.
const STATIC_TIME = PERIOD1 / 4;

export function CardDotGainScreen({
  title = "Contact screen, plate 4",
  description = "Dot gain is not a defect to correct out — past a threshold the screen stops separating tones and starts plugging solid.",
  linkLabel = "Read the proof sheet",
  href = "#",
  className = "",
  style,
}: CardDotGainScreenProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const content = contentRef.current;
    if (!root || !canvas || !content) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;

    // -- token-derived ink: read at mount, re-derived on theme class change --
    let fg: RGB = [237, 237, 237];
    const derive = () => {
      const cs = getComputedStyle(document.documentElement);
      fg = parseColor(cs.getPropertyValue("--foreground")) ?? fg;
    };
    derive();

    let w = 0;
    let h = 0;
    let dpr = 1;
    let pitch = 6;
    let raf = 0;
    let visible = true;
    let clearBox = { x: 0, y: 0, w: 0, h: 0 };

    const measureClearBox = () => {
      const rootRect = root.getBoundingClientRect();
      const cRect = content.getBoundingClientRect();
      // padded a bit beyond the literal text box so the falloff has room to
      // land at ~1 before the box edge instead of clipping hard at it
      const pad = pitch * 2.2;
      clearBox = {
        x: cRect.left - rootRect.left - pad,
        y: cRect.top - rootRect.top - pad,
        w: cRect.width + pad * 2,
        h: cRect.height + pad * 2,
      };
    };

    // multiplies plate tone down to ~0.32 inside the padded content box,
    // 1 outside it, with a soft-edged transition band one pitch wide
    const clearFactor = (x: number, y: number): number => {
      const dx = x < clearBox.x ? clearBox.x - x : x > clearBox.x + clearBox.w ? x - (clearBox.x + clearBox.w) : 0;
      const dy = y < clearBox.y ? clearBox.y - y : y > clearBox.y + clearBox.h ? y - (clearBox.y + clearBox.h) : 0;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const band = pitch * 3;
      const inside = 1 - smoothstep(0, band, dist);
      return 1 - inside * 0.68;
    };

    const draw = (now: number) => {
      if (w <= 0 || h <= 0) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const time = reduced ? STATIC_TIME : now / 1000;
      const gain =
        GAIN_BASE +
        GAIN_AMP1 * Math.sin((2 * Math.PI * time) / PERIOD1) +
        GAIN_AMP2 * Math.sin((2 * Math.PI * time) / PERIOD2 + 1.1);
      const noiseT = time * 0.05;

      const cols = Math.ceil(w / pitch) + 1;
      const rows = Math.ceil(h / pitch) + 1;
      ctx.fillStyle = `rgb(${fg[0]},${fg[1]},${fg[2]})`;
      ctx.beginPath();
      for (let j = 0; j < rows; j++) {
        const cy = j * pitch + pitch / 2;
        for (let i = 0; i < cols; i++) {
          const cx = i * pitch + pitch / 2;
          // print-swatch base tone: diagonal ramp, highlight top-left to
          // shadow bottom-right, so one card shows the whole gain curve
          const baseT = Math.min(1, Math.max(0, (cx / w + cy / h) / 2));
          const t = baseT * clearFactor(cx, cy);

          const midtoneBump = 4 * t * (1 - t);
          const shadowPlug = Math.pow(smoothstep(0.68, 1, t), 2);
          let area = t + gain * midtoneBump * 0.55 + gain * shadowPlug * 0.9;
          // per-dot jitter: slow-drifting noise field, +/-6% of area
          const jitter = (hash01(i * 0.37 + noiseT, j * 0.53 - noiseT) - 0.5) * 0.12;
          area = Math.min(1.6, Math.max(0, area + jitter));
          if (area <= 0.002) continue;

          const r = (pitch / 2) * Math.sqrt(area);
          ctx.moveTo(cx + r, cy);
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
        }
      }
      ctx.fill();
    };

    const loop = (now: number) => {
      draw(now);
      if (!reduced && visible) raf = requestAnimationFrame(loop);
      else raf = 0;
    };
    const wake = () => {
      if (raf === 0 && !reduced && visible) raf = requestAnimationFrame(loop);
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      // screen ruling proportional to the card's own smaller dimension, so
      // it never coarsens into a polka-dot pattern on a small card and
      // never over-fines on a large one
      pitch = Math.min(9, Math.max(3.5, Math.min(w, h) / 32));
      measureClearBox();
      draw(reduced ? 0 : performance.now());
    };

    resize();
    if (!reduced) wake();
    else draw(0);

    const ro = new ResizeObserver(resize);
    ro.observe(root);

    const mo = new MutationObserver(() => {
      derive();
      draw(reduced ? 0 : performance.now());
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const onReducedChange = () => {
      reduced = mq.matches;
      if (reduced) {
        cancelAnimationFrame(raf);
        raf = 0;
        draw(0);
      } else {
        wake();
      }
    };
    mq.addEventListener("change", onReducedChange);

    const onVisibility = () => {
      visible = document.visibilityState === "visible";
      if (visible) {
        wake();
      } else {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      mq.removeEventListener("change", onReducedChange);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`ns-cdgs relative w-full max-w-sm overflow-hidden rounded-[14px] border border-border bg-background ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
      <div ref={contentRef} className="relative flex flex-col gap-3 p-6">
        <h3 className="text-balance font-sans text-lg font-medium text-foreground">{title}</h3>
        <p className="text-pretty font-mono text-xs leading-relaxed text-ns-muted">{description}</p>
        {linkLabel ? (
          <a
            href={href}
            className="ns-cdgs-link mt-1 inline-flex w-fit items-center gap-1 rounded-sm font-mono text-xs font-medium text-foreground underline decoration-border underline-offset-4 transition-colors duration-150 hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            {linkLabel}
            <span aria-hidden="true">&rarr;</span>
          </a>
        ) : null}
      </div>
    </div>
  );
}

CardDotGainScreen.displayName = "CardDotGainScreen";

export default CardDotGainScreen;
