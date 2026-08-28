"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// VenturiEjectorDraw — an ambient "processing" loader shaped as an industrial
// Venturi vacuum ejector: motive air necks through a converging-diverging
// nozzle (throat = 22% of inlet width), speeds up sharply at the throat, and
// the low pressure it creates there visibly draws a second stream in from a
// side port just before the constriction. Two independent particle streams
// (14/s at the inlet, 6/s at the side port) ride a continuous px/s speed
// field derived from the nozzle's local width; a THIRD, single marked tracer
// cycles the whole nozzle once every 2.4s at full --foreground opacity
// against the ambient field's 55%, its throat crossing deliberately held to
// ~1.0s (a real ejector does it in 15-40ms — a ~30x decouple so the
// acceleration reads as a followable event, not a strobe).
//
// Zero colour literals: the nozzle outline is --ns-muted (structure has to
// survive light theme, --border alone is too faint here) and every particle
// is --foreground with alpha modulation only — the tracer is never
// accent-tinted, it is distinguished by luminance alone. Tokens are read via
// getComputedStyle on mount, before the first paint, and re-read on a
// MutationObserver watching documentElement's class. Geometry comes off the
// container's smaller dimension via a ResizeObserver, so the nozzle reads at
// card scale whatever the card's aspect ratio. prefers-reduced-motion runs
// the exact same deterministic simulation forward to the instant the tracer
// sits at throat centre, then freezes there — the single most
// density/speed-contrasted frame in the cycle.
// ---------------------------------------------------------------------------

export interface VenturiEjectorDrawProps {
  /** text announced via the component's own aria-live region */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
  /** inline styles merged onto the root element */
  style?: React.CSSProperties;
}

const TWO_PI = Math.PI * 2;

const RATE_MAIN = 14; // ambient inlet particles / second
const RATE_SIDE = 6; // entrainment side-stream particles / second
const THROAT_RATIO = 0.22; // throat width as a fraction of inlet width

const SPEED_INLET = 40; // px/s
const SPEED_THROAT = 260; // px/s
const SPEED_EXIT = 90; // px/s

const TRACER_PERIOD = 2.4; // s, full nozzle transit cadence
const TRACER_APPROACH = 0.7; // s, inlet -> throat zone start
const TRACER_THROAT = 1.0; // s, held throat crossing
const TRACER_DEPART = TRACER_PERIOD - TRACER_APPROACH - TRACER_THROAT; // 0.7s

// Cone/diffuser distance fractions are DERIVED, not guessed: the cone uses an
// ease-in cubic (starts at rest) and the diffuser a mirrored ease-out cubic
// (ends at rest), each solved so their instantaneous speed at the throat
// boundary exactly equals the throat's constant speed — zero velocity cliff
// at either seam, and the throat is unambiguously the fastest stretch (a
// cubic ramped up over 0.7s averages far below the flat speed it ramps INTO
// over just 1.0s). CONE_FRAC = 1 / (2 + 3*(TRACER_THROAT/TRACER_APPROACH)).
const CONE_FRAC = 1 / (2 + 3 * (TRACER_THROAT / TRACER_APPROACH));
const THROAT_FRAC = 1 - 2 * CONE_FRAC; // ~0.68 — the "throat" is a long, narrow mixing tube, not a pinch point

const SIDE_DURATION = 0.4; // s, side-port -> merge-point travel time

const AMBIENT_ALPHA = 0.55;
const TRACER_ALPHA = 1.0;
const TRAIL_LEN = 4;
const TRAIL_SAMPLE_S = 0.055; // s between recorded trail dots
const TRAIL_DECAY = [0.6, 0.35, 0.2, 0.1]; // index 0 = most recent historical dot

interface Pt {
  x: number;
  y: number;
}

interface MainParticle {
  x: number;
  lane: number; // -1..1 offset within local half-width
  vScale: number; // per-particle speed multiplier, ~0.85-1.15 — keeps the flow from marching in lockstep
  trail: Pt[];
  trailAcc: number;
}

interface SideParticle {
  t: number; // 0..1 progress from side port to merge point
  trail: Pt[];
  trailAcc: number;
}

interface Geom {
  ductLeft: number;
  ductRight: number;
  ductLen: number;
  centerY: number;
  inletHalf: number;
  throatHalf: number;
  exitHalf: number;
  throatX: number;
  coneEndX: number;
  diffStartX: number;
  sidePortX: number;
  sidePortY: number;
  mergeX: number;
  mergeLane: number;
  particleR: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

function smoothstep(t: number): number {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function computeGeom(w: number, h: number): Geom {
  const min = Math.min(w, h);
  const marginX = w * 0.05;
  const ductLeft = marginX;
  const ductRight = w - marginX;
  const ductLen = Math.max(1, ductRight - ductLeft);
  const centerY = h / 2;
  const inletHalf = Math.min(min * 0.34, h * 0.46);
  const throatHalf = inletHalf * THROAT_RATIO;
  const exitHalf = inletHalf;
  const throatX = ductLeft + ductLen * 0.5;
  const throatZoneHalf = (ductLen * THROAT_FRAC) / 2;
  const coneEndX = throatX - throatZoneHalf;
  const diffStartX = throatX + throatZoneHalf;
  const sidePortX = coneEndX - ductLen * 0.05;
  const sideT = clamp01((sidePortX - ductLeft) / Math.max(1, coneEndX - ductLeft));
  // Must match widthHalfAt's cone easing (smoothstep, not the old cubic) so
  // this anchor and drawOutline's wallY agree — otherwise the "stub" stretches
  // from wherever this landed down to the actual wall, sometimes off-canvas.
  const sideWallHalf = lerp(inletHalf, throatHalf, smoothstep(sideT));
  const sidePortY = centerY - sideWallHalf - inletHalf * 0.45;
  const mergeX = throatX - throatZoneHalf * 0.9;
  const cell = min / 40;
  return {
    ductLeft,
    ductRight,
    ductLen,
    centerY,
    inletHalf,
    throatHalf,
    exitHalf,
    throatX,
    coneEndX,
    diffStartX,
    sidePortX,
    sidePortY,
    mergeX,
    mergeLane: -0.6,
    // floored above the raw cell-derived value so very small card slots
    // (e.g. a compact grid tile) still read as dots and a hairline, not noise
    particleR: Math.max(1.4, cell * 0.42),
  };
}

// Cosmetic only — feeds the drawn outline and particle y-placement, nothing
// in scheduleX or the zone-length solve reads it, so the taper can be spread
// smoothly across the whole cone instead of back-loaded into its end.
function widthHalfAt(g: Geom, x: number): number {
  if (x <= g.coneEndX) {
    const t = clamp01((x - g.ductLeft) / Math.max(1, g.coneEndX - g.ductLeft));
    return lerp(g.inletHalf, g.throatHalf, smoothstep(t));
  }
  if (x < g.diffStartX) return g.throatHalf;
  const t = clamp01((x - g.diffStartX) / Math.max(1, g.ductRight - g.diffStartX));
  return lerp(g.throatHalf, g.exitHalf, smoothstep(t));
}

// Ambient particle speed only. Cubic (not smoothstep) keeps particles slow
// and bunched near the inlet — the density gradient the resting loop wants —
// independent of widthHalfAt's now-smoother cosmetic taper.
function speedAt(g: Geom, x: number): number {
  if (x <= g.coneEndX) {
    const t = clamp01((x - g.ductLeft) / Math.max(1, g.coneEndX - g.ductLeft));
    return lerp(SPEED_INLET, SPEED_THROAT, t ** 3);
  }
  if (x < g.diffStartX) return SPEED_THROAT;
  const t = clamp01((x - g.diffStartX) / Math.max(1, g.ductRight - g.diffStartX));
  return lerp(SPEED_THROAT, SPEED_EXIT, smoothstep(t));
}

/** Marked tracer's authored schedule: a fixed 0.7s / 1.0s / 0.7s split whose
 * geometry (CONE_FRAC/THROAT_FRAC) was solved so instantaneous speed is
 * continuous at both seams — ease-in cubic through the cone (starts at
 * rest, exits at exactly the throat's constant speed), linear through the
 * throat (that same speed, held), mirrored ease-out cubic through the
 * diffuser (enters at that speed, eases to rest at the exit). No cliff at
 * either boundary, and the throat is unambiguously the fastest stretch.
 * phase === TRACER_APPROACH + TRACER_THROAT/2 lands it exactly at throat
 * centre (used by the reduced-motion freeze). */
function scheduleX(g: Geom, phase: number): number {
  const coneDist = g.coneEndX - g.ductLeft;
  const throatDist = g.diffStartX - g.coneEndX;
  const diffDist = g.ductRight - g.diffStartX;
  if (phase < TRACER_APPROACH) {
    const t = phase / TRACER_APPROACH;
    return g.ductLeft + coneDist * t ** 3;
  }
  if (phase < TRACER_APPROACH + TRACER_THROAT) {
    const t = (phase - TRACER_APPROACH) / TRACER_THROAT;
    return g.coneEndX + throatDist * t;
  }
  const t = (phase - TRACER_APPROACH - TRACER_THROAT) / TRACER_DEPART;
  return g.diffStartX + diffDist * (1 - (1 - t) ** 3);
}

function pushTrail(trail: Pt[], pt: Pt): void {
  trail.push(pt);
  if (trail.length > TRAIL_LEN) trail.shift();
}

export function VenturiEjectorDraw({ label = "Processing", className = "", style }: VenturiEjectorDrawProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let mutedStyle = "#4d4d4d";
    let fgStyle = "#171717";

    // -- token read: happens synchronously, before any resize or paint.
    // Assigned to fillStyle/strokeStyle verbatim (whatever colour syntax the
    // token actually holds — hex, oklch, hsl) and alpha is modulated with
    // globalAlpha rather than a parsed-then-rebuilt rgba() string, so this
    // never depends on a specific token format. ----------------------------
    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      mutedStyle = cs.getPropertyValue("--ns-muted").trim() || mutedStyle;
      fgStyle = cs.getPropertyValue("--foreground").trim() || fgStyle;
    };
    readTokens();

    let disposed = false;
    let w = 0;
    let h = 0;
    let sized = false;
    let dpr = 1;
    let geom = computeGeom(1, 1);

    const rand = mulberry32(0xc0ffee);

    let mainParticles: MainParticle[] = [];
    let sideParticles: SideParticle[] = [];
    let emitMainAcc = 0;
    let emitSideAcc = 0;
    let tracerPhase = 0;
    let tracerTrail: Pt[] = [];
    let tracerTrailAcc = 0;

    const resetSim = () => {
      mainParticles = [];
      sideParticles = [];
      emitMainAcc = 0;
      emitSideAcc = 0;
      tracerPhase = 0;
      tracerTrail = [];
      tracerTrailAcc = 0;
    };

    const mainXY = (p: MainParticle): Pt => ({
      x: p.x,
      y: geom.centerY + p.lane * widthHalfAt(geom, p.x) * 0.82,
    });

    const sideXY = (p: SideParticle): Pt => {
      const t = smoothstep(p.t);
      const mergeY = geom.centerY + geom.mergeLane * widthHalfAt(geom, geom.mergeX) * 0.82;
      return {
        x: lerp(geom.sidePortX, geom.mergeX, t),
        y: lerp(geom.sidePortY, mergeY, t),
      };
    };

    const tracerXY = (): Pt => ({ x: scheduleX(geom, tracerPhase), y: geom.centerY });

    const step = (dt: number) => {
      emitMainAcc += dt * RATE_MAIN;
      while (emitMainAcc >= 1) {
        mainParticles.push({
          x: geom.ductLeft,
          lane: (rand() * 2 - 1) * 0.9,
          vScale: 0.85 + rand() * 0.3,
          trail: [],
          trailAcc: 0,
        });
        emitMainAcc -= 1;
      }

      emitSideAcc += dt * RATE_SIDE;
      while (emitSideAcc >= 1) {
        sideParticles.push({ t: 0, trail: [], trailAcc: 0 });
        emitSideAcc -= 1;
      }

      const nextSide: SideParticle[] = [];
      for (const p of sideParticles) {
        p.t += dt / SIDE_DURATION;
        p.trailAcc += dt;
        if (p.trailAcc >= TRAIL_SAMPLE_S) {
          pushTrail(p.trail, sideXY(p));
          p.trailAcc -= TRAIL_SAMPLE_S;
        }
        if (p.t >= 1) {
          mainParticles.push({
            x: geom.mergeX,
            lane: geom.mergeLane + (rand() - 0.5) * 0.3,
            vScale: 0.85 + rand() * 0.3,
            trail: p.trail,
            trailAcc: p.trailAcc,
          });
        } else {
          nextSide.push(p);
        }
      }
      sideParticles = nextSide;

      const nextMain: MainParticle[] = [];
      for (const p of mainParticles) {
        p.x += speedAt(geom, p.x) * p.vScale * dt;
        p.trailAcc += dt;
        if (p.trailAcc >= TRAIL_SAMPLE_S) {
          pushTrail(p.trail, mainXY(p));
          p.trailAcc -= TRAIL_SAMPLE_S;
        }
        if (p.x <= geom.ductRight) nextMain.push(p);
      }
      mainParticles = nextMain;

      tracerPhase += dt;
      if (tracerPhase >= TRACER_PERIOD) {
        tracerPhase -= TRACER_PERIOD;
        // clear the trail on wrap — otherwise a ghost cluster lingers at the
        // exit for ~220ms while a fresh dot appears at the inlet, reading as
        // two tracers instead of one.
        tracerTrail.length = 0;
        tracerTrailAcc = 0;
      }
      tracerTrailAcc += dt;
      if (tracerTrailAcc >= TRAIL_SAMPLE_S) {
        pushTrail(tracerTrail, tracerXY());
        tracerTrailAcc -= TRAIL_SAMPLE_S;
      }
    };

    const drawDot = (pt: Pt, alpha: number) => {
      ctx.beginPath();
      ctx.fillStyle = fgStyle;
      ctx.globalAlpha = alpha;
      ctx.arc(pt.x, pt.y, geom.particleR, 0, TWO_PI);
      ctx.fill();
      ctx.globalAlpha = 1;
    };

    const drawStream = (trail: Pt[], current: Pt, baseAlpha: number) => {
      for (let i = 0; i < trail.length; i++) {
        const posFromNewest = trail.length - 1 - i;
        const decay = TRAIL_DECAY[posFromNewest] ?? 0;
        drawDot(trail[i], baseAlpha * decay);
      }
      drawDot(current, baseAlpha);
    };

    const drawOutline = () => {
      ctx.strokeStyle = mutedStyle;
      ctx.lineWidth = Math.max(1.2, geom.particleR * 0.6);
      ctx.lineJoin = "round";

      const samples = 40;
      for (const sign of [-1, 1] as const) {
        ctx.beginPath();
        for (let i = 0; i <= samples; i++) {
          const x = lerp(geom.ductLeft, geom.ductRight, i / samples);
          const y = geom.centerY + sign * widthHalfAt(geom, x);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // inlet / exit caps
      ctx.beginPath();
      ctx.moveTo(geom.ductLeft, geom.centerY - geom.inletHalf);
      ctx.lineTo(geom.ductLeft, geom.centerY + geom.inletHalf);
      ctx.moveTo(geom.ductRight, geom.centerY - geom.exitHalf);
      ctx.lineTo(geom.ductRight, geom.centerY + geom.exitHalf);
      ctx.stroke();

      // side (entrainment) port stub
      const wallY = geom.centerY - widthHalfAt(geom, geom.sidePortX);
      ctx.beginPath();
      ctx.moveTo(geom.sidePortX, wallY);
      ctx.lineTo(geom.sidePortX, geom.sidePortY);
      ctx.stroke();
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      drawOutline();
      for (const p of sideParticles) drawStream(p.trail, sideXY(p), AMBIENT_ALPHA);
      for (const p of mainParticles) drawStream(p.trail, mainXY(p), AMBIENT_ALPHA);
      drawStream(tracerTrail, tracerXY(), TRACER_ALPHA);
    };

    // Deterministic fixed-timestep advance, reused by both the reduced-motion
    // freeze and the live path's pre-paint warm-up — a fresh nozzle must
    // never render as an empty outline (the resting loop's t0 requires
    // particles "distributed across the whole nozzle" already).
    const warmup = (seconds: number) => {
      const FIXED_DT = 1 / 60;
      let t = 0;
      while (t < seconds) {
        step(FIXED_DT);
        t += FIXED_DT;
      }
    };

    // Exactly 2 full cycles + half the throat segment: the tracer's phase
    // lands at TRACER_APPROACH + TRACER_THROAT/2, which scheduleX resolves
    // to precisely throat centre (see scheduleX) — the most structured
    // single frame in the cycle.
    const REDUCED_FREEZE_S = TRACER_PERIOD * 2 + TRACER_APPROACH + TRACER_THROAT / 2;

    const startLive = () => {
      resetSim();
      if (reducedRef.current) {
        warmup(REDUCED_FREEZE_S);
        draw();
        return;
      }
      // 1-2 randomized cycles so ambient density/lane variety and the
      // tracer's resting phase differ between mounts, and the field already
      // reads as flowing before the very first painted frame.
      warmup(TRACER_PERIOD * (1 + rand()));
      last = 0;
      if (visible && !raf) raf = requestAnimationFrame(loop);
    };

    let lastW = 0;
    let lastH = 0;

    const resize = () => {
      const rect = root.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      if (w < 2 || h < 2) {
        sized = false;
        return;
      }
      // ResizeObserver fires an initial callback on observe() even when
      // nothing changed — skip the reset+warm-up (and the fresh rand() draw
      // it consumes) unless the size actually moved, or the field visibly
      // teleports to a new random configuration ~100ms after mount.
      if (sized && Math.abs(w - lastW) < 1 && Math.abs(h - lastH) < 1) return;
      lastW = w;
      lastH = h;
      sized = true;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      geom = computeGeom(w, h);
      cancelAnimationFrame(raf);
      raf = 0;
      startLive();
    };

    let raf = 0;
    let last = 0;
    let visible = true;

    const loop = (now: number) => {
      raf = 0;
      if (!visible || !sized || reducedRef.current) return;
      if (last === 0) last = now;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      step(dt);
      draw();
      raf = requestAnimationFrame(loop);
    };

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reducedRef = { current: mq.matches };
    const onMq = () => {
      reducedRef.current = mq.matches;
      if (!sized) return;
      cancelAnimationFrame(raf);
      raf = 0;
      startLive();
    };
    mq.addEventListener("change", onMq);

    resize();

    let resizeTimer = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (!disposed) resize();
      }, 100);
    });
    ro.observe(root);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && sized && !reducedRef.current && !raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(root);

    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (visible && sized && !reducedRef.current && !raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const themeObserver = new MutationObserver(() => {
      readTokens();
      if (reducedRef.current && sized) draw();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
      ro.disconnect();
      io.disconnect();
      themeObserver.disconnect();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      role="status"
      aria-live="polite"
      data-venturi-ejector-draw
      className={`relative overflow-hidden ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="block h-full w-full" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

VenturiEjectorDraw.displayName = "VenturiEjectorDraw";
