"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// GuillocheField — a full-bleed ambient background reproducing engine-turning
// (guilloché): the rose-engine lathe technique that engraves the dense woven
// rosette patterns on banknotes and security documents. A rose engine holds a
// workpiece against a cutting tool while two eccentric cams — the "rosettes"
// — rock it through a compound epicyclic motion; the engraver retraces the
// SAME curve at a slow crawl of radii as the cut deepens, which is why real
// guilloché reads as many nested, near-identical rings rather than one loud
// line. Here that's three such passes (hypotrochoid families, R fixed at 1,
// r = R/k, pen offset d = 0.85r) superimposed at close-but-unequal lobe
// counts (k ~= 6.0, 6.4, 9.7) so the passes beat against each other exactly
// as two guilloché screens do — the classic engraved moiré, not a color
// trick.
//
// ALIVE AT REST, without a pointer: each pass's lathe ratio k(t) = k0 +
// driftAmp*sin(driftOmega*t) drifts continuously (periods 30-45s) — the
// literal lathe-ratio wobble a rose engine's operator dials in — while each
// pass also spins at its own small, non-commensurate rate (0.5, -0.62,
// 0.83 deg/s). Neither alone would read in a 2.5s window; together the near-
// equal k values (6.0 vs 6.4) produce a beat wavelength that sweeps far
// faster than either individual rotation, which is what actually moves
// on screen. The pointer is optional: hovering nudges the LOCAL RATIO
// wobble's amplitude up (like tilting a banknote to see the thread catch
// the light) via an eased "tilt" scalar baked into the next curve rebuild,
// and relaxes back once the pointer leaves — never required for the field
// to be alive.
//
// READABILITY: a uniform-density guilloché field would fight overlaid type,
// so ring opacity is NOT uniform — it follows a coverage gradient from
// near-clear at the center up to full engraved density at the frame edge
// (s=1, ~85%), the mirror of a banknote's clear portrait window sitting
// inside a dense engraved border. Center is exactly where hero copy/CTA
// content conventionally sits, so `children` render centered above the
// canvas in the least-covered part of the field. Two refinements make that
// window actually hold real hero copy at card size rather than just a
// point: (1) the envelope each ring is traced into is an ELLIPSE sized off
// the container's own width and height independently, not a circle
// inscribed in the smaller dimension — real engine-turned ovals on a
// banknote are wide-short to match the wide-short cartouche they frame, and
// a circular window sized off `min(w,h)` left almost no horizontal margin
// once the frame got as wide as a real card; (2) the density ramp itself
// does not start climbing at s=0 (RAMP_START below) — the portrait window
// is a genuinely flat low-density plateau out to that radius, not just the
// smoothstep's already-slow start, which measured out to only about a
// quarter of the ring radius at the previous card-scale test.
//
// SUBSTRATE: Canvas 2D, not SVG. 3 passes x 36 rings x 260 samples ~= 28,000
// line segments/frame at full density — an SVG node per stroke would be
// 28,000 DOM nodes redrawn every frame, dead on arrival. The unit curve
// (one hypotrochoid, normalized to radius 1) is the only place trig runs; it
// is rebuilt at most every REBUILD_MS (~7Hz, matched to how slowly the ratio
// actually drifts), never per rAF frame. Every frame just scales, rotates
// and translates that cached table with plain arithmetic (2 muls + 2 adds
// per point, one cos/sin per pass, not per point) and rebuilds the stroke
// path — this is the "redraw, don't rebuild the curve tables" split the
// spec calls for. Rings are grouped into 8 alpha buckets per pass (same
// discipline as background-ascii-plasma) so ctx.globalAlpha is set 24
// times/frame, not 3888 times.
// ---------------------------------------------------------------------------

const RINGS = 36; // concentric copies of each pass's unit curve, center -> edge
const SAMPLES = 260; // points sampled along one unit curve
const PERIODS = 13; // revolutions the curve sweeps before re-normalizing
const ALPHA_BUCKETS = 8;
const REBUILD_MS = 140; // curve-table rebuild cadence — ratio drift is far slower than this
const TILT_EASE = 0.06;
const TILT_TAU_MS = 900; // how quickly the tilt scalar relaxes back to 0 on pointer leave
const ENVELOPE_COVER = 0.47; // each axis's max ring radius, as a fraction of that axis's own size
const RAMP_START = 0.42; // ring scale s below this stays at alphaMin flat — the actual portrait window

interface Pass {
  k0: number;
  driftAmp: number;
  driftOmega: number; // rad/s
  phase0: number;
  rotRate: number; // deg/s
  color: "fg" | "muted";
  alphaMin: number;
  alphaMax: number;
  lineWidth: number;
}

const PASSES: Pass[] = [
  { k0: 6.0, driftAmp: 0.4, driftOmega: (2 * Math.PI) / 38, phase0: 0, rotRate: 0.5, color: "fg", alphaMin: 0.05, alphaMax: 0.85, lineWidth: 1 },
  { k0: 6.4, driftAmp: 0.32, driftOmega: (2 * Math.PI) / 31, phase0: 1.7, rotRate: -0.62, color: "fg", alphaMin: 0.04, alphaMax: 0.62, lineWidth: 0.85 },
  { k0: 9.7, driftAmp: 0.5, driftOmega: (2 * Math.PI) / 45, phase0: 3.1, rotRate: 0.83, color: "muted", alphaMin: 0.03, alphaMax: 0.48, lineWidth: 0.75 },
];

// the single static frame prefers-reduced-motion freezes on: far enough past
// t=0 that the two close-ratio passes (k=6.0 / 6.4) have visibly de-phased
// into a legible beat, and each pass has turned enough to be structurally
// distinct rather than sitting in near-registration the way they do at t=0.
const STATIC_T = 5.8;

function smoothstep(x: number): number {
  const c = x < 0 ? 0 : x > 1 ? 1 : x;
  return c * c * (3 - 2 * c);
}

/** Sample one hypotrochoid (R=1, r=R/k, d=0.85r) and normalize its max radius to 1. */
function buildUnitCurve(k: number, out: Float32Array): void {
  const r = 1 / k;
  const Rr = 1 - r;
  const d = 0.85 * r;
  const ratio = Rr / r;
  let maxDist = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const t = (i / SAMPLES) * 2 * Math.PI * PERIODS;
    const x = Rr * Math.cos(t) + d * Math.cos(ratio * t);
    const y = Rr * Math.sin(t) - d * Math.sin(ratio * t);
    out[i * 2] = x;
    out[i * 2 + 1] = y;
    const dist = Math.hypot(x, y);
    if (dist > maxDist) maxDist = dist;
  }
  const inv = maxDist > 0 ? 1 / maxDist : 1;
  for (let i = 0; i < SAMPLES * 2; i++) out[i] *= inv;
}

export interface GuillocheFieldProps {
  /** headline / CTA centered over the field's least-covered zone */
  children?: ReactNode;
  /** concentric rings per pass, center -> edge. @default 36 */
  ringCount?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
  /** inline styles merged onto the root element */
  style?: React.CSSProperties;
}

export function GuillocheField({
  children,
  ringCount = RINGS,
  className = "",
  style,
}: GuillocheFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rings = Math.max(4, Math.round(ringCount));

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // token fields start empty; nothing paints until readTokens() has run at
    // least once (guarded in draw() below), closing every path — rAF, the
    // reduced-motion branch, resize — that could otherwise paint a literal.
    let fgColor = "";
    let mutedColor = "";
    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      fgColor = cs.getPropertyValue("--foreground").trim();
      mutedColor = cs.getPropertyValue("--ns-muted").trim();
    };

    let w = 0;
    let h = 0;
    let cx = 0;
    let cy = 0;
    let maxRadiusX = 0;
    let maxRadiusY = 0;
    let sized = false;
    let visible = true;
    let raf = 0;
    let t = reduced ? STATIC_T : 0;
    let last = 0;
    let lastRebuild = -Infinity;

    // per-pass cached unit curve tables, rebuilt at most every REBUILD_MS
    const tables: Float32Array[] = PASSES.map(() => new Float32Array(SAMPLES * 2));
    let tablesReady = false;

    // pointer tilt: eased scalar in [0,1], nudges driftAmp on the next
    // rebuild. Purely optional — drift and rotation run identically at 0.
    let tiltTarget = 0;
    let tilt = 0;
    let tiltDecayAt = 0;

    const rebuildTables = () => {
      for (let p = 0; p < PASSES.length; p++) {
        const pass = PASSES[p];
        const k = pass.k0 + pass.driftAmp * (1 + tilt * 0.6) * Math.sin(pass.driftOmega * t + pass.phase0);
        buildUnitCurve(Math.max(2.05, k), tables[p]);
      }
      tablesReady = true;
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        sized = false;
        return;
      }
      const isCard = !!canvas.closest("[data-autoplay-root]");
      const dpr = isCard
        ? Math.min(0.6, window.devicePixelRatio || 1)
        : Math.min(window.devicePixelRatio || 1, 1.5);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = w / 2;
      cy = h / 2;
      // envelope is an ellipse sized off each axis independently — a wide
      // container gets a wide-short portrait window (matching an engine-
      // turned banknote oval) instead of a circle inscribed in whichever
      // axis is shorter, which left almost no horizontal clearance once the
      // container got as wide as a real hero/card frame.
      maxRadiusX = w * ENVELOPE_COVER;
      maxRadiusY = h * ENVELOPE_COVER;
      sized = true;
    };

    const ringScale = (i: number) => 0.05 + (0.95 * i) / Math.max(1, rings - 1);
    // coverage stays flat at alphaMin out to RAMP_START, THEN smoothsteps up
    // to alphaMax by s=1 — the flat run is the actual readable window, not
    // just smoothstep's slow start (which alone still put visible density
    // under a hero-sized headline at card scale).
    const coverageOf = (s: number) => {
      const u = RAMP_START >= 1 ? 0 : Math.max(0, Math.min(1, (s - RAMP_START) / (1 - RAMP_START)));
      return smoothstep(u);
    };

    const draw = () => {
      if (!sized || !fgColor || !tablesReady) return;
      ctx.clearRect(0, 0, w, h);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      for (let p = 0; p < PASSES.length; p++) {
        const pass = PASSES[p];
        const table = tables[p];
        const theta = ((pass.rotRate * t) % 360) * (Math.PI / 180);
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const color = pass.color === "fg" ? fgColor : mutedColor;

        const buckets: Path2D[] = Array.from({ length: ALPHA_BUCKETS }, () => new Path2D());
        const bucketHasPoints = new Uint8Array(ALPHA_BUCKETS);

        for (let i = 0; i < rings; i++) {
          const s = ringScale(i);
          const radiusX = s * maxRadiusX;
          const radiusY = s * maxRadiusY;
          const alpha = pass.alphaMin + (pass.alphaMax - pass.alphaMin) * coverageOf(s);
          const bucket = Math.min(ALPHA_BUCKETS - 1, Math.floor(alpha * ALPHA_BUCKETS));
          const path = buckets[bucket];
          bucketHasPoints[bucket] = 1;

          const ux0 = table[0];
          const uy0 = table[1];
          let rx = ux0 * cosT - uy0 * sinT;
          let ry = ux0 * sinT + uy0 * cosT;
          let px = cx + rx * radiusX;
          let py = cy + ry * radiusY;
          path.moveTo(px, py);
          for (let j = 1; j < SAMPLES; j++) {
            const ux = table[j * 2];
            const uy = table[j * 2 + 1];
            rx = ux * cosT - uy * sinT;
            ry = ux * sinT + uy * cosT;
            px = cx + rx * radiusX;
            py = cy + ry * radiusY;
            path.lineTo(px, py);
          }
          path.closePath();
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = pass.lineWidth;
        for (let b = 0; b < ALPHA_BUCKETS; b++) {
          if (!bucketHasPoints[b]) continue;
          ctx.globalAlpha = (b + 0.5) / ALPHA_BUCKETS;
          ctx.stroke(buckets[b]);
        }
      }
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      t += dt;

      if (tiltDecayAt && now > tiltDecayAt) tiltTarget = 0;
      tilt += (tiltTarget - tilt) * TILT_EASE;

      if (now - lastRebuild >= REBUILD_MS) {
        rebuildTables();
        lastRebuild = now;
      }
      draw();
      if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      const ny = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1;
      tiltTarget = Math.min(1, Math.hypot(nx, ny));
      tiltDecayAt = performance.now() + TILT_TAU_MS;
    };
    const onPointerLeave = () => {
      tiltTarget = 0;
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (reduced) {
          rebuildTables();
          draw();
        }
      }, 120);
    });
    ro.observe(root);

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        if (visible && !reduced && !raf) {
          last = 0;
          raf = requestAnimationFrame(loop);
        }
      },
      { threshold: 0 }
    );
    io.observe(root);

    const onVis = () => {
      if (!document.hidden && visible && !reduced && !raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced || !raf) draw();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    readTokens();
    resize();
    rebuildTables();

    if (reduced) {
      draw();
    } else {
      root.addEventListener("pointermove", onPointerMove);
      root.addEventListener("pointerleave", onPointerLeave);
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [ringCount]);

  return (
    <div
      ref={rootRef}
      className={`relative isolate min-h-screen w-full overflow-hidden bg-background ${className}`}
      style={style}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 block h-full w-full"
      />
      {children ? (
        <div className="relative z-10 flex min-h-screen w-full flex-col items-center justify-center gap-4 px-6 text-center">
          {children}
        </div>
      ) : null}
    </div>
  );
}
