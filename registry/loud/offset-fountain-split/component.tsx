"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// OffsetFountainSplit — a full-bleed ambient background modeling a web-offset
// press ink train: ink drawn from a fountain reservoir passes through a chain
// of 6 rollers (fountain -> ductor -> 4 oscillating distributors -> form),
// splitting into a thinner film at every nip (value(x,i) = 0.5*value(x,i-1)
// + 0.5*value(x,i-1) sampled at a laterally-oscillating offset) so each stage
// both halves-and-recombines AND smears sideways. The fountain roller itself
// never holds still: it tracks 24 discrete "fountain key" zones across the
// width, each drifting on its own slow sine (a real press operator's key
// settings are never perfectly stable), which is what keeps the whole train
// from ever converging to a flat field — the visible symptom real pressmen
// call "ribbing", fought with exactly this roller train.
//
// Only the FINAL (form-roller) field is painted, as vertical full-height
// ink-density strips: --foreground at an alpha proportional to that band's
// value, over the --background the wrapper already shows. No canvas fill of
// background — nothing paints before the token read below, and the wrapper's
// own bg-background class covers the frame regardless.
//
// Every roller's array persists across frames and relaxes toward its target
// with a 180ms time constant, so a fountain-key shift visibly ripples down
// the train stage by stage instead of snapping instantly.
// ---------------------------------------------------------------------------

const ROLLER_COUNT = 6; // 0 fountain, 1-4 distributors (oscillate), 5 form
const OSC_START = 1;
const OSC_END = 4; // inclusive — bands 0 and 5 never oscillate
const ZONE_COUNT = 24;
const ZONE_BASE = 0.5;
const ZONE_DRIFT_PERIOD = 40; // s
const ZONE_DRIFT_AMPLITUDE = 0.18;
const RELAX_TAU = 0.18; // s, per-band relaxation constant
const OSC_PERIOD = 2.6; // s, distributor oscillation
const OSC_AMPLITUDE_PX = 14;
const NUDGE_BOOST = 0.1;
const NUDGE_DECAY = 1.2; // s, linear decay back to 0
const FREEZE_T = 8.4; // s — chosen phase for the reduced-motion frame
const COL_PITCH_MIN = 3;
const COL_PITCH_MAX = 10; // px — derived from container's smaller dimension
const N_MIN = 256;
const N_MAX = 720; // sample count clamp
const MAX_ALPHA_DARK = 0.85;
const MAX_ALPHA_LIGHT = 0.75;
const DPR_CAP = 1.5;
const RESIZE_DEBOUNCE_MS = 150;

function clamp(x: number, lo: number, hi: number) {
  return x < lo ? lo : x > hi ? hi : x;
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// relative luminance of a `--token` value read as a hex string; returns null
// if the token isn't a plain hex color (e.g. inherits `currentColor`).
function hexLuminance(raw: string): number | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export interface OffsetFountainSplitProps {
  className?: string;
  style?: CSSProperties;
}

export function OffsetFountainSplit({
  className = "",
  style,
}: OffsetFountainSplitProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let sized = false;
    let visible = false;

    let fg = "currentColor";
    let maxAlpha = MAX_ALPHA_DARK;

    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      fg = cs.getPropertyValue("--foreground").trim() || fg;
      const bgRaw = cs.getPropertyValue("--background").trim();
      const fl = hexLuminance(fg);
      const bl = hexLuminance(bgRaw);
      // background lighter than foreground => light theme, cap alpha lower
      // (dark ink on a light ground reads heavier at equal alpha).
      maxAlpha =
        fl != null && bl != null && bl > fl ? MAX_ALPHA_LIGHT : MAX_ALPHA_DARK;
    };

    let width = 0;
    let height = 0;
    let colPitch = COL_PITCH_MIN;
    let n = N_MIN;

    let bands: Float32Array[] = [];
    const zonePhase = new Float32Array(ZONE_COUNT);
    const zoneBoost = new Float32Array(ZONE_COUNT);
    for (let z = 0; z < ZONE_COUNT; z++) zonePhase[z] = z * 0.9137;

    const initBands = () => {
      bands = [];
      for (let i = 0; i < ROLLER_COUNT; i++) bands.push(new Float32Array(n));
      zoneBoost.fill(0);
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w < 2 || h < 2) {
        sized = false;
        return;
      }
      width = w;
      height = h;
      colPitch = clamp(Math.min(w, h) / 90, COL_PITCH_MIN, COL_PITCH_MAX);
      n = clamp(Math.ceil(w / colPitch), N_MIN, N_MAX);
      colPitch = w / n; // exact pitch so columns tile the width with no gap
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initBands();
      sized = true;
    };

    // stepped fountain-key field: 24 discrete zones, each drifting on its
    // own slow sine plus a decaying pointer "key tweak" boost.
    const zoneTargetAt = (xSample: number, t: number) => {
      const zoneW = n / ZONE_COUNT;
      const z = clamp(Math.floor(xSample / zoneW), 0, ZONE_COUNT - 1);
      const drift =
        ZONE_DRIFT_AMPLITUDE *
        Math.sin((2 * Math.PI * t) / ZONE_DRIFT_PERIOD + zonePhase[z]);
      return clamp(ZONE_BASE + drift + zoneBoost[z], 0, 1);
    };

    const cascade = (t: number, relax: number, write: Float32Array[]) => {
      const b0 = write[0];
      for (let x = 0; x < n; x++) {
        const target = zoneTargetAt(x, t);
        b0[x] += (target - b0[x]) * relax;
      }
      for (let i = 1; i < ROLLER_COUNT; i++) {
        const prev = write[i - 1];
        const cur = write[i];
        const oscillating = i >= OSC_START && i <= OSC_END;
        const offsetPx = oscillating
          ? OSC_AMPLITUDE_PX * Math.sin((2 * Math.PI * t) / OSC_PERIOD + i * 0.7)
          : 0;
        const offsetSamples = offsetPx / colPitch;
        for (let x = 0; x < n; x++) {
          let xs = x - offsetSamples;
          if (xs < 0) xs = 0;
          else if (xs > n - 1) xs = n - 1;
          const x0 = Math.floor(xs);
          const x1 = Math.min(n - 1, x0 + 1);
          const shifted = lerp(prev[x0], prev[x1], xs - x0);
          const target = 0.5 * prev[x] + 0.5 * shifted;
          cur[x] += (target - cur[x]) * relax;
        }
      }
    };

    const paintField = (field: Float32Array) => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = fg;
      for (let x = 0; x < n; x++) {
        const alpha = clamp(field[x], 0, 1) * maxAlpha;
        if (alpha <= 0.002) continue;
        ctx.globalAlpha = alpha;
        ctx.fillRect(x * colPitch, 0, colPitch + 1, height);
      }
      ctx.globalAlpha = 1;
    };

    const drawFrame = () => {
      if (!sized) return;
      paintField(bands[ROLLER_COUNT - 1]);
    };

    // reduced-motion: one static frame at a fixed sim-time, computed as if
    // every band had already fully relaxed to its instantaneous target
    // (relax = 1) rather than replaying the transient history — a legible
    // "process caught mid-run" frame with no rAF loop and no listeners.
    const drawStaticFreeze = () => {
      if (!sized) return;
      const tmp: Float32Array[] = [];
      for (let i = 0; i < ROLLER_COUNT; i++) tmp.push(new Float32Array(n));
      cascade(FREEZE_T, 1, tmp);
      paintField(tmp[ROLLER_COUNT - 1]);
    };

    let raf = 0;
    let last = 0;
    let simT = 0;

    const loop = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      simT += dt;
      cascade(simT, 1 - Math.exp(-dt / RELAX_TAU), bands);
      for (let z = 0; z < ZONE_COUNT; z++) {
        if (zoneBoost[z] > 0) {
          zoneBoost[z] = Math.max(
            0,
            zoneBoost[z] - (NUDGE_BOOST / NUDGE_DECAY) * dt
          );
        }
      }
      drawFrame();
      raf = !document.hidden && visible ? requestAnimationFrame(loop) : 0;
    };

    const startLoop = () => {
      if (raf || reduced || document.hidden || !visible || !sized) return;
      last = 0;
      raf = requestAnimationFrame(loop);
    };
    const stopLoop = () => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (reduced || !sized) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x < 0 || x > rect.width || y < 0 || y > rect.height) return;
      const xs = x / colPitch;
      const zoneW = n / ZONE_COUNT;
      const z = clamp(Math.floor(xs / zoneW), 0, ZONE_COUNT - 1);
      zoneBoost[z] = NUDGE_BOOST;
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (reduced) drawStaticFreeze();
      }, RESIZE_DEBOUNCE_MS);
    };

    readTokens();
    resize();
    if (reduced) {
      drawStaticFreeze();
    }

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) drawStaticFreeze();
      else if (sized && !raf) drawFrame();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const ro = new ResizeObserver(onResize);
    ro.observe(root);

    let io: IntersectionObserver | undefined;
    const onVis = () => {
      if (document.hidden) stopLoop();
      else startLoop();
    };

    if (!reduced) {
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            visible = entry.isIntersecting;
            if (visible) startLoop();
            else stopLoop();
          }
        },
        { threshold: 0 }
      );
      io.observe(root);
      document.addEventListener("visibilitychange", onVis);
      window.addEventListener("pointermove", onPointerMove);
    }

    return () => {
      stopLoop();
      if (resizeTimer) clearTimeout(resizeTimer);
      mo.disconnect();
      ro.disconnect();
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`relative h-full w-full overflow-hidden bg-background ${
        /\bmin-h-/.test(className) ? "" : "min-h-screen"
      } ${className}`}
      style={style}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 block h-full w-full"
      />
    </div>
  );
}
