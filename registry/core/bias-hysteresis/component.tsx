"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// BiasHysteresis — a level/capacity gauge rendered as an analog tape deck's
// own AC-bias hysteresis loop instead of a bar or dial.
//
// SOURCE: AC-bias magnetic tape recording linearizes an inherently nonlinear
// medium by superimposing a high-frequency bias signal on the audio; the
// tape's flux density B vs. drive field H traces a hysteresis loop, not a
// straight line (Jiles-Atherton hysteresis model; documented on any pro
// reel-to-reel service manual, e.g. Studer A80 / Ampex ATR bias alignment
// procedures). As input climbs toward and past 0dB the loop widens and its
// corners round off toward saturation — the mechanism behind analog tape's
// "soft clip" character, colloquially "tape saturation".
//
// A bright marker rides the loop's edge, one full lobe traversal every 8.3s.
// The loop itself is recomputed every frame from B = Bsat*tanh(k*(H -+ Hc))
// (sign set by sweep direction — ascending vs. descending branch — which is
// what opens the two straight tanh curves into a closed lobed loop rather
// than a single line), so its own envelope amplitude breathes on an
// independent 21s cycle: the loop is visibly narrower/sharper at low drive
// and wider/rounder at high drive across a single 5-second sample, not just
// a dot moving on a fixed shape. The real bias frequency this represents
// (~150kHz on a pro deck) is documented here only — rendering it 1:1 against
// a ~60Hz paint rate would alias into a strobe, so the rendered rate is a
// decoupled, deliberately slow drive sweep instead (round-9 legibility rule).
// ---------------------------------------------------------------------------

const DRIVE_PERIOD_S = 8.3; // one full lobe traversal (0.12Hz)
const DRIVE_PHASE_OFFSET = 0.12; // cycle fraction offset — see freeze-frame note below
const ENVELOPE_PERIOD_S = 21; // saturation-amount breathing cycle
const ENVELOPE_MIN = 0.6; // peak H amplitude at envelope trough
const ENVELOPE_MAX = 1.4; // peak H amplitude at envelope peak
const COERCIVITY_HC = 0.18;
const B_SAT = 0.92;
const K_STEEPNESS = 2.4; // tanh steepness — controls corner rounding
const LOOP_POINTS = 240; // 120 ascending + 120 descending branch samples
const SQUARE_FRACTION = 0.7; // loop region side = min(w,h) * this
const H_DOMAIN = 1.5; // H-axis half-range shown — tight enough that the trough-amplitude
// loop (amp 0.6) still reads as a lens with real horizontal width, not a
// tall sliver dominated by the fixed ~0.75 vertical coercivity gap
const B_DOMAIN = 1.05; // B-axis half-range shown, padding beyond Bsat
const MARKER_RADIUS_PX = 3.5;
const AREA_FILL_ALPHA = 0.05;

// FREEZE FRAME: reduced-motion locks at drive-cycle phase 0.62 — chosen so
// that with DRIVE_PHASE_OFFSET applied, H is descending through zero right
// as the 21s envelope sits within a hair of its own peak (0.62 * 8.3s =
// 5.146s; 5.146s / 21s ~= 0.245 of the envelope's own sine, ~=0.9993 of its
// peak). At H=0 the marker sits at the widest vertical separation between
// the two branches (the coercivity gap, ~0.75 of the B range) with the loop
// itself at peak envelope amplitude — the single frame that shows the full
// open loop at its widest, rather than a thin near-origin sliver at a small
// envelope amplitude.
const FREEZE_PHASE_FRAC = 0.62;
const FREEZE_T = FREEZE_PHASE_FRAC * DRIVE_PERIOD_S;

function envelopeAmplitude(t: number): number {
  const center = (ENVELOPE_MIN + ENVELOPE_MAX) / 2;
  const halfRange = (ENVELOPE_MAX - ENVELOPE_MIN) / 2;
  return center + halfRange * Math.sin((2 * Math.PI * t) / ENVELOPE_PERIOD_S);
}

function driveAngle(t: number): number {
  return 2 * Math.PI * (t / DRIVE_PERIOD_S - DRIVE_PHASE_OFFSET);
}

/** ascending branch: H rising, B lags "behind" toward +Hc */
function bAscending(h: number): number {
  return B_SAT * Math.tanh(K_STEEPNESS * (h - COERCIVITY_HC));
}

/** descending branch: H falling, B lags "behind" toward -Hc */
function bDescending(h: number): number {
  return B_SAT * Math.tanh(K_STEEPNESS * (h + COERCIVITY_HC));
}

/** Full closed loop, LOOP_POINTS samples, for the current envelope amplitude. */
function buildLoop(amp: number): { h: number; b: number }[] {
  const half = LOOP_POINTS / 2;
  const pts: { h: number; b: number }[] = [];
  for (let i = 0; i <= half; i++) {
    const h = -amp + (2 * amp * i) / half;
    pts.push({ h, b: bAscending(h) });
  }
  for (let i = 0; i <= half; i++) {
    const h = amp - (2 * amp * i) / half;
    pts.push({ h, b: bDescending(h) });
  }
  return pts;
}

/** Current marker position: same math as the loop branches, evaluated
 * directly at the drive's current H and sweep direction. */
function markerPoint(t: number, amp: number): { h: number; b: number } {
  const angle = driveAngle(t);
  const h = amp * Math.sin(angle);
  const rising = Math.cos(angle) >= 0;
  const b = rising ? bAscending(h) : bDescending(h);
  return { h, b };
}

export interface BiasHysteresisProps {
  /** accessible name for the reading, e.g. "Input drive" */
  label?: string;
  /** canvas panel height in px. Default 220. */
  height?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function BiasHysteresis({
  label = "Bias saturation",
  height = 220,
  className = "",
}: BiasHysteresisProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let fg = "";
    let border = "";

    // fallbacks are CSS keywords, never literal colour values
    const readTokens = () => {
      const root = getComputedStyle(document.documentElement);
      fg = root.getPropertyValue("--foreground").trim() || "currentColor";
      border = root.getPropertyValue("--border").trim() || "currentColor";
    };

    let w = 0;
    let h = 0;
    let sized = false;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        sized = false;
        return;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sized = true;
    };

    const draw = (t: number) => {
      if (!sized) return;
      ctx.clearRect(0, 0, w, h);

      const side = Math.min(w, h) * SQUARE_FRACTION;
      const cx = w / 2;
      const cy = h / 2;
      const xFor = (hVal: number) => cx + (hVal / H_DOMAIN) * (side / 2);
      const yFor = (bVal: number) => cy - (bVal / B_DOMAIN) * (side / 2);

      // axis crosshair — separator only, never the loop's own line
      ctx.strokeStyle = border;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(cx - side / 2, cy);
      ctx.lineTo(cx + side / 2, cy);
      ctx.moveTo(cx, cy - side / 2);
      ctx.lineTo(cx, cy + side / 2);
      ctx.stroke();

      const amp = envelopeAmplitude(t);
      const loop = buildLoop(amp);

      // enclosed hysteresis area — the "energy lost to saturation" — as a
      // very low-opacity foreground fill, never a hue
      ctx.beginPath();
      loop.forEach((p, i) => {
        const x = xFor(p.h);
        const y = yFor(p.b);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fillStyle = fg;
      ctx.globalAlpha = AREA_FILL_ALPHA;
      ctx.fill();

      // the loop stroke itself
      ctx.globalAlpha = 1;
      ctx.strokeStyle = fg;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      loop.forEach((p, i) => {
        const x = xFor(p.h);
        const y = yFor(p.b);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.stroke();

      // marker riding the loop's edge — the one thing to follow
      const marker = markerPoint(t, amp);
      ctx.beginPath();
      ctx.arc(xFor(marker.h), yFor(marker.b), MARKER_RADIUS_PX, 0, Math.PI * 2);
      ctx.fillStyle = fg;
      ctx.globalAlpha = 1;
      ctx.fill();
    };

    // -- loop ----------------------------------------------------------------
    let raf = 0;
    let last = 0;
    let globalT = 0;

    const loop = (now: number) => {
      const dtMs = last ? Math.min(250, now - last) : 1000 / 60;
      last = now;
      globalT += dtMs / 1000;
      draw(globalT);
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const mo = new MutationObserver(() => {
      readTokens();
      draw(reduced ? FREEZE_T : globalT);
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        readTokens();
        resize();
        draw(reduced ? FREEZE_T : globalT);
      }, 150);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries[0]?.isIntersecting;
        if (visible && !reduced && sized) {
          cancelAnimationFrame(raf);
          last = 0;
          raf = requestAnimationFrame(loop);
        } else if (!visible) {
          cancelAnimationFrame(raf);
        }
      },
      { threshold: 0 }
    );
    io.observe(canvas);

    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduced && sized) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    // no paint before the first token read
    readTokens();
    resize();

    if (reduced) {
      draw(FREEZE_T);
    } else {
      draw(0);
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      mo.disconnect();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [height]);

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[11px] tracking-wide text-ns-muted">
          {label.toUpperCase()}
        </span>
        <span className="font-mono text-[11px] tracking-wide text-ns-muted">H / B LOOP</span>
      </div>
      <div role="img" aria-label={`${label}: a closed hysteresis loop, widening and rounding as drive climbs toward saturation`} className="mt-2">
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="block w-full"
          style={{ height }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between font-mono text-[11px] text-ns-muted">
        <span>Hc {COERCIVITY_HC.toFixed(2)}</span>
        <span>Bsat {B_SAT.toFixed(2)}</span>
      </div>
    </div>
  );
}
