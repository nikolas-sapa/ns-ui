"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// ThinkingGlyph — a small canvas-2D "assistant state" indicator: a soft ink
// blob traced through N points sampled around a circle, each point's radius
// perturbed by a per-state motion function. No WebGL, no SVG filters — flat
// canvas fills and strokes only, so it renders identically across browsers.
//
// Six states, six distinct motion signatures (not six lookups into the same
// noise field):
//   idle      — one slow sine wobble, gentle breathing scale
//   thinking  — three additive sine bands at different frequencies/phases
//               plus tiny deterministic per-point jitter (turbulent surface)
//   listening — the blob itself barely moves; a ring emits from its edge and
//               expands/fades on a fixed period (sonar pulse)
//   speaking  — a 6-lobe standing wave rides the outline, amplitude
//               modulated by a slow envelope (a wobbling waveform, not audio
//               reactive — no external signal)
//   success   — wobble amplitude eases to zero (blob settles into a near
//               circle) and a checkmark strokes itself in, timed from the
//               moment `state` became "success"
//   error     — a short decaying horizontal shake plays every ~900ms and an
//               X strokes itself in, timed from the moment `state` became
//               "error"
//
// Ink comes from --foreground/--ns-muted for the blob and --ns-accent/--success/
// --error for the sonar ring, checkmark and X respectively, all read via
// getComputedStyle at mount and re-read on a MutationObserver watching
// documentElement's class attribute. The rAF loop pauses on
// visibilitychange and under prefers-reduced-motion, drawing one static
// settled frame instead. Backing store is dpr-clamped to 2.
// ---------------------------------------------------------------------------

export type ThinkingGlyphState = "idle" | "thinking" | "listening" | "speaking" | "success" | "error";

export interface ThinkingGlyphProps {
  /** Which motion signature to show. @default "idle" */
  state?: ThinkingGlyphState;
  /** Rendered diameter in CSS px. @default 48 */
  size?: number;
  /** Animation speed multiplier. @default 1 */
  speed?: number;
  /** Freezes the current frame. @default false */
  paused?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const POINTS = 72;
const TWO_PI = Math.PI * 2;

const STATE_LABEL: Record<ThinkingGlyphState, string> = {
  idle: "idle",
  thinking: "thinking",
  listening: "listening",
  speaking: "speaking",
  success: "done",
  error: "error",
};

function hashP(i: number): number {
  const h = Math.sin(i * 91.345 + 12.9) * 43758.5453;
  return h - Math.floor(h);
}

function parseHex(raw: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function ThinkingGlyph({
  state = "idle",
  size = 48,
  speed = 1,
  paused = false,
  className = "",
  style,
}: ThinkingGlyphProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef(state);
  const speedRef = useRef(speed);
  const pausedRef = useRef(paused);
  const now = () => (typeof performance !== "undefined" ? performance.now() : 0);
  const stateSinceRef = useRef(now());

  if (stateRef.current !== state) {
    stateRef.current = state;
    stateSinceRef.current = now();
  }
  speedRef.current = speed;
  pausedRef.current = paused;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let running = false;
    let dpr = 1;

    let fg = "rgba(23,23,23,1)";
    let fgSoft = "rgba(23,23,23,0.14)";
    let mutedStyle = "rgba(77,77,77,1)";
    let accentStyle = "#006bff";
    let successStyle = "#47a447";
    let errorStyle = "#ea001d";

    const readInk = () => {
      const cs = getComputedStyle(document.documentElement);
      const fgHex = cs.getPropertyValue("--foreground").trim();
      const rgb = parseHex(fgHex) ?? [23, 23, 23];
      fg = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.92)`;
      fgSoft = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.14)`;
      mutedStyle = cs.getPropertyValue("--ns-muted").trim() || "#4d4d4d";
      accentStyle = cs.getPropertyValue("--ns-accent").trim() || "#006bff";
      successStyle = cs.getPropertyValue("--success").trim() || "#47a447";
      errorStyle = cs.getPropertyValue("--error").trim() || "#ea001d";
    };
    readInk();

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const cx = size / 2;
    const cy = size / 2;
    const baseR = size * 0.32;

    // per-point jitter phase, stable across frames (deterministic hash, not
    // Math.random — reproducible and free of a seeded-PRNG dependency)
    const jitter = new Float32Array(POINTS);
    for (let i = 0; i < POINTS; i++) jitter[i] = hashP(i) * TWO_PI;

    const radiusFor = (i: number, angle: number, t: number, st: ThinkingGlyphState, since: number): number => {
      const age = (performance.now() - since) / 1000;
      switch (st) {
        case "idle":
          return baseR * (1 + 0.04 * Math.sin(angle * 3 + t * 1.1));
        case "thinking":
          return (
            baseR *
            (1 +
              0.05 * Math.sin(angle * 5 + t * 2.3) +
              0.035 * Math.sin(angle * 8 - t * 3.1 + 1.7) +
              0.018 * Math.sin(angle * 13 + t * 4.3 + jitter[i]))
          );
        case "listening":
          return baseR * (1 + 0.05 * Math.sin(t * 3.2));
        case "speaking": {
          const envelope = 0.6 + 0.4 * Math.sin(t * 1.4);
          return baseR * (1 + 0.11 * envelope * Math.sin(angle * 6 + t * 5.2));
        }
        case "success": {
          const settle = Math.min(1, age / 0.5);
          const wobble = (1 - settle) * 0.05 * Math.sin(angle * 4 + t * 2);
          return baseR * (1 + wobble);
        }
        case "error": {
          const cyclePos = (t * 1.05) % 1;
          const burst = cyclePos < 0.35 ? Math.exp(-cyclePos * 14) : 0;
          return baseR * (1 + 0.03 * Math.sin(angle * 4 + t * 3) + 0.01 * burst);
        }
        default:
          return baseR;
      }
    };

    const drawBlob = (t: number, st: ThinkingGlyphState, since: number) => {
      let shakeX = 0;
      if (st === "error") {
        const cyclePos = (t * 1.05) % 1;
        if (cyclePos < 0.35) {
          const decay = Math.exp(-cyclePos * 14);
          shakeX = Math.sin(cyclePos * 90) * 3 * decay;
        }
      }

      ctx.save();
      ctx.translate(shakeX, 0);

      const pts: [number, number][] = [];
      for (let i = 0; i < POINTS; i++) {
        const angle = (i / POINTS) * TWO_PI;
        const r = radiusFor(i, angle, t, st, since);
        pts.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
      }

      ctx.beginPath();
      const first = pts[0];
      ctx.moveTo((first[0] + pts[POINTS - 1][0]) / 2, (first[1] + pts[POINTS - 1][1]) / 2);
      for (let i = 0; i < POINTS; i++) {
        const p = pts[i];
        const next = pts[(i + 1) % POINTS];
        const midX = (p[0] + next[0]) / 2;
        const midY = (p[1] + next[1]) / 2;
        ctx.quadraticCurveTo(p[0], p[1], midX, midY);
      }
      ctx.closePath();

      ctx.fillStyle = fgSoft;
      ctx.fill();
      ctx.lineWidth = Math.max(1, size * 0.03);
      ctx.strokeStyle = st === "thinking" ? mutedStyle : fg;
      ctx.stroke();
      ctx.restore();
    };

    const drawSonar = (t: number) => {
      const period = 1.2;
      const phase = (t % period) / period;
      const r = baseR * (1 + phase * 0.9);
      const alpha = (1 - phase) * 0.45;
      if (alpha <= 0.01) return;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TWO_PI);
      ctx.strokeStyle = accentStyle;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = Math.max(1, size * 0.02);
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    const drawCheck = (since: number) => {
      const age = (performance.now() - since) / 1000;
      const p = Math.min(1, age / 0.4);
      if (p <= 0) return;
      const x0 = cx - baseR * 0.42;
      const y0 = cy + baseR * 0.02;
      const x1 = cx - baseR * 0.08;
      const y1 = cy + baseR * 0.34;
      const x2 = cx + baseR * 0.46;
      const y2 = cy - baseR * 0.32;
      ctx.beginPath();
      ctx.strokeStyle = successStyle;
      ctx.lineWidth = Math.max(1.5, size * 0.06);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(x0, y0);
      if (p <= 0.5) {
        const seg = p / 0.5;
        ctx.lineTo(x0 + (x1 - x0) * seg, y0 + (y1 - y0) * seg);
      } else {
        ctx.lineTo(x1, y1);
        const seg = (p - 0.5) / 0.5;
        ctx.lineTo(x1 + (x2 - x1) * seg, y1 + (y2 - y1) * seg);
      }
      ctx.stroke();
    };

    const drawX = (since: number) => {
      const age = (performance.now() - since) / 1000;
      const p = Math.min(1, age / 0.35);
      if (p <= 0) return;
      const k = baseR * 0.36;
      ctx.strokeStyle = errorStyle;
      ctx.lineWidth = Math.max(1.5, size * 0.06);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx - k, cy - k);
      ctx.lineTo(cx - k + (2 * k) * Math.min(1, p * 2), cy - k + (2 * k) * Math.min(1, p * 2));
      ctx.stroke();
      if (p > 0.5) {
        const seg = (p - 0.5) / 0.5;
        ctx.beginPath();
        ctx.moveTo(cx + k, cy - k);
        ctx.lineTo(cx + k - (2 * k) * seg, cy - k + (2 * k) * seg);
        ctx.stroke();
      }
    };

    const draw = (nowMs: number) => {
      ctx.clearRect(0, 0, size, size);
      const st = stateRef.current;
      const since = stateSinceRef.current;
      const t = (nowMs / 1000) * speedRef.current;
      if (st === "listening") drawSonar(t);
      drawBlob(t, st, since);
      if (st === "success") drawCheck(since);
      if (st === "error") drawX(since);
    };

    const loop = (t: number) => {
      draw(t);
      raf = requestAnimationFrame(loop);
    };
    const wake = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };
    const sleep = () => {
      cancelAnimationFrame(raf);
      running = false;
    };

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;
    const applyMode = () => {
      if (reduced || pausedRef.current) {
        sleep();
        draw(performance.now());
      } else {
        wake();
      }
    };
    const onMq = () => {
      reduced = mq.matches;
      applyMode();
    };
    mq.addEventListener("change", onMq);
    applyMode();

    let pollId = 0;
    let lastPaused = pausedRef.current;
    const poll = () => {
      if (pausedRef.current !== lastPaused) {
        lastPaused = pausedRef.current;
        applyMode();
      }
      pollId = window.setTimeout(poll, 120);
    };
    poll();

    const onVis = () => {
      if (document.hidden) sleep();
      else if (!reduced && !pausedRef.current) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    const themeObserver = new MutationObserver(() => {
      readInk();
      if (reduced || pausedRef.current) draw(performance.now());
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
      themeObserver.disconnect();
      window.clearTimeout(pollId);
      sleep();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  return (
    <div
      role="img"
      aria-label={`Assistant is ${STATE_LABEL[state]}`}
      className={className}
      style={{ width: size, height: size, display: "inline-block", ...style }}
    >
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  );
}

ThinkingGlyph.displayName = "ThinkingGlyph";
