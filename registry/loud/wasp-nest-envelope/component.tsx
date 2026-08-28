"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// WaspNestEnvelope — a full-bleed paper/fibre backdrop grown from a real
// Vespidae mechanic: paper wasps (Polistes, Vespula) scrape wood fibre,
// chew it into pulp, and lay it down in short fan-shaped mandible sweeps,
// each stroke slightly overlapping the last, building up in concentric
// shingled layers (like roof shingles or stucco passes) around a hidden
// comb. Each layer's stroke direction and pulp-batch shade differs subtly
// because different wasps forage different wood sources at different times
// (documented in Vespidae nest-architecture studies, e.g. Jeanne 1975 "The
// adaptiveness of social wasp nest architecture").
//
// GEOMETRY: 1+ independent nucleation points (round(min(w,h)/340), min 1),
// each growing its own shell of concentric rings. A ring/layer is built
// from discrete stroke primitives (short filled rects standing in for
// fan-shaped arcs, 14-22px long, 5-7px wide) laid one at a time around the
// circumference at 3.4 strokes/s, strokeSpacing 11px along the ring. A
// layer is "complete" once ceil(2*PI*r / 11) strokes have landed; the next
// layer starts 9px further out. Each completed layer keeps a fixed tone
// offset (sampled once, +-8%/+-12% luminance around --ns-muted, no hue
// shift) so pulp batches read as distinct bands once several are stacked.
// Growth continues until radius reaches 1.15 * min(w,h)/2 (a ~40-70s
// background event at these rates); past that the shell stops growing new
// layers but keeps receiving wasp-visit bursts (below) so it is never a
// finished, static picture.
//
// CUTAWAY: independent of overall radius, each nest keeps a fixed 60-90deg
// wedge permanently unfilled across its OUTERMOST THREE layers only (older,
// interior layers render as solid full rings beneath it) — this is the
// always-visible tell that the shell is layered, not a filled blob. Every
// 5-8s a "wasp visit" lays a fresh batch of 6-10 strokes specifically
// inside that wedge, at the current growth-front radius — a fast, local,
// always-legible event riding on top of the much slower whole-shell growth.
// That visit cadence (individual strokes still landing one at a time,
// 3.4/s) is the ONE thing meant to be followed at a glance; the layer
// banding and overall radius reward a longer look.
//
// TOKENS: colours read only via getComputedStyle(document.documentElement),
// re-read on a MutationObserver watching its class, no paint before that
// first read. Stroke fill interpolates --ns-muted (interior/older layers)
// toward --border (outermost/freshest layer) by layer age, with the +-8%
// (+-12% in light theme, where the token range compresses) per-layer tone
// offset applied as an RGB luminance multiplier, never a hue shift. The
// cutaway's interior walls are stroked with a thin --border line. Nothing
// ever touches --foreground or --ns-accent — this stays a backdrop, never
// competing with overlaid headline copy.
//
// HOST: DPR-aware canvas sized off the host's own bounding box, capped at
// 2. ResizeObserver re-sizes (and re-seeds nucleation points only when the
// point count itself changes); IntersectionObserver (threshold 0) and
// visibilitychange stop the single rAF loop when offscreen/hidden.
// prefers-reduced-motion composes and draws exactly one still frame per
// nest, frozen at ~55% of target radius with 5-6 banded layers and the
// cutaway exposing internal banding ("SHELL_MIDGROWTH" — chosen because
// it is the one frame that legibly shows both the shingle-stroke texture
// AND the layered banding at once; earlier shows no banding, later hides
// the cutaway's interior behind its own advancing front).
// ---------------------------------------------------------------------------

type RGB = [number, number, number];

const STROKE_RATE = 3.4; // strokes / second, per active nucleation point
const STROKE_INTERVAL_MS = 1000 / STROKE_RATE;
const STROKE_SPACING = 11; // px along the ring's circumference
const LAYER_STEP = 9; // px added to shell radius per completed layer
const START_RADIUS = 16; // px, first ring around the hidden comb
const TOP_GROUP_SIZE = 3; // outermost layers that carry the cutaway + texture
const BURIED_DELTA = 22; // px of further growth before a visit stroke is pruned
const MAX_VISIT_STROKES_PER_NEST = 60;
const VISIT_MIN_MS = 5000;
const VISIT_MAX_MS = 8000;
const VISIT_COUNT_MIN = 6;
const VISIT_COUNT_MAX = 10;

interface Stroke {
  angle: number; // radians, position around the ring
  radius: number;
  length: number;
  width: number;
  fanDeg: number;
  bornAt: number;
}

interface Layer {
  radius: number;
  toneOffset: number; // -1..1, scaled by TONE_RANGE at render time
  strokesNeeded: number;
}

interface Nest {
  id: number;
  cx: number; // fraction of width
  cy: number; // fraction of height
  cutawayStart: number; // radians
  cutawayWidth: number; // radians
  layerSeed: () => number;
  completed: Layer[];
  active: Layer;
  strokesLaid: number; // strokes landed on the active layer so far
  capped: boolean; // true once the active layer reached target radius
  nextVisitAt: number;
  visitStrokes: Stroke[];
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

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

function parseHex(v: string): RGB | null {
  const m = v.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function readToken(el: HTMLElement, name: string, fallback: RGB): RGB {
  return parseHex(getComputedStyle(el).getPropertyValue(name)) ?? fallback;
}

function rgbaStr(rgb: RGB, a: number): string {
  return `rgba(${Math.round(rgb[0])},${Math.round(rgb[1])},${Math.round(rgb[2])},${Math.max(0, a)})`;
}

function mixRgb(a: RGB, b: RGB, t: number): RGB {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function toneShift(rgb: RGB, offset: number): RGB {
  // luminance-only multiplier, never a hue shift
  const k = 1 + offset;
  return [
    Math.min(255, Math.max(0, rgb[0] * k)),
    Math.min(255, Math.max(0, rgb[1] * k)),
    Math.min(255, Math.max(0, rgb[2] * k)),
  ];
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function makeLayer(radius: number, rand: () => number): Layer {
  return {
    radius,
    toneOffset: rand() * 2 - 1,
    strokesNeeded: Math.max(1, Math.ceil((2 * Math.PI * radius) / STROKE_SPACING)),
  };
}

function makeNest(id: number, rand: () => number): Nest {
  const layerSeed = mulberry32(Math.floor(rand() * 1e9) + 1);
  return {
    id,
    cx: lerp(0.16, 0.84, rand()),
    cy: lerp(0.16, 0.84, rand()),
    cutawayStart: rand() * Math.PI * 2,
    cutawayWidth: lerp((60 * Math.PI) / 180, (90 * Math.PI) / 180, rand()),
    layerSeed,
    completed: [],
    active: makeLayer(START_RADIUS, layerSeed),
    strokesLaid: 0,
    capped: false,
    nextVisitAt: lerp(VISIT_MIN_MS, VISIT_MAX_MS, rand()),
    visitStrokes: [],
  };
}

// Advances a nest to a fixed simulated age (used both for the live engine's
// initial catch-up and for the reduced-motion static composition).
function advanceNest(nest: Nest, ageMs: number, capRadius: number, strokeRand: () => number) {
  let remaining = Math.floor(ageMs / STROKE_INTERVAL_MS);
  while (remaining > 0 && !nest.capped) {
    const needed = nest.active.strokesNeeded - nest.strokesLaid;
    const take = Math.min(needed, remaining);
    nest.strokesLaid += take;
    remaining -= take;
    if (nest.strokesLaid >= nest.active.strokesNeeded) {
      const nextRadius = nest.active.radius + LAYER_STEP;
      nest.completed.push(nest.active);
      if (nextRadius >= capRadius) {
        nest.active = { radius: nextRadius, toneOffset: nest.active.toneOffset, strokesNeeded: 1 };
        nest.strokesLaid = 0;
        nest.capped = true;
      } else {
        nest.active = makeLayer(nextRadius, nest.layerSeed);
        nest.strokesLaid = 0;
      }
    }
  }
  void strokeRand;
}

function isInCutaway(angle: number, nest: Nest): boolean {
  const twoPi = Math.PI * 2;
  let a = ((angle - nest.cutawayStart) % twoPi + twoPi) % twoPi;
  return a < nest.cutawayWidth;
}

export interface WaspNestEnvelopeProps {
  /** override nucleation-point count; default derives from container size
   * (round(min(w,h)/340), minimum 1). */
  density?: number;
  /** clock speed multiplier. @default 1 */
  speed?: number;
  /** freeze the simulation in place without unmounting it. @default false */
  paused?: boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function WaspNestEnvelope({
  density,
  speed = 1,
  paused = false,
  children,
  className = "",
  style,
}: WaspNestEnvelopeProps) {
  const reduced = useReducedMotion();
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const densityRef = useRef(density);
  densityRef.current = density;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const engineRef = useRef({
    w: 0,
    h: 0,
    dpr: 1,
    clock: 0,
    raf: 0,
    lastNow: 0,
    visible: true,
    nucleationCount: 0,
    capRadius: 0,
    nests: [] as Nest[],
    rand: mulberry32(1),
    background: [10, 10, 10] as RGB,
    muted: [141, 141, 141] as RGB,
    border: [58, 58, 58] as RGB,
  });

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const e = engineRef.current;

    const isLight = () => !document.documentElement.classList.contains("dark");

    const syncColors = () => {
      const root = document.documentElement;
      e.background = readToken(root, "--background", e.background);
      e.muted = readToken(root, "--ns-muted", e.muted);
      e.border = readToken(root, "--border", e.border);
    };

    const nucleationCountFor = (w: number, h: number) => {
      const override = densityRef.current;
      if (override && override > 0) return Math.round(override);
      return Math.max(1, Math.round(Math.min(w, h) / 340));
    };

    const initNests = () => {
      e.capRadius = 1.15 * (Math.min(e.w, e.h) / 2);
      e.nucleationCount = nucleationCountFor(e.w, e.h);
      const rand = mulberry32(7);
      e.rand = rand;
      e.nests = Array.from({ length: e.nucleationCount }, (_, i) => makeNest(i + 1, rand));
    };

    const resize = () => {
      const r = host.getBoundingClientRect();
      e.w = Math.max(1, r.width);
      e.h = Math.max(1, r.height);
      e.dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(e.w * e.dpr);
      canvas.height = Math.round(e.h * e.dpr);
      canvas.style.width = `${e.w}px`;
      canvas.style.height = `${e.h}px`;
      const count = nucleationCountFor(e.w, e.h);
      if (count !== e.nucleationCount || e.nests.length === 0) {
        initNests();
      } else {
        e.capRadius = 1.15 * (Math.min(e.w, e.h) / 2);
      }
    };

    // Draws one stroke as a short filled rect standing in for a fan-shaped
    // mandible sweep, rotated tangent-to-ring plus the fan offset.
    const drawStroke = (cx: number, cy: number, s: Stroke, fill: string, alpha: number) => {
      if (alpha <= 0.003) return;
      const px = cx + Math.cos(s.angle) * s.radius;
      const py = cy + Math.sin(s.angle) * s.radius;
      const tangent = s.angle + Math.PI / 2 + (s.fanDeg * Math.PI) / 180;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(tangent);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fill;
      ctx.fillRect(-s.length / 2, -s.width / 2, s.length, s.width);
      ctx.restore();
    };

    const strokeAtIndex = (nest: Nest, layer: Layer, index: number, rand: () => number): Stroke => {
      const angle = ((index * STROKE_SPACING) / layer.radius) % (Math.PI * 2);
      return {
        angle,
        radius: layer.radius,
        length: lerp(14, 22, rand()),
        width: lerp(5, 7, rand()),
        fanDeg: ((index * 14) % 42) - 21,
        bornAt: 0,
      };
    };

    const layerColor = (layer: Layer, ageFraction: number, toneRange: number): string => {
      const base = mixRgb(e.muted, e.border, clamp01(ageFraction));
      const shifted = toneShift(base, layer.toneOffset * toneRange);
      return rgbaStr(shifted, 0.92);
    };

    const drawNest = (nest: Nest, clock: number, toneRange: number, strokeRand: () => number) => {
      const cx = e.w * nest.cx;
      const cy = e.h * nest.cy;
      const allLayers = [...nest.completed, nest.active];
      const total = allLayers.length;
      const topGroupStart = Math.max(0, total - TOP_GROUP_SIZE);
      const innerExposedRadius = allLayers[topGroupStart]?.radius ?? nest.active.radius;

      // interior layers: solid full rings, banding visible beneath the cutaway
      for (let i = 0; i < topGroupStart; i++) {
        const layer = allLayers[i]!;
        const ageFraction = total > 1 ? i / (total - 1) : 1;
        ctx.beginPath();
        ctx.strokeStyle = layerColor(layer, ageFraction, toneRange);
        ctx.lineWidth = LAYER_STEP + 1;
        ctx.arc(cx, cy, layer.radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // top group: discrete strokes, cutaway wedge skipped
      for (let i = topGroupStart; i < total; i++) {
        const layer = allLayers[i]!;
        const ageFraction = total > 1 ? i / (total - 1) : 1;
        const fill = layerColor(layer, ageFraction, toneRange);
        const isActive = i === total - 1;
        const count = isActive ? nest.strokesLaid : layer.strokesNeeded;
        for (let s = 0; s < count; s++) {
          const stroke = strokeAtIndex(nest, layer, s, strokeRand);
          if (isInCutaway(stroke.angle, nest)) continue;
          drawStroke(cx, cy, stroke, fill, 1);
        }
      }

      // cutaway interior walls: thin --border line from the exposed radius
      // out to the current shell edge
      const outerR = nest.active.radius;
      if (outerR > innerExposedRadius) {
        ctx.strokeStyle = rgbaStr(e.border, 0.8);
        ctx.lineWidth = 1;
        for (const edge of [nest.cutawayStart, nest.cutawayStart + nest.cutawayWidth]) {
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(edge) * innerExposedRadius, cy + Math.sin(edge) * innerExposedRadius);
          ctx.lineTo(cx + Math.cos(edge) * outerR, cy + Math.sin(edge) * outerR);
          ctx.stroke();
        }
      }

      // wasp-visit strokes: fresh batches landing at the growth front,
      // inside the cutaway
      const visitFill = layerColor(nest.active, 1, toneRange);
      for (const v of nest.visitStrokes) {
        const age = clock - v.bornAt;
        const alpha = age < 250 ? age / 250 : 1;
        drawStroke(cx, cy, v, visitFill, alpha);
      }
    };

    const paint = (clock: number, toneRange: number, strokeRand: () => number) => {
      ctx.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
      ctx.clearRect(0, 0, e.w, e.h);
      ctx.fillStyle = rgbaStr(e.background, 1);
      ctx.fillRect(0, 0, e.w, e.h);
      for (const nest of e.nests) drawNest(nest, clock, toneRange, strokeRand);
    };

    const currentToneRange = () => (isLight() ? 0.12 : 0.08);

    const advance = (dtMs: number, strokeRand: () => number) => {
      e.clock += dtMs;
      for (const nest of e.nests) {
        let dt = dtMs;
        while (dt > 0 && !nest.capped) {
          const needed = nest.active.strokesNeeded - nest.strokesLaid;
          const msToFillLayer = needed * STROKE_INTERVAL_MS;
          if (dt < msToFillLayer) {
            nest.strokesLaid += dt / STROKE_INTERVAL_MS;
            dt = 0;
          } else {
            nest.strokesLaid = nest.active.strokesNeeded;
            dt -= msToFillLayer;
            const nextRadius = nest.active.radius + LAYER_STEP;
            nest.completed.push(nest.active);
            if (nextRadius >= e.capRadius) {
              nest.active = { radius: nextRadius, toneOffset: nest.active.toneOffset, strokesNeeded: 1 };
              nest.strokesLaid = 0;
              nest.capped = true;
            } else {
              nest.active = makeLayer(nextRadius, nest.layerSeed);
              nest.strokesLaid = 0;
            }
          }
        }
        if (nest.capped) {
          nest.strokesLaid = 1;
        }

        // wasp visits: a fresh batch inside the cutaway every 5-8s
        if (e.clock >= nest.nextVisitAt) {
          const rand = nest.layerSeed;
          const n = Math.round(lerp(VISIT_COUNT_MIN, VISIT_COUNT_MAX, rand()));
          for (let i = 0; i < n; i++) {
            const angle = nest.cutawayStart + rand() * nest.cutawayWidth;
            nest.visitStrokes.push({
              angle,
              radius: nest.active.radius,
              length: lerp(14, 22, rand()),
              width: lerp(5, 7, rand()),
              fanDeg: ((i * 14) % 42) - 21,
              bornAt: e.clock,
            });
          }
          nest.nextVisitAt = e.clock + lerp(VISIT_MIN_MS, VISIT_MAX_MS, rand());
        }

        // prune visit strokes once buried by further growth, or once the
        // list is capped in size (bounded memory across an unbounded loop)
        nest.visitStrokes = nest.visitStrokes.filter(
          (v) => nest.active.radius - v.radius < BURIED_DELTA
        );
        if (nest.visitStrokes.length > MAX_VISIT_STROKES_PER_NEST) {
          nest.visitStrokes = nest.visitStrokes.slice(-MAX_VISIT_STROKES_PER_NEST);
        }
      }
      void strokeRand;
    };

    const drawStatic = () => {
      // reduced motion: SHELL_MIDGROWTH — each nest frozen at ~55% of its
      // target radius, 5-6 banded layers, cutaway exposing clear internal
      // banding. Composed directly, never simulated forward from t0.
      const rand = mulberry32(9001);
      const nests = Array.from({ length: Math.max(1, e.nucleationCount) }, (_, i) => makeNest(i + 1, rand));
      for (const nest of nests) {
        const targetRadius = START_RADIUS + LAYER_STEP * 5.5;
        advanceNest(nest, (targetRadius - START_RADIUS) * (STROKE_INTERVAL_MS / LAYER_STEP), e.capRadius, rand);
        nest.strokesLaid = nest.active.strokesNeeded; // fully-laid front layer, mid-sweep look
      }
      const prev = e.nests;
      e.nests = nests;
      paint(0, currentToneRange(), rand);
      e.nests = prev;
    };

    resize();
    syncColors();

    if (reduced) {
      drawStatic();
    } else {
      const rand = mulberry32(7);
      e.rand = rand;
      e.clock = 0;
      for (const nest of e.nests) {
        // pre-seed each nest partway in so t0 already shows a small cluster
        // of strokes and an already-exposed (thin) cutaway
        advanceNest(nest, lerp(800, 2200, rand()), e.capRadius, rand);
        nest.nextVisitAt = lerp(1500, VISIT_MAX_MS, rand());
      }
      paint(e.clock, currentToneRange(), rand);
    }

    const loop = (now: number) => {
      const dtMs = Math.min(48, now - e.lastNow);
      e.lastNow = now;
      const rand = e.rand;
      if (!pausedRef.current) {
        advance(dtMs * speedRef.current, rand);
      }
      paint(e.clock, currentToneRange(), rand);
      e.raf = e.visible ? requestAnimationFrame(loop) : 0;
    };

    if (!reduced) {
      e.lastNow = performance.now();
      e.raf = requestAnimationFrame(loop);
    }

    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) drawStatic();
      else paint(e.clock, currentToneRange(), e.rand);
    });
    ro.observe(host);

    const io = new IntersectionObserver(
      ([entry]) => {
        e.visible = !!entry?.isIntersecting;
        if (e.visible && !reduced && !e.raf) {
          e.lastNow = performance.now();
          e.raf = requestAnimationFrame(loop);
        } else if (!e.visible && e.raf) {
          cancelAnimationFrame(e.raf);
          e.raf = 0;
        }
      },
      { threshold: 0 }
    );
    io.observe(host);

    const onVisibility = () => {
      if (document.hidden && e.raf) {
        cancelAnimationFrame(e.raf);
        e.raf = 0;
      } else if (!document.hidden && e.visible && !reduced && !e.raf) {
        e.lastNow = performance.now();
        e.raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const mo = new MutationObserver(() => {
      syncColors();
      if (reduced || !e.raf) {
        if (reduced) drawStatic();
        else paint(e.clock, currentToneRange(), e.rand);
      }
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      cancelAnimationFrame(e.raf);
      e.raf = 0;
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  return (
    <div ref={hostRef} className={`relative h-full w-full overflow-hidden ${className}`} style={style}>
      <canvas ref={canvasRef} aria-hidden role="presentation" className="pointer-events-none absolute inset-0 h-full w-full" />
      {children ? <div className="pointer-events-none absolute inset-0">{children}</div> : null}
    </div>
  );
}
