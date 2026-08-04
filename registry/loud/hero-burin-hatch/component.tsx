"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// BurinHatch — a copperplate engraving that relights itself.
//
// The sphere is never filled and never shaded with a gradient. It is drawn as
// two passes of pure line, exactly the way an engraver cuts one: FAMILY A, the
// primary burin pass, is 40 meridians that follow the surface parameterization
// so the lines themselves describe the curvature; FAMILY B is a cross-hatch of
// parallels that exists ONLY inside the shadow. The tone comes entirely from
// how WIDE each cut is: width swells with 1 - dot(N, L) and goes to exactly
// zero where the surface faces the light, so the highlight is bare, unworked
// paper. That is the whole mechanism, and it is why the frame has real
// negative space instead of a uniform wash of strokes.
//
// A variable-width cut cannot be a stroke, so each hatch line is emitted as a
// closed polygon strip: walk the samples forward offset by +w/2 along the
// screen-space normal of the line, walk back offset by -w/2, close. All of
// family A goes into one Path2D and all of family B into another — two fill
// calls per frame, no per-sample canvas state changes.
// ---------------------------------------------------------------------------

const DEG = Math.PI / 180;

const RADIUS_FRAC = 0.38; // Rs = RADIUS_FRAC * min(w, h)

// Family A — meridians (the primary burin pass). One half-meridian every
// 4.5 deg of longitude all the way around (80 of them), so the front
// hemisphere always shows exactly 40 lines however far the globe has turned.
const MERIDIANS = 80;
const MERIDIAN_STEP = 4.5 * DEG;
const LAT_MIN = -88 * DEG;
const LAT_STEP = 1.5 * DEG;
const LAT_N = 118; // -88 deg .. +87.5 deg
const WIDTH_A = 3.0; // px, max cut width in full shadow
const SHADE_POW = 3.0; // exponent on (1 - dot(N, L)). High on purpose: the cut
// has to reach zero well before the surface is fully lit, or every meridian
// stays faintly visible and the plate reads as a wireframe globe instead of an
// engraving with a bare highlight.

// Family B — parallels, the second (cross-hatch) pass, shadow only.
// Stops at +/-72 rather than the pole: at +/-84 the screen spacing between
// consecutive parallels falls below their own width and they merge into a
// solid slab across the pole.
const PARALLELS = 25; // one every 6 deg of latitude, -72 .. +72
const PARALLEL_STEP = 6 * DEG;
const PARALLEL_MIN = -72 * DEG;
const LON_N = 240; // one sample every 1.5 deg of longitude
const LON_STEP = 1.5 * DEG;
const CROSS_THRESHOLD = 0.2; // cross-hatch only where dot(N, L) < this
const WIDTH_B = 1.8; // px, max cross-hatch width

const ALPHA_A = 0.9;
const ALPHA_B = 0.75;
const ALPHA_SILHOUETTE = 0.35;
const SILHOUETTE_W = 1.1;

// Ambient behaviour
const SPIN = 0.06; // rad/s — meridians drift, so it reads as a turning globe
const AZ_PERIOD = 26; // s
const EL_PERIOD = 19; // s — incommensurate with AZ_PERIOD, so the wander never repeats
const LIGHT_TAU = 0.45; // s — slew time constant toward pointer / ambient
const POINTER_Z = 0.62; // fixed z so the light never goes fully edge-on
const DT_MAX = 1 / 30;

const BUF = 260; // max samples in one run (LON_N + slack)

export interface BurinHatchCta {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface BurinHatchProps {
  eyebrow?: string;
  headline?: string | string[];
  subcopy?: string;
  primaryCta: BurinHatchCta;
  secondaryCta?: BurinHatchCta;
  /** accessible description of the engraving for screen readers */
  plateLabel?: string;
  className?: string;
}

export function BurinHatch({
  eyebrow,
  headline = "Cut the light in",
  subcopy,
  primaryCta,
  secondaryCta,
  plateLabel = "An engraved sphere: meridian hatch lines swell to heavy cuts in shadow and thin away to blank paper where the light falls, with cross-hatching in the deepest shade.",
  className = "",
}: BurinHatchProps) {
  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const headlineLines = Array.isArray(headline) ? headline : [headline];

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let ink = "currentColor";
    let cssW = 0;
    let cssH = 0;
    let sized = false;

    // -- static tables -----------------------------------------------------
    const latCos = new Float64Array(LAT_N);
    const latSin = new Float64Array(LAT_N);
    for (let k = 0; k < LAT_N; k++) {
      const phi = LAT_MIN + k * LAT_STEP;
      latCos[k] = Math.cos(phi);
      latSin[k] = Math.sin(phi);
    }
    const meridCos = new Float64Array(MERIDIANS);
    const meridSin = new Float64Array(MERIDIANS);
    for (let m = 0; m < MERIDIANS; m++) {
      const lam = m * MERIDIAN_STEP;
      meridCos[m] = Math.cos(lam);
      meridSin[m] = Math.sin(lam);
    }
    const parCos = new Float64Array(PARALLELS);
    const parSin = new Float64Array(PARALLELS);
    for (let p = 0; p < PARALLELS; p++) {
      const phi = PARALLEL_MIN + p * PARALLEL_STEP;
      parCos[p] = Math.cos(phi);
      parSin[p] = Math.sin(phi);
    }
    const lonCos = new Float64Array(LON_N);
    const lonSin = new Float64Array(LON_N);
    for (let j = 0; j < LON_N; j++) {
      const lam = j * LON_STEP;
      lonCos[j] = Math.cos(lam);
      lonSin[j] = Math.sin(lam);
    }

    // -- per-run scratch ---------------------------------------------------
    const xs = new Float64Array(BUF);
    const ys = new Float64Array(BUF);
    const ws = new Float64Array(BUF);
    const nxs = new Float64Array(BUF);
    const nys = new Float64Array(BUF);

    // A variable-width line is a POLYGON, not a stroke: forward along +w/2 of
    // the screen-space normal, back along -w/2, closed. Where w reaches 0 the
    // strip pinches shut and the cut simply disappears into the paper.
    const emitRun = (path: Path2D, n: number) => {
      if (n < 2) return;
      for (let i = 0; i < n; i++) {
        const a = i > 0 ? i - 1 : i;
        const b = i < n - 1 ? i + 1 : i;
        const tx = xs[b]! - xs[a]!;
        const ty = ys[b]! - ys[a]!;
        const len = Math.hypot(tx, ty) || 1;
        const nx = -ty / len;
        const ny = tx / len;
        nxs[i] = nx;
        nys[i] = ny;
        const h = ws[i]! * 0.5;
        const px = xs[i]! + nx * h;
        const py = ys[i]! + ny * h;
        if (i === 0) path.moveTo(px, py);
        else path.lineTo(px, py);
      }
      for (let i = n - 1; i >= 0; i--) {
        const h = ws[i]! * 0.5;
        path.lineTo(xs[i]! - nxs[i]! * h, ys[i]! - nys[i]! * h);
      }
      path.closePath();
    };

    const readTokens = () => {
      ink = getComputedStyle(canvas).color;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) {
        sized = false;
        return;
      }
      cssW = rect.width;
      cssH = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(cssW * dpr));
      canvas.height = Math.max(1, Math.round(cssH * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sized = true;
    };

    // -- light -------------------------------------------------------------
    let lam0 = 0; // longitude offset — the engraved globe turns
    let lx = 0;
    let ly = 0;
    let lz = 1;

    const ambient = (t: number, out: Float64Array) => {
      const az = 0.9 + 0.35 * Math.sin((2 * Math.PI * t) / AZ_PERIOD);
      const el = 0.5 + 0.18 * Math.sin((2 * Math.PI * t) / EL_PERIOD + 1.1);
      const ce = Math.cos(el);
      out[0] = ce * Math.sin(az);
      out[1] = Math.sin(el);
      out[2] = ce * Math.cos(az);
    };
    const target = new Float64Array(3);

    // -- draw --------------------------------------------------------------
    const draw = () => {
      if (!sized) return;
      ctx.clearRect(0, 0, cssW, cssH);
      const cx = cssW / 2;
      const cy = cssH / 2;
      const Rs = RADIUS_FRAC * Math.min(cssW, cssH);

      const c0 = Math.cos(lam0);
      const s0 = Math.sin(lam0);

      const pathA = new Path2D();
      const pathB = new Path2D();

      // FAMILY A — meridians. Full-surface pass; width alone carries the tone.
      for (let m = 0; m < MERIDIANS; m++) {
        // sin/cos of (lam + lam0) without a trig call per sample
        const sL = meridSin[m]! * c0 + meridCos[m]! * s0;
        const cL = meridCos[m]! * c0 - meridSin[m]! * s0;
        let n = 0;
        for (let k = 0; k < LAT_N; k++) {
          const cp = latCos[k]!;
          const nz = cp * cL;
          if (nz <= 0) {
            if (n > 1) emitRun(pathA, n);
            n = 0;
            continue;
          }
          const nx = cp * sL;
          const ny = latSin[k]!;
          const d = nx * lx + ny * ly + nz * lz;
          const u = d < 0 ? 1 : d > 1 ? 0 : 1 - d;
          xs[n] = cx + Rs * nx;
          ys[n] = cy - Rs * ny;
          ws[n] = Math.min(WIDTH_A, WIDTH_A * Math.pow(u, SHADE_POW));
          n++;
        }
        if (n > 1) emitRun(pathA, n);
      }

      // FAMILY B — parallels, cut only where the surface is already in shade.
      // Start each sweep at longitude 180 (the BACK of the sphere) so the one
      // visible arc comes out as a single contiguous run; starting at 0 splits
      // it in two and leaves a seam straight down the middle of the plate.
      const j0 =
        (((Math.round((Math.PI - lam0) / LON_STEP) % LON_N) + LON_N) % LON_N) |
        0;
      for (let p = 0; p < PARALLELS; p++) {
        const cp = parCos[p]!;
        const sp = parSin[p]!;
        let n = 0;
        for (let q = 0; q < LON_N; q++) {
          const j = (j0 + q) % LON_N;
          const sL = lonSin[j]! * c0 + lonCos[j]! * s0;
          const cL = lonCos[j]! * c0 - lonSin[j]! * s0;
          const nz = cp * cL;
          const nx = cp * sL;
          const ny = sp;
          const d = nz > 0 ? nx * lx + ny * ly + nz * lz : 1;
          if (nz <= 0 || d >= CROSS_THRESHOLD) {
            if (n > 1) emitRun(pathB, n);
            n = 0;
            continue;
          }
          xs[n] = cx + Rs * nx;
          ys[n] = cy - Rs * ny;
          // clamped: d runs to -1 on surfaces facing away from the light, and
          // unclamped that drove the cross-hatch to ~7 px, so the deep shadow
          // filled in solid instead of staying a hatch.
          ws[n] =
            WIDTH_B * Math.min(1, (CROSS_THRESHOLD - d) / CROSS_THRESHOLD);
          n++;
        }
        if (n > 1) emitRun(pathB, n);
      }

      ctx.fillStyle = ink;
      ctx.globalAlpha = ALPHA_A;
      ctx.fill(pathA);
      ctx.globalAlpha = ALPHA_B;
      ctx.fill(pathB);

      // The only outline in the plate. Form is made by hatch density, not edge.
      ctx.globalAlpha = ALPHA_SILHOUETTE;
      ctx.strokeStyle = ink;
      ctx.lineWidth = SILHOUETTE_W;
      ctx.beginPath();
      ctx.arc(cx, cy, Rs, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    // -- reduced motion: exactly one frame, ambient light, no listeners ----
    if (reduced) {
      const still = () => {
        ambient(0, target);
        lx = target[0]!;
        ly = target[1]!;
        lz = target[2]!;
        lam0 = 0;
        draw();
      };
      readTokens();
      resize();
      still();
      const ro = new ResizeObserver(() => {
        resize();
        still();
      });
      ro.observe(canvas);
      const mo = new MutationObserver(() => {
        readTokens();
        still();
      });
      mo.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
      return () => {
        ro.disconnect();
        mo.disconnect();
      };
    }

    // -- full loop ---------------------------------------------------------
    let raf = 0;
    let last = 0;
    let t = 0;
    let hasPointer = false;
    let pxN = 0; // pointer, already normalized by Rs
    let pyN = 0;

    ambient(0, target);
    lx = target[0]!;
    ly = target[1]!;
    lz = target[2]!;

    const loop = (now: number) => {
      const dt = last ? Math.min(DT_MAX, (now - last) / 1000) : 1 / 60;
      last = now;
      t += dt;
      lam0 += SPIN * dt;
      if (lam0 > Math.PI * 2) lam0 -= Math.PI * 2;

      if (hasPointer) {
        const m = Math.hypot(pxN, pyN, POINTER_Z) || 1;
        target[0] = pxN / m;
        target[1] = pyN / m;
        target[2] = POINTER_Z / m;
      } else {
        ambient(t, target);
      }

      const k = Math.min(1, dt / LIGHT_TAU);
      lx += (target[0]! - lx) * k;
      ly += (target[1]! - ly) * k;
      lz += (target[2]! - lz) * k;
      const len = Math.hypot(lx, ly, lz) || 1;
      lx /= len;
      ly /= len;
      lz /= len;

      draw();
      // Pause on a hidden document; onVis restarts. raf must be cleared or the
      // `!raf` resume guard would never fire again.
      if (document.hidden) raf = 0;
      else raf = requestAnimationFrame(loop);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      if (!sized) return;
      const rect = canvas.getBoundingClientRect();
      const Rs = RADIUS_FRAC * Math.min(rect.width, rect.height);
      if (Rs < 1) return;
      pxN = (e.clientX - rect.left - rect.width / 2) / Rs;
      pyN = -(e.clientY - rect.top - rect.height / 2) / Rs;
      hasPointer = true;
    };
    const onPointerLeave = () => {
      hasPointer = false;
    };
    const onVis = () => {
      if (!document.hidden && !raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    readTokens();
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const mo = new MutationObserver(readTokens);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    root.addEventListener("pointermove", onPointerMove);
    root.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVis);
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      mo.disconnect();
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const ctaFocus =
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  return (
    <section
      ref={rootRef}
      data-hero="burin"
      className={`relative isolate flex items-center overflow-hidden bg-background ${className}`}
    >
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-6 py-16 lg:grid-cols-2 lg:gap-14 lg:py-24">
        <div className="order-2 lg:order-1">
          {eyebrow ? (
            <p className="mb-6 font-mono text-[11px] tracking-[0.25em] text-muted">
              {eyebrow}
            </p>
          ) : null}
          <h1
            className="font-semibold text-foreground"
            style={{
              fontSize: "clamp(2.25rem, 5.4vw, 3.75rem)",
              lineHeight: 1.06,
              letterSpacing: "-0.03em",
            }}
          >
            {headlineLines.map((line, i) => (
              <span key={i} className="block">
                {line}
              </span>
            ))}
          </h1>
          {subcopy ? (
            <p className="mt-6 max-w-md text-base leading-relaxed text-muted">
              {subcopy}
            </p>
          ) : null}
          <div className="mt-9 flex flex-wrap items-center gap-3">
            {primaryCta.href ? (
              <a
                href={primaryCta.href}
                data-cta="primary"
                onClick={primaryCta.onClick}
                className={`rounded-sm bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity duration-200 hover:opacity-90 ${ctaFocus}`}
              >
                {primaryCta.label}
              </a>
            ) : (
              <button
                type="button"
                data-cta="primary"
                onClick={primaryCta.onClick}
                className={`rounded-sm bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity duration-200 hover:opacity-90 ${ctaFocus}`}
              >
                {primaryCta.label}
              </button>
            )}
            {secondaryCta ? (
              secondaryCta.href ? (
                <a
                  href={secondaryCta.href}
                  onClick={secondaryCta.onClick}
                  className={`rounded-sm border border-border px-5 py-2.5 text-sm font-medium text-muted transition-colors duration-200 hover:border-foreground/30 hover:text-foreground ${ctaFocus}`}
                >
                  {secondaryCta.label}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={secondaryCta.onClick}
                  className={`rounded-sm border border-border px-5 py-2.5 text-sm font-medium text-muted transition-colors duration-200 hover:border-foreground/30 hover:text-foreground ${ctaFocus}`}
                >
                  {secondaryCta.label}
                </button>
              )
            ) : null}
          </div>
        </div>

        <div
          data-burin-stage
          className="order-1 h-[min(56vh,420px)] w-full lg:order-2 lg:h-[min(72vh,620px)]"
        >
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={plateLabel}
            className="block h-full w-full text-foreground"
          />
        </div>
      </div>
    </section>
  );
}
