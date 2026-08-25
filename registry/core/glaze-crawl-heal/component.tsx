"use client";

import { useLayoutEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// GlazeCrawlHeal — a live status badge drawn as a glaze surface mid-firing,
// not three arbitrary colour chips. In a kiln the glaze goes molten and gas
// bubbles rise through the melt and burst at the surface, leaving craters;
// whether the melt's viscosity and surface tension let it FLOW BACK over
// that crater (heals smooth) or not (crawling — the glaze pulls away from
// the body into a bare patch that never closes) is a real, named ceramics
// defect, not an invented metaphor. That gives the badge one physical state
// axis instead of a colour code: healthy = bubbles burst and heal in well
// under a second; degraded = the melt is thicker, craters linger for
// seconds before closing; down = surface tension has failed outright —
// bubbles still burst (gas still escapes) but the melt never flows back, so
// ragged, beaded-rim bare patches accumulate and persist. Unlike craze-rule
// (a static fracture-crack divider that draws in once and idles), this has
// no crack geometry at all — it is continuous bubble nucleation, bursting
// and healing/failing-to-heal, forever, because the glaze stays molten for
// as long as the system is up. The canvas is pure decoration on top of a
// real, always-present text status (STATUS_LABEL) inside a role="status"
// aria-live region — colour never carries the message alone. Ink is read
// once via getComputedStyle(canvas).color (the canvas carries text-
// foreground) in useLayoutEffect, before first paint, and re-read on a
// documentElement class MutationObserver; craters/patches are punched with
// globalCompositeOperation="destination-out" rather than painted in a
// second token, so a "hole" always reveals whatever sits behind the badge —
// dark-on-light in light theme, light-on-dark in dark, for free. Zero deps,
// one DPR-capped canvas, one rAF loop paused on prefers-reduced-motion,
// tab-hidden and unmount.
// ---------------------------------------------------------------------------

export type GlazeStatus = "healthy" | "degraded" | "down";

export interface GlazeCrawlHealProps {
  /** the kiln state to render. default "healthy". */
  status?: GlazeStatus;
  /**
   * accessible text announced via the component's own role="status" region
   * on every change. Defaults to the plain status name ("Operational").
   */
  label?: string;
  /** render `label` as a visible text node beside the badge (still announced either way). default true — a status control's text is not optional. */
  showLabel?: boolean;
  /** badge diameter in px. Reads down to ~14; below that the mechanic itself stops resolving and only the text still carries the state — see component header. default 16. */
  size?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const STATUS_LABEL: Record<GlazeStatus, string> = {
  healthy: "Operational",
  degraded: "Degraded",
  down: "Down",
};

const TAU = Math.PI * 2;
const JAG_POINTS = 11; // ragged-edge vertex count for a crawled (bare) patch

// Per-status kiln parameters. healMs is the viscosity/surface-tension read:
// short = fluid enough to close fast, long = it only just manages to close.
// A "down" patch never gets a healMs of its own — it doesn't heal — until
// the badge recovers to a status that has one (see the status-change effect
// below), at which point the melt finally flows back over it.
const BUBBLE_CONFIG: Record<
  "healthy" | "degraded",
  {
    spawnMs: [number, number];
    openMs: number;
    healMs: [number, number];
    maxRFrac: number;
    maxConcurrent: number;
  }
> = {
  healthy: { spawnMs: [650, 1500], openMs: 150, healMs: [350, 550], maxRFrac: 0.3, maxConcurrent: 1 },
  degraded: { spawnMs: [1100, 2200], openMs: 220, healMs: [1700, 3100], maxRFrac: 0.42, maxConcurrent: 2 },
};
const PATCH_CONFIG = {
  spawnMs: [900, 1800] as [number, number],
  creepTauMs: 1300,
  maxRFrac: 0.52,
  maxConcurrent: 3,
};

function easeOutCubic(t: number) {
  const p = 1 - t;
  return 1 - p * p * p;
}
function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** mulberry32 — small, fast, deterministic given a seed */
function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** per-vertex radius multipliers (0.72..1.06) for a crawled patch's ragged rim */
function makeJag(seed: number): number[] {
  const rng = mulberry32(seed);
  const out: number[] = [];
  for (let i = 0; i < JAG_POINTS; i++) out.push(0.72 + rng() * 0.34);
  return out;
}

// fixed seeds -> deterministic, byte-stable jag shapes for the
// prefers-reduced-motion freeze frame (no Math.random there, ever).
const DOWN_JAG_A = makeJag(101);
const DOWN_JAG_B = makeJag(202);

type Feature = {
  kind: "bubble" | "patch";
  x: number;
  y: number; // offset from disc centre, CSS px
  maxR: number; // CSS px
  bornAt: number;
  openMs: number;
  healMs: number; // set once healing begins; Infinity/unused until then
  healingSince: number | null;
  healStartR: number;
  creepTau: number;
  wobblePhase: number;
  jag: number[] | null; // null = perfect circle (bubble); set = ragged patch
};

type DrawSpec = {
  x: number;
  y: number;
  r: number;
  jag: number[] | null;
  rimAlpha: number;
  flash: number;
};

function drawFeature(
  ctx: CanvasRenderingContext2D,
  ink: string,
  cx: number,
  cy: number,
  R0: number,
  f: DrawSpec,
) {
  if (f.r <= 0.3) return;
  ctx.save();
  ctx.translate(cx + f.x, cy + f.y);

  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  if (f.jag) {
    for (let i = 0; i < JAG_POINTS; i++) {
      const a = (i / JAG_POINTS) * TAU;
      const rad = f.r * f.jag[i]!;
      const px = Math.cos(a) * rad;
      const py = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else {
    ctx.arc(0, 0, f.r, 0, TAU);
  }
  ctx.fill();

  ctx.globalCompositeOperation = "source-over";
  if (f.jag) {
    // beaded rim: glaze that pulled away balls up at the receding edge
    // instead of flowing back — the visible signature of crawling.
    ctx.fillStyle = ink;
    for (let i = 0; i < JAG_POINTS; i++) {
      const a = (i / JAG_POINTS) * TAU;
      const rad = f.r * f.jag[i]!;
      const px = Math.cos(a) * rad;
      const py = Math.sin(a) * rad;
      ctx.globalAlpha = 0.5 + 0.35 * ((i * 5) % 4) / 4;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(0.55, R0 * 0.045), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (f.rimAlpha > 0) {
    // healing crater's raised lip
    ctx.strokeStyle = ink;
    ctx.globalAlpha = f.rimAlpha;
    ctx.lineWidth = Math.max(0.6, R0 * 0.05);
    ctx.beginPath();
    ctx.arc(0, 0, f.r + R0 * 0.02, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (f.flash > 0) {
    ctx.strokeStyle = ink;
    ctx.globalAlpha = f.flash;
    ctx.lineWidth = Math.max(0.8, R0 * 0.09);
    ctx.beginPath();
    ctx.arc(0, 0, f.r * 1.02, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function renderFrame(
  ctx: CanvasRenderingContext2D,
  ink: string,
  w: number,
  h: number,
  cx: number,
  cy: number,
  R0: number,
  sheenAngle: number,
  specs: DrawSpec[],
) {
  ctx.clearRect(0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = ink;
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, R0, 0, TAU);
  ctx.fill();

  // a slow-drifting specular dim patch — the melt still reads as liquid in
  // the gaps between bubble events, never a flat dead disc.
  ctx.globalCompositeOperation = "destination-out";
  const sx = cx + Math.cos(sheenAngle) * R0 * 0.5;
  const sy = cy + Math.sin(sheenAngle) * R0 * 0.5;
  ctx.globalAlpha = 0.08;
  ctx.beginPath();
  ctx.ellipse(sx, sy, R0 * 0.42, R0 * 0.3, sheenAngle, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  for (const f of specs) drawFeature(ctx, ink, cx, cy, R0, f);
}

/** deterministic freeze frame per status — craters/patches at varied stages of healing, never mid-t0 */
function staticSpecs(status: GlazeStatus, R0: number): DrawSpec[] {
  if (status === "healthy") {
    const maxR = R0 * BUBBLE_CONFIG.healthy.maxRFrac;
    return [
      { x: -R0 * 0.3, y: -R0 * 0.12, r: maxR * 0.55, jag: null, rimAlpha: 0.35, flash: 0 },
      { x: R0 * 0.34, y: R0 * 0.28, r: maxR * 0.15, jag: null, rimAlpha: 0.45, flash: 0 },
    ];
  }
  if (status === "degraded") {
    const maxR = R0 * BUBBLE_CONFIG.degraded.maxRFrac;
    return [
      { x: -R0 * 0.3, y: -R0 * 0.22, r: maxR * 0.92, jag: null, rimAlpha: 0.5, flash: 0 },
      { x: R0 * 0.28, y: R0 * 0.1, r: maxR * 0.55, jag: null, rimAlpha: 0.4, flash: 0 },
      { x: 0, y: R0 * 0.36, r: maxR * 0.2, jag: null, rimAlpha: 0.45, flash: 0 },
    ];
  }
  const maxR = R0 * PATCH_CONFIG.maxRFrac;
  return [
    { x: -R0 * 0.24, y: -R0 * 0.18, r: maxR * 0.9, jag: DOWN_JAG_A, rimAlpha: 0, flash: 0 },
    { x: R0 * 0.3, y: R0 * 0.26, r: maxR * 0.4, jag: DOWN_JAG_B, rimAlpha: 0, flash: 0 },
  ];
}

export function GlazeCrawlHeal({
  status = "healthy",
  label,
  showLabel = true,
  size = 16,
  className = "",
}: GlazeCrawlHealProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<{ setStatus: (s: GlazeStatus) => void } | null>(null);

  // -- token derivation happens before first paint, so nothing ever paints
  // with a default/unset ink colour --
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let ink = "";
    let w = 0;
    let h = 0;
    let cx = 0;
    let cy = 0;
    let R0 = 0;
    let raf = 0;
    let nextSpawnAt = 0;
    let statusCur: GlazeStatus = status;
    const features: Feature[] = [];

    const readInk = () => {
      ink = getComputedStyle(canvas).color;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = size;
      h = size;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = w / 2;
      cy = h / 2;
      R0 = (Math.min(w, h) / 2) * 0.86;
    };

    const drawStatic = () => {
      renderFrame(ctx, ink, w, h, cx, cy, R0, -0.8, staticSpecs(statusCur, R0));
    };

    const maxRFor = (kind: "healthy" | "degraded" | "down") =>
      R0 * (kind === "down" ? PATCH_CONFIG.maxRFrac : BUBBLE_CONFIG[kind].maxRFrac);

    let featureSeed = 1;

    const maybeSpawn = (now: number) => {
      if (now < nextSpawnAt) return;
      if (statusCur === "down") {
        if (features.length < PATCH_CONFIG.maxConcurrent) {
          const margin = Math.max(0, R0 * 0.9 - maxRFor("down"));
          const ang = Math.random() * TAU;
          const dist = Math.random() * margin;
          features.push({
            kind: "patch",
            x: Math.cos(ang) * dist,
            y: Math.sin(ang) * dist,
            maxR: maxRFor("down") * (0.6 + Math.random() * 0.4),
            bornAt: now,
            openMs: 0,
            healMs: 0,
            healingSince: null,
            healStartR: 0,
            creepTau: PATCH_CONFIG.creepTauMs * (0.8 + Math.random() * 0.5),
            wobblePhase: Math.random() * TAU,
            jag: makeJag(featureSeed++),
          });
        }
        const [a, b] = PATCH_CONFIG.spawnMs;
        nextSpawnAt = now + a + Math.random() * (b - a);
        return;
      }
      const cfg = BUBBLE_CONFIG[statusCur];
      if (features.length < cfg.maxConcurrent) {
        const margin = Math.max(0, R0 * 0.9 - maxRFor(statusCur));
        const ang = Math.random() * TAU;
        const dist = Math.random() * margin;
        const [hMin, hMax] = cfg.healMs;
        features.push({
          kind: "bubble",
          x: Math.cos(ang) * dist,
          y: Math.sin(ang) * dist,
          maxR: R0 * cfg.maxRFrac * (0.7 + Math.random() * 0.5),
          bornAt: now,
          openMs: cfg.openMs,
          healMs: hMin + Math.random() * (hMax - hMin),
          healingSince: null,
          healStartR: 0,
          creepTau: 0,
          wobblePhase: 0,
          jag: null,
        });
      }
      const [a, b] = cfg.spawnMs;
      nextSpawnAt = now + a + Math.random() * (b - a);
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden) return;

      maybeSpawn(now);

      const specs: DrawSpec[] = [];
      for (let i = features.length - 1; i >= 0; i--) {
        const f = features[i]!;
        const age = now - f.bornAt;
        let r = 0;
        let rimAlpha = 0;
        let flash = 0;
        let dead = false;

        if (f.kind === "bubble") {
          if (f.healingSince == null) {
            if (age < f.openMs) {
              r = f.maxR * easeOutCubic(f.openMs > 0 ? age / f.openMs : 1);
            } else {
              f.healingSince = f.bornAt + f.openMs;
            }
          }
          if (f.healingSince != null) {
            const hAge = now - f.healingSince;
            if (hAge >= f.healMs) {
              dead = true;
            } else {
              r = f.maxR * (1 - easeInOutCubic(hAge / f.healMs));
              rimAlpha = 0.15 + 0.35 * (1 - hAge / f.healMs);
            }
          }
          const peak = f.bornAt + f.openMs;
          const df = Math.abs(now - peak);
          if (df < 120) flash = 1 - df / 120;
        } else {
          // patch — burst once (gas still escapes) then either creeps
          // (still failing to close) or, post-recovery, heals like a bubble
          if (f.healingSince == null) {
            r = f.maxR * (1 - Math.exp(-age / f.creepTau));
            r *= 1 + 0.03 * Math.sin(age * 0.0025 + f.wobblePhase);
            if (age < 130) flash = 1 - age / 130;
          } else {
            const hAge = now - f.healingSince;
            if (hAge >= f.healMs) {
              dead = true;
            } else {
              r = f.healStartR * (1 - easeInOutCubic(hAge / f.healMs));
            }
          }
        }

        if (dead) {
          features.splice(i, 1);
          continue;
        }
        specs.push({ x: f.x, y: f.y, r, jag: f.jag, rimAlpha, flash });
      }

      const sheenAngle = now * 0.00015;
      renderFrame(ctx, ink, w, h, cx, cy, R0, sheenAngle, specs);
    };

    const start = () => {
      if (reduced || raf) return;
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    engineRef.current = {
      setStatus: (next) => {
        const prev = statusCur;
        statusCur = next;
        if (prev === "down" && next !== "down") {
          // conditions recovered — the melt can finally flow back over
          // whatever crawled while it was down.
          const now = performance.now();
          const cfg = BUBBLE_CONFIG[next];
          const [hMin, hMax] = cfg.healMs;
          for (const f of features) {
            if (f.kind === "patch" && f.healingSince == null) {
              const age = now - f.bornAt;
              const r =
                f.maxR *
                (1 - Math.exp(-age / f.creepTau)) *
                (1 + 0.03 * Math.sin(age * 0.0025 + f.wobblePhase));
              f.healStartR = r;
              f.healingSince = now;
              f.healMs = hMin + Math.random() * (hMax - hMin);
            }
          }
        }
        if (reduced) drawStatic();
        else start();
      },
    };

    const onVis = () => {
      if (!document.hidden) start();
    };
    document.addEventListener("visibilitychange", onVis);

    const mo = new MutationObserver(() => {
      readInk();
      if (reduced) drawStatic();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    readInk();
    resize();
    if (reduced) drawStatic();
    else start();

    return () => {
      engineRef.current = null;
      stop();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  useLayoutEffect(() => {
    engineRef.current?.setStatus(status);
  }, [status]);

  const text = label ?? STATUS_LABEL[status];

  return (
    <span
      role="status"
      aria-live="polite"
      data-glaze-status={status}
      className={`inline-flex shrink-0 items-center gap-2 ${className}`}
    >
      <span
        aria-hidden
        className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border"
        style={{ width: size, height: size }}
      >
        <canvas ref={canvasRef} className="block text-foreground" />
      </span>
      {showLabel ? (
        <span className="font-mono text-xs text-foreground">{text}</span>
      ) : (
        <span className="sr-only">{text}</span>
      )}
    </span>
  );
}
