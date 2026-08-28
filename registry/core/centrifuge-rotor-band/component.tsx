"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// CentrifugeRotorBand — an ambient "working" indicator rendered as a
// benchtop microcentrifuge spin-up/hold/brake cycle combined with
// density-gradient ultracentrifugation banding (Svedberg sedimentation): a
// rotor accelerates to operating speed, holds, then brakes back to rest,
// while a sample tube's pre-loaded density bands drift outward under the
// applied centrifugal force during the hold phase.
//
// REAL NUMBERS: spin-up ramps 0 -> 14,000rpm over 4.5s (~3,100rpm/s accel),
// hold sustains 14,000rpm for 8s, brake decelerates 14,000 -> 0rpm over 6s
// (slower than accel — a regenerative brake, not a hard stop). Full cycle
// 18.5s, unbounded repeat. The real 14,000rpm figure is documented here
// only: rendering it 1:1 would alias against a ~60Hz paint rate into a
// strobe (the exact round-9 legibility failure this registry has already
// shipped once), so the rendered spin is a decoupled, capped 3 rev/s
// maximum, driven continuously by rpm-fraction rather than literal rpm.
//
// Spoke-vs-blurred-ring is a crossfade over rpm-fraction 0.45-0.55 (never a
// hard cut), and the ring's own alpha/width/radius keep varying with
// rpm-fraction across the whole 0.5-1.0 range so ramp and hold read as
// distinct states, not one repeated ring shape.
//
// The four density bands (starting radii 22% / 38% / 55% / 71% of the
// tube's length) compress very slightly inward during spin-up (inertial
// lag), then sweep continuously outward through the hold — the ONE
// followable thing — hold their fully-migrated position through the brake
// (a real prep is reloaded between runs, so resetting only at the top of
// the next cycle is mechanically honest, not a cheat), then snap back to
// their start radii when the cycle rolls over. Migration/compression/tube
// width/band radius are all fractions of the tube's own length or the
// rotor's own radius (both derived from the container's smaller dimension)
// rather than fixed px, so the drift stays perceptible at any card size.
// ---------------------------------------------------------------------------

const RAMP_S = 4.5; // spin-up: 0 -> 14,000rpm
const HOLD_S = 8; // hold at 14,000rpm
const BRAKE_S = 6; // brake: 14,000 -> 0rpm (slower than accel)
const CYCLE_S = RAMP_S + HOLD_S + BRAKE_S; // 18.5s

const VISUAL_REV_CAP = 3; // rendered rev/s at full rpm-fraction — decoupled from the real 14,000rpm
const BLUR_MID = 0.5; // rpm-fraction crossfade midpoint (== 1.5 rendered rev/s)
const BLUR_HALF_WIDTH = 0.05; // crossfade spans rpm-fraction 0.45 - 0.55

const ROTOR_RADIUS_FRACTION = 0.32; // of min(w, h)
const SPOKE_COUNT = 3;
const WOBBLE_MAX_PX = 0.4; // imbalance wobble amplitude ceiling
const WOBBLE_ONSET_FRACTION = 0.4; // wobble only present above 40% of ramp speed

const TUBE_LENGTH_FRACTION = 0.9; // of rotor radius
const TUBE_WIDTH_FRACTION = 0.075; // of rotor radius
const BAND_RADIUS_FRACTION = 0.05; // of rotor radius — slightly wider than half the tube, for visibility
const BAND_START_FRACTIONS = [0.22, 0.38, 0.55, 0.71]; // of tube length, from center
const BAND_MIGRATION_FRACTION = 0.14; // of tube length, outward drift accumulated across the hold
const BAND_COMPRESSION_FRACTION = 0.05; // of tube length, inward drift during ramp (inertial lag)

// FREEZE FRAME: reduced-motion locks at cycle t=8.7s — the hold-phase
// midpoint. Rotor is rendered as a static translucent ring at full speed
// (no motion-blur trail, no strobing, no wobble), bands sit at
// mid-migration (52.5% of the way from the compressed ramp-end position to
// the fully migrated hold-end position). This is the single most
// structured frame: both the spin state and the band drift are legible
// without motion.
const FREEZE_T = 8.7;

type Phase = "ramp" | "hold" | "brake";

interface CycleState {
  phase: Phase;
  rpmFraction: number; // 0..1, fraction of 14,000rpm
  phaseFraction: number; // 0..1, progress through the current phase
}

function cycleState(cycleT: number): CycleState {
  if (cycleT < RAMP_S) {
    const f = cycleT / RAMP_S;
    return { phase: "ramp", rpmFraction: f, phaseFraction: f };
  }
  if (cycleT < RAMP_S + HOLD_S) {
    const f = (cycleT - RAMP_S) / HOLD_S;
    return { phase: "hold", rpmFraction: 1, phaseFraction: f };
  }
  const f = (cycleT - RAMP_S - HOLD_S) / BRAKE_S;
  return { phase: "brake", rpmFraction: Math.max(0, 1 - f), phaseFraction: f };
}

/** Continuous band offset (px along the tube), never a discrete step within
 * a phase: ramps 0 -> -compression during spin-up, sweeps -compression ->
 * +migration across the hold, then holds at +migration through the brake
 * (the only sanctioned jump is the cycle-rollover snap back to 0). */
function bandOffsetPx(state: CycleState, tubeLen: number): number {
  const compression = BAND_COMPRESSION_FRACTION * tubeLen;
  const migration = BAND_MIGRATION_FRACTION * tubeLen;
  if (state.phase === "ramp") return -compression * state.phaseFraction;
  if (state.phase === "hold") return -compression + (migration + compression) * state.phaseFraction;
  return migration;
}

export interface CentrifugeRotorBandProps {
  /** accessible name for the reading, e.g. "Preparing sample" */
  label?: string;
  /** canvas panel height in px. Default 220. */
  height?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function CentrifugeRotorBand({
  label = "Rotor speed",
  height = 220,
  className = "",
}: CentrifugeRotorBandProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let fg = "";
    let muted = "";
    let bg = "";

    // fallbacks are CSS keywords, never literal colour values
    const readTokens = () => {
      const root = getComputedStyle(document.documentElement);
      fg = root.getPropertyValue("--foreground").trim() || "currentColor";
      muted = root.getPropertyValue("--ns-muted").trim() || "currentColor";
      bg = root.getPropertyValue("--background").trim() || "transparent";
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

    // rotor angle is integrated from the current rendered rev/s each frame
    // (real time, not derived from cycleT) so the visual rate — capped and
    // decoupled from the literal 14,000rpm figure — is what actually drives it.
    let rotorAngle = 0;

    const draw = (t: number, dtSec: number, freeze: boolean) => {
      if (!sized) return;
      ctx.clearRect(0, 0, w, h);

      const cycleT = t % CYCLE_S;
      const state = cycleState(cycleT);
      const { rpmFraction } = state;
      const visualRevPerSec = rpmFraction * VISUAL_REV_CAP;
      rotorAngle += 2 * Math.PI * visualRevPerSec * dtSec;

      const rotorRadius = Math.min(w, h) * ROTOR_RADIUS_FRACTION;

      // damped imbalance wobble, present only above 40% of rpm-fraction —
      // held at zero for the reduced-motion freeze frame so it is genuinely static.
      const wobbleGate = Math.max(0, (rpmFraction - WOBBLE_ONSET_FRACTION) / (1 - WOBBLE_ONSET_FRACTION));
      const wobbleAmp = freeze ? 0 : WOBBLE_MAX_PX * Math.min(1, wobbleGate);
      const wobbleX = wobbleAmp * Math.sin(t * 23.1);
      const wobbleY = wobbleAmp * Math.cos(t * 17.3);
      const cx = w / 2 + wobbleX;
      const cy = h / 2 + wobbleY;

      // housing ring — separator luminance, never the climactic motion
      ctx.globalAlpha = 1;
      ctx.strokeStyle = muted;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, rotorRadius, 0, Math.PI * 2);
      ctx.stroke();

      // spoke <-> blurred-ring crossfade, continuous over rpm-fraction
      // 0.45-0.55 (never a hard cut), and the ring's own alpha/width/radius
      // keep varying with rpm-fraction across 0.5-1.0 so ramp and hold read
      // as distinct states rather than one repeated shape.
      const blurWeight = Math.max(0, Math.min(1, (rpmFraction - (BLUR_MID - BLUR_HALF_WIDTH)) / (2 * BLUR_HALF_WIDTH)));
      const spokeWeight = 1 - blurWeight;

      if (blurWeight > 0) {
        const outerAlpha = (0.18 + 0.22 * rpmFraction) * blurWeight;
        const edgeAlpha = (0.3 + 0.3 * rpmFraction) * blurWeight;
        const bandRadiusFrac = 0.68 + 0.14 * rpmFraction;
        const bandWidth = rotorRadius * (0.22 + 0.14 * rpmFraction);

        ctx.globalAlpha = outerAlpha;
        ctx.strokeStyle = fg;
        ctx.lineWidth = bandWidth;
        ctx.beginPath();
        ctx.arc(cx, cy, rotorRadius * bandRadiusFrac, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = edgeAlpha;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, rotorRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (spokeWeight > 0) {
        ctx.globalAlpha = spokeWeight;
        ctx.strokeStyle = fg;
        ctx.lineWidth = 1.5;
        for (let i = 0; i < SPOKE_COUNT; i++) {
          const a = rotorAngle + (i * 2 * Math.PI) / SPOKE_COUNT;
          const inner = rotorRadius * 0.15;
          const outer = rotorRadius * 0.95;
          ctx.beginPath();
          ctx.moveTo(cx + inner * Math.cos(a), cy + inner * Math.sin(a));
          ctx.lineTo(cx + outer * Math.cos(a), cy + outer * Math.sin(a));
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fillStyle = fg;
        ctx.fill();
      }

      // sample tube — fixed orientation (0°, straight up) independent of
      // the rotor's own spin phase, so band migration stays trackable
      // rather than spinning into a blur alongside the rotor.
      const tubeLen = rotorRadius * TUBE_LENGTH_FRACTION;
      const tubeWidth = rotorRadius * TUBE_WIDTH_FRACTION;
      const tx0 = cx - tubeWidth / 2;
      const tx1 = cx + tubeWidth / 2;
      const tyTop = cy - tubeLen;
      const tyBottom = cy;
      const cornerRadius = tubeWidth / 2;

      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(tx0, tyTop + cornerRadius);
      ctx.arcTo(tx0, tyTop, tx1, tyTop, cornerRadius);
      ctx.arcTo(tx1, tyTop, tx1, tyBottom, cornerRadius);
      ctx.lineTo(tx1, tyBottom);
      ctx.lineTo(tx0, tyBottom);
      ctx.closePath();
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.strokeStyle = muted;
      ctx.lineWidth = 1;
      ctx.stroke();

      // density bands — the one followable thing, migrating outward on a
      // steady continuous drift proportional to the tube's own length
      const bandRadiusPx = rotorRadius * BAND_RADIUS_FRACTION;
      const offset = bandOffsetPx(state, tubeLen);
      ctx.fillStyle = fg;
      for (const startFraction of BAND_START_FRACTIONS) {
        const radiusPx = startFraction * tubeLen + offset;
        const by = cy - Math.max(0, Math.min(tubeLen, radiusPx));
        ctx.beginPath();
        ctx.arc(cx, by, bandRadiusPx, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    // -- loop ------------------------------------------------------------
    let raf = 0;
    let last = 0;
    let globalT = 0;

    const loop = (now: number) => {
      const dtMs = last ? Math.min(250, now - last) : 1000 / 60;
      last = now;
      const dtSec = dtMs / 1000;
      globalT += dtSec;
      draw(globalT, dtSec, false);
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const mo = new MutationObserver(() => {
      readTokens();
      draw(reduced ? FREEZE_T : globalT, 0, reduced);
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
        draw(reduced ? FREEZE_T : globalT, 0, reduced);
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
      draw(FREEZE_T, 0, true);
    } else {
      draw(0, 0, false);
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
        <span className="font-mono text-[11px] tracking-wide text-ns-muted">SPIN / HOLD / BRAKE</span>
      </div>
      <div
        role="img"
        aria-label={`${label}: a centrifuge rotor spinning up, holding, and braking, while four sample density bands drift outward each hold cycle`}
        className="mt-2"
      >
        <canvas ref={canvasRef} aria-hidden="true" className="block w-full" style={{ height }} />
      </div>
      <div className="mt-1.5 flex items-center justify-between font-mono text-[11px] text-ns-muted">
        <span>14,000 RPM</span>
        <span>18.5s CYCLE</span>
      </div>
    </div>
  );
}
