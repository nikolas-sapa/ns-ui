"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// RopewalkLayTwist — an ambient card background modeling rope laying in a
// traditional ropewalk: three pre-twisted yarns are drawn together at a
// fixed convergence point ("the top") where a counter-rotation locks them
// into one rope, which is continuously hauled off and wound onto a take-up
// drum. Source: ropewalk cordage manufacture (yarn-twist and rope-lay run
// in opposite directions, which is what keeps a finished rope torque-
// balanced and un-kinked).
//
// TWO ROTATIONS, deliberately not the same rate:
//  - LAY rotation — how fast the 3 strands spiral into the rope at the
//    convergence point — is governed by feedDist / L (lay length).
//  - WRAP rate — how fast completed rope winds around the drum's own
//    circumference — is governed by feedDist / C (drum circumference).
//  Both are driven by the SAME feedDist (one continuous haul-off clock,
//  never reset), but L and C are unrelated lengths, so the two rotations
//  run at different, independently-tunable periods. (A build note: an
//  earlier draft of this spec assumed the same rate for both, which
//  produced a drum that would take ~25s to show a single wrap at card
//  scale — fixed here by decoupling the two periods properly, matching
//  the spec's own "alive at rest within 5s" requirement instead of its
//  literal shared-omega description.)
//
// STRANDS (pre-convergence, x in [0, topX]): each is a travelling cosine
// wave y = midY + strandR * cos(2π*x/L - 2π*feedDist/L + phase_i), phase_i
// = i * 2π/3. This both twists the strands (three-lobed) and slides that
// twist rightward at exactly FEED px/s, matching the haul-off speed.
// Z-order/opacity per strand comes from cos(phase) at the convergence
// point: whichever strand is nearest full amplitude (+1, "toward viewer")
// draws last, at higher opacity.
//
// ROPE (post-convergence): a single stroked path from the convergence
// point to the drum, with a faint periodic luminance ripple at the same
// wavelength L, reading as twisted structure rather than a flat cable.
//
// DRUM: a ring-recycling system. Every completed drum layer (a run of
// WRAPS_PER_LAYER full wraps) is tracked by an absolute integer index.
// Only the most recent MAX_LAYERS layers are ever rendered, each easing
// toward its current display radius (innermost = oldest of the visible
// set); a layer aging out of that window eases its opacity to 0 over
// LAYER_FADE_MS while the rest ease one slot inward — "the oldest layer
// fades to make room" from the spec, done continuously rather than as a
// hard cut. The layer still being wound sits one slot further out than
// the newest completed layer and fills in as: a single sweeping arc for
// its very first wrap (0 -> 2π), then rising opacity (not a redundant
// sweep) for each additional wrap in that layer, since further wraps at
// an unchanged radius are genuinely indistinguishable from the first.
// ---------------------------------------------------------------------------

type RGB = [number, number, number];

function parseColor(raw: string): RGB | null {
  const s = raw.trim();
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0]! + hex[0], 16);
      const g = parseInt(hex[1]! + hex[1], 16);
      const b = parseInt(hex[2]! + hex[2], 16);
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

function rgbStr(v: RGB, alpha: number): string {
  return `rgba(${v[0]},${v[1]},${v[2]},${Math.max(0, Math.min(1, alpha))})`;
}

const NOMINAL_MIN_DIM = 160; // px — the size the raw constants below assume
const L0 = 64; // lay length (helical period along the feed axis), px
const FEED0 = 26; // haul-off speed, px/s
const STRAND_R0 = 9; // strand helix radius, px
const LAYER_STEP0 = 6; // radial spacing between drum layers, px
const TOP_X_FRAC = 0.3; // convergence point x, fraction of width
const DRUM_PAD0 = 16; // gap between drum outer edge and the right edge, px
const WRAPS_PER_LAYER = 3;
const MAX_LAYERS = 4;
const LAYER_FADE_S = 2; // seconds for a recycled layer to fade to 0
const RADIUS_EASE = 6; // 1/s — how fast a ring eases toward its target radius
const RIPPLE_ALPHA = 0.22; // rope-body luminance ripple amplitude

interface RingState {
  absIdx: number;
  radius: number;
  targetRadius: number;
  opacity: number;
  targetOpacity: number;
}

export interface RopewalkLayTwistProps {
  /** component height in px. Default 160. */
  height?: number;
  /** accessible label for the decorative root. Default "Rope forming" */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function RopewalkLayTwist({
  height = 160,
  label = "Rope forming",
  className = "",
}: RopewalkLayTwistProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let fg: RGB = [0, 0, 0];
    let muted: RGB = [128, 128, 128];
    let border: RGB = [128, 128, 128];
    let borderAlpha = 1;
    let background: RGB = [255, 255, 255];

    const readTokens = () => {
      const root = getComputedStyle(document.documentElement);
      fg = parseColor(root.getPropertyValue("--foreground")) ?? fg;
      muted = parseColor(root.getPropertyValue("--ns-muted")) ?? muted;
      border = parseColor(root.getPropertyValue("--border")) ?? border;
      background = parseColor(root.getPropertyValue("--background")) ?? background;
      const m = root.getPropertyValue("--border").match(/rgba?\([^)]*,\s*([\d.]+)\s*\)/);
      borderAlpha = m ? Number(m[1]) : 1;
    };

    let width = 0;
    let sized = false;
    let minDim = NOMINAL_MIN_DIM;
    let scale = 1;
    let L = L0;
    let FEED = FEED0;
    let strandR = STRAND_R0;
    let layerStep = LAYER_STEP0;
    let topX = 0;
    let midY = 0;
    let baseRadius = 0;
    let drumCx = 0;
    let circumference = 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        sized = false;
        return;
      }
      width = rect.width;
      const h = rect.height;
      minDim = Math.min(width, h);
      scale = Math.max(0.55, Math.min(2.2, minDim / NOMINAL_MIN_DIM));
      L = L0 * scale;
      FEED = FEED0 * scale;
      strandR = STRAND_R0 * scale;
      layerStep = LAYER_STEP0 * scale;
      midY = h / 2;
      baseRadius = minDim * 0.12;
      const maxOuterRadius = baseRadius + (MAX_LAYERS + 1) * layerStep;
      const pad = DRUM_PAD0 * scale;
      drumCx = width - pad - maxOuterRadius;
      topX = Math.min(width * TOP_X_FRAC, Math.max(20, drumCx - 24));
      circumference = 2 * Math.PI * baseRadius;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sized = true;
    };

    // -- persistent state ---------------------------------------------------
    let feedDist = 0; // px hauled off, monotonic, never reset
    let newestCompletedLayer = -1; // absolute index of newest fully-wound layer
    const rings: RingState[] = [];

    const slotRadius = (slot: number) => baseRadius + slot * layerStep;

    // called whenever newestCompletedLayer advances by exactly one — keeps
    // the visible ring window (the most recent MAX_LAYERS layers) current
    // and starts recycling the layer that just aged out of it.
    const promoteLayer = () => {
      rings.push({
        absIdx: newestCompletedLayer,
        radius: baseRadius + (MAX_LAYERS + 1) * layerStep, // starts at the active-ring position
        targetRadius: slotRadius(MAX_LAYERS - 1),
        opacity: 1,
        targetOpacity: 1,
      });
      const oldestVisible = newestCompletedLayer - MAX_LAYERS + 1;
      for (const r of rings) {
        if (r.absIdx < oldestVisible) {
          r.targetOpacity = 0;
        } else {
          const slot = MAX_LAYERS - 1 - (newestCompletedLayer - r.absIdx);
          r.targetRadius = slotRadius(slot);
        }
      }
    };

    const stepRings = (dt: number) => {
      const rEase = 1 - Math.exp(-RADIUS_EASE * dt);
      const oEase = 1 - Math.exp(-(1 / LAYER_FADE_S) * dt);
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i]!;
        r.radius += (r.targetRadius - r.radius) * rEase;
        r.opacity += (r.targetOpacity - r.opacity) * oEase;
        if (r.targetOpacity === 0 && r.opacity < 0.01) rings.splice(i, 1);
      }
    };

    const strandColor = (t: number, alpha: number) => {
      // t in [0,1]: 0 = furthest strand (--ns-muted), 1 = nearest (--foreground)
      const c: RGB = [
        Math.round(muted[0] + (fg[0] - muted[0]) * t),
        Math.round(muted[1] + (fg[1] - muted[1]) * t),
        Math.round(muted[2] + (fg[2] - muted[2]) * t),
      ];
      return rgbStr(c, alpha);
    };

    const draw = () => {
      if (!sized) return;
      const rect = canvas.getBoundingClientRect();
      const h = rect.height;
      ctx.clearRect(0, 0, rect.width, h);

      const layPhase = (2 * Math.PI * feedDist) / L;

      // -- 3 strands, back-to-front by their cos(phase) at convergence -----
      const strandOrder = [0, 1, 2].sort((a, b) => {
        const ca = Math.cos((a * 2 * Math.PI) / 3 - layPhase);
        const cb = Math.cos((b * 2 * Math.PI) / 3 - layPhase);
        return ca - cb; // ascending: furthest (most negative) drawn first
      });
      const STEP_PX = 4;
      for (const i of strandOrder) {
        const phase = (i * 2 * Math.PI) / 3;
        const frontness = (Math.cos(phase - layPhase) + 1) / 2; // 0..1
        ctx.beginPath();
        let started = false;
        for (let x = 0; x <= topX; x += STEP_PX) {
          const y = midY + strandR * Math.cos((2 * Math.PI * x) / L - layPhase + phase);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.strokeStyle = strandColor(frontness, 0.5 + 0.4 * frontness);
        ctx.lineWidth = 1.4 * scale;
        ctx.lineCap = "round";
        ctx.stroke();
      }

      // -- the laid rope, convergence point to drum -------------------------
      const ropeEndX = drumCx - baseRadius;
      ctx.beginPath();
      ctx.moveTo(topX, midY);
      ctx.lineTo(ropeEndX, midY);
      ctx.strokeStyle = rgbStr(fg, 0.85);
      ctx.lineWidth = 2.4 * scale;
      ctx.lineCap = "round";
      ctx.stroke();
      // periodic luminance ripple riding the rope body — twist structure,
      // never itself a separate hue.
      for (let x = topX; x < ropeEndX; x += 3) {
        const ripple = Math.cos((2 * Math.PI * x) / L - layPhase);
        if (ripple <= 0.4) continue;
        ctx.fillStyle = rgbStr(background, RIPPLE_ALPHA * ripple);
        ctx.fillRect(x, midY - 1.2 * scale, 3, 2.4 * scale);
      }

      // -- drum -------------------------------------------------------------
      ctx.beginPath();
      ctx.arc(drumCx, midY, baseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = rgbStr(border, borderAlpha);
      ctx.lineWidth = 1;
      ctx.stroke();

      for (const r of rings) {
        if (r.opacity <= 0.01) continue;
        ctx.beginPath();
        ctx.arc(drumCx, midY, r.radius, 0, Math.PI * 2);
        ctx.strokeStyle = rgbStr(fg, 0.75 * r.opacity);
        ctx.lineWidth = Math.max(1, layerStep * 0.6);
        ctx.stroke();
      }

      // active (still-filling) layer
      const wrapProgressTotal = feedDist / circumference;
      const wrapsCompletedInt = Math.floor(wrapProgressTotal);
      const partialWrap = wrapProgressTotal - wrapsCompletedInt;
      const currentLayerWraps = ((wrapsCompletedInt % WRAPS_PER_LAYER) + WRAPS_PER_LAYER) % WRAPS_PER_LAYER;
      const activeRadius = baseRadius + (MAX_LAYERS + 1) * layerStep;
      if (currentLayerWraps === 0) {
        // first wrap of a fresh layer: a genuine sweeping arc, 0 -> 2π
        ctx.beginPath();
        ctx.arc(drumCx, midY, activeRadius, -Math.PI / 2, -Math.PI / 2 + partialWrap * Math.PI * 2);
        ctx.strokeStyle = rgbStr(fg, 0.85);
        ctx.lineWidth = Math.max(1, layerStep * 0.6);
        ctx.stroke();
      } else {
        // subsequent wraps at the same radius are indistinguishable from
        // the first — represented as rising opacity, not a redundant sweep.
        const fillFrac = (currentLayerWraps + partialWrap) / WRAPS_PER_LAYER;
        ctx.beginPath();
        ctx.arc(drumCx, midY, activeRadius, 0, Math.PI * 2);
        ctx.strokeStyle = rgbStr(fg, 0.5 + 0.4 * fillFrac);
        ctx.lineWidth = Math.max(1, layerStep * 0.6);
        ctx.stroke();
      }
    };

    let raf = 0;
    let last = 0;
    let visible = true;

    const loop = (now: number) => {
      if (!visible || document.hidden) {
        raf = 0;
        return;
      }
      const dt = last ? Math.min(0.25, (now - last) / 1000) : 1 / 60;
      last = now;
      feedDist += FEED * dt;

      const wrapsCompletedInt = Math.floor(feedDist / circumference);
      const totalCompletedLayers = Math.floor(wrapsCompletedInt / WRAPS_PER_LAYER);
      while (totalCompletedLayers > newestCompletedLayer + 1) {
        newestCompletedLayer += 1;
        promoteLayer();
      }
      if (totalCompletedLayers === newestCompletedLayer + 1) {
        newestCompletedLayer += 1;
        promoteLayer();
      }

      stepRings(dt);
      draw();
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (raf || reduced) return;
      last = 0;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) draw();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        readTokens();
        resize();
        draw();
      }, 120);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        if (visible) start();
        else stop();
      },
      { threshold: 0 }
    );
    io.observe(canvas);

    const onVis = () => {
      if (document.hidden) stop();
      else if (visible) start();
    };
    document.addEventListener("visibilitychange", onVis);

    // no paint before the first token read
    readTokens();
    resize();

    if (reduced) {
      // LAY_QUARTER_PHASE — strand phase frozen at π/2 (the 3 strands at
      // their most visually separated moment, pre-convergence) while the
      // drum already shows 2 full layers plus a half-filled 3rd, so both
      // the twist mechanism and the accumulation are legible in one frame.
      const wrapsForTwoLayers = 2 * WRAPS_PER_LAYER + WRAPS_PER_LAYER * 0.5;
      const rawFeedForWraps = wrapsForTwoLayers * circumference;
      const quarterPhaseOffset = L * 0.25;
      const layTurns = Math.round((rawFeedForWraps - quarterPhaseOffset) / L);
      feedDist = layTurns * L + quarterPhaseOffset;

      const wrapsCompletedInt = Math.floor(feedDist / circumference);
      const totalCompletedLayers = Math.floor(wrapsCompletedInt / WRAPS_PER_LAYER);
      while (totalCompletedLayers > newestCompletedLayer) {
        newestCompletedLayer += 1;
        promoteLayer();
      }
      for (const r of rings) {
        r.radius = r.targetRadius;
        r.opacity = r.targetOpacity;
      }
      draw();
    } else {
      draw();
      start();
    }

    return () => {
      stop();
      if (resizeTimer) clearTimeout(resizeTimer);
      mo.disconnect();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  return (
    <div role="img" aria-label={label} className={`relative w-full ${className}`} style={{ height }}>
      <canvas ref={canvasRef} aria-hidden="true" className="block h-full w-full" />
    </div>
  );
}
