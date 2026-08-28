"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// ServingMalletWind — a card-scale ambient loader modelled on marlinspike
// seamanship's "serving" pass: protecting a line from chafe by tightly
// winding small stuff (twine) around it so each turn lies flush against its
// neighbour, worked with a serving mallet that both delivers and beds down
// the turns as it travels the rope's length.
//
// The rope is a continuous horizontal feed: bare rope drifts in from the
// right, covered (served) rope drifts out to the left, so the served/bare
// boundary can sit at a FIXED screen x (canvas centre) forever, with work
// never running out. Two decoupled clocks drive it: a fast, un-followable
// wrap texture (rendered as continuous scrolling helical hatching, never
// claimed as individually countable turns) and a slow, deliberately
// followable turn-lock highlight that sweeps once around the rope's
// circumference and snaps into place every 0.9s — the one thing a viewer's
// eye is meant to track. Cylinder shading is luminance-only (no hue); the
// served/bare step is a hard boundary, ridged vs smooth.
//
// Colour is read once via getComputedStyle(document.documentElement) with
// no literal fallback of any kind, retried on rAF until every token
// resolves, and re-read on every documentElement class flip. Geometry is
// derived from the container's smaller dimension.
// ---------------------------------------------------------------------------

const FEED_PX_S = 22; // continuous rope drift, bare-to-covered
const WRAP_PITCH = 4; // px between helical wrap lines (fast, decorative texture only)
const LOCK_INTERVAL_S = 0.9; // the one followable cadence
const LOCK_SWEEP_FRAC = 0.7; // fraction of the interval spent sweeping vs held settled
const ZONE_W = 46; // px, fixed on screen — the working band straddling the boundary
const DIAMETER_RATIO = 1 / 8; // rope diameter = minDim * this

interface Tokens {
  fg: string;
  muted: string;
}

function readTokens(): Tokens | null {
  if (typeof document === "undefined") return null;
  const cs = getComputedStyle(document.documentElement);
  const fg = cs.getPropertyValue("--foreground").trim();
  const muted = cs.getPropertyValue("--ns-muted").trim();
  if (!fg || !muted) return null; // stylesheet not applied yet — paint nothing
  return { fg, muted };
}

// -- the rope's "lay": three incommensurate sine periods sampled in MATERIAL
// coordinates (screen x + accumulated feed), so a fixed screen point shows
// different material as the rope drifts under it — without this the rope
// has no identity and t0/2.5s/5s are indistinguishable whenever the lock
// highlight happens to land on the same phase. Range approx [-1, 1]. --------
function laySignal(xMaterial: number): number {
  return (
    Math.sin(xMaterial / 53) * 0.5 +
    Math.sin(xMaterial / 89 + 1.7) * 0.3 +
    Math.sin(xMaterial / 137 + 0.4) * 0.2
  );
}

export interface ServingMalletWindProps {
  /** small mono label above the rope (default "Serving in progress") */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function ServingMalletWind({
  label = "Serving in progress",
  className = "",
}: ServingMalletWindProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let disposed = false;
    let tokens: Tokens | null = null;
    let dpr = 1;
    let w = 0;
    let h = 0;
    let sized = false;
    let visible = true;

    let start = 0; // performance.now() at t=0
    let raf = 0;
    let tokenWaitRaf = 0;

    const fitCanvas = () => {
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const layout = () => {
      const minDim = Math.min(w, h);
      const diameter = minDim * DIAMETER_RATIO;
      const cy = h / 2;
      const ropeTop = cy - diameter / 2;
      const ropeBottom = cy + diameter / 2;
      const boundaryX = w / 2; // fixed screen position: bare enters right, served exits left
      return { minDim, diameter, ropeTop, ropeBottom, boundaryX };
    };

    // -- one frame: elapsedS drives the feed (fast, continuous) and the
    // lock cadence (slow, discrete-feeling) independently. -----------------
    const draw = (elapsedS: number) => {
      if (!tokens || !sized) return;
      const t = tokens;
      const { diameter, ropeTop, ropeBottom, boundaryX } = layout();
      const ropeH = ropeBottom - ropeTop;
      ctx.clearRect(0, 0, w, h);
      if (diameter <= 0) return;

      const feedPx = elapsedS * FEED_PX_S;
      // working zone: transition to fully-served begins at the boundary and
      // finishes ZONE_W into the bare side.
      const zoneRight = boundaryX + ZONE_W;

      // -- base cylinder: a faint vertical sheen (luminance only, no hue),
      // shared by bare and served rope alike so both read as the same
      // physical line. ------------------------------------------------------
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, ropeTop, w, ropeH);
      ctx.clip();

      const sheen = ctx.createLinearGradient(0, ropeTop, 0, ropeBottom);
      sheen.addColorStop(0, t.muted);
      sheen.addColorStop(0.5, t.fg);
      sheen.addColorStop(1, t.muted);
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = sheen;
      ctx.fillRect(0, ropeTop, w, ropeH);

      // -- lay variation: coarse, aperiodic luminance mottling sampled in
      // material coordinates (x + feedPx), present across the WHOLE rope so
      // both halves carry an identity that visibly drifts — this is what
      // makes t0/2.5s/5s different even between lock-highlight events. -----
      const LAY_STEP = 6;
      ctx.fillStyle = t.fg;
      for (let x = 0; x < w; x += LAY_STEP) {
        const s = laySignal(x + feedPx);
        ctx.globalAlpha = 0.1 + 0.09 * s;
        ctx.fillRect(x, ropeTop, LAY_STEP + 0.5, ropeH);
      }

      // -- served half (x <= boundaryX): higher-contrast base + a continuous
      // scrolling helical wrap texture, ramping in across the ZONE_W working
      // band (boundaryX..zoneRight) rather than starting/stopping instantly,
      // so the mallet's footprint is the transition and the boundary itself
      // is where it finishes — the hard luminance step. The pitch (4px) is
      // far finer than any followable cadence, so it is rendered purely as
      // texture — no single turn is claimed as individually trackable. -----
      const rampAt = (x: number) => Math.max(0, Math.min(1, (zoneRight - x) / ZONE_W));

      const servedGrad = ctx.createLinearGradient(zoneRight, 0, boundaryX, 0);
      servedGrad.addColorStop(0, "transparent");
      servedGrad.addColorStop(1, t.fg);
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = servedGrad;
      ctx.fillRect(0, ropeTop, zoneRight, ropeH);

      const slant = ropeH * 0.55;
      const phase = ((feedPx % WRAP_PITCH) + WRAP_PITCH) % WRAP_PITCH;
      ctx.strokeStyle = t.fg;
      ctx.lineWidth = 1;
      // established region (fully served, left of the boundary): one batched
      // stroke at full alpha.
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      for (let x = boundaryX - phase; x > -slant; x -= WRAP_PITCH) {
        ctx.moveTo(x, ropeTop);
        ctx.lineTo(x - slant, ropeBottom);
      }
      ctx.stroke();
      // working zone (boundaryX..zoneRight): each line ramps in individually.
      for (let x = boundaryX + WRAP_PITCH - phase; x < zoneRight + slant; x += WRAP_PITCH) {
        ctx.globalAlpha = 0.5 * rampAt(x);
        ctx.beginPath();
        ctx.moveTo(x, ropeTop);
        ctx.lineTo(x - slant, ropeBottom);
        ctx.stroke();
      }
      ctx.restore();

      // -- bare half (x > zoneRight): smooth flat gradient + lay mottling
      // only, no ridge — the point, per spec: bare rope drift is not itself
      // meant to be legible, only what happens to it once served. ----------

      // -- hard luminance step at the boundary itself. ------------------------
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = t.fg;
      ctx.lineWidth = Math.max(1, diameter * 0.03);
      ctx.beginPath();
      ctx.moveTo(boundaryX, ropeTop);
      ctx.lineTo(boundaryX, ropeBottom);
      ctx.stroke();

      // -- turn-lock highlight: the ONE followable event. Sweeps once around
      // the rope's circumference (rendered as vertical travel across the
      // cylinder, since we view it side-on) and snaps to the newest fully
      // seated turn every LOCK_INTERVAL_S. Luminance-only, --foreground —
      // never --ns-accent, matching the recipe's pointer-highlight rule
      // even though this highlight has no pointer behind it. -----------------
      const lockPhase = elapsedS % LOCK_INTERVAL_S;
      const sweepDur = LOCK_INTERVAL_S * LOCK_SWEEP_FRAC;
      let highlightY: number;
      let highlightAlpha: number;
      if (lockPhase < sweepDur) {
        // linear, not eased — a viewer needs to see it travel the WHOLE
        // rope diameter over the WHOLE sweep, not jump most of the way in
        // the first frame and then appear to sit still (the exact "blink,
        // not a sweep" failure the round's legibility rule calls out).
        const p = lockPhase / sweepDur;
        highlightY = ropeTop + p * ropeH;
        highlightAlpha = 0.4 + 0.3 * p;
      } else {
        // snap: a brief brightness peak on arrival, decaying through the hold.
        const holdP = (lockPhase - sweepDur) / (LOCK_INTERVAL_S - sweepDur);
        highlightY = ropeBottom;
        highlightAlpha = 0.95 - 0.35 * holdP;
      }
      // Concentric fills at descending alpha (never a colour-stop-to-bg
      // gradient, which punches an opaque hole instead of glowing) — the
      // repo's proven idiom for a soft point light in a single token.
      const glowR = Math.max(2, diameter * 0.2);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, ropeTop, w, ropeH);
      ctx.clip();
      ctx.fillStyle = t.fg;
      for (const [rFrac, aFrac] of [
        [1, 0.22],
        [0.6, 0.45],
        [0.3, 0.9],
      ] as const) {
        ctx.globalAlpha = highlightAlpha * aFrac;
        ctx.beginPath();
        ctx.arc(boundaryX, highlightY, glowR * rFrac, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.globalAlpha = 1;
    };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) {
        sized = false;
        return;
      }
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      fitCanvas();
      sized = true;
    };

    const loop = (now: number) => {
      if (disposed) return;
      if (!visible) {
        raf = 0; // re-armed by the IntersectionObserver on re-entry
        return;
      }
      raf = requestAnimationFrame(loop);
      if (!sized || !tokens) return;
      if (start === 0) start = now;
      draw((now - start) / 1000);
    };

    let started = false;
    const kick = () => {
      if (started || disposed || !tokens || !sized) return;
      started = true;
      if (reduced) {
        // LOCK_SETTLED: frozen exactly on a lock-interval boundary, highlight
        // fully snapped (not mid-sweep), served/bare halves both maximally
        // legible. No rAF loop, no timers, no observers driving motion.
        const settledElapsed = LOCK_INTERVAL_S * (LOCK_SWEEP_FRAC + (1 - LOCK_SWEEP_FRAC) / 2);
        draw(settledElapsed);
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    const boot = () => {
      if (disposed) return;
      tokens = readTokens();
      if (!tokens) {
        tokenWaitRaf = requestAnimationFrame(boot);
        return;
      }
      resize();
      kick();
    };

    const ro = new ResizeObserver(() => {
      if (!tokens) return;
      resize();
      if (reduced) {
        const settledElapsed = LOCK_INTERVAL_S * (LOCK_SWEEP_FRAC + (1 - LOCK_SWEEP_FRAC) / 2);
        draw(settledElapsed);
      }
      kick();
    });
    ro.observe(wrap);

    const mo = new MutationObserver(() => {
      tokens = readTokens();
      if (!tokens) return;
      if (reduced) {
        const settledElapsed = LOCK_INTERVAL_S * (LOCK_SWEEP_FRAC + (1 - LOCK_SWEEP_FRAC) / 2);
        draw(settledElapsed);
      } else if (sized && start !== 0) {
        draw((performance.now() - start) / 1000);
      }
      kick();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const io = new IntersectionObserver((entries) => {
      const wasVisible = visible;
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !wasVisible && !reduced && tokens && !raf) {
        tokens = readTokens() ?? tokens; // pick up a theme flip that happened while hidden
        resize();
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(wrap);

    boot();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(tokenWaitRaf);
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`relative w-full max-w-sm overflow-hidden rounded-md border border-border bg-surface p-4 ${className}`}
    >
      <p className="mb-3 font-mono text-[11px] tracking-widest text-ns-muted">{label}</p>
      <div className="relative w-full" style={{ aspectRatio: "5 / 2" }}>
        <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
      </div>
    </div>
  );
}
