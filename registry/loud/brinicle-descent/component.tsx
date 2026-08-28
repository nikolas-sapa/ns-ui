"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// BrinicleDescent — a full-bleed underwater backdrop grown from a real polar
// mechanic: brine rejected by newly forming sea ice sinks as a dense, cold
// plume, and because that plume sits at or below the surrounding water's
// freezing point a thin ice sheath nucleates and grows AROUND it, extending
// the plume downward as a hollow tube (a "brinicle" / ice stalactite —
// documented in Antarctic/Arctic time-lapse footage and brine-drainage-channel
// literature, e.g. Dayton & Martin 1971). Field/time-lapse descent rates
// cluster 0.3-1.5 m/hr; sheath radius grows diffusion-limited (Stefan-problem
// sqrt(t)) — thickest near the ceiling where a point has existed longest,
// thinnest at the active tip. On reaching the seafloor the plume spreads into
// an expanding freeze halo. A single downwelling site is transient: a tube
// thickens, eventually detaches from the ice above and drifts off, while new
// sites keep nucleating fresh tips elsewhere — never a single one-shot event.
//
// COMPRESSION: rendering ~2.5m of real water column, real descent at
// 0.3-1.5 m/hr would take 1.7-8.3 hours to cross this frame. That is
// compressed into an 8s on-screen descent (~1900-2900x real time) —
// disclosed here rather than hidden, since this is an illustrative ambient
// process, not a literal countdown.
//
// LIFECYCLE (per tube, a small state machine, several running staggered and
// overlapping so the pane is never empty): descend (8s, tip travels top to
// bottom) -> touchdown (a freeze halo expands/holds/fades at the seafloor,
// 4.4s total, while the sheath keeps thickening) -> detach (the ceiling
// attachment opens a gap, then the whole tube drifts down and fades, 1.9s) ->
// removed, while a NEW tip nucleates elsewhere 3-6s after the prior tube
// entered touchdown, so lifecycles overlap and the scene never resets empty.
// The pane is pre-seeded at mount with tubes already mid-lifecycle (negative
// phase-start offsets) rather than starting from a blank column, so t0 is
// already alive.
//
// SHEATH RADIUS: for a point at height y on a tube, depositElapsed is when
// the descending tip passed that y (linear in y along the 8s descent); its
// age is (current time since descent start) - depositElapsed, and radius is
// minR + (maxR-minR)*sqrt(clamp(age/8000, 0, 1)) — the ceiling end (oldest)
// saturates toward maxR while the tip stays thin, and the whole tube keeps
// visibly thickening for a while even after the tip stops moving.
//
// TOKENS AND THE THEME INVERSION: colors come only from --background,
// --foreground, --ns-muted, --border via getComputedStyle(documentElement),
// re-read on a MutationObserver watching its class. No manual "if dark
// theme" branch anywhere: the water wash is mix(background, muted, 0.3) and
// the tube core is mix(muted, foreground, 0.6) — because --foreground itself
// already flips (near-white ink in dark theme, near-black ink in light
// theme), mixing toward it automatically makes the tube read BRIGHT against
// dark water and DARK against pale water, the correct per-theme inversion,
// for free (the same trick dye-whorl uses, applied here without any explicit
// theme check). The tube's rim (its strongest edge) is always drawn in pure
// --foreground — the extreme ink value in whichever direction the theme
// points. --ns-accent never appears; the touchdown halo's climactic flash is
// pure luminance from --foreground.
//
// HOST: DPR-aware canvas sized off the host's own bounding box (never
// window.resize), capped at 2. ResizeObserver re-sizes; IntersectionObserver
// (threshold 0) and visibilitychange stop the single rAF loop when offscreen
// or hidden; MutationObserver re-reads tokens and, when the loop itself is
// stopped (reduced motion), repaints the frozen frame with the new colors.
// prefers-reduced-motion composes and draws exactly one still frame: one
// tube ~60% down its descent (thickened sheath, active tip) plus a second,
// younger tip freshly nucleated near the top — the most structurally
// complete single frame, never the near-empty literal t0.
// ---------------------------------------------------------------------------

type Phase = "descend" | "touchdown" | "detach";

interface Tube {
  id: number;
  x0: number; // nucleation x, 0..1 fraction of width
  phase: Phase;
  phaseStart: number; // engine clock ms when the CURRENT phase began
  descendStart: number; // engine clock ms when descent began (fixed for the tube's life)
  seedA: number; // wobble phase
  seedB: number; // reserved jitter
}

type RGB = [number, number, number];

const DESCEND_MS = 8000;
const HALO_EXPAND_MS = 1800;
const HALO_HOLD_MS = 600;
const HALO_FADE_MS = 2000;
const HALO_TOTAL_MS = HALO_EXPAND_MS + HALO_HOLD_MS + HALO_FADE_MS;
const DETACH_GAP_MS = 400;
const DETACH_DRIFT_MS = 1500;
const DETACH_TOTAL_MS = DETACH_GAP_MS + DETACH_DRIFT_MS;
const SPAWN_MIN_MS = 3000;
const SPAWN_MAX_MS = 6000;
const SAMPLES = 22;

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function easeOutCubic(t: number) {
  const u = 1 - t;
  return 1 - u * u * u;
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
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${Math.max(0, a)})`;
}

function mixRgb(a: RGB, b: RGB, t: number): RGB {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
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

function makeTube(id: number, rand: () => number, phaseStart: number): Tube {
  return {
    id,
    x0: lerp(0.12, 0.88, rand()),
    phase: "descend",
    phaseStart,
    descendStart: phaseStart,
    seedA: rand() * 1000,
    seedB: rand() * 1000,
  };
}

export interface BrinicleDescentProps {
  /** max concurrent brinicles, 2-4. @default 3 */
  density?: number;
  /** clock speed multiplier. @default 1 */
  speed?: number;
  /** freeze the simulation in place without unmounting it. @default false */
  paused?: boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function BrinicleDescent({
  density = 3,
  speed = 1,
  paused = false,
  children,
  className = "",
  style,
}: BrinicleDescentProps) {
  const reduced = useReducedMotion();
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const densityRef = useRef(density);
  densityRef.current = Math.round(Math.min(4, Math.max(2, density)));
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const engineRef = useRef({
    w: 0,
    h: 0,
    dpr: 1,
    clock: 0,
    nextSpawnAt: 4000,
    nextId: 1,
    tubes: [] as Tube[],
    raf: 0,
    lastNow: 0,
    visible: true,
    reduced: false,
    background: [10, 10, 10] as RGB,
    foreground: [237, 237, 237] as RGB,
    muted: [141, 141, 141] as RGB,
    rand: mulberry32(1),
  });

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const e = engineRef.current;

    const syncColors = () => {
      const root = document.documentElement;
      e.background = readToken(root, "--background", e.background);
      e.foreground = readToken(root, "--foreground", e.foreground);
      e.muted = readToken(root, "--ns-muted", e.muted);
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
    };

    // Draw one tube (sheath + rim) and, while in touchdown, its freeze halo.
    const drawTube = (tube: Tube, clock: number) => {
      const minDim = Math.min(e.w, e.h);
      const minR = minDim / 180;
      const maxR = minDim / 70;
      const topY = e.h * 0.06;
      const bottomY = e.h * 0.94;
      const columnH = bottomY - topY;
      const wobbleAmp = minDim * 0.018;
      const wobbleFreq = 0.018;

      const descendAge = clamp01((clock - tube.descendStart) / DESCEND_MS) * DESCEND_MS;
      const tipY = topY + columnH * (descendAge / DESCEND_MS);

      let topCut = topY;
      let dyOffset = 0;
      let globalAlpha = 1;

      if (tube.phase === "detach") {
        const age = clock - tube.phaseStart;
        if (age <= DETACH_GAP_MS) {
          const t = age / DETACH_GAP_MS;
          topCut = topY + columnH * 0.05 * t;
        } else {
          topCut = topY + columnH * 0.05;
          const t2 = clamp01((age - DETACH_GAP_MS) / DETACH_DRIFT_MS);
          dyOffset = 40 * t2;
          globalAlpha = 1 - t2;
        }
      }

      if (globalAlpha <= 0.002) return;

      const xAt = (y: number) => e.w * tube.x0 + wobbleAmp * Math.sin(y * wobbleFreq + tube.seedA);
      const radiusAt = (y: number) => {
        const depositElapsed = ((y - topY) / columnH) * DESCEND_MS;
        const age = clamp01((clock - tube.descendStart - depositElapsed) / DESCEND_MS) * DESCEND_MS;
        return minR + (maxR - minR) * Math.sqrt(age / DESCEND_MS);
      };

      const from = Math.min(topCut, tipY);
      const to = Math.max(topCut, tipY);
      if (to - from < 1) return;

      const pts: { x: number; y: number; r: number }[] = [];
      for (let i = 0; i <= SAMPLES; i++) {
        const y = lerp(from, to, i / SAMPLES);
        pts.push({ x: xAt(y), y: y + dyOffset, r: radiusAt(y) });
      }

      const core = mixRgb(e.muted, e.foreground, 0.6);
      ctx.fillStyle = rgbaStr(core, 0.85 * globalAlpha);
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]!;
        if (i === 0) ctx.moveTo(p.x - p.r, p.y);
        else ctx.lineTo(p.x - p.r, p.y);
      }
      for (let i = pts.length - 1; i >= 0; i--) {
        const p = pts[i]!;
        ctx.lineTo(p.x + p.r, p.y);
      }
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = rgbaStr(e.foreground, 0.45 * globalAlpha);
      ctx.lineWidth = 1;
      ctx.beginPath();
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x - p.r, p.y) : ctx.lineTo(p.x - p.r, p.y)));
      ctx.stroke();
      ctx.beginPath();
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x + p.r, p.y) : ctx.lineTo(p.x + p.r, p.y)));
      ctx.stroke();

      if (tube.phase === "touchdown") {
        const age = clock - tube.phaseStart;
        const tipX = xAt(bottomY);
        let r = 2;
        let a = 0;
        if (age < HALO_EXPAND_MS) {
          const t = age / HALO_EXPAND_MS;
          r = lerp(2, minDim * 0.15, easeOutCubic(t));
          a = 0.85 * t;
        } else if (age < HALO_EXPAND_MS + HALO_HOLD_MS) {
          r = minDim * 0.15;
          a = 0.85;
        } else {
          r = minDim * 0.15;
          const t = clamp01((age - HALO_EXPAND_MS - HALO_HOLD_MS) / HALO_FADE_MS);
          a = 0.85 * (1 - t);
        }
        if (a > 0.002) {
          const grad = ctx.createRadialGradient(tipX, bottomY, 0, tipX, bottomY, Math.max(1, r));
          grad.addColorStop(0, rgbaStr(e.foreground, a));
          grad.addColorStop(1, rgbaStr(e.foreground, 0));
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(tipX, bottomY, Math.max(1, r), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const paint = (clock: number) => {
      ctx.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
      const water = mixRgb(e.background, e.muted, 0.3);
      ctx.fillStyle = rgbaStr(water, 1);
      ctx.fillRect(0, 0, e.w, e.h);
      for (const tube of e.tubes) drawTube(tube, clock);
    };

    const advance = (dtMs: number) => {
      e.clock += dtMs;
      const maxTubes = densityRef.current;

      for (const tube of e.tubes) {
        const age = e.clock - tube.phaseStart;
        if (tube.phase === "descend" && age >= DESCEND_MS) {
          tube.phase = "touchdown";
          tube.phaseStart = e.clock;
        } else if (tube.phase === "touchdown" && age >= HALO_TOTAL_MS) {
          tube.phase = "detach";
          tube.phaseStart = e.clock;
        }
      }
      e.tubes = e.tubes.filter((t) => !(t.phase === "detach" && e.clock - t.phaseStart >= DETACH_TOTAL_MS));

      if (e.tubes.length === 0) {
        e.tubes.push(makeTube(e.nextId++, e.rand, e.clock));
        e.nextSpawnAt = e.clock + lerp(SPAWN_MIN_MS, SPAWN_MAX_MS, e.rand());
      } else if (e.clock >= e.nextSpawnAt && e.tubes.length < maxTubes) {
        e.tubes.push(makeTube(e.nextId++, e.rand, e.clock));
        e.nextSpawnAt = e.clock + lerp(SPAWN_MIN_MS, SPAWN_MAX_MS, e.rand());
      }
    };

    const drawStatic = () => {
      // reduced motion: one composed still frame — one tube ~60% down its
      // descent (thickened sheath, active tip) plus a younger tip just
      // nucleated near the top. Built directly, never simulated forward.
      const rand = mulberry32(9001);
      const tubes: Tube[] = [
        { id: 1, x0: 0.34, phase: "descend", phaseStart: -DESCEND_MS * 0.6, descendStart: -DESCEND_MS * 0.6, seedA: rand() * 1000, seedB: 0 },
        { id: 2, x0: 0.68, phase: "descend", phaseStart: -300, descendStart: -300, seedA: rand() * 1000, seedB: 0 },
      ];
      const prevTubes = e.tubes;
      e.tubes = tubes;
      paint(0);
      e.tubes = prevTubes;
    };

    resize();
    syncColors();
    e.reduced = reduced;

    if (reduced) {
      drawStatic();
    } else {
      // pre-seed with tubes already mid-lifecycle so t0 is already alive,
      // never a blank column.
      const rand = mulberry32(7);
      e.rand = rand;
      e.clock = 0;
      e.tubes = [
        makeTube(e.nextId++, rand, -DESCEND_MS * 0.7),
        makeTube(e.nextId++, rand, -DESCEND_MS * 0.2),
      ];
      e.nextSpawnAt = lerp(SPAWN_MIN_MS, SPAWN_MAX_MS, rand());
      paint(e.clock);
    }

    const loop = (now: number) => {
      const dtMs = Math.min(48, now - e.lastNow);
      e.lastNow = now;
      if (!pausedRef.current) {
        advance(dtMs * speedRef.current);
      }
      paint(e.clock);
      e.raf = e.visible ? requestAnimationFrame(loop) : 0;
    };

    if (!reduced) {
      e.lastNow = performance.now();
      e.raf = requestAnimationFrame(loop);
    }

    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) drawStatic();
      else paint(e.clock);
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
        else paint(e.clock);
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
